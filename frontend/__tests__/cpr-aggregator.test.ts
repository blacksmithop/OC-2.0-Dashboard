import { describe, it, expect } from "vitest"
import {
  extractCPRFromTornStats,
  mergeCPRData,
  type AggregatedCPRData,
} from "@/lib/crimes/cpr-aggregator"
import type { TornStatsCPRData } from "@/lib/integration/cpr-tracker"

function tornStats(members: TornStatsCPRData["members"]): TornStatsCPRData {
  return { status: true, message: "ok", members }
}

describe("extractCPRFromTornStats", () => {
  it("keeps only members still present in the faction name map", () => {
    const data = tornStats({
      "1": { "Mob Mentality": { Looter: 80 } },
      "2": { "Mob Mentality": { Looter: 90 } },
    })
    const names = new Map<number, string>([[1, "Alice"]]) // member 2 has left

    const result = extractCPRFromTornStats(data, names)
    const entries = result.crimes.get("Mob Mentality")!.roles.get("Looter")!.entries
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ memberId: 1, memberName: "Alice", cpr: 80, source: "tornstats" })
  })

  it("builds the crime -> role -> entries structure", () => {
    const data = tornStats({
      "1": { "Pet Project": { Kidnapper: 55, Muscle: 40 } },
    })
    const result = extractCPRFromTornStats(data, new Map([[1, "Alice"]]))
    const roles = result.crimes.get("Pet Project")!.roles
    expect([...roles.keys()].sort()).toEqual(["Kidnapper", "Muscle"])
  })
})

describe("mergeCPRData", () => {
  it("keeps the highest CPR when the same member/role appears in multiple sources", () => {
    const names = new Map([[1, "Alice"]])
    const low = extractCPRFromTornStats(tornStats({ "1": { "Mob Mentality": { Looter: 60 } } }), names)
    const high = extractCPRFromTornStats(tornStats({ "1": { "Mob Mentality": { Looter: 95 } } }), names)

    const merged = mergeCPRData(low, high)
    const entries = merged.crimes.get("Mob Mentality")!.roles.get("Looter")!.entries
    expect(entries).toHaveLength(1)
    expect(entries[0].cpr).toBe(95)
  })

  it("unions distinct members within a role", () => {
    const a = extractCPRFromTornStats(
      tornStats({ "1": { "Mob Mentality": { Looter: 60 } } }),
      new Map([[1, "Alice"]]),
    )
    const b = extractCPRFromTornStats(
      tornStats({ "2": { "Mob Mentality": { Looter: 70 } } }),
      new Map([[2, "Bob"]]),
    )
    const merged = mergeCPRData(a, b)
    const entries = merged.crimes.get("Mob Mentality")!.roles.get("Looter")!.entries
    expect(entries.map((e) => e.memberId).sort()).toEqual([1, 2])
  })

  it("returns an empty aggregate when given no sources", () => {
    const merged: AggregatedCPRData = mergeCPRData()
    expect(merged.crimes.size).toBe(0)
  })
})
