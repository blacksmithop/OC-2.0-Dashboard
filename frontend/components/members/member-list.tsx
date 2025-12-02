"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Search, RotateCcw, Users } from 'lucide-react'
import { MemberFilters } from "./member-filters"
import { MemberCard } from "./member-card"
import { MemberCrimeStats } from "./member-crime-stats"
import { MemberCrimeReport } from "./member-crime-report"

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
  const [sortBy, setSortBy] = useState<"none" | "crime_rank" | "nnb">("none")

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

    if (name.includes(search)) return true

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
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "crime_rank") {
        const aRank = a.crimes_rank || 999
        const bRank = b.crimes_rank || 999
        return aRank - bRank
      }

      if (sortBy === "nnb") {
        const aNnb = a.nnb || 0
        const bNnb = b.nnb || 0
        return bNnb - aNnb
      }

      const aInCrime = participatingMemberIds.has(a.id)
      const bInCrime = participatingMemberIds.has(b.id)

      if (aInCrime !== bInCrime) {
        return aInCrime ? -1 : 1
      }

      const statusOrder: { [key: string]: number } = { online: 0, idle: 1, offline: 2 }
      return (statusOrder[a.status.state] || 3) - (statusOrder[b.status.state] || 3)
    })
    return sorted
  }, [filtered, participatingMemberIds, sortBy])

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

  const hasActiveFilters =
    filters.crimeStatus !== "all" ||
    filters.activityRange[0] !== 0 ||
    filters.activityRange[1] !== 7 ||
    filters.levelRange[0] !== 1 ||
    filters.levelRange[1] !== 100 ||
    searchQuery !== ""

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

      <MemberFilters
        filters={filters}
        onFiltersChange={onFiltersChange}
        sortBy={sortBy}
        onSortChange={setSortBy}
        collapsed={filtersCollapsed}
        onToggleCollapse={() => setFiltersCollapsed(!filtersCollapsed)}
      />

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
            const isInCrime = participatingMemberIds.has(member.id)

            return (
              <MemberCard
                key={member.id}
                member={member}
                isInCrime={isInCrime}
                crimeInfo={isInCrime ? memberToCrimeMap[member.id] : undefined}
                report={report}
                isReportExpanded={isReportExpanded}
                onToggleReport={() => toggleMemberReport(member.id)}
                onFilterByCrime={onFilterByCrime}
              >
                {report && report.total > 0 && (
                  <>
                    <MemberCrimeStats report={report} />
                    <MemberCrimeReport
                      report={report}
                      isExpanded={isReportExpanded}
                      onToggle={() => toggleMemberReport(member.id)}
                    />
                  </>
                )}
              </MemberCard>
            )
          })
        )}
      </div>
    </div>
  )
}
