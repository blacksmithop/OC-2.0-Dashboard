import type { ArmoryNewsItem } from "./types"

// Regex patterns for parsing armory news
const RETRIEVE_RE =
  /<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+retrieved\s+(?:1x )?([^<]+)\s+from\s+<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>/i
const USE_FILL_GIVE_RE =
  /<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+(used|filled|gave)\s+one of the faction's\s+([^<]+)\s+items?/i
const DEPOSIT_RE = /<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+deposited\s+(\d+)\s*(?:x\s*)?([^<]+)/i
const GIVE_SELF_RE =
  /<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+gave\s+(\d+)x\s+([^<]+)\s+to themselves from the faction armory/i
const CRIME_CUT_RE =
  /<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+gave\s+<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+(\d+)x\s+([^<]+)\s+as\s+their\s+([\d.]+)%\s+cut\s+(?:for their role as\s+([^<]+)\s+in the faction's\s+([^<]+)\s+scenario\s+\[<a href\s*=\s*"[^"]*crimeId=(\d+)">view<\/a>\])?/i
const LOANED_RE =
  /<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+loaned\s+(\d+)x\s+([^<]+)\s+to\s+<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+from the faction armory/i
const RETURNED_RE = /<a href\s*=\s*"[^"]*XID=(\d+)">([^<]+)<\/a>\s+returned\s+(\d+)x\s+([^<]+)/i

/**
 * Parses a single armory news HTML string into structured data
 */
export function parseArmoryNews(uuid: string, timestamp: number, news: string): ArmoryNewsItem | null {
  try {
    // Retrieve
    let match = news.match(RETRIEVE_RE)
    if (match) {
      return {
        uuid,
        timestamp,
        news,
        action: "retrieved",
        user: { name: match[2], id: Number.parseInt(match[1]) },
        target: { name: match[5], id: Number.parseInt(match[4]) },
        item: { name: match[3].trim(), quantity: 1 },
      }
    }

    // Use/Fill/Gave (one of faction's)
    match = news.match(USE_FILL_GIVE_RE)
    if (match) {
      return {
        uuid,
        timestamp,
        news,
        action: match[3].toLowerCase() as "used" | "filled" | "gave",
        user: { name: match[2], id: Number.parseInt(match[1]) },
        item: { name: match[4].trim(), quantity: 1 },
      }
    }

    // Deposit
    match = news.match(DEPOSIT_RE)
    if (match) {
      return {
        uuid,
        timestamp,
        news,
        action: "deposited",
        user: { name: match[2], id: Number.parseInt(match[1]) },
        item: { name: match[4].trim(), quantity: Number.parseInt(match[3]) },
      }
    }

    // Give to self
    match = news.match(GIVE_SELF_RE)
    if (match) {
      return {
        uuid,
        timestamp,
        news,
        action: "gave",
        user: { name: match[2], id: Number.parseInt(match[1]) },
        item: { name: match[4].trim(), quantity: Number.parseInt(match[3]) },
      }
    }

    // Crime reward cut
    match = news.match(CRIME_CUT_RE)
    if (match) {
      const result: ArmoryNewsItem = {
        uuid,
        timestamp,
        news,
        action: "gave",
        user: { name: match[2], id: Number.parseInt(match[1]) },
        target: { name: match[4], id: Number.parseInt(match[3]) },
        item: { name: match[6].trim(), quantity: Number.parseInt(match[5]) },
      }
      if (match[10]) {
        result.crimeScenario = {
          crime_id: Number.parseInt(match[10]),
          scenario: match[9].trim(),
          role: match[8].trim(),
          percentage: Number.parseFloat(match[7]),
        }
      }
      return result
    }

    // Loaned
    match = news.match(LOANED_RE)
    if (match) {
      return {
        uuid,
        timestamp,
        news,
        action: "loaned",
        user: { name: match[2], id: Number.parseInt(match[1]) },
        target: { name: match[6], id: Number.parseInt(match[5]) },
        item: { name: match[4].trim(), quantity: Number.parseInt(match[3]) },
      }
    }

    // Returned
    match = news.match(RETURNED_RE)
    if (match) {
      return {
        uuid,
        timestamp,
        news,
        action: "returned",
        user: { name: match[2], id: Number.parseInt(match[1]) },
        item: { name: match[4].trim(), quantity: Number.parseInt(match[3]) },
      }
    }

    return null
  } catch (error) {
    console.error("[v0] Error parsing armory news:", news, error)
    return null
  }
}

/**
 * Parses multiple armory news items from API response
 */
export function parseArmoryNewsItems(rawNews: Record<string, { news: string; timestamp: number }>): ArmoryNewsItem[] {
  const items: ArmoryNewsItem[] = []

  for (const [uuid, data] of Object.entries(rawNews)) {
    const parsed = parseArmoryNews(uuid, data.timestamp, data.news)
    if (parsed) {
      items.push(parsed)
    }
  }

  return items
}
