export interface FactionBalance {
  total: number
  members: Array<{
    id: number
    username: string
    money: number
    points: number
  }>
}

import { db, STORES } from "../db/indexeddb"

const BALANCE_CACHE_KEY = "factionBalance"
const BALANCE_CACHE_TIMESTAMP_KEY = "factionBalanceTimestamp"
const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

export async function fetchAndCacheBalance(apiKey: string): Promise<FactionBalance | null> {
  try {
    const cachedData = await db.get<FactionBalance>(STORES.CACHE, BALANCE_CACHE_KEY)
    const cachedTimestamp = await db.get<string>(STORES.CACHE, BALANCE_CACHE_TIMESTAMP_KEY)

    if (cachedData && cachedTimestamp) {
      const timestamp = Number.parseInt(cachedTimestamp, 10)
      const age = Date.now() - timestamp

      // If cache is still valid (less than 5 minutes old), return it
      if (age < CACHE_DURATION_MS) {
        console.log(`[v0] Using cached balance data (age: ${Math.round(age / 1000)}s)`)
        return cachedData
      }
    }

    // Fetch fresh data
    console.log("[v0] Fetching fresh faction balance...")
    const balanceRes = await fetch("https://api.torn.com/v2/faction/balance?comment=oc_dashboard_balance", {
      headers: { Authorization: `ApiKey ${apiKey}`, accept: "application/json" },
    })

    if (!balanceRes.ok) {
      console.error("[v0] Balance API error:", balanceRes.status)
      // Return cached data if available, even if expired
      if (cachedData) {
        console.log("[v0] Falling back to cached balance data")
        return cachedData
      }
      return null
    }

    const balanceData = await balanceRes.json()

    if (balanceData?.balance) {
      const balanceInfo: FactionBalance = {
        total: balanceData.balance.total || 0,
        members: balanceData.balance.members || [],
      }

      await db.set(STORES.CACHE, BALANCE_CACHE_KEY, balanceInfo, CACHE_DURATION_MS)
      await db.set(STORES.CACHE, BALANCE_CACHE_TIMESTAMP_KEY, Date.now().toString())
      console.log("[v0] Cached fresh balance data")

      return balanceInfo
    }

    return null
  } catch (error) {
    console.error("[v0] Error fetching balance:", error)
    // Return cached data if available
    const cachedData = await db.get<FactionBalance>(STORES.CACHE, BALANCE_CACHE_KEY)
    if (cachedData) {
      console.log("[v0] Falling back to cached balance data after error")
      return cachedData
    }
    return null
  }
}

export async function clearBalanceCache() {
  await db.delete(STORES.CACHE, BALANCE_CACHE_KEY)
  await db.delete(STORES.CACHE, BALANCE_CACHE_TIMESTAMP_KEY)
  console.log("[v0] Balance cache cleared")
}
