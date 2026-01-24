import { db, STORES } from "@/lib/db/indexeddb"

const WEIGHTS_CACHE_KEY = "roleWeights"
const WEIGHTS_TIMESTAMP_KEY = "roleWeightsTimestamp"
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

// Type for role weights from API
export type RoleWeightsData = {
  [crimeName: string]: {
    [roleName: string]: number
  }
}

// In-memory cache
let cachedRoleWeights: RoleWeightsData | null = null

async function getCachedWeights(): Promise<RoleWeightsData | null> {
  // Check in-memory cache first
  if (cachedRoleWeights) {
    return cachedRoleWeights
  }

  try {
    const timestamp = await db.get<number>(STORES.CACHE, WEIGHTS_TIMESTAMP_KEY)
    if (!timestamp) return null

    const now = Date.now()
    if (now - timestamp > THREE_DAYS_MS) {
      return null
    }

    const data = await db.get<RoleWeightsData>(STORES.CACHE, WEIGHTS_CACHE_KEY)
    if (data) {
      cachedRoleWeights = data
    }
    return data || null
  } catch (error) {
    console.error("[v0] Error reading weights cache:", error)
    return null
  }
}

async function setCachedWeights(data: RoleWeightsData): Promise<void> {
  try {
    cachedRoleWeights = data
    await db.set(STORES.CACHE, WEIGHTS_CACHE_KEY, data)
    await db.set(STORES.CACHE, WEIGHTS_TIMESTAMP_KEY, Date.now())
  } catch (error) {
    console.error("[v0] Error caching weights:", error)
  }
}

export async function getRoleWeights(): Promise<RoleWeightsData> {
  // Check cache first
  const cached = await getCachedWeights()
  if (cached) {
    return cached
  }

  try {
    const response = await fetch("https://tornproxy.abhinavkm.com/weights", {
      signal: AbortSignal.timeout(5000),
    })

    if (response.ok) {
      const data = await response.json()
      // Normalize the data - convert camelCase crime names to Title Case with spaces
      const normalized: RoleWeightsData = {}

      for (const [crimeName, roles] of Object.entries(data)) {
        // Convert camelCase to Title Case with spaces (e.g., "BiddingWar" -> "Bidding War")
        const formattedName = crimeName.replace(/([A-Z])/g, " $1").trim()

        normalized[formattedName] = roles as { [key: string]: number }
      }

      await setCachedWeights(normalized)
      return normalized
    }
  } catch (error) {
    console.error("[v0] Failed to fetch role weights from API:", error)
  }

  // Return empty object if fetch fails - only show weights for known roles
  return {}
}

export function getRoleWeight(
  roleWeights: RoleWeightsData,
  crimeName: string,
  roleName: string,
  slotIndex: number,
): number | null {
  if (!roleWeights) return null

  const crimeWeights = roleWeights[crimeName]
  if (!crimeWeights) return null

  // Try exact match first (e.g., "Driver")
  if (crimeWeights[roleName] !== undefined) {
    return crimeWeights[roleName]
  }

  // Try with index suffix (e.g., "Robber" -> "Robber1", "Robber2", etc.)
  // Count how many slots with this role name come before this one
  const indexedRoleName = `${roleName}${slotIndex + 1}`
  if (crimeWeights[indexedRoleName] !== undefined) {
    return crimeWeights[indexedRoleName]
  }

  return null
}

export function getWeightColor(weight: number): string {
  if (weight >= 40) return "text-red-400"
  if (weight >= 30) return "text-orange-400"
  if (weight >= 20) return "text-yellow-400"
  return "text-green-400"
}

export function getWeightBgColor(weight: number): string {
  if (weight >= 40) return "bg-red-500/20 border-red-500/40"
  if (weight >= 30) return "bg-orange-500/20 border-orange-500/40"
  if (weight >= 20) return "bg-yellow-500/20 border-yellow-500/40"
  return "bg-green-500/20 border-green-500/40"
}

// Check if low CPR member is in high weight role
export function shouldAlertLowCPR(passRate: number, weight: number, minPassRate: number): boolean {
  return passRate < minPassRate && weight >= 30
}
