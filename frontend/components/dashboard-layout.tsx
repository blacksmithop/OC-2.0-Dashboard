"use client"

import type React from "react"

import { Button } from "@/components/ui/button"

interface DashboardLayoutProps {
  children: React.ReactNode
  onLogout: () => void
  view: "members" | "crimes"
  onViewChange: (view: "members" | "crimes") => void
}

export default function DashboardLayout({ children, onLogout, view, onViewChange }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-secondary/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground font-sans">Faction Info</h1>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <Button
                variant={view === "members" ? "default" : "outline"}
                onClick={() => onViewChange("members")}
                className="font-sans"
              >
                Members
              </Button>
              <Button
                variant={view === "crimes" ? "default" : "outline"}
                onClick={() => onViewChange("crimes")}
                className="font-sans"
              >
                Crimes
              </Button>
            </div>
            <Button variant="outline" onClick={onLogout} className="font-sans bg-transparent">
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 flex-1">{children}</main>

      <footer className="border-t border-border bg-secondary/30 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            ©{" "}
            <a
              href="https://www.torn.com/profiles.php?XID=1712955"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-primary transition-colors"
            >
              oxiblurr [1712955]
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
