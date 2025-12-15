import { db, STORES } from "../db/indexeddb"

export interface CrimeNewsItem {
  news: string
  timestamp: number
}

const CACHE_KEY = "factionCrimeNews"
const CACHE_TIMESTAMP_KEY = "factionCrimeNewsTimestamp"
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function fetchAndCacheCrimeNews(apiKey: string): Promise<Map<string, CrimeNewsItem>> {
  // Check cache first
  const cached = await db.get(STORES.CACHE, CACHE_KEY)
  const cacheTimestamp = await db.get<string>(STORES.CACHE, CACHE_TIMESTAMP_KEY)

  if (cached && cacheTimestamp) {
    const age = Date.now() - Number.parseInt(cacheTimestamp)
    if (age < CACHE_DURATION) {
      console.log("[v0] Using cached crime news data")
      const newsMap = new Map<string, CrimeNewsItem>()
      Object.entries(cached).forEach(([id, item]) => {
        newsMap.set(id, item as CrimeNewsItem)
      })
      return newsMap
    }
  }

  // Fetch from API
  console.log("[v0] Fetching fresh crime news from API")
  const response = await fetch("https://api.torn.com/faction/?selections=crimenews&comment=oc_dashboard_crimenews", {
    headers: { Authorization: `ApiKey ${apiKey}`, accept: "application/json" },
  })

  if (!response.ok) {
    // Try to return cached data even if expired
    if (cached) {
      console.log("[v0] API failed, using expired cache")
      const newsMap = new Map<string, CrimeNewsItem>()
      Object.entries(cached).forEach(([id, item]) => {
        newsMap.set(id, item as CrimeNewsItem)
      })
      return newsMap
    }
    throw new Error(`Failed to fetch crime news: ${response.status}`)
  }

  const data = await response.json()
  const crimenews = data.crimenews || {}

  // Cache the data
  await db.set(STORES.CACHE, CACHE_KEY, crimenews, CACHE_DURATION)
  await db.set(STORES.CACHE, CACHE_TIMESTAMP_KEY, Date.now().toString())

  const newsMap = new Map<string, CrimeNewsItem>()
  Object.entries(crimenews).forEach(([id, item]) => {
    newsMap.set(id, item as CrimeNewsItem)
  })

  return newsMap
}
