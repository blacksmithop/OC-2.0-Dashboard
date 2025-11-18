"use client"

import { useRouter } from 'next/navigation'
import { ArrowLeft, MoreVertical, Info, LogOut, Trash2 } from 'lucide-react'
import { useState } from "react"

interface ArmoryHeaderProps {
  onLogout: () => void
  onClearCache?: () => void
}

export default function ArmoryHeader({ onLogout, onClearCache }: ArmoryHeaderProps) {
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
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
                {onClearCache && (
                  <button
                    onClick={() => {
                      onClearCache()
                      setDropdownOpen(false)
                    }}
                    className="w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-accent transition-colors border-t border-border"
                  >
                    <Trash2 size={18} />
                    Clear Cache
                  </button>
                )}
                <button
                  onClick={() => {
                    onLogout()
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
