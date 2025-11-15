"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Search, RotateCcw, Users, ChevronDown } from 'lucide-react'
import { Slider } from "@/components/ui/slider"

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
}

interface Crime {
  id: number
  name: string
  slots: Array<{
    user: { id: number } | null
  }>
  status?: string
  rewards?: {
    money?: number
    respect?: number
  }
}

interface MemberListProps {
  members: Member[]
  crimes: Crime[]
  allCrimes?: Crime[]
  filters: {
    crimeStatus: string
    activityRange: [number, number]
    levelRange: [number, number]
  }
  onFiltersChange: (filters: any) => void
  onResetFilters: () => void
  onCrimeClick?: (crimeId: number, crimeName: string) => void
  onFilterByCrime?: (memberId: number) => void
}

export default function MemberList({
  members,
  crimes,
  allCrimes = [],
  filters,
  onFiltersChange,
  onResetFilters,
  onCrimeClick,
  onFilterByCrime,
}: MemberListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filtersCollapsed, setFiltersCollapsed] = useState(true)
  const [collapsedMembers, setCollapsedMembers] = useState<Set<number>>(new Set(members.map((m) => m.id)))

  const participatingMemberIds = new Set<number>()
  const memberToCrimeMap: { [key: number]: { id: number; name: string } } = {}

  crimes.forEach((crime) => {
    crime.slots.forEach((slot) => {
      if (slot.user) {
        participatingMemberIds.add(slot.user.id)
        memberToCrimeMap[slot.user.id] = { id: crime.id, name: crime.name }
      }
    })
  })

  const fuzzyMatch = (searchTerm: string, memberName: string) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    const name = memberName.toLowerCase()

    // Direct substring match
    if (name.includes(search)) return true

    // Fuzzy match: check if all characters in search appear in order in name
    let searchIndex = 0
    for (let i = 0; i < name.length && searchIndex < search.length; i++) {
      if (name[i] === search[searchIndex]) {
        searchIndex++
      }
    }
    return searchIndex === search.length
  }

  const filtered = members.filter((member) => {
    if (!fuzzyMatch(searchQuery, member.name)) {
      return false
    }

    if (filters.crimeStatus === "in_crime" && !participatingMemberIds.has(member.id)) {
      return false
    }
    if (filters.crimeStatus === "not_in_crime" && participatingMemberIds.has(member.id)) {
      return false
    }

    const daysSinceActivity = (Date.now() / 1000 - member.last_action.timestamp) / 86400
    if (daysSinceActivity < filters.activityRange[0] || daysSinceActivity > filters.activityRange[1]) {
      return false
    }

    if (member.level < filters.levelRange[0] || member.level > filters.levelRange[1]) {
      return false
    }

    return true
  })

  const sortedMembers = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aInCrime = participatingMemberIds.has(a.id)
      const bInCrime = participatingMemberIds.has(b.id)

      if (aInCrime !== bInCrime) {
        return aInCrime ? -1 : 1
      }

      const statusOrder: { [key: string]: number } = { online: 0, idle: 1, offline: 2 }
      return (statusOrder[a.status.state] || 3) - (statusOrder[b.status.state] || 3)
    })
  }, [filtered, participatingMemberIds])

  const getStatusIcon = (state: string) => {
    const iconMap: { [key: string]: string } = {
      online: "●",
      idle: "●",
      offline: "●",
    }
    const colorMap: { [key: string]: string } = {
      online: "text-green-500",
      idle: "text-yellow-500",
      offline: "text-gray-500",
    }
    return <span className={`text-lg ${colorMap[state] || "text-gray-500"}`}>{iconMap[state] || "●"}</span>
  }

  const getStatusColor = (color: string) => {
    const colors: { [key: string]: string } = {
      green: "bg-green-500/20 text-green-400 border-green-500/30",
      red: "bg-red-500/20 text-red-400 border-red-500/30",
      yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      gray: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    }
    return colors[color] || "bg-gray-500/20 text-gray-400 border-gray-500/30"
  }

  const handleCrimeClick = (crimeId: number, crimeName: string) => {
    const crimeAnchorId = `crime-${crimeId}`
    window.location.hash = crimeAnchorId
    setTimeout(() => {
      const element = document.getElementById(crimeAnchorId)
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }, 0)
    onCrimeClick?.(crimeId, crimeName)
  }

  const formatLastAction = (timestamp: number) => {
    const now = Date.now() / 1000
    const diffSeconds = now - timestamp
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) return `${diffDays}d ago`
    if (diffHours > 0) return `${diffHours}h ago`
    if (diffMinutes > 0) return `${diffMinutes}m ago`
    return "Just now"
  }

  const hasActiveFilters =
    filters.crimeStatus !== "all" ||
    filters.activityRange[0] !== 0 ||
    filters.activityRange[1] !== 7 ||
    filters.levelRange[0] !== 1 ||
    filters.levelRange[1] !== 100 ||
    searchQuery !== ""

  const toggleMemberCollapse = (memberId: number) => {
    setCollapsedMembers((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(memberId)) {
        newSet.delete(memberId)
      } else {
        newSet.add(memberId)
      }
      return newSet
    })
  }

  const getMemberCrimeReport = (memberId: number) => {
    if (!allCrimes || allCrimes.length === 0) return null

    const participations = allCrimes.filter((crime) => crime.slots.some((slot) => slot.user?.id === memberId))

    const successful = participations.filter((c) => c.status === "Successful").length
    const failed = participations.filter((c) => c.status === "Failed" || c.status === "Failure").length
    const planning = participations.filter((c) => c.status === "Planning").length
    const recruiting = participations.filter((c) => c.status === "Recruiting").length

    const totalMoney = participations
      .filter((c) => c.status === "Successful" && c.rewards)
      .reduce((sum, c) => sum + (c.rewards?.money || 0), 0)

    const totalRespect = participations
      .filter((c) => c.status === "Successful" && c.rewards)
      .reduce((sum, c) => sum + (c.rewards?.respect || 0), 0)

    const crimesByType: { [key: string]: { successful: number; failed: number; total: number } } = {}

    participations.forEach((crime) => {
      if (!crimesByType[crime.name]) {
        crimesByType[crime.name] = { successful: 0, failed: 0, total: 0 }
      }
      crimesByType[crime.name].total++

      if (crime.status === "Successful") {
        crimesByType[crime.name].successful++
      } else if (crime.status === "Failed" || crime.status === "Failure") {
        crimesByType[crime.name].failed++
      }
    })

    return {
      total: participations.length,
      successful,
      failed,
      planning,
      recruiting,
      totalMoney,
      totalRespect,
      crimesByType,
    }
  }

  const toggleMemberReport = (memberId: number) => {
    setCollapsedMembers((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(memberId)) {
        newSet.delete(memberId)
      } else {
        newSet.add(memberId)
      }
      return newSet
    })
  }

  const formatCurrency = (num: number) => {
    return `$${new Intl.NumberFormat().format(num)}`
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="bg-card border-2 border-border px-4 py-3 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">
            {filtered.length !== members.length ? (
              <>
                <span className="text-primary text-lg">{filtered.length}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-foreground">{members.length}</span>
              </>
            ) : (
              <span className="text-primary text-lg">{members.length}</span>
            )}
            {" Members"}
          </span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="text-xs px-3 py-1.5 bg-primary text-white border-2 border-primary rounded-md hover:bg-primary/80 transition-all flex items-center gap-1.5 font-bold"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-9 h-10 bg-card border-2 border-border focus:border-primary text-foreground placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors font-bold"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      <div className="bg-card border-2 border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setFiltersCollapsed(!filtersCollapsed)}
          className="w-full flex items-center justify-between p-4 hover:bg-accent/10 transition-colors"
        >
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Filters</h3>
          <ChevronDown
            className={`h-4 w-4 text-foreground transition-transform duration-300 ${filtersCollapsed ? "" : "rotate-180"}`}
          />
        </button>

        {!filtersCollapsed && (
          <div className="p-4 pt-0 space-y-4 border-t-2 border-border">
            <div className="space-y-2">
              <label className="text-xs text-foreground font-bold block">Crime Status</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => onFiltersChange({ ...filters, crimeStatus: "all" })}
                  className={`text-xs px-3 py-2 rounded-md border-2 transition-all font-bold ${
                    filters.crimeStatus === "all"
                      ? "bg-primary text-white border-primary"
                      : "bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => onFiltersChange({ ...filters, crimeStatus: "in_crime" })}
                  className={`text-xs px-3 py-2 rounded-md border-2 transition-all font-bold ${
                    filters.crimeStatus === "in_crime"
                      ? "bg-primary text-white border-primary"
                      : "bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground"
                  }`}
                >
                  In Crime
                </button>
                <button
                  onClick={() => onFiltersChange({ ...filters, crimeStatus: "not_in_crime" })}
                  className={`text-xs px-3 py-2 rounded-md border-2 transition-all font-bold ${
                    filters.crimeStatus === "not_in_crime"
                      ? "bg-primary text-white border-primary"
                      : "bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground"
                  }`}
                >
                  Not In
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-xs text-foreground font-bold flex items-center justify-between">
                <span>Activity</span>
                <span className="text-primary text-base">
                  {filters.activityRange[0]} - {filters.activityRange[1] === 7 ? "7+" : filters.activityRange[1]} days
                </span>
              </label>
              <Slider
                value={filters.activityRange}
                onValueChange={(value) => onFiltersChange({ ...filters, activityRange: value as [number, number] })}
                min={0}
                max={7}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-2.5">
              <label className="text-xs text-foreground font-bold flex items-center justify-between">
                <span>Level</span>
                <span className="text-primary text-base">
                  {filters.levelRange[0]} - {filters.levelRange[1]}
                </span>
              </label>
              <Slider
                value={filters.levelRange}
                onValueChange={(value) => onFiltersChange({ ...filters, levelRange: value as [number, number] })}
                min={1}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {sortedMembers.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="text-muted-foreground mb-2">
              <Users className="h-12 w-12 mx-auto mb-3" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              {searchQuery ? "No members match your search" : "No members found"}
            </p>
          </div>
        ) : (
          sortedMembers.map((member) => {
            const report = getMemberCrimeReport(member.id)
            const isReportExpanded = !collapsedMembers.has(member.id)

            return (
              <div
                key={member.id}
                className="bg-card border border-border rounded-lg p-3 hover:border-primary transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getStatusIcon(member.status.state)}
                    <div className="flex-1 min-w-0">
                      <a
                        href={`https://www.torn.com/profiles.php?XID=${member.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-base text-foreground leading-tight hover:text-accent hover:underline transition-colors block truncate"
                      >
                        {member.name}
                      </a>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="font-bold text-primary">Lvl {member.level}</span>
                        <span>•</span>
                        <span>{member.position}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-xs space-y-1 mb-2">
                  <div className="text-muted-foreground">
                    <span className="font-bold">Last seen:</span> {formatLastAction(member.last_action.timestamp)}
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-bold">Days in Faction:</span> {member.days_in_faction}
                  </div>
                  {member.money !== undefined && (
                    <div className="text-green-400 font-bold">
                      <span className="text-muted-foreground font-bold">Balance:</span> {formatCurrency(member.money)}
                    </div>
                  )}
                </div>

                <div className="mb-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-md border font-bold inline-block ${getStatusColor(member.status.color)}`}
                  >
                    {member.status.description}
                  </span>
                </div>

                {report && report.total > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-foreground">Crime Stats:</div>
                    <div className="flex flex-wrap gap-2">
                      {report.successful > 0 && (
                        <div className="bg-green-500/20 border border-green-500/30 rounded px-2 py-1 text-xs">
                          <span className="text-green-400 font-bold">Successful: {report.successful}</span>
                        </div>
                      )}
                      {report.failed > 0 && (
                        <div className="bg-red-500/20 border border-red-500/30 rounded px-2 py-1 text-xs">
                          <span className="text-red-400 font-bold">Failed: {report.failed}</span>
                        </div>
                      )}
                      {report.planning > 0 && (
                        <div className="bg-blue-500/20 border border-blue-500/30 rounded px-2 py-1 text-xs">
                          <span className="text-blue-400 font-bold">Planning: {report.planning}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-background border border-border/30 rounded px-2 py-1">
                        <div className="text-muted-foreground">Money Earned</div>
                        <div className="font-bold text-green-400">{formatCurrency(report.totalMoney)}</div>
                      </div>
                      <div className="bg-background border border-border/30 rounded px-2 py-1">
                        <div className="text-muted-foreground">Respect Earned</div>
                        <div className="font-bold text-blue-400">{report.totalRespect}</div>
                      </div>
                    </div>

                    {participatingMemberIds.has(member.id) && (
                      <div className="flex gap-2 pt-2">
                        <a
                          href={`https://www.torn.com/factions.php?step=your&type=1#/tab=crimes&crimeId=${memberToCrimeMap[member.id].id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 rounded-md bg-accent text-white border border-accent font-bold hover:bg-accent/80 transition-all"
                        >
                          View
                        </a>
                        <button
                          onClick={() => onFilterByCrime?.(member.id)}
                          className="text-xs px-3 py-1.5 rounded-md bg-primary text-white border border-primary font-bold hover:bg-primary/80 transition-all"
                          title="Filter crimes"
                        >
                          Filter
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => toggleMemberReport(member.id)}
                      className="w-full flex items-center justify-between hover:opacity-80 transition-opacity pt-2 border-t border-border/30"
                    >
                      <span className="text-xs font-bold text-foreground uppercase">
                        Report ({report.total} participations)
                      </span>
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-300 ${isReportExpanded ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isReportExpanded && (
                      <div className="mt-2 space-y-2 text-xs animate-in fade-in duration-200">
                        {Object.keys(report.crimesByType).length > 0 && (
                          <div className="space-y-1.5">
                            {Object.entries(report.crimesByType)
                              .sort(([, a], [, b]) => b.total - a.total)
                              .map(([crimeName, stats]) => (
                                <div
                                  key={crimeName}
                                  className="bg-background border border-border/30 rounded px-2 py-1.5 space-y-1"
                                >
                                  <div className="font-bold text-foreground">{crimeName}</div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-muted-foreground">Total: {stats.total}</span>
                                    {stats.successful > 0 && (
                                      <>
                                        <span className="text-muted-foreground">•</span>
                                        <span className="text-green-400 font-bold">Success: {stats.successful}</span>
                                      </>
                                    )}
                                    {stats.failed > 0 && (
                                      <>
                                        <span className="text-muted-foreground">•</span>
                                        <span className="text-red-400 font-bold">Failed: {stats.failed}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
