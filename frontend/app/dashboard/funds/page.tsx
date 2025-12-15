"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { LogOut, MoreVertical, ArrowLeft, Info, RotateCcw, Package, TrendingUp, TrendingDown, X } from "lucide-react"
import { handleApiError, validateApiResponse } from "@/lib/api-error-handler"
import { ResetConfirmationDialog } from "@/components/reset-confirmation-dialog"
import { clearAllCache } from "@/lib/cache/cache-reset"
import { handleFullLogout } from "@/lib/logout-handler"
import { parseFundsNews, type FundsNewsEntry } from "@/lib/funds-parser"
import { WithdrawUrlGenerator } from "@/components/withdraw-url-generator"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { db, STORES } from "@/lib/db/indexeddb"
import { apiKeyManager } from "@/lib/auth/api-key-manager"
import FundsStats from "@/components/funds/funds-stats"
import FundsConfigModal from "@/components/funds/funds-config-modal"

export default function FundsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [funds, setFunds] = useState<FundsNewsEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [maxItems, setMaxItems] = useState(1000)
  const [showSettings, setShowSettings] = useState(false)
  const [tempMaxItems, setTempMaxItems] = useState(1000)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set())
  const [showConfigModal, setShowConfigModal] = useState(false)

  useEffect(() => {
    const initializePage = async () => {
      const apiKey = await apiKeyManager.getApiKey()
      if (!apiKey) {
        router.push("/")
        return
      }

      const savedMaxItems = await db.get<number>(STORES.SETTINGS, "fundsMaxItems")
      if (savedMaxItems) {
        setMaxItems(savedMaxItems)
        setTempMaxItems(savedMaxItems)
      }

      await loadCachedFunds()
      setIsLoading(false)
    }

    initializePage()
  }, [router])

  const loadCachedFunds = async () => {
    const cached = await db.get<FundsNewsEntry[]>(STORES.CACHE, "factionFundsNews")
    if (cached) {
      setFunds(cached)
      console.log(`[v0] Loaded ${cached.length} cached funds entries`)
    }
  }

  const handleBackfill = async () => {
    const apiKey = await apiKeyManager.getApiKey()
    if (!apiKey) return

    setIsFetching(true)
    const allFunds: FundsNewsEntry[] = []
    const seenUuids = new Set<string>()
    let toTimestamp: number | null = Math.floor(Date.now() / 1000)
    let requestNumber = 0

    try {
      toast({
        title: "Fetching",
        description: "Starting funds news fetch...",
      })

      while (allFunds.length < maxItems) {
        await new Promise((resolve) => setTimeout(resolve, 2500))
        requestNumber++

        const url = toTimestamp
          ? `https://api.torn.com/faction/?selections=fundsnews&to=${toTimestamp}&comment=oc_dashboard_fundsnews`
          : `https://api.torn.com/faction/?selections=fundsnews&comment=oc_dashboard_fundsnews`

        const res = await fetch(url, {
          headers: { Authorization: `ApiKey ${apiKey}`, accept: "application/json" },
        })

        if (!res.ok) {
          await handleApiError(res, "/faction/fundsnews")
          break
        }

        const data = await res.json()
        validateApiResponse(data, "/faction/fundsnews")

        const fundsData = data.fundsnews || {}
        const entries = Object.entries(fundsData)

        if (entries.length === 0) {
          console.log("[v0] No more funds news entries")
          break
        }

        const batch: FundsNewsEntry[] = []
        for (const [uuid, entryData] of entries) {
          if (!seenUuids.has(uuid)) {
            seenUuids.add(uuid)
            const parsed = parseFundsNews(uuid, entryData as { news: string; timestamp: number })
            if (parsed) {
              batch.push(parsed)
            }
          }
        }

        if (batch.length === 0) {
          console.log("[v0] No new funds entries in batch")
          break
        }

        batch.sort((a, b) => b.timestamp - a.timestamp)
        allFunds.push(...batch)
        setFunds([...allFunds])
        setProgress({ current: allFunds.length, total: maxItems })

        toast({
          title: "Fetching",
          description: (
            <span>
              <span className="text-cyan-500 font-mono mr-2">#{requestNumber}</span>
              Fetched {allFunds.length}/{maxItems}
            </span>
          ),
        })

        toTimestamp = batch[batch.length - 1].timestamp

        if (allFunds.length >= maxItems) {
          console.log("[v0] Reached maximum funds entries")
          break
        }
      }

      const sortedFunds = allFunds.slice(0, maxItems).sort((a, b) => b.timestamp - a.timestamp)
      setFunds(sortedFunds)
      await db.set(STORES.CACHE, "factionFundsNews", sortedFunds)

      toast({
        title: "Success",
        description: `Fetched ${sortedFunds.length} fund transfer entries`,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch funds news"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsFetching(false)
      setProgress({ current: 0, total: 0 })
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

  const handleReset = async () => {
    clearAllCache()
    setFunds([])
    toast({
      title: "Success",
      description: "Cache cleared successfully",
    })
  }

  const handleSaveMaxItems = async () => {
    await db.set(STORES.SETTINGS, "fundsMaxItems", tempMaxItems)
    setMaxItems(tempMaxItems)
    setShowSettings(false)
    toast({
      title: "Settings saved",
      description: `Maximum fetch set to ${tempMaxItems} logs`,
    })
  }

  const handleSaveConfig = async (maxFetch: number) => {
    if (maxFetch > 0) {
      setMaxItems(maxFetch)
      await db.set(STORES.SETTINGS, "fundsMaxFetch", maxFetch)
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

  const formatCurrency = (amount: number) => {
    return `$${new Intl.NumberFormat().format(amount)}`
  }

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      deposited: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
      gave: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      crime_cut: "bg-green-500/20 text-green-400 border-green-500/30",
      increased: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      decreased: "bg-red-500/20 text-red-400 border-red-500/30",
      paid: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    }
    return colors[action] || "bg-gray-500/20 text-gray-400 border-gray-500/30"
  }

  const toggleFilter = (action: string) => {
    const newFilters = new Set(selectedFilters)
    if (newFilters.has(action)) {
      newFilters.delete(action)
    } else {
      newFilters.add(action)
    }
    setSelectedFilters(newFilters)
  }

  const filteredFunds = selectedFilters.size === 0 ? funds : funds.filter((entry) => selectedFilters.has(entry.action))

  const actionTypes = Array.from(new Set(funds.map((f) => f.action)))

  const formatNaturalDescription = (entry: FundsNewsEntry) => {
    const { user, target, action, money, crimeScenario } = entry

    switch (action) {
      case "deposited":
        return (
          <>
            <span className="font-semibold text-cyan-400">{user.name}</span>
            <span className="text-muted-foreground"> deposited </span>
            <span className="font-bold text-green-400">{formatCurrency(money)}</span>
          </>
        )
      case "gave":
        return (
          <>
            <span className="font-semibold text-blue-400">{user.name}</span>
            <span className="text-muted-foreground"> gave </span>
            <span className="font-semibold text-purple-400">{target?.name}</span>
            <span className="text-muted-foreground"> </span>
            <span className="font-bold text-green-400">{formatCurrency(money)}</span>
          </>
        )
      case "crime_cut":
        return (
          <>
            <span className="font-semibold text-emerald-400">{user.name}</span>
            <span className="text-muted-foreground"> gave </span>
            <span className="font-bold text-yellow-400">{crimeScenario?.percentage}% cut</span>
            <span className="text-muted-foreground"> to </span>
            <span className="font-semibold text-purple-400">{target?.name}</span>
            <span className="text-muted-foreground"> as </span>
            <span className="text-orange-400">{crimeScenario?.role}</span>
            <span className="text-muted-foreground"> in </span>
            <span className="text-orange-400 font-semibold">{crimeScenario?.scenario}</span>
            <span className="text-muted-foreground"> (</span>
            <span className="font-bold text-green-400">{formatCurrency(money)}</span>
            <span className="text-muted-foreground">)</span>
          </>
        )
      case "increased":
        return (
          <>
            <span className="font-semibold text-emerald-400">{user.name}</span>
            <span className="text-muted-foreground"> increased </span>
            <span className="font-semibold text-purple-400">{target?.name}</span>
            <span className="text-muted-foreground"> </span>
            <span className="font-bold text-green-400">{formatCurrency(money)}</span>
          </>
        )
      case "decreased":
        return (
          <>
            <span className="font-semibold text-red-400">{user.name}</span>
            <span className="text-muted-foreground"> decreased </span>
            <span className="font-semibold text-purple-400">{target?.name}</span>
            <span className="text-muted-foreground"> </span>
            <span className="font-bold text-red-400">{formatCurrency(money)}</span>
          </>
        )
      case "paid":
        return (
          <>
            <span className="font-semibold text-yellow-400">{user.name}</span>
            <span className="text-muted-foreground"> paid </span>
            <span className="font-semibold text-purple-400">{target?.name}</span>
            <span className="text-muted-foreground"> </span>
            <span className="font-bold text-green-400">{formatCurrency(money)}</span>
          </>
        )
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading funds data...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <ResetConfirmationDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen} onConfirm={handleReset} />

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
              <h1 className="text-3xl font-bold text-foreground">Funds Backfill</h1>
              <p className="text-muted-foreground mt-1">Historical faction fund transfers</p>
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
                      setDropdownOpen(false)
                      setResetDialogOpen(true)
                    }}
                    className="w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-accent transition-colors border-t border-border"
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

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <FundsStats
            totalLogs={funds.length}
            maxFetchCount={maxItems}
            isFetching={isFetching}
            fetchProgress={progress}
            onFetch={handleBackfill}
            onConfigClick={() => setShowConfigModal(true)}
          />

          <Accordion type="single" collapsible className="bg-card border border-border rounded-lg">
            <AccordionItem value="withdraw" className="border-0">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-foreground">Withdraw</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <WithdrawUrlGenerator />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {funds.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground font-semibold mr-2">Filter by type:</span>
                {actionTypes.map((actionType) => (
                  <button
                    key={actionType}
                    onClick={() => toggleFilter(actionType)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
                      selectedFilters.has(actionType)
                        ? getActionColor(actionType)
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {actionType}
                    {selectedFilters.has(actionType) && " ✓"}
                  </button>
                ))}
                {selectedFilters.size > 0 && (
                  <button
                    onClick={() => setSelectedFilters(new Set())}
                    className="p-1.5 rounded-md bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 transition-colors ml-2"
                    title="Clear filters"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Showing {filteredFunds.length} of {funds.length} entries
              </div>
            </div>
          )}

          {funds.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-12 text-center">
              <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-bold text-foreground mb-2">No Funds Logs</h3>
              <p className="text-muted-foreground">Click "Fetch Historical Data" to load fund transfer logs</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFunds.map((entry) => (
                <div
                  key={entry.uuid}
                  className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="text-base leading-relaxed mb-2">{formatNaturalDescription(entry)}</div>
                      {entry.oldBalance !== null && entry.newBalance !== null && (
                        <div className="flex items-center gap-2 text-sm mt-2 p-2 bg-background/50 rounded border border-border/50">
                          <span className="text-muted-foreground">Balance:</span>
                          <span className="font-mono text-foreground">{formatCurrency(entry.oldBalance)}</span>
                          {entry.action === "decreased" ? (
                            <TrendingDown size={14} className="text-red-400" />
                          ) : (
                            <TrendingUp size={14} className="text-green-400" />
                          )}
                          <span
                            className={`font-mono font-bold ${entry.action === "decreased" ? "text-red-400" : "text-green-400"}`}
                          >
                            {formatCurrency(entry.newBalance)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground text-right whitespace-nowrap">
                      {formatDateTime(entry.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <FundsConfigModal
        isOpen={showConfigModal}
        currentMaxFetch={maxItems}
        onSave={handleSaveConfig}
        onClose={() => setShowConfigModal(false)}
      />

      <footer className="flex-shrink-0 border-t border-border bg-card px-6 py-4">
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
