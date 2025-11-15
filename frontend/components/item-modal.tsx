"use client"

import { X, Copy, Check } from "lucide-react"
import { useState } from "react"

interface ItemDetails {
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

interface ItemValue {
  vendor?: {
    country: string
    name: string
  }
  buy_price?: number
  sell_price?: number
  market_price?: number
}

interface TornItem {
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
  value?: ItemValue
  circulation?: number
  details?: ItemDetails
}

interface ItemModalProps {
  item: TornItem | null
  onClose: () => void
}

export default function ItemModal({ item, onClose }: ItemModalProps) {
  const [copied, setCopied] = useState(false)

  if (!item) return null

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-slate-900 border border-blue-500/30 rounded-lg p-4 max-w-lg w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-xl font-semibold text-foreground text-center flex-1">{item.name}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-blue-500/10 rounded transition-colors flex-shrink-0"
            aria-label="Close modal"
          >
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex justify-center mb-3">
          <div className="w-32 h-32 bg-background rounded-lg border border-blue-500/20 flex items-center justify-center overflow-hidden">
            <img src={item.image || "/placeholder.svg"} alt={item.name} className="w-full h-full object-contain" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex flex-col gap-1 p-2 bg-background rounded border border-blue-500/20">
            <span className="text-xs text-muted-foreground">Type:</span>
            <p className="font-medium text-foreground text-sm">{item.type}</p>
          </div>

          <div className="flex flex-col gap-1 p-2 bg-background rounded border border-blue-500/20">
            <span className="text-xs text-muted-foreground">Item ID:</span>
            <div className="flex items-center gap-2">
              <p className="font-mono font-medium text-foreground text-sm">{item.id}</p>
              <button
                onClick={() => copyToClipboard(item.id.toString())}
                className="p-1 hover:bg-blue-500/10 rounded transition-colors"
                aria-label="Copy ID"
              >
                {copied ? (
                  <Check size={14} className="text-green-400" />
                ) : (
                  <Copy size={14} className="text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 p-2 bg-background rounded border border-blue-500/20">
            <span className="text-xs text-muted-foreground">Market Price:</span>
            <p className="font-medium text-blue-400 text-sm">${formatNumber(item.value?.market_price || 0)}</p>
          </div>

          <div className="flex flex-col gap-1 p-2 bg-background rounded border border-blue-500/20">
            <span className="text-xs text-muted-foreground">Circulation:</span>
            <p className="font-medium text-foreground text-sm">{formatNumber(item.circulation || 0)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
