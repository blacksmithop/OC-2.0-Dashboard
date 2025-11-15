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
    "crimeApiCache",
  ]

  itemsToClear.forEach((key) => {
    localStorage.removeItem(key)
  })

  console.log("[v0] All cache cleared")
}
