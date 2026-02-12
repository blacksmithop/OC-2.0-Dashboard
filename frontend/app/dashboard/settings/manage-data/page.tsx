"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Database,
  RefreshCw,
  Trash2,
  Download,
  HardDrive,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plug,
  AlertTriangle,
  Bug,
} from "lucide-react"
import { getErrorLog, clearErrorLog, exportErrorLog, type ErrorLogEntry } from "@/lib/logging/error-logger"
import { apiKeyManager } from "@/lib/auth/api-key-manager"
import { db, STORES } from "@/lib/db/indexeddb"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
function getRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Known data items definition - only items that actually exist in IndexedDB
interface DataItemDef {
  key: string
  label: string
  description: string
  category: "general" | "cache" | "integrations"
  store: string // which IDB store it lives in
  relatedKeys?: string[] // related timestamp/expiry keys to clean up together
  isDynamic?: boolean // prefix-based entries
  dynamicPrefix?: string
}

const DATA_ITEMS: DataItemDef[] = [
  // General Data (core app data)
  {
    key: "factionBasicCache",
    label: "Faction Basic Info",
    description: "Faction name, tag, rank, capacity",
    category: "general",
    store: STORES.CACHE,
    relatedKeys: ["factionBasic", "factionId", "factionName"],
  },
  {
    key: "factionMembersCache",
    label: "Faction Members",
    description: "Member names, levels, positions, status",
    category: "general",
    store: STORES.CACHE,
    relatedKeys: ["factionMembersCacheExpiry"],
  },
  {
    key: "factionBalance",
    label: "Faction Balance",
    description: "Faction balance and member contributions",
    category: "general",
    store: STORES.CACHE,
    relatedKeys: ["factionBalanceTimestamp"],
  },
  {
    key: "tornItemsCache",
    label: "Torn Items",
    description: "Item database (names, images, types)",
    category: "general",
    store: STORES.CACHE,
    relatedKeys: ["tornItemsCacheExpiry"],
  },
  {
    key: "factionCrimeNews",
    label: "Crime News",
    description: "Recent faction crime news feed",
    category: "general",
    store: STORES.CACHE,
    relatedKeys: ["factionCrimeNewsTimestamp"],
  },
  {
    key: "factionFundsNews",
    label: "Funds News",
    description: "Faction funds transaction logs",
    category: "general",
    store: STORES.CACHE,
  },
  {
    key: "scopeUsage",
    label: "Scope Usage",
    description: "API scope usage tracking data",
    category: "general",
    store: STORES.CACHE,
  },

  // Cached Data (derived/historical)
  {
    key: "factionHistoricalCrimes",
    label: "Historical Crimes",
    description: "Archived crime records for analysis",
    category: "cache",
    store: STORES.CACHE,
    relatedKeys: ["lastHistoricalFetch"],
  },
  {
    key: "crime_api_cache_",
    label: "Crime API Cache",
    description: "Cached API responses for crime data",
    category: "cache",
    store: STORES.CACHE,
    isDynamic: true,
    dynamicPrefix: "crime_api_cache_",
  },
  {
    key: "armoryNews",
    label: "Armory News",
    description: "Armory loan/return activity log",
    category: "cache",
    store: STORES.CACHE,
    relatedKeys: ["armoryMaxFetch"],
  },
  {
    key: "aggregatedCPRData",
    label: "CPR Data (Aggregated)",
    description: "Checkpoint Pass Rate data from crimes",
    category: "cache",
    store: STORES.CACHE,
    relatedKeys: ["aggregatedCPRTimestamp"],
  },
  {
    key: "roleWeights",
    label: "Role Weights",
    description: "Crime role weight data from probability API",
    category: "cache",
    store: STORES.CACHE,
    relatedKeys: ["roleWeightsTimestamp"],
  },

  // Integration Data
  {
    key: "tornStatsCPRData",
    label: "TornStats CPR",
    description: "CPR data fetched from TornStats API",
    category: "integrations",
    store: STORES.CACHE,
    relatedKeys: ["tornStatsCPRTimestamp"],
  },

  // Settings stored in SETTINGS store
  {
    key: "minCPRSettings",
    label: "Min CPR Settings",
    description: "Per-role minimum CPR thresholds",
    category: "cache",
    store: STORES.SETTINGS,
  },
  {
    key: "crimesDateRange",
    label: "Crimes Date Range",
    description: "Selected date range filter for crimes",
    category: "cache",
    store: STORES.SETTINGS,
  },
  {
    key: "apiScopes",
    label: "API Scopes",
    description: "Available API scope permissions",
    category: "general",
    store: STORES.SETTINGS,
  },
]

// Set of keys we intentionally exclude from display (internal/sensitive)
const EXCLUDED_KEYS = new Set([
  "thirdPartySettings",
  "FFSCOUTER_API_KEY",
  "TORN_STATS_API_KEY",
  "YATA_API_KEY",
  "torn_api_key", // API_KEYS store
])

interface DataItemState {
  key: string
  def: DataItemDef
  loaded: boolean
  entryCount: number
  sizeEstimate: string
  rawValue: any
}

function estimateSize(value: any): string {
  try {
    const json = JSON.stringify(value)
    const bytes = new Blob([json]).size
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  } catch {
    return "unknown"
  }
}

function countEntries(value: any): number {
  if (value === null || value === undefined) return 0
  if (Array.isArray(value)) return value.length
  if (value instanceof Map) return value.size
  if (typeof value === "object") {
    if (value.data && typeof value.data === "object") {
      return Array.isArray(value.data) ? value.data.length : Object.keys(value.data).length
    }
    if (value.crimes && typeof value.crimes === "object") {
      return Object.keys(value.crimes).length
    }
    return Object.keys(value).length
  }
  return 1
}

export default function ManageDataPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [dataItems, setDataItems] = useState<DataItemState[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    general: true,
    cache: true,
    integrations: true,
    errorLog: true,
  })
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [errorLogEntries, setErrorLogEntries] = useState<ErrorLogEntry[]>([])
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())

  const loadDataItems = useCallback(async () => {
    setLoading(true)
    try {
      // Get all entries from all stores
      const cacheEntries = await db.getAll(STORES.CACHE)
      const settingsEntries = await db.getAll(STORES.SETTINGS)

      // Build lookup maps: key -> entry
      const cacheByKey = new Map<string, any>()
      for (const entry of cacheEntries) {
        cacheByKey.set(entry.key, entry)
      }
      const settingsByKey = new Map<string, any>()
      for (const entry of settingsEntries) {
        settingsByKey.set(entry.key, entry)
      }

      const items: DataItemState[] = []

      for (const def of DATA_ITEMS) {
        if (def.isDynamic && def.dynamicPrefix) {
          // Count all entries matching this prefix
          const matchingEntries = cacheEntries.filter((e) => e.key.startsWith(def.dynamicPrefix!))

          // Only add if there are matching entries
          if (matchingEntries.length === 0) continue

          const totalSize = matchingEntries.reduce((acc, e) => {
            try {
              return acc + new Blob([JSON.stringify(e.value)]).size
            } catch {
              return acc
            }
          }, 0)

          items.push({
            key: def.key,
            def,
            loaded: true,
            entryCount: matchingEntries.length,
            sizeEstimate:
              totalSize < 1024
                ? `${totalSize} B`
                : totalSize < 1024 * 1024
                  ? `${(totalSize / 1024).toFixed(1)} KB`
                  : `${(totalSize / (1024 * 1024)).toFixed(2)} MB`,
            rawValue: matchingEntries.map((e) => ({ key: e.key, value: e.value })),
          })
        } else {
          // Look in the appropriate store
          const lookup = def.store === STORES.SETTINGS ? settingsByKey : cacheByKey
          const entry = lookup.get(def.key)
          const value = entry?.value ?? null

          // Skip items that are not loaded
          if (value === null || value === undefined) continue

          items.push({
            key: def.key,
            def,
            loaded: true,
            entryCount: countEntries(value),
            sizeEstimate: estimateSize(value),
            rawValue: value,
          })
        }
      }

      setDataItems(items)

      // Load error log
      const errors = await getErrorLog()
      setErrorLogEntries(errors)
    } catch (error) {
      console.error("Error loading data items:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      const apiKey = await apiKeyManager.getApiKey()
      if (!apiKey) {
        router.push("/")
        return
      }
      loadDataItems()
    }
    checkAuth()
  }, [router, loadDataItems])

  const handleExport = useCallback(
    async (item: DataItemState) => {
      setActionInProgress(`export-${item.key}`)
      try {
        const exportData = {
          key: item.key,
          label: item.def.label,
          exportedAt: new Date().toISOString(),
          data: item.rawValue,
        }
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json",
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${item.key.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`
        a.click()
        URL.revokeObjectURL(url)
        toast({ title: "Exported", description: `${item.def.label} exported as JSON.` })
      } catch {
        toast({ title: "Export Failed", description: `Could not export ${item.def.label}.`, variant: "destructive" })
      } finally {
        setActionInProgress(null)
      }
    },
    [toast],
  )

  const handleDelete = useCallback(
    async (item: DataItemState) => {
      setActionInProgress(`delete-${item.key}`)
      try {
        if (item.def.isDynamic && item.def.dynamicPrefix) {
          await db.deleteByPrefix(item.def.store, item.def.dynamicPrefix)
        } else {
          await db.delete(item.def.store, item.key)
          if (item.def.relatedKeys) {
            for (const rk of item.def.relatedKeys) {
              await db.delete(item.def.store, rk)
              // Also try CACHE store for related keys
              await db.delete(STORES.CACHE, rk)
            }
          }
        }
        toast({ title: "Deleted", description: `${item.def.label} deleted. It will reload when needed.` })
        loadDataItems()
      } catch {
        toast({ title: "Delete Failed", description: `Could not delete ${item.def.label}.`, variant: "destructive" })
      } finally {
        setActionInProgress(null)
      }
    },
    [toast, loadDataItems],
  )

  const handleExportAll = useCallback(async () => {
    setActionInProgress("export-all")
    try {
      const cacheEntries = await db.getAll(STORES.CACHE)
      const settingsEntries = await db.getAll(STORES.SETTINGS)

      // Filter out sensitive keys
      const filteredCache = cacheEntries.filter((e) => !EXCLUDED_KEYS.has(e.key))
      const filteredSettings = settingsEntries.filter((e) => !EXCLUDED_KEYS.has(e.key))

      const errorLog = await exportErrorLog()

      const exportData = {
        exportedAt: new Date().toISOString(),
        stores: {
          cache: Object.fromEntries(filteredCache.map((e) => [e.key, e.value])),
          settings: Object.fromEntries(filteredSettings.map((e) => [e.key, e.value])),
        },
        errorLog,
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `oc_dashboard_full_export_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "Full Export Complete", description: "All data exported as JSON." })
    } catch {
      toast({ title: "Export Failed", variant: "destructive" })
    } finally {
      setActionInProgress(null)
    }
  }, [toast])

  const handleExportErrorLog = useCallback(async () => {
    setActionInProgress("export-errors")
    try {
      const data = await exportErrorLog()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `error_log_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "Exported", description: "Error log exported as JSON." })
    } catch {
      toast({ title: "Export Failed", variant: "destructive" })
    } finally {
      setActionInProgress(null)
    }
  }, [toast])

  const handleClearErrorLog = useCallback(async () => {
    setActionInProgress("clear-errors")
    try {
      await clearErrorLog()
      setErrorLogEntries([])
      setExpandedErrors(new Set())
      toast({ title: "Cleared", description: "Error log cleared." })
    } catch {
      toast({ title: "Clear Failed", variant: "destructive" })
    } finally {
      setActionInProgress(null)
    }
  }, [toast])

  const toggleErrorExpanded = useCallback((id: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }))
  }

  const categories = [
    { id: "general", label: "General Data", icon: Database },
    { id: "cache", label: "Cached Data", icon: HardDrive },
    { id: "integrations", label: "Integration Data", icon: Plug },
  ] as const

  const totalLoaded = dataItems.length

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="flex-shrink-0 border-b border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard/settings")}
            className="p-2 hover:bg-accent rounded-lg transition-colors border border-border"
            title="Back to Settings"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Database size={24} className="text-primary" />
              Manage Data
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Load, update, delete, export logs and related data
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDataItems}
              disabled={loading}
              className="gap-1.5 bg-transparent"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAll}
              disabled={actionInProgress === "export-all"}
              className="gap-1.5 bg-transparent"
            >
              <Download size={14} />
              Export All
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Summary Bar */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground bg-card border border-border rounded-lg px-4 py-3">
            <span>
              <span className="text-green-400 font-semibold">{totalLoaded}</span> data stores loaded
            </span>
            {errorLogEntries.length > 0 && (
              <>
                <span className="text-muted-foreground/50">|</span>
                <span>
                  <span className="text-red-400 font-semibold">{errorLogEntries.length}</span> logged {errorLogEntries.length === 1 ? "error" : "errors"}
                </span>
              </>
            )}
            <span className="text-muted-foreground/50">|</span>
            <span className="text-xs">
              Only cached data is shown. Data will reload automatically when you visit the relevant page.
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : (
            <>
              {categories.map((cat) => {
                const Icon = cat.icon
                const catItems = dataItems.filter((d) => d.def.category === cat.id)

                if (catItems.length === 0) return null

                const expanded = expandedCategories[cat.id]

                return (
                  <section key={cat.id} className="bg-card border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-accent/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={20} className="text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">{cat.label}</h2>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {catItems.length} {catItems.length === 1 ? "item" : "items"}
                        </span>
                      </div>
                      {expanded ? (
                        <ChevronUp size={18} className="text-muted-foreground" />
                      ) : (
                        <ChevronDown size={18} className="text-muted-foreground" />
                      )}
                    </button>

                    {expanded && (
                      <div className="border-t border-border divide-y divide-border/50">
                        {catItems.map((item) => (
                          <DataRow
                            key={item.key}
                            item={item}
                            actionInProgress={actionInProgress}
                            onExport={() => handleExport(item)}
                            onDelete={() => handleDelete(item)}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )
              })}

              {/* Error Log Section - always visible */}
              <section className="bg-card border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory("errorLog")}
                  className="w-full flex items-center justify-between p-4 hover:bg-accent/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Bug size={20} className={errorLogEntries.length > 0 ? "text-red-400" : "text-muted-foreground"} />
                    <h2 className="text-lg font-semibold text-foreground">Error Log</h2>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      errorLogEntries.length > 0
                        ? "text-red-400 bg-red-500/10"
                        : "text-muted-foreground bg-muted"
                    }`}>
                      {errorLogEntries.length} {errorLogEntries.length === 1 ? "entry" : "entries"} (max 200)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {errorLogEntries.length > 0 && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleExportErrorLog()
                          }}
                          disabled={actionInProgress === "export-errors"}
                          className="gap-1.5 bg-transparent h-7 text-xs"
                        >
                          <Download size={12} />
                          Export JSON
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleClearErrorLog()
                          }}
                          disabled={actionInProgress === "clear-errors"}
                          className="gap-1.5 bg-transparent h-7 text-xs text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-500/50"
                        >
                          <Trash2 size={12} />
                          Clear
                        </Button>
                      </>
                    )}
                    {expandedCategories.errorLog ? (
                      <ChevronUp size={18} className="text-muted-foreground" />
                    ) : (
                      <ChevronDown size={18} className="text-muted-foreground" />
                    )}
                  </div>
                </button>

                {expandedCategories.errorLog && (
                  <div className="border-t border-border">
                    {errorLogEntries.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <CheckCircle2 size={24} className="mx-auto mb-2 text-green-400/60" />
                        <p className="text-sm text-muted-foreground">No errors logged</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Errors from API calls, cache operations, and unhandled exceptions are captured here automatically.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto">
                        {errorLogEntries.map((entry) => {
                          const isExpanded = expandedErrors.has(entry.id)
                          const date = new Date(entry.timestamp)
                          const timeStr = date.toLocaleString()
                          const relativeTime = getRelativeTime(entry.timestamp)
                          const severityColor =
                            entry.severity === "error"
                              ? "text-red-400"
                              : entry.severity === "warn"
                                ? "text-yellow-400"
                                : "text-blue-400"
                          const severityBg =
                            entry.severity === "error"
                              ? "bg-red-500/10"
                              : entry.severity === "warn"
                                ? "bg-yellow-500/10"
                                : "bg-blue-500/10"

                          return (
                            <div key={entry.id} className="hover:bg-accent/10 transition-colors">
                              <button
                                onClick={() => toggleErrorExpanded(entry.id)}
                                className="w-full flex items-start gap-3 px-4 py-3 text-left"
                              >
                                <AlertTriangle size={14} className={`${severityColor} mt-0.5 shrink-0`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded uppercase ${severityColor} ${severityBg}`}>
                                      {entry.severity}
                                    </span>
                                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                                      {entry.source}
                                    </span>
                                    <span className="text-xs text-muted-foreground" title={timeStr}>
                                      {relativeTime}
                                    </span>
                                  </div>
                                  <p className="text-sm text-foreground mt-1 truncate">{entry.message}</p>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp size={14} className="text-muted-foreground mt-1 shrink-0" />
                                ) : (
                                  <ChevronDown size={14} className="text-muted-foreground mt-1 shrink-0" />
                                )}
                              </button>

                              {isExpanded && (
                                <div className="px-4 pb-3 ml-8 space-y-2">
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">Time:</span> {timeStr}
                                  </div>
                                  {entry.url && (
                                    <div className="text-xs text-muted-foreground">
                                      <span className="font-medium text-foreground">Page:</span> {entry.url}
                                    </div>
                                  )}
                                  {entry.context && Object.keys(entry.context).length > 0 && (
                                    <div>
                                      <span className="text-xs font-medium text-foreground">Context:</span>
                                      <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-1 overflow-x-auto max-w-full">
                                        {JSON.stringify(entry.context, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {entry.stack && (
                                    <div>
                                      <span className="text-xs font-medium text-foreground">Stack Trace:</span>
                                      <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-1 overflow-x-auto max-w-full whitespace-pre-wrap break-all">
                                        {entry.stack}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {dataItems.length === 0 && errorLogEntries.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Database size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No cached data found</p>
                  <p className="text-sm mt-1">Visit the dashboard pages to start loading data.</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function DataRow({
  item,
  actionInProgress,
  onExport,
  onDelete,
}: {
  item: DataItemState
  actionInProgress: string | null
  onExport: () => void
  onDelete: () => void
}) {
  const isExporting = actionInProgress === `export-${item.key}`
  const isDeleting = actionInProgress === `delete-${item.key}`

  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4 hover:bg-accent/10 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{item.def.label}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{item.def.description}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Status */}
        <div className="flex items-center gap-1.5 min-w-[140px] justify-end">
          <CheckCircle2 size={14} className="text-green-400" />
          <span className="text-xs text-green-400 font-medium">Loaded</span>
          {item.entryCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {item.entryCount.toLocaleString()} {item.entryCount === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>

        {/* Size */}
        <span className="text-xs text-muted-foreground min-w-[60px] text-right">{item.sizeEstimate}</span>

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onExport}
            disabled={isExporting}
            className="p-1.5 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            title="Export as JSON"
          >
            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-1.5 hover:bg-red-500/20 rounded transition-colors text-muted-foreground hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Delete (will reload when needed)"
          >
            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}
