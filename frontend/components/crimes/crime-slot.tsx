"use client"

import type { Slot, Member } from "@/types/crime"
import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { ProgressRing } from "./progress-ring"
import { getPositionPassRateColor } from "@/lib/crimes/colors"
import { getWeightColor, getWeightBgColor } from "@/lib/role-weights"
import { getRecommendedMembers, type MemberRecommendation, type CPRTrackerData } from "@/lib/integration/cpr-tracker"

interface CrimeSlotProps {
  slot: Slot
  slotIndex: number
  crimeId: number
  crimeName: string
  crimeStatus: string
  memberMap: { [key: number]: string }
  members: Member[]
  items: Map<number, any>
  onItemClick: (item: any) => void
  minPassRate: number
  roleWeight: number | null
  isHighRiskRole: boolean
  membersNotInOCSet: Set<number>
  cprTrackerData: CPRTrackerData | null
  cprTrackerEnabled: boolean
}

export default function CrimeSlot({
  slot,
  slotIndex,
  crimeId,
  crimeName,
  crimeStatus,
  memberMap,
  members,
  items,
  onItemClick,
  minPassRate,
  roleWeight,
  isHighRiskRole,
  membersNotInOCSet,
  cprTrackerData,
  cprTrackerEnabled,
}: CrimeSlotProps) {
  const [recommendations, setRecommendations] = useState<MemberRecommendation[]>([])
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)
  const [showRecommendations, setShowRecommendations] = useState(false)

  const isAtRisk = slot.user && slot.checkpoint_pass_rate !== undefined && slot.checkpoint_pass_rate < minPassRate

  const isOpenRecruitingSlot = crimeStatus === "Recruiting" && !slot.user
  const isMissingItemPlanning =
    crimeStatus === "Planning" && slot.user && slot.item_requirement && !slot.item_requirement.is_available

  const handleRecommendClick = () => {
    if (loadingRecommendations || !cprTrackerData) return

    setLoadingRecommendations(true)

    try {
      const recs = getRecommendedMembers(cprTrackerData, crimeName, slot.position, membersNotInOCSet, minPassRate)

      const recsWithNames = recs.map((rec) => ({
        ...rec,
        memberName: members.find((m) => m.id === rec.memberId)?.name || `ID: ${rec.memberId}`,
      }))

      setRecommendations(recsWithNames)
      setShowRecommendations(true)
    } finally {
      setLoadingRecommendations(false)
    }
  }

  return (
    <div className="space-y-1">
      <div
        className={`text-xs px-2 py-1.5 rounded border transition-colors ${
          isHighRiskRole
            ? "bg-red-500/10 border-red-500/40 hover:border-red-500/60"
            : isOpenRecruitingSlot
              ? "bg-purple-500/10 border-purple-500/40 animate-border-pulse-purple"
              : isMissingItemPlanning
                ? "bg-orange-500/10 border-orange-500/40 animate-border-pulse-orange"
                : "bg-background border-border/30 hover:border-primary/50"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-bold text-muted-foreground shrink-0">{slot.position}:</span>
            {roleWeight !== null && (
              <span
                className={`px-1.5 py-0.5 rounded border text-xs font-bold shrink-0 ${getWeightBgColor(roleWeight)} ${getWeightColor(roleWeight)}`}
                title="Role Weight"
              >
                {roleWeight.toFixed(1)}%
              </span>
            )}
            {slot.user ? (
              <>
            {isAtRisk && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-orange-400 cursor-help"><AlertTriangle size={14} className="text-red-400 shrink-0" /></span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Low CPR</p>
                </TooltipContent>
              </Tooltip>
            )}

            {isHighRiskRole && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle size={14} className="text-red-400 shrink-0" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>High weight role with low CPR!</p>
                </TooltipContent>
              </Tooltip>
            )}
                <a
                  href={`https://www.torn.com/profiles.php?XID=${slot.user.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline font-bold truncate"
                >
                  {memberMap[slot.user.id] || slot.user.name || "Unknown"}
                </a>
                {slot.checkpoint_pass_rate !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-bold border shrink-0 ${getPositionPassRateColor(slot.checkpoint_pass_rate)}`}
                  >
                    {slot.checkpoint_pass_rate}%
                  </span>
                )}
                {crimeStatus === "Planning" && slot.user?.progress !== undefined && (
                  <div
                    className="flex items-center gap-1 shrink-0"
                    title={`Progress: ${slot.user.progress.toFixed(1)}%`}
                  >
                    <ProgressRing progress={slot.user.progress} size={20} strokeWidth={3} />
                    <span className="text-xs text-muted-foreground font-bold">{slot.user.progress.toFixed(1)}%</span>
                  </div>
                )}
                {crimeStatus === "Successful" && slot.user.outcome && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-bold border shrink-0 ${
                      slot.user.outcome === "Successful"
                        ? "bg-green-500/20 text-green-400 border-green-500/40"
                        : "bg-red-500/20 text-red-400 border-red-500/40"
                    }`}
                  >
                    {slot.user.outcome}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-muted-foreground">Open</span>
                {isOpenRecruitingSlot && cprTrackerEnabled && cprTrackerData && (
                  <button
                    onClick={handleRecommendClick}
                    disabled={loadingRecommendations}
                    className="ml-auto px-2 py-0.5 text-xs rounded border bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
                  >
                    {loadingRecommendations ? "Loading..." : "Recommend"}
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {slot.item_requirement && (
              <>
                {items.has(slot.item_requirement.id) && (
                  <button onClick={() => onItemClick(items.get(slot.item_requirement.id))} className="hover:opacity-80">
                    <img
                      src={items.get(slot.item_requirement.id)?.image || "/placeholder.svg"}
                      alt={items.get(slot.item_requirement.id)?.name}
                      className="w-5 h-5 rounded"
                    />
                  </button>
                )}
                <span
                  className={`px-1.5 py-0.5 rounded text-xs font-bold border ${slot.item_requirement.is_available ? "bg-green-500/20 text-green-400 border-green-500/40" : "bg-red-500/20 text-red-400 border-red-500/40"}`}
                >
                  {slot.item_requirement.is_available ? "✓" : "✗"}
                </span>
              </>
            )}
          </div>
        </div>
        {crimeStatus === "Successful" && slot.user?.item_outcome && slot.item_requirement && (
          <div className="mt-1 pl-4 text-[10px]">
            {slot.user.item_outcome.outcome === "used" ? (
              <span
                className={`px-1.5 py-0.5 rounded font-bold border inline-block ${
                  slot.item_requirement.is_reusable
                    ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                    : "bg-orange-500/20 text-orange-400 border-orange-500/40"
                }`}
              >
                Item: {slot.item_requirement.is_reusable ? "Not consumed" : "Consumed"}
              </span>
            ) : (
              <span className="text-muted-foreground">Item: {slot.user.item_outcome.outcome}</span>
            )}
          </div>
        )}
      </div>

      {showRecommendations && recommendations.length > 0 && (
        <div className="ml-4 p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs">
          <div className="flex items-center justify-between mb-1">
            <p className="font-bold text-blue-400">Recommended Members ({recommendations.length})</p>
            <button onClick={() => setShowRecommendations(false)} className="text-blue-400 hover:text-blue-300">
              ✕
            </button>
          </div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {recommendations.map((rec, recIdx) => (
              <div key={recIdx} className="flex items-center justify-between py-0.5">
                <a
                  href={`https://www.torn.com/profiles.php?XID=${rec.memberId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline font-bold"
                >
                  {rec.memberName}
                </a>
                <span className={`px-1.5 py-0.5 rounded border font-bold ${getPositionPassRateColor(rec.cpr)}`}>
                  {rec.cpr}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {showRecommendations && recommendations.length === 0 && (
        <div className="ml-4 p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">No members meet the minimum CPR ({minPassRate}%)</p>
            <button onClick={() => setShowRecommendations(false)} className="text-blue-400 hover:text-blue-300">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
