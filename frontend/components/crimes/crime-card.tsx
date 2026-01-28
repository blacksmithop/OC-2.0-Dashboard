"use client"

import type { Crime, Member } from "@/types/crime"
import { useState } from "react"
import { RefreshCw, Microscope, Sparkles } from "lucide-react"
import CrimeSlot from "./crime-slot"
import CrimeRewards from "./crime-rewards"
import CrimeTimestamps from "./crime-timestamps"
import CrimeCost from "./crime-cost"
import { canReloadIndividualCrimes } from "@/lib/api-scopes"
import { getSimulatorUrl } from "@/lib/crimes/simulator-urls"
import { getRoleWeight, shouldAlertLowCPR, type RoleWeightsData } from "@/lib/crimes/role-weights"
import { getSuccessPrediction, SUPPORTED_SCENARIOS, type SuccessPrediction } from "@/lib/crimes/success-prediction"
import { getDifficultyColor, getPassRateColor } from "@/lib/crimes/colors"
import { type MinCPRSettings, DEFAULT_MIN_CPR } from "@/lib/crimes/cpr-aggregator"

interface CrimeCardProps {
  crime: Crime
  members: Member[]
  items: Map<number, any>
  memberMap: { [key: number]: string }
  onItemClick: (item: any) => void
  onReloadCrime?: (crimeId: number) => Promise<void>
  isReloading: boolean
  minPassRate: number
  factionId: number | null
  roleWeights: RoleWeightsData | null
  membersNotInOCSet: Set<number>
  cprTrackerData: any
  cprTrackerEnabled: boolean
  currentTime: number
  canReload: boolean
  minCPRSettings?: MinCPRSettings
}

export default function CrimeCard({
  crime,
  members,
  items,
  memberMap,
  onItemClick,
  onReloadCrime,
  isReloading,
  minPassRate,
  factionId,
  roleWeights,
  membersNotInOCSet,
  cprTrackerData,
  cprTrackerEnabled,
  currentTime,
  canReload,
  minCPRSettings,
}: CrimeCardProps) {
  const [prediction, setPrediction] = useState<SuccessPrediction | null>(null)
  const [isPredicting, setIsPredicting] = useState(false)

  const crimeAnchorId = `crime-${crime.id}`
  const filledSlots = crime.slots.filter((slot) => slot.user && slot.user.id).length
  const totalSlots = crime.slots.length
  const canReloadCrimes = canReloadIndividualCrimes()
  const canReloadThisCrime = !["Successful", "Failed", "Expired"].includes(crime.status)
  const isPlanning = crime.status === "Planning"
  const simulatorUrl = getSimulatorUrl(crime.name, crime.slots, isPlanning)
  const showSimulator = ["Recruiting", "Planning"].includes(crime.status)
  const showRoleWeights = ["Recruiting", "Planning"].includes(crime.status) && roleWeights
  const showPredictButton =
    crime.status === "Planning" &&
    SUPPORTED_SCENARIOS.includes(crime.name) &&
    crime.slots.every((slot) => slot.user && slot.checkpoint_pass_rate !== undefined)

  const copyToClipboard = (id: number) => {
    navigator.clipboard.writeText(id.toString())
  }

  const handlePredictClick = async () => {
    if (isPredicting) return

    setIsPredicting(true)

    try {
      const parameters = crime.slots.map((slot) => slot.checkpoint_pass_rate || 0)
      const result = await getSuccessPrediction(crime.name, parameters)
      setPrediction(result)
    } finally {
      setIsPredicting(false)
    }
  }

  return (
    <div
      id={crimeAnchorId}
      className="bg-card border border-border/30 rounded-lg p-3 hover:border-primary/50 transition-colors scroll-mt-20"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <a
                href={`https://www.torn.com/factions.php?step=your&type=1#/tab=crimes&crimeId=${crime.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground font-normal hover:text-primary hover:underline transition-colors"
                title="View crime in Torn"
              >
                {crime.name}
              </a>
            <button
              onClick={() => copyToClipboard(crime.id)}
              title="Copy ID"
              className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded border border-border/50 hover:border-primary hover:text-primary transition-colors font-mono font-bold"
            >
              {crime.id}
            </button>
            {onReloadCrime && canReloadThisCrime && canReloadCrimes && (
              <button
                onClick={() => onReloadCrime(crime.id)}
                disabled={isReloading}
                title="Reload crime data"
                className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded border border-border/50 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} className={isReloading ? "animate-spin" : ""} />
              </button>
            )}
            {showSimulator && (
              <a
                href={simulatorUrl || "#"}
                target={simulatorUrl ? "_blank" : undefined}
                rel={simulatorUrl ? "noopener noreferrer" : undefined}
                onClick={(e) => {
                  if (!simulatorUrl) e.preventDefault()
                }}
                title={simulatorUrl ? "Open simulator" : "Simulator not available"}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                  simulatorUrl
                    ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40 hover:bg-yellow-500/30"
                    : "bg-gray-500/10 text-gray-500 border-gray-500/30 cursor-not-allowed opacity-50"
                }`}
              >
                <Microscope size={12} />
                Simulate
              </a>
            )}
            {showPredictButton && (
              <button
                onClick={handlePredictClick}
                disabled={isPredicting}
                title="Get success prediction"
                className="text-xs px-2 py-0.5 rounded border transition-colors flex items-center gap-1 bg-purple-500/20 text-purple-400 border-purple-500/40 hover:bg-purple-500/30 disabled:opacity-50"
              >
                <Sparkles size={12} className={isPredicting ? "animate-pulse" : ""} />
                {isPredicting ? "Predicting..." : "Predict"}
              </button>
            )}
            {prediction && crime.status === "Planning" && (
              <span
                className={`text-xs px-2 py-0.5 rounded border font-bold flex items-center gap-1 ${
                  prediction.supported
                    ? prediction.successChance >= 80
                      ? "bg-green-500/20 text-green-400 border-green-500/40"
                      : prediction.successChance >= 60
                        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                        : "bg-red-500/20 text-red-400 border-red-500/40"
                    : "bg-gray-500/10 text-gray-500 border-gray-500/30"
                }`}
                title={prediction.supported ? "Predicted success chance" : "Prediction not supported for this scenario"}
              >
                {prediction.supported ? `${prediction.successChance.toFixed(2)}%` : "N/A"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="text-foreground">
              <span className="text-muted-foreground">Diff:</span>{" "}
              <span className={`font-bold text-base ${getDifficultyColor(crime.difficulty)}`}>{crime.difficulty}</span>
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-foreground">
              <span className="text-muted-foreground">Slots:</span>{" "}
              <span className="font-bold text-base">
                {filledSlots}/{totalSlots}
              </span>
            </span>
            {crime.pass_rate !== undefined && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className={`px-2 py-0.5 rounded border font-bold text-sm ${getPassRateColor(crime.pass_rate)}`}>
                  {crime.pass_rate}%
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <CrimeTimestamps crime={crime} currentTime={currentTime} memberMap={new Map(members.map((m) => [m.id, m]))} />

      {crime.status === "Successful" && (
        <div className="flex gap-2 flex-wrap mb-2">
          {crime.rewards && (
            <CrimeRewards rewards={crime.rewards} items={items} onItemClick={onItemClick} memberMap={memberMap} />
          )}
          <CrimeCost slots={crime.slots} items={items} onItemClick={onItemClick} crimeStatus={crime.status} />
        </div>
      )}

      {crime.status === "Failed" && (
        <div className="mb-2">
          <CrimeCost slots={crime.slots} items={items} onItemClick={onItemClick} crimeStatus={crime.status} />
        </div>
      )}

      {(crime.status === "Planning" || crime.status === "Recruiting") && filledSlots === totalSlots && (
        <div className="mb-2">
          <CrimeCost slots={crime.slots} items={items} onItemClick={onItemClick} crimeStatus={crime.status} />
        </div>
      )}

      <div className="pt-1.5 border-t border-border/30">
        <p className="text-xs text-muted-foreground mb-1 font-bold uppercase">Positions:</p>
        <div className="space-y-1">
          {crime.slots.map((slot, idx) => {
            // Count occurrences of this position name before this slot for indexed lookup
            const positionOccurrence = crime.slots.slice(0, idx).filter(s => s.position === slot.position).length
            const roleWeight = showRoleWeights && roleWeights ? getRoleWeight(roleWeights, crime.name, slot.position, positionOccurrence) : null
            
            // Get per-role min CPR from settings, fallback to global default
            const roleMinCPR = minCPRSettings?.[crime.name]?.[slot.position] ?? DEFAULT_MIN_CPR
            
            const isHighRiskRole =
              roleWeight && slot.user && slot.checkpoint_pass_rate !== undefined
                ? shouldAlertLowCPR(slot.checkpoint_pass_rate, roleWeight, roleMinCPR)
                : false

            return (
              <CrimeSlot
                key={idx}
                slot={slot}
                slotIndex={idx}
                crimeId={crime.id}
                crimeName={crime.name}
                crimeStatus={crime.status}
                memberMap={memberMap}
                members={members}
                items={items}
                onItemClick={onItemClick}
                minPassRate={minPassRate}
                roleMinCPR={roleMinCPR}
                roleWeight={roleWeight}
                isHighRiskRole={isHighRiskRole}
                membersNotInOCSet={membersNotInOCSet}
                cprTrackerData={cprTrackerData}
                cprTrackerEnabled={cprTrackerEnabled}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
