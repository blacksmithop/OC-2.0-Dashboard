"use client"

import { useMemo, useState, useEffect } from "react"
import { ChevronDown, Send } from "lucide-react"
import ItemModal from "./item-modal"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { sendRequiredItemsWebhook } from "@/lib/integration/discord-webhook"
import { useToast } from "@/hooks/use-toast"
import { thirdPartySettingsManager } from "@/lib/settings/third-party-manager"

interface Crime {
  id: number
  name: string
  status: string
  rewards?: {
    money: number
    items: Array<{ id: number; quantity: number }>
    respect: number
  }
  slots?: Array<{
    position: string
    user?: {
      id: number
    }
    item_requirement?: {
      id: number
      is_available: boolean
      is_reusable: boolean
    }
  }>
}

interface Member {
  id: number
  name: string
  position: string
}

interface RequiredItem {
  itemId: number
  itemName: string
  requiredBy: Array<{
    memberId: number
    memberName: string
    crimeId: number
    crimeName: string
    position: string
  }>
}

interface CrimeSummaryProps {
  crimes: Crime[]
  items: Map<number, any>
  minPassRate?: number
  onMinPassRateChange?: (value: number) => void
  membersNotInOC?: Member[]
  allCrimes?: Crime[]
  memberMap?: Map<number, Member>
  showDiscordButtons?: boolean // Added prop to control Discord button visibility
  showItemsNeeded?: boolean // Added prop to control Items Needed section visibility
}

export default function CrimeSummary({
  crimes,
  items,
  minPassRate,
  onMinPassRateChange,
  membersNotInOC,
  allCrimes = [],
  memberMap = new Map(),
  showDiscordButtons = false, // Default to false so buttons only show when explicitly enabled
  showItemsNeeded = false, // Default to false so Items Needed section only shows when explicitly enabled
}: CrimeSummaryProps) {
  const [isItemsExpanded, setIsItemsExpanded] = useState(false)
  const [isItemsNeededExpanded, setIsItemsNeededExpanded] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const { toast } = useToast()

  const [discordEnabled, setDiscordEnabled] = useState(false)
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("")
  const [sendingWebhook, setSendingWebhook] = useState(false)

  useEffect(() => {
    const loadDiscordSettings = async () => {
      const settings = await thirdPartySettingsManager.getSettings()
      if (settings.discord) {
        setDiscordEnabled(settings.discord.enabled || false)
        setDiscordWebhookUrl(settings.discord.webhookUrl || "")
      }
    }
    loadDiscordSettings()
  }, [])

  const summary = useMemo(() => {
    let totalMoney = 0
    let totalRespect = 0
    let totalItemValue = 0
    let totalCost = 0
    const statusCounts = {
      Planning: 0,
      Recruiting: 0,
      Successful: 0,
      Failed: 0,
      Expired: 0,
    }
    const itemsGained = new Map<number, { item: any; quantity: number; totalValue: number }>()
    const itemsConsumed = new Map<number, { item: any; quantity: number; totalCost: number }>()
    const planningItemsNeeded = new Map<number, { item: any; needed: number; available: number }>()
    const recruitingItemsNeeded = new Map<number, { item: any; needed: number; available: number; filled: number }>()

    crimes.forEach((crime) => {
      const status = crime.status === "Failure" ? "Failed" : crime.status
      if (status in statusCounts) {
        statusCounts[status as keyof typeof statusCounts]++
      }

      crime.slots?.forEach((slot) => {
        if (slot.item_requirement) {
          const itemId = slot.item_requirement.id
          const itemData = items.get(itemId)

          if (itemData) {
            if (crime.status === "Planning") {
              if (planningItemsNeeded.has(itemId)) {
                const existing = planningItemsNeeded.get(itemId)!
                existing.needed += 1
                if (slot.item_requirement.is_available) {
                  existing.available += 1
                }
              } else {
                planningItemsNeeded.set(itemId, {
                  item: itemData,
                  needed: 1,
                  available: slot.item_requirement.is_available ? 1 : 0,
                })
              }
            } else if (crime.status === "Recruiting") {
              if (recruitingItemsNeeded.has(itemId)) {
                const existing = recruitingItemsNeeded.get(itemId)!
                existing.needed += 1
                if (slot.item_requirement.is_available) {
                  existing.available += 1
                }
                if (slot.user) {
                  existing.filled += 1
                }
              } else {
                recruitingItemsNeeded.set(itemId, {
                  item: itemData,
                  needed: 1,
                  available: slot.item_requirement.is_available ? 1 : 0,
                  filled: slot.user ? 1 : 0,
                })
              }
            }

            if (crime.status === "Successful") {
              if (!slot.item_requirement?.is_reusable) {
                const itemCost = itemData.value?.market_price || 0
                totalCost += itemCost

                if (itemsConsumed.has(itemId)) {
                  const existing = itemsConsumed.get(itemId)!
                  existing.quantity += 1
                  existing.totalCost += itemCost
                } else {
                  itemsConsumed.set(itemId, {
                    item: itemData,
                    quantity: 1,
                    totalCost: itemCost,
                  })
                }
              }
            }
          }
        }
      })
    })

    crimes.forEach((crime) => {
      if (crime.status === "Successful" && crime.rewards) {
        totalMoney += crime.rewards.money || 0
        totalRespect += crime.rewards.respect || 0

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
      totalCost,
      itemsConsumed: Array.from(itemsConsumed.values()),
      statusCounts,
      itemsGained: Array.from(itemsGained.values()),
      planningItemsNeeded: Array.from(planningItemsNeeded.values()),
      recruitingItemsNeeded: Array.from(recruitingItemsNeeded.values()),
    }
  }, [crimes, items])

  const handleSendItemsToDiscord = async (type: "loaded" | "required") => {
    if (!discordWebhookUrl || !discordEnabled) {
      toast({
        title: "Error",
        description: "Discord webhook is not configured. Please configure it in Settings.",
        variant: "destructive",
      })
      return
    }

    setSendingWebhook(true)

    try {
      const itemsMap = new Map<number, RequiredItem>()
      const targetCrimes = allCrimes.filter((crime) => ["Planning", "Recruiting"].includes(crime.status))

      targetCrimes.forEach((crime) => {
        crime.slots?.forEach((slot) => {
          if (slot.item_requirement) {
            const isLoaded = slot.item_requirement.is_available
            const shouldInclude = type === "loaded" ? isLoaded : !isLoaded

            if (shouldInclude && slot.user) {
              const itemId = slot.item_requirement.id
              const item = items.get(itemId)
              const itemName = item?.name || `Item ${itemId}`

              if (!itemsMap.has(itemId)) {
                itemsMap.set(itemId, {
                  itemId,
                  itemName,
                  requiredBy: [],
                })
              }

              itemsMap.get(itemId)!.requiredBy.push({
                memberId: slot.user.id,
                memberName: memberMap.get(slot.user.id)?.name || `ID: ${slot.user.id}`,
                crimeId: crime.id,
                crimeName: crime.name,
                position: slot.position,
              })
            }
          }
        })
      })

      const itemsList = Array.from(itemsMap.values())

      if (itemsList.length === 0) {
        toast({
          title: "No Items",
          description:
            type === "loaded" ? "No loaded items found in active OCs" : "No required items missing in active OCs",
        })
        return
      }

      const result = await sendRequiredItemsWebhook(discordWebhookUrl, itemsList, type)

      if (result.success) {
        toast({
          title: "Success",
          description: `Sent ${itemsList.length} item(s) to Discord`,
        })
      } else {
        toast({
          title: "Failed",
          description: result.error || "Failed to send webhook",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    } finally {
      setSendingWebhook(false)
    }
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  const formatCurrency = (num: number) => {
    return `$${formatNumber(num)}`
  }

  return (
    <div className="space-y-6">
      {/* History */}
      <div className="bg-card p-3 rounded-lg border border-border/50">
        <div className="text-xs text-muted-foreground mb-2 font-bold">History</div>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Total Value</div>
          <div className="text-2xl font-bold text-green-500">${summary.totalValue.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Direct Money</div>
          <div className="text-2xl font-bold text-green-500">${summary.totalMoney.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Item Value</div>
          <div className="text-2xl font-bold text-orange-500">${summary.totalItemValue.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Total Respect</div>
          <div className="text-2xl font-bold text-blue-500">{summary.totalRespect.toLocaleString()}</div>
        </div>
      </div>

      {summary.totalCost > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium text-muted-foreground">Cost (Consumed Items)</div>
            <div className="text-2xl font-bold text-red-500">${summary.totalCost.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium text-muted-foreground">Net Profit</div>
            <div className="text-2xl font-bold text-cyan-500">
              ${(summary.totalValue - summary.totalCost).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />

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
          <h3 className="text-xs text-muted-foreground font-bold mb-2">Not in OC ({membersNotInOC.length})</h3>
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

      {/* Items Gained section */}
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

      {/* Items Required section */}
      {showItemsNeeded && (summary.planningItemsNeeded.length > 0 || summary.recruitingItemsNeeded.length > 0) && (
        <div className="bg-card rounded-lg border border-border/50">
          <button
            onClick={() => setIsItemsNeededExpanded(!isItemsNeededExpanded)}
            className="w-full flex items-center justify-between p-3 transition-all hover:bg-primary/5"
          >
            <div className="text-xs text-muted-foreground font-bold">
              Items Required (
              {summary.planningItemsNeeded.reduce((acc, item) => acc + item.needed, 0) +
                summary.recruitingItemsNeeded.reduce((acc, item) => acc + item.needed, 0)}
              )
            </div>
            <ChevronDown
              size={16}
              className={`transition-transform duration-300 text-muted-foreground ${isItemsNeededExpanded ? "rotate-180" : ""}`}
            />
          </button>

          {isItemsNeededExpanded && (
            <div className="px-3 pb-3 pt-0 animate-in fade-in duration-200 space-y-4">
              {/* Planning OCs Items */}
              {summary.planningItemsNeeded.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground font-semibold mb-2">Planning OCs</div>
                  <div className="flex flex-wrap gap-2">
                    {summary.planningItemsNeeded.map((itemData, index) => {
                      const isAvailable = itemData.available >= itemData.needed
                      return (
                        <div
                          key={index}
                          className="group relative flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-md"
                          title={`${itemData.item.name}: ${itemData.available}/${itemData.needed} available${itemData.item.value?.market_price ? ` - ${formatCurrency(itemData.item.value.market_price)} each` : ""}`}
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
                          <span className="text-sm text-emerald-300 whitespace-nowrap">
                            {itemData.item.name} ({itemData.needed})
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-bold border ${isAvailable ? "bg-green-500/20 text-green-400 border-green-500/40" : "bg-red-500/20 text-red-400 border-red-500/40"}`}
                          >
                            {isAvailable ? "✓" : "✗"}
                          </span>
                          {itemData.item.value?.market_price && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-background border border-border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              {formatCurrency(itemData.item.value.market_price * itemData.needed)} total
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Divider */}
              {summary.planningItemsNeeded.length > 0 && summary.recruitingItemsNeeded.length > 0 && (
                <div className="border-t border-border/50" />
              )}

              {/* Recruiting OCs Items */}
              {summary.recruitingItemsNeeded.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground font-semibold mb-2">Recruiting OCs (Filled Slots)</div>
                  <div className="flex flex-wrap gap-2">
                    {summary.recruitingItemsNeeded.map((itemData, index) => {
                      const filledSlotsWithItem = itemData.available
                      const totalFilledSlots = itemData.filled
                      const hasAllItems = filledSlotsWithItem >= totalFilledSlots

                      if (totalFilledSlots === 0) return null

                      return (
                        <div
                          key={index}
                          className="group relative flex items-center gap-2 bg-rose-500/20 border border-rose-500/30 px-3 py-1.5 rounded-md"
                          title={`${itemData.item.name}: ${filledSlotsWithItem}/${totalFilledSlots} filled slots have item${itemData.item.value?.market_price ? ` - ${formatCurrency(itemData.item.value.market_price)} each` : ""}`}
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
                          <span className="text-sm text-rose-300 whitespace-nowrap">
                            {itemData.item.name} ({totalFilledSlots})
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-bold border ${hasAllItems ? "bg-green-500/20 text-green-400 border-green-500/40" : "bg-red-500/20 text-red-400 border-red-500/40"}`}
                          >
                            {hasAllItems ? "✓" : "✗"}
                          </span>
                          {itemData.item.value?.market_price && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-background border border-border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              {formatCurrency(itemData.item.value.market_price * totalFilledSlots)} total
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Discord Buttons */}
      {showDiscordButtons && discordEnabled && discordWebhookUrl && (
        <div className="flex gap-2">
          <Alert
            className="flex-1 bg-green-600/10 border-green-600/30 cursor-pointer hover:bg-green-600/20 transition-colors"
            onClick={() => handleSendItemsToDiscord("loaded")}
          >
            <Send className="text-green-400" />
            <AlertDescription className="flex items-center justify-center">
              <span className="text-green-400 font-semibold">
                {sendingWebhook ? "Sending..." : "Send Loaned Items"}
              </span>
            </AlertDescription>
          </Alert>

          <Alert
            className="flex-1 bg-red-600/10 border-red-600/30 cursor-pointer hover:bg-red-600/20 transition-colors"
            onClick={() => handleSendItemsToDiscord("required")}
          >
            <Send className="text-red-400" />
            <AlertDescription className="flex items-center justify-center">
              <span className="text-red-400 font-semibold">
                {sendingWebhook ? "Sending..." : "Send Required Items"}
              </span>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}
