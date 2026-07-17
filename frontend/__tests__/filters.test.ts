import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  sortCrimes,
  filterCrimesByDateRange,
  filterCrimesByMember,
  hasAtRiskMembers,
  filterCrimesByRisk,
  groupCrimesByStatus,
} from "@/lib/crimes/filters"
import type { Crime, CrimeSlot } from "@/types/crime"

function makeSlot(partial: Partial<CrimeSlot> = {}): CrimeSlot {
  return { position: "P1", user: null, ...partial }
}

function makeCrime(partial: Partial<Crime> = {}): Crime {
  return {
    id: 1,
    name: "Test Crime",
    difficulty: 1,
    participants: 0,
    status: "Recruiting",
    planned_by: { id: 0, name: "" },
    initiated_by: null,
    slots: [],
    ...partial,
  }
}

describe("filters", () => {
  describe("sortCrimes", () => {
    it("returns the input untouched for sortType 'none'", () => {
      const crimes = [makeCrime({ id: 1 }), makeCrime({ id: 2 })]
      expect(sortCrimes(crimes, "none")).toBe(crimes)
    })

    it("sorts by difficulty descending without mutating the input", () => {
      const crimes = [
        makeCrime({ id: 1, difficulty: 2 }),
        makeCrime({ id: 2, difficulty: 5 }),
        makeCrime({ id: 3, difficulty: 1 }),
      ]
      const sorted = sortCrimes(crimes, "difficulty")
      expect(sorted.map((c) => c.id)).toEqual([2, 1, 3])
      expect(crimes.map((c) => c.id)).toEqual([1, 2, 3]) // original preserved
    })

    it("sorts by fill ratio descending", () => {
      const half = makeCrime({
        id: 1,
        slots: [makeSlot({ user: { id: 5 } }), makeSlot()],
      })
      const full = makeCrime({
        id: 2,
        slots: [makeSlot({ user: { id: 6 } })],
      })
      expect(sortCrimes([half, full], "filled").map((c) => c.id)).toEqual([2, 1])
    })

    it("sorts by soonest expiry first", () => {
      const later = makeCrime({ id: 1, expired_at: 2000 })
      const sooner = makeCrime({ id: 2, expired_at: 1000 })
      expect(sortCrimes([later, sooner], "timeLeft").map((c) => c.id)).toEqual([2, 1])
    })
  })

  describe("filterCrimesByDateRange", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2024-01-31T00:00:00Z"))
    })
    afterEach(() => vi.useRealTimers())

    it("returns everything when days is 0", () => {
      const crimes = [makeCrime({ executed_at: 0 })]
      expect(filterCrimesByDateRange(crimes, 0)).toBe(crimes)
    })

    it("keeps only crimes within the trailing window", () => {
      const nowSec = Date.now() / 1000
      const recent = makeCrime({ id: 1, executed_at: nowSec - 2 * 86400 })
      const old = makeCrime({ id: 2, executed_at: nowSec - 20 * 86400 })
      expect(filterCrimesByDateRange([recent, old], 7).map((c) => c.id)).toEqual([1])
    })

    it("falls back to created_at when executed_at is absent", () => {
      const nowSec = Date.now() / 1000
      const crime = makeCrime({ id: 3, created_at: nowSec - 1 * 86400 })
      expect(filterCrimesByDateRange([crime], 7)).toHaveLength(1)
    })
  })

  describe("filterCrimesByMember", () => {
    const crimes = [
      makeCrime({ id: 1, slots: [makeSlot({ user: { id: 42 } })] }),
      makeCrime({ id: 2, slots: [makeSlot({ user: { id: 99 } })] }),
    ]

    it("returns all crimes when no member id is given", () => {
      expect(filterCrimesByMember(crimes, null)).toBe(crimes)
    })

    it("keeps only crimes the member participates in", () => {
      expect(filterCrimesByMember(crimes, 42).map((c) => c.id)).toEqual([1])
    })
  })

  describe("hasAtRiskMembers / filterCrimesByRisk", () => {
    it("flags crimes with a filled slot below the pass-rate threshold", () => {
      const risky = makeCrime({
        id: 1,
        slots: [makeSlot({ user: { id: 1 }, checkpoint_pass_rate: 40 })],
      })
      const safe = makeCrime({
        id: 2,
        slots: [makeSlot({ user: { id: 2 }, checkpoint_pass_rate: 90 })],
      })
      expect(hasAtRiskMembers(risky, 70)).toBe(true)
      expect(hasAtRiskMembers(safe, 70)).toBe(false)
      expect(filterCrimesByRisk([risky, safe], 70).map((c) => c.id)).toEqual([1])
    })

    it("does not flag empty slots", () => {
      const crime = makeCrime({ slots: [makeSlot({ user: null, checkpoint_pass_rate: 10 })] })
      expect(hasAtRiskMembers(crime, 70)).toBe(false)
    })
  })

  describe("groupCrimesByStatus", () => {
    it("buckets crimes by status and maps 'Failure' to 'Failed'", () => {
      const groups = groupCrimesByStatus([
        makeCrime({ id: 1, status: "Planning" }),
        makeCrime({ id: 2, status: "Failure" }),
        makeCrime({ id: 3, status: "Successful" }),
      ])
      expect(groups.Planning.map((c) => c.id)).toEqual([1])
      expect(groups.Failed.map((c) => c.id)).toEqual([2])
      expect(groups.Successful.map((c) => c.id)).toEqual([3])
    })

    it("ignores statuses that have no bucket", () => {
      const groups = groupCrimesByStatus([makeCrime({ status: "Nonsense" })])
      const total = Object.values(groups).reduce((n, arr) => n + arr.length, 0)
      expect(total).toBe(0)
    })
  })
})
