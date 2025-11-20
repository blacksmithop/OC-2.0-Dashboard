export interface ArmoryNewsItem {
  uuid: string
  timestamp: number
  news: string
  user: {
    name: string
    id: number
  }
  action: "used" | "filled" | "retrieved" | "deposited" | "gave" | "loaned" | "returned"
  target?: {
    name: string
    id: number
  }
  item: {
    name: string
    quantity: number
  }
  crimeScenario?: {
    crime_id: number
    scenario: string
    role: string
    percentage: number
  }
}

export interface GroupedLog {
  user: {
    name: string
    id: number
  }
  action: string
  item: {
    name: string
    quantity: number
  }
  target?: {
    name: string
    id: number
  }
  timestamp: number
  count: number
  crimeScenario?: ArmoryNewsItem["crimeScenario"]
  originalLogs: ArmoryNewsItem[]
}

export interface FetchProgress {
  current: number
  max: number
}

export interface ArmoryApiResponse {
  armorynews?: Record<string, { news: string; timestamp: number }>
  error?: {
    code: number
    error: string
  }
}
