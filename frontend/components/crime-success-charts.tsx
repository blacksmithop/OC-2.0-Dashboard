"use client"

import { useMemo, useState } from "react"
import { VictoryPie } from "victory"

interface Crime {
  id: number
  name: string
  status: string
  rewards?: {
    money: number
    items: Array<{ id: number; quantity: number }>
    respect: number
  }
}

interface CrimeSuccessChartsProps {
  crimes: Crime[]
}

export default function CrimeSuccessCharts({ crimes }: CrimeSuccessChartsProps) {
  const [selectedCrime, setSelectedCrime] = useState<string>("all")
  const [clickedSlice, setClickedSlice] = useState<string | null>(null)

  const { overallData, crimeNames, crimeSpecificData, statusDistribution } = useMemo(() => {
    let successful = 0
    let failed = 0
    const crimeStats = new Map<string, { successful: number; failed: number }>()

    // Count crimes by status
    const statusCounts = {
      Planning: 0,
      Recruiting: 0,
      Success: 0,
      Fail: 0,
      Expired: 0,
    }

    crimes.forEach((crime) => {
      // Count by status for distribution chart
      const status = crime.status
      if (status === "Planning") statusCounts.Planning++
      else if (status === "Recruiting") statusCounts.Recruiting++
      else if (status === "Successful") statusCounts.Success++
      else if (status === "Failure" || status === "Failed") statusCounts.Fail++
      else if (status === "Expired") statusCounts.Expired++

      // Count for success rate charts
      if (crime.status === "Successful") {
        successful++
        const stats = crimeStats.get(crime.name) || { successful: 0, failed: 0 }
        stats.successful++
        crimeStats.set(crime.name, stats)
      } else if (crime.status === "Failure" || crime.status === "Failed") {
        failed++
        const stats = crimeStats.get(crime.name) || { successful: 0, failed: 0 }
        stats.failed++
        crimeStats.set(crime.name, stats)
      }
    })

    const crimeNames = Array.from(crimeStats.keys()).sort()
    const crimeSpecificData = new Map<string, any[]>()

    crimeNames.forEach((name) => {
      const stats = crimeStats.get(name)!
      crimeSpecificData.set(name, [
        {
          x: "Success",
          y: stats.successful,
          label: `Success: ${stats.successful} (${((stats.successful / (stats.successful + stats.failed)) * 100).toFixed(1)}%)`,
        },
        {
          x: "Fail",
          y: stats.failed,
          label: `Fail: ${stats.failed} (${((stats.failed / (stats.successful + stats.failed)) * 100).toFixed(1)}%)`,
        },
      ])
    })

    const total = successful + failed
    const overallData = [
      {
        x: "Success",
        y: successful,
        label: `Success: ${successful} (${total > 0 ? ((successful / total) * 100).toFixed(1) : "0"}%)`,
      },
      {
        x: "Fail",
        y: failed,
        label: `Fail: ${failed} (${total > 0 ? ((failed / total) * 100).toFixed(1) : "0"}%)`,
      },
    ]

    // Create status distribution data
    const totalCrimes = crimes.length
    const statusDistribution = Object.entries(statusCounts)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        x: status,
        y: count,
        label: `${status}: ${count} (${totalCrimes > 0 ? ((count / totalCrimes) * 100).toFixed(1) : "0"}%)`,
      }))

    return { overallData, crimeNames, crimeSpecificData, statusDistribution }
  }, [crimes])

  const SUCCESS_COLORS = ["#22c55e", "#ef4444"] // green for Success, red for Fail
  const STATUS_COLOR_MAP: Record<string, string> = {
    Planning: "#3b82f6", // blue
    Recruiting: "#8b5cf6", // purple
    Success: "#22c55e", // green
    Fail: "#ef4444", // red
    Expired: "#6b7280", // gray
  }

  const currentData = selectedCrime === "all" ? overallData : crimeSpecificData.get(selectedCrime) || []

  const successRateColors = currentData.map((item) => (item.x === "Success" ? "#22c55e" : "#ef4444"))
  const statusColors = statusDistribution.map((item) => STATUS_COLOR_MAP[item.x] || "#6b7280")

  const handleSliceClick = (sliceName: string) => {
    setClickedSlice(sliceName === clickedSlice ? null : sliceName)
    console.log(`[v0] Clicked on slice: ${sliceName}`)
  }

  if (currentData.length === 0 && statusDistribution.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Success Rate Chart */}
      <div className="bg-card rounded-lg border border-border/50 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground">Success Rate Analysis</h3>
          <select
            value={selectedCrime}
            onChange={(e) => setSelectedCrime(e.target.value)}
            className="bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Overall Success Rate</option>
            {crimeNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {currentData.length > 0 && (
          <>
            <div className="flex justify-center">
              <svg width={300} height={300} style={{ overflow: "visible" }}>
                <VictoryPie
                  standalone={false}
                  width={300}
                  height={300}
                  data={currentData}
                  innerRadius={0}
                  colorScale={successRateColors}
                  style={{
                    labels: { fill: "transparent" },
                    data: {
                      stroke: "#ffffff",
                      strokeWidth: 2,
                      cursor: "pointer",
                    },
                  }}
                  animate={{
                    duration: 1000,
                    onLoad: { duration: 1000 },
                  }}
                  events={[
                    {
                      target: "data",
                      eventHandlers: {
                        onClick: () => {
                          return [
                            {
                              target: "data",
                              mutation: (props) => {
                                handleSliceClick(props.datum.x)
                                return null
                              },
                            },
                          ]
                        },
                        onMouseOver: () => {
                          return [
                            {
                              target: "data",
                              mutation: () => ({
                                style: {
                                  stroke: "#ffffff",
                                  strokeWidth: 3,
                                  cursor: "pointer",
                                  filter: "brightness(1.1)",
                                },
                              }),
                            },
                          ]
                        },
                        onMouseOut: () => {
                          return [
                            {
                              target: "data",
                              mutation: () => null,
                            },
                          ]
                        },
                      },
                    },
                  ]}
                />
              </svg>
            </div>
            <div className="flex justify-center gap-4 mt-2 flex-wrap">
              {currentData.map((entry, index) => {
                const color = successRateColors[index]
                return (
                  <div key={`legend-${index}`} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs font-medium" style={{ color: color }}>
                      {entry.label}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 text-center">
              <p className="text-xs text-muted-foreground">
                {selectedCrime === "all"
                  ? `Total: ${currentData.reduce((sum, item) => sum + item.y, 0)} crimes`
                  : `${selectedCrime}: ${currentData.reduce((sum, item) => sum + item.y, 0)} crimes`}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Status Distribution Chart */}
      <div className="bg-card rounded-lg border border-border/50 p-4">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-foreground">Crime Status Distribution</h3>
        </div>
        {statusDistribution.length > 0 && (
          <>
            <div className="flex justify-center">
              <svg width={300} height={300} style={{ overflow: "visible" }}>
                <VictoryPie
                  standalone={false}
                  width={300}
                  height={300}
                  data={statusDistribution}
                  innerRadius={0}
                  colorScale={statusColors}
                  style={{
                    labels: { fill: "transparent" },
                    data: {
                      stroke: "#ffffff",
                      strokeWidth: 2,
                      cursor: "pointer",
                    },
                  }}
                  animate={{
                    duration: 1000,
                    onLoad: { duration: 1000 },
                  }}
                  events={[
                    {
                      target: "data",
                      eventHandlers: {
                        onClick: () => {
                          return [
                            {
                              target: "data",
                              mutation: (props) => {
                                handleSliceClick(props.datum.x)
                                return null
                              },
                            },
                          ]
                        },
                        onMouseOver: () => {
                          return [
                            {
                              target: "data",
                              mutation: () => ({
                                style: {
                                  stroke: "#ffffff",
                                  strokeWidth: 3,
                                  cursor: "pointer",
                                  filter: "brightness(1.1)",
                                },
                              }),
                            },
                          ]
                        },
                        onMouseOut: () => {
                          return [
                            {
                              target: "data",
                              mutation: () => null,
                            },
                          ]
                        },
                      },
                    },
                  ]}
                />
              </svg>
            </div>
            <div className="flex justify-center gap-4 mt-2 flex-wrap">
              {statusDistribution.map((entry, index) => {
                const color = statusColors[index]
                return (
                  <div key={`legend-${index}`} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs font-medium" style={{ color: color }}>
                      {entry.label}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 text-center">
              <p className="text-xs text-muted-foreground">
                Total: {statusDistribution.reduce((sum, item) => sum + item.y, 0)} crimes
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
