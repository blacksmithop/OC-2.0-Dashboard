"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { fetchAndCacheItems } from "@/lib/cache/items-cache"
import type { TornItem } from "@/lib/cache/items-cache"
import { fetchAndCacheMembers } from "@/lib/cache/members-cache"
import { fetchAndCacheFactionBasic } from "@/lib/cache/faction-basic-cache"
import CrimeSummary from "@/components/crimes/crime-summary"
import { handleApiError, validateApiResponse } from "@/lib/api-error-handler"
import { ResetConfirmationDialog } from "@/components/reset-confirmation-dialog"
import { clearAllCache } from "@/lib/cache/cache-reset"
import { crimeApiCache } from "@/lib/cache/crime-api-cache"
import { canAccessArmory, canAccessFunds, canAccessMedical } from "@/lib/api-scopes"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { DashboardFooter } from "@/components/dashboard/dashboard-footer"
import { apiKeyManager } from "@/lib/auth/api-key-manager"
import { db, STORES } from "@/lib/db/indexeddb"

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
  const [isFetchingHistorical, setIsFetchingHistorical] = useState(false)
  const [historicalProgress, setHistoricalProgress] = useState({ current: 0, total: 0 })
  const [historicalCrimes, setHistoricalCrimes] = useState<Crime[]>([])
  const [historicalFetchComplete, setHistoricalFetchComplete] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [hasArmoryScope, setHasArmoryScope] = useState(true)
  const [hasFundsScope, setHasFundsScope] = useState(true)
  const [hasMedicalScope, setHasMedicalScope] = useState(true)
  const [hasTornStatsApiKey, setHasTornStatsApiKey] = useState(false) // Declare setHasTornStatsApiKey

  const allCrimes = useMemo(() => {
    const crimeMap = new Map<number, Crime>()
    historicalCrimes.forEach((crime) => crimeMap.set(crime.id, crime))
    crimes.forEach((crime) => crimeMap.set(crime.id, crime))
    return Array.from(crimeMap.values())
  }, [crimes, historicalCrimes])

  useEffect(() => {
    const initializeDashboard = async () => {
      const apiKey = await apiKeyManager.getApiKey()
      if (!apiKey) {
        router.push("/")
        return
      }

      setHasArmoryScope(canAccessArmory())
      setHasFundsScope(canAccessFunds())
      setHasMedicalScope(canAccessMedical())

      const cached = await db.get<Crime[]>(STORES.CACHE, "factionHistoricalCrimes")
      if (cached) {
        try {
          setHistoricalCrimes(cached)
          setHistoricalFetchComplete(true)
          console.log(`[v0] Loaded ${cached.length} historical crimes from IndexedDB`)
        } catch (err) {
          console.error("[v0] Error loading cached crimes:", err)
        }
      }

      fetchData(apiKey)
      setTimeout(() => {
        fetchHistoricalCrimes(apiKey)
      }, 1000)
    }

    initializeDashboard()
  }, [router])

  const fetchData = async (apiKey: string) => {
    setIsLoading(true)

    try {
      await fetchAndCacheFactionBasic(apiKey)

      const itemsData = await fetchAndCacheItems(apiKey)
      setItems(itemsData)

      const membersData = await fetchAndCacheMembers(apiKey)
      setMemberCount(membersData.size)

      const crimesRes = await fetch(
        "https://api.torn.com/v2/faction/crimes?striptags=true&comment=oc_dashboard_crimes",
        {
          headers: {
            Authorization: `ApiKey ${apiKey}`,
            accept: "application/json",
          },
        },
      )

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
    const cached = await db.get<Crime[]>(STORES.CACHE, "factionHistoricalCrimes")
    const lastFetch = await db.get<number>(STORES.CACHE, "lastHistoricalFetch")

    if (cached && lastFetch) {
      const timeSinceLastFetch = Date.now() - lastFetch
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
    const REQUESTS_PER_BATCH = 30
    const BATCH_SLEEP_TIME = 60000 // 1 minute

    try {
      console.log("[v0] Fetching latest crimes (fresh, not cached)")
      const firstUrl = `https://api.torn.com/v2/faction/crimes?cat=completed&sort=DESC&striptags=true&comment=oc_dashboard_crimes`
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
      requestCount++

      while (hasMoreData && oldestTimestamp) {
        if (requestCount > 0 && requestCount % REQUESTS_PER_BATCH === 0) {
          console.log(`[v0] Rate limit: Sleeping for 1 minute after ${requestCount} requests`)
          toast({
            title: "Rate Limit Pause",
            description: `Pausing for 1 minute after ${requestCount} requests to respect API limits`,
          })
          await new Promise((resolve) => setTimeout(resolve, BATCH_SLEEP_TIME))
        }

        const historicalUrl = `https://api.torn.com/v2/faction/crimes?cat=completed&sort=DESC&to=${oldestTimestamp}&striptags=true&comment=oc_dashboard_crimes`
        const data = await crimeApiCache.fetchWithCache(historicalUrl, apiKey, false)
        requestCount++

        if (requestCount % 10 === 0) {
          toast({
            title: "Fetching Historical Data",
            description: `Fetched ${allCrimes.length} crimes (Request ${requestCount})`,
          })
        }

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
        // Fixed db.put to db.set for IndexedDB API
        await db.set(STORES.CACHE, "factionHistoricalCrimes", allCrimes)
        await db.set(STORES.CACHE, "lastHistoricalFetch", Date.now())
        console.log(`[v0] Fetched ${allCrimes.length} historical crimes`)

        toast({
          title: "Success",
          description: `Fetched ${allCrimes.length} historical crimes`,
        })
      }
    } catch (err) {
      console.error("[v0] Error fetching historical crimes:", err)
      toast({
        title: "Error",
        description: "Failed to fetch historical crimes",
        variant: "destructive",
      })
    } finally {
      setIsFetchingHistorical(false)
      setHistoricalFetchComplete(true)
    }
  }

  const handleReset = async () => {
    const apiKey = await apiKeyManager.getApiKey()
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
      <DashboardHeader
        isFetchingHistorical={isFetchingHistorical}
        historicalProgress={historicalProgress}
        refreshing={refreshing}
        onReset={handleReset}
        resetDialogOpen={resetDialogOpen}
        onResetDialogChange={setResetDialogOpen}
      />

      <ResetConfirmationDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen} onConfirm={handleReset} />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {allCrimes.length > 0 && <CrimeSummary crimes={allCrimes} items={items} />}

          <DashboardStats
            memberCount={memberCount}
            crimeCount={allCrimes.length}
            historicalFetchComplete={historicalFetchComplete}
            hasArmoryScope={hasArmoryScope}
            hasFundsScope={hasFundsScope}
            hasMedicalScope={hasMedicalScope}
            hasTornStatsApiKey={hasTornStatsApiKey}
          />
        </div>
      </main>

      <DashboardFooter />
    </div>
  )
}
