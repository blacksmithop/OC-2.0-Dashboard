"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { RefreshCw, LogOut, MoreVertical, Info, Play, Loader2, ChevronDown, ArrowLeft, ArrowUpDown } from "lucide-react"
import { fetchAndCacheItems } from "@/lib/cache/items-cache"
import type { TornItem } from "@/lib/cache/items-cache"
import { VictoryPie } from "victory"
import ItemModal from "@/components/crimes/item-modal"
import { crimeApiCache } from "@/lib/cache/crime-api-cache"
import { handleFullLogout } from "@/lib/logout-handler"
import type { Crime } from "@/types/crime"
import { filterCrimesByDateRange } from "@/lib/crimes/filters"
import { formatCurrency } from "@/lib/crimes/formatters"
import { getDifficultyColor } from "@/lib/crimes/colors"
import { CRIME_METADATA } from "@/lib/crimes/metadata"
import CrimeSuccessCharts from "@/components/crimes/crime-success-charts"

export default function ReportsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [totalCrimes, setTotalCrimes] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [crimes, setCrimes] = useState<Crime[]>([])
  const [items, setItems] = useState<Map<number, TornItem>>(new Map())
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [expandedCrimes, setExpandedCrimes] = useState<Set<string>>(new Set())
  const [historicalCrimes, setHistoricalCrimes] = useState<Crime[]>([])
  const [currentCrimes, setCurrentCrimes] = useState<Crime[]>([])
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("All")
  const [sortBy, setSortBy] = useState<string>("Total")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [dateFilter, setDateFilter] = useState<number>(0)
  const [searchFilter, setSearchFilter] = useState<string>("")

  const WEEK_IN_SECONDS = 7 * 24 * 60 * 60
  const REQUEST_DELAY = 2000

  const allCrimes = useMemo(() => {
    const crimeMap = new Map<number, Crime>()

    historicalCrimes.forEach((crime) => {
      crimeMap.set(crime.id, crime)
    })

    currentCrimes.forEach((crime) => {
      crimeMap.set(crime.id, crime)
    })

    const allCrimesArray = Array.from(crimeMap.values())
    return filterCrimesByDateRange(allCrimesArray, dateFilter)
  }, [historicalCrimes, currentCrimes, dateFilter])

  useEffect(() => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (!apiKey) {
      router.push("/")
      return
    }

    const loadData = async () => {
      try {
        const crimesRes = await fetch(
          "https://api.torn.com/v2/faction/crimes?striptags=true&comment=oc_dashboard_crimes",
          {
            headers: { Authorization: `ApiKey ${apiKey}`, accept: "application/json" },
          },
        )

        if (crimesRes.ok) {
          const crimesData = await crimesRes.json()
          if (crimesData.crimes) {
            setCurrentCrimes(Object.values(crimesData.crimes))
          }
        }
      } catch (e) {
        console.error("Failed to fetch current crimes:", e)
      }

      const cached = localStorage.getItem("factionHistoricalCrimes")
      if (cached) {
        try {
          const data = JSON.parse(cached)
          setHistoricalCrimes(data)
          console.log(`[v0] Loaded ${data.length} historical crimes from cache`)
        } catch (e) {
          console.error("Failed to parse cached crimes:", e)
        }
      }
    }

    loadData()

    fetchAndCacheItems(apiKey).then((itemsData) => {
      setItems(itemsData)
    })

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "factionHistoricalCrimes") {
        const cached = localStorage.getItem("factionHistoricalCrimes")
        if (cached) {
          try {
            const data = JSON.parse(cached)
            setHistoricalCrimes(data)
          } catch (e) {
            console.error("Failed to parse updated historical crimes:", e)
          }
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)

    const pollInterval = setInterval(() => {
      const cached = localStorage.getItem("factionHistoricalCrimes")
      if (cached) {
        try {
          const data = JSON.parse(cached)
          if (data.length !== historicalCrimes.length) {
            setHistoricalCrimes(data)
          }
        } catch (e) {
          // Ignore
        }
      }
    }, 3000)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(pollInterval)
    }
  }, [router])

  useEffect(() => {
    setCrimes(allCrimes)
    setTotalCrimes(allCrimes.length)
  }, [allCrimes])

  const summary = useMemo(() => {
    let totalMoney = 0
    let totalRespect = 0
    let totalItemValue = 0
    let totalCost = 0
    const statusCounts = {
      Planning: 0,
      Recruiting: 0,
      Successful: 0,
      Failed: 0,
      Expired: 0,
    }
    const itemsGained = new Map<number, { item: any; quantity: number; totalValue: number }>()

    crimes.forEach((crime) => {
      const status = crime.status === "Failure" ? "Failed" : crime.status
      if (status in statusCounts) {
        statusCounts[status as keyof typeof statusCounts]++
      }

      if (crime.status === "Successful" && crime.rewards) {
        totalMoney += crime.rewards.money || 0
        totalRespect += crime.rewards.respect || 0

        if (crime.rewards.items && crime.rewards.items.length > 0) {
          crime.rewards.items.forEach((item) => {
            const itemData = items.get(item.id)
            if (itemData && itemData.value?.market_price) {
              const itemValue = itemData.value.market_price * item.quantity
              totalItemValue += itemValue

              if (itemsGained.has(item.id)) {
                const existing = itemsGained.get(item.id)!
                existing.quantity += item.quantity
                existing.totalValue += itemValue
              } else {
                itemsGained.set(item.id, {
                  item: itemData,
                  quantity: item.quantity,
                  totalValue: itemValue,
                })
              }
            }
          })
        }
      }

      if (crime.status === "Planning" && crime.cost) {
        totalCost += crime.cost
      }
    })

    const totalValue = totalMoney + totalItemValue

    return {
      totalValue,
      totalMoney,
      totalItemValue,
      totalRespect,
      totalCost,
      statusCounts,
      itemsGained: Array.from(itemsGained.values()),
    }
  }, [crimes, items])

  const crimeStats = useMemo(() => {
    const stats = new Map<
      string,
      {
        successful: number
        failed: number
        planning: number
        recruiting: number
        expired: number
        difficulty: number
      }
    >()

    crimes.forEach((crime) => {
      const existing = stats.get(crime.name) || {
        successful: 0,
        failed: 0,
        planning: 0,
        recruiting: 0,
        expired: 0,
        difficulty: crime.difficulty || 0,
      }

      if (crime.status === "Successful") {
        existing.successful++
      } else if (crime.status === "Failure" || crime.status === "Failed") {
        existing.failed++
      } else if (crime.status === "Planning") {
        existing.planning++
      } else if (crime.status === "Recruiting") {
        existing.recruiting++
      } else if (crime.status === "Expired") {
        existing.expired++
      }

      stats.set(crime.name, existing)
    })

    let filteredStats = Array.from(stats.entries()).map(([name, data]) => ({
      name,
      successful: data.successful,
      failed: data.failed,
      planning: data.planning,
      recruiting: data.recruiting,
      expired: data.expired,
      difficulty: data.difficulty,
      total: data.successful + data.failed + data.planning + data.recruiting + data.expired,
      successRate:
        data.successful + data.failed > 0
          ? ((data.successful / (data.successful + data.failed)) * 100).toFixed(1)
          : "N/A",
    }))

    if (searchFilter.trim() !== "") {
      filteredStats = filteredStats.filter((crime) =>
        crime.name.toLowerCase().includes(searchFilter.toLowerCase().trim()),
      )
    }

    if (difficultyFilter !== "All") {
      filteredStats = filteredStats.filter((crime) => {
        const diff = crime.difficulty
        if (difficultyFilter === "Easy (1-2)") return diff >= 1 && diff <= 2
        if (difficultyFilter === "Medium (3-5)") return diff >= 3 && diff <= 5
        if (difficultyFilter === "Hard (6-8)") return diff >= 6 && diff <= 8
        if (difficultyFilter === "Expert (9-10)") return diff >= 9 && diff <= 10
        return true
      })
    }

    if (sortBy === "Total") {
      filteredStats.sort((a, b) => (sortDirection === "desc" ? b.total - a.total : a.total - b.total))
    } else if (sortBy === "Difficulty") {
      filteredStats.sort((a, b) =>
        sortDirection === "desc" ? b.difficulty - a.difficulty : a.difficulty - b.difficulty,
      )
    } else if (sortBy === "Success Rate") {
      filteredStats.sort((a, b) => {
        const rateA = a.successRate === "N/A" ? -1 : Number.parseFloat(a.successRate)
        const rateB = b.successRate === "N/A" ? -1 : Number.parseFloat(b.successRate)
        return sortDirection === "desc" ? rateB - rateA : rateA - rateB
      })
    } else if (sortBy === "Name") {
      filteredStats.sort((a, b) =>
        sortDirection === "desc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name),
      )
    }

    return filteredStats
  }, [crimes, difficultyFilter, sortBy, sortDirection, searchFilter])

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const fetchCompletedCrimes = async () => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (!apiKey) return

    setIsLoading(true)
    setIsPaused(false)
    setCurrentWeek(0)

    try {
      const allCrimes: Crime[] = []
      let hasMoreData = true
      let weekCount = 0
      let oldestTimestamp: number | null = null
      let lastOldestCrimeId: number | null = null

      console.log("[v0] Fetching latest crimes (fresh, not cached)")
      const firstUrl = `https://api.torn.com/v2/faction/crimes?cat=completed&sort=DESC&striptags=true&comment=oc_dashboard_crimes`
      const firstData: CrimesResponse = await crimeApiCache.fetchWithCache(firstUrl, apiKey, true)

      if (firstData.crimes) {
        const crimesArray = Object.values(firstData.crimes)
        allCrimes.push(...crimesArray)
        setCrimes(allCrimes)
        setTotalCrimes(allCrimes.length)

        if (crimesArray.length > 0) {
          const oldestCrime = crimesArray.reduce((oldest, crime) =>
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

      while (hasMoreData && !isPaused && oldestTimestamp) {
        weekCount++
        setCurrentWeek(weekCount)

        await delay(REQUEST_DELAY)

        const historicalUrl = `https://api.torn.com/v2/faction/crimes?cat=completed&sort=DESC&to=${oldestTimestamp}&striptags=true&comment=oc_dashboard_crimes`
        const data: CrimesResponse = await crimeApiCache.fetchWithCache(historicalUrl, apiKey, false)

        if (data && data.crimes && Object.keys(data.crimes).length > 0) {
          const crimesArray = Object.values(data.crimes)

          const newOldestCrime = crimesArray.reduce((oldest, crime) =>
            crime.executed_at < oldest.executed_at ? crime : oldest,
          )

          if (newOldestCrime.id === lastOldestCrimeId) {
            hasMoreData = false
            break
          }

          allCrimes.push(...crimesArray)
          setCrimes(allCrimes)
          setTotalCrimes(allCrimes.length)

          oldestTimestamp = newOldestCrime.executed_at
          lastOldestCrimeId = newOldestCrime.id
        } else {
          hasMoreData = false
        }

        if (weekCount >= 52) {
          hasMoreData = false
          toast({
            title: "Success",
            description: "Reached 1 year limit. Stopping fetch.",
          })
        }
      }

      if (allCrimes.length > 0) {
        localStorage.setItem("factionHistoricalCrimes", JSON.stringify(allCrimes))
        localStorage.setItem("lastHistoricalFetch", Date.now().toString())
      }

      if (!isPaused) {
        toast({
          title: "Success",
          description: `Successfully fetched ${allCrimes.length} crimes over ${weekCount} weeks`,
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch crimes"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
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

  const formatNumber = (num: number) => new Intl.NumberFormat().format(num)

  const toggleCrime = (crimeName: string) => {
    const newExpanded = new Set(expandedCrimes)
    if (newExpanded.has(crimeName)) {
      newExpanded.delete(crimeName)
    } else {
      newExpanded.add(crimeName)
    }
    setExpandedCrimes(newExpanded)
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />

      <header className="flex-shrink-0 border-b border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="p-2 hover:bg-accent rounded-lg transition-colors border border-border"
              title="Back to Dashboard"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <button onClick={() => router.push("/dashboard")} className="hover:opacity-80 transition-opacity">
                <h1 className="text-3xl font-bold text-foreground">Crime Reports</h1>
              </button>
              <p className="text-sm text-muted-foreground mt-1">Detailed historical crime data</p>
            </div>
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
                      router.push("/dashboard")
                      setDropdownOpen(false)
                    }}
                    className="w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-accent transition-colors border-t border-border"
                  >
                    <RefreshCw size={18} />
                    Dashboard
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

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Fetch Historical Data</h3>
              <button
                onClick={fetchCompletedCrimes}
                disabled={isLoading}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    Start Fetch
                  </>
                )}
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              This will fetch all completed crimes by cycling back in time using the oldest timestamp. The process may
              take several minutes depending on your faction's history. Requests are spaced 2 seconds apart.
            </p>
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                <span>Fetching week {currentWeek}...</span>
              </div>
            )}
          </div>

          {crimes.length > 0 && (
            <>
              <div className="bg-card p-3 rounded-lg border border-border/50">
                <div className="text-xs text-muted-foreground mb-2 font-bold">Status Breakdown</div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Planning:</span>
                    <span className="font-bold text-blue-400">{summary.statusCounts.Planning}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Recruiting:</span>
                    <span className="font-bold text-purple-400">{summary.statusCounts.Recruiting}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Successful:</span>
                    <span className="font-bold text-green-400">{summary.statusCounts.Successful}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Failure:</span>
                    <span className="font-bold text-red-400">{summary.statusCounts.Failed}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Expired:</span>
                    <span className="font-bold text-gray-400">{summary.statusCounts.Expired}</span>
                  </div>
                </div>
              </div>

              <CrimeSuccessCharts crimes={crimes} />

              <div className="bg-card border border-border rounded-lg p-4 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Search Crime</label>
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Search by crime name..."
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Sort By</label>
                    <div className="flex gap-2">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="Total">Total Count</option>
                        <option value="Difficulty">Difficulty</option>
                        <option value="Success Rate">Success Rate</option>
                        <option value="Name">Name</option>
                      </select>
                      <button
                        onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                        className="bg-background border border-border rounded-lg px-3 py-2 hover:bg-accent transition-colors"
                        title={sortDirection === "asc" ? "Ascending" : "Descending"}
                      >
                        <ArrowUpDown size={16} className="text-foreground" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Filter by Difficulty
                    </label>
                    <select
                      value={difficultyFilter}
                      onChange={(e) => setDifficultyFilter(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="All">All Difficulties</option>
                      <option value="Easy (1-2)">Easy (1-2)</option>
                      <option value="Medium (3-5)">Medium (3-5)</option>
                      <option value="Hard (6-8)">Hard (6-8)</option>
                      <option value="Expert (9-10)">Expert (9-10)</option>
                    </select>
                  </div>
                </div>
              </div>

              {crimeStats.map((crime) => {
                const isExpanded = expandedCrimes.has(crime.name)
                const metadata = CRIME_METADATA[crime.name]
                const pieData = []
                const colors = []

                if (crime.successful > 0) {
                  pieData.push({
                    x: "Success",
                    y: crime.successful,
                    label: `Success: ${crime.successful}`,
                  })
                  colors.push("#22c55e")
                }

                if (crime.failed > 0) {
                  pieData.push({
                    x: "Failed",
                    y: crime.failed,
                    label: `Failed: ${crime.failed}`,
                  })
                  colors.push("#ef4444")
                }

                if (crime.planning > 0) {
                  pieData.push({
                    x: "Planning",
                    y: crime.planning,
                    label: `Planning: ${crime.planning}`,
                  })
                  colors.push("#3b82f6")
                }

                if (crime.recruiting > 0) {
                  pieData.push({
                    x: "Recruiting",
                    y: crime.recruiting,
                    label: `Recruiting: ${crime.recruiting}`,
                  })
                  colors.push("#a855f7")
                }

                if (crime.expired > 0) {
                  pieData.push({
                    x: "Expired",
                    y: crime.expired,
                    label: `Expired: ${crime.expired}`,
                  })
                  colors.push("#6b7280")
                }

                const crimeInstances = crimes.filter((c) => c.name === crime.name && c.status === "Successful")
                const totalMoney = crimeInstances.reduce((sum, c) => sum + (c.rewards?.money || 0), 0)
                const avgMoney = crimeInstances.length > 0 ? totalMoney / crimeInstances.length : 0

                return (
                  <div key={crime.name} className="bg-card border border-border/50 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleCrime(crime.name)}
                      className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground">{crime.name}</h4>
                          <span className={`text-sm font-bold ${getDifficultyColor(crime.difficulty)}`}>
                            (Diff: {crime.difficulty})
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          {crime.successful > 0 && (
                            <span className="text-green-400 font-bold">{crime.successful} Success</span>
                          )}
                          {crime.failed > 0 && <span className="text-red-400 font-bold">{crime.failed} Failed</span>}
                          {crime.planning > 0 && (
                            <span className="text-blue-400 font-bold">{crime.planning} Planning</span>
                          )}
                          {crime.recruiting > 0 && (
                            <span className="text-purple-400 font-bold">{crime.recruiting} Recruiting</span>
                          )}
                          {crime.expired > 0 && (
                            <span className="text-gray-400 font-bold">{crime.expired} Expired</span>
                          )}
                          {crime.successRate !== "N/A" && (
                            <span className="text-muted-foreground">({crime.successRate}%)</span>
                          )}
                        </div>
                      </div>
                      <ChevronDown
                        size={20}
                        className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isExpanded && pieData.length > 0 && (
                      <div className="p-6 border-t border-border/50 animate-in fade-in duration-200">
                        {metadata && (
                          <div className="mb-6 space-y-4">
                            <div className="bg-background/50 rounded-lg p-4 border border-border">
                              <h5 className="text-sm font-bold text-primary mb-2">Description</h5>
                              <p className="text-sm text-muted-foreground leading-relaxed">{metadata.description}</p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-background/50 rounded-lg p-3 border border-border">
                                <div className="text-xs text-muted-foreground mb-1">Spawn Level</div>
                                <div className="text-lg font-bold text-cyan-400">
                                  {metadata.spawn.name} (Lvl {metadata.spawn.level})
                                </div>
                              </div>
                              <div className="bg-background/50 rounded-lg p-3 border border-border">
                                <div className="text-xs text-muted-foreground mb-1">Scope Cost</div>
                                <div className="text-lg font-bold text-orange-400">{metadata.scope.cost}</div>
                              </div>
                              <div className="bg-background/50 rounded-lg p-3 border border-border">
                                <div className="text-xs text-muted-foreground mb-1">Scope Return</div>
                                <div className="text-lg font-bold text-green-400">{metadata.scope.return}</div>
                              </div>
                              <div className="bg-background/50 rounded-lg p-3 border border-border">
                                <div className="text-xs text-muted-foreground mb-1">Prerequisite</div>
                                <div className="text-sm font-bold text-yellow-400">
                                  {metadata.prerequisite || "None"}
                                </div>
                              </div>
                            </div>

                            <div className="bg-background/50 rounded-lg p-4 border border-border">
                              <h5 className="text-sm font-bold text-primary mb-3">Required Roles & Items</h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {metadata.slots.map((slot) => (
                                  <div
                                    key={slot.id}
                                    className="flex items-center justify-between p-2 bg-background rounded border border-border/50"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-mono text-muted-foreground">{slot.id}</span>
                                      <span className="text-sm font-medium">{slot.name}</span>
                                    </div>
                                    {slot.required_item && (
                                      <div className="flex items-center gap-1 text-xs">
                                        <span className="text-muted-foreground">{slot.required_item.name}</span>
                                        {slot.required_item.is_used && (
                                          <span className="text-red-400 font-bold">(Used)</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mb-6 grid grid-cols-2 gap-4">
                          <div className="bg-background rounded-lg p-4 border border-border">
                            <div className="text-xs text-muted-foreground mb-1">Total Money</div>
                            <div className="text-xl font-bold text-green-500">{formatCurrency(totalMoney)}</div>
                          </div>
                          <div className="bg-background rounded-lg p-4 border border-border">
                            <div className="text-xs text-muted-foreground mb-1">Average Money</div>
                            <div className="text-xl font-bold text-green-500">
                              {formatCurrency(Math.round(avgMoney))}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <svg width={300} height={300} style={{ overflow: "visible" }}>
                            <VictoryPie
                              standalone={false}
                              width={300}
                              height={300}
                              data={pieData}
                              innerRadius={0}
                              colorScale={colors}
                              style={{
                                labels: { fill: "transparent" },
                                data: {
                                  stroke: "#ffffff",
                                  strokeWidth: 2,
                                },
                              }}
                              animate={{
                                duration: 500,
                              }}
                            />
                          </svg>
                        </div>
                        <div className="flex justify-center gap-4 mt-4 flex-wrap">
                          {pieData.map((entry, index) => (
                            <div key={`legend-${index}`} className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[index] }} />
                              <span className="text-sm font-medium" style={{ color: colors[index] }}>
                                {entry.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
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
        </div>
      </footer>
    </div>
  )
}

interface CrimesResponse {
  crimes: Record<string, Crime>
}
