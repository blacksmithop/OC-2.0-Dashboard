import { db, STORES } from "@/lib/db/indexeddb"
import type { Crime } from "@/types/crime"
import type { TornStatsCPRData } from "@/lib/integration/cpr-tracker"

const CPR_CACHE_KEY = "aggregatedCPRData"
const CPR_CACHE_TIMESTAMP_KEY = "aggregatedCPRTimestamp"
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000

export interface MemberCPREntry {
  memberId: number
  memberName: string
  cpr: number
  source: "crime" | "tornstats"
  crimeId?: number
  timestamp?: number
}

export interface RoleCPRData {
  roleName: string
  entries: MemberCPREntry[]
}

export interface CrimeCPRData {
  crimeName: string
  roles: Map<string, RoleCPRData>
}

export interface AggregatedCPRData {
  crimes: Map<string, CrimeCPRData>
  lastUpdated: number
}

// Serializable version for storage
interface SerializableCPRData {
  crimes: Record<string, {
    crimeName: string
    roles: Record<string, RoleCPRData>
  }>
  lastUpdated: number
}

function serializeCPRData(data: AggregatedCPRData): SerializableCPRData {
  const crimes: SerializableCPRData["crimes"] = {}
  for (const [crimeName, crimeData] of data.crimes) {
    const roles: Record<string, RoleCPRData> = {}
    for (const [roleName, roleData] of crimeData.roles) {
      roles[roleName] = roleData
    }
    crimes[crimeName] = { crimeName, roles }
  }
  return { crimes, lastUpdated: data.lastUpdated }
}

function deserializeCPRData(data: SerializableCPRData): AggregatedCPRData {
  const crimes = new Map<string, CrimeCPRData>()
  for (const [crimeName, crimeData] of Object.entries(data.crimes)) {
    const roles = new Map<string, RoleCPRData>()
    for (const [roleName, roleData] of Object.entries(crimeData.roles)) {
      roles.set(roleName, roleData)
    }
    crimes.set(crimeName, { crimeName, roles })
  }
  return { crimes, lastUpdated: data.lastUpdated }
}

export async function getCachedCPRData(): Promise<AggregatedCPRData | null> {
  try {
    const timestamp = await db.get<number>(STORES.CACHE, CPR_CACHE_TIMESTAMP_KEY)
    if (!timestamp) return null

    const now = Date.now()
    if (now - timestamp > TWELVE_HOURS_MS) {
      return null
    }

    const data = await db.get<SerializableCPRData>(STORES.CACHE, CPR_CACHE_KEY)
    return data ? deserializeCPRData(data) : null
  } catch (error) {
    console.error("[v0] Error reading CPR cache:", error)
    return null
  }
}

export async function saveCPRData(data: AggregatedCPRData): Promise<void> {
  try {
    await db.set(STORES.CACHE, CPR_CACHE_KEY, serializeCPRData(data))
    await db.set(STORES.CACHE, CPR_CACHE_TIMESTAMP_KEY, Date.now())
  } catch (error) {
    console.error("[v0] Error caching CPR data:", error)
  }
}

/**
 * Get the highest CPR for a specific member for a crime/role
 * This is useful for the Organized Crimes page to look up CPR data
 */
export async function getMemberCPRForRole(
  memberId: number,
  crimeName: string,
  roleName: string
): Promise<number | null> {
  const data = await getCachedCPRData()
  if (!data) return null
  
  const crimeData = data.crimes.get(crimeName)
  if (!crimeData) return null
  
  const roleData = crimeData.roles.get(roleName)
  if (!roleData) return null
  
  const entry = roleData.entries.find(e => e.memberId === memberId)
  return entry ? entry.cpr : null
}

/**
 * Get all CPR data for a specific member across all crimes/roles
 * Returns a map of crimeName -> roleName -> cpr
 */
export async function getMemberAllCPR(
  memberId: number
): Promise<Map<string, Map<string, number>>> {
  const result = new Map<string, Map<string, number>>()
  
  const data = await getCachedCPRData()
  if (!data) return result
  
  for (const [crimeName, crimeData] of data.crimes) {
    for (const [roleName, roleData] of crimeData.roles) {
      const entry = roleData.entries.find(e => e.memberId === memberId)
      if (entry) {
        if (!result.has(crimeName)) {
          result.set(crimeName, new Map())
        }
        result.get(crimeName)!.set(roleName, entry.cpr)
      }
    }
  }
  
  return result
}

/**
 * Get all CPR entries for a specific crime/role
 * Useful for showing which members can fill a role
 */
export async function getCPREntriesForRole(
  crimeName: string,
  roleName: string
): Promise<MemberCPREntry[]> {
  const data = await getCachedCPRData()
  if (!data) return []
  
  const crimeData = data.crimes.get(crimeName)
  if (!crimeData) return []
  
  const roleData = crimeData.roles.get(roleName)
  if (!roleData) return []
  
  // Return sorted by CPR descending
  return [...roleData.entries].sort((a, b) => b.cpr - a.cpr)
}

export const DEFAULT_MIN_CPR = 70
const MIN_CPR_SETTINGS_KEY = "minCPRSettings"

export interface MinCPRSettings {
  [crimeName: string]: {
    [roleName: string]: number
  }
}

/**
 * Get min CPR settings for all crimes/roles
 */
export async function getMinCPRSettings(): Promise<MinCPRSettings> {
  const settings = await db.get<MinCPRSettings>(STORES.SETTINGS, MIN_CPR_SETTINGS_KEY)
  return settings || {}
}

/**
 * Get min CPR for a specific crime/role, with default fallback
 */
export async function getMinCPRForRole(crimeName: string, roleName: string): Promise<number> {
  const settings = await getMinCPRSettings()
  return settings[crimeName]?.[roleName] ?? DEFAULT_MIN_CPR
}

/**
 * Get recommended members for a role using aggregated CPR data
 * This replaces the TornStats-only recommendation system
 */
export async function getRecommendedMembersFromCPR(
  crimeName: string,
  roleName: string,
  membersNotInOC: Set<number>,
  minPassRate?: number
): Promise<MemberCPREntry[]> {
  const entries = await getCPREntriesForRole(crimeName, roleName)
  const effectiveMinRate = minPassRate ?? await getMinCPRForRole(crimeName, roleName)
  
  // Filter by min CPR and sort: members not in OC first, then by CPR desc
  const filtered = entries.filter(e => e.cpr >= effectiveMinRate)
  
  return filtered.sort((a, b) => {
    const aInOC = !membersNotInOC.has(a.memberId)
    const bInOC = !membersNotInOC.has(b.memberId)
    
    if (aInOC !== bInOC) {
      return aInOC ? 1 : -1 // Members not in OC first
    }
    return b.cpr - a.cpr
  })
}

/**
 * Extract CPR data from completed crimes (Successful, Failed, Expired)
 * Only caches CPR from these statuses
 */
export function extractCPRFromCompletedCrimes(
  crimes: Crime[],
  memberNames: Map<number, string>
): AggregatedCPRData {
  // Match completed statuses case-insensitively
  const completedStatuses = ["successful", "failed", "failure", "expired"]
  const completedCrimes = crimes.filter(c => completedStatuses.includes(c.status.toLowerCase()))
  
  const crimesMap = new Map<string, CrimeCPRData>()

  for (const crime of completedCrimes) {
    if (!crimesMap.has(crime.name)) {
      crimesMap.set(crime.name, {
        crimeName: crime.name,
        roles: new Map()
      })
    }
    
    const crimeData = crimesMap.get(crime.name)!
    
    for (const slot of crime.slots) {
      if (slot.user && slot.checkpoint_pass_rate !== undefined) {
        const roleName = slot.position
        
        if (!crimeData.roles.has(roleName)) {
          crimeData.roles.set(roleName, {
            roleName,
            entries: []
          })
        }
        
        const roleData = crimeData.roles.get(roleName)!
        
        // Check if this member already has an entry for this role
        const existingIdx = roleData.entries.findIndex(e => e.memberId === slot.user!.id)
        const newEntry: MemberCPREntry = {
          memberId: slot.user.id,
          memberName: memberNames.get(slot.user.id) || slot.user.name || `ID: ${slot.user.id}`,
          cpr: slot.checkpoint_pass_rate,
          source: "crime",
          crimeId: crime.id,
          timestamp: crime.executed_at || crime.created_at
        }
        
        if (existingIdx >= 0) {
          // Keep the more recent entry
          const existing = roleData.entries[existingIdx]
          if (!existing.timestamp || (newEntry.timestamp && newEntry.timestamp > existing.timestamp)) {
            roleData.entries[existingIdx] = newEntry
          }
        } else {
          roleData.entries.push(newEntry)
        }
      }
    }
  }
  
  return {
    crimes: crimesMap,
    lastUpdated: Date.now()
  }
}

/**
 * Extract CPR from active crimes (Recruiting, Planning)
 * These are always fresh and override cached data
 */
export function extractCPRFromActiveCrimes(
  crimes: Crime[],
  memberNames: Map<number, string>
): AggregatedCPRData {
  // Match active statuses case-insensitively
  const activeStatuses = ["recruiting", "planning"]
  const activeCrimes = crimes.filter(c => activeStatuses.includes(c.status.toLowerCase()))
  
  const crimesMap = new Map<string, CrimeCPRData>()

  for (const crime of activeCrimes) {
    if (!crimesMap.has(crime.name)) {
      crimesMap.set(crime.name, {
        crimeName: crime.name,
        roles: new Map()
      })
    }
    
    const crimeData = crimesMap.get(crime.name)!
    
    for (const slot of crime.slots) {
      if (slot.user && slot.checkpoint_pass_rate !== undefined) {
        const roleName = slot.position
        
        if (!crimeData.roles.has(roleName)) {
          crimeData.roles.set(roleName, {
            roleName,
            entries: []
          })
        }
        
        const roleData = crimeData.roles.get(roleName)!
        
        // For active crimes, always use the latest data
        const existingIdx = roleData.entries.findIndex(e => e.memberId === slot.user!.id)
        const newEntry: MemberCPREntry = {
          memberId: slot.user.id,
          memberName: memberNames.get(slot.user.id) || slot.user.name || `ID: ${slot.user.id}`,
          cpr: slot.checkpoint_pass_rate,
          source: "crime",
          crimeId: crime.id,
          timestamp: Date.now()
        }
        
        if (existingIdx >= 0) {
          roleData.entries[existingIdx] = newEntry
        } else {
          roleData.entries.push(newEntry)
        }
      }
    }
  }
  
  return {
    crimes: crimesMap,
    lastUpdated: Date.now()
  }
}

/**
 * Extract CPR from TornStats data
 * Only includes members that exist in memberNames (current faction members)
 * Keeps the HIGHEST CPR per member per role per crime
 */
export function extractCPRFromTornStats(
  tornStatsData: TornStatsCPRData,
  memberNames: Map<number, string>
): AggregatedCPRData {
  const crimesMap = new Map<string, CrimeCPRData>()

  for (const [memberIdStr, memberCrimes] of Object.entries(tornStatsData.members)) {
    const memberId = parseInt(memberIdStr)
    
    // Only include members that are still in the faction
    if (!memberNames.has(memberId)) {
      continue
    }
    
    const memberName = memberNames.get(memberId) || `ID: ${memberId}`

    for (const [crimeName, roles] of Object.entries(memberCrimes)) {
      if (!crimesMap.has(crimeName)) {
        crimesMap.set(crimeName, {
          crimeName,
          roles: new Map()
        })
      }
      
      const crimeData = crimesMap.get(crimeName)!

      for (const [roleName, cpr] of Object.entries(roles)) {
        if (!crimeData.roles.has(roleName)) {
          crimeData.roles.set(roleName, {
            roleName,
            entries: []
          })
        }
        
        const roleData = crimeData.roles.get(roleName)!
        
        // Check if member already has an entry
        const existingIdx = roleData.entries.findIndex(e => e.memberId === memberId)
        const newEntry: MemberCPREntry = {
          memberId,
          memberName,
          cpr,
          source: "tornstats"
        }
        
        if (existingIdx >= 0) {
          // Keep the HIGHEST CPR entry
          if (cpr > roleData.entries[existingIdx].cpr) {
            roleData.entries[existingIdx] = newEntry
          }
        } else {
          roleData.entries.push(newEntry)
        }
      }
    }
  }
  
  return {
    crimes: crimesMap,
    lastUpdated: Date.now()
  }
}

/**
 * Extract CPR from ALL crimes regardless of status
 * This captures any crime with checkpoint_pass_rate data
 * Only includes members that exist in memberNames (current faction members)
 * Keeps the HIGHEST CPR per member per role per crime
 */
export function extractCPRFromAllCrimes(
  crimes: Crime[],
  memberNames: Map<number, string>
): AggregatedCPRData {
  const crimesMap = new Map<string, CrimeCPRData>()

  for (const crime of crimes) {
    if (!crimesMap.has(crime.name)) {
      crimesMap.set(crime.name, {
        crimeName: crime.name,
        roles: new Map()
      })
    }
    
    const crimeData = crimesMap.get(crime.name)!
    
    for (const slot of crime.slots) {
      if (slot.user && slot.checkpoint_pass_rate !== undefined) {
        // Only include members that are still in the faction
        if (!memberNames.has(slot.user.id)) {
          continue
        }
        
        const roleName = slot.position
        
        if (!crimeData.roles.has(roleName)) {
          crimeData.roles.set(roleName, {
            roleName,
            entries: []
          })
        }
        
        const roleData = crimeData.roles.get(roleName)!
        
        // Check if this member already has an entry for this role
        const existingIdx = roleData.entries.findIndex(e => e.memberId === slot.user!.id)
        const newEntry: MemberCPREntry = {
          memberId: slot.user.id,
          memberName: memberNames.get(slot.user.id) || slot.user.name || `ID: ${slot.user.id}`,
          cpr: slot.checkpoint_pass_rate,
          source: "crime",
          crimeId: crime.id,
          timestamp: crime.executed_at || crime.created_at || Date.now()
        }
        
        if (existingIdx >= 0) {
          // Keep the HIGHEST CPR entry
          const existing = roleData.entries[existingIdx]
          if (newEntry.cpr > existing.cpr) {
            roleData.entries[existingIdx] = newEntry
          }
        } else {
          roleData.entries.push(newEntry)
        }
      }
    }
  }
  
  return {
    crimes: crimesMap,
    lastUpdated: Date.now()
  }
}

/**
 * Merge multiple CPR data sources
 * Priority: Active crimes > TornStats > Completed crimes (cached)
 */
export function mergeCPRData(...sources: AggregatedCPRData[]): AggregatedCPRData {
  const merged = new Map<string, CrimeCPRData>()

  for (const source of sources) {
    for (const [crimeName, crimeData] of source.crimes) {
      if (!merged.has(crimeName)) {
        merged.set(crimeName, {
          crimeName,
          roles: new Map()
        })
      }
      
      const mergedCrime = merged.get(crimeName)!
      
      for (const [roleName, roleData] of crimeData.roles) {
        if (!mergedCrime.roles.has(roleName)) {
          mergedCrime.roles.set(roleName, {
            roleName,
            entries: []
          })
        }
        
        const mergedRole = mergedCrime.roles.get(roleName)!
        
        for (const entry of roleData.entries) {
          const existingIdx = mergedRole.entries.findIndex(e => e.memberId === entry.memberId)
          
          if (existingIdx >= 0) {
            // Later sources override earlier ones
            mergedRole.entries[existingIdx] = entry
          } else {
            mergedRole.entries.push(entry)
          }
        }
      }
    }
  }
  
  // Sort entries by CPR descending within each role
  for (const crimeData of merged.values()) {
    for (const roleData of crimeData.roles.values()) {
      roleData.entries.sort((a, b) => b.cpr - a.cpr)
    }
  }
  
  return {
    crimes: merged,
    lastUpdated: Date.now()
  }
}

/**
 * Update CPR data in the background from crimes
 * This is called from the crimes page to keep CPR data fresh
 */
export async function updateCPRDataInBackground(
  crimes: Crime[],
  memberNames: Map<number, string>
): Promise<void> {
  try {
    // Extract CPR from all available crimes
    const newCPRData = extractCPRFromAllCrimes(crimes, memberNames)
    
    // Get existing cached data
    const existingData = await getCachedCPRData()
    
    if (existingData) {
      // Merge new data with existing (new data takes priority)
      const merged = mergeCPRData(existingData, newCPRData)
      await saveCPRData(merged)
    } else {
      // No existing data, just save the new data
      await saveCPRData(newCPRData)
    }
    
    console.log("[v0] CPR data updated in background")
  } catch (error) {
    console.error("[v0] Failed to update CPR data in background:", error)
  }
}
