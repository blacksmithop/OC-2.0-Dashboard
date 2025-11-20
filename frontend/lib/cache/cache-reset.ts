/**
 * Clears all cached faction data from localStorage
 */
export function clearAllCache() {
  const itemsToClear = [
    "factionHistoricalCrimes",
    "lastHistoricalFetch",

    "factionItemsCache",
    "factionItemsTimestamp",
    "tornItems",

    "factionArmoryLogs",
    "lastArmoryFetch",
    "armoryNews",
    "armoryMaxFetch",

    "crimeApiCache",

    "factionBalance",
    "factionBalanceTimestamp",

    "factionMembersCache",
    "factionMembersTimestamp",

    "factionBasicCache",
    "factionBasic",
    "factionId",
    "factionName",

    "factionCrimeNews",
    "factionCrimeNewsTimestamp",

    "factionFundsNews",

    "scopeUsage",

    "yata_members",
    "yata_members_timestamp",

    "ffscouter_stats",
    "ffscouter_stats_timestamp",

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
