export const DATE_FILTER_OPTIONS = [
  { label: "All Time", value: 0 },
  { label: "Last 7 Days", value: 7 },
  { label: "Last 14 Days", value: 14 },
  { label: "Last 30 Days", value: 30 },
  { label: "Last 60 Days", value: 60 },
  { label: "Last 90 Days", value: 90 },
] as const

export type DateFilterValue = 0 | 7 | 14 | 30 | 90
