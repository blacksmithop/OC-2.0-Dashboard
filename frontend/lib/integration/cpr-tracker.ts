import { db, STORES } from "@/lib/db/indexeddb"

const CPR_CACHE_KEY = "tornStatsCPRData"
const CPR_CACHE_TIMESTAMP_KEY = "tornStatsCPRTimestamp"
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000

export interface TornStatsCPRData {
  status: boolean
  message: string
  members: {
    [memberId: string]: {
      [crimeName: string]: {
        [roleName: string]: number // CPR percentage
      }
    }
  }
}

// Alias for backwards compatibility
export type CPRTrackerData = TornStatsCPRData

async function getCachedCPRData(): Promise<TornStatsCPRData | null> {
  try {
    const timestamp = await db.get<number>(STORES.CACHE, CPR_CACHE_TIMESTAMP_KEY)
    if (!timestamp) return null
    
    const now = Date.now()
    if (now - timestamp > TWELVE_HOURS_MS) {
      return null
    }
    
    const data = await db.get<TornStatsCPRData>(STORES.CACHE, CPR_CACHE_KEY)
    return data || null
  } catch (error) {
    console.error("[v0] Error reading CPR cache:", error)
    return null
  }
}

async function setCachedCPRData(data: TornStatsCPRData): Promise<void> {
  try {
    await db.set(STORES.CACHE, CPR_CACHE_KEY, data)
    await db.set(STORES.CACHE, CPR_CACHE_TIMESTAMP_KEY, Date.now())
  } catch (error) {
    console.error("[v0] Error caching CPR data:", error)
  }
}

export async function getTornStatsCPRData(apiKey: string, forceRefresh = false): Promise<TornStatsCPRData | null> {
  // Check cache first unless force refresh
  if (!forceRefresh) {
    const cached = await getCachedCPRData()
    if (cached) {
      return cached
    }
  }
  
  try {
    const response = await fetch(`https://www.tornstats.com/api/v2/${apiKey}/faction/cpr`, {
      headers: {
        accept: "application/json",
      },
    })

    if (!response.ok) {
      console.error(`[v0] TornStats API error: ${response.status}`)
      return null
    }

    const data: TornStatsCPRData = await response.json()

    if (!data.status) {
      console.error("[v0] TornStats API returned error:", data.message)
      return null
    }

    // Cache the data
    await setCachedCPRData(data)

    return data
  } catch (error) {
    console.error("[v0] Failed to fetch TornStats CPR data:", error)
    return null
  }
}

// Alias for backwards compatibility
export const getCPRTrackerData = async (apiKey: string, _factionId?: number): Promise<TornStatsCPRData | null> => {
  return getTornStatsCPRData(apiKey)
}

export interface MemberRecommendation {
  memberId: number
  memberName: string
  cpr: number
  isInOC: boolean
}

export function getRecommendedMembers(
  cprData: CPRTrackerData | null,
  crimeName: string,
  roleName: string,
  membersNotInOC: Set<number>,
  minPassRate: number,
): MemberRecommendation[] {
  if (!cprData) {
    return []
  }

  const recommendations: MemberRecommendation[] = []

  // Iterate through all members
  Object.entries(cprData.members).forEach(([memberIdStr, crimeData]) => {
    const memberId = Number.parseInt(memberIdStr)

    // Check if member has CPR data for this crime/role
    const crimeInfo = crimeData[crimeName]
    if (!crimeInfo) return

    const cpr = crimeInfo[roleName]
    if (cpr === undefined) return

    // Check if meets minimum CPR
    if (cpr >= minPassRate) {
      recommendations.push({
        memberId,
        memberName: "", // Will be filled from members list
        cpr,
        isInOC: !membersNotInOC.has(memberId),
      })
    }
  })

  // Sort by: 1) Not in OC first, 2) CPR descending
  recommendations.sort((a, b) => {
    if (a.isInOC !== b.isInOC) {
      return a.isInOC ? 1 : -1 // Members not in OC first
    }
    return b.cpr - a.cpr
  })

  return recommendations
}

// Clear cache function for when settings change
// Removed as per updates
