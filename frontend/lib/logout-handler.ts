export function handleFullLogout() {
  // Clear API key
  localStorage.removeItem("factionApiKey")

  // Clear API scope selections
  localStorage.removeItem("apiScopes")

  // Clear all cache data
  localStorage.removeItem("factionHistoricalCrimes")
  localStorage.removeItem("lastHistoricalFetch")
  localStorage.removeItem("factionCrimes")
  localStorage.removeItem("factionMembers")
  localStorage.removeItem("itemsCache")
  localStorage.removeItem("itemsCacheExpiry")
  localStorage.removeItem("armoryLogs")

  // Clear crime API cache
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith("crime_api_cache_")) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key))
}
