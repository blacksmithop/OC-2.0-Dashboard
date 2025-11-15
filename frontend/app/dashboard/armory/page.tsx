"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import {
  RefreshCw,
  LogOut,
  MoreVertical,
  Info,
  Package,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
  X,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react"
import { fetchAndCacheItems } from "@/lib/items-cache"
import type { TornItem } from "@/lib/items-cache"
import ItemModal from "@/components/item-modal"
import { crimeApiCache } from "@/lib/crime-api-cache"
import { handleFullLogout } from "@/lib/logout-handler"

interface ArmoryNewsItem {
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

interface GroupedLog {
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

const ITEMS_PER_PAGE = 50

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
        user: { name: match[5], id: Number.parseInt(match[4]) },
        target: { name: match[2], id: Number.parseInt(match[1]) },
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
  const [members, setMembers] = useState<Member[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [fetchProgress, setFetchProgress] = useState({ current: 0, max: 0 })
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<string>("All")
  const [selectedUser, setSelectedUser] = useState<string>("All")
  const [timeFilter, setTimeFilter] = useState<string>("All")
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [selectedItem, setSelectedItem] = useState<TornItem | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [maxFetchCount, setMaxFetchCount] = useState(1000)
  const [tempMaxFetch, setTempMaxFetch] = useState(1000)
  const [hasArmoryAccess, setHasArmoryAccess] = useState<boolean>(true) // Added state to track armory API access

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
        setTempMaxFetch(parsed)
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
      const response = await fetch("https://api.torn.com/v2/faction/members?striptags=true", {
        headers: {
          Authorization: `ApiKey ${apiKey}`,
          accept: "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch members")
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.error || "Failed to fetch members")
      }

      const membersList = Object.values(data.members || {}).map((m: any) => ({
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
        currentGroup.quantity += log.item.quantity
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

  // Filter by category
  if (selectedCategory !== "All") {
    filteredNews = filteredNews.filter((log) => getItemCategory(log.item.name) === selectedCategory)
  }

  // Filter by user
  if (selectedUser !== "All") {
    const userId = Number.parseInt(selectedUser, 10)
    filteredNews = filteredNews.filter((log) => log.user.id === userId)
  }

  // Filter by time
  const timeFilterTimestamp = getTimeFilterTimestamp(timeFilter)
  if (timeFilterTimestamp) {
    filteredNews = filteredNews.filter((log) => log.timestamp >= timeFilterTimestamp)
  }

  const groupedNews = groupConsecutiveLogs(filteredNews)
  const totalPages = Math.ceil(groupedNews.length / itemsPerPage)
  const paginatedNews = groupedNews.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case "deposited":
        return "text-green-500"
      case "retrieved":
        return "text-blue-500"
      case "loaned":
        return "text-yellow-500"
      case "returned":
        return "text-cyan-500"
      case "gave":
        return "text-purple-500"
      case "used":
        return "text-red-500"
      case "filled":
        return "text-orange-500"
      default:
        return "text-muted-foreground"
    }
  }

  const getDirectionText = (action: string) => {
    if (action === "loaned" || action === "gave") return "to"
    if (action === "retrieved") return "from"
    return "to/from"
  }

  const toggleExpanded = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }

  const handleSaveConfig = () => {
    if (tempMaxFetch > 0) {
      setMaxFetchCount(tempMaxFetch)
      localStorage.setItem("armoryMaxFetch", tempMaxFetch.toString())
      setShowConfigModal(false)
      toast({
        title: "Settings Saved",
        description: `Maximum fetch count set to ${tempMaxFetch}`,
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
                <h1 className="text-3xl font-bold text-foreground">Armory Backfill</h1>
              </button>
              <p className="text-muted-foreground mt-1">Historical faction armory logs</p>
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
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Stats Card */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold text-foreground">Total Armory Logs</h2>
                  <button
                    onClick={() => {
                      setTempMaxFetch(maxFetchCount)
                      setShowConfigModal(true)
                    }}
                    className="p-1.5 hover:bg-accent rounded-lg transition-colors"
                    title="Configure max fetch count"
                  >
                    <Settings size={18} className="text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
                <div className="text-4xl font-bold text-primary">{armoryNews.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Max fetch: {maxFetchCount} logs</div>
              </div>
              <button
                onClick={handleFetchHistorical}
                disabled={isFetching}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isFetching ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" />
                    Fetching {fetchProgress.current}/{fetchProgress.max}...
                  </>
                ) : (
                  <>
                    <Package size={20} />
                    Fetch Historical Data
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Category Filter */}
          {armoryNews.length > 0 && (
            <>
              {/* Category Filter */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Filter by Category</h3>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category)
                        setCurrentPage(1)
                      }}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        selectedCategory === category
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent/20 hover:bg-accent/30"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* User Filter */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Filter by User</h3>
                <select
                  value={selectedUser}
                  onChange={(e) => {
                    setSelectedUser(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                >
                  <option value="All">All Users</option>
                  {members
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((member) => (
                      <option key={member.id} value={member.id.toString()}>
                        {member.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Time Filter */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Filter by Time</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "All Time", value: "All" },
                    { label: "Last 1 Hour", value: "1h" },
                    { label: "Last 6 Hours", value: "6h" },
                    { label: "Last 12 Hours", value: "12h" },
                    { label: "Last 24 Hours", value: "24h" },
                    { label: "Last 7 Days", value: "7d" },
                    { label: "Last 30 Days", value: "30d" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setTimeFilter(option.value)
                        setCurrentPage(1)
                      }}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        timeFilter === option.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent/20 hover:bg-accent/30"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Items per page selector */}
          {armoryNews.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Items per page</h3>
              <div className="flex gap-2">
                {[25, 50, 100, 200].map((count) => (
                  <button
                    key={count}
                    onClick={() => {
                      setItemsPerPage(count)
                      setCurrentPage(1)
                    }}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      itemsPerPage === count ? "bg-primary text-primary-foreground" : "bg-accent/20 hover:bg-accent/30"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Armory Logs */}
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
                {paginatedNews.map((log, idx) => {
                  const item = getItemByName(log.item.name)
                  const groupKey = `${log.user.id}-${log.timestamp}-${idx}`
                  const isExpanded = expandedGroups.has(groupKey)
                  const hasMultipleLogs = log.count > 1

                  return (
                    <div key={groupKey} className="hover:bg-accent/5 transition-colors">
                      <div className="p-4 flex items-start justify-between gap-4">
                        <div className="flex-1 flex items-start gap-3">
                          {/* Item thumbnail */}
                          {item && (
                            <button
                              onClick={() => setSelectedItem(item)}
                              className="w-12 h-12 flex-shrink-0 bg-background rounded border border-border hover:border-primary transition-colors overflow-hidden"
                              title={`View ${item.name} details`}
                            >
                              <img
                                src={item.image || "/placeholder.svg"}
                                alt={item.name}
                                className="w-full h-full object-contain"
                              />
                            </button>
                          )}

                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <a
                                href={`https://www.torn.com/profiles.php?XID=${log.user.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-primary hover:underline"
                              >
                                {log.user.name}
                              </a>
                              <span className={`font-medium ${getActionColor(log.action)}`}>{log.action}</span>
                              <span className="text-foreground font-medium">
                                {log.item.quantity > 1 ? `${log.item.quantity}x ` : ""}
                                {log.item.name}
                                {hasMultipleLogs && (
                                  <button
                                    onClick={() => toggleExpanded(groupKey)}
                                    className="text-muted-foreground hover:text-foreground ml-1 inline-flex items-center gap-1"
                                  >
                                    ({log.count} times)
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                )}
                              </span>
                              {log.target && (
                                <>
                                  <span className="text-muted-foreground">{getDirectionText(log.action)}</span>
                                  <a
                                    href={`https://www.torn.com/profiles.php?XID=${log.target.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline font-medium"
                                  >
                                    {log.target.name}
                                  </a>
                                </>
                              )}
                            </div>
                            {log.crimeScenario && (
                              <div className="text-sm text-muted-foreground">
                                Crime reward: {log.crimeScenario.percentage}% cut as {log.crimeScenario.role} in{" "}
                                {log.crimeScenario.scenario}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              Category: {getItemCategory(log.item.name)}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(log.timestamp)}
                        </div>
                      </div>

                      {/* Expandable details section for grouped logs */}
                      {hasMultipleLogs && isExpanded && (
                        <div className="px-4 pb-4 pl-[4.5rem]">
                          <div className="bg-accent/10 rounded-lg p-3 space-y-2 border border-border">
                            <div className="text-sm font-medium text-muted-foreground mb-2">Individual Actions:</div>
                            {log.originalLogs.map((originalLog, logIdx) => (
                              <div
                                key={`${originalLog.uuid}-${logIdx}`}
                                className="text-sm flex items-center justify-between gap-4 py-1"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  {originalLog.target ? (
                                    <>
                                      <span className="text-muted-foreground">
                                        {getDirectionText(originalLog.action)}
                                      </span>
                                      <a
                                        href={`https://www.torn.com/profiles.php?XID=${originalLog.target.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline font-medium"
                                      >
                                        {originalLog.target.name}
                                      </a>
                                      {originalLog.item.quantity > 1 && (
                                        <span className="text-muted-foreground">({originalLog.item.quantity}x)</span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-foreground">
                                      {originalLog.item.quantity > 1 ? `${originalLog.item.quantity}x ` : ""}
                                      {originalLog.item.name}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDate(originalLog.timestamp)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Pagination */}
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

      {showConfigModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowConfigModal(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-lg shadow-xl z-50 w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Fetch Configuration</h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 hover:bg-accent rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="maxFetch" className="block text-sm font-medium text-foreground mb-2">
                  Maximum Logs to Fetch
                </label>
                <input
                  id="maxFetch"
                  type="number"
                  min="1"
                  value={tempMaxFetch}
                  onChange={(e) => setTempMaxFetch(Number.parseInt(e.target.value, 10) || 0)}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter maximum number of logs"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Set how many armory logs to fetch when clicking "Fetch Historical Data"
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 bg-accent/20 hover:bg-accent/30 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
