"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { handleFullLogout } from "@/lib/logout-handler"
import { getScenarioInfo } from "@/lib/crimes/scenarios"
import { crimeApiCache } from "@/lib/cache/crime-api-cache"
import ScopeUsageHeader from "@/components/scope-usage/scope-usage-header"
import ScopeUsageStats from "@/components/scope-usage/scope-usage-stats"
import ScopeUsageSummary from "@/components/scope-usage/scope-usage-summary"
import ScopeUsageTable from "@/components/scope-usage/scope-usage-table"
import ScopeUsageConfigModal from "@/components/scope-usage/scope-usage-config-modal"
import ScopeUsageFilters from "@/components/scope-usage/scope-usage-filters"

interface ScopeUsageEntry {
  user: string
  userId: number
  scenario: string
  scopeUsed: number
  timestamp: number
  crimeId?: string
  level?: number
  length?: number
  people?: number
}

export default function ScopeUsagePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [scopeUsage, setScopeUsage] = useState<ScopeUsageEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [fetchProgress, setFetchProgress] = useState({ current: 0, max: 0 })
  const [maxFetchCount, setMaxFetchCount] = useState(1000)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const [selectedLevels, setSelectedLevels] = useState<number[]>([])
  const [selectedLengths, setSelectedLengths] = useState<number[]>([])
  const [selectedPeople, setSelectedPeople] = useState<number[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: "", to: "" })

  const [userFilter, setUserFilter] = useState("")
  const [scenarioFilter, setScenarioFilter] = useState("")
  const [crimeIdFilter, setCrimeIdFilter] = useState("")

  useEffect(() => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (!apiKey) {
      router.push("/")
      return
    }

    const savedMaxFetch = localStorage.getItem("scopeMaxFetch")
    if (savedMaxFetch) {
      const parsed = Number.parseInt(savedMaxFetch, 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        setMaxFetchCount(parsed)
      }
    }

    loadCachedScopeUsage()
    setIsLoading(false)
  }, [router])

  const fetchCrimeNews = async (
    factionId: string,
    to?: number,
    skipCache = false,
  ): Promise<Record<string, { news: string; timestamp: number }>> => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (!apiKey) throw new Error("No API key found")

    if (!skipCache && to) {
      const cacheKey = `crimenews_to_${to}`
      const cachedData = crimeApiCache.get(cacheKey)
      if (cachedData) {
        console.log(`[v0] Crime news API cache HIT for timestamp: ${to}`)
        return cachedData
      }
    }

    let url = `https://api.torn.com/faction/${factionId}?selections=crimenews&striptags=true&comment=oc_dashboard_crimenews`
    if (to) {
      url += `&to=${to}`
    }

    console.log(`[v0] Fetching crime news from API${to ? ` (to=${to})` : " (fresh)"}`)
    const response = await fetch(url, {
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch crime news")
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.error || "API error")
    }

    const crimenews = data.crimenews || {}

    if (to) {
      const cacheKey = `crimenews_to_${to}`
      crimeApiCache.set(cacheKey, crimenews)
      console.log(`[v0] Cached crime news response for timestamp: ${to}`)
    }

    return crimenews
  }

  const parseScopeUsage = (id: string, timestamp: number, news: string): ScopeUsageEntry | null => {
    const scopeRegex =
      /<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+used\s+(\d+)\s+scope\s+spawning\s+the\s+\w+\s+scenario\s+<span[^>]*>([^<]+)<\/span>/i
    const match = news.match(scopeRegex)

    if (match) {
      const crimeIdMatch = news.match(/crimeId=(\d+)/)
      const scenarioInfo = getScenarioInfo(match[4])

      return {
        userId: Number.parseInt(match[1]),
        user: match[2],
        scopeUsed: Number.parseInt(match[3]),
        scenario: match[4],
        timestamp,
        crimeId: crimeIdMatch ? crimeIdMatch[1] : undefined,
        level: scenarioInfo?.level,
        length: scenarioInfo?.length,
        people: scenarioInfo?.people,
      }
    }
    return null
  }

  const handleFetchHistorical = async () => {
    const apiKey = localStorage.getItem("factionApiKey")
    const factionId = localStorage.getItem("factionId")

    if (!apiKey || !factionId) {
      toast({
        title: "Error",
        description: "Missing authentication credentials",
        variant: "destructive",
      })
      return
    }

    setIsFetching(true)
    setFetchProgress({ current: 0, max: maxFetchCount })
    const allEntries: ScopeUsageEntry[] = []
    const seenIds = new Set<string>()
    let toTimestamp: number | undefined = undefined
    let lastOldestId: string | null = null

    try {
      toast({
        title: "Fetching",
        description: "Starting scope usage fetch...",
      })

      console.log("[v0] Fetching latest crime news (fresh, not cached)")
      const rawNews = await fetchCrimeNews(factionId, undefined, true)

      if (Object.keys(rawNews).length > 0) {
        for (const [id, data] of Object.entries(rawNews)) {
          if (!seenIds.has(id)) {
            seenIds.add(id)
            const parsed = parseScopeUsage(id, data.timestamp, data.news)
            if (parsed) {
              allEntries.push(parsed)
            }
          }
        }

        allEntries.sort((a, b) => b.timestamp - a.timestamp)

        if (allEntries.length > 0) {
          const oldestInBatch = allEntries[allEntries.length - 1]
          lastOldestId = `${oldestInBatch.timestamp}-${oldestInBatch.userId}`
          toTimestamp = oldestInBatch.timestamp
        }

        setFetchProgress({ current: allEntries.length, max: maxFetchCount })
      }

      while (allEntries.length < maxFetchCount && toTimestamp) {
        console.log(`[v0] Fetching crime news with to=${toTimestamp}`)
        const rawNews = await fetchCrimeNews(factionId, toTimestamp, false)

        if (Object.keys(rawNews).length === 0) {
          console.log("[v0] No more crime news to fetch")
          break
        }

        const batch: ScopeUsageEntry[] = []
        for (const [id, data] of Object.entries(rawNews)) {
          if (!seenIds.has(id)) {
            seenIds.add(id)
            const parsed = parseScopeUsage(id, data.timestamp, data.news)
            if (parsed) {
              batch.push(parsed)
            }
          }
        }

        if (batch.length === 0) {
          console.log("[v0] No new unique entries in this batch, stopping")
          break
        }

        batch.sort((a, b) => b.timestamp - a.timestamp)

        const oldestInBatch = batch[batch.length - 1]
        const oldestId = `${oldestInBatch.timestamp}-${oldestInBatch.userId}`
        if (lastOldestId === oldestId) {
          console.log("[v0] Reached end of pagination (same oldest ID)")
          break
        }

        lastOldestId = oldestId
        allEntries.push(...batch)

        setFetchProgress({ current: allEntries.length, max: maxFetchCount })

        toast({
          title: "Fetching",
          description: `Fetched ${allEntries.length}/${maxFetchCount} scope usage entries...`,
        })

        toTimestamp = oldestInBatch.timestamp

        await new Promise((resolve) => setTimeout(resolve, 2000))

        if (allEntries.length >= maxFetchCount) {
          console.log("[v0] Reached max fetch count")
          break
        }
      }

      const finalEntries = allEntries.slice(0, maxFetchCount)
      finalEntries.sort((a, b) => b.timestamp - a.timestamp)

      setScopeUsage(finalEntries)
      localStorage.setItem("scopeUsage", JSON.stringify(finalEntries))

      console.log(`[v0] Completed fetching ${finalEntries.length} scope usage entries`)

      toast({
        title: "Success",
        description: `Fetched ${finalEntries.length} scope usage entries`,
      })
    } catch (error) {
      console.error("[v0] Error fetching scope usage:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch scope usage",
        variant: "destructive",
      })
    } finally {
      setIsFetching(false)
      setFetchProgress({ current: 0, max: 0 })
    }
  }

  const loadCachedScopeUsage = () => {
    const cached = localStorage.getItem("scopeUsage")
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        setScopeUsage(parsed)
      } catch (error) {
        console.error("[v0] Error loading cached scope usage:", error)
      }
    }
  }

  const handleSaveConfig = (maxFetch: number) => {
    if (maxFetch > 0) {
      setMaxFetchCount(maxFetch)
      localStorage.setItem("scopeMaxFetch", maxFetch.toString())
      setShowConfigModal(false)
      toast({
        title: "Settings Saved",
        description: `Maximum fetch count set to ${maxFetch}`,
      })
    } else {
      toast({
        title: "Invalid Input",
        description: "Please enter a positive number",
        variant: "destructive",
      })
    }
  }

  const filteredScopeUsage = useMemo(() => {
    return scopeUsage.filter((entry) => {
      if (userFilter && !entry.user.toLowerCase().includes(userFilter.toLowerCase())) {
        return false
      }
      if (scenarioFilter && !entry.scenario.toLowerCase().includes(scenarioFilter.toLowerCase())) {
        return false
      }
      if (crimeIdFilter && entry.crimeId && !entry.crimeId.includes(crimeIdFilter)) {
        return false
      }

      if (selectedLevels.length > 0 && entry.level && !selectedLevels.includes(entry.level)) {
        return false
      }
      if (selectedLengths.length > 0 && entry.length && !selectedLengths.includes(entry.length)) {
        return false
      }
      if (selectedPeople.length > 0 && entry.people && !selectedPeople.includes(entry.people)) {
        return false
      }
      if (selectedCategories.length > 0) {
        const scenarioInfo = getScenarioInfo(entry.scenario)
        if (scenarioInfo) {
          const hasTools = scenarioInfo.tools.length > 0
          const hasMaterials = scenarioInfo.materials.length > 0
          const categories = []
          if (hasTools) categories.push("Tools Required")
          if (hasMaterials) categories.push("Materials Required")
          if (!hasTools && !hasMaterials) categories.push("No Items")

          const matchesCategory = categories.some((cat) => selectedCategories.includes(cat))
          if (!matchesCategory) return false
        }
      }
      if (selectedUsers.length > 0 && !selectedUsers.includes(entry.user)) {
        return false
      }
      if (dateRange.from) {
        const fromDate = new Date(dateRange.from).getTime() / 1000
        if (entry.timestamp < fromDate) return false
      }
      if (dateRange.to) {
        const toDate = new Date(dateRange.to).getTime() / 1000 + 86400
        if (entry.timestamp > toDate) return false
      }
      return true
    })
  }, [
    scopeUsage,
    selectedLevels,
    selectedLengths,
    selectedPeople,
    selectedCategories,
    selectedUsers,
    dateRange,
    userFilter,
    scenarioFilter,
    crimeIdFilter,
  ])

  const stats = useMemo(() => {
    const totalScopeUsed = filteredScopeUsage.reduce((sum, entry) => sum + entry.scopeUsed, 0)
    const totalSpawns = filteredScopeUsage.length
    const avgScope = totalSpawns > 0 ? totalScopeUsed / totalSpawns : 0

    // Group by scenario
    const byScenario = filteredScopeUsage.reduce(
      (acc, entry) => {
        if (!acc[entry.scenario]) {
          acc[entry.scenario] = { count: 0, totalScope: 0 }
        }
        acc[entry.scenario].count++
        acc[entry.scenario].totalScope += entry.scopeUsed
        return acc
      },
      {} as Record<string, { count: number; totalScope: number }>,
    )

    // Most spawned scenarios
    const mostSpawned = Object.entries(byScenario)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)

    // Group by user
    const byUser = filteredScopeUsage.reduce(
      (acc, entry) => {
        if (!acc[entry.user]) {
          acc[entry.user] = { count: 0, totalScope: 0 }
        }
        acc[entry.user].count++
        acc[entry.user].totalScope += entry.scopeUsed
        return acc
      },
      {} as Record<string, { count: number; totalScope: number }>,
    )

    // Top scope users
    const topUsers = Object.entries(byUser)
      .sort((a, b) => b[1].totalScope - a[1].totalScope)
      .slice(0, 5)

    return {
      totalScopeUsed,
      totalSpawns,
      avgScope,
      mostSpawned,
      topUsers,
    }
  }, [filteredScopeUsage])

  const handleLogout = () => {
    handleFullLogout()
    toast({
      title: "Success",
      description: "Logged out successfully",
    })
    setTimeout(() => router.push("/"), 500)
  }

  const clearFilters = () => {
    setSelectedLevels([])
    setSelectedLengths([])
    setSelectedPeople([])
    setSelectedCategories([])
    setSelectedUsers([])
    setDateRange({ from: "", to: "" })
    setUserFilter("")
    setScenarioFilter("")
    setCrimeIdFilter("")
    // Close all filter dropdowns when clearing filters
    // The filter dropdowns are managed within ScopeUsageTable and will be reset implicitly
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading scope usage...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <ScopeUsageHeader onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <ScopeUsageStats
            totalLogs={scopeUsage.length}
            maxFetchCount={maxFetchCount}
            isFetching={isFetching}
            fetchProgress={fetchProgress}
            onFetch={handleFetchHistorical}
            onConfigClick={() => setShowConfigModal(true)}
          />

          <ScopeUsageSummary
            totalScopeUsed={stats.totalScopeUsed}
            totalSpawns={stats.totalSpawns}
            avgScope={stats.avgScope}
          />

          <ScopeUsageFilters
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(!showFilters)}
            selectedLevels={selectedLevels}
            selectedLengths={selectedLengths}
            selectedPeople={selectedPeople}
            selectedCategories={selectedCategories}
            selectedUsers={selectedUsers}
            dateRange={dateRange}
            userFilter={userFilter}
            scenarioFilter={scenarioFilter}
            crimeIdFilter={crimeIdFilter}
            availableLevels={[...new Set(scopeUsage.map((e) => e.level).filter(Boolean))].sort((a, b) => a! - b!)}
            availableLengths={[...new Set(scopeUsage.map((e) => e.length).filter(Boolean))].sort((a, b) => a! - b!)}
            availablePeople={[...new Set(scopeUsage.map((e) => e.people).filter(Boolean))].sort((a, b) => a! - b!)}
            availableCategories={["Tools Required", "Materials Required", "No Items"]}
            availableUsers={[...new Set(scopeUsage.map((e) => e.user))].sort()}
            onLevelToggle={(level) => {
              setSelectedLevels((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]))
            }}
            onLengthToggle={(length) => {
              setSelectedLengths((prev) =>
                prev.includes(length) ? prev.filter((l) => l !== length) : [...prev, length],
              )
            }}
            onPeopleToggle={(people) => {
              setSelectedPeople((prev) =>
                prev.includes(people) ? prev.filter((p) => p !== people) : [...prev, people],
              )
            }}
            onCategoryToggle={(category) => {
              setSelectedCategories((prev) =>
                prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
              )
            }}
            onUserToggle={(user) => {
              setSelectedUsers((prev) => (prev.includes(user) ? prev.filter((u) => u !== user) : [...prev, user]))
            }}
            onDateRangeChange={setDateRange}
            onUserFilterChange={setUserFilter}
            onScenarioFilterChange={setScenarioFilter}
            onCrimeIdFilterChange={setCrimeIdFilter}
            onRefresh={handleFetchHistorical}
            onClearFilters={clearFilters}
          />

          <ScopeUsageTable entries={filteredScopeUsage} />
        </div>
      </main>

      <ScopeUsageConfigModal
        isOpen={showConfigModal}
        currentMaxFetch={maxFetchCount}
        onSave={handleSaveConfig}
        onClose={() => setShowConfigModal(false)}
      />
    </div>
  )
}
