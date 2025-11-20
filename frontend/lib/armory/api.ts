import { crimeApiCache } from "@/lib/cache/crime-api-cache"
import type { ArmoryApiResponse } from "./types"

/**
 * Fetches armory news from the Torn API
 * @param factionId - The faction ID to fetch news for
 * @param to - Optional timestamp to fetch older news (for pagination)
 * @param skipCache - Whether to skip cache and force a fresh API call
 */
export async function fetchArmoryNews(
  factionId: string,
  to?: number,
  skipCache = false,
): Promise<Record<string, { news: string; timestamp: number }>> {
  const apiKey = localStorage.getItem("factionApiKey")
  if (!apiKey) throw new Error("No API key found")

  // Check cache first (unless skipping or no timestamp)
  if (!skipCache && to) {
    const cacheKey = `armory_to_${to}`
    const cachedData = crimeApiCache.get(cacheKey)
    if (cachedData) {
      console.log(`[v0] Armory API cache HIT for timestamp: ${to}`)
      return cachedData
    }
  }

  // Build API URL
  let url = `https://api.torn.com/faction/${factionId}?selections=armorynews&striptags=true&comment=oc_dashboard_armorynews`
  if (to) {
    url += `&to=${to}`
  }

  console.log(`[v0] Fetching armory news from API${to ? ` (to=${to})` : " (fresh)"}`)

  const response = await fetch(url, {
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`)
  }

  const data: ArmoryApiResponse = await response.json()

  // Handle API errors
  if (data.error) {
    if (data.error.code === 16 || data.error.code === 2) {
      const error = new Error("API_ACCESS_DENIED")
      ;(error as any).code = data.error.code
      throw error
    }
    throw new Error(data.error.error || "API error")
  }

  const armorynews = data.armorynews || {}

  // Cache the response if we have a timestamp
  if (to) {
    const cacheKey = `armory_to_${to}`
    crimeApiCache.set(cacheKey, armorynews)
    console.log(`[v0] Cached armory response for timestamp: ${to}`)
  }

  return armorynews
}

/**
 * Loads cached armory news from localStorage
 */
export function loadCachedArmoryNews(): any[] {
  const cached = localStorage.getItem("armoryNews")
  if (cached) {
    try {
      return JSON.parse(cached)
    } catch (error) {
      console.error("[v0] Error loading cached armory news:", error)
    }
  }
  return []
}

/**
 * Saves armory news to localStorage cache
 */
export function saveCachedArmoryNews(news: any[]): void {
  localStorage.setItem("armoryNews", JSON.stringify(news))
}

/**
 * Clears all armory-related cache data
 */
export function clearArmoryCache(): void {
  localStorage.removeItem("armoryNews")
  localStorage.removeItem("armoryMaxFetch")

  // Clear API cache entries that start with "armory_"
  const cacheKeys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) || "")
  for (const key of cacheKeys) {
    if (key.startsWith("crime_api_cache_") && key.includes("armory_to_")) {
      localStorage.removeItem(key)
    }
  }

  console.log("[v0] Cleared all armory cache data including API cache")
}
