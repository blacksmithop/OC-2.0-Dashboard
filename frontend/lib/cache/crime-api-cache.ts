import { db, STORES } from "../db/indexeddb"

interface CachedCrimeResponse {
  data: any
  timestamp: number
}

const CACHE_KEY_PREFIX = "crime_api_cache_"
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

/**
 * Cache helper for crime API responses
 * Uses the "to" parameter as the primary cache key
 */
export const crimeApiCache = {
  /**
   * Get cached API response
   */
  async get(cacheKey: string): Promise<any | null> {
    try {
      const cached = await db.get<CachedCrimeResponse>(STORES.CACHE, `${CACHE_KEY_PREFIX}${cacheKey}`)
      if (!cached) return null

      // Check if cache is still valid
      const now = Date.now()
      if (now - cached.timestamp > CACHE_DURATION) {
        await db.delete(STORES.CACHE, `${CACHE_KEY_PREFIX}${cacheKey}`)
        return null
      }

      return cached.data
    } catch (e) {
      console.error("[v0] Failed to read from crime API cache:", e)
      return null
    }
  },

  /**
   * Set cached API response
   */
  async set(cacheKey: string, data: any): Promise<void> {
    try {
      const cached: CachedCrimeResponse = {
        data,
        timestamp: Date.now(),
      }
      await db.set(STORES.CACHE, `${CACHE_KEY_PREFIX}${cacheKey}`, cached, CACHE_DURATION)
    } catch (e) {
      console.error("[v0] Failed to write to crime API cache:", e)
    }
  },

  /**
   * Clear all crime API caches
   */
  async clearAll(): Promise<void> {
    try {
      await db.deleteByPrefix(STORES.CACHE, CACHE_KEY_PREFIX)
      console.log("[v0] Cleared all crime API caches")
    } catch (e) {
      console.error("[v0] Failed to clear crime API cache:", e)
    }
  },

  /**
   * Generate cache key from URL, using the "to" parameter as the primary identifier
   * If no "to" parameter exists, this is the latest/first request
   */
  generateCacheKey(url: string): string {
    try {
      const urlObj = new URL(url)
      const toParam = urlObj.searchParams.get("to")

      if (toParam) {
        return `to_${toParam}`
      }

      // First request (no "to" param) - use "latest" with category
      const category = urlObj.searchParams.get("cat") || "all"
      return `latest_${category}`
    } catch (e) {
      console.error("[v0] Failed to generate cache key:", e)
      return `fallback_${Date.now()}`
    }
  },

  /**
   * Fetch with cache - checks cache first based on "to" parameter
   * @param url Full URL to fetch
   * @param apiKey API key for authorization
   * @param skipCache If true, bypass cache and always fetch fresh (for latest data)
   */
  async fetchWithCache(url: string, apiKey: string, skipCache = false): Promise<any> {
    const cacheKey = this.generateCacheKey(url)

    if (!skipCache) {
      const cached = await this.get(cacheKey)
      if (cached) {
        console.log(`[v0] Cache HIT for: ${cacheKey}`)
        return cached
      }
      console.log(`[v0] Cache MISS for: ${cacheKey}, fetching from API`)
    } else {
      console.log(`[v0] Skipping cache (fresh fetch) for: ${cacheKey}`)
    }

    // Fetch from API
    const response = await fetch(url, {
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }

    const data = await response.json()

    await this.set(cacheKey, data)
    console.log(`[v0] Cached response for: ${cacheKey}`)

    return data
  },
}
