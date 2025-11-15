"use client"

import { useMemo, useState } from "react"
import { ChevronDown } from 'lucide-react'
import ItemModal from "./item-modal"

interface Crime {
  id: number
  name: string
  status: string
  rewards?: {
    money: number
    items: Array<{ id: number; quantity: number }>
    respect: number
  }
}

interface Member {
  id: number
  name: string
  position: string
}

interface CrimeSummaryProps {
  crimes: Crime[]
  items: Map<number, any>
  minPassRate?: number
  onMinPassRateChange?: (value: number) => void
  membersNotInOC?: Member[]
}

export default function CrimeSummary({ crimes, items, minPassRate, onMinPassRateChange, membersNotInOC }: CrimeSummaryProps) {
  const [isItemsExpanded, setIsItemsExpanded] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)

  const summary = useMemo(() => {
    let totalMoney = 0
    let totalRespect = 0
    let totalItemValue = 0
    const statusCounts = {
      Planning: 0,
      Recruiting: 0,
      Successful: 0,
      Failed: 0,
      Expired: 0,
    }
    const itemsGained = new Map<number, { item: any; quantity: number; totalValue: number }>()

    crimes.forEach((crime) => {
      // Count status
      const status = crime.status === "Failure" ? "Failed" : crime.status
      if (status in statusCounts) {
        statusCounts[status as keyof typeof statusCounts]++
      }

      // Calculate rewards for successful crimes
      if (crime.status === "Successful" && crime.rewards) {
        totalMoney += crime.rewards.money || 0
        totalRespect += crime.rewards.respect || 0

        // Calculate item values and aggregate items
        if (crime.rewards.items && crime.rewards.items.length > 0) {
          crime.rewards.items.forEach((item) => {
            const itemData = items.get(item.id)
            if (itemData && itemData.value?.market_price) {
              const itemValue = itemData.value.market_price * item.quantity
              totalItemValue += itemValue

              if (itemsGained.has(item.id)) {
                const existing = itemsGained.get(item.id)!
                existing.quantity += item.quantity
                existing.totalValue += itemValue
              } else {
                itemsGained.set(item.id, {
                  item: itemData,
                  quantity: item.quantity,
                  totalValue: itemValue,
                })
              }
            }
          })
        }
      }
    })

    const totalValue = totalMoney + totalItemValue

    return {
      totalValue,
      totalMoney,
      totalItemValue,
      totalRespect,
      statusCounts,
      itemsGained: Array.from(itemsGained.values()),
    }
  }, [crimes, items])

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  const formatCurrency = (num: number) => {
    return `$${formatNumber(num)}`
  }

  return (
    <div className="mb-4 space-y-3">
      <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card p-3 rounded-lg border border-border/50">
          <div className="text-xs text-muted-foreground mb-1">Total Value</div>
          <div className="text-lg font-bold text-green-400">{formatCurrency(summary.totalValue)}</div>
        </div>
        <div className="bg-card p-3 rounded-lg border border-border/50">
          <div className="text-xs text-muted-foreground mb-1">Direct Money</div>
          <div className="text-lg font-bold text-green-400">{formatCurrency(summary.totalMoney)}</div>
        </div>
        <div className="bg-card p-3 rounded-lg border border-border/50">
          <div className="text-xs text-muted-foreground mb-1">Item Value</div>
          <div className="text-lg font-bold text-orange-400">{formatCurrency(summary.totalItemValue)}</div>
        </div>
        <div className="bg-card p-3 rounded-lg border border-border/50">
          <div className="text-xs text-muted-foreground mb-1">Total Respect</div>
          <div className="text-lg font-bold text-blue-400">{formatNumber(summary.totalRespect)}</div>
        </div>
      </div>

      {summary.itemsGained.length > 0 && (
        <div className="bg-card rounded-lg border border-border/50">
          <button
            onClick={() => setIsItemsExpanded(!isItemsExpanded)}
            className="w-full flex items-center justify-between p-3 transition-all hover:bg-primary/5"
          >
            <div className="text-xs text-muted-foreground font-bold">
              Items Gained ({summary.itemsGained.reduce((acc, item) => acc + item.quantity, 0)})
            </div>
            <ChevronDown
              size={16}
              className={`transition-transform duration-300 text-muted-foreground ${isItemsExpanded ? "rotate-180" : ""}`}
            />
          </button>

          {isItemsExpanded && (
            <div className="px-3 pb-3 pt-0 animate-in fade-in duration-200">
              <div className="flex flex-wrap gap-2">
                {summary.itemsGained.map((itemData, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 px-3 py-1.5 rounded-md"
                  >
                    <button onClick={() => setSelectedItem(itemData.item)} className="hover:opacity-80 shrink-0">
                      <img
                        src={
                          itemData.item.image ||
                          `/placeholder.svg?height=20&width=20&query=${encodeURIComponent(itemData.item.name) || "/placeholder.svg"}`
                        }
                        alt={itemData.item.name}
                        className="w-5 h-5 rounded"
                      />
                    </button>
                    <span className="text-sm text-purple-300 whitespace-nowrap">
                      {itemData.item.name} ({itemData.quantity}) - {formatCurrency(itemData.totalValue)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Breakdown */}
      <div className="bg-card p-3 rounded-lg border border-border/50">
        <div className="text-xs text-muted-foreground mb-2 font-bold">Status Breakdown</div>
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Planning:</span>
            <span className="font-bold text-blue-400">{summary.statusCounts.Planning}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Recruiting:</span>
            <span className="font-bold text-purple-400">{summary.statusCounts.Recruiting}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Successful:</span>
            <span className="font-bold text-green-400">{summary.statusCounts.Successful}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Failure:</span>
            <span className="font-bold text-red-400">{summary.statusCounts.Failed}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Expired:</span>
            <span className="font-bold text-gray-400">{summary.statusCounts.Expired}</span>
          </div>
        </div>
      </div>

      {/* Minimum Pass Rate setting */}
      {minPassRate !== undefined && onMinPassRateChange && (
        <div className="bg-card p-3 rounded-lg border border-border/50">
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-muted-foreground font-bold">Minimum Pass Rate (CPR)</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={minPassRate}
                onChange={(e) => onMinPassRateChange(Number(e.target.value))}
                className="w-20 px-2 py-1 text-sm bg-background border border-border rounded text-foreground font-bold text-center"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>
      )}

      {membersNotInOC && membersNotInOC.length > 0 && (
        <div className="bg-card p-3 rounded-lg border border-border/50">
          <h3 className="text-xs text-muted-foreground font-bold mb-2">
            Not in OC ({membersNotInOC.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {membersNotInOC.map((member) => (
              <a
                key={member.id}
                href={`https://www.torn.com/profiles.php?XID=${member.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded transition-colors"
                title={`${member.name} - ${member.position}`}
              >
                {member.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
