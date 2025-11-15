export function getDifficultyColor(difficulty: number): string {
  if (difficulty <= 2) return "text-green-400"
  if (difficulty <= 5) return "text-yellow-400"
  if (difficulty <= 8) return "text-orange-400"
  return "text-red-400"
}

export function getPassRateColor(passRate: number): string {
  if (passRate < 60) return "bg-red-500/20 text-red-400 border-red-500/30"
  if (passRate < 70) return "bg-orange-500/20 text-orange-400 border-orange-500/30"
  if (passRate < 80) return "bg-green-500/20 text-green-400 border-green-500/30"
  return "bg-green-500/30 text-green-300 border-green-500/40"
}

export function getPositionPassRateColor(passRate?: number): string {
  if (!passRate) return "bg-gray-500/20 text-gray-400 border-gray-500/30"
  if (passRate < 60) return "bg-red-500/20 text-red-400 border-red-500/30"
  if (passRate < 70) return "bg-orange-500/20 text-orange-400 border-orange-500/30"
  if (passRate < 80) return "bg-green-500/20 text-green-400 border-green-500/30"
  return "bg-green-500/30 text-green-300 border-green-500/40"
}

export function getStatusColor(status: string): string {
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

export function getHeaderColor(status: string): string {
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
