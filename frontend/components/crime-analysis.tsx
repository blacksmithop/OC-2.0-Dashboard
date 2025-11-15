"use client"

import { useMemo, useState } from "react"

interface Crime {
  id: number
  name: string
  difficulty: number
  status: string
  slots: Array<{
    position: string
    position_id: string
    user: { id: number; name?: string } | null
  }>
}

interface Member {
  id: number
  name: string
}

interface CrimeAnalysisProps {
  crimes: Crime[]
  members: Member[]
}

export default function CrimeAnalysis({ crimes, members }: CrimeAnalysisProps) {
  const memberMap = new Map(members.map((m) => [m.id, m.name]))
  const [sortBy, setSortBy] = useState<"fill" | "difficulty" | "name">("fill")

  const analyzedCrimes = useMemo(() => {
    return crimes
      .filter((c) => c.status === "Recruiting" || c.status === "Planning")
      .map((crime) => {
        const filledSlots = crime.slots.filter((s) => s.user).length
        const totalSlots = crime.slots.length
        const fillPercentage = totalSlots > 0 ? (filledSlots / totalSlots) * 100 : 0
        const emptySlots = totalSlots - filledSlots

        return {
          ...crime,
          filledSlots,
          totalSlots,
          fillPercentage,
          emptySlots,
          isFull: emptySlots === 0,
          isNearFull: fillPercentage >= 80,
        }
      })
      .sort((a, b) => {
        if (sortBy === "fill") {
          return a.fillPercentage - b.fillPercentage
        }
        if (sortBy === "difficulty") {
          return b.difficulty - a.difficulty
        }
        return a.name.localeCompare(b.name)
      })
  }, [crimes, sortBy])

  const stats = useMemo(() => {
    const total = analyzedCrimes.length
    const full = analyzedCrimes.filter((c) => c.isFull).length
    const nearFull = analyzedCrimes.filter((c) => c.isNearFull && !c.isFull).length

    return { total, full, nearFull }
  }, [analyzedCrimes])

  if (analyzedCrimes.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No active crimes</div>
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-card p-3 rounded-lg border border-border shadow-sm">
            <div className="text-muted-foreground text-xs font-medium mb-1">Total Crimes</div>
            <div className="font-bold text-2xl text-primary">{stats.total}</div>
          </div>
          <div className="bg-card p-3 rounded-lg border border-border shadow-sm">
            <div className="text-muted-foreground text-xs font-medium mb-1">Full Crimes</div>
            <div className="font-bold text-2xl text-accent">{stats.full}</div>
          </div>
          <div className="bg-card p-3 rounded-lg border border-border shadow-sm">
            <div className="text-muted-foreground text-xs font-medium mb-1">Nearly Full</div>
            <div className="font-bold text-2xl text-yellow-400">{stats.nearFull}</div>
          </div>
        </div>

        <div>
          <label className="text-sm text-foreground font-semibold block mb-2">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "fill" | "difficulty" | "name")}
            className="w-full px-3 py-2.5 bg-card border-2 border-primary/50 rounded-lg text-foreground font-medium text-sm hover:border-primary transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="fill">Fill Percentage (Low to High)</option>
            <option value="difficulty">Difficulty (High to Low)</option>
            <option value="name">Crime Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Crimes List */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {analyzedCrimes.map((crime) => (
          <div
            key={crime.id}
            className={`bg-card p-3 rounded-lg border transition-colors ${
              crime.isFull ? "border-accent/50" : "border-border hover:border-primary/50"
            }`}
          >
            <div className="mb-2">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <div className="font-medium text-foreground">{crime.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Difficulty: <span className="font-bold text-primary text-sm">{crime.difficulty}</span> • Status:{" "}
                    <span className="font-semibold text-accent">{crime.status}</span>
                  </div>
                </div>
                {crime.isFull && <span className="text-xs px-2 py-1 rounded bg-accent/20 text-accent">Full</span>}
                {crime.isNearFull && !crime.isFull && (
                  <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-600">Nearly Full</span>
                )}
              </div>

              {/* Fill Progress */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">
                    {crime.filledSlots}/{crime.totalSlots} slots filled
                  </span>
                  <span className="text-sm font-bold text-primary">{Math.round(crime.fillPercentage)}%</span>
                </div>
                <div className="h-2 bg-background rounded overflow-hidden border border-border">
                  <div
                    className={`h-full transition-all ${crime.isFull ? "bg-accent" : "bg-primary"}`}
                    style={{ width: `${crime.fillPercentage}%` }}
                  />
                </div>
              </div>

              {/* Participants */}
              <div className="text-xs">
                <div className="text-muted-foreground mb-1">
                  Participants ({crime.filledSlots}/{crime.totalSlots}):
                </div>
                <div className="flex flex-wrap gap-1">
                  {crime.slots.map((slot) => (
                    <span
                      key={slot.position_id}
                      className={`px-2 py-0.5 rounded text-xs border ${
                        slot.user
                          ? "bg-background/50 text-foreground border-muted"
                          : "bg-muted/20 text-muted-foreground border-muted/50"
                      }`}
                    >
                      {slot.position}: {slot.user ? memberMap.get(slot.user.id) : "Empty"}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
