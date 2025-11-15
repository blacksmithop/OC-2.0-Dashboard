export interface TornItem {
  id: number
  name: string
  image: string
  type: string
  sub_type: string
  description?: string
  effect?: string
  requirement?: string
  is_tradable?: boolean
  is_found_in_city?: boolean
  value?: {
    vendor?: {
      country: string
      name: string
    }
    buy_price?: number
    sell_price?: number
    market_price?: number
  }
  circulation?: number
  details?: {
    category: string
    stealth_level?: number
    base_stats?: {
      damage?: number
      accuracy?: number
      armor?: number
    }
    ammo?: string | null
    mods?: Array<any>
  }
}

const ITEMS_CACHE_KEY = "tornItemsCache"
const ITEMS_CACHE_EXPIRY_KEY = "tornItemsCacheExpiry"
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

export async function getItemsFromCache(): Promise<Map<number, TornItem>> {
  try {
    const cached = localStorage.getItem(ITEMS_CACHE_KEY)
    const expiry = localStorage.getItem(ITEMS_CACHE_EXPIRY_KEY)

    if (cached && expiry && Date.now() < Number.parseInt(expiry)) {
      const data = JSON.parse(cached)
      return new Map(Object.entries(data).map(([key, value]: [string, any]) => [Number.parseInt(key), value]))
    }
  } catch (error) {
    console.error("[v0] Error reading items cache:", error)
  }

  return new Map()
}

export async function fetchAndCacheItems(apiKey: string): Promise<Map<number, TornItem>> {
  try {
    const response = await fetch("https://api.torn.com/v2/torn/items?sort=ASC&striptags=true", {
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        accept: "application/json",
      },
    })

    const data = await response.json()

    if (data.error) {
      if (data.error.code === 2) {
        throw new Error("API key does not have access to items")
      }
      throw new Error(data.error.error || "Failed to fetch items")
    }

    const itemsMap: { [key: number]: TornItem } = {}

    Object.values(data.items || {}).forEach((item: any) => {
      itemsMap[item.id] = {
        id: item.id,
        name: item.name,
        image: item.image,
        type: item.type,
        sub_type: item.sub_type,
        description: item.description,
        effect: item.effect,
        requirement: item.requirement,
        is_tradable: item.is_tradable,
        is_found_in_city: item.is_found_in_city,
        value: item.value,
        circulation: item.circulation,
        details: item.details,
      }
    })

    // Cache the items
    localStorage.setItem(ITEMS_CACHE_KEY, JSON.stringify(itemsMap))
    localStorage.setItem(ITEMS_CACHE_EXPIRY_KEY, (Date.now() + CACHE_DURATION).toString())

    return new Map(Object.entries(itemsMap).map(([key, value]) => [Number.parseInt(key), value]))
  } catch (error) {
    console.error("[v0] Error fetching items:", error)
    if (error instanceof Error && error.message.includes("does not have access")) {
      throw error
    }
    // Fall back to cache if available
    return getItemsFromCache()
  }
}
