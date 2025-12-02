import itemsFallback from "./data/items-fallback.json"

export interface TornItem {
  id: number
  name: string
  description: string
  effect: string | null
  image: string
  type: string
  sub_type: string | null
  circulation: number
}

export function getItemFromFallback(itemId: number): TornItem | null {
  const item = itemsFallback.items.find((i: any) => i.id === itemId)
  if (!item) return null

  return {
    id: item.id,
    name: item.name,
    description: item.description,
    effect: item.effect,
    image: item.image,
    type: item.type,
    sub_type: item.sub_type,
    circulation: item.circulation,
  }
}

export function getItemData(itemId: number, cachedItems?: Map<string, TornItem>): TornItem | null {
  // Try cached items first
  if (cachedItems) {
    const cached = cachedItems.get(itemId.toString())
    if (cached) return cached
  }

  // Fall back to local dataset
  return getItemFromFallback(itemId)
}
