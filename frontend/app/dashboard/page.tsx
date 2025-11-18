"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from 'next/navigation'
import { useToast } from "@/hooks/use-toast"
import { fetchAndCacheItems } from "@/lib/cache/items-cache"
import type { TornItem } from "@/lib/cache/items-cache"
import { fetchAndCacheMembers } from "@/lib/cache/members-cache"
import CrimeSummary from "@/components/crimes/crime-summary"
import CrimeSuccessCharts from "@/components/crimes/crime-success-charts"
import { handleApiError, validateApiResponse } from "@/lib/api-error-handler"
import { ResetConfirmationDialog } from "@/components/reset-confirmation-dialog"
import { clearAllCache } from "@/lib/cache/cache-reset"
import { crimeApiCache } from "@/lib/cache/crime-api-cache"
import { canAccessArmory, canAccessFunds } from "@/lib/api-scopes"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { DashboardFooter } from "@/components/dashboard/dashboard-footer"

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

  const allCrimes = useMemo(() => {
    const crimeMap = new Map<number, Crime>()
    historicalCrimes.forEach((crime) => crimeMap.set(crime.id, crime))
    crimes.forEach((crime) => crimeMap.set(crime.id, crime))
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

      const membersData = await fetchAndCacheMembers(apiKey)
      setMemberCount(membersData.size)

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
          />

          {allCrimes.length > 0 && <CrimeSuccessCharts crimes={allCrimes} />}
        </div>
      </main>

      <DashboardFooter />
    </div>
  )
}
