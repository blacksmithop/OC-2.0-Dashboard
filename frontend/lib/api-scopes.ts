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

export function saveSelectedScopes(scopes: string[]): void {
  localStorage.setItem("apiScopes", JSON.stringify(scopes))
}

export function getSelectedScopes(): string[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem("apiScopes")
  if (!stored) {
    return API_SCOPES.filter((s) => s.required).map((s) => s.id)
  }
  return JSON.parse(stored)
}

export function hasScope(scope: string): boolean {
  const selected = getSelectedScopes()
  return selected.includes(scope)
}

export function canReloadIndividualCrimes(): boolean {
  return hasScope("crime")
}

export function canAccessArmory(): boolean {
  return hasScope("armorynews")
}

export function canAccessBalance(): boolean {
  return hasScope("balance")
}

export function canAccessFunds(): boolean {
  return hasScope("fundsnews")
}

// Added canAccessCrimeNews function
export function canAccessCrimeNews(): boolean {
  return hasScope("crimenews")
}

export function canAccessMedical(): boolean {
  return hasScope("medical")
}
