export const ARMORY_ACTIONS = ["All", "retrieved", "used", "filled", "gave", "deposited", "loaned", "returned"] as const

export type ArmoryAction = (typeof ARMORY_ACTIONS)[number]

export const TIME_FILTER_OPTIONS = [
  { label: "All Time", value: "All" },
  { label: "Last 1 Hour", value: "1h" },
  { label: "Last 6 Hours", value: "6h" },
  { label: "Last 12 Hours", value: "12h" },
  { label: "Last 24 Hours", value: "24h" },
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
] as const
