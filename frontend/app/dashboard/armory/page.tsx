"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Package, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react"
import { fetchAndCacheItems } from "@/lib/cache/items-cache"
import type { TornItem } from "@/lib/cache/items-cache"
import { fetchAndCacheMembers, type FactionMember } from "@/lib/cache/members-cache"
import { fetchAndCacheFactionBasic } from "@/lib/cache/faction-basic-cache"
import ItemModal from "@/components/crimes/item-modal"
import { handleFullLogout } from "@/lib/logout-handler"
import ArmoryHeader from "@/components/armory/armory-header"
import ArmoryStats from "@/components/armory/armory-stats"
import ArmoryFilters from "@/components/armory/armory-filters"
import ArmoryLogCard from "@/components/armory/armory-log-card"
import ArmoryConfigModal from "@/components/armory/armory-config-modal"
import { apiKeyManager } from "@/lib/auth/api-key-manager"
import { db, STORES } from "@/lib/db/indexeddb"

import type { ArmoryNewsItem, FetchProgress } from "@/lib/armory/types"
import { fetchHistoricalArmoryNews } from "@/lib/armory/fetcher"
import { loadCachedArmoryNews, saveCachedArmoryNews, clearArmoryCache } from "@/lib/armory/api"
import {
  groupConsecutiveLogs,
  getItemByName,
  getItemCategory,
  extractCategories,
  extractItemNames,
  filterArmoryNews,
  loadMaxFetchCount,
  saveMaxFetchCount,
} from "@/lib/armory/utils"

const ARMORY_ACTIONS = ["Add", "Remove", "Upgrade"]

export default function ArmoryPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [armoryNews, setArmoryNews] = useState<ArmoryNewsItem[]>([])
  const [items, setItems] = useState<Map<number, TornItem>>(new Map())
  const [members, setMembers] = useState<FactionMember[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [fetchProgress, setFetchProgress] = useState<FetchProgress>({ current: 0, max: 0, requestNumber: 0 })
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<string>("All")
  const [selectedUser, setSelectedUser] = useState<string>("All")
  const [timeFilter, setTimeFilter] = useState<string>("All")
  const [selectedAction, setSelectedAction] = useState<string>("All")
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [selectedItem, setSelectedItem] = useState<TornItem | null>(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [maxFetchCount, setMaxFetchCount] = useState(1000)
  const [hasArmoryAccess, setHasArmoryAccess] = useState<boolean>(true)
  const [selectedItemFilter, setSelectedItemFilter] = useState<string>("All Items")

  useEffect(() => {
    const init = async () => {
      const apiKey = await apiKeyManager.getApiKey()
      if (!apiKey) {
        router.push("/")
        return
      }

      try {
        await fetchAndCacheFactionBasic(apiKey)
      } catch (error) {
        console.error("[v0] Error fetching faction basic data:", error)
      }

      const savedMaxFetch = await loadMaxFetchCount()
      setMaxFetchCount(savedMaxFetch)

      loadItemsData(apiKey)
      loadMembersData(apiKey)
      loadCachedData()
    }

    init()
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

  const loadCachedData = async () => {
    const cached = await loadCachedArmoryNews()
    if (cached.length > 0) {
      setArmoryNews(cached)
    }
  }

  const handleFetchHistorical = async () => {
    console.log("[v0] Fetching factionId from IndexedDB")
    const factionId = await db.get<string>(STORES.CACHE, "factionId")

    console.log("[v0] FactionId retrieved:", factionId)

    if (!factionId) {
      toast({
        title: "Error",
        description: "Missing faction ID. Please refresh the page.",
        variant: "destructive",
      })
      return
    }

    setIsFetching(true)
    setHasArmoryAccess(true)
    setFetchProgress({ current: 0, max: maxFetchCount, requestNumber: 0 })

    try {
      console.log("[v0] Starting armory news fetch for faction:", factionId)
      toast({
        title: "Fetching",
        description: "Starting armory news fetch...",
      })

      const news = await fetchHistoricalArmoryNews(factionId, {
        maxCount: maxFetchCount,
        onProgress: (progress) => {
          setFetchProgress(progress)
          toast({
            title: "Fetching",
            description: (
              <span>
                {!progress.isCacheHit && (
                  <span className="text-cyan-500 font-mono mr-2">#{progress.requestNumber}</span>
                )}
                Fetched {progress.current}/{progress.max}
              </span>
            ),
          })
        },
        onError: (error) => {
          if (error.message === "API_ACCESS_DENIED") {
            setHasArmoryAccess(false)
          }
        },
      })

      console.log("[v0] Armory news fetched successfully, count:", news.length)
      setArmoryNews(news)
      await saveCachedArmoryNews(news)

      toast({
        title: "Success",
        description: `Fetched ${news.length} armory logs`,
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
      setFetchProgress({ current: 0, max: 0, requestNumber: 0 })
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

  const handleClearCache = async () => {
    await clearArmoryCache()
    setArmoryNews([])
    setCurrentPage(1)
    toast({
      title: "Cache Cleared",
      description: "Armory cache has been cleared successfully",
    })
  }

  const handleSaveConfig = async (maxFetch: number) => {
    if (maxFetch > 0) {
      setMaxFetchCount(maxFetch)
      await saveMaxFetchCount(maxFetch)
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

  const categories = extractCategories(items, armoryNews)
  const actions = ARMORY_ACTIONS

  const categoryFilteredNews =
    selectedCategory === "All"
      ? armoryNews
      : armoryNews.filter((log) => getItemCategory(items, log.item.name) === selectedCategory)

  const availableItems = extractItemNames(items, categoryFilteredNews)

  const filteredNews = filterArmoryNews(
    categoryFilteredNews,
    {
      userId: selectedUser !== "All" ? Number.parseInt(selectedUser, 10) : undefined,
      timeFilter: timeFilter !== "All" ? timeFilter : undefined,
      action: selectedAction !== "All" ? selectedAction : undefined,
      itemName: selectedItemFilter !== "All Items" ? selectedItemFilter : undefined,
    },
    items,
  )

  const groupedNews = groupConsecutiveLogs(filteredNews)
  const totalPages = Math.ceil(groupedNews.length / itemsPerPage)
  const paginatedNews = groupedNews.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

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
                setSelectedItemFilter("All Items")
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
              actions={actions}
              selectedAction={selectedAction}
              onActionChange={(action) => {
                setSelectedAction(action)
                setCurrentPage(1)
              }}
              availableItems={availableItems}
              selectedItem={selectedItemFilter}
              onItemChange={(item) => {
                setSelectedItemFilter(item)
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
                    item={getItemByName(items, log.item.name)}
                    category={getItemCategory(items, log.item.name)}
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

          {groupedNews.length === 0 && armoryNews.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-12 text-center">
              <Package size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Logs Match Filters</h3>
              <p className="text-muted-foreground">Try adjusting your filters to see more results</p>
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
