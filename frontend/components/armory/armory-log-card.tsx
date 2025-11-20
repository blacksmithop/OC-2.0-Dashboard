"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import type { TornItem } from "@/lib/cache/items-cache"
import type { GroupedLog } from "@/lib/armory/types"
import { useState } from "react"

interface ArmoryLogCardProps {
  log: GroupedLog
  item: TornItem | null
  category: string
  onItemClick: (item: TornItem) => void
}

export default function ArmoryLogCard({ log, item, category, onItemClick }: ArmoryLogCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasMultipleLogs = log.count > 1

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case "deposited":
        return "text-green-500"
      case "retrieved":
        return "text-blue-500"
      case "loaned":
        return "text-yellow-500"
      case "returned":
        return "text-cyan-500"
      case "gave":
        return "text-purple-500"
      case "used":
        return "text-red-500"
      case "filled":
        return "text-orange-500"
      default:
        return "text-muted-foreground"
    }
  }

  const getDirectionText = (action: string) => {
    if (action === "loaned" || action === "gave") return "to"
    if (action === "retrieved") return "from"
    return "to/from"
  }

  return (
    <div className="hover:bg-accent/5 transition-colors">
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="flex-1 flex items-start gap-3">
          {/* Item thumbnail */}
          {item && (
            <button
              onClick={() => onItemClick(item)}
              className="w-12 h-12 flex-shrink-0 bg-background rounded border border-border hover:border-primary transition-colors overflow-hidden"
              title={`View ${item.name} details`}
            >
              <img src={item.image || "/placeholder.svg"} alt={item.name} className="w-full h-full object-contain" />
            </button>
          )}

          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`https://www.torn.com/profiles.php?XID=${log.user.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                {log.user.name}
              </a>
              <span className={`font-medium ${getActionColor(log.action)}`}>{log.action}</span>
              <span className="text-foreground font-medium">
                {log.item.quantity > 1 ? `${log.item.quantity}x ` : ""}
                {log.item.name}
                {hasMultipleLogs && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-muted-foreground hover:text-foreground ml-1 inline-flex items-center gap-1"
                  >
                    ({log.count} times)
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}
              </span>
              {log.target && (
                <>
                  <span className="text-muted-foreground">{getDirectionText(log.action)}</span>
                  <a
                    href={`https://www.torn.com/profiles.php?XID=${log.target.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    {log.target.name}
                  </a>
                </>
              )}
            </div>
            {log.crimeScenario && (
              <div className="text-sm text-muted-foreground">
                Crime reward: {log.crimeScenario.percentage}% cut as {log.crimeScenario.role} in{" "}
                {log.crimeScenario.scenario}
              </div>
            )}
            <div className="text-xs text-muted-foreground">Category: {category}</div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(log.timestamp)}</div>
      </div>

      {/* Expandable details section for grouped logs */}
      {hasMultipleLogs && isExpanded && (
        <div className="px-4 pb-4 pl-[4.5rem]">
          <div className="bg-accent/10 rounded-lg p-3 space-y-2 border border-border">
            <div className="text-sm font-medium text-muted-foreground mb-2">Individual Actions:</div>
            {log.originalLogs.map((originalLog, logIdx) => (
              <div
                key={`${originalLog.uuid}-${logIdx}`}
                className="text-sm flex items-center justify-between gap-4 py-1"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {originalLog.target ? (
                    <>
                      <span className="text-muted-foreground">{getDirectionText(originalLog.action)}</span>
                      <a
                        href={`https://www.torn.com/profiles.php?XID=${originalLog.target.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-medium"
                      >
                        {originalLog.target.name}
                      </a>
                      {originalLog.item.quantity > 1 && (
                        <span className="text-muted-foreground">({originalLog.item.quantity}x)</span>
                      )}
                    </>
                  ) : (
                    <span className="text-foreground">
                      {originalLog.item.quantity > 1 ? `${originalLog.item.quantity}x ` : ""}
                      {originalLog.item.name}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(originalLog.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
