// Utility to generate crime simulator URLs for CrimesHub
const SIMULATOR_BASE_URL = "https://crimeshub-2b4b0.firebaseapp.com/oc"

// List of crimes with known simulators
const CRIME_SIMULATORS: Record<string, string> = {
  "Ace in the Hole": "aceinthehole/v2",
  "Stacking the Deck": "stackingthedeck",
  "Break the Bank": "breakthebank/v2",
  "Clinical Precision": "clinicalprecision",
  "Blast from the Past": "blastfromthepast",
  "Honeytrap": "honeytrap",
  "Bidding War": "biddingwar",
  "Leave No Trace": "leavenotrace",
  "Counter Offer": "counteroffer",
  "No Reserve": "noreserve",
  "Stage Fright": "stagefright",
  "Snowblind": "snowblind",
  "Gaslight the Way": "gaslighttheway",
  "Market Forces": "marketforces",
  "Smoke and Wing Mirrors": "smokeandwingmirrors",
  "Cash Me if You Can": "cashmeifyoucan",
}

/**
 * Get the simulator URL for a given crime name
 * @param crimeName The name of the crime
 * @returns The full simulator URL or null if not available
 */
export function getSimulatorUrl(crimeName: string): string | null {
  const simulatorPath = CRIME_SIMULATORS[crimeName]
  if (!simulatorPath) {
    return null
  }
  return `${SIMULATOR_BASE_URL}/${simulatorPath}`
}

/**
 * Check if a simulator is available for a given crime
 * @param crimeName The name of the crime
 * @returns true if a simulator is available, false otherwise
 */
export function hasSimulator(crimeName: string): boolean {
  return crimeName in CRIME_SIMULATORS
}
