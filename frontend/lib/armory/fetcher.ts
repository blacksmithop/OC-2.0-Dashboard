import type { ArmoryNewsItem, FetchProgress } from "./types"
import { fetchArmoryNews } from "./api"
import { parseArmoryNewsItems } from "./parser"

export interface FetchOptions {
  maxCount: number
  onProgress?: (progress: FetchProgress & { requestNumber: number; isCacheHit: boolean }) => void
  onError?: (error: Error) => void
  delayMs?: number
  rateLimit?: { requestsPerMinute: number }
}

class RateLimiter {
  private requestTimestamps: number[] = []
  private readonly maxRequests: number
  private readonly timeWindowMs: number
  private requestCount = 0

  constructor(requestsPerMinute: number) {
    this.maxRequests = requestsPerMinute
    this.timeWindowMs = 60000 // 1 minute in milliseconds
  }

  getRequestNumber(): number {
    return this.requestCount
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now()

    // Remove timestamps older than the time window
    this.requestTimestamps = this.requestTimestamps.filter((timestamp) => now - timestamp < this.timeWindowMs)

    if (this.requestTimestamps.length >= this.maxRequests) {
      // Calculate how long to wait
      const oldestRequest = this.requestTimestamps[0]
      const waitTime = this.timeWindowMs - (now - oldestRequest) + 100 // +100ms buffer

      await new Promise((resolve) => setTimeout(resolve, waitTime))

      // Recursively check again after waiting
      return this.waitForSlot()
    }

    // Record this request
    this.requestTimestamps.push(now)
    this.requestCount++
  }
}

/**
 * Fetches historical armory news with pagination and rate limiting
 * @returns Array of parsed armory news items
 */
export async function fetchHistoricalArmoryNews(factionId: string, options: FetchOptions): Promise<ArmoryNewsItem[]> {
  const { maxCount, onProgress, onError, delayMs = 5000, rateLimit = { requestsPerMinute: 10 } } = options

  if (!factionId) {
    const error = new Error("No faction ID available. Please refresh the dashboard to load faction data.")
    console.error("[v0] fetchHistoricalArmoryNews called without factionId")
    if (onError) {
      onError(error)
    }
    throw error
  }

  const rateLimiter = new RateLimiter(rateLimit.requestsPerMinute)

  const allNews: ArmoryNewsItem[] = []
  const seenUuids = new Set<string>()
  let toTimestamp: number | undefined = undefined
  let lastOldestId: string | null = null

  try {
    await rateLimiter.waitForSlot()

    console.log("[v0] Fetching latest armory news (fresh, not cached)")
    const rawNews = await fetchArmoryNews(factionId, undefined, true)

    if (rawNews && typeof rawNews === "object" && Object.keys(rawNews).length > 0) {
      const parsed = parseArmoryNewsItems(rawNews)
      for (const item of parsed) {
        if (!seenUuids.has(item.uuid)) {
          seenUuids.add(item.uuid)
          allNews.push(item)
        }
      }

      allNews.sort((a, b) => b.timestamp - a.timestamp)

      if (allNews.length > 0) {
        const oldestInBatch = allNews[allNews.length - 1]
        lastOldestId = oldestInBatch.uuid
        toTimestamp = oldestInBatch.timestamp
        console.log(`[v0] First batch fetched, oldest timestamp: ${toTimestamp}, count: ${allNews.length}`)
      }

      onProgress?.({
        current: allNews.length,
        max: maxCount,
        requestNumber: rateLimiter.getRequestNumber(),
        isCacheHit: false,
      })
    }

    while (toTimestamp && allNews.length < maxCount) {
      console.log(`[v0] Fetching next batch with to=${toTimestamp} (current: ${allNews.length}/${maxCount})`)

      const rawNews = await fetchArmoryNews(factionId, toTimestamp, false)

      if (!rawNews || typeof rawNews !== "object" || Object.keys(rawNews).length === 0) {
        console.log("[v0] No more armory news to fetch (empty response)")
        break
      }

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

      const oldestInBatch = batch[batch.length - 1]

      if (lastOldestId === oldestInBatch.uuid) {
        console.log("[v0] Reached end of pagination (same oldest ID)")
        break
      }

      lastOldestId = oldestInBatch.uuid
      allNews.push(...batch)

      console.log(
        `[v0] Added ${batch.length} new logs, total: ${allNews.length}, next oldest: ${oldestInBatch.timestamp}`,
      )

      onProgress?.({
        current: allNews.length,
        max: maxCount,
        requestNumber: rateLimiter.getRequestNumber(),
        isCacheHit: false,
      })

      toTimestamp = oldestInBatch.timestamp

      if (allNews.length < maxCount) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        await rateLimiter.waitForSlot()
      }
    }

    allNews.sort((a, b) => b.timestamp - a.timestamp)
    const finalNews = allNews.slice(0, maxCount)

    console.log(`[v0] Completed fetching ${finalNews.length} armory logs (target: ${maxCount})`)

    return finalNews
  } catch (error) {
    console.error("[v0] Error fetching armory news:", error)
    if (onError) {
      onError(error as Error)
    }
    throw error
  }
}
