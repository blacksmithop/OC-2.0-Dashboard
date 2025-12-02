"use client"

import { Slider } from "@/components/ui/slider"
import { ChevronDown } from 'lucide-react'

interface MemberFiltersProps {
  filters: {
    crimeStatus: string
    activityRange: [number, number]
    levelRange: [number, number]
  }
  onFiltersChange: (filters: any) => void
  sortBy: "none" | "crime_rank" | "nnb"
  onSortChange: (sortBy: "none" | "crime_rank" | "nnb") => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function MemberFilters({
  filters,
  onFiltersChange,
  sortBy,
  onSortChange,
  collapsed,
  onToggleCollapse,
}: MemberFiltersProps) {
  return (
    <div className="bg-card border-2 border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/10 transition-colors"
      >
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Filters</h3>
        <ChevronDown
          className={`h-4 w-4 text-foreground transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`}
        />
      </button>

      {!collapsed && (
        <div className="p-4 pt-0 space-y-4 border-t-2 border-border">
          <div className="space-y-2">
            <label className="text-xs text-foreground font-bold block">Sort By</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onSortChange("none")}
                className={`text-xs px-3 py-2 rounded-md border-2 transition-all font-bold ${
                  sortBy === "none"
                    ? "bg-primary text-white border-primary"
                    : "bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground"
                }`}
              >
                Default
              </button>
              <button
                onClick={() => onSortChange("crime_rank")}
                className={`text-xs px-3 py-2 rounded-md border-2 transition-all font-bold ${
                  sortBy === "crime_rank"
                    ? "bg-primary text-white border-primary"
                    : "bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground"
                }`}
              >
                Crime Rank
              </button>
              <button
                onClick={() => onSortChange("nnb")}
                className={`text-xs px-3 py-2 rounded-md border-2 transition-all font-bold ${
                  sortBy === "nnb"
                    ? "bg-primary text-white border-primary"
                    : "bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground"
                }`}
              >
                NNB
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-foreground font-bold block">Crime Status</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onFiltersChange({ ...filters, crimeStatus: "all" })}
                className={`text-xs px-3 py-2 rounded-md border-2 transition-all font-bold ${
                  filters.crimeStatus === "all"
                    ? "bg-primary text-white border-primary"
                    : "bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                onClick={() => onFiltersChange({ ...filters, crimeStatus: "in_crime" })}
                className={`text-xs px-3 py-2 rounded-md border-2 transition-all font-bold ${
                  filters.crimeStatus === "in_crime"
                    ? "bg-primary text-white border-primary"
                    : "bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground"
                }`}
              >
                In Crime
              </button>
              <button
                onClick={() => onFiltersChange({ ...filters, crimeStatus: "not_in_crime" })}
                className={`text-xs px-3 py-2 rounded-md border-2 transition-all font-bold ${
                  filters.crimeStatus === "not_in_crime"
                    ? "bg-primary text-white border-primary"
                    : "bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground"
                }`}
              >
                Not In
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="text-xs text-foreground font-bold flex items-center justify-between">
              <span>Activity</span>
              <span className="text-primary text-base">
                {filters.activityRange[0]} - {filters.activityRange[1] === 7 ? "7+" : filters.activityRange[1]} days
              </span>
            </label>
            <Slider
              value={filters.activityRange}
              onValueChange={(value) => onFiltersChange({ ...filters, activityRange: value as [number, number] })}
              min={0}
              max={7}
              step={1}
              className="w-full"
            />
          </div>

          <div className="space-y-2.5">
            <label className="text-xs text-foreground font-bold flex items-center justify-between">
              <span>Level</span>
              <span className="text-primary text-base">
                {filters.levelRange[0]} - {filters.levelRange[1]}
              </span>
            </label>
            <Slider
              value={filters.levelRange}
              onValueChange={(value) => onFiltersChange({ ...filters, levelRange: value as [number, number] })}
              min={1}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  )
}
