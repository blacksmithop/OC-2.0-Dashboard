export function formatDate(timestamp?: number): string | null {
  if (!timestamp) return null
  const date = new Date(timestamp * 1000)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = String(date.getFullYear()).slice(-2)
  return `${day}-${month}-${year}`
}

export function formatTime(timestamp?: number): string | null {
  if (!timestamp) return null
  const date = new Date(timestamp * 1000)
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  return `${hours}:${minutes}:${seconds}`
}

export function formatDateTime(timestamp?: number): string | null {
  if (!timestamp) return null
  const date = new Date(timestamp * 1000)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = String(date.getFullYear()).slice(-2)
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${day}-${month}-${year} ${hours}:${minutes}`
}

export function getTimeRemaining(expiredAt: number, currentTime: number): string | null {
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

export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num)
}

export function formatCurrency(num: number): string {
  return `$${formatNumber(num)}`
}
