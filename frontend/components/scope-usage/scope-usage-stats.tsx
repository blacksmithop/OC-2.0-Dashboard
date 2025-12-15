"use client"

import { RefreshCw, Settings, Telescope } from "lucide-react"

interface ScopeUsageStatsProps {
  totalLogs: number
  maxFetchCount: number
  isFetching: boolean
  fetchProgress: { current: number; max: number }
  onFetch: () => void
  onConfigClick: () => void
}

export default function ScopeUsageStats({
  totalLogs,
  maxFetchCount,
  isFetching,
  fetchProgress,
  onFetch,
  onConfigClick,
}: ScopeUsageStatsProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-bold text-foreground">Scope Usage Logs</h2>
            <button
              onClick={onConfigClick}
              className="p-1.5 hover:bg-accent rounded-lg transition-colors"
              title="Configure max fetch count"
            >
              <Settings size={18} className="text-muted-foreground hover:text-foreground" />
            </button>
          </div>
          <div className="flex items-baseline gap-3">
            <div>
              <div className="text-4xl font-bold text-primary">{totalLogs.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Loaded</div>
            </div>
            <div className="text-2xl text-muted-foreground">/</div>
            <div>
              <div className="text-2xl font-semibold text-muted-foreground">{maxFetchCount.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Max Fetch</div>
            </div>
          </div>
        </div>
        <button
          onClick={onFetch}
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
              <Telescope size={20} />
              Fetch Historical Data
            </>
          )}
        </button>
      </div>
    </div>
  )
}
