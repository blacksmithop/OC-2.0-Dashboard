import { db, STORES } from "../db/indexeddb"

const API_KEY_STORAGE_KEY = "factionApiKey"

export const apiKeyManager = {
  // Store API key in IndexedDB
  async setApiKey(apiKey: string): Promise<void> {
    await db.set(STORES.API_KEYS, API_KEY_STORAGE_KEY, apiKey)
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey)
  },

  // Get API key from IndexedDB, fallback to localStorage
  async getApiKey(): Promise<string | null> {
    try {
      const key = await db.get<string>(STORES.API_KEYS, API_KEY_STORAGE_KEY)
      if (key) return key

      const localStorageKey = localStorage.getItem(API_KEY_STORAGE_KEY)
      if (localStorageKey) {
        // Migrate to IndexedDB
        await this.setApiKey(localStorageKey)
        return localStorageKey
      }

      return null
    } catch (error) {
      console.error("[v0] Error getting API key:", error)
      // Fallback to localStorage on error
      return localStorage.getItem(API_KEY_STORAGE_KEY)
    }
  },

  // Remove API key from both IndexedDB and localStorage
  async removeApiKey(): Promise<void> {
    await db.delete(STORES.API_KEYS, API_KEY_STORAGE_KEY)
    localStorage.removeItem(API_KEY_STORAGE_KEY)
  },

  // Check if user has API key (synchronous check for initial render)
  hasApiKeySync(): boolean {
    return localStorage.getItem(API_KEY_STORAGE_KEY) !== null
  },
}
