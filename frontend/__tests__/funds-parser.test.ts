import { describe, it, expect } from "vitest"
import { parseFundsNews } from "@/lib/funds-parser"

const link = (id: number, name: string) => `<a href="/profiles.php?XID=${id}" XID=${id}>${name}</a>`

describe("parseFundsNews", () => {
  it("returns null for news that matches no known pattern", () => {
    expect(parseFundsNews("u1", { news: "something unrelated", timestamp: 1 })).toBeNull()
  })

  it("parses a deposit", () => {
    const news = `${link(1, "Alice")} deposited $1,000,000`
    const entry = parseFundsNews("u1", { news, timestamp: 123 })
    expect(entry).toMatchObject({
      uuid: "u1",
      timestamp: 123,
      action: "deposited",
      user: { id: 1, name: "Alice" },
      target: null,
      money: 1_000_000,
    })
  })

  it("parses a 'was given by' transfer", () => {
    const news = `${link(1, "Alice")} was given $2,500 by ${link(2, "Bob")}`
    const entry = parseFundsNews("u2", { news, timestamp: 1 })
    expect(entry).toMatchObject({
      action: "gave",
      user: { id: 2, name: "Bob" },
      target: { id: 1, name: "Alice" },
      money: 2_500,
    })
  })

  it("parses a crime cut with scenario details", () => {
    const news =
      `${link(1, "Alice")} increased ${link(2, "Bob")}'s money balance by $50,000 ` +
      `from $100 to $50,100 as their 12.5% cut for their role as Looter ` +
      `in the faction's Mob Mentality scenario (crimeId=999)`
    const entry = parseFundsNews("u3", { news, timestamp: 1 })
    expect(entry).toMatchObject({
      action: "crime_cut",
      user: { id: 1, name: "Alice" },
      target: { id: 2, name: "Bob" },
      money: 50_000,
      oldBalance: 100,
      newBalance: 50_100,
      crimeScenario: {
        crimeId: 999,
        scenario: "Mob Mentality",
        role: "Looter",
        percentage: 12.5,
      },
    })
  })

  it("parses a plain balance increase without crime details", () => {
    const news =
      `${link(1, "Alice")} increased ${link(2, "Bob")}'s money balance by $500 ` +
      `from $100 to $600`
    const entry = parseFundsNews("u4", { news, timestamp: 1 })
    expect(entry).toMatchObject({
      action: "increased",
      money: 500,
      oldBalance: 100,
      newBalance: 600,
      crimeScenario: null,
    })
  })

  it("parses a balance decrease", () => {
    const news =
      `${link(1, "Alice")} decreased ${link(2, "Bob")}'s money balance by $300 ` +
      `from $600 to $300`
    const entry = parseFundsNews("u5", { news, timestamp: 1 })
    expect(entry).toMatchObject({ action: "decreased", money: 300, oldBalance: 600, newBalance: 300 })
  })
})
