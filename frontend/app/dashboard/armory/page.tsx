"use client"

import { useEffect, useState } from "react"
import { useRouter } from 'next/navigation'
import { useToast } from "@/hooks/use-toast"
import { Package, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchAndCacheItems } from "@/lib/cache/items-cache"
import type { TornItem } from "@/lib/cache/items-cache"
import { fetchAndCacheMembers, type FactionMember } from "@/lib/cache/members-cache"
import ItemModal from "@/components/crimes/item-modal"
import { crimeApiCache } from "@/lib/cache/crime-api-cache"
import { handleFullLogout } from "@/lib/logout-handler"
import ArmoryHeader from "@/components/armory/armory-header"
import ArmoryStats from "@/components/armory/armory-stats"
import ArmoryFilters from "@/components/armory/armory-filters"
import ArmoryLogCard from "@/components/armory/armory-log-card"
import ArmoryConfigModal from "@/components/armory/armory-config-modal"

export interface ArmoryNewsItem {
  uuid: string
  timestamp: number
  news: string
  user: {
    name: string
    id: number
  }
  action: "used" | "filled" | "retrieved" | "deposited" | "gave" | "loaned" | "returned"
  target?: {
    name: string
    id: number
  }
  item: {
    name: string
    quantity: number
  }
  crimeScenario?: {
    crime_id: number
    scenario: string
    role: string
    percentage: number
  }
}

export interface GroupedLog {
  user: {
    name: string
    id: number
  }
  action: string
  item: {
    name: string
    quantity: number
  }
  target?: {
    name: string
    id: number
  }
  timestamp: number
  count: number
  crimeScenario?: ArmoryNewsItem["crimeScenario"]
  originalLogs: ArmoryNewsItem[]
}

interface Member {
  id: number
  name: string
}

// Regex patterns for parsing armory news
const RETRIEVE_RE =
  /<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+retrieved\s+(?:1x )?([^<]+)\s+from\s+<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>/i
const USE_FILL_GIVE_RE =
  /<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+(used|filled|gave)\s+one of the faction's\s+([^<]+)\s+items?/i
const DEPOSIT_RE = /<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+deposited\s+(\d+)\s*(?:x\s*)?([^<]+)/i
const GIVE_SELF_RE =
  /<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+gave\s+(\d+)x\s+([^<]+)\s+to themselves from the faction armory/i
const CRIME_CUT_RE =
  /<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+gave\s+<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+(\d+)x\s+([^<]+)\s+as\s+their\s+([\d.]+)%\s+cut\s+(?:for their role as\s+([^<]+)\s+in the faction's\s+([^<]+)\s+scenario\s+\[<a href\s*=\s*"[^"]*crimeId=(\d+)">view<\/a>\])?/i
const LOANED_RE =
  /<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+loaned\s+(\d+)x\s+([^<]+)\s+to\s+<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+from the faction armory/i
const RETURNED_RE = /<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+returned\s+(\d+)x\s+([^<]+)/i

function parseArmoryNews(uuid: string, timestamp: number, news: string): ArmoryNewsItem | null {
  try {
    // Retrieve
    let match = news.match(RETRIEVE_RE)
    if (match) {
      return {
        uuid,
        timestamp,
        news,
        action: "retrieved",
        user: { name: match[2], id: Number.parseInt(match[1]) }, // The person who retrieved (Oxiblurr)
        target: { name: match[5], id: Number.parseInt(match[4]) }, // The person it was retrieved from (BlackPerl)
        item: { name: match[3].trim(), quantity: 1 },
      }
    }

    // Use/Fill/Gave (one of faction's)
    match = news.match(USE_FILL_GIVE_RE)
    if (match) {
      return {
        uuid,
        timestamp,
        news,
        action: match[3].toLowerCase() as "used" | "filled" | "gave",
        user: { name: match[2], id: Number.parseInt(match[1]) },
        item: { name: match[4].trim(), quantity: 1 },
      }
    }

    // Deposit
    match = news.match(DEPOSIT_RE)
    if (match) {
      return {
        uuid,
        timestamp,
        news,
        action: "deposited",
        user: { name: match[2], id: Number.parseInt(match[1]) },
        item: { name: match[4].trim(), quantity: Number.parseInt(match[3]) },
      }
    }

    // Give to self
    match = news.match(GIVE_SELF_RE)
    if (match) {
      return {
        uuid,
        timestamp,
        news,
        action: "gave",
        user: { name: match[2], id: Number.parseInt(match[1]) },
        item: { name: match[4].trim(), quantity: Number.parseInt(match[3]) },
      }
    }

    // Crime reward cut
    match = news.match(CRIME_CUT_RE)
    if (match) {
      const result: ArmoryNewsItem = {
        uuid,
        timestamp,
        news,
        action: "gave",
        user: { name: match[2], id: Number.parseInt(match[1]) },
        target: { name: match[4], id: Number.parseInt(match[3]) },
        item: { name: match[6].trim(), quantity: Number.parseInt(match[5]) },
      }
      if (match[10]) {
        result.crimeScenario = {
          crime_id: Number.parseInt(match[10]),
          scenario: match[9].trim(),
          role: match[8].trim(),
          percentage: Number.parseFloat(match[7]),
        }
      }
      return result
    }

    // Loaned
    match = news.match(LOANED_RE)
    if (match) {
      return {
        uuid,
        timestamp,
        news,
        action: "loaned",
        user: { name: match[2], id: Number.parseInt(match[1]) },
        target: { name: match[6], id: Number.parseInt(match[5]) },
        item: { name: match[4].trim(), quantity: Number.parseInt(match[3]) },
      }
    }

    // Returned
    match = news.match(RETURNED_RE)
    if (match) {
      return {
        uuid,
        timestamp,
        news,
        action: "returned",
        user: { name: match[2], id: Number.parseInt(match[1]) },
        item: { name: match[4].trim(), quantity: Number.parseInt(match[3]) },
      }
    }

    return null
  } catch (error) {
    console.error("[v0] Error parsing armory news:", news, error)
    return null
  }
}

export default function ArmoryPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [armoryNews, setArmoryNews] = useState<ArmoryNewsItem[]>([])
  const [items, setItems] = useState<Map<number, TornItem>>(new Map())
  const [members, setMembers] = useState<FactionMember[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [fetchProgress, setFetchProgress] = useState({ current: 0, max: 0 })
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<string>("All")
  const [selectedUser, setSelectedUser] = useState<string>("All")
  const [timeFilter, setTimeFilter] = useState<string>("All")
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [selectedItem, setSelectedItem] = useState<TornItem | null>(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [maxFetchCount, setMaxFetchCount] = useState(1000)
  const [hasArmoryAccess, setHasArmoryAccess] = useState<boolean>(true)

  useEffect(() => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (!apiKey) {
      router.push("/")
      return
    }

    const savedMaxFetch = localStorage.getItem("armoryMaxFetch")
    if (savedMaxFetch) {
      const parsed = Number.parseInt(savedMaxFetch, 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        setMaxFetchCount(parsed)
      }
    }

    loadItemsData(apiKey)
    loadMembersData(apiKey)
    loadCachedArmoryNews()
  }, [router])

  const loadItemsData = async (apiKey: string) => {
    try {
      const itemsData = await fetchAndCacheItems(apiKey)
      setItems(itemsData)
    } catch (error) {
      console.error("[v0] Error loading items:", error)
    }
  }

  const loadMembersData = async (apiKey: string) => {
    try {
      const membersData = await fetchAndCacheMembers(apiKey)
      const membersList = Array.from(membersData.values()).map((m: FactionMember) => ({
        id: m.id,
        name: m.name,
      }))
      setMembers(membersList)
    } catch (error) {
      console.error("[v0] Error loading members:", error)
    }
  }

  const fetchArmoryNews = async (
    factionId: string,
    to?: number,
    skipCache = false,
  ): Promise<Record<string, { news: string; timestamp: number }>> => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (!apiKey) throw new Error("No API key found")

    if (!skipCache && to) {
      const cacheKey = `armory_to_${to}`
      const cachedData = crimeApiCache.get(cacheKey)
      if (cachedData) {
        console.log(`[v0] Armory API cache HIT for timestamp: ${to}`)
        return cachedData
      }
    }

    let url = `https://api.torn.com/faction/${factionId}?selections=armorynews&striptags=true`
    if (to) {
      url += `&to=${to}`
    }

    console.log(`[v0] Fetching armory news from API${to ? ` (to=${to})` : " (fresh)"}`)
    const response = await fetch(url, {
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch armory news")
    }

    const data = await response.json()

    if (data.error) {
      if (data.error.code === 16 || data.error.code === 2) {
        setHasArmoryAccess(false)
        throw new Error("API_ACCESS_DENIED")
      }
      throw new Error(data.error.error || "API error")
    }

    const armorynews = data.armorynews || {}

    if (to) {
      const cacheKey = `armory_to_${to}`
      crimeApiCache.set(cacheKey, armorynews)
      console.log(`[v0] Cached armory response for timestamp: ${to}`)
    }

    return armorynews
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
    setHasArmoryAccess(true)
    setFetchProgress({ current: 0, max: maxFetchCount })
    const allNews: ArmoryNewsItem[] = []
    const seenUuids = new Set<string>()
    let toTimestamp: number | undefined = undefined
    let lastOldestId: string | null = null

    try {
      toast({
        title: "Fetching",
        description: "Starting armory news fetch...",
      })

      console.log("[v0] Fetching latest armory news (fresh, not cached)")
      const rawNews = await fetchArmoryNews(factionId, undefined, true)

      if (Object.keys(rawNews).length > 0) {
        for (const [uuid, data] of Object.entries(rawNews)) {
          if (!seenUuids.has(uuid)) {
            seenUuids.add(uuid)
            const parsed = parseArmoryNews(uuid, data.timestamp, data.news)
            if (parsed) {
              allNews.push(parsed)
            }
          }
        }

        allNews.sort((a, b) => b.timestamp - a.timestamp)

        if (allNews.length > 0) {
          const oldestInBatch = allNews[allNews.length - 1]
          lastOldestId = oldestInBatch.uuid
          toTimestamp = oldestInBatch.timestamp
        }

        setFetchProgress({ current: allNews.length, max: maxFetchCount })
      }

      while (allNews.length < maxFetchCount && toTimestamp) {
        console.log(`[v0] Fetching armory news with to=${toTimestamp}`)
        const rawNews = await fetchArmoryNews(factionId, toTimestamp, false)

        if (Object.keys(rawNews).length === 0) {
          console.log("[v0] No more armory news to fetch")
          break
        }

        const batch: ArmoryNewsItem[] = []
        for (const [uuid, data] of Object.entries(rawNews)) {
          if (!seenUuids.has(uuid)) {
            seenUuids.add(uuid)
            const parsed = parseArmoryNews(uuid, data.timestamp, data.news)
            if (parsed) {
              batch.push(parsed)
            }
          }
        }

        if (batch.length === 0) {
          console.log("[v0] No new unique logs in this batch, stopping")
          break
        }

        batch.sort((a, b) => b.timestamp - a.timestamp)

        const oldestInBatch = batch[batch.length - 1]
        if (lastOldestId === oldestInBatch.uuid) {
          console.log("[v0] Reached end of pagination (same oldest ID)")
          break
        }

        lastOldestId = oldestInBatch.uuid
        allNews.push(...batch)

        setFetchProgress({ current: allNews.length, max: maxFetchCount })

        toast({
          title: "Fetching",
          description: `Fetched ${allNews.length}/${maxFetchCount} armory logs...`,
        })

        toTimestamp = oldestInBatch.timestamp

        await new Promise((resolve) => setTimeout(resolve, 2000))

        if (allNews.length >= maxFetchCount) {
          console.log("[v0] Reached max fetch count")
          break
        }
      }

      const finalNews = allNews.slice(0, maxFetchCount)
      finalNews.sort((a, b) => b.timestamp - a.timestamp)

      setArmoryNews(finalNews)
      localStorage.setItem("armoryNews", JSON.stringify(finalNews))

      console.log(`[v0] Completed fetching ${finalNews.length} armory logs`)

      toast({
        title: "Success",
        description: `Fetched ${finalNews.length} armory logs`,
      })
    } catch (error) {
      console.error("[v0] Error fetching armory news:", error)
      if (error instanceof Error && error.message === "API_ACCESS_DENIED") {
        toast({
          title: "API Access Denied",
          description:
            "Your API key does not have access to armory data. Please generate a new key with the 'armorynews' scope.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to fetch armory news",
          variant: "destructive",
        })
      }
    } finally {
      setIsFetching(false)
      setFetchProgress({ current: 0, max: 0 })
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

  const handleClearCache = () => {
    localStorage.removeItem("armoryNews")
    localStorage.removeItem("armoryMaxFetch")
    setArmoryNews([])
    setCurrentPage(1)
    toast({
      title: "Cache Cleared",
      description: "Armory cache has been cleared successfully",
    })
  }

  const groupConsecutiveLogs = (logs: ArmoryNewsItem[]): GroupedLog[] => {
    if (logs.length === 0) return []

    const grouped: GroupedLog[] = []
    let currentGroup: GroupedLog | null = null
    let currentLogs: ArmoryNewsItem[] = []

    for (const log of logs) {
      const shouldGroup =
        currentGroup &&
        currentGroup.user.id === log.user.id &&
        currentGroup.action === log.action &&
        currentGroup.item.name === log.item.name &&
        currentGroup.target?.id === log.target?.id

      if (shouldGroup && currentGroup) {
        currentGroup.item.quantity += log.item.quantity
        currentGroup.count++
        currentLogs.push(log)
      } else {
        if (currentGroup) {
          currentGroup.originalLogs = currentLogs
          grouped.push(currentGroup)
        }
        currentLogs = [log]
        currentGroup = {
          user: log.user,
          action: log.action,
          item: {
            name: log.item.name,
            quantity: log.item.quantity,
          },
          target: log.target,
          timestamp: log.timestamp,
          count: 1,
          crimeScenario: log.crimeScenario,
          originalLogs: [],
        }
      }
    }

    if (currentGroup) {
      currentGroup.originalLogs = currentLogs
      grouped.push(currentGroup)
    }

    return grouped
  }

  const getItemByName = (itemName: string): TornItem | null => {
    for (const item of items.values()) {
      if (item.name.toLowerCase() === itemName.toLowerCase()) {
        return item
      }
    }
    return null
  }

  const getItemCategory = (itemName: string): string => {
    for (const item of items.values()) {
      if (item.name.toLowerCase() === itemName.toLowerCase()) {
        return item.type || "Other"
      }
    }
    return "Other"
  }

  const getTimeFilterTimestamp = (filter: string): number | null => {
    const now = Math.floor(Date.now() / 1000)
    switch (filter) {
      case "1h":
        return now - 3600
      case "6h":
        return now - 6 * 3600
      case "12h":
        return now - 12 * 3600
      case "24h":
        return now - 24 * 3600
      case "7d":
        return now - 7 * 24 * 3600
      case "30d":
        return now - 30 * 24 * 3600
      default:
        return null
    }
  }

  const categories = ["All", ...new Set(armoryNews.map((log) => getItemCategory(log.item.name)))]

  let filteredNews = armoryNews

  if (selectedCategory !== "All") {
    filteredNews = filteredNews.filter((log) => getItemCategory(log.item.name) === selectedCategory)
  }

  if (selectedUser !== "All") {
    const userId = Number.parseInt(selectedUser, 10)
    filteredNews = filteredNews.filter((log) => log.user.id === userId)
  }

  const timeFilterTimestamp = getTimeFilterTimestamp(timeFilter)
  if (timeFilterTimestamp) {
    filteredNews = filteredNews.filter((log) => log.timestamp >= timeFilterTimestamp)
  }

  const groupedNews = groupConsecutiveLogs(filteredNews)
  const totalPages = Math.ceil(groupedNews.length / itemsPerPage)
  const paginatedNews = groupedNews.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleSaveConfig = (maxFetch: number) => {
    if (maxFetch > 0) {
      setMaxFetchCount(maxFetch)
      localStorage.setItem("armoryMaxFetch", maxFetch.toString())
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

  const loadCachedArmoryNews = () => {
    const cached = localStorage.getItem("armoryNews")
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        setArmoryNews(parsed)
      } catch (error) {
        console.error("[v0] Error loading cached armory news:", error)
      }
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <ArmoryHeader onLogout={handleLogout} onClearCache={handleClearCache} />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <ArmoryStats
            totalLogs={armoryNews.length}
            maxFetchCount={maxFetchCount}
            isFetching={isFetching}
            fetchProgress={fetchProgress}
            onFetch={handleFetchHistorical}
            onConfigClick={() => setShowConfigModal(true)}
          />

          {armoryNews.length > 0 && (
            <ArmoryFilters
              categories={categories}
              selectedCategory={selectedCategory}
              onCategoryChange={(category) => {
                setSelectedCategory(category)
                setCurrentPage(1)
              }}
              members={members}
              selectedUser={selectedUser}
              onUserChange={(userId) => {
                setSelectedUser(userId)
                setCurrentPage(1)
              }}
              timeFilter={timeFilter}
              onTimeFilterChange={(filter) => {
                setTimeFilter(filter)
                setCurrentPage(1)
              }}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={(count) => {
                setItemsPerPage(count)
                setCurrentPage(1)
              }}
            />
          )}

          {groupedNews.length > 0 && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="text-xl font-bold text-foreground">Armory Logs</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Showing {(currentPage - 1) * itemsPerPage + 1}-
                  {Math.min(currentPage * itemsPerPage, groupedNews.length)} of {groupedNews.length} (grouped)
                </p>
              </div>
              <div className="divide-y divide-border">
                {paginatedNews.map((log, idx) => (
                  <ArmoryLogCard
                    key={`${log.user.id}-${log.timestamp}-${idx}`}
                    log={log}
                    item={getItemByName(log.item.name)}
                    category={getItemCategory(log.item.name)}
                    onItemClick={setSelectedItem}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="p-4 border-t border-border flex items-center justify-between">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-accent/20 hover:bg-accent/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-accent/20 hover:bg-accent/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {armoryNews.length === 0 && !isFetching && !hasArmoryAccess && (
            <div className="bg-card border border-destructive rounded-lg p-12 text-center">
              <AlertTriangle size={48} className="mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">API Key Missing Armory Access</h3>
              <p className="text-muted-foreground mb-4">
                Your API key does not have the required permissions to access armory data.
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Please generate a new API key with the <span className="font-mono text-foreground">armorynews</span>{" "}
                scope enabled.
              </p>
              <a
                href="https://www.torn.com/preferences.php#tab=api?step=addNewKey&title=Faction%20Info%20App&key=&user=1&selections%5B%5D=basic&selections%5B%5D=crimes&selections%5B%5D=armorynews&selections%5B%5D=timestamp&faction=1&factionSelections%5B%5D=basic&factionSelections%5B%5D=timestamp&factionSelections%5B%5D=crimes&factionSelections%5B%5D=contributors&factionSelections%5B%5D=armorynews"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Generate New API Key
              </a>
            </div>
          )}

          {armoryNews.length === 0 && !isFetching && hasArmoryAccess && (
            <div className="bg-card border border-border rounded-lg p-12 text-center">
              <Package size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Armory Logs</h3>
              <p className="text-muted-foreground mb-4">Click "Fetch Historical Data" to load armory logs</p>
            </div>
          )}
        </div>
      </main>

      <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />

      <ArmoryConfigModal
        isOpen={showConfigModal}
        currentMaxFetch={maxFetchCount}
        onSave={handleSaveConfig}
        onClose={() => setShowConfigModal(false)}
      />
    </div>
  )
}
