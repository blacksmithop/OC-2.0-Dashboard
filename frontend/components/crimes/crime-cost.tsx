"use client"

import { getItemMarketPrice } from "@/lib/marketplace-price"
import { useState, useEffect } from "react"

interface CrimeCostProps {
  slots: Array<{
    position: string
    item_requirement?: {
      id: number
      is_reusable: boolean
    }
    user?: {
      item_outcome?: {
        outcome: string
      }
    }
  }>
  items: Map<number, any>
  onItemClick: (item: any) => void
  crimeStatus?: string
}

const globalItemPriceCache = new Map<number, number | null>()

export default function CrimeCost({ slots, items, onItemClick, crimeStatus }: CrimeCostProps) {
  const [itemPrices, setItemPrices] = useState<Map<number, number | null>>(new Map())
  const [loadingPrices, setLoadingPrices] = useState(false)

  const isPredicted = crimeStatus === "Planning" || crimeStatus === "Recruiting"
  const label = isPredicted ? "Predicted Cost" : "Item Cost"

  // Collect all consumed items
  const consumedItems = new Map<number, number>()
  slots.forEach((slot) => {
    // For actual costs, only count items that were actually used
    if (slot.item_requirement && !slot.item_requirement.is_reusable) {
      if (isPredicted || slot.user?.item_outcome?.outcome === "used") {
        const itemId = slot.item_requirement.id
        consumedItems.set(itemId, (consumedItems.get(itemId) || 0) + 1)
      }
    }
  })

  useEffect(() => {
    const fetchPrices = async () => {
      if (consumedItems.size === 0) return

      setLoadingPrices(true)
      const prices = new Map<number, number | null>()

      const itemsToFetch: number[] = []

      consumedItems.forEach((_, itemId) => {
        if (globalItemPriceCache.has(itemId)) {
          prices.set(itemId, globalItemPriceCache.get(itemId)!)
        } else {
          itemsToFetch.push(itemId)
        }
      })

      // Fetch missing prices
      for (const itemId of itemsToFetch) {
        try {
          const price = await getItemMarketPrice(itemId)
          prices.set(itemId, price)
          globalItemPriceCache.set(itemId, price)
        } catch {
          prices.set(itemId, null)
          globalItemPriceCache.set(itemId, null)
        }
      }

      setItemPrices(prices)
      setLoadingPrices(false)
    }

    fetchPrices()
  }, [])

  if (consumedItems.size === 0) return null

  // Calculate total cost
  let totalCost = 0
  let hasAllPrices = true

  consumedItems.forEach((quantity, itemId) => {
    const price = itemPrices.get(itemId)
    if (price !== null && price !== undefined) {
      totalCost += price * quantity
    } else {
      hasAllPrices = false
    }
  })

  return (
    <div className="inline-block p-1.5 bg-red-500/10 rounded border border-red-500/30">
      <p className="text-xs font-bold text-red-400 mb-1 uppercase">{label}</p>

      {loadingPrices ? (
        <p className="text-xs text-muted-foreground italic">Loading prices...</p>
      ) : (
        <>
          <div className="mb-1">
            <span className="text-xs text-muted-foreground">Total Cost: </span>
            <span className="text-sm font-bold text-red-400">
              {hasAllPrices ? `$${totalCost.toLocaleString()}` : "Calculating..."}
            </span>
          </div>

          <div className="space-y-0.5">
            {Array.from(consumedItems.entries()).map(([itemId, quantity]) => {
              const itemData = items.get(itemId)
              const price = itemPrices.get(itemId)
              const itemCost = price !== null && price !== undefined ? price * quantity : null

              return (
                <div key={itemId} className="flex items-center gap-2 text-xs">
                  {itemData && (
                    <button onClick={() => onItemClick(itemData)} className="hover:opacity-80 shrink-0">
                      <img src={itemData.image || "/placeholder.svg"} alt={itemData.name} className="w-5 h-5 rounded" />
                    </button>
                  )}
                  <span className="text-foreground font-medium">
                    {itemData?.name || `Item ${itemId}`} x{quantity}
                  </span>
                  {itemCost !== null && (
                    <span className="text-muted-foreground ml-auto">${itemCost.toLocaleString()}</span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
