"use client"

import type { Rewards } from "@/types/crime"
import { useState } from "react"
import { formatDateTime } from "@/lib/crimes/formatters"
import { getItemMarketPrice } from "@/lib/marketplace-price"

interface CrimeRewardsProps {
  rewards: Rewards
  items: Map<number, any>
  onItemClick: (item: any) => void
  memberMap: { [key: number]: string }
}

export default function CrimeRewards({ rewards, items, onItemClick, memberMap }: CrimeRewardsProps) {
  const [itemPrices, setItemPrices] = useState<Map<number, number | null>>(new Map())
  const [loadingPrices, setLoadingPrices] = useState<Set<number>>(new Set())

  const fetchItemPrice = async (itemId: number) => {
    if (loadingPrices.has(itemId) || itemPrices.has(itemId)) return

    setLoadingPrices((prev) => new Set(prev).add(itemId))

    try {
      const price = await getItemMarketPrice(itemId)
      setItemPrices((prev) => {
        const next = new Map(prev)
        next.set(itemId, price)
        return next
      })
    } finally {
      setLoadingPrices((prev) => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }

  return (
    <div className="inline-block mb-2 p-1.5 bg-green-500/10 rounded border border-green-500/30">
      <p className="text-xs font-bold text-green-400 mb-1 uppercase">Rewards</p>
      <table className="text-xs">
        <tbody>
          {rewards.money > 0 ? (
            <tr>
              <td className="text-muted-foreground py-0 pr-4">Money:</td>
              <td className="font-bold text-foreground text-right py-0">${rewards.money.toLocaleString()}</td>
            </tr>
          ) : (rewards.items && rewards.items.length > 0) || rewards.payout?.type === "Inventory" ? (
            <tr>
              <td className="text-muted-foreground py-0 pr-4">Money:</td>
              <td className="font-bold text-foreground text-right py-0">Custom</td>
            </tr>
          ) : null}
          {rewards.respect > 0 && (
            <tr>
              <td className="text-muted-foreground py-0 pr-4">Respect:</td>
              <td className="font-bold text-foreground text-right py-0">{rewards.respect}</td>
            </tr>
          )}
        </tbody>
      </table>
      {rewards.items && rewards.items.length > 0 && (
        <div className="mt-1 pt-1 border-t border-green-500/20">
          <p className="text-xs font-bold text-green-400 mb-0.5 uppercase">Items</p>
          <table className="text-xs">
            <tbody>
              {rewards.items.map((rewardItem, itemIdx) => {
                const isCustomMoney =
                  rewards.money === 0 && (rewards.items.length > 0 || rewards.payout?.type === "Inventory")
                const itemPrice = itemPrices.get(rewardItem.id)
                const isPriceLoading = loadingPrices.has(rewardItem.id)

                if (isCustomMoney && !itemPrice && !isPriceLoading && !itemPrices.has(rewardItem.id)) {
                  fetchItemPrice(rewardItem.id)
                }

                return (
                  <tr key={itemIdx}>
                    <td className="py-0.5 pr-4">
                      <div className="flex items-center gap-2">
                        {items.has(rewardItem.id) && (
                          <button
                            onClick={() => onItemClick(items.get(rewardItem.id))}
                            className="hover:opacity-80 shrink-0"
                          >
                            <img
                              src={items.get(rewardItem.id)?.image || "/placeholder.svg"}
                              alt={items.get(rewardItem.id)?.name}
                              className="w-6 h-6 rounded"
                            />
                          </button>
                        )}
                        <span className="font-bold text-foreground whitespace-nowrap">
                          {items.has(rewardItem.id) ? items.get(rewardItem.id)?.name : `Item ${rewardItem.id}`}
                        </span>
                      </div>
                    </td>
                    <td className="font-bold text-foreground text-right py-0.5">x{rewardItem.quantity}</td>
                    {isCustomMoney && itemPrice !== null && itemPrice !== undefined && (
                      <td className="text-xs text-muted-foreground text-right py-0.5 pl-2">
                        Worth: ${(itemPrice * rewardItem.quantity).toLocaleString()}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {rewards.payout && (
        <div className="mt-1 pt-1 border-t border-green-500/20">
          <p className="text-xs font-bold text-green-400 mb-0.5 uppercase">Payout</p>
          <table className="text-xs">
            <tbody>
              <tr>
                <td className="text-muted-foreground py-0 pr-4">Type:</td>
                <td className="font-bold text-foreground text-right capitalize py-0">{rewards.payout.type}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground py-0 pr-4">Percentage:</td>
                <td className="font-bold text-foreground text-right py-0">{rewards.payout.percentage}%</td>
              </tr>
              <tr>
                <td className="text-muted-foreground py-0 pr-4">Paid by:</td>
                <td className="text-right py-0">
                  <a
                    href={`https://www.torn.com/profiles.php?XID=${rewards.payout.paid_by}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline font-bold whitespace-nowrap"
                  >
                    {memberMap[rewards.payout.paid_by] || `ID: ${rewards.payout.paid_by}`}
                  </a>
                </td>
              </tr>
              <tr>
                <td className="text-muted-foreground py-0 pr-4">Paid at:</td>
                <td className="font-mono text-foreground font-bold text-right text-[10px] py-0 whitespace-nowrap">
                  {formatDateTime(rewards.payout.paid_at)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {!rewards.payout && (rewards.money > 0 || (rewards.items && rewards.items.length > 0)) && (
        <div className="mt-1 pt-1 border-t border-green-500/20">
          <p className="text-xs text-muted-foreground italic">Payout was handled manually</p>
        </div>
      )}
    </div>
  )
}
