import { db, STORES } from "./db/indexeddb"
import { apiKeyManager } from "./auth/api-key-manager"
import { thirdPartySettingsManager } from "./settings/third-party-manager"

export async function handleFullLogout() {
  console.log("[v0] Starting logout process...")

  await apiKeyManager.removeApiKey()
  await thirdPartySettingsManager.clearSettings()

  await db.clear(STORES.CACHE)
  await db.clear(STORES.SETTINGS)
  await db.clear(STORES.API_KEYS)

  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key))

  console.log("[v0] All data cleared on logout")

  if (typeof window !== "undefined") {
    window.location.href = "/"
  }
}
