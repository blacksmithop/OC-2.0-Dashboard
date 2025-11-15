"use client"

import type React from "react"

import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { ChevronDown, ArrowUpDown, RefreshCw, Microscope, AlertTriangle, Sparkles } from 'lucide-react'
import ItemModal from "./item-modal"
import { canReloadIndividualCrimes } from "@/lib/api-scopes"
import { getSimulatorUrl, hasSimulator } from "@/lib/crime-simulator-urls"
import { getRoleWeights, getRoleWeight, getWeightColor, getWeightBgColor, shouldAlertLowCPR } from "@/lib/role-weights"
import { getSuccessPrediction, SUPPORTED_SCENARIOS, type SuccessPrediction } from "@/lib/success-prediction"
import { getItemMarketPrice } from "@/lib/marketplace-price"

interface Slot {
  position: string
  position_id: string
  user: {
    id: number
    name?: string
    outcome?: string
    item_outcome?: { owned_by: string; item_id: number; item_uid: number; outcome: string }
  } | null
  checkpoint_pass_rate?: number
  item_requirement?: {
    id: number
    is_reusable: boolean
    is_available: boolean
  }
}

interface Rewards {
  money: number
  items: Array<{ id: number; quantity: number }>
  respect: number
  scope: number
  payout?: {
    type: string
    percentage: number
    paid_by: number
    paid_at: number
  }
}

interface Crime {
  id: number
  name: string
  difficulty: number
  participants: number
  status: string
  planned_by: { id: number; name: string }
  initiated_by: { id: number; name: string } | null
  slots: Slot[]
  pass_rate?: number
  progress?: number
  item_requirement?: {
    id: number
    is_reusable: boolean
    is_available: boolean
  }
  created_at?: number
  planning_at?: number
  executed_at?: number
  ready_at?: number
  expired_at?: number
  rewards?: Rewards
}

interface CrimesListProps {
  crimes: Crime[]
  members: Array<{ id: number; name: string }>
  items: Map<number, any>
  onMemberClick?: (memberId: number) => void
  onCrimeReload?: (crimeId: number) => Promise<Crime | null>
  minPassRate: number
}

export default function CrimesList({
  crimes,
  members,
  items,
  onMemberClick,
  onCrimeReload,
  minPassRate,
}: CrimesListProps) {
  const [collapsedStatus, setCollapsedStatus] = useState<Set<string>>(
    new Set(["Recruiting", "Planning", "Ongoing", "Successful", "Failed", "Expired"]),
  )
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [sortBy, setSortBy] = useState<{ [key: string]: "difficulty" | "filled" | "timeLeft" | "none" }>({})
  const [filterAtRisk, setFilterAtRisk] = useState<{ [key: string]: boolean }>({})
  const [currentTime, setCurrentTime] = useState(Date.now() / 1000)
  const [reloadingCrimes, setReloadingCrimes] = useState<Set<number>>(new Set())
  const [visibleCrimes, setVisibleCrimes] = useState<{ [key: string]: number }>({})
  const [canReloadCrimes, setCanReloadCrimes] = useState(true)
  const observerRef = useRef<{ [key: string]: IntersectionObserver | null }>({})
  const loadMoreRef = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const [roleWeights, setRoleWeights] = useState<Awaited<ReturnType<typeof getRoleWeights>> | null>(null)
  const [successPredictions, setSuccessPredictions] = useState<Map<number, SuccessPrediction>>(new Map())
  const [loadingPredictions, setLoadingPredictions] = useState<Set<number>>(new Set())
  const [itemPrices, setItemPrices] = useState<Map<number, number | null>>(new Map())
  const [loadingPrices, setLoadingPrices] = useState<Set<number>>(new Set())


  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now() / 1000)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setCanReloadCrimes(canReloadIndividualCrimes())
  }, [])

  useEffect(() => {
    getRoleWeights().then(setRoleWeights)
  }, [])


  const handlePredictClick = async (crime: Crime) => {
    if (loadingPredictions.has(crime.id)) return

    setLoadingPredictions(prev => new Set(prev).add(crime.id))

    try {
      const parameters = crime.slots.map(slot => slot.checkpoint_pass_rate || 0)
      const prediction = await getSuccessPrediction(crime.name, parameters)
      
      setSuccessPredictions(prev => {
        const next = new Map(prev)
        next.set(crime.id, prediction)
        return next
      })
    } finally {
      setLoadingPredictions(prev => {
        const next = new Set(prev)
        next.delete(crime.id)
        return next
      })
    }
  }

  const fetchItemPrice = async (itemId: number) => {
    if (loadingPrices.has(itemId) || itemPrices.has(itemId)) return

    setLoadingPrices(prev => new Set(prev).add(itemId))

    try {
      const price = await getItemMarketPrice(itemId)
      setItemPrices(prev => {
        const next = new Map(prev)
        next.set(itemId, price)
        return next
      })
    } finally {
      setLoadingPrices(prev => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }


  const memberMap = useMemo(() => {
    const map: { [key: number]: string } = {}
    members.forEach((member) => {
      map[member.id] = member.name
    })
    return map
  }, [members])

  const hasAtRiskMembers = (crime: Crime) => {
    return crime.slots.some(
      (slot) => slot.user && slot.checkpoint_pass_rate !== undefined && slot.checkpoint_pass_rate < minPassRate,
    )
  }

  const crimesGrouped = useMemo(() => {
    const groups: { [key: string]: Crime[] } = {
      Recruiting: [],
      Planning: [],
      Ongoing: [],
      Successful: [],
      Failed: [],
      Expired: [],
    }

    const originalCounts: { [key: string]: number } = {
      Recruiting: 0,
      Planning: 0,
      Ongoing: 0,
      Successful: 0,
      Failed: 0,
      Expired: 0,
    }

    crimes.forEach((crime) => {
      const status = crime.status === "Failure" ? "Failed" : crime.status
      if (groups[status]) {
        groups[status].push(crime)
        originalCounts[status]++
      }
    })

    Object.keys(groups).forEach((status) => {
      if (filterAtRisk[status]) {
        groups[status] = groups[status].filter((crime) => hasAtRiskMembers(crime))
      }

      const sort = sortBy[status] || "none"
      if (sort !== "none") {
        groups[status].sort((a, b) => {
          if (sort === "difficulty") {
            return b.difficulty - a.difficulty
          } else if (sort === "filled") {
            const aFilled = a.slots.filter((slot) => slot.user && slot.user.id).length / a.slots.length
            const bFilled = b.slots.filter((slot) => slot.user && slot.user.id).length / b.slots.length
            return bFilled - aFilled
          } else if (sort === "timeLeft") {
            const aTime = a.expired_at || 0
            const bTime = b.expired_at || 0
            return aTime - bTime
          }
          return 0
        })
      }
    })

    return { groups, originalCounts }
  }, [crimes, sortBy, filterAtRisk])

  useEffect(() => {
    const initialVisible: { [key: string]: number } = {}
    Object.keys(crimesGrouped.groups).forEach((status) => {
      initialVisible[status] = Math.min(20, crimesGrouped.groups[status].length)
    })
    setVisibleCrimes(initialVisible)
  }, [crimesGrouped])

  const setupObserver = useCallback(
    (status: string) => {
      if (observerRef.current[status]) {
        observerRef.current[status]?.disconnect()
      }

      observerRef.current[status] = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setVisibleCrimes((prev) => {
              const currentVisible = prev[status] || 20
              const totalCrimes = crimesGrouped.groups[status]?.length || 0
              return {
                ...prev,
                [status]: Math.min(currentVisible + 20, totalCrimes),
              }
            })
          }
        },
        { threshold: 0.1 },
      )

      const element = loadMoreRef.current[status]
      if (element) {
        observerRef.current[status]?.observe(element)
      }
    },
    [crimesGrouped],
  )

  useEffect(() => {
    return () => {
      Object.values(observerRef.current).forEach((observer) => {
        observer?.disconnect()
      })
    }
  }, [])

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return "text-green-400"
    if (difficulty <= 5) return "text-yellow-400"
    if (difficulty <= 8) return "text-orange-400"
    return "text-red-400"
  }

  const getPassRateColor = (passRate: number) => {
    if (passRate < 60) return "bg-red-500/20 text-red-400 border-red-500/30"
    if (passRate < 70) return "bg-orange-500/20 text-orange-400 border-orange-500/30"
    if (passRate < 80) return "bg-green-500/20 text-green-400 border-green-500/30"
    return "bg-green-500/30 text-green-300 border-green-500/40"
  }

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      Planning: "bg-blue-500/15 text-blue-400 border-blue-500/40",
      Recruiting: "bg-purple-500/15 text-purple-400 border-purple-500/40",
      Ongoing: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40",
      Successful: "bg-green-500/15 text-green-400 border-green-500/40",
      Failed: "bg-red-500/15 text-red-400 border-red-500/40",
      Expired: "bg-gray-500/15 text-gray-400 border-gray-500/40",
    }
    return colors[status] || "bg-gray-500/15 text-gray-400 border-gray-500/40"
  }

  const getHeaderColor = (status: string) => {
    const colors: { [key: string]: string } = {
      Planning: "bg-blue-500/20 text-blue-300 border-blue-500/40",
      Recruiting: "bg-purple-500/20 text-purple-300 border-purple-500/40",
      Ongoing: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
      Successful: "bg-green-500/20 text-green-300 border-green-500/40",
      Failed: "bg-red-500/20 text-red-300 border-red-500/40",
      Expired: "bg-gray-500/20 text-gray-300 border-gray-500/40",
    }
    return colors[status] || "bg-gray-500/20 text-gray-300 border-gray-500/40"
  }

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return null
    const date = new Date(timestamp * 1000)
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const year = String(date.getFullYear()).slice(-2)
    return `${day}-${month}-${year}`
  }

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return null
    const date = new Date(timestamp * 1000)
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    const seconds = String(date.getSeconds()).padStart(2, "0")
    return `${hours}:${minutes}:${seconds}`
  }

  const getTimeRemaining = (expiredAt?: number) => {
    if (!expiredAt) return null
    const remaining = expiredAt - currentTime
    if (remaining <= 0) return "Expired"

    const days = Math.floor(remaining / 86400)
    const hours = Math.floor((remaining % 86400) / 3600)
    const minutes = Math.floor((remaining % 3600) / 60)
    const seconds = Math.floor(remaining % 60)

    const parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    parts.push(`${seconds}s`)

    return parts.join(" ") + " remaining"
  }

  const getPositionPassRateColor = (passRate?: number) => {
    if (!passRate) return "bg-gray-500/20 text-gray-400 border-gray-500/30"
    if (passRate < 60) return "bg-red-500/20 text-red-400 border-red-500/30"
    if (passRate < 70) return "bg-orange-500/20 text-orange-400 border-orange-500/30"
    if (passRate < 80) return "bg-green-500/20 text-green-400 border-green-500/30"
    return "bg-green-500/30 text-green-300 border-green-500/40"
  }

  const copyToClipboard = (id: number) => {
    navigator.clipboard.writeText(id.toString())
  }

  const handleReloadCrime = async (crimeId: number) => {
    if (!onCrimeReload || reloadingCrimes.has(crimeId)) return

    setReloadingCrimes((prev) => new Set(prev).add(crimeId))

    try {
      await onCrimeReload(crimeId)
    } finally {
      setReloadingCrimes((prev) => {
        const next = new Set(prev)
        next.delete(crimeId)
        return next
      })
    }
  }

  const formatDateTime = (timestamp?: number) => {
    if (!timestamp) return null
    const date = new Date(timestamp * 1000)
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const year = String(date.getFullYear()).slice(-2)
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    return `${day}-${month}-${year} ${hours}:${minutes}`
  }

  const renderCrimeGroup = (status: string, crimes: Crime[], originalCount: number) => {
    const isExpanded = !collapsedStatus.has(status)
    const currentSort = sortBy[status] || "none"
    const isFilteringAtRisk = filterAtRisk[status] || false
    const visibleCount = visibleCrimes[status] || 20
    const hasMoreCrimes = visibleCount < crimes.length
    const displayedCrimes = crimes.slice(0, visibleCount)

    const toggleExpanded = () => {
      const newCollapsed = new Set(collapsedStatus)
      if (isExpanded) {
        newCollapsed.add(status)
      } else {
        newCollapsed.delete(status)
      }
      setCollapsedStatus(newCollapsed)
    }

    const handleSort = (sortType: "difficulty" | "filled" | "timeLeft") => {
      setSortBy((prev) => ({
        ...prev,
        [status]: prev[status] === sortType ? "none" : sortType,
      }))
    }

    const toggleAtRiskFilter = (e: React.MouseEvent) => {
      e.stopPropagation()
      setFilterAtRisk((prev) => ({
        ...prev,
        [status]: !prev[status],
      }))
    }

    return (
      <div key={status} className="mb-3">
        <button
          onClick={toggleExpanded}
          className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all ${getHeaderColor(status)} font-bold`}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold">{status}</h3>
            <span className="text-sm font-bold">({crimes.length})</span>
          </div>
          <ChevronDown size={20} className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
        </button>

        {isExpanded && (
          <div className="mt-2 space-y-2 animate-in fade-in duration-200">
            {originalCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border">
                <span className="text-xs text-foreground font-bold uppercase">Sort:</span>
                <button
                  onClick={() => handleSort("difficulty")}
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
                  onClick={() => handleSort("filled")}
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
                  onClick={() => handleSort("timeLeft")}
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
                    onClick={toggleAtRiskFilter}
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

            {crimes.length === 0 ? (
              <div className="bg-card border border-border/30 rounded-lg p-6 text-center">
                <p className="text-muted-foreground text-sm">
                  {isFilteringAtRisk
                    ? "No crimes with members below the minimum pass rate"
                    : "No crimes in this category"}
                </p>
              </div>
            ) : (
              <>
                {displayedCrimes.map((crime) => {
                  const crimeAnchorId = `crime-${crime.id}`
                  const filledSlots = crime.slots.filter((slot) => slot.user && slot.user.id).length
                  const totalSlots = crime.slots.length
                  const isReloading = reloadingCrimes.has(crime.id)
                  const canReload = !["Successful", "Failed", "Expired"].includes(crime.status)
                  const simulatorUrl = getSimulatorUrl(crime.name)
                  const showSimulator = ["Recruiting", "Planning"].includes(crime.status)
                  const showRoleWeights = ["Recruiting", "Planning"].includes(crime.status) && roleWeights
                  const prediction = successPredictions.get(crime.id)
                  const showPredictButton = crime.status === 'Planning' && 
                    SUPPORTED_SCENARIOS.includes(crime.name) &&
                    crime.slots.every(slot => slot.user && slot.checkpoint_pass_rate !== undefined)
                  const isPredicting = loadingPredictions.has(crime.id)

                  return (
                    <div
                      key={crime.id}
                      id={crimeAnchorId}
                      className="bg-card border border-border/30 rounded-lg p-3 hover:border-primary/50 transition-colors scroll-mt-20"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-foreground font-normal">{crime.name}</h4>
                            <button
                              onClick={() => copyToClipboard(crime.id)}
                              title="Copy ID"
                              className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded border border-border/50 hover:border-primary hover:text-primary transition-colors font-mono font-bold"
                            >
                              {crime.id}
                            </button>
                            {onCrimeReload && canReload && canReloadCrimes && (
                              <button
                                onClick={() => handleReloadCrime(crime.id)}
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
                                onClick={() => handlePredictClick(crime)}
                                disabled={isPredicting}
                                title="Get success prediction"
                                className="text-xs px-2 py-0.5 rounded border transition-colors flex items-center gap-1 bg-purple-500/20 text-purple-400 border-purple-500/40 hover:bg-purple-500/30 disabled:opacity-50"
                              >
                                <Sparkles size={12} className={isPredicting ? "animate-pulse" : ""} />
                                {isPredicting ? "Predicting..." : "Predict"}
                              </button>
                            )}
                            {prediction && crime.status === 'Planning' && (
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
                              <span className={`font-bold text-base ${getDifficultyColor(crime.difficulty)}`}>
                                {crime.difficulty}
                              </span>
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
                                <span
                                  className={`px-2 py-0.5 rounded border font-bold text-sm ${getPassRateColor(crime.pass_rate)}`}
                                >
                                  {crime.pass_rate}%
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {(crime.created_at || crime.ready_at || crime.executed_at || crime.expired_at) && (
                        <div className="mb-2">
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {crime.created_at && (
                              <div
                                className="flex items-center gap-1"
                                title={`Created: ${formatTime(crime.created_at)}`}
                              >
                                <span className="text-muted-foreground">Created:</span>
                                <span className="font-mono text-foreground font-bold">
                                  {formatDate(crime.created_at)}
                                </span>
                              </div>
                            )}
                            {crime.ready_at && (
                              <div className="flex items-center gap-1" title={`Ready: ${formatTime(crime.ready_at)}`}>
                                <span className="text-muted-foreground">Ready:</span>
                                <span className="font-mono text-foreground font-bold">
                                  {formatDate(crime.ready_at)}
                                </span>
                              </div>
                            )}
                            {crime.executed_at && (
                              <div
                                className="flex items-center gap-1"
                                title={`Executed: ${formatTime(crime.executed_at)}`}
                              >
                                <span className="text-muted-foreground">Executed:</span>
                                <span className="font-mono text-foreground font-bold">
                                  {formatDate(crime.executed_at)}
                                </span>
                              </div>
                            )}
                            {!crime.executed_at && crime.expired_at && (
                              <div
                                className="flex items-center gap-1"
                                title={`Expires: ${formatTime(crime.expired_at)}`}
                              >
                                <span className="text-muted-foreground">Expires:</span>
                                <span className="font-mono text-foreground font-bold">
                                  {formatDate(crime.expired_at)}
                                </span>
                              </div>
                            )}
                          </div>
                          {crime.expired_at && ["Planning", "Recruiting", "Ongoing"].includes(crime.status) && (
                            <div className="text-center font-bold mt-1.5 px-2 py-1.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                              {getTimeRemaining(crime.expired_at)}
                            </div>
                          )}
                        </div>
                      )}

                      {crime.status === "Successful" && crime.rewards && (
                        <div className="inline-block mb-2 p-1.5 bg-green-500/10 rounded border border-green-500/30">
                          <p className="text-xs font-bold text-green-400 mb-1 uppercase">Rewards</p>
                          <table className="text-xs">
                            <tbody>
                              {crime.rewards.money > 0 ? (
                                <tr>
                                  <td className="text-muted-foreground py-0 pr-4">Money:</td>
                                  <td className="font-bold text-foreground text-right py-0">
                                    ${crime.rewards.money.toLocaleString()}
                                  </td>
                                </tr>
                              ) : (crime.rewards.items && crime.rewards.items.length > 0) || (crime.rewards.payout?.type === "Inventory") ? (
                                <tr>
                                  <td className="text-muted-foreground py-0 pr-4">Money:</td>
                                  <td className="font-bold text-foreground text-right py-0">
                                    Custom
                                  </td>
                                </tr>
                              ) : null}
                              {crime.rewards.respect > 0 && (
                                <tr>
                                  <td className="text-muted-foreground py-0 pr-4">Respect:</td>
                                  <td className="font-bold text-foreground text-right py-0">{crime.rewards.respect}</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                          {crime.rewards.items && crime.rewards.items.length > 0 && (
                            <div className="mt-1 pt-1 border-t border-green-500/20">
                              <p className="text-xs font-bold text-green-400 mb-0.5 uppercase">Items</p>
                              <table className="text-xs">
                                <tbody>
                                  {crime.rewards.items.map((rewardItem, itemIdx) => {
                                    const isCustomMoney = crime.rewards && (crime.rewards.money === 0 && (crime.rewards.items.length > 0 || crime.rewards.payout?.type === "Inventory"))
                                    const itemPrice = itemPrices.get(rewardItem.id)
                                    const isPriceLoading = loadingPrices.has(rewardItem.id)
                                    
                                    if (isCustomMoney && !itemPrice && !isPriceLoading && !itemPrices.has(rewardItem.id)) {
                                      fetchItemPrice(rewardItem.id)
                                    }

                                    return (
                                      <tr key={itemIdx}>
                                        <td className="py-0.5 pr-4">
                                          <div className="flex items-center gap-2">
                                            {items.has(rewardItem.id) && (
                                              <button
                                                onClick={() => setSelectedItem(items.get(rewardItem.id))}
                                                className="hover:opacity-80 shrink-0"
                                              >
                                                <img
                                                  src={items.get(rewardItem.id)?.image || "/placeholder.svg"}
                                                  alt={items.get(rewardItem.id)?.name}
                                                  className="w-6 h-6 rounded"
                                                />
                                              </button>
                                            )}
                                            <span className="font-bold text-foreground whitespace-nowrap">
                                              {items.has(rewardItem.id)
                                                ? items.get(rewardItem.id)?.name
                                                : `Item ${rewardItem.id}`}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="font-bold text-foreground text-right py-0.5">x{rewardItem.quantity}</td>
                                        {isCustomMoney && itemPrice !== null && itemPrice !== undefined && (
                                          <td className="text-xs text-muted-foreground text-right py-0.5 pl-2">
                                            Worth: ${(itemPrice * rewardItem.quantity).toLocaleString()}
                                          </td>
                                        )}
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {crime.rewards.payout && (
                            <div className="mt-1 pt-1 border-t border-green-500/20">
                              <p className="text-xs font-bold text-green-400 mb-0.5 uppercase">Payout</p>
                              <table className="text-xs">
                                <tbody>
                                  <tr>
                                    <td className="text-muted-foreground py-0 pr-4">Type:</td>
                                    <td className="font-bold text-foreground text-right capitalize py-0">
                                      {crime.rewards.payout.type}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td className="text-muted-foreground py-0 pr-4">Percentage:</td>
                                    <td className="font-bold text-foreground text-right py-0">
                                      {crime.rewards.payout.percentage}%
                                    </td>
                                  </tr>
                                  <tr>
                                    <td className="text-muted-foreground py-0 pr-4">Paid by:</td>
                                    <td className="text-right py-0">
                                      <a
                                        href={`https://www.torn.com/profiles.php?XID=${crime.rewards.payout.paid_by}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-accent hover:underline font-bold whitespace-nowrap"
                                      >
                                        {memberMap[crime.rewards.payout.paid_by] || `ID: ${crime.rewards.payout.paid_by}`}
                                      </a>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td className="text-muted-foreground py-0 pr-4">Paid at:</td>
                                    <td className="font-mono text-foreground font-bold text-right text-[10px] py-0 whitespace-nowrap">
                                      {formatDateTime(crime.rewards.payout.paid_at)}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}
                          {!crime.rewards.payout && (crime.rewards.money > 0 || (crime.rewards.items && crime.rewards.items.length > 0)) && (
                            <div className="mt-1 pt-1 border-t border-green-500/20">
                              <p className="text-xs text-muted-foreground italic">
                                Payout was handled manually
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="pt-1.5 border-t border-border/30">
                        <p className="text-xs text-muted-foreground mb-1 font-bold uppercase">Positions:</p>
                        <div className="space-y-1">
                          {crime.slots.map((slot, idx) => {
                            const isAtRisk =
                              slot.user &&
                              slot.checkpoint_pass_rate !== undefined &&
                              slot.checkpoint_pass_rate < minPassRate

                            const roleWeight = showRoleWeights ? getRoleWeight(crime.name, slot.position) : null
                            const isHighRiskRole = roleWeight && slot.user && slot.checkpoint_pass_rate !== undefined 
                              ? shouldAlertLowCPR(slot.checkpoint_pass_rate, roleWeight, minPassRate)
                              : false

                            const isOpenRecruitingSlot = crime.status === "Recruiting" && !slot.user
                            const isMissingItemPlanning = crime.status === "Planning" && slot.user && slot.item_requirement && !slot.item_requirement.is_available

                            return (
                              <div
                                key={idx}
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
                                        {isAtRisk && <span className="text-orange-400">⚠️</span>}
                                        {isHighRiskRole && (
                                          <AlertTriangle size={14} className="text-red-400 shrink-0" title="High weight role with low CPR!" />
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
                                        {crime.status === "Successful" && slot.user.outcome && (
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
                                      <span className="text-muted-foreground">Open</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {slot.item_requirement && (
                                      <>
                                        {items.has(slot.item_requirement.id) && (
                                          <button
                                            onClick={() => setSelectedItem(items.get(slot.item_requirement.id))}
                                            className="hover:opacity-80"
                                          >
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
                                {crime.status === "Successful" && slot.user?.item_outcome && slot.item_requirement && (
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
                                      <span className="text-muted-foreground">
                                        Item: {slot.user.item_outcome.outcome}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {hasMoreCrimes && (
                  <div
                    ref={(el) => {
                      loadMoreRef.current[status] = el
                      if (el) setupObserver(status)
                    }}
                    className="bg-card border border-border/30 rounded-lg p-4 text-center"
                  >
                    <p className="text-muted-foreground text-sm">
                      Showing {visibleCount} of {crimes.length} crimes. Scroll to load more...
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      {Object.entries(crimesGrouped.groups).map(([status, crimes]) => {
        return renderCrimeGroup(status, crimes, crimesGrouped.originalCounts[status])
      })}
    </div>
  )
}
