export interface MarketplaceListing {
  item_id: number
  player_id: number
  player_name: string
  quantity: number
  price: number
}

export interface MarketplaceData {
  item_id: number
  item_name: string
  market_price: number
  bazaar_average: number
  total_listings: number
  listings: MarketplaceListing[]
}

const priceCache = new Map<number, { price: number; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function getItemMarketPrice(itemId: number): Promise<number | null> {
  // Check cache first
  const cached = priceCache.get(itemId)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price
  }

  try {
    const response = await fetch(`https://weav3r.dev/api/marketplace/${itemId}`)
    
    if (!response.ok) {
      console.log(`[v0] Marketplace API returned ${response.status} for item ${itemId}`)
      return null
    }

    const data: MarketplaceData = await response.json()
    
    if (!data.market_price || data.market_price <= 0) {
      console.log(`[v0] No valid market price for item ${itemId}`)
      return null
    }

    const marketPrice = data.market_price

    // Cache the result
    priceCache.set(itemId, { price: marketPrice, timestamp: Date.now() })

    return marketPrice
  } catch (error) {
    console.log(`[v0] Error fetching marketplace price for item ${itemId}:`, error)
    return null
  }
}
