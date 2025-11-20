import type { ArmoryNewsItem, GroupedLog } from "./types"
import type { TornItem } from "@/lib/cache/items-cache"

/**
 * Groups consecutive logs with the same user, action, item, and target
 */
export function groupConsecutiveLogs(logs: ArmoryNewsItem[]): GroupedLog[] {
  if (logs.length === 0) return []

  const grouped: GroupedLog[] = []
  let currentGroup: GroupedLog | null = null
  let currentLogs: ArmoryNewsItem[] = []

  for (const log of logs) {
    const shouldGroup =
      currentGroup &&
      currentGroup.user.id === log.user.id &&
      currentGroup.action === log.action &&
      currentGroup.item.name === log.item.name &&
      currentGroup.target?.id === log.target?.id

    if (shouldGroup && currentGroup) {
      currentGroup.item.quantity += log.item.quantity
      currentGroup.count++
      currentLogs.push(log)
    } else {
      if (currentGroup) {
        currentGroup.originalLogs = currentLogs
        grouped.push(currentGroup)
      }
      currentLogs = [log]
      currentGroup = {
        user: log.user,
        action: log.action,
        item: {
          name: log.item.name,
          quantity: log.item.quantity,
        },
        target: log.target,
        timestamp: log.timestamp,
        count: 1,
        crimeScenario: log.crimeScenario,
        originalLogs: [],
      }
    }
  }

  if (currentGroup) {
    currentGroup.originalLogs = currentLogs
    grouped.push(currentGroup)
  }

  return grouped
}

/**
 * Gets an item from the items map by name (case-insensitive)
 */
export function getItemByName(items: Map<number, TornItem>, itemName: string): TornItem | null {
  for (const item of items.values()) {
    if (item.name.toLowerCase() === itemName.toLowerCase()) {
      return item
    }
  }
  return null
}

/**
 * Gets the category/type of an item by name
 */
export function getItemCategory(items: Map<number, TornItem>, itemName: string): string {
  for (const item of items.values()) {
    if (item.name.toLowerCase() === itemName.toLowerCase()) {
      return item.type || "Other"
    }
  }
  return "Other"
}

/**
 * Converts a time filter string to a Unix timestamp
 */
export function getTimeFilterTimestamp(filter: string): number | null {
  const now = Math.floor(Date.now() / 1000)
  switch (filter) {
    case "1h":
      return now - 3600
    case "6h":
      return now - 6 * 3600
    case "12h":
      return now - 12 * 3600
    case "24h":
      return now - 24 * 3600
    case "7d":
      return now - 7 * 24 * 3600
    case "30d":
      return now - 30 * 24 * 3600
    default:
      return null
  }
}

/**
 * Extracts unique categories from armory news items
 */
export function extractCategories(items: Map<number, TornItem>, news: ArmoryNewsItem[]): string[] {
  const categorySet = new Set<string>()

  for (const log of news) {
    const category = getItemCategory(items, log.item.name)
    categorySet.add(category)
  }

  return ["All", ...Array.from(categorySet).sort()]
}

/**
 * Extracts unique action types from armory news items
 */
export function extractActions(news: ArmoryNewsItem[]): string[] {
  const actionSet = new Set<string>()

  for (const log of news) {
    actionSet.add(log.action)
  }

  return ["All", ...Array.from(actionSet).sort()]
}

/**
 * Applies filters to armory news
 */
export function filterArmoryNews(
  news: ArmoryNewsItem[],
  filters: {
    category?: string
    userId?: number
    timeFilter?: string
    action?: string
  },
  items: Map<number, TornItem>,
): ArmoryNewsItem[] {
  let filtered = news

  // Category filter
  if (filters.category && filters.category !== "All") {
    filtered = filtered.filter((log) => getItemCategory(items, log.item.name) === filters.category)
  }

  // User filter
  if (filters.userId) {
    filtered = filtered.filter((log) => log.user.id === filters.userId)
  }

  // Time filter
  if (filters.timeFilter) {
    const timeFilterTimestamp = getTimeFilterTimestamp(filters.timeFilter)
    if (timeFilterTimestamp) {
      filtered = filtered.filter((log) => log.timestamp >= timeFilterTimestamp)
    }
  }

  // Action filter
  if (filters.action && filters.action !== "All") {
    filtered = filtered.filter((log) => log.action === filters.action)
  }

  return filtered
}

/**
 * Loads max fetch count from localStorage with fallback
 */
export function loadMaxFetchCount(defaultValue = 1000): number {
  const saved = localStorage.getItem("armoryMaxFetch")
  if (saved) {
    const parsed = Number.parseInt(saved, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return defaultValue
}

/**
 * Saves max fetch count to localStorage
 */
export function saveMaxFetchCount(maxFetch: number): void {
  localStorage.setItem("armoryMaxFetch", maxFetch.toString())
}
