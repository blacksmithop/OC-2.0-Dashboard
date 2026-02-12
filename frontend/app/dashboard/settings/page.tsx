"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Puzzle, Database } from "lucide-react"
import { apiKeyManager } from "@/lib/auth/api-key-manager"

const sections = [
  {
    title: "Integrations",
    description: "Manage third-party API connections and validate keys",
    icon: Puzzle,
    href: "/dashboard/settings/integrations",
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
    borderColor: "border-cyan-400/20",
  },
  {
    title: "Manage Data",
    description: "View and manage cached data, clear storage, and export",
    icon: Database,
    href: "/dashboard/settings/manage-data",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    borderColor: "border-amber-400/20",
  },
]

export default function SettingsPage() {
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const apiKey = await apiKeyManager.getApiKey()
      if (!apiKey) {
        router.push("/")
      }
    }
    checkAuth()
  }, [router])

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="flex-shrink-0 border-b border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 hover:bg-accent rounded-lg transition-colors border border-border"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure integrations and manage application data
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <div className="grid gap-4">
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <button
                  key={section.title}
                  onClick={() => router.push(section.href)}
                  className={`flex items-center gap-5 p-5 rounded-lg border ${section.borderColor} ${section.bgColor} hover:brightness-110 transition-all text-left group`}
                >
                  <div className={`p-3 rounded-lg border ${section.borderColor} bg-background/50`}>
                    <Icon size={24} className={section.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-foreground group-hover:text-foreground/90">
                      {section.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>
                  </div>
                  <ArrowLeft size={20} className="text-muted-foreground rotate-180 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
