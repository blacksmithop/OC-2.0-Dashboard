"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Target, RefreshCw, Users, ChevronDown, ChevronUp, Database, ExternalLink, X, ArrowUpDown, Settings, ChevronLeft, ChevronRight, UserCheck } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { apiKeyManager } from "@/lib/auth/api-key-manager"
import { thirdPartySettingsManager } from "@/lib/settings/third-party-manager"
import { getTornStatsCPRData, type TornStatsCPRData } from "@/lib/integration/cpr-tracker"
import { fetchAndCacheMembers, getCachedMembers } from "@/lib/cache/members-cache"
import { db, STORES } from "@/lib/db/indexeddb"
import { Button } from "@/components/ui/button"
import type { Crime, Member } from "@/types/crime"
import {
  extractCPRFromAllCrimes,
  extractCPRFromTornStats,
  mergeCPRData,
  saveCPRData,
  DEFAULT_MIN_CPR,
  type AggregatedCPRData,
  type MemberCPREntry,
} from "@/lib/crimes/cpr-aggregator"

interface MinCPRSettings {
  [crimeName: string]: {
    [roleName: string]: number
  }
}

export default function CPRDashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const [cprData, setCprData] = useState<AggregatedCPRData | null>(null)
  const [members, setMembers] = useState<Map<number, Member>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [expandedCrimes, setExpandedCrimes] = useState<Set<string>>(new Set())
  const [minCPRSettings, setMinCPRSettings] = useState<MinCPRSettings>({})
  const [hasTornStats, setHasTornStats] = useState(false)
  const [dataStats, setDataStats] = useState({ fromCrimes: 0, fromTornStats: 0 })
  const [currentPage, setCurrentPage] = useState<Record<string, number>>({})
  const [sortColumn, setSortColumn] = useState<Record<string, string | null>>({})
  const [sortDirection, setSortDirection] = useState<Record<string, "asc" | "desc">>({})
  const [membersInOC, setMembersInOC] = useState<Set<number>>(new Set())
  const ITEMS_PER_PAGE = 10

  const loadCPRData = async (forceRefresh = false) => {
    const apiKey = await apiKeyManager.getApiKey()
    if (!apiKey) return

    // Load members
    let membersData = getCachedMembers()
    if (!membersData || membersData.size === 0) {
      membersData = await fetchAndCacheMembers(apiKey)
    }
    setMembers(membersData)

    const memberNames = new Map<number, string>()
    for (const [id, member] of membersData) {
      memberNames.set(id, member.name)
    }

    // Load crimes from cache - use the correct cache key "factionHistoricalCrimes"
    const historicalCrimes = await db.get<Crime[]>(STORES.CACHE, "factionHistoricalCrimes")
    const allCrimes = historicalCrimes || []

    // Deduplicate crimes by ID
    const crimesMap = new Map<number, Crime>()
    for (const crime of allCrimes) {
      crimesMap.set(crime.id, crime)
    }
    const crimes = Array.from(crimesMap.values())

    // Find members currently in active OCs (Planning or Recruiting)
    const inOCSet = new Set<number>()
    for (const crime of crimes) {
      if (crime.status === "Planning" || crime.status === "Recruiting") {
        for (const slot of crime.slots) {
          if (slot.user?.id) {
            inOCSet.add(slot.user.id)
          }
        }
      }
    }
    setMembersInOC(inOCSet)

    // Extract CPR from ALL crimes with CPR data
    const crimesCPR = extractCPRFromAllCrimes(crimes, memberNames)

    let crimeStats = 0
    for (const crime of crimesCPR.crimes.values()) {
      for (const role of crime.roles.values()) {
        crimeStats += role.entries.length
      }
    }

    // Check for TornStats data
    const settings = await thirdPartySettingsManager.getSettings()
    let tornStatsData: TornStatsCPRData | null = null
    let tornStatsStats = 0

    if (settings.tornStats?.enabled && settings.tornStats?.apiKey) {
      setHasTornStats(true)
      tornStatsData = await getTornStatsCPRData(settings.tornStats.apiKey, forceRefresh)
      
      if (tornStatsData) {
        const tornStatsCPR = extractCPRFromTornStats(tornStatsData, memberNames)
        for (const crime of tornStatsCPR.crimes.values()) {
          for (const role of crime.roles.values()) {
            tornStatsStats += role.entries.length
          }
        }

        // Merge crime data with TornStats (TornStats supplements crime data)
        const merged = mergeCPRData(crimesCPR, tornStatsCPR)
        setCprData(merged)
        await saveCPRData(merged)
      } else {
        // No TornStats data, just use crime data
        setCprData(crimesCPR)
      }
    } else {
      setHasTornStats(false)
      // No TornStats, just use crime data
      setCprData(crimesCPR)
    }

    setDataStats({ fromCrimes: crimeStats, fromTornStats: tornStatsStats })
  }

  useEffect(() => {
    const initialize = async () => {
      const apiKey = await apiKeyManager.getApiKey()
      if (!apiKey) {
        router.push("/")
        return
      }

      // Load saved min CPR settings
      const savedMinCPR = await db.get<MinCPRSettings>(STORES.SETTINGS, "minCPRSettings")
      if (savedMinCPR) {
        setMinCPRSettings(savedMinCPR)
      }

      await loadCPRData()
      setIsLoading(false)
    }

    initialize()
  }, [router])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadCPRData(true)
    toast({
      title: "Refreshed",
      description: "CPR data refreshed from all sources",
    })
    setIsRefreshing(false)
  }

  const handleMinCPRChange = async (crimeName: string, roleName: string, value: number) => {
    const newSettings = { ...minCPRSettings }
    if (!newSettings[crimeName]) {
      newSettings[crimeName] = {}
    }
    newSettings[crimeName][roleName] = value
    setMinCPRSettings(newSettings)
    await db.set(STORES.SETTINGS, "minCPRSettings", newSettings)
  }

  const getMinCPR = (crimeName: string, roleName: string): number => {
    return minCPRSettings[crimeName]?.[roleName] ?? DEFAULT_MIN_CPR
  }

  const toggleCrimeExpanded = (crimeName: string) => {
    const newExpanded = new Set(expandedCrimes)
    if (newExpanded.has(crimeName)) {
      newExpanded.delete(crimeName)
    } else {
      newExpanded.add(crimeName)
    }
    setExpandedCrimes(newExpanded)
  }

  // Process CPR data into sorted array
  const crimeRoleCPRData = useMemo(() => {
    if (!cprData) return []

    const result: { crimeName: string; roles: { roleName: string; entries: MemberCPREntry[] }[] }[] = []

    for (const [crimeName, crimeData] of cprData.crimes) {
      const roles: { roleName: string; entries: MemberCPREntry[] }[] = []
      
      for (const [roleName, roleData] of crimeData.roles) {
        roles.push({
          roleName,
          entries: roleData.entries
        })
      }
      
      // Sort roles alphabetically
      roles.sort((a, b) => a.roleName.localeCompare(b.roleName))
      
      result.push({ crimeName, roles })
    }

    // Sort crimes alphabetically
    result.sort((a, b) => a.crimeName.localeCompare(b.crimeName))

    return result
  }, [cprData])

  const getCPRColor = (cpr: number, minCPR: number): string => {
    if (cpr >= 90) return "text-green-400 bg-green-500/20 border-green-500/40"
    if (cpr >= minCPR) return "text-yellow-400 bg-yellow-500/20 border-yellow-500/40"
    return "text-red-400 bg-red-500/20 border-red-500/40"
  }

  const getCPRHeaderColor = (avgCPR: number, minCPR: number): string => {
    if (avgCPR >= 90) return "bg-green-500/10 border-green-500/30"
    if (avgCPR >= minCPR) return "bg-yellow-500/10 border-yellow-500/30"
    return "bg-red-500/10 border-red-500/30"
  }

  // Get all unique members for a crime across all roles, with sorting support
  const getUniqueMembersForCrime = (
    crimeName: string,
    roles: { roleName: string; entries: MemberCPREntry[] }[]
  ) => {
    const memberIds = new Set<number>()
    const memberMap = new Map<number, string>()
    const memberCPRs = new Map<number, Map<string, number>>() // memberId -> role -> cpr
    
    for (const role of roles) {
      for (const entry of role.entries) {
        memberIds.add(entry.memberId)
        memberMap.set(entry.memberId, entry.memberName)
        
        if (!memberCPRs.has(entry.memberId)) {
          memberCPRs.set(entry.memberId, new Map())
        }
        memberCPRs.get(entry.memberId)!.set(role.roleName, entry.cpr)
      }
    }
    
    let membersList = Array.from(memberIds).map(id => ({
      memberId: id,
      memberName: memberMap.get(id) || `ID: ${id}`,
      cprs: memberCPRs.get(id) || new Map<string, number>()
    }))
    
    // Apply sorting
    const sortCol = sortColumn[crimeName]
    const sortDir = sortDirection[crimeName] || "desc"
    
    if (sortCol === "name") {
      membersList.sort((a, b) => {
        const cmp = a.memberName.localeCompare(b.memberName)
        return sortDir === "asc" ? cmp : -cmp
      })
    } else if (sortCol) {
      // Sort by a specific role's CPR
      membersList.sort((a, b) => {
        const aCpr = a.cprs.get(sortCol) ?? -1
        const bCpr = b.cprs.get(sortCol) ?? -1
        return sortDir === "asc" ? aCpr - bCpr : bCpr - aCpr
      })
    } else {
      // Default: sort by name ascending
      membersList.sort((a, b) => a.memberName.localeCompare(b.memberName))
    }
    
    return membersList
  }

  const handleSort = (crimeName: string, column: string) => {
    const currentCol = sortColumn[crimeName]
    const currentDir = sortDirection[crimeName] || "desc"
    
    if (currentCol === column) {
      // Toggle direction
      setSortDirection(prev => ({
        ...prev,
        [crimeName]: currentDir === "asc" ? "desc" : "asc"
      }))
    } else {
      // New column, default to desc for CPR columns, asc for name
      setSortColumn(prev => ({ ...prev, [crimeName]: column }))
      setSortDirection(prev => ({
        ...prev,
        [crimeName]: column === "name" ? "asc" : "desc"
      }))
    }
    // Reset to first page when sorting
    setCurrentPage(prev => ({ ...prev, [crimeName]: 0 }))
  }

  const getPageForCrime = (crimeName: string) => currentPage[crimeName] || 0

  // Generate pagination page numbers: [1, 2, 3, ..., END] style
  const getPaginationPages = (currentPg: number, totalPgs: number): (number | "...")[] => {
    if (totalPgs <= 5) {
      return Array.from({ length: totalPgs }, (_, i) => i)
    }
    
    const pages: (number | "...")[] = []
    
    // Always show first page
    pages.push(0)
    
    if (currentPg > 2) {
      pages.push("...")
    }
    
    // Show pages around current
    for (let i = Math.max(1, currentPg - 1); i <= Math.min(totalPgs - 2, currentPg + 1); i++) {
      if (!pages.includes(i)) {
        pages.push(i)
      }
    }
    
    if (currentPg < totalPgs - 3) {
      pages.push("...")
    }
    
    // Always show last page
    if (!pages.includes(totalPgs - 1)) {
      pages.push(totalPgs - 1)
    }
    
    return pages
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground flex items-center gap-2">
          <RefreshCw size={20} className="animate-spin" />
          Loading CPR data...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <div className="bg-purple-500/20 p-2 rounded-lg border border-purple-500/40">
                    <Target size={24} className="text-purple-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">CPR</h1>
                    <p className="text-sm text-muted-foreground">
                      Checkpoint Pass Rate for members
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs flex items-center gap-4">
                <span className="flex items-center gap-1 text-red-400">
                  <Database size={12} />
                  {dataStats.fromCrimes} from crimes
                </span>
                {hasTornStats && (
                  <span className="flex items-center gap-1 text-purple-400">
                    <ExternalLink size={12} />
                    {dataStats.fromTornStats} from TornStats
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="gap-2 bg-transparent"
              >
                <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {crimeRoleCPRData.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <Target size={48} className="mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No CPR Data Available</h2>
            <p className="text-muted-foreground mb-4">
              CPR data will be collected from completed and active organized crimes.
            </p>
            {!hasTornStats && (
              <p className="text-sm text-muted-foreground">
                Tip: Add your TornStats API key in Settings to supplement with additional CPR data.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <Users size={14} className="inline mr-1" />
                {crimeRoleCPRData.length} crime types with CPR data
              </p>
            </div>

            {crimeRoleCPRData.map((crime) => {
              const allMembers = getUniqueMembersForCrime(crime.crimeName, crime.roles)
              const isExpanded = expandedCrimes.has(crime.crimeName)
              const page = getPageForCrime(crime.crimeName)
              const totalPages = Math.ceil(allMembers.length / ITEMS_PER_PAGE)
              const paginatedMembers = allMembers.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE)
              
              return (
                <div
                  key={crime.crimeName}
                  className="bg-card border border-border rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleCrimeExpanded(crime.crimeName)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-foreground">{crime.crimeName}</h3>
                      <span className="text-xs text-muted-foreground bg-accent/30 px-2 py-1 rounded">
                        {crime.roles.length} roles
                      </span>
                      <span className="text-xs text-muted-foreground bg-accent/30 px-2 py-1 rounded">
                        {allMembers.length} members
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={20} className="text-muted-foreground" />
                    ) : (
                      <ChevronDown size={20} className="text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-background/80 border-b border-border">
                              <th 
                                className="text-left px-3 py-2 font-medium text-muted-foreground sticky left-0 bg-background/80 z-10 cursor-pointer hover:text-foreground transition-colors"
                                onClick={() => handleSort(crime.crimeName, "name")}
                              >
                                <div className="flex items-center gap-1.5">
                                  Member
                                  <ArrowUpDown size={12} className={sortColumn[crime.crimeName] === "name" ? "text-primary" : "opacity-40"} />
                                </div>
                              </th>
                              {crime.roles.map((role) => {
                                const isSortedByThis = sortColumn[crime.crimeName] === role.roleName
                                
                                return (
                                  <th
                                    key={role.roleName}
                                    className="text-center px-3 py-2 font-medium min-w-[100px] cursor-pointer hover:text-foreground transition-colors"
                                    onClick={() => handleSort(crime.crimeName, role.roleName)}
                                  >
                                    <div className="flex items-center justify-center gap-1.5">
                                      <span className="text-foreground">{role.roleName}</span>
                                      <ArrowUpDown size={12} className={isSortedByThis ? "text-primary" : "opacity-40"} />
                                    </div>
                                  </th>
                                )
                              })}
                              <th className="w-10 px-2">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className="p-1.5 hover:bg-accent rounded transition-colors">
                                      <Settings size={16} className="text-muted-foreground hover:text-foreground" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-72 p-4" align="end">
                                    <div className="space-y-4">
                                      <div>
                                        <h4 className="font-semibold text-sm">Minimum CPR Settings</h4>
                                        <p className="text-xs text-muted-foreground mt-1">Set minimum CPR thresholds per role</p>
                                      </div>
                                      <div className="space-y-3 max-h-56 overflow-y-auto">
                                        {crime.roles.map((role) => (
                                          <div key={role.roleName} className="flex items-center justify-between gap-3">
                                            <span className="text-sm truncate flex-1">{role.roleName}</span>
                                            <input
                                              type="number"
                                              min="0"
                                              max="100"
                                              value={getMinCPR(crime.crimeName, role.roleName)}
                                              onChange={(e) => handleMinCPRChange(crime.crimeName, role.roleName, parseInt(e.target.value) || 0)}
                                              className="w-16 px-2 py-1.5 text-sm bg-background border border-border rounded text-center"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                      <Button
                                        size="sm"
                                        className="w-full"
                                        onClick={() => {
                                          toast({
                                            title: "Settings Saved",
                                            description: `Minimum CPR settings for ${crime.crimeName} saved.`,
                                          })
                                        }}
                                      >
                                        Save Settings
                                      </Button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {paginatedMembers.map((member) => (
                              <tr key={member.memberId} className="hover:bg-accent/20 transition-colors">
                                <td className="px-3 py-2 sticky left-0 bg-card z-10">
                                  <div className="flex items-center gap-1.5">
                                    {membersInOC.has(member.memberId) && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <UserCheck size={14} className="text-green-400 shrink-0" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Currently in an active OC</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                    <a
                                      href={`https://www.torn.com/profiles.php?XID=${member.memberId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-accent hover:underline font-medium truncate max-w-[130px]"
                                    >
                                      {member.memberName}
                                    </a>
                                  </div>
                                </td>
                                {crime.roles.map((role) => {
                                  const cpr = member.cprs.get(role.roleName)
                                  const minCPR = getMinCPR(crime.crimeName, role.roleName)
                                  const entry = role.entries.find(e => e.memberId === member.memberId)
                                  
                                  return (
                                    <td key={role.roleName} className="text-center px-3 py-2">
                                      {cpr !== undefined ? (
                                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-sm font-bold ${getCPRColor(cpr, minCPR)}`}>
                                          {cpr}%
                                          {entry?.source === "tornstats" && (
                                            <ExternalLink size={10} className="ml-1 opacity-60" />
                                          )}
                                        </span>
                                      ) : (
                                        <X size={16} className="mx-auto text-red-500/70" />
                                      )}
                                    </td>
                                  )
                                })}
                                <td className="w-10" />
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Pagination with numbered buttons */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background/30">
                          <span className="text-sm text-muted-foreground">
                            {page * ITEMS_PER_PAGE + 1}-{Math.min((page + 1) * ITEMS_PER_PAGE, allMembers.length)} of {allMembers.length}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={page === 0}
                              onClick={() => setCurrentPage(prev => ({ ...prev, [crime.crimeName]: page - 1 }))}
                              className="h-8 w-8 p-0"
                            >
                              <ChevronLeft size={16} />
                            </Button>
                            {getPaginationPages(page, totalPages).map((p, idx) => (
                              p === "..." ? (
                                <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted-foreground">...</span>
                              ) : (
                                <Button
                                  key={p}
                                  variant={page === p ? "default" : "ghost"}
                                  size="sm"
                                  onClick={() => setCurrentPage(prev => ({ ...prev, [crime.crimeName]: p as number }))}
                                  className={`h-8 w-8 p-0 text-sm ${page === p ? "bg-primary text-primary-foreground" : ""}`}
                                >
                                  {(p as number) + 1}
                                </Button>
                              )
                            ))}
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={page >= totalPages - 1}
                              onClick={() => setCurrentPage(prev => ({ ...prev, [crime.crimeName]: page + 1 }))}
                              className="h-8 w-8 p-0"
                            >
                              <ChevronRight size={16} />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
