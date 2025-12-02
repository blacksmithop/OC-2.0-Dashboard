export interface CPRTrackerData {
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

export async function getCPRTrackerData(apiKey: string, factionId: number): Promise<CPRTrackerData | null> {
  try {
    console.log("[v0] Fetching CPR Tracker data")
    const response = await fetch(`https://ufd.abhinavkm.com/cpr/faction/${factionId}/members`, {
      headers: {
        accept: "application/json",
        "X-API-Key": apiKey,
      },
    })

    if (!response.ok) {
      console.error(`[v0] CPR Tracker API error: ${response.status}`)
      return null
    }

    const data: CPRTrackerData = await response.json()

    if (!data.status) {
      console.error("[v0] CPR Tracker API returned error:", data.message)
      return null
    }

    return data
  } catch (error) {
    console.error("[v0] Failed to fetch CPR Tracker data:", error)
    return null
  }
}

export interface MemberRecommendation {
  memberId: number
  memberName: string
  cpr: number
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

    // Check if member is not in any OC
    if (!membersNotInOC.has(memberId)) {
      return
    }

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
      })
    }
  })

  // Sort by CPR descending
  recommendations.sort((a, b) => b.cpr - a.cpr)

  return recommendations
}

// Clear cache function for when settings change
// Removed as per updates
