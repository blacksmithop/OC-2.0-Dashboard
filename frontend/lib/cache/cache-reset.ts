/**
 * Clears all cached faction data from localStorage
 */
export function clearAllCache() {
  const itemsToClear = [
    // Historical crimes and fetch tracking
    "factionHistoricalCrimes",
    "lastHistoricalFetch",

    // Items cache
    "factionItemsCache",
    "factionItemsTimestamp",
    "tornItems",

    // Armory caches
    "factionArmoryLogs",
    "lastArmoryFetch",
    "armoryNews",
    "armoryMaxFetch",

    // API caches
    "crimeApiCache",

    // Balance cache
    "factionBalance",
    "factionBalanceTimestamp",

    // Members cache
    "factionMembersCache",
    "factionMembersTimestamp",

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

    // API scopes
    "apiScopes",
  ]

  itemsToClear.forEach((key) => {
    localStorage.removeItem(key)
  })

  try {
    const keys = Object.keys(localStorage)
    keys.forEach((key) => {
      if (key.startsWith("crime_api_cache_")) {
        localStorage.removeItem(key)
      }
      if (key.startsWith("armory_")) {
        localStorage.removeItem(key)
      }
    })
  } catch (e) {
    console.error("[v0] Error clearing dynamic cache keys:", e)
  }

  console.log("[v0] All cache cleared including dynamic cache entries")
}
