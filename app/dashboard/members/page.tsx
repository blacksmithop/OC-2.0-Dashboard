"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { RefreshCw, LogOut, MoreVertical, ArrowLeft, Info } from "lucide-react"
import MemberList from "@/components/member-list"
import { fetchAndCacheItems } from "@/lib/items-cache"

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

  useEffect(() => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (!apiKey) {
      router.push("/")
      return
    }

    loadHistoricalCrimes()

    fetchData(apiKey)
  }, [router])

  const handleApiError = async (response: Response, endpoint: string) => {
    try {
      const errorData = await response.json()
      if (errorData.error?.code === 2) {
        const scope = endpoint.includes("/faction/members")
          ? "members"
          : endpoint.includes("/faction/crimes")
            ? "crimes"
            : "unknown"
        throw new Error(`API key does not have access to ${scope}`)
      }
      throw new Error(errorData.error?.error || "API request failed")
    } catch (e) {
      if (e instanceof Error) throw e
      throw new Error("Failed to fetch data")
    }
  }

  const fetchData = async (apiKey: string) => {
    setIsLoading(true)

    try {
      await fetchAndCacheItems(apiKey)

      const membersRes = await fetch("https://api.torn.com/v2/faction/members?striptags=true", {
        headers: { Authorization: `ApiKey ${apiKey}`, accept: "application/json" },
      })

      if (!membersRes.ok) await handleApiError(membersRes, "/faction/members")
      const membersData = await membersRes.json()

      if (membersData.error) {
        if (membersData.error.code === 2) throw new Error("API key does not have access to members")
        throw new Error(membersData.error.error || "Failed to fetch members")
      }

      setMembers(Object.values(membersData.members || {}))

      const crimesRes = await fetch("https://api.torn.com/v2/faction/crimes?striptags=true", {
        headers: { Authorization: `ApiKey ${apiKey}`, accept: "application/json" },
      })

      if (!crimesRes.ok) await handleApiError(crimesRes, "/faction/crimes")
      const crimesData = await crimesRes.json()

      if (crimesData.error) {
        if (crimesData.error.code === 2) throw new Error("API key does not have access to crimes")
        throw new Error(crimesData.error.error || "Failed to fetch crimes")
      }

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
    localStorage.removeItem("factionApiKey")
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading members...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
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
                      handleRefresh()
                      setDropdownOpen(false)
                    }}
                    disabled={refreshing}
                    className="w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-accent transition-colors disabled:opacity-50 border-t border-border"
                  >
                    <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
                    {refreshing ? "Refreshing..." : "Refresh"}
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
