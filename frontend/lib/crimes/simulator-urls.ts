// Utility to generate crime simulator URLs for CrimesHub
const SIMULATOR_BASE_URL = "https://crimeshub-2b4b0.firebaseapp.com/oc"

// List of crimes with known simulators
const CRIME_SIMULATORS: Record<string, string> = {
  "Ace in the Hole": "aceinthehole/v2",
  "Bidding War": "biddingwar",
  "Blast from the Past": "blastfromthepast",
  "Break the Bank": "breakthebank/v2",
  "Cash Me if You Can": "cashmeifyoucan",
  "Clinical Precision": "clinicalprecision",
  "Counter Offer": "countereffor",
  "Crane Reaction": "cranereaction",
  "Guardian Angels": "guardianangels",
  "Gaslight the Way": "gaslighttheway",
  "Gone Fission": "gonefission",
  "Honeytrap": "honeytrap",
  "Manifest Cruelty": "manifestcruelty",
  "Mob Mentality": "mobmentality",
  "Market Forces": "marketforces",
  "Leave No Trace": "leavenotrace",
  "No Reserve": "noreserve",
  "Sneaky Git Grab": "sneakygitgrab",
  "Stacking the Deck": "stackingthedeck",
  "Stage Fright": "stagefright",
  "Snow Blind": "snowblind",
  "Smoke and Wing Mirrors": "smokeandwingmirrors",
}

// Mapping from API position names to CrimesHub parameter names
// Some crimes have numbered positions (e.g., Muscle 1, Muscle 2)
const POSITION_NAME_MAP: Record<string, Record<string, string>> = {
  "Stage Fright": {
    Sniper: "Sniper",
    Enforcer: "Enforcer",
    Lookout: "Lookout",
  },
}

export interface CrimeSlotForSimulator {
  position: string
  checkpoint_pass_rate?: number
  user?: { id: number } | null
}

/**
 * Get the simulator URL for a given crime name, optionally with CPR values pre-loaded
 * @param crimeName The name of the crime
 * @param slots Optional slots with CPR data to pre-load in the simulator
 * @param isPlanning Whether the crime is in Planning status (to include CPR params)
 * @returns The full simulator URL or null if not available
 */
export function getSimulatorUrl(
  crimeName: string,
  slots?: CrimeSlotForSimulator[],
  isPlanning = false,
): string | null {
  const simulatorPath = CRIME_SIMULATORS[crimeName]
  if (!simulatorPath) {
    return null
  }

  let url = `${SIMULATOR_BASE_URL}/${simulatorPath}`

  // Add CPR parameters for Planning phase with filled slots
  if (isPlanning && slots && slots.length > 0) {
    const params = new URLSearchParams()
    const positionCounts: Record<string, number> = {}

    for (const slot of slots) {
      if (slot.user && slot.checkpoint_pass_rate !== undefined) {
        // Track position occurrences for numbered positions
        const basePosition = slot.position
        positionCounts[basePosition] = (positionCounts[basePosition] || 0) + 1

        // Determine the parameter name
        let paramName = basePosition

        // Check if we need to number this position
        const samePositionSlots = slots.filter((s) => s.position === basePosition)
        if (samePositionSlots.length > 1) {
          // Use numbered format: "Muscle 1", "Muscle 2", etc.
          paramName = `${basePosition} ${positionCounts[basePosition]}`
        }

        // Check for custom mapping
        const crimeMapping = POSITION_NAME_MAP[crimeName]
        if (crimeMapping && crimeMapping[basePosition]) {
          paramName = crimeMapping[basePosition]
        }

        params.append(paramName, Math.round(slot.checkpoint_pass_rate).toString())
      }
    }

    const queryString = params.toString()
    if (queryString) {
      url += `?${queryString}`
    }
  }

  return url
}

/**
 * Check if a simulator is available for a given crime
 * @param crimeName The name of the crime
 * @returns true if a simulator is available, false otherwise
 */
export function hasSimulator(crimeName: string): boolean {
  return crimeName in CRIME_SIMULATORS
}
