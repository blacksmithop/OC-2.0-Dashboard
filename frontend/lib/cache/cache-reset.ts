import { db, STORES } from "../db/indexeddb"

/**
 * Clears all cached faction data from IndexedDB
 */
export async function clearAllCache() {
  const itemsToClear = [
    // Historical crimes and fetch tracking
    "factionHistoricalCrimes",
    "lastHistoricalFetch",

    // Items cache
    "factionItemsCache",
    "factionItemsTimestamp",
    "tornItems",
    "tornItemsCache",
    "tornItemsCacheExpiry",

    // Armory caches
    "factionArmoryLogs",
    "lastArmoryFetch",
    "armoryNews",
    "armoryMaxFetch",

    // Balance cache
    "factionBalance",
    "factionBalanceTimestamp",

    // Members cache
    "factionMembersCache",
    "factionMembersCacheExpiry",

    // Faction basic info
    "factionBasicCache",
    "factionBasic",
    "factionId",
    "factionName",

    // Crime news
    "factionCrimeNews",
    "factionCrimeNewsTimestamp",

    // Funds cache
    "factionFundsNews",

    // Scope usage
    "scopeUsage",

    // YATA cache
    "yata_members",
    "yata_members_timestamp",

    // FFScouter cache
    "ffscouter_stats",
    "ffscouter_stats_timestamp",
  ]

  // Delete specific cache keys
  for (const key of itemsToClear) {
    await db.delete(STORES.CACHE, key)
  }

  // Clear all crime API cache entries (prefix-based)
  await db.deleteByPrefix(STORES.CACHE, "crime_api_cache_")
  await db.deleteByPrefix(STORES.CACHE, "armory_")

  console.log("[v0] All cache cleared from IndexedDB including dynamic cache entries")
}
