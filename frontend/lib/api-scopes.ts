import { db, STORES } from "./db/indexeddb"

export interface ApiScope {
  id: string
  name: string
  description: string
  required: boolean
  category: "faction" | "torn"
}

export const API_SCOPES: ApiScope[] = [
  {
    id: "basic",
    name: "basic",
    description: "Basic faction information",
    required: true,
    category: "faction",
  },
  {
    id: "members",
    name: "members",
    description: "Faction member list",
    required: true,
    category: "faction",
  },
  {
    id: "crimes",
    name: "crimes",
    description: "Faction OC history",
    required: true,
    category: "faction",
  },
  {
    id: "crime",
    name: "crime",
    description: "OC Information",
    required: true,
    category: "faction",
  },
  {
    id: "items",
    name: "items",
    description: "Items in Torn",
    required: true,
    category: "torn",
  },
  {
    id: "armorynews",
    name: "armorynews",
    description: "Faction armory logs",
    required: false,
    category: "faction",
  },
  {
    id: "balance",
    name: "balance",
    description: "Faction member balance",
    required: false,
    category: "faction",
  },
  {
    id: "fundsnews",
    name: "fundsnews",
    description: "Faction funds logs",
    required: false,
    category: "faction",
  },
  {
    id: "crimenews",
    name: "crimenews",
    description: "OC Scope usage",
    required: true,
    category: "faction",
  },
  {
    id: "medical",
    name: "medical",
    description: "Faction medical items",
    required: false,
    category: "faction",
  },
]

export function buildApiKeyUrl(selectedScopes: string[]): string {
  const factionScopes = selectedScopes
    .filter((scope) => {
      const scopeInfo = API_SCOPES.find((s) => s.id === scope)
      return scopeInfo?.category === "faction"
    })
    .join(",")

  const tornScopes = selectedScopes
    .filter((scope) => {
      const scopeInfo = API_SCOPES.find((s) => s.id === scope)
      return scopeInfo?.category === "torn"
    })
    .join(",")

  return `https://www.torn.com/preferences.php#tab=api?step=addNewKey&title=TornOCApp&faction=${factionScopes}&torn=${tornScopes}`
}

export async function saveSelectedScopes(scopes: string[]): Promise<void> {
  await db.set(STORES.SETTINGS, "apiScopes", scopes)
}

export async function getSelectedScopes(): Promise<string[]> {
  if (typeof window === "undefined") return []
  const stored = await db.get<string[]>(STORES.SETTINGS, "apiScopes")
  if (!stored) {
    return API_SCOPES.filter((s) => s.required).map((s) => s.id)
  }
  return stored
}

export async function hasScope(scope: string): Promise<boolean> {
  const selected = await getSelectedScopes()
  return selected.includes(scope)
}

export async function canReloadIndividualCrimes(): Promise<boolean> {
  return hasScope("crime")
}

export async function canAccessArmory(): Promise<boolean> {
  return hasScope("armorynews")
}

export async function canAccessBalance(): Promise<boolean> {
  return hasScope("balance")
}

export async function canAccessFunds(): Promise<boolean> {
  return hasScope("fundsnews")
}

export async function canAccessCrimeNews(): Promise<boolean> {
  return hasScope("crimenews")
}

export async function canAccessMedical(): Promise<boolean> {
  return hasScope("medical")
}
