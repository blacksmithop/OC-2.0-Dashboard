export interface YataMemberData {
  id: number
  name: string
  status: string
  last_action: number
  dif: number
  crimes_rank: number
  nnb: number
  nnb_share: number
  [key: string]: any
}

interface YataResponse {
  members: {
    [key: string]: YataMemberData
  }
  timestamp: number
}

const YATA_CACHE_KEY = "yata_members_cache"
const YATA_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

import { thirdPartySettingsManager } from "@/lib/settings/third-party-manager"

export async function fetchYataMembers(apiKey: string): Promise<Map<number, YataMemberData>> {
  const settings = await thirdPartySettingsManager.getSettings()
  if (!settings.yata?.enabled) {
    console.log("[v0] YATA integration is disabled in settings")
    return new Map()
  }

  // Check cache first
  const cached = localStorage.getItem(YATA_CACHE_KEY)
  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached)
      if (Date.now() - timestamp < YATA_CACHE_DURATION) {
        console.log("[v0] Using cached YATA data")
        return new Map(Object.entries(data).map(([id, member]: [string, any]) => [Number.parseInt(id), member]))
      }
    } catch (err) {
      console.error("[v0] Error parsing YATA cache:", err)
    }
  }

  // Fetch fresh data from YATA API
  try {
    console.log("[v0] Fetching YATA member data...")
    const response = await fetch(`https://yata.yt/api/v1/faction/members/?key=${apiKey}`)

    if (!response.ok) {
      console.error(`[v0] YATA API returned status ${response.status}`)
      return new Map()
    }

    const result: YataResponse = await response.json()

    if (!result.members) {
      console.error("[v0] YATA API returned no members data")
      return new Map()
    }

    // Cache the result
    const dataToCache = Object.fromEntries(
      Object.entries(result.members).map(([id, member]) => [Number.parseInt(id), member]),
    )
    localStorage.setItem(
      YATA_CACHE_KEY,
      JSON.stringify({
        data: dataToCache,
        timestamp: Date.now(),
      }),
    )

    console.log(`[v0] Fetched YATA data for ${Object.keys(result.members).length} members`)
    return new Map(Object.entries(result.members).map(([id, member]) => [Number.parseInt(id), member]))
  } catch (err) {
    console.error("[v0] Error fetching YATA data:", err)
    return new Map()
  }
}
