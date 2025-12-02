export interface ItemData {
  id: number
  name: string
  description: string
  effect: string | null
  image: string
  type: string
  sub_type: string | null
}

const KNOWN_MEDICAL_ITEMS: Record<number, { name: string; type: string }> = {
  66: { name: "Morphine", type: "Medical" },
  67: { name: "First Aid Kit", type: "Medical" },
  68: { name: "Small First Aid Kit", type: "Medical" },
  69: { name: "First Aid Kit", type: "Medical" },
  203: { name: "Morphine", type: "Medical" },
  361: { name: "Neumune Tablet", type: "Medical" },
  731: { name: "Empty Blood Bag", type: "Medical" },
  732: { name: "Blood Bag : A+", type: "Medical" },
  733: { name: "Blood Bag : A-", type: "Medical" },
  734: { name: "Blood Bag : B+", type: "Medical" },
  735: { name: "Blood Bag : B-", type: "Medical" },
  736: { name: "Blood Bag : AB+", type: "Medical" },
  737: { name: "Blood Bag : AB-", type: "Medical" },
  738: { name: "Blood Bag : O+", type: "Medical" },
  739: { name: "Blood Bag : O-", type: "Medical" },
  1012: { name: "Blood Bag : Irradiated", type: "Medical" },
  1363: { name: "Ipecac Syrup", type: "Medical" },
}

export function getItemFromFallback(itemId: number): ItemData | null {
  const known = KNOWN_MEDICAL_ITEMS[itemId]
  if (known) {
    return {
      id: itemId,
      name: known.name,
      description: "",
      effect: null,
      image: `https://www.torn.com/images/items/${itemId}/large.png`,
      type: known.type,
      sub_type: null,
    }
  }
  return null
}

export function getItemName(itemId: number, fallbackName?: string): string {
  const known = KNOWN_MEDICAL_ITEMS[itemId]
  return known?.name || fallbackName || `Item #${itemId}`
}

export function getItemImageUrl(itemId: number): string {
  return `https://www.torn.com/images/items/${itemId}/large.png`
