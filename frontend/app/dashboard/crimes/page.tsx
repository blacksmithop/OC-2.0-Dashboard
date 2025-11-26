"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { LogOut, MoreVertical, ArrowLeft, Info, RotateCcw, BarChart3 } from "lucide-react"
import CrimesList from "@/components/crimes/crimes-list"
import CrimeSummary from "@/components/crimes/crime-summary"
import { fetchAndCacheItems } from "@/lib/cache/items-cache"
import type { TornItem } from "@/lib/cache/items-cache"
import { fetchAndCacheMembers } from "@/lib/cache/members-cache"
import { handleApiError, validateApiResponse } from "@/lib/api-error-handler"
import { ResetConfirmationDialog } from "@/components/reset-confirmation-dialog"
import { clearAllCache } from "@/lib/cache/cache-reset"
import { handleFullLogout } from "@/lib/logout-handler"
import { fetchAndCacheFactionBasic } from "@/lib/cache/faction-basic-cache"
import type { Crime, Member } from "@/types/crime"
import { filterCrimesByDateRange } from "@/lib/crimes/filters"
import { getCPRTrackerData, type CPRTrackerData } from "@/lib/integration/cpr-tracker"
import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"

export default function CrimesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [members, setMembers] = useState<Member[]>([])
  const [crimes, setCrimes] = useState<Crime[]>([])
  const [items, setItems] = useState<Map<number, TornItem>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [filteredMemberId, setFilteredMemberId] = useState<number | null>(null)
  const [factionId, setFactionId] = useState<number | null>(null)
  const [minPassRate, setMinPassRate] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("minPassRate")
      return saved ? Number.parseInt(saved) : 65
    }
    return 65
  })
  const [dateFilter, setDateFilter] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("crimesDateFilter")
      return saved ? Number.parseInt(saved) : 0
    }
    return 0
  })
  const [historicalCrimes, setHistoricalCrimes] = useState<Crime[]>([])
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const historicalCrimesLengthRef = useRef(0)
  const [cprTrackerData, setCprTrackerData] = useState<CPRTrackerData | null>(null)
  const [cprTrackerEnabled, setCprTrackerEnabled] = useState(false)
  const [memberMap, setMemberMap] = useState<Map<number, Member>>(new Map())

  useEffect(() => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (!apiKey) {
      router.push("/")
      return
    }

    console.log("[v0] Initial data fetch triggered")
    loadFromStoredData(apiKey)

    loadHistoricalCrimes()

    loadCPRTrackerData(apiKey)

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "factionHistoricalCrimes") {
        console.log("[v0] Historical crimes updated from another tab/component")
        loadHistoricalCrimes()
      }
      if (e.key === "thirdPartySettings" || e.key === "CPR_TRACKER_API_KEY") {
        loadCPRTrackerData(apiKey)
      }
    }

    window.addEventListener("storage", handleStorageChange)

    const pollInterval = setInterval(() => {
      const cached = localStorage.getItem("factionHistoricalCrimes")
      if (cached) {
        try {
          const data = JSON.parse(cached)
          if (data.length !== historicalCrimesLengthRef.current) {
            console.log("[v0] Historical crimes count changed, reloading")
            historicalCrimesLengthRef.current = data.length
            loadHistoricalCrimes()
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }, 3000)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(pollInterval)
    }
  }, [router])

  useEffect(() => {
    const memberParam = searchParams.get("member")
    console.log("[v0] Member param changed:", memberParam)
    if (memberParam) {
      const memberId = Number.parseInt(memberParam)
      setFilteredMemberId(memberId)
      setSelectedMemberId(memberId)
    } else {
      setFilteredMemberId(null)
      setSelectedMemberId(null)
    }
  }, [searchParams])

  useEffect(() => {
    if (factionId) {
      const apiKey = localStorage.getItem("factionApiKey")
      if (apiKey) {
        loadCPRTrackerData(apiKey)
      }
    }
  }, [factionId])

  const loadFromStoredData = (apiKey: string) => {
    console.log("[v0] Loading from stored data")
    setIsLoading(true)

    try {
      const cachedFaction = localStorage.getItem("factionBasic")
      if (cachedFaction) {
        try {
          const factionData = JSON.parse(cachedFaction)
          setFactionId(factionData.basic?.id || null)
          console.log(`[v0] Loaded faction ID: ${factionData.basic?.id}`)
        } catch (e) {
          console.error("[v0] Failed to parse cached faction:", e)
        }
      }

      // Load items from cache
      const cachedItems = localStorage.getItem("tornItems")
      if (cachedItems) {
        try {
          const itemsData = JSON.parse(cachedItems)
          const itemsMap = new Map<number, TornItem>()
          Object.entries(itemsData).forEach(([id, item]) => {
            itemsMap.set(Number.parseInt(id), item as TornItem)
          })
          setItems(itemsMap)
          console.log(`[v0] Loaded ${itemsMap.size} items from cache`)
        } catch (e) {
          console.error("[v0] Failed to parse cached items:", e)
        }
      }

      fetchAndCacheMembers(apiKey)
        .then((membersData) => {
          setMembers(Array.from(membersData.values()))
          const memberMap = new Map<number, Member>()
          membersData.forEach((member) => {
            memberMap.set(member.id, member)
          })
          setMemberMap(memberMap)
          console.log(`[v0] Loaded ${membersData.size} members from cache`)
        })
        .catch((e) => {
          console.error("[v0] Failed to load members:", e)
        })

      // Load historical crimes
      const cached = localStorage.getItem("factionHistoricalCrimes")
      let loadedHistoricalCrimes: Crime[] = []
      if (cached) {
        try {
          loadedHistoricalCrimes = JSON.parse(cached)
          console.log(`[v0] Loaded ${loadedHistoricalCrimes.length} historical crimes from localStorage`)
        } catch (e) {
          console.error("[v0] Failed to parse historical crimes:", e)
        }
      }

      // If we have stored data, use it immediately
      if (loadedHistoricalCrimes.length > 0) {
        setCrimes(loadedHistoricalCrimes)
        console.log(`[v0] Using ${loadedHistoricalCrimes.length} stored crimes`)
        setIsLoading(false)

        toast({
          title: "Success",
          description: `Loaded ${loadedHistoricalCrimes.length} crimes from storage`,
        })

        // Then fetch fresh data in the background
        setTimeout(() => {
          console.log("[v0] Background refresh started")
          fetchData(apiKey, true)
        }, 1000)
      } else {
        // No stored data, fetch from API
        console.log("[v0] No stored data, fetching from API")
        fetchData(apiKey, false)
      }
    } catch (err) {
      console.error("[v0] Error loading from stored data:", err)
      // Fallback to API fetch
      fetchData(apiKey, false)
    }
  }

  const fetchData = async (apiKey: string, isBackgroundRefresh = false) => {
    console.log("[v0] fetchData called, isBackgroundRefresh:", isBackgroundRefresh)

    if (!isBackgroundRefresh) {
      setIsLoading(true)
    }

    try {
      const factionBasic = await fetchAndCacheFactionBasic(apiKey)
      setFactionId(factionBasic.id)
      console.log(`[v0] Fetched faction ID: ${factionBasic.id}`)

      const itemsData = await fetchAndCacheItems(apiKey)
      setItems(itemsData)

      const membersData = await fetchAndCacheMembers(apiKey)
      setMembers(Array.from(membersData.values()))
      const memberMap = new Map<number, Member>()
      membersData.forEach((member) => {
        memberMap.set(member.id, member)
      })
      setMemberMap(memberMap)

      const crimesRes = await fetch(
        "https://api.torn.com/v2/faction/crimes?striptags=true&comment=oc_dashboard_crimes",
        {
          headers: { Authorization: `ApiKey ${apiKey}`, accept: "application/json" },
        },
      )

      if (!crimesRes.ok) {
        await handleApiError(crimesRes, "/faction/crimes")
      }

      const crimesData = await crimesRes.json()
      validateApiResponse(crimesData, "/faction/crimes")

      const currentCrimes = Object.values(crimesData.crimes || {})

      const cached = localStorage.getItem("factionHistoricalCrimes")
      let loadedHistoricalCrimes: Crime[] = []
      if (cached) {
        try {
          loadedHistoricalCrimes = JSON.parse(cached)
          console.log(`[v0] fetchData: Loaded ${loadedHistoricalCrimes.length} historical crimes from localStorage`)
        } catch (e) {
          console.error("[v0] fetchData: Failed to parse historical crimes:", e)
        }
      }

      const crimeMap = new Map<number, Crime>()

      loadedHistoricalCrimes.forEach((crime) => {
        crimeMap.set(crime.id, crime)
      })
      console.log(`[v0] fetchData: Added ${loadedHistoricalCrimes.length} historical crimes to map`)

      currentCrimes.forEach((crime) => {
        crimeMap.set(crime.id, crime)
      })
      console.log(`[v0] fetchData: Added ${currentCrimes.length} current crimes to map`)

      const allCrimes = Array.from(crimeMap.values())
      console.log(`[v0] fetchData: Final crime count = ${allCrimes.length}`)
      setCrimes(allCrimes)

      if (!refreshing && !isBackgroundRefresh) {
        toast({
          title: "Success",
          description: `Crimes data loaded successfully (${allCrimes.length} total including historical)`,
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load data"
      if (!isBackgroundRefresh) {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } finally {
      if (!isBackgroundRefresh) {
        setIsLoading(false)
      }
    }
  }

  const handleLogout = () => {
    handleFullLogout()
    toast({
      title: "Success",
      description: "Logged out successfully",
    })
    setTimeout(() => router.push("/"), 500)
  }

  const handleRefresh = async () => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (apiKey) {
      console.log("[v0] Manual refresh triggered")
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
    if (!apiKey) return

    setIsLoading(true)

    try {
      clearAllCache()

      setHistoricalCrimes([])
      setCrimes([])
      setItems(new Map())
      setMembers([])
      setMemberMap(new Map())

      await fetchData(apiKey)

      toast({
        title: "Success",
        description: "Cache cleared and data refreshed from API",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to reset data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReloadCrime = async (crimeId: number): Promise<Crime | null> => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (!apiKey) return null

    try {
      console.log("[v0] Reloading crime:", crimeId)
      const response = await fetch(`https://api.torn.com/v2/faction/${crimeId}/crime?comment=oc_dashboard_crime`, {
        headers: { Authorization: `ApiKey ${apiKey}`, accept: "application/json" },
      })

      if (!response.ok) {
        await handleApiError(response, `/faction/${crimeId}/crime`)
        return null
      }

      const data = await response.json()
      validateApiResponse(data, `/faction/${crimeId}/crime`)

      const updatedCrime = data.crime
      setCrimes((prevCrimes) =>
        prevCrimes.map((crime) => (crime.id === crimeId ? { ...crime, ...updatedCrime } : crime)),
      )

      toast({
        title: "Success",
        description: `Crime ${crimeId} reloaded successfully`,
      })
      return updatedCrime
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to reload crime"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      return null
    }
  }

  const loadHistoricalCrimes = () => {
    const cached = localStorage.getItem("factionHistoricalCrimes")
    if (cached) {
      try {
        const data = JSON.parse(cached)
        setHistoricalCrimes(data)
        historicalCrimesLengthRef.current = data.length
        console.log(`[v0] Loaded ${data.length} historical crimes`)
      } catch (e) {
        console.error("[v0] Failed to parse historical crimes:", e)
      }
    }
  }

  const loadCPRTrackerData = async (apiKey: string) => {
    const settings = localStorage.getItem("thirdPartySettings")
    if (!settings) return

    try {
      const parsed = JSON.parse(settings)
      setCprTrackerEnabled(parsed.cprTracker?.enabled || false)

      if (parsed.cprTracker?.enabled && parsed.cprTracker?.apiKey && factionId) {
        console.log("[v0] Loading CPR Tracker data")
        const data = await getCPRTrackerData(parsed.cprTracker.apiKey, factionId)
        setCprTrackerData(data)
        if (data) {
          console.log(`[v0] Loaded CPR data for ${Object.keys(data.members).length} members`)
        }
      }
    } catch (e) {
      console.error("[v0] Failed to load CPR Tracker settings:", e)
    }
  }

  const filteredCrimes = filteredMemberId
    ? crimes.filter((crime) => crime.slots.some((slot) => slot.user?.id === filteredMemberId))
    : crimes

  const dateFilteredCrimes = useMemo(() => {
    return filterCrimesByDateRange(filteredCrimes, dateFilter)
  }, [filteredCrimes, dateFilter])

  const membersNotInOC = useMemo(() => {
    // Filter positions to exclude
    const excludedPositions = ["Recruit"]
    const excludedStates = ["Hospital", "Jail", "Fallen"]

    // Get member IDs from Planning and Recruiting crimes
    const membersInCrimes = new Set<number>()
    crimes
      .filter((crime) => crime.status === "Planning" || crime.status === "Recruiting")
      .forEach((crime) => {
        crime.slots.forEach((slot) => {
          if (slot.user?.id) {
            membersInCrimes.add(slot.user.id)
          }
        })
      })

    // Filter members not in OCs
    return members
      .filter((member) => {
        // Exclude by position
        if (excludedPositions.includes(member.position)) return false

        // Exclude by status
        if (excludedStates.includes(member.status?.state)) return false

        // Primary check: is_in_oc field
        if (member.is_in_oc) return false

        // Additional validation: check if in Planning/Recruiting crimes
        if (membersInCrimes.has(member.id)) return false

        return true
      })
      .sort((a, b) => b.last_action.timestamp - a.last_action.timestamp)
  }, [members, crimes])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading crimes...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden text-foreground p-4">
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
                <h1 className="text-3xl font-bold">Organized Crimes</h1>
              </button>
              <p className="text-muted-foreground mt-1">View and manage faction operations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
                <DropdownMenuContent
                  align="end"
                  className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden"
                >
                  <DropdownMenuItem onClick={() => router.push("/dashboard/scope-usage")}>
                    <BarChart3 size={18} />
                    Scope Usage
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/dashboard/faction")}>
                    <Info size={18} />
                    Faction
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setDropdownOpen(false)
                      setResetDialogOpen(true)
                    }}
                    disabled={refreshing}
                  >
                    <RotateCcw size={18} />
                    Reset
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      handleLogout()
                      setDropdownOpen(false)
                    }}
                    className="hover:text-destructive"
                  >
                    <LogOut size={18} />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          <CrimeSummary
            crimes={dateFilteredCrimes}
            items={items}
            minPassRate={minPassRate}
            onMinPassRateChange={setMinPassRate}
            membersNotInOC={membersNotInOC}
            allCrimes={crimes}
            memberMap={memberMap}
          />
          <CrimesList
            crimes={dateFilteredCrimes}
            members={members}
            items={items}
            onCrimeReload={handleReloadCrime}
            minPassRate={minPassRate}
            factionId={factionId}
            cprTrackerData={cprTrackerData}
            cprTrackerEnabled={cprTrackerEnabled}
          />
        </div>
      </main>

      <ResetConfirmationDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen} onConfirm={handleReset} />
    </div>
  )
}
