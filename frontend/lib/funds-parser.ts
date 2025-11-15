export interface FundsNewsEntry {
  uuid: string
  timestamp: number
  news: string
  user: {
    id: number
    name: string
  }
  action: "deposited" | "gave" | "crime_cut" | "increased" | "decreased" | "paid"
  target: {
    id: number
    name: string
  } | null
  money: number
  oldBalance: number | null
  newBalance: number | null
  crimeScenario: {
    crimeId: number
    scenario: string
    role: string
    percentage: number
  } | null
}

function cleanMoney(moneyStr: string): number {
  return parseInt(moneyStr.replace(/,/g, "").replace(/\$/g, "").replace(/^-+/, ""))
}

export function parseFundsNews(uuid: string, data: { news: string; timestamp: number }): FundsNewsEntry | null {
  const { news, timestamp } = data

  // Pattern 1: Deposit
  const depositMatch = news.match(
    /<a[^>]*XID=(\d+)[^>]*>([^<]+)<\/a>\s+deposited\s+\$([0-9,]+)/i
  )
  if (depositMatch) {
    return {
      uuid,
      timestamp,
      news,
      user: { id: parseInt(depositMatch[1]), name: depositMatch[2] },
      action: "deposited",
      target: null,
      money: cleanMoney(depositMatch[3]),
      oldBalance: null,
      newBalance: null,
      crimeScenario: null,
    }
  }

  // Pattern 2: Was given by
  const givenMatch = news.match(
    /<a[^>]*XID=(\d+)[^>]*>([^<]+)<\/a>\s+was given\s+\$([0-9,]+)\s+by\s+<a[^>]*XID=(\d+)[^>]*>([^<]+)<\/a>/i
  )
  if (givenMatch) {
    return {
      uuid,
      timestamp,
      news,
      user: { id: parseInt(givenMatch[4]), name: givenMatch[5] },
      action: "gave",
      target: { id: parseInt(givenMatch[1]), name: givenMatch[2] },
      money: cleanMoney(givenMatch[3]),
      oldBalance: null,
      newBalance: null,
      crimeScenario: null,
    }
  }

  // Pattern 3: Crime cut
  const crimeCutMatch = news.match(
    /<a[^>]*XID=(\d+)[^>]*>([^<]+)<\/a>\s+increased\s+<a[^>]*XID=(\d+)[^>]*>([^<]+)<\/a>.*?money balance\s+by\s+\$([0-9,]+)\s+from\s+\$([0-9,\-–]+)\s+to\s+\$([0-9,\-–]+)\s+as\s+their\s+([\d\.]+)%\s+cut\s+for\s+their\s+role\s+as\s+([^<]+?)\s+in\s+the\s+faction's\s+([^<]+?)\s+scenario.*?crimeId=(\d+)/is
  )
  if (crimeCutMatch) {
    return {
      uuid,
      timestamp,
      news,
      user: { id: parseInt(crimeCutMatch[1]), name: crimeCutMatch[2] },
      action: "crime_cut",
      target: { id: parseInt(crimeCutMatch[3]), name: crimeCutMatch[4] },
      money: cleanMoney(crimeCutMatch[5]),
      oldBalance: cleanMoney(crimeCutMatch[6]),
      newBalance: cleanMoney(crimeCutMatch[7]),
      crimeScenario: {
        crimeId: parseInt(crimeCutMatch[11]),
        scenario: crimeCutMatch[10].trim(),
        role: crimeCutMatch[9].trim(),
        percentage: parseFloat(crimeCutMatch[8]),
      },
    }
  }

  // Pattern 4: Increased (without crime details)
  const increasedMatch = news.match(
    /<a[^>]*XID=(\d+)[^>]*>([^<]+)<\/a>\s+increased\s+<a[^>]*XID=(\d+)[^>]*>([^<]+)<\/a>.*?money balance\s+by\s+\$([0-9,]+)\s+from\s+\$([0-9,\-–]+)\s+to\s+\$([0-9,\-–]+)/is
  )
  if (increasedMatch) {
    return {
      uuid,
      timestamp,
      news,
      user: { id: parseInt(increasedMatch[1]), name: increasedMatch[2] },
      action: "increased",
      target: { id: parseInt(increasedMatch[3]), name: increasedMatch[4] },
      money: cleanMoney(increasedMatch[5]),
      oldBalance: cleanMoney(increasedMatch[6]),
      newBalance: cleanMoney(increasedMatch[7]),
      crimeScenario: null,
    }
  }

  // Pattern 5: Decreased
  const decreasedMatch = news.match(
    /<a[^>]*XID=(\d+)[^>]*>([^<]+)<\/a>\s+decreased\s+<a[^>]*XID=(\d+)[^>]*>([^<]+)<\/a>.*?money balance\s+by\s+\$([0-9,]+)\s+from\s+\$([0-9,\-–]+)\s+to\s+\$([0-9,\-–]+)/is
  )
  if (decreasedMatch) {
    return {
      uuid,
      timestamp,
      news,
      user: { id: parseInt(decreasedMatch[1]), name: decreasedMatch[2] },
      action: "decreased",
      target: { id: parseInt(decreasedMatch[3]), name: decreasedMatch[4] },
      money: cleanMoney(decreasedMatch[5]),
      oldBalance: cleanMoney(decreasedMatch[6]),
      newBalance: cleanMoney(decreasedMatch[7]),
      crimeScenario: null,
    }
  }

  // Pattern 6: Was paid
  const paidMatch = news.match(
    /<a[^>]*XID=(\d+)[^>]*>([^<]+)<\/a>\s+was paid\s+\$([0-9,]+)\s+for a total of\s+\$([0-9,]+)\s+from the faction by\s+<a[^>]*XID=(\d+)[^>]*>([^<]+)<\/a>/i
  )
  if (paidMatch) {
    return {
      uuid,
      timestamp,
      news,
      user: { id: parseInt(paidMatch[5]), name: paidMatch[6] },
      action: "paid",
      target: { id: parseInt(paidMatch[1]), name: paidMatch[2] },
      money: cleanMoney(paidMatch[3]),
      oldBalance: null,
      newBalance: cleanMoney(paidMatch[4]),
      crimeScenario: null,
    }
  }

  // Unable to parse
  console.warn("[v0] Unable to parse funds news:", news)
  return null
}
