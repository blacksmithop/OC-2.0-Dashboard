/**
 * Clears all cached faction data from localStorage
 */
export function clearAllCache() {
  const itemsToClear = [
    "factionHistoricalCrimes",
    "lastHistoricalFetch",
    "factionItemsCache",
    "factionItemsTimestamp",
    "factionArmoryLogs",
    "lastArmoryFetch",
    "armoryNews", // Current armory logs
    "armoryMaxFetch", // Armory fetch configuration
    "crimeApiCache",
    "factionBalance",
    "factionBalanceTimestamp",
    "factionMembersCache",
    "factionMembersTimestamp",
    "factionBasicCache",
    "factionBasic", // Legacy format
  ]

  itemsToClear.forEach((key) => {
    localStorage.removeItem(key)
  })

  console.log("[v0] All cache cleared")
}
