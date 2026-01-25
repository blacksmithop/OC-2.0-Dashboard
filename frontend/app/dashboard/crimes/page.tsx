"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { LogOut, MoreVertical, ArrowLeft, Info, RotateCcw, BarChart3, Search, X } from "lucide-react"
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
import { getCPRTrackerData, type CPRTrackerData } from "@/lib/integration/cpr-tracker"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CrimeDateFilter } from "@/components/crimes/crime-date-filter"
import { getMembersNotInOC } from "@/lib/crimes/members-not-in-oc" // Import the missing function
import { isValid } from "date-fns" // Import isValid function from date-fns
import { Input } from "@/components/ui/input"
import { thirdPartySettingsManager } from "@/lib/settings/third-party-manager"
import { apiKeyManager } from "@/lib/auth/api-key-manager"
import { db, STORES } from "@/lib/db/indexeddb"

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
  const [minPassRate, setMinPassRate] = useState(65)
  const [historicalCrimes, setHistoricalCrimes] = useState<Crime[]>([])
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const historicalCrimesLengthRef = useRef(0)
  const [cprTrackerData, setCprTrackerData] = useState<CPRTrackerData | null>(null)
  const [cprTrackerEnabled, setCprTrackerEnabled] = useState(false)
  const [memberMap, setMemberMap] = useState<Map<number, Member>>(new Map())
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null)
  const [savedDateRange, setSavedDateRange] = useState<{ start: number; end: number } | null>(null)
  const [membersNotInOC, setMembersNotInOC] = useState<Member[]>([])
  const [usernameFilter, setUsernameFilter] = useState("")
  const [minDate, setMinDate] = useState<Date | null>(null)
  const [maxDate, setMaxDate] = useState<Date | null>(null)

  // Load saved date range from IndexedDB
  useEffect(() => {
    const loadSavedDateRange = async () => {
      const saved = await db.get<{ start: number; end: number }>(STORES.SETTINGS, "crimesDateRange")
      if (saved) {
        setSavedDateRange(saved)
        setCustomDateRange({
          start: new Date(saved.start),
          end: new Date(saved.end),
        })
      }
    }
    loadSavedDateRange()
  }, [])

  const handleDateRangeChange = async (start: Date, end: Date) => {
    setCustomDateRange({ start, end })
    // Save to IndexedDB
    const rangeToSave = { start: start.getTime(), end: end.getTime() }
    setSavedDateRange(rangeToSave)
    await db.set(STORES.SETTINGS, "crimesDateRange", rangeToSave)
  }

  const handleClearDateFilter = async () => {
    // Clear saved date range
    setSavedDateRange(null)
    await db.delete(STORES.SETTINGS, "crimesDateRange")
    // Reset to full range
    if (minDate && maxDate) {
      const start = new Date(minDate)
      const end = new Date(maxDate)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      setCustomDateRange({ start, end })
    }
  }

  // Check if date filter is active (different from full range)
  const isDateFiltered = useMemo(() => {
    if (!savedDateRange || !minDate || !maxDate) return false
    const fullRangeStart = new Date(minDate)
    const fullRangeEnd = new Date(maxDate)
    fullRangeStart.setHours(0, 0, 0, 0)
    fullRangeEnd.setHours(23, 59, 59, 999)
    
    const savedStart = new Date(savedDateRange.start)
    const savedEnd = new Date(savedDateRange.end)
    
    // Check if saved range is different from full range (with 1 day tolerance)
    const startDiff = Math.abs(savedStart.getTime() - fullRangeStart.getTime())
    const endDiff = Math.abs(savedEnd.getTime() - fullRangeEnd.getTime())
    const ONE_DAY = 24 * 60 * 60 * 1000
    
    return startDiff > ONE_DAY || endDiff > ONE_DAY
  }, [savedDateRange, minDate, maxDate])

  // Load minPassRate from IndexedDB on mount
  useEffect(() => {
    const loadMinPassRate = async () => {
      const saved = await db.get<number>(STORES.SETTINGS, "minPassRate")
      if (saved !== null) {
        setMinPassRate(saved)
      }
    }
    loadMinPassRate()
  }, [])

  // Save minPassRate to IndexedDB when it changes
  const handleMinPassRateChange = async (value: number) => {
    setMinPassRate(value)
    await db.set(STORES.SETTINGS, "minPassRate", value)
  }

  useEffect(() => {
    const initializePage = async () => {
      const apiKey = await apiKeyManager.getApiKey()
      if (!apiKey) {
        router.push("/")
        return
      }

      loadFromStoredData(apiKey)

      loadHistoricalCrimes()

      loadCPRTrackerData(apiKey)
    }

    initializePage()

    const pollInterval = setInterval(async () => {
      const cached = await db.get<Crime[]>(STORES.CACHE, "factionHistoricalCrimes")
      if (cached && cached.length !== historicalCrimesLengthRef.current) {
        console.log("[v0] Historical crimes count changed, reloading")
        historicalCrimesLengthRef.current = cached.length
        loadHistoricalCrimes()
      }
    }, 3000)

    return () => {
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
    const loadTornStatsData = async () => {
      const apiKey = await apiKeyManager.getApiKey()
      if (apiKey) {
        loadCPRTrackerData(apiKey)
      }
    }
    loadTornStatsData()
  }, [])

  const loadFromStoredData = async (apiKey: string) => {
    console.log("[v0] Loading from stored data")
    setIsLoading(true)

    try {
      const cachedFaction = await db.get(STORES.CACHE, "factionBasic")
      if (cachedFaction) {
        setFactionId(cachedFaction.basic?.id || null)
        console.log(`[v0] Loaded faction ID: ${cachedFaction.basic?.id}`)
      }

      const cachedItems = await db.get(STORES.CACHE, "tornItems")
      if (cachedItems) {
        const itemsMap = new Map<number, TornItem>()
        Object.entries(cachedItems).forEach(([id, item]) => {
          itemsMap.set(Number.parseInt(id), item as TornItem)
        })
        setItems(itemsMap)
        console.log(`[v0] Loaded ${itemsMap.size} items from cache`)
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

      const cached = await db.get<Crime[]>(STORES.CACHE, "factionHistoricalCrimes")
      let loadedHistoricalCrimes: Crime[] = []
      if (cached) {
        loadedHistoricalCrimes = cached
        console.log(`[v0] Loaded ${loadedHistoricalCrimes.length} historical crimes from IndexedDB`)
      }

      if (loadedHistoricalCrimes.length > 0) {
        setCrimes(loadedHistoricalCrimes)
        console.log(`[v0] Using ${loadedHistoricalCrimes.length} stored crimes`)
        setIsLoading(false)

        toast({
          title: "Success",
          description: `Loaded ${loadedHistoricalCrimes.length} crimes from storage`,
        })

        setTimeout(() => {
          console.log("[v0] Background refresh started")
          fetchData(apiKey, true)
        }, 1000)
      } else {
        console.log("[v0] No stored data, fetching from API")
        fetchData(apiKey, false)
      }
    } catch (err) {
      console.error("[v0] Error loading from stored data:", err)
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

      const cached = await db.get<Crime[]>(STORES.CACHE, "factionHistoricalCrimes")
      let loadedHistoricalCrimes: Crime[] = []
      if (cached) {
        loadedHistoricalCrimes = cached
        console.log(`[v0] fetchData: Loaded ${loadedHistoricalCrimes.length} historical crimes from IndexedDB`)
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

      const membersNotInOCData = getMembersNotInOC(members, allCrimes)
      setMembersNotInOC(membersNotInOCData)

      const timestamps = allCrimes.map((crime) => crime.created_at * 1000)
      const calculatedMinDate = new Date(Math.min(...timestamps))
      const calculatedMaxDate = new Date(Math.max(...timestamps))

      setMinDate(calculatedMinDate)
      setMaxDate(calculatedMaxDate)

      console.log("[v0] Date range calculated from crimes:", {
        crimesCount: allCrimes.length,
        minTimestamp: Math.min(...timestamps),
        maxTimestamp: Math.max(...timestamps),
        minDate: calculatedMinDate.toISOString(),
        maxDate: calculatedMaxDate.toISOString(),
        latestCrimeId: allCrimes.find((c) => c.created_at * 1000 === Math.max(...timestamps))?.id,
      })

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
    const apiKey = await apiKeyManager.getApiKey()
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
    const apiKey = await apiKeyManager.getApiKey()
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
    const apiKey = await apiKeyManager.getApiKey()
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

  const loadHistoricalCrimes = async () => {
    const cached = await db.get<Crime[]>(STORES.CACHE, "factionHistoricalCrimes")
    if (cached) {
      setHistoricalCrimes(cached)
      historicalCrimesLengthRef.current = cached.length
      console.log(`[v0] Loaded ${cached.length} historical crimes`)
    }
  }

  const loadCPRTrackerData = async (_apiKey: string) => {
    const settings = await thirdPartySettingsManager.getSettings()

    setCprTrackerEnabled(settings.tornStats?.enabled || false)

    if (settings.tornStats?.enabled && settings.tornStats?.apiKey) {
      console.log("[v0] Loading TornStats CPR data")
      const data = await getCPRTrackerData(settings.tornStats.apiKey)
      setCprTrackerData(data)
      if (data) {
        console.log(`[v0] Loaded CPR data for ${Object.keys(data.members).length} members`)
      }
    }
  }

  const filteredCrimes = useMemo(() => {
    let filtered = filteredMemberId
      ? crimes.filter((crime) => crime.slots.some((slot) => slot.user?.id === filteredMemberId))
      : crimes

    if (usernameFilter.trim()) {
      const searchLower = usernameFilter.toLowerCase()
      filtered = filtered.filter((crime) =>
        crime.slots.some((slot) => {
          if (!slot.user?.id) return false
          const member = members.find((m) => m.id === slot.user.id)
          return member?.name.toLowerCase().includes(searchLower)
        }),
      )
    }

    return filtered
  }, [crimes, filteredMemberId, usernameFilter, members])

  const initialStartDate = useMemo(() => {
    if (customDateRange?.start && isValid(customDateRange.start)) {
      return customDateRange.start
    }
    return minDate
  }, [customDateRange, minDate])

  const initialEndDate = useMemo(() => {
    if (customDateRange?.end && isValid(customDateRange.end)) {
      return customDateRange.end
    }
    return maxDate
  }, [customDateRange, maxDate])

  const dateFilteredCrimes = useMemo(() => {
    if (!customDateRange?.start || !customDateRange?.end) {
      return filteredCrimes
    }

    console.log("[v0] Filtering crimes with date range:", {
      start: customDateRange.start,
      end: customDateRange.end,
      totalCrimes: filteredCrimes.length,
    })

    return filteredCrimes.filter((crime) => {
      const crimeDate = new Date(crime.created_at * 1000)
      const isInRange = crimeDate >= customDateRange.start && crimeDate <= customDateRange.end

      return isInRange
    })
  }, [filteredCrimes, customDateRange])

  useEffect(() => {
    // Only set default date range if no saved range exists
    if (crimes.length > 0 && !savedDateRange) {
      const start = new Date(minDate)
      const end = new Date(maxDate)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      setCustomDateRange({ start, end })
    }
  }, [crimes.length, minDate, maxDate, savedDateRange])

  const handleClearMemberFilter = () => {
    setFilteredMemberId(null)
    setSelectedMemberId(null)
    router.push("/dashboard/crimes")
    toast({
      title: "Filter Cleared",
      description: "Member filter has been removed",
    })
  }

  const filteredMember = filteredMemberId ? members.find((m) => m.id === filteredMemberId) : null

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
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button className="p-2 hover:bg-accent rounded-lg transition-colors border border-border" title="Menu">
                  <MoreVertical size={20} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
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
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filter by username..."
              value={usernameFilter}
              onChange={(e) => setUsernameFilter(e.target.value)}
              className="pl-10 pr-9 h-10 bg-background border-2 border-border focus:border-primary text-foreground placeholder:text-muted-foreground"
            />
            {usernameFilter && (
              <button
                onClick={() => setUsernameFilter("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {filteredMember && (
            <button
              onClick={handleClearMemberFilter}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors flex items-center gap-2 whitespace-nowrap font-bold"
              title="Clear member filter"
            >
              <X size={16} />
              Clear Filter: {filteredMember.name}
            </button>
          )}
        </div>
      </header>

      <ResetConfirmationDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen} onConfirm={handleReset} />

      <main className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-7xl mx-auto space-y-4">
          <CrimeDateFilter
            minDate={minDate}
            maxDate={maxDate}
            startDate={initialStartDate}
            endDate={initialEndDate}
            onDateRangeChange={handleDateRangeChange}
            onClear={handleClearDateFilter}
            isFiltered={isDateFiltered}
          />

          <CrimeSummary
            crimes={dateFilteredCrimes}
            items={items}
            minPassRate={minPassRate}
            onMinPassRateChange={handleMinPassRateChange}
            membersNotInOC={membersNotInOC}
            showItemsNeeded={true}
          />

          <CrimesList
            crimes={dateFilteredCrimes}
            members={members}
            items={items}
            onReloadCrime={handleReloadCrime}
            minPassRate={minPassRate}
            factionId={factionId}
            cprTrackerData={cprTrackerData}
            cprTrackerEnabled={cprTrackerEnabled}
            membersNotInOC={membersNotInOC}
            onMemberNameClick={
              filteredMemberId
                ? undefined
                : (memberId) => {
                    setFilteredMemberId(memberId)
                    setSelectedMemberId(memberId)
                  }
            }
            selectedMemberId={selectedMemberId}
          />
        </div>
      </main>
    </div>
  )
}
