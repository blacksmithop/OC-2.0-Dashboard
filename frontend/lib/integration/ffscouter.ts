interface FFScouterResult {
  player_id: number
  fair_fight: number | null
  bs_estimate: number | null
  bs_estimate_human: string | null
  last_updated: number | null
}

interface FFScouterCache {
  data: Map<number, FFScouterResult>
  timestamp: number
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
let cache: FFScouterCache | null = null
import { thirdPartySettingsManager } from "@/lib/settings/third-party-manager"

export async function fetchFFScouterStats(memberIds: number[]): Promise<Map<number, FFScouterResult>> {
  // Check cache first
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data
  }

  const settings = await thirdPartySettingsManager.getSettings()
  if (!settings.ffScouter?.enabled) return new Map()

  const apiKey = await thirdPartySettingsManager.getFFScouterApiKey()
  if (!apiKey) return new Map()

  const results = new Map<number, FFScouterResult>()

  // Split into chunks of 205 IDs max per request
  const chunks: number[][] = []
  for (let i = 0; i < memberIds.length; i += 205) {
    chunks.push(memberIds.slice(i, i + 205))
  }

  try {
    for (const chunk of chunks) {
      const targetsParam = chunk.join(",")
      const url = `https://ffscouter.com/api/v1/get-stats?key=${apiKey}&targets=${targetsParam}`

      const response = await fetch(url)
      if (!response.ok) {
        console.error("[v0] FF Scouter API error:", response.status)
        continue
      }

      const data: FFScouterResult[] = await response.json()
      data.forEach((result) => {
        results.set(result.player_id, result)
      })
    }

    // Update cache
    cache = {
      data: results,
      timestamp: Date.now(),
    }

    return results
  } catch (error) {
    console.error("[v0] Failed to fetch FF Scouter data:", error)
    return new Map()
  }
}
