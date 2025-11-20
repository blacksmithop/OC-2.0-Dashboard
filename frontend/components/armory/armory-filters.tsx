"use client"

import { ARMORY_ACTIONS, TIME_FILTER_OPTIONS } from "@/lib/armory/constants"

interface Member {
  id: number
  name: string
}

interface ArmoryFiltersProps {
  categories: string[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
  members: Member[]
  selectedUser: string
  onUserChange: (userId: string) => void
  timeFilter: string
  onTimeFilterChange: (filter: string) => void
  itemsPerPage: number
  onItemsPerPageChange: (count: number) => void
  selectedAction: string
  onActionChange: (action: string) => void
}

export default function ArmoryFilters({
  categories,
  selectedCategory,
  onCategoryChange,
  members,
  selectedUser,
  onUserChange,
  timeFilter,
  onTimeFilterChange,
  itemsPerPage,
  onItemsPerPageChange,
  selectedAction,
  onActionChange,
}: ArmoryFiltersProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Filters</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Category Filter */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => onCategoryChange(category)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  selectedCategory === category
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent/20 hover:bg-accent/30"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Action Filter - Now a dropdown */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Action</label>
          <select
            value={selectedAction}
            onChange={(e) => onActionChange(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"
          >
            {ARMORY_ACTIONS.map((action) => (
              <option key={action} value={action} className="capitalize">
                {action === "All" ? "All Actions" : action.charAt(0).toUpperCase() + action.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* User Filter */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">User</label>
          <select
            value={selectedUser}
            onChange={(e) => onUserChange(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"
          >
            <option value="All">All Users</option>
            {members
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((member) => (
                <option key={member.id} value={member.id.toString()}>
                  {member.name}
                </option>
              ))}
          </select>
        </div>

        {/* Time Filter - Now a dropdown */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Time Period</label>
          <select
            value={timeFilter}
            onChange={(e) => onTimeFilterChange(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"
          >
            {TIME_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Items per page selector - Kept as buttons but more compact */}
      <div className="mt-4 pt-4 border-t border-border">
        <label className="text-xs font-medium text-muted-foreground block mb-2">Items per page</label>
        <div className="flex gap-2">
          {[25, 50, 100, 200].map((count) => (
            <button
              key={count}
              onClick={() => onItemsPerPageChange(count)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                itemsPerPage === count ? "bg-primary text-primary-foreground" : "bg-accent/20 hover:bg-accent/30"
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
