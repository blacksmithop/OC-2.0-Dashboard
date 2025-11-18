"use client"

import { useEffect, useState } from "react"
import { useRouter } from 'next/navigation'
import { useToast } from "@/hooks/use-toast"
import { LogOut, MoreVertical, ArrowLeft, Users, Award, TrendingUp, Calendar, Crown, RotateCcw } from 'lucide-react'
import { Card } from "@/components/ui/card"
import { ResetConfirmationDialog } from "@/components/reset-confirmation-dialog"
import { clearAllCache } from "@/lib/cache/cache-reset"
import { handleFullLogout } from "@/lib/logout-handler"
import { fetchAndCacheMembers } from "@/lib/cache/members-cache"
import { fetchAndCacheFactionBasic, type FactionBasic } from "@/lib/cache/faction-basic-cache"

interface Member {
  id: number
  name: string
}

export default function FactionPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [factionData, setFactionData] = useState<FactionBasic | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)

  useEffect(() => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (!apiKey) {
      router.push("/")
      return
    }

    fetchFactionData(apiKey)
  }, [router])

  const fetchFactionData = async (apiKey: string) => {
    setIsLoading(true)

    try {
      const basicData = await fetchAndCacheFactionBasic(apiKey)
      setFactionData(basicData)

      try {
        const membersData = await fetchAndCacheMembers(apiKey)
        setMembers(Array.from(membersData.values()).map(m => ({ id: m.id, name: m.name })))
      } catch (err) {
        console.error("[v0] Error loading members:", err)
      }

      if (!refreshing) {
        toast({
          title: "Success",
          description: "Faction data loaded successfully",
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load faction data"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
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

  const handleRefresh = async () => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (apiKey) {
      setRefreshing(true)
      await fetchFactionData(apiKey)
      setRefreshing(false)
      toast({
        title: "Success",
        description: "Data refreshed successfully",
      })
    }
  }

  const handleReset = async () => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (!apiKey) return

    setIsLoading(true)

    try {
      clearAllCache()

      setFactionData(null)
      setMembers([])

      await fetchFactionData(apiKey)

      toast({
        title: "Success",
        description: "Cache cleared and data refreshed from API",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to reset data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getLeaderName = () => {
    if (!factionData) return null
    const leader = members.find((m) => m.id === factionData.leader_id)
    return leader ? leader.name : null
  }

  const getCoLeaderName = () => {
    if (!factionData) return null
    const coLeader = members.find((m) => m.id === factionData.co_leader_id)
    return coLeader ? coLeader.name : null
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading faction data...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <ResetConfirmationDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen} onConfirm={handleReset} />

      <header className="flex-shrink-0 border-b border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="p-2 hover:bg-accent rounded-lg transition-colors border border-border"
              title="Back to Dashboard"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Faction Info</h1>
              <p className="text-sm text-muted-foreground">View faction details and statistics</p>
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
                      setDropdownOpen(false)
                      setResetDialogOpen(true)
                    }}
                    disabled={refreshing}
                    className="w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-accent transition-colors disabled:opacity-50"
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
        <div className="max-w-6xl mx-auto space-y-4">
          {factionData && (
            <>
              <Card className="bg-card border-border p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6 pb-6 border-b border-border">
                  <div className="flex items-center gap-4 flex-1">
                    <a
                      href={`https://www.torn.com/factions.php?step=profile&ID=${factionData.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0"
                    >
                      <img
                        src={`https://factiontags.torn.com/${factionData.tag_image}`}
                        alt={`${factionData.name} faction tag`}
                        className="w-16 h-16 object-contain border border-border rounded-lg bg-background hover:opacity-80 transition-opacity cursor-pointer"
                      />
                    </a>
                    <div className="flex-1 min-w-0">
                      <a
                        href={`https://www.torn.com/factions.php?step=profile&ID=${factionData.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-2xl font-bold text-foreground hover:text-primary transition-colors block truncate"
                      >
                        {factionData.name}
                      </a>
                      <a
                        href={`https://www.torn.com/factions.php?step=profile&ID=${factionData.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base text-muted-foreground hover:text-primary transition-colors inline-block"
                      >
                        [{factionData.tag}]
                      </a>
                      <p className="text-xs text-muted-foreground">ID: {factionData.id}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-lg border border-border">
                      <Crown size={14} className="text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Leader</p>
                        {getLeaderName() ? (
                          <a
                            href={`https://www.torn.com/profiles.php?XID=${factionData.leader_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-primary hover:underline truncate block"
                          >
                            {getLeaderName()} [{factionData.leader_id}]
                          </a>
                        ) : (
                          <p className="text-xs font-semibold text-foreground">ID: {factionData.leader_id}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-lg border border-border">
                      <Crown size={14} className="text-accent flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Co-Leader</p>
                        {getCoLeaderName() ? (
                          <a
                            href={`https://www.torn.com/profiles.php?XID=${factionData.co_leader_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-accent hover:underline truncate block"
                          >
                            {getCoLeaderName()} [{factionData.co_leader_id}]
                          </a>
                        ) : (
                          <p className="text-xs font-semibold text-foreground">ID: {factionData.co_leader_id}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-primary/20 p-1.5 rounded border border-primary/40">
                        <Users size={16} className="text-primary" />
                      </div>
                      <h3 className="text-xs font-semibold text-muted-foreground">Members</h3>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      {factionData.members} / {factionData.capacity}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round((factionData.members / factionData.capacity) * 100)}% capacity
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-accent/20 p-1.5 rounded border border-accent/40">
                        <Award size={16} className="text-accent" />
                      </div>
                      <h3 className="text-xs font-semibold text-muted-foreground">Respect</h3>
                    </div>
                    <p className="text-2xl font-bold text-accent">{factionData.respect.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total faction respect</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-chart-1/20 p-1.5 rounded border border-chart-1/40">
                        <TrendingUp size={16} className="text-chart-1" />
                      </div>
                      <h3 className="text-xs font-semibold text-muted-foreground">Best Chain</h3>
                    </div>
                    <p className="text-2xl font-bold text-chart-1">{factionData.best_chain.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Highest chain achieved</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-chart-2/20 p-1.5 rounded border border-chart-2/40">
                        <Calendar size={16} className="text-chart-2" />
                      </div>
                      <h3 className="text-xs font-semibold text-muted-foreground">Faction Age</h3>
                    </div>
                    <p className="text-2xl font-bold text-chart-2">{factionData.days_old.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Days old</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-chart-3/20 p-1.5 rounded border border-chart-3/40">
                        <Crown size={16} className="text-chart-3" />
                      </div>
                      <h3 className="text-xs font-semibold text-muted-foreground">Rank</h3>
                    </div>
                    <p className="text-2xl font-bold text-chart-3">
                      {factionData.rank.name} {['I', 'II', 'III', 'IV', 'V'][factionData.rank.division - 1] || factionData.rank.division}
                    </p>
                    <p className="text-xs text-muted-foreground">Level {factionData.rank.level}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-chart-4/20 p-1.5 rounded border border-chart-4/40">
                        <Award size={16} className="text-chart-4" />
                      </div>
                      <h3 className="text-xs font-semibold text-muted-foreground">Rank Wins</h3>
                    </div>
                    <p className="text-2xl font-bold text-chart-4">{factionData.rank.wins}</p>
                    <p className="text-xs text-muted-foreground">Territory wars won</p>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      </main>

      <footer className="flex-shrink-0 border-t border-border bg-card px-6 py-4 z-50">
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
