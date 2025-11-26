export interface CrimeScenario {
  name: string
  level: number
  length: number // in days
  people: number
  tools: string[]
  materials: string[]
}

export const CRIME_SCENARIOS: Record<string, CrimeScenario> = {
  "Mob Mentality": {
    name: "Mob Mentality",
    level: 1,
    length: 4,
    people: 4,
    tools: ["Jemmy", "Jemmy"],
    materials: [],
  },
  "Pet Project": {
    name: "Pet Project",
    level: 1,
    length: 3,
    people: 3,
    tools: ["Net", "Lockpicks"],
    materials: ["Dog Treats"],
  },
  "Cash Me If You Can": {
    name: "Cash Me If You Can",
    level: 2,
    length: 3,
    people: 3,
    tools: [],
    materials: ["ID Badge", "ATM Key"],
  },
  "Best of the Lot": {
    name: "Best of the Lot",
    level: 2,
    length: 4,
    people: 4,
    tools: ["Lockpicks", "Police Badge"],
    materials: [],
  },
  "Smoke and Wing Mirrors": {
    name: "Smoke and Wing Mirrors",
    level: 3,
    length: 4,
    people: 4,
    tools: ["DSLR Camera", "RF Detector"],
    materials: [],
  },
  "Market Forces": {
    name: "Market Forces",
    level: 3,
    length: 5,
    people: 5,
    tools: [],
    materials: ["Gasoline"],
  },
  "Gaslight the Way": {
    name: "Gaslight the Way",
    level: 3,
    length: 6,
    people: 6,
    tools: ["Construction Helmet", "Construction Helmet", "Construction Helmet"],
    materials: ["ID Badge", "ID Badge", "ID Badge"],
  },
  "Snow Blind": {
    name: "Snow Blind",
    level: 4,
    length: 4,
    people: 4,
    tools: [],
    materials: ["PCP"],
  },
  "Stage Fright": {
    name: "Stage Fright",
    level: 4,
    length: 6,
    people: 6,
    tools: ["Binoculars"],
    materials: [],
  },
  "Guardian Angels": {
    name: "Guardian Angels",
    level: 5,
    length: 3,
    people: 3,
    tools: [],
    materials: ["Hand Drill"],
  },
  "Leave No Trace": {
    name: "Leave No Trace",
    level: 5,
    length: 3,
    people: 3,
    tools: ["Police Badge", "Police Badge"],
    materials: [],
  },
  "Counter Offer": {
    name: "Counter Offer",
    level: 5,
    length: 5,
    people: 5,
    tools: ["Wire Cutters", "Lockpicks"],
    materials: ["Zip Ties", "Zip Ties", "Polymorphic Virus"],
  },
  "No Reserve": {
    name: "No Reserve",
    level: 5,
    length: 3,
    people: 3,
    tools: ["Bolt Cutters"],
    materials: ["Spray Paint : Black", "Chloroform"],
  },
  "Bidding War": {
    name: "Bidding War",
    level: 6,
    length: 6,
    people: 6,
    tools: ["Jemmy", "Dental Mirror"],
    materials: ["C4 Explosive", "C4 Explosive", "Flash Grenade"],
  },
  "Honey Trap": {
    name: "Honey Trap",
    level: 6,
    length: 3,
    people: 3,
    tools: ["Billfold", "Billfold"],
    materials: [],
  },
  "Sneaky Git Grab": {
    name: "Sneaky Git Grab",
    level: 6,
    length: 4,
    people: 4,
    tools: ["Wireless Dongle"],
    materials: ["Tunneling Virus"],
  },
  "Blast from the Past": {
    name: "Blast from the Past",
    level: 7,
    length: 6,
    people: 6,
    tools: [],
    materials: ["Core Drill", "Zip Ties", "Shaped Charge", "Firewalk Virus"],
  },
  "Break the Bank": {
    name: "Break the Bank",
    level: 8,
    length: 6,
    people: 6,
    tools: ["Hand Drill", "Hand Drill", "Hand Drill", "Hand Drill", "Hand Drill"],
    materials: ["Zip Ties"],
  },
  "Stacking the Deck": {
    name: "Stacking the Deck",
    level: 8,
    length: 4,
    people: 4,
    tools: ["Jemmy"],
    materials: ["Smoke Grenade", "ID Badge", "Stealth Virus"],
  },
  "Ace in the Hole": {
    name: "Ace in the Hole",
    level: 9,
    length: 5,
    people: 5,
    tools: [],
    materials: ["ID Badge"],
  },
}

export function getScenarioInfo(scenarioName: string): CrimeScenario | undefined {
  return CRIME_SCENARIOS[scenarioName]
}
