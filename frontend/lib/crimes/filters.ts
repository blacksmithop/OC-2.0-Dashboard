import type { Crime } from "@/types/crime"

export type SortType = "difficulty" | "filled" | "timeLeft" | "none"

export function sortCrimes(crimes: Crime[], sortType: SortType): Crime[] {
  if (sortType === "none") return crimes

  return [...crimes].sort((a, b) => {
    if (sortType === "difficulty") {
      return b.difficulty - a.difficulty
    } else if (sortType === "filled") {
      const aFilled = a.slots.filter((slot) => slot.user?.id).length / a.slots.length
      const bFilled = b.slots.filter((slot) => slot.user?.id).length / b.slots.length
      return bFilled - aFilled
    } else if (sortType === "timeLeft") {
      const aTime = a.expired_at || 0
      const bTime = b.expired_at || 0
      return aTime - bTime
    }
    return 0
  })
}

export function filterCrimesByDateRange(crimes: Crime[], days: number): Crime[] {
  if (days === 0) return crimes

  const now = Date.now() / 1000
  const cutoffTime = now - days * 24 * 60 * 60

  return crimes.filter((crime) => {
    const timestamp = crime.executed_at || crime.created_at || 0
    return timestamp >= cutoffTime
  })
}

export function filterCrimesByMember(crimes: Crime[], memberId: number | null): Crime[] {
  if (!memberId) return crimes
  return crimes.filter((crime) => crime.slots.some((slot) => slot.user?.id === memberId))
}

export function hasAtRiskMembers(crime: Crime, minPassRate: number): boolean {
  return crime.slots.some(
    (slot) => slot.user && slot.checkpoint_pass_rate !== undefined && slot.checkpoint_pass_rate < minPassRate,
  )
}

export function filterCrimesByRisk(crimes: Crime[], minPassRate: number): Crime[] {
  return crimes.filter((crime) => hasAtRiskMembers(crime, minPassRate))
}

export function groupCrimesByStatus(crimes: Crime[]): { [key: string]: Crime[] } {
  const groups: { [key: string]: Crime[] } = {
    Recruiting: [],
    Planning: [],
    Ongoing: [],
    Successful: [],
    Failed: [],
    Expired: [],
  }

  crimes.forEach((crime) => {
    const status = crime.status === "Failure" ? "Failed" : crime.status
    if (groups[status]) {
      groups[status].push(crime)
    }
  })

  return groups
}
