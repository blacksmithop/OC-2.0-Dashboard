"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreVertical, RefreshCw, LogOut, Info, RotateCcw, Settings } from "lucide-react"
import { handleFullLogout } from "@/lib/logout-handler"
import { useToast } from "@/hooks/use-toast"

interface DashboardHeaderProps {
  isFetchingHistorical: boolean
  historicalProgress: { current: number; total: number }
  refreshing: boolean
  onReset: () => void
  resetDialogOpen: boolean
  onResetDialogChange: (open: boolean) => void
}

export function DashboardHeader({
  isFetchingHistorical,
  historicalProgress,
  refreshing,
  onReset,
  resetDialogOpen,
  onResetDialogChange,
}: DashboardHeaderProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [dropdownOpen, setDropdownOpen] = useState(false)

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

  return (
    <header className="flex-shrink-0 border-b border-border bg-card p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <button onClick={() => router.push("/dashboard")} className="hover:opacity-80 transition-opacity">
            <h1 className="text-3xl font-bold text-foreground">Faction Crimes</h1>
          </button>
          <p className="text-muted-foreground mt-1">View and manage faction operations</p>
          {isFetchingHistorical && (
            <p className="text-xs text-cyan-400 mt-1 flex items-center gap-2">
              <RefreshCw size={12} className="animate-spin" />
              Fetching historical data... {historicalProgress.current.toLocaleString()} crimes loaded
            </p>
          )}
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
                    router.push("/dashboard/settings")
                    setDropdownOpen(false)
                  }}
                  className="w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-accent transition-colors border-t border-border"
                >
                  <Settings size={18} />
                  Settings
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    onResetDialogChange(true)
                  }}
                  disabled={refreshing}
                  className="w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-accent transition-colors disabled:opacity-50 border-t border-border"
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
  )
}
