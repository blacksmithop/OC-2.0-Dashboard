// Role weight data with fallback
const STATIC_ROLE_WEIGHTS = {
  "Mob Mentality": {
    Looter1: 33.97,
    Looter2: 26.49,
    Looter3: 18.36,
    Looter4: 21.18
  },
  "Pet Project": {
    Kidnapper: 30.93,
    Muscle: 32.63,
    Picklock: 36.44
  },
  "Cash Me If You Can": {
    Thief1: 54.18,
    Thief2: 28.04,
    Lookout: 17.78
  },
  "Best of the Lot": {
    Picklock: 20.73,
    "Car Thief": 19.53,
    Muscle: 43.68,
    Imitator: 16.06
  },
  "Market Forces": {
    Enforcer: 29.40,
    Negotiator: 27.23,
    Lookout: 16.37,
    Arsonist: 4.46,
    Muscle: 22.55
  },
  "Smoke and Wing Mirrors": {
    "Car Thief": 50.90,
    Imitator: 27.11,
    Hustler1: 9.00,
    Hustler2: 13.00
  },
  "Gaslight the Way": {
    Imitator1: 9.39,
    Imitator2: 27.46,
    Imitator3: 41.32,
    Looter1: 9.39,
    Looter2: 0.00,
    Looter3: 12.42
  },
  "Stage Fright": {
    Enforcer: 15.67,
    Muscle1: 20.01,
    Muscle2: 2.66,
    Muscle3: 9.17,
    Lookout: 6.19,
    Sniper: 46.30
  },
  "Snow Blind": {
    Hustler: 48.41,
    Imitator: 34.57,
    Muscle1: 8.51,
    Muscle2: 8.51
  },
  "Leave No Trace": {
    Techie: 29.01,
    Negotiator: 34.13,
    Imitator: 36.86
  },
  "No Reserve": {
    "Car Thief": 30.51,
    Techie: 38.37,
    Engineer: 31.12
  },
  "Counter Offer": {
    Robber: 35.95,
    Looter: 7.00,
    Hacker: 12.13,
    Picklock: 16.54,
    Engineer: 28.39
  },
  "Guardian Ángels": {
    Enforcer: 27.40,
    Hustler: 42.10,
    Engineer: 30.49
  },
  "Honey Trap": {
    Enforcer: 26.98,
    Muscle1: 30.87,
    Muscle2: 42.15
  },
  "Bidding War": {
    Robber1: 7.10,
    Driver: 12.54,
    Robber2: 22.87,
    Robber3: 31.67,
    Bomber1: 7.85,
    Bomber2: 17.97
  },
  "Sneaky Git Grab": {
    Imitator: 17.54,
    Pickpocket: 50.83,
    Hacker: 14.48,
    Techie: 17.15
  },
  "Blast from the Past": {
    Picklock1: 10.85,
    Hacker: 12.06,
    Engineer: 24.02,
    Bomber: 15.62,
    Muscle: 34.59,
    Picklock2: 2.87
  },
  "Break the Bank": {
    Robber: 12.70,
    Muscle1: 13.52,
    Muscle2: 10.10,
    Thief1: 2.93,
    Muscle3: 31.65,
    Thief2: 29.10
  },
  "Stacking the Deck": {
    "Cat Burglar": 23.43,
    Driver: 2.96,
    Hacker: 25.44,
    Imitator: 48.17
  },
  "Clinical Precision": {
    Imitator: 43.32,
    "Cat Burglar": 18.94,
    Assassin: 16.06,
    Cleaner: 21.69
  },
  "Ace in the Hole": {
    Imitator: 21.08,
    Muscle1: 18.30,
    Muscle2: 24.65,
    Hacker: 28.34,
    Driver: 7.63
  }
}

let cachedRoleWeights: typeof STATIC_ROLE_WEIGHTS | null = null
let lastFetch = 0
const CACHE_DURATION = 3600000 // 1 hour

export async function getRoleWeights(): Promise<typeof STATIC_ROLE_WEIGHTS> {
  // Return cached data if fresh
  if (cachedRoleWeights && Date.now() - lastFetch < CACHE_DURATION) {
    return cachedRoleWeights
  }

  try {
    const response = await fetch('https://tornproxy.abhinavkm.com/weights', {
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })

    if (response.ok) {
      const data = await response.json()
      // Normalize the data to match our format
      const normalized: typeof STATIC_ROLE_WEIGHTS = {}
      
      for (const [crimeName, roles] of Object.entries(data)) {
        // Convert camelCase to Title Case with spaces
        const formattedName = crimeName
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .replace(/^./, (str) => str.toUpperCase())
        
        normalized[formattedName] = roles as any
      }
      
      cachedRoleWeights = normalized
      lastFetch = Date.now()
      return normalized
    }
  } catch (error) {
    console.log('[v0] Failed to fetch role weights from API, using static fallback')
  }

  // Fallback to static data
  cachedRoleWeights = STATIC_ROLE_WEIGHTS
  lastFetch = Date.now()
  return STATIC_ROLE_WEIGHTS
}

export function getRoleWeight(crimeName: string, roleName: string): number | null {
  if (!cachedRoleWeights) return null
  
  const crimeWeights = cachedRoleWeights[crimeName]
  if (!crimeWeights) return null
  
  return crimeWeights[roleName] ?? null
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
