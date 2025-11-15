"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from 'next/navigation'
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { RefreshCw, LogOut, MoreVertical, Users, Shield, Info, FileText, Package, RotateCcw, DollarSign } from 'lucide-react'
import { fetchAndCacheItems } from "@/lib/items-cache"
import type { TornItem } from "@/lib/items-cache"
import CrimeSummary from "@/components/crime-summary"
import CrimeSuccessCharts from "@/components/crime-success-charts"
import { handleApiError, validateApiResponse } from "@/lib/api-error-handler"
import { ResetConfirmationDialog } from "@/components/reset-confirmation-dialog"
import { clearAllCache } from "@/lib/cache-reset"
import { crimeApiCache } from "@/lib/crime-api-cache"
import { canAccessArmory, canAccessFunds } from "@/lib/api-scopes"
import { handleFullLogout } from "@/lib/logout-handler"

interface Crime {
  id: number
  status: string
  rewards?: {
    money: number
    items: Array<{ id: number; quantity: number }>
    respect: number
  }
  executed_at: number
}

export default function Dashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const [crimes, setCrimes] = useState<Crime[]>([])
  const [memberCount, setMemberCount] = useState(0)
  const [items, setItems] = useState<Map<number, TornItem>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isFetchingHistorical, setIsFetchingHistorical] = useState(false)
  const [historicalProgress, setHistoricalProgress] = useState({ current: 0, total: 0 })
  const [historicalCrimes, setHistoricalCrimes] = useState<Crime[]>([])
  const [historicalFetchComplete, setHistoricalFetchComplete] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [hasArmoryScope, setHasArmoryScope] = useState(true)
  const [hasFundsScope, setHasFundsScope] = useState(true)

  const allCrimes = useMemo(() => {
    const crimeMap = new Map<number, Crime>()

    historicalCrimes.forEach((crime) => {
      crimeMap.set(crime.id, crime)
    })

    crimes.forEach((crime) => {
      crimeMap.set(crime.id, crime)
    })

    return Array.from(crimeMap.values())
  }, [crimes, historicalCrimes])

  useEffect(() => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (!apiKey) {
      router.push("/")
      return
    }

    setHasArmoryScope(canAccessArmory())
    setHasFundsScope(canAccessFunds())

    const cached = localStorage.getItem("factionHistoricalCrimes")
    if (cached) {
      try {
        const parsedCrimes = JSON.parse(cached)
        setHistoricalCrimes(parsedCrimes)
        setHistoricalFetchComplete(true)
      } catch (err) {
        console.error("[v0] Error loading cached crimes:", err)
      }
    }

    fetchData(apiKey)
    setTimeout(() => {
      fetchHistoricalCrimes(apiKey)
    }, 1000)
  }, [router])

  const fetchData = async (apiKey: string) => {
    setIsLoading(true)

    try {
      const itemsData = await fetchAndCacheItems(apiKey)
      setItems(itemsData)

      const membersRes = await fetch("https://api.torn.com/v2/faction/members?striptags=true", {
        headers: {
          Authorization: `ApiKey ${apiKey}`,
          accept: "application/json",
        },
      })

      if (!membersRes.ok) {
        await handleApiError(membersRes, "/faction/members")
      }

      const membersData = await membersRes.json()
      validateApiResponse(membersData, "/faction/members")

      setMemberCount(Object.keys(membersData.members || {}).length)

      const crimesRes = await fetch("https://api.torn.com/v2/faction/crimes?striptags=true", {
        headers: {
          Authorization: `ApiKey ${apiKey}`,
          accept: "application/json",
        },
      })

      if (!crimesRes.ok) {
        await handleApiError(crimesRes, "/faction/crimes")
      }

      const crimesData = await crimesRes.json()
      validateApiResponse(crimesData, "/faction/crimes")

      setCrimes(Object.values(crimesData.crimes || {}))

      if (!refreshing) {
        toast({
          title: "Success",
          description: "Dashboard loaded successfully",
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load data"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchHistoricalCrimes = async (apiKey: string) => {
    const cached = localStorage.getItem("factionHistoricalCrimes")
    const lastFetch = localStorage.getItem("lastHistoricalFetch")

    if (cached && lastFetch) {
      const timeSinceLastFetch = Date.now() - Number.parseInt(lastFetch)
      if (timeSinceLastFetch < 3600000) {
        console.log("[v0] Using cached historical crimes")
        setHistoricalFetchComplete(true)
        return
      }
    }

    setIsFetchingHistorical(true)
    const allCrimes: Crime[] = []
    let hasMoreData = true
    let oldestTimestamp: number | null = null
    let lastOldestCrimeId: number | null = null
    let requestCount = 0
    const REQUEST_DELAY = 2500

    try {
      console.log("[v0] Fetching latest crimes (fresh, not cached)")
      const firstUrl = `https://api.torn.com/v2/faction/crimes?cat=completed&sort=DESC&striptags=true`
      const firstData = await crimeApiCache.fetchWithCache(firstUrl, apiKey, true)

      if (firstData.crimes) {
        const crimesArray = Object.values(firstData.crimes)
        allCrimes.push(...crimesArray)
        setHistoricalCrimes([...allCrimes])

        if (crimesArray.length > 0) {
          const oldestCrime = crimesArray.reduce((oldest: Crime, crime: Crime) =>
            crime.executed_at < oldest.executed_at ? crime : oldest,
          )
          oldestTimestamp = oldestCrime.executed_at
          lastOldestCrimeId = oldestCrime.id
        } else {
          hasMoreData = false
        }
      } else {
        hasMoreData = false
      }

      setHistoricalProgress({ current: allCrimes.length, total: allCrimes.length })

      while (hasMoreData && oldestTimestamp && requestCount < 100) {
        await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY))
        requestCount++

        const historicalUrl = `https://api.torn.com/v2/faction/crimes?cat=completed&sort=DESC&to=${oldestTimestamp}&striptags=true`
        const data = await crimeApiCache.fetchWithCache(historicalUrl, apiKey, false)

        if (data.crimes && Object.keys(data.crimes).length > 0) {
          const crimesArray = Object.values(data.crimes)

          const newOldestCrime = crimesArray.reduce((oldest: Crime, crime: Crime) =>
            crime.executed_at < oldest.executed_at ? crime : oldest,
          )

          if (newOldestCrime.id === lastOldestCrimeId) {
            hasMoreData = false
            break
          }

          allCrimes.push(...crimesArray)
          setHistoricalCrimes([...allCrimes])
          oldestTimestamp = newOldestCrime.executed_at
          lastOldestCrimeId = newOldestCrime.id

          setHistoricalProgress({ current: allCrimes.length, total: allCrimes.length })
        } else {
          hasMoreData = false
        }
      }

      if (allCrimes.length > 0) {
        localStorage.setItem("factionHistoricalCrimes", JSON.stringify(allCrimes))
        localStorage.setItem("lastHistoricalFetch", Date.now().toString())
        console.log(`[v0] Fetched ${allCrimes.length} historical crimes`)
      }
    } catch (err) {
      console.error("[v0] Error fetching historical crimes:", err)
    } finally {
      setIsFetchingHistorical(false)
      setHistoricalFetchComplete(true)
    }
  }

  const handleLogout = () => {
    handleFullLogout()
    toast({
      title: "Success",
      description: "Logged out successfully",
    })
    setTimeout(() => {
      router.push("/")
    }, 500)
  }

  const handleRefresh = async () => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (apiKey) {
      setRefreshing(true)
      await fetchData(apiKey)
      setRefreshing(false)
      toast({
        title: "Success",
        description: "Data refreshed successfully",
      })
    }
  }

  const handleReset = async () => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (apiKey) {
      clearAllCache()

      setHistoricalCrimes([])
      setHistoricalFetchComplete(false)
      setCrimes([])
      setItems(new Map())

      setRefreshing(true)
      await fetchData(apiKey)
      setTimeout(() => {
        fetchHistoricalCrimes(apiKey)
      }, 1000)
      setRefreshing(false)

      toast({
        title: "Success",
        description: "Cache cleared and data refreshed from API",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading faction data...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="flex-shrink-0 border-b border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <button onClick={() => router.push("/dashboard")} className="hover:opacity-80 transition-opacity">
              <h1 className="text-3xl font-bold text-foreground">Faction Crimes</h1>
            </button>
            <p className="text-muted-foreground mt-1">View and manage faction operations</p>
            {isFetchingHistorical && (
              <p className="text-xs text-cyan-400 mt-1 flex items-center gap-2">
                <RefreshCw size={12} className="animate-spin" />
                Fetching historical data... {historicalProgress.current.toLocaleString()} crimes loaded
              </p>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="p-2 hover:bg-accent rounded-lg transition-colors border border-border"
              title="Menu"
            >
              <MoreVertical size={20} />
            </button>
            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={() => {
                      router.push("/dashboard/faction")
                      setDropdownOpen(false)
                    }}
                    className="w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-accent transition-colors"
                  >
                    <Info size={18} />
                    Faction
                  </button>
                  <button
                    onClick={() => {
                      setDropdownOpen(false)
                      setResetDialogOpen(true)
                    }}
                    disabled={refreshing}
                    className="w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-accent transition-colors disabled:opacity-50 border-t border-border"
                  >
                    <RotateCcw size={18} />
                    Reset
                  </button>
                  <button
                    onClick={() => {
                      handleLogout()
                      setDropdownOpen(false)
                    }}
                    className="w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-destructive/10 text-destructive transition-colors border-t border-border"
                  >
                    <LogOut size={18} />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <ResetConfirmationDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen} onConfirm={handleReset} />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {allCrimes.length > 0 && <CrimeSummary crimes={allCrimes} items={items} />}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              href="/dashboard/members"
              className={`bg-card border border-border rounded-lg p-4 hover:border-primary transition-all text-left group block ${
                !historicalFetchComplete ? "pointer-events-none opacity-50" : "cursor-pointer"
              }`}
              onClick={(e) => {
                if (!historicalFetchComplete) {
                  e.preventDefault()
                  toast({
                    title: "Please wait",
                    description: "Historical data is still loading...",
                    variant: "destructive",
                  })
                }
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-primary/20 p-2 rounded-lg border border-primary/40">
                  <Users size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                    Members
                  </h2>
                  <p className="text-xs text-muted-foreground">View faction members</p>
                </div>
              </div>
              <div className="text-3xl font-bold text-primary mb-1">{memberCount}</div>
              <p className="text-xs text-muted-foreground">Total members with participation stats</p>
            </Link>

            <Link
              href="/dashboard/crimes"
              className={`bg-card border border-border rounded-lg p-4 hover:border-accent transition-all text-left group block ${
                !historicalFetchComplete ? "pointer-events-none opacity-50" : "cursor-pointer"
              }`}
              onClick={(e) => {
                if (!historicalFetchComplete) {
                  e.preventDefault()
                  toast({
                    title: "Please wait",
                    description: "Historical data is still loading...",
                    variant: "destructive",
                  })
                }
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-accent/20 p-2 rounded-lg border border-accent/40">
                  <Shield size={20} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-foreground group-hover:text-accent transition-colors">
                    Organized Crimes
                  </h2>
                  <p className="text-xs text-muted-foreground">Manage operations</p>
                </div>
              </div>
              <div className="text-3xl font-bold text-accent mb-1">{allCrimes.length}</div>
              <p className="text-xs text-muted-foreground">Active and completed crimes</p>
            </Link>

            <Link
              href="/dashboard/armory"
              className={`bg-card border rounded-lg p-4 transition-all text-left group block ${
                !historicalFetchComplete || !hasArmoryScope
                  ? "pointer-events-none opacity-40 border-border/50"
                  : "border-border hover:border-orange-500 cursor-pointer"
              }`}
              onClick={(e) => {
                if (!historicalFetchComplete) {
                  e.preventDefault()
                  toast({
                    title: "Please wait",
                    description: "Historical data is still loading...",
                    variant: "destructive",
                  })
                } else if (!hasArmoryScope) {
                  e.preventDefault()
                  toast({
                    title: "Feature Unavailable",
                    description: "Your API key does not have 'armorynews' scope. Please regenerate your key.",
                    variant: "destructive",
                  })
                }
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`p-2 rounded-lg border ${
                    hasArmoryScope ? "bg-orange-500/20 border-orange-500/40" : "bg-gray-500/20 border-gray-500/40"
                  }`}
                >
                  <Package size={20} className={hasArmoryScope ? "text-orange-500" : "text-gray-500"} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2
                    className={`text-lg font-bold transition-colors ${
                      hasArmoryScope ? "text-foreground group-hover:text-orange-500" : "text-muted-foreground"
                    }`}
                  >
                    Armory
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {hasArmoryScope ? "View armory logs" : "Scope not available"}
                  </p>
                </div>
              </div>
              <div className={`text-3xl font-bold mb-1 ${hasArmoryScope ? "text-orange-500" : "text-gray-500"}`}>
                <Package size={32} />
              </div>
              <p className="text-xs text-muted-foreground">Historical armory activity</p>
            </Link>

            <Link
              href="/dashboard/funds"
              className={`bg-card border rounded-lg p-4 transition-all text-left group block ${
                !historicalFetchComplete || !hasFundsScope
                  ? "pointer-events-none opacity-40 border-border/50"
                  : "border-border hover:border-yellow-500 cursor-pointer"
              }`}
              onClick={(e) => {
                if (!historicalFetchComplete) {
                  e.preventDefault()
                  toast({
                    title: "Please wait",
                    description: "Historical data is still loading...",
                    variant: "destructive",
                  })
                } else if (!hasFundsScope) {
                  e.preventDefault()
                  toast({
                    title: "Feature Unavailable",
                    description: "Your API key does not have 'fundsnews' scope. Please regenerate your key.",
                    variant: "destructive",
                  })
                }
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`p-2 rounded-lg border ${
                    hasFundsScope ? "bg-yellow-500/20 border-yellow-500/40" : "bg-gray-500/20 border-gray-500/40"
                  }`}
                >
                  <DollarSign size={20} className={hasFundsScope ? "text-yellow-500" : "text-gray-500"} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2
                    className={`text-lg font-bold transition-colors ${
                      hasFundsScope ? "text-foreground group-hover:text-yellow-500" : "text-muted-foreground"
                    }`}
                  >
                    Funds
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {hasFundsScope ? "Fund transfer logs" : "Scope not available"}
                  </p>
                </div>
              </div>
              <div className={`text-3xl font-bold mb-1 ${hasFundsScope ? "text-yellow-500" : "text-gray-500"}`}>
                <DollarSign size={32} />
              </div>
              <p className="text-xs text-muted-foreground">Historical fund transfers</p>
            </Link>

            <Link
              href="/dashboard/reports"
              className={`bg-card border border-border rounded-lg p-4 hover:border-cyan-500 transition-all text-left group block ${
                !historicalFetchComplete ? "pointer-events-none opacity-50" : "cursor-pointer"
              }`}
              onClick={(e) => {
                if (!historicalFetchComplete) {
                  e.preventDefault()
                  toast({
                    title: "Please wait",
                    description: "Historical data is still loading...",
                    variant: "destructive",
                  })
                }
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-cyan-500/20 p-2 rounded-lg border border-cyan-500/40">
                  <FileText size={20} className="text-cyan-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-foreground group-hover:text-cyan-500 transition-colors">
                    Reports
                  </h2>
                  <p className="text-xs text-muted-foreground">Detailed crime reports</p>
                </div>
              </div>
              <div className="text-3xl font-bold text-cyan-500 mb-1">
                <FileText size={32} />
              </div>
              <p className="text-xs text-muted-foreground">Historical data</p>
            </Link>
          </div>

          {allCrimes.length > 0 && <CrimeSuccessCharts crimes={allCrimes} />}
        </div>
      </main>

      <footer className="flex-shrink-0 border-t border-border bg-card px-6 py-4 z-50">
        <div className="text-center text-sm">
          <a
            href="https://www.torn.com/profiles.php?XID=1712955"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-white/80 transition-colors"
          >
            © oxiblurr [1712955]
          </a>
          <span className="mx-2 text-muted-foreground">•</span>
          <Link href="/dashboard/credits" className="text-white hover:text-white/80 transition-colors">
            Credits
          </Link>
        </div>
      </footer>
    </div>
  )
}
