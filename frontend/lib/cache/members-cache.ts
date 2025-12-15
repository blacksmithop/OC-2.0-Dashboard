import { db, STORES } from "../db/indexeddb"
import type { FactionMember } from "./members-cache"

const MEMBERS_CACHE_KEY = "factionMembersCache"
const MEMBERS_CACHE_EXPIRY_KEY = "factionMembersCacheExpiry"
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function getMembersFromCache(): Promise<Map<number, FactionMember>> {
  try {
    const cached = await db.get(STORES.CACHE, MEMBERS_CACHE_KEY)
    const expiry = await db.get<string>(STORES.CACHE, MEMBERS_CACHE_EXPIRY_KEY)

    if (cached && expiry && Date.now() < Number.parseInt(expiry)) {
      return new Map(Object.entries(cached).map(([key, value]: [string, any]) => [Number.parseInt(key), value]))
    }
  } catch (error) {
    console.error("[v0] Error reading members cache:", error)
  }

  return new Map()
}

export async function fetchAndCacheMembers(apiKey: string): Promise<Map<number, FactionMember>> {
  try {
    const cached = await db.get(STORES.CACHE, MEMBERS_CACHE_KEY)
    const expiry = await db.get<string>(STORES.CACHE, MEMBERS_CACHE_EXPIRY_KEY)

    if (cached && expiry && Date.now() < Number.parseInt(expiry)) {
      console.log("[v0] Using cached members data (still valid)")
      return new Map(Object.entries(cached).map(([key, value]: [string, any]) => [Number.parseInt(key), value]))
    }

    console.log("[v0] Fetching members from API v2 (cache expired or missing)")
    const response = await fetch(`https://api.torn.com/v2/faction/members?key=${apiKey}&comment=oc_dashboard_members`)

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

    if (Array.isArray(data.members)) {
      data.members.forEach((member: any) => {
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
    }

    await db.set(STORES.CACHE, MEMBERS_CACHE_KEY, membersMap, CACHE_DURATION)
    await db.set(STORES.CACHE, MEMBERS_CACHE_EXPIRY_KEY, (Date.now() + CACHE_DURATION).toString())
    console.log("[v0] Cached members data for 5 minutes")

    return new Map(Object.entries(membersMap).map(([key, value]) => [Number.parseInt(key), value]))
  } catch (error) {
    console.error("[v0] Error fetching members:", error)
    const cachedData = await getMembersFromCache()
    if (cachedData.size > 0) {
      console.log("[v0] Falling back to cached members data")
      return cachedData
    }
    throw error
  }
}
