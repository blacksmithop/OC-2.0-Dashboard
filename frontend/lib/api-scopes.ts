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
    description: "Faction member data",
    required: true,
    category: "faction",
  },
  {
    id: "crimes",
    name: "crimes",
    description: "Organized crimes data",
    required: true,
    category: "faction",
  },
  {
    id: "crime",
    name: "crime",
    description: "Individual crime refresh (enables per-crime reload)",
    required: false,
    category: "faction",
  },
  {
    id: "armorynews",
    name: "armorynews",
    description: "Armory news logs",
    required: false,
    category: "faction",
  },
  {
    id: "balance",
    name: "balance",
    description: "Member balance information",
    required: false,
    category: "faction",
  },
  {
    id: "fundsnews",
    name: "fundsnews",
    description: "Fund transfer logs",
    required: false,
    category: "faction",
  },
  {
    id: "items",
    name: "items",
    description: "Item database for crime rewards",
    required: true,
    category: "torn",
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
    // Default to all scopes if not set
    return API_SCOPES.map((s) => s.id)
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
