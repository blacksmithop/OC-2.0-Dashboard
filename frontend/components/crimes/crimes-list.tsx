"use client"

import type React from "react"
import type { Crime, Member } from "@/types/crime"
import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import ItemModal from "./item-modal"
import CrimeCard from "./crime-card"
import CrimeGroupHeader from "./crime-group-header"
import { getRoleWeights, type RoleWeightsData } from "@/lib/crimes/role-weights"
import { STATUS_ORDER } from "@/constants/crime-statuses"
import { getMinCPRSettings, type MinCPRSettings } from "@/lib/crimes/cpr-aggregator"

interface CrimesListProps {
  crimes: Crime[]
  members: Member[]
  items: Map<number, any>
  onMemberClick?: (memberId: number) => void
  onReloadCrime?: (crimeId: number) => Promise<Crime | null>
  minPassRate: number
  factionId?: number | null
  cprTrackerData: any
  cprTrackerEnabled: boolean
  membersNotInOC?: Member[]
  onMemberNameClick?: (memberId: number) => void
  selectedMemberId?: number | null
}

export default function CrimesList({
  crimes,
  members,
  items,
  onMemberClick,
  onReloadCrime,
  minPassRate,
  factionId = null,
  cprTrackerData,
  cprTrackerEnabled,
  membersNotInOC,
  onMemberNameClick,
  selectedMemberId,
}: CrimesListProps) {
  const [collapsedStatus, setCollapsedStatus] = useState<Set<string>>(new Set(STATUS_ORDER))
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [sortBy, setSortBy] = useState<{ [key: string]: "difficulty" | "filled" | "timeLeft" | "none" }>({})
  const [filterAtRisk, setFilterAtRisk] = useState<{ [key: string]: boolean }>({})
  const [filterOverseas, setFilterOverseas] = useState<{ [key: string]: boolean }>({})
  const [currentTime, setCurrentTime] = useState(Date.now() / 1000)
  const [reloadingCrimes, setReloadingCrimes] = useState<Set<number>>(new Set())
  const [visibleCrimes, setVisibleCrimes] = useState<{ [key: string]: number }>({})
  const observerRef = useRef<{ [key: string]: IntersectionObserver | null }>({})
  const loadMoreRef = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const [roleWeights, setRoleWeights] = useState<RoleWeightsData | null>(null)
  const [minCPRSettings, setMinCPRSettings] = useState<MinCPRSettings>({})
  const membersNotInOCSet = useMemo(() => {
    const excludedPositions = ["Recruit"]
    const excludedStates = ["Hospital", "Jail", "Fallen"]

    const membersInCrimes = new Set<number>()
    crimes
      .filter((crime) => crime.status === "Planning" || crime.status === "Recruiting")
      .forEach((crime) => {
        crime.slots.forEach((slot) => {
          if (slot.user?.id) {
            membersInCrimes.add(slot.user.id)
          }
        })
      })

    return new Set(
      members
        .filter((member) => {
          if (excludedPositions.includes(member.position)) return false
          if (excludedStates.includes(member.status?.state)) return false
          if (member.is_in_oc) return false
          if (membersInCrimes.has(member.id)) return false
          return true
        })
        .map((member) => member.id),
    )
  }, [members, crimes])

  const hasAtRiskMembers = (crime: Crime) => {
    return crime.slots.some(
      (slot) => slot.user && slot.checkpoint_pass_rate !== undefined && slot.checkpoint_pass_rate < minPassRate,
    )
  }

  const hasOverseasMembers = (crime: Crime) => {
    return crime.slots.some((slot) => {
      if (!slot.user?.id) return false
      const member = members.find((m) => m.id === slot.user.id)
      const status = member?.status?.state
      return status === "Traveling" || status === "Abroad"
    })
  }

  const crimesGrouped = useMemo(() => {
    const groups: { [key: string]: Crime[] } = {}
    const originalCounts: { [key: string]: number } = {}

    STATUS_ORDER.forEach((status) => {
      groups[status] = []
      originalCounts[status] = 0
    })

    crimes.forEach((crime) => {
      const status = crime.status === "Failure" ? "Failed" : crime.status
      if (groups[status]) {
        groups[status].push(crime)
        originalCounts[status]++
      }
    })

    Object.keys(groups).forEach((status) => {
      if (filterAtRisk[status]) {
        groups[status] = groups[status].filter((crime) => hasAtRiskMembers(crime))
      }

      if (filterOverseas[status]) {
        groups[status] = groups[status].filter((crime) => hasOverseasMembers(crime))
      }

      const sort = sortBy[status] || "none"
      if (sort !== "none") {
        groups[status].sort((a, b) => {
          if (sort === "difficulty") {
            return b.difficulty - a.difficulty
          } else if (sort === "filled") {
            const aFilled = a.slots.filter((slot) => slot.user && slot.user.id).length / a.slots.length
            const bFilled = b.slots.filter((slot) => slot.user && slot.user.id).length / b.slots.length
            return bFilled - aFilled
          } else if (sort === "timeLeft") {
            const aTime = a.expired_at || 0
            const bTime = b.expired_at || 0
            return aTime - bTime
          }
          return 0
        })
      }
    })

    return { groups, originalCounts }
  }, [crimes, sortBy, filterAtRisk, filterOverseas, minPassRate, members])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now() / 1000)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    getRoleWeights().then(setRoleWeights)
    getMinCPRSettings().then(setMinCPRSettings)
  }, [])

  const memberMap = useMemo(() => {
    const map: { [key: number]: string } = {}
    members.forEach((member) => {
      map[member.id] = member.name
    })
    return map
  }, [members])

  const setupObserver = useCallback(
    (status: string) => {
      if (observerRef.current[status]) {
        observerRef.current[status]?.disconnect()
      }

      observerRef.current[status] = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setVisibleCrimes((prev) => {
              const currentVisible = prev[status] || 20
              const totalCrimes = crimesGrouped.groups[status]?.length || 0
              return {
                ...prev,
                [status]: Math.min(currentVisible + 20, totalCrimes),
              }
            })
          }
        },
        { threshold: 0.1 },
      )

      const element = loadMoreRef.current[status]
      if (element) {
        observerRef.current[status]?.observe(element)
      }
    },
    [crimesGrouped],
  )

  useEffect(() => {
    return () => {
      Object.values(observerRef.current).forEach((observer) => {
        observer?.disconnect()
      })
    }
  }, [])

  const handleReloadCrime = async (crimeId: number) => {
    if (!onReloadCrime || reloadingCrimes.has(crimeId)) return

    setReloadingCrimes((prev) => new Set(prev).add(crimeId))

    try {
      await onReloadCrime(crimeId)
    } finally {
      setReloadingCrimes((prev) => {
        const next = new Set(prev)
        next.delete(crimeId)
        return next
      })
    }
  }

  const renderCrimeGroup = (status: string, crimes: Crime[], originalCount: number) => {
    const isExpanded = !collapsedStatus.has(status)
    const currentSort = sortBy[status] || "none"
    const isFilteringAtRisk = filterAtRisk[status] || false
    const isFilteringOverseas = filterOverseas[status] || false
    const visibleCount = visibleCrimes[status] || 20
    const hasMoreCrimes = visibleCount < crimes.length
    const displayedCrimes = crimes.slice(0, visibleCount)

    const toggleExpanded = () => {
      const newCollapsed = new Set(collapsedStatus)
      if (isExpanded) {
        newCollapsed.add(status)
      } else {
        newCollapsed.delete(status)
      }
      setCollapsedStatus(newCollapsed)
    }

    const handleSort = (sortType: "difficulty" | "filled" | "timeLeft") => {
      setSortBy((prev) => ({
        ...prev,
        [status]: prev[status] === sortType ? "none" : sortType,
      }))
    }

    const toggleAtRiskFilter = (e: React.MouseEvent) => {
      e.stopPropagation()
      setFilterAtRisk((prev) => ({
        ...prev,
        [status]: !prev[status],
      }))
    }

    const toggleOverseasFilter = (e: React.MouseEvent) => {
      e.stopPropagation()
      setFilterOverseas((prev) => ({
        ...prev,
        [status]: !prev[status],
      }))
    }

    return (
      <div key={status}>
        <CrimeGroupHeader
          status={status}
          count={crimes.length}
          originalCount={originalCount}
          isExpanded={isExpanded}
          currentSort={currentSort}
          isFilteringAtRisk={isFilteringAtRisk}
          isFilteringOverseas={isFilteringOverseas}
          onToggleExpanded={toggleExpanded}
          onSort={handleSort}
          onToggleAtRiskFilter={toggleAtRiskFilter}
          onToggleOverseasFilter={toggleOverseasFilter}
        />

        {isExpanded && (
          <div className="mt-2 space-y-2 animate-in fade-in duration-200">
            {crimes.length === 0 ? (
              <div className="bg-card border border-border/30 rounded-lg p-6 text-center">
                <p className="text-muted-foreground text-sm">
                  {isFilteringAtRisk
                    ? "No crimes with members below the minimum pass rate"
                    : isFilteringOverseas
                      ? "No crimes with overseas members"
                      : "No crimes in this category"}
                </p>
              </div>
            ) : (
              <>
                {displayedCrimes.map((crime) => (
                  <CrimeCard
                    key={crime.id}
                    crime={crime}
                    members={members}
                    items={items}
                    memberMap={memberMap}
                    onItemClick={setSelectedItem}
                    onReloadCrime={onReloadCrime ? handleReloadCrime : undefined}
                    isReloading={reloadingCrimes.has(crime.id)}
                    minPassRate={minPassRate}
                    factionId={factionId}
                    roleWeights={roleWeights}
                    membersNotInOCSet={membersNotInOCSet}
                    cprTrackerData={cprTrackerData}
                    cprTrackerEnabled={cprTrackerEnabled}
                    currentTime={currentTime}
                    canReload={true}
                    minCPRSettings={minCPRSettings}
                  />
                ))}
                {hasMoreCrimes && (
                  <div
                    ref={(el) => {
                      loadMoreRef.current[status] = el
                      if (el) setupObserver(status)
                    }}
                    className="bg-card border border-border/30 rounded-lg p-4 text-center"
                  >
                    <p className="text-muted-foreground text-sm">
                      Showing {visibleCount} of {crimes.length} crimes. Scroll to load more...
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      {STATUS_ORDER.map((status) => {
        const crimesForStatus = crimesGrouped.groups[status] || []
        const originalCountForStatus = crimesGrouped.originalCounts[status] || 0
        return renderCrimeGroup(status, crimesForStatus, originalCountForStatus)
      })}
    </div>
  )
}
