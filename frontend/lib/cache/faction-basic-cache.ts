export interface FactionBasic {
  id: number
  name: string
  tag: string
  tag_image: string
  leader_id: number
  co_leader_id: number
  respect: number
  days_old: number
  capacity: number
  members: number
  is_enlisted: boolean
  rank: {
    level: number
    name: string
    division: number
    position: number
    wins: number
  }
  best_chain: number
}

const CACHE_KEY = "factionBasicCache"
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

interface CachedData {
  data: FactionBasic
  timestamp: number
}

export async function fetchAndCacheFactionBasic(apiKey: string): Promise<FactionBasic> {
  // Check cache first
  const cached = localStorage.getItem(CACHE_KEY)
  if (cached) {
    try {
      const cachedData: CachedData = JSON.parse(cached)
      const now = Date.now()
      
      // If cache is still valid, return it
      if (now - cachedData.timestamp < CACHE_DURATION) {
        console.log("[v0] Using cached faction basic data")
        return cachedData.data
      }
    } catch (e) {
      console.error("[v0] Failed to parse cached faction basic:", e)
    }
  }

  // Fetch from API
  console.log("[v0] Fetching faction basic data from API")
  const response = await fetch("https://api.torn.com/v2/faction/basic?striptags=true", {
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch faction basic data")
  }

  const data = await response.json()

  if (data.error) {
    if (data.error.code === 2) {
      throw new Error("API key does not have access to faction basic info")
    }
    throw new Error(data.error.error || "Failed to fetch faction basic data")
  }

  const factionBasic: FactionBasic = data.basic

  // Cache the data
  const cacheData: CachedData = {
    data: factionBasic,
    timestamp: Date.now(),
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
  
  // Also store in legacy format for backward compatibility
  localStorage.setItem("factionBasic", JSON.stringify(data))
  localStorage.setItem("factionId", factionBasic.id.toString())
  localStorage.setItem("factionName", factionBasic.name)

  return factionBasic
}
