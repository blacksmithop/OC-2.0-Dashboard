export interface FactionMember {
  id: number
  name: string
  status: {
    state: string
    until?: number
    description?: string
  }
  position: string
  level: number
  days_in_faction: number
  last_action?: {
    timestamp: number
    relative: string
  }
}

const MEMBERS_CACHE_KEY = "factionMembersCache"
const MEMBERS_CACHE_EXPIRY_KEY = "factionMembersCacheExpiry"
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function getMembersFromCache(): Promise<Map<number, FactionMember>> {
  try {
    const cached = localStorage.getItem(MEMBERS_CACHE_KEY)
    const expiry = localStorage.getItem(MEMBERS_CACHE_EXPIRY_KEY)

    if (cached && expiry && Date.now() < Number.parseInt(expiry)) {
      const data = JSON.parse(cached)
      return new Map(Object.entries(data).map(([key, value]: [string, any]) => [Number.parseInt(key), value]))
    }
  } catch (error) {
    console.error("[v0] Error reading members cache:", error)
  }

  return new Map()
}

export async function fetchAndCacheMembers(apiKey: string): Promise<Map<number, FactionMember>> {
  try {
    // Check if we have valid cached data first
    const cached = localStorage.getItem(MEMBERS_CACHE_KEY)
    const expiry = localStorage.getItem(MEMBERS_CACHE_EXPIRY_KEY)

    if (cached && expiry && Date.now() < Number.parseInt(expiry)) {
      console.log("[v0] Using cached members data (still valid)")
      const data = JSON.parse(cached)
      return new Map(Object.entries(data).map(([key, value]: [string, any]) => [Number.parseInt(key), value]))
    }

    // Cache expired or doesn't exist, fetch from API
    console.log("[v0] Fetching members from API (cache expired or missing)")
    const response = await fetch("https://api.torn.com/v2/faction/members?striptags=true", {
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      if (data.error.code === 2) {
        throw new Error("API key does not have access to faction members")
      }
      throw new Error(data.error.error || "Failed to fetch members")
    }

    const membersMap: { [key: number]: FactionMember } = {}

    Object.values(data.members || {}).forEach((member: any) => {
      membersMap[member.id] = {
        id: member.id,
        name: member.name,
        status: member.status,
        position: member.position,
        level: member.level,
        days_in_faction: member.days_in_faction,
        last_action: member.last_action,
      }
    })

    // Cache the members
    localStorage.setItem(MEMBERS_CACHE_KEY, JSON.stringify(membersMap))
    localStorage.setItem(MEMBERS_CACHE_EXPIRY_KEY, (Date.now() + CACHE_DURATION).toString())
    console.log("[v0] Cached members data for 5 minutes")

    return new Map(Object.entries(membersMap).map(([key, value]) => [Number.parseInt(key), value]))
  } catch (error) {
    console.error("[v0] Error fetching members:", error)
    if (error instanceof Error && error.message.includes("does not have access")) {
      throw error
    }
    // Fall back to cache if available
    console.log("[v0] Falling back to cached members data")
    return getMembersFromCache()
  }
}
