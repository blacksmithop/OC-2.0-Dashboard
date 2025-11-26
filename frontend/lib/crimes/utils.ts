export function generateCrimeId(createdOn?: number): string {
  if (!createdOn) return `crime-${Math.random().toString(36).substr(2, 9)}`
  return `crime-${createdOn}`
}
