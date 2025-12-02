"use client"

import { useEffect, useState } from "react"
import { useRouter } from 'next/navigation'
import { useToast } from "@/hooks/use-toast"
import { LogOut, MoreVertical, ArrowLeft, Info, RotateCcw } from 'lucide-react'
import MemberList from "@/components/members/member-list"
import { fetchAndCacheItems } from "@/lib/cache/items-cache"
import { fetchAndCacheMembers } from "@/lib/cache/members-cache"
import { fetchAndCacheBalance } from "@/lib/cache/balance-cache"
import { handleApiError, validateApiResponse } from "@/lib/api-error-handler"
import { ResetConfirmationDialog } from "@/components/reset-confirmation-dialog"
import { clearAllCache } from "@/lib/cache/cache-reset"
import { handleFullLogout } from "@/lib/logout-handler"
import { canAccessBalance } from "@/lib/api-scopes"
import { fetchFFScouterStats } from "@/lib/integration/ffscouter"
import { fetchYataMembers, YataMemberData } from "@/lib/yata"

interface Member {
  id: number
  name: string
  level: number
  status: {
    description: string
    state: string
    color: string
  }
  position: string
  last_action: {
    status: string
    relative: string
    timestamp: number
  }
  days_in_faction: number
  money?: number
  bs_estimate_human?: string | null
  crimes_rank?: number
  nnb?: number
}

interface Crime {
  id: number
  name: string
  status: string
  slots: Array<{
    user: { id: number } | null
  }>
}

interface MemberFilters {
  crimeStatus: string
  activityRange: [number, number]
  levelRange: [number, number]
}

export default function MembersPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [members, setMembers] = useState<Member[]>([])
  const [crimes, setCrimes] = useState<Crime[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [historicalCrimes, setHistoricalCrimes] = useState<Crime[]>([])
  const [memberFilters, setMemberFilters] = useState<MemberFilters>({
    crimeStatus: "all",
    activityRange: [0, 7],
    levelRange: [1, 100],
  })
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [hasBalanceScope, setHasBalanceScope] = useState(false)
  const [factionBalance, setFactionBalance] = useState<number | null>(null)

  useEffect(() => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (!apiKey) {
      router.push("/")
      return
    }

    const hasBalance = canAccessBalance()
    setHasBalanceScope(hasBalance)

    loadHistoricalCrimes()

    fetchData(apiKey, hasBalance)
  }, [router])

  const fetchData = async (apiKey: string, hasBalance?: boolean) => {
    setIsLoading(true)

    const shouldFetchBalance = hasBalance !== undefined ? hasBalance : hasBalanceScope

    try {
      await fetchAndCacheItems(apiKey)

      let balanceData = null
      if (shouldFetchBalance) {
        balanceData = await fetchAndCacheBalance(apiKey)
        if (balanceData) {
          setFactionBalance(balanceData.total)
        }
      }

      const membersData = await fetchAndCacheMembers(apiKey)
      const membersArray = Array.from(membersData.values())
      
      if (balanceData?.members) {
        balanceData.members.forEach((balanceMember) => {
          const member = membersArray.find((m: any) => m.id === balanceMember.id)
          if (member) {
            (member as any).money = balanceMember.money
          }
        })
      }

      const memberIds = membersArray.map((m: any) => m.id)
      const ffScouterData = await fetchFFScouterStats(memberIds)
      
      membersArray.forEach((member: any) => {
        const statData = ffScouterData.get(member.id)
        if (statData && statData.bs_estimate_human) {
          member.bs_estimate_human = statData.bs_estimate_human
        }
      })

      const yataData = await fetchYataMembers(apiKey)
      membersArray.forEach((member: any) => {
        const yataMember = yataData.get(member.id)
        if (yataMember) {
          member.crimes_rank = yataMember.crimes_rank
          member.nnb = yataMember.nnb
        }
      })

      setMembers(membersArray)

      const crimesRes = await fetch("https://api.torn.com/v2/faction/crimes?striptags=true&comment=oc_dashboard_crimes", {
        headers: { Authorization: `ApiKey ${apiKey}`, accept: "application/json" },
      })

      if (!crimesRes.ok) {
        await handleApiError(crimesRes, "/faction/crimes")
      }

      const crimesData = await crimesRes.json()
      validateApiResponse(crimesData, "/faction/crimes")

      const currentCrimes = Object.values(crimesData.crimes || {})
      const crimeMap = new Map<number, Crime>()

      historicalCrimes.forEach((crime) => {
        crimeMap.set(crime.id, crime)
      })

      currentCrimes.forEach((crime) => {
        crimeMap.set(crime.id, crime)
      })

      const allCrimes = Array.from(crimeMap.values())
      setCrimes(allCrimes)

      if (!refreshing) {
        toast({
          title: "Success",
          description: `Members data loaded successfully (${allCrimes.length} total crimes)`,
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load data"
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
    setTimeout(() => router.push("/"), 500)
  }

  const handleRefresh = async () => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (apiKey) {
      setRefreshing(true)
      await fetchData(apiKey)
      setRefreshing(false)
      toast({
        title: "Success",
        description: "Data refreshed successfully",
      })
    }
  }

  const handleResetFilters = () => {
    setMemberFilters({
      crimeStatus: "all",
      activityRange: [0, 7],
      levelRange: [1, 100],
    })
    toast({
      title: "Success",
      description: "All filters reset",
    })
  }

  const handleFilterByCrime = (memberId: number) => {
    const member = members.find((m) => m.id === memberId)
    if (member) {
      router.push(`/dashboard/crimes?member=${memberId}`)
      toast({
        title: "Success",
        description: `Filtering crimes for ${member.name}`,
      })
    }
  }

  const loadHistoricalCrimes = () => {
    const cached = localStorage.getItem("factionHistoricalCrimes")
    if (cached) {
      try {
        const data = JSON.parse(cached)
        setHistoricalCrimes(data)
        console.log(`[v0] Loaded ${data.length} historical crimes for members page`)
      } catch (e) {
        console.error("[v0] Failed to parse historical crimes:", e)
      }
    }
  }

  const activeRecruitingCrimes = crimes.filter((crime) => crime.status === "Recruiting" || crime.status === "Planning")

  const handleReset = async () => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (!apiKey) return

    setIsLoading(true)

    try {
      clearAllCache()

      setHistoricalCrimes([])
      setCrimes([])
      setMembers([])

      await fetchData(apiKey)

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading members...</div>
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
              <button onClick={() => router.push("/dashboard")} className="hover:opacity-80 transition-opacity">
                <h1 className="text-3xl font-bold text-foreground">Members</h1>
              </button>
              <p className="text-muted-foreground mt-1">Faction member management</p>
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

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {hasBalanceScope && factionBalance !== null && (
            <div className="bg-card border-2 border-border rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Faction Balance</span>
                </div>
                <div className="text-2xl font-bold text-green-400">
                  ${new Intl.NumberFormat().format(factionBalance)}
                </div>
              </div>
            </div>
          )}
          <MemberList
            members={members}
            crimes={activeRecruitingCrimes}
            allCrimes={crimes}
            filters={memberFilters}
            onFiltersChange={setMemberFilters}
            onResetFilters={handleResetFilters}
            onFilterByCrime={handleFilterByCrime}
          />
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
