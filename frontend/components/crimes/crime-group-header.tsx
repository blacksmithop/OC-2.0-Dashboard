"use client"

import { ChevronDown, ArrowUpDown } from 'lucide-react'
import { getHeaderColor } from "@/lib/crimes/colors"

interface CrimeGroupHeaderProps {
  status: string
  count: number
  originalCount: number
  isExpanded: boolean
  currentSort: "difficulty" | "filled" | "timeLeft" | "none"
  isFilteringAtRisk: boolean
  onToggleExpanded: () => void
  onSort: (sortType: "difficulty" | "filled" | "timeLeft") => void
  onToggleAtRiskFilter: (e: React.MouseEvent) => void
}

export default function CrimeGroupHeader({
  status,
  count,
  originalCount,
  isExpanded,
  currentSort,
  isFilteringAtRisk,
  onToggleExpanded,
  onSort,
  onToggleAtRiskFilter,
}: CrimeGroupHeaderProps) {
  return (
    <div className="mb-3">
      <button
        onClick={onToggleExpanded}
        className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all ${getHeaderColor(status)} font-bold`}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold">{status}</h3>
          <span className="text-sm font-bold">({count})</span>
        </div>
        <ChevronDown size={20} className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
      </button>

      {isExpanded && originalCount > 0 && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-card rounded-lg border animate-in fade-in duration-200">
          <span className="text-xs text-foreground font-bold uppercase">Sort:</span>
          <button
            onClick={() => onSort("difficulty")}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 font-bold ${
              currentSort === "difficulty"
                ? "bg-primary text-white border-primary"
                : "bg-card text-foreground border-border hover:border-primary"
            }`}
          >
            <ArrowUpDown size={14} />
            Difficulty
          </button>
          <button
            onClick={() => onSort("filled")}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 font-bold ${
              currentSort === "filled"
                ? "bg-accent text-white border-accent"
                : "bg-card text-foreground border-border hover:border-accent"
            }`}
          >
            <ArrowUpDown size={14} />
            Filled
          </button>
          <button
            onClick={() => onSort("timeLeft")}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 font-bold ${
              currentSort === "timeLeft"
                ? "bg-destructive text-white border-destructive"
                : "bg-card text-foreground border-border hover:border-destructive"
            }`}
          >
            <ArrowUpDown size={14} />
            Time
          </button>
          <div className="ml-auto">
            <button
              onClick={onToggleAtRiskFilter}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 font-bold ${
                isFilteringAtRisk
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-card text-foreground border-border hover:border-orange-500"
              }`}
            >
              ⚠️ Low CPR
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
