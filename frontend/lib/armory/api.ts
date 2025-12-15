import { crimeApiCache } from "@/lib/cache/crime-api-cache"
import { apiKeyManager } from "@/lib/auth/api-key-manager"
import { db, STORES } from "@/lib/db/indexeddb"
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
): Promise<Record<string, { news: string; timestamp: number }> | null> {
  if (!factionId) {
    console.error("[v0] No factionId provided to fetchArmoryNews")
    return null
  }

  const apiKey = await apiKeyManager.getApiKey()
  if (!apiKey) {
    console.error("[v0] No API key found")
    return null
  }

  if (!skipCache && to) {
    const cacheKey = `armory_to_${to}`
    const cachedData = await crimeApiCache.get(cacheKey)
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

  const armorynews = data.armorynews || null

  // Cache the response if we have a timestamp
  if (to && armorynews) {
    const cacheKey = `armory_to_${to}`
    crimeApiCache.set(cacheKey, armorynews)
    console.log(`[v0] Cached armory response for timestamp: ${to}`)
  }

  return armorynews
}

/**
 * Loads cached armory news from IndexedDB
 */
export async function loadCachedArmoryNews(): Promise<any[]> {
  try {
    const cached = await db.get<any[]>(STORES.CACHE, "armoryNews")
    if (cached) {
      return cached
    }
  } catch (error) {
    console.error("[v0] Error loading cached armory news:", error)
  }
  return []
}

/**
 * Saves armory news to IndexedDB cache
 */
export async function saveCachedArmoryNews(news: any[]): Promise<void> {
  try {
    await db.set(STORES.CACHE, "armoryNews", news)
  } catch (error) {
    console.error("[v0] Error saving armory news to cache:", error)
  }
}

/**
 * Clears all armory-related cache data
 */
export async function clearArmoryCache(): Promise<void> {
  try {
    await db.delete(STORES.CACHE, "armoryNews")
    await db.delete(STORES.CACHE, "armoryMaxFetch")

    // Clear API cache entries that start with "armory_"
    const allKeys = await db.getAllKeys(STORES.CACHE)
    for (const key of allKeys) {
      if (typeof key === "string" && key.startsWith("armory_to_")) {
        await db.delete(STORES.CACHE, key)
      }
    }

    console.log("[v0] Cleared all armory cache data from IndexedDB")
  } catch (error) {
    console.error("[v0] Error clearing armory cache:", error)
  }
}
