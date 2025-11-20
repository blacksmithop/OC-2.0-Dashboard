import type { ArmoryNewsItem, FetchProgress } from "./types"
import { fetchArmoryNews } from "./api"
import { parseArmoryNewsItems } from "./parser"

export interface FetchOptions {
  maxCount: number
  onProgress?: (progress: FetchProgress) => void
  onError?: (error: Error) => void
  onRateLimit?: (requestCount: number, maxRequests: number, isWaiting: boolean, waitTimeSeconds?: number) => void
  delayMs?: number
  rateLimit?: { requestsPerMinute: number }
}

class RateLimiter {
  private requestTimestamps: number[] = []
  private readonly maxRequests: number
  private readonly timeWindowMs: number
  private onRateLimit?: (
    requestCount: number,
    maxRequests: number,
    isWaiting: boolean,
    waitTimeSeconds?: number,
  ) => void

  constructor(requestsPerMinute: number, onRateLimit?: FetchOptions["onRateLimit"]) {
    this.maxRequests = requestsPerMinute
    this.timeWindowMs = 60000 // 1 minute in milliseconds
    this.onRateLimit = onRateLimit
  }

  getRequestCount(): number {
    const now = Date.now()
    this.requestTimestamps = this.requestTimestamps.filter((timestamp) => now - timestamp < this.timeWindowMs)
    return this.requestTimestamps.length
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now()

    // Remove timestamps older than the time window
    this.requestTimestamps = this.requestTimestamps.filter((timestamp) => now - timestamp < this.timeWindowMs)

    if (this.requestTimestamps.length >= this.maxRequests) {
      // Calculate how long to wait
      const oldestRequest = this.requestTimestamps[0]
      const waitTime = this.timeWindowMs - (now - oldestRequest) + 100 // +100ms buffer
      const waitTimeSeconds = Math.ceil(waitTime / 1000)

      console.log(`[v0] Rate limit reached, waiting ${waitTimeSeconds}s`)

      this.onRateLimit?.(this.requestTimestamps.length, this.maxRequests, true, waitTimeSeconds)

      await new Promise((resolve) => setTimeout(resolve, waitTime))

      // Recursively check again after waiting
      return this.waitForSlot()
    }

    // Record this request
    this.requestTimestamps.push(now)

    this.onRateLimit?.(this.requestTimestamps.length, this.maxRequests, false)
  }
}

/**
 * Fetches historical armory news with pagination and rate limiting
 * @returns Array of parsed armory news items
 */
export async function fetchHistoricalArmoryNews(factionId: string, options: FetchOptions): Promise<ArmoryNewsItem[]> {
  const {
    maxCount,
    onProgress,
    onError,
    onRateLimit,
    delayMs = 2000,
    rateLimit = { requestsPerMinute: 10 }, // Default to 10 requests per minute
  } = options

  const rateLimiter = new RateLimiter(rateLimit.requestsPerMinute, onRateLimit)

  const allNews: ArmoryNewsItem[] = []
  const seenUuids = new Set<string>()
  let toTimestamp: number | undefined = undefined
  let lastOldestId: string | null = null

  try {
    await rateLimiter.waitForSlot()

    // Fetch latest news (fresh, not cached)
    console.log("[v0] Fetching latest armory news (fresh, not cached)")
    const rawNews = await fetchArmoryNews(factionId, undefined, true)

    if (Object.keys(rawNews).length > 0) {
      const parsed = parseArmoryNewsItems(rawNews)
      for (const item of parsed) {
        if (!seenUuids.has(item.uuid)) {
          seenUuids.add(item.uuid)
          allNews.push(item)
        }
      }

      // Sort by timestamp descending
      allNews.sort((a, b) => b.timestamp - a.timestamp)

      // Set pagination timestamp
      if (allNews.length > 0) {
        const oldestInBatch = allNews[allNews.length - 1]
        lastOldestId = oldestInBatch.uuid
        toTimestamp = oldestInBatch.timestamp
      }

      onProgress?.({ current: allNews.length, max: maxCount })
    }

    while (toTimestamp && allNews.length < maxCount) {
      const cacheKey = `armory_to_${toTimestamp}`
      const cachedData = typeof window !== "undefined" ? localStorage.getItem(`crime_api_cache_${cacheKey}`) : null

      if (!cachedData) {
        // Only apply rate limiting for fresh API calls, not cache hits
        await rateLimiter.waitForSlot()
      } else {
        console.log(`[v0] Cache HIT for timestamp ${toTimestamp} - skipping rate limit`)
      }

      console.log(`[v0] Fetching armory news with to=${toTimestamp} (${allNews.length}/${maxCount})`)
      const rawNews = await fetchArmoryNews(factionId, toTimestamp, false)

      if (Object.keys(rawNews).length === 0) {
        console.log("[v0] No more armory news to fetch")
        break
      }

      // Parse batch and filter out duplicates
      const parsedBatch = parseArmoryNewsItems(rawNews)
      const batch: ArmoryNewsItem[] = []

      for (const item of parsedBatch) {
        if (!seenUuids.has(item.uuid)) {
          seenUuids.add(item.uuid)
          batch.push(item)
        }
      }

      if (batch.length === 0) {
        console.log("[v0] No new unique logs in this batch, stopping")
        break
      }

      batch.sort((a, b) => b.timestamp - a.timestamp)

      // Check if we've hit the end
      const oldestInBatch = batch[batch.length - 1]
      if (lastOldestId === oldestInBatch.uuid) {
        console.log("[v0] Reached end of pagination (same oldest ID)")
        break
      }

      lastOldestId = oldestInBatch.uuid
      allNews.push(...batch)

      onProgress?.({ current: allNews.length, max: maxCount })

      // Update pagination timestamp
      toTimestamp = oldestInBatch.timestamp
    }

    allNews.sort((a, b) => b.timestamp - a.timestamp)

    console.log(`[v0] Completed fetching ${allNews.length} armory logs (target: ${maxCount})`)

    return allNews
  } catch (error) {
    console.error("[v0] Error fetching armory news:", error)
    if (onError) {
      onError(error as Error)
    }
    throw error
  }
}
