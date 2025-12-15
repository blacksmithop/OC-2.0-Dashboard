/**
 * IndexedDB wrapper for the OC Dashboard
 * Replaces localStorage with a more robust and performant storage solution
 */

const DB_NAME = "OCDashboardDB"
const DB_VERSION = 1

// Store names
export const STORES = {
  CACHE: "cache",
  SETTINGS: "settings",
  API_KEYS: "apiKeys",
} as const

interface CacheEntry {
  key: string
  value: any
  timestamp: number
  expiry?: number
}

interface SettingEntry {
  key: string
  value: any
}

class IndexedDBManager {
  private db: IDBDatabase | null = null
  private initPromise: Promise<IDBDatabase> | null = null

  /**
   * Initialize the database
   */
  async init(): Promise<IDBDatabase> {
    // Return existing promise if already initializing
    if (this.initPromise) {
      return this.initPromise
    }

    // Return cached db if already initialized
    if (this.db) {
      return Promise.resolve(this.db)
    }

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        reject(new Error("IndexedDB not available"))
        return
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error("[v0] IndexedDB error:", request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log("[v0] IndexedDB initialized successfully")
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create cache store with key as primary key
        if (!db.objectStoreNames.contains(STORES.CACHE)) {
          const cacheStore = db.createObjectStore(STORES.CACHE, { keyPath: "key" })
          cacheStore.createIndex("timestamp", "timestamp", { unique: false })
          cacheStore.createIndex("expiry", "expiry", { unique: false })
          console.log("[v0] Created cache object store")
        }

        // Create settings store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: "key" })
          console.log("[v0] Created settings object store")
        }

        // Create API keys store
        if (!db.objectStoreNames.contains(STORES.API_KEYS)) {
          db.createObjectStore(STORES.API_KEYS, { keyPath: "key" })
          console.log("[v0] Created API keys object store")
        }
      }
    })

    return this.initPromise
  }

  /**
   * Get a value from a store
   */
  async get<T = any>(storeName: string, key: string): Promise<T | null> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly")
        const store = transaction.objectStore(storeName)
        const request = store.get(key)

        request.onsuccess = () => {
          const result = request.result
          if (result) {
            // For cache entries, check expiry
            if (storeName === STORES.CACHE && result.expiry) {
              if (Date.now() > result.expiry) {
                // Expired, delete it
                this.delete(storeName, key)
                resolve(null)
                return
              }
            }
            resolve(result.value)
          } else {
            resolve(null)
          }
        }

        request.onerror = () => {
          console.error("[v0] IndexedDB get error:", request.error)
          reject(request.error)
        }
      })
    } catch (error) {
      console.error("[v0] Error getting from IndexedDB:", error)
      return null
    }
  }

  /**
   * Set a value in a store
   */
  async set(storeName: string, key: string, value: any, expiryMs?: number): Promise<void> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite")
        const store = transaction.objectStore(storeName)

        const entry: CacheEntry | SettingEntry =
          storeName === STORES.CACHE
            ? {
                key,
                value,
                timestamp: Date.now(),
                expiry: expiryMs ? Date.now() + expiryMs : undefined,
              }
            : { key, value }

        const request = store.put(entry)

        request.onsuccess = () => resolve()
        request.onerror = () => {
          console.error("[v0] IndexedDB set error:", request.error)
          reject(request.error)
        }
      })
    } catch (error) {
      console.error("[v0] Error setting in IndexedDB:", error)
    }
  }

  /**
   * Delete a value from a store
   */
  async delete(storeName: string, key: string): Promise<void> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite")
        const store = transaction.objectStore(storeName)
        const request = store.delete(key)

        request.onsuccess = () => resolve()
        request.onerror = () => {
          console.error("[v0] IndexedDB delete error:", request.error)
          reject(request.error)
        }
      })
    } catch (error) {
      console.error("[v0] Error deleting from IndexedDB:", error)
    }
  }

  /**
   * Clear all entries in a store
   */
  async clear(storeName: string): Promise<void> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite")
        const store = transaction.objectStore(storeName)
        const request = store.clear()

        request.onsuccess = () => {
          console.log(`[v0] Cleared ${storeName} store`)
          resolve()
        }
        request.onerror = () => {
          console.error("[v0] IndexedDB clear error:", request.error)
          reject(request.error)
        }
      })
    } catch (error) {
      console.error("[v0] Error clearing IndexedDB store:", error)
    }
  }

  /**
   * Get all keys from a store
   */
  async getAllKeys(storeName: string): Promise<string[]> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly")
        const store = transaction.objectStore(storeName)
        const request = store.getAllKeys()

        request.onsuccess = () => {
          resolve(request.result as string[])
        }
        request.onerror = () => {
          console.error("[v0] IndexedDB getAllKeys error:", request.error)
          reject(request.error)
        }
      })
    } catch (error) {
      console.error("[v0] Error getting all keys from IndexedDB:", error)
      return []
    }
  }

  /**
   * Delete keys matching a prefix
   */
  async deleteByPrefix(storeName: string, prefix: string): Promise<void> {
    try {
      const keys = await this.getAllKeys(storeName)
      const matchingKeys = keys.filter((key) => key.toString().startsWith(prefix))

      for (const key of matchingKeys) {
        await this.delete(storeName, key.toString())
      }

      console.log(`[v0] Deleted ${matchingKeys.length} keys with prefix: ${prefix}`)
    } catch (error) {
      console.error("[v0] Error deleting by prefix:", error)
    }
  }

  /**
   * Migrate data from localStorage to IndexedDB
   */
  async migrateFromLocalStorage(): Promise<void> {
    if (typeof window === "undefined" || !window.localStorage) {
      return
    }

    console.log("[v0] Starting migration from localStorage to IndexedDB...")

    try {
      const localStorageKeys = Object.keys(localStorage)

      for (const key of localStorageKeys) {
        const value = localStorage.getItem(key)
        if (value === null) continue

        try {
          // Try to parse as JSON
          const parsedValue = JSON.parse(value)
          await this.set(STORES.CACHE, key, parsedValue)
        } catch {
          // If not JSON, store as string
          await this.set(STORES.CACHE, key, value)
        }
      }

      console.log(`[v0] Migrated ${localStorageKeys.length} items from localStorage to IndexedDB`)
    } catch (error) {
      console.error("[v0] Error during migration:", error)
    }
  }
}

// Singleton instance
export const db = new IndexedDBManager()

/**
 * Helper functions that mimic localStorage API for easy migration
 */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    const value = await db.get(STORES.CACHE, key)
    if (value === null) return null
    return typeof value === "string" ? value : JSON.stringify(value)
  },

  async setItem(key: string, value: string, expiryMs?: number): Promise<void> {
    try {
      const parsedValue = JSON.parse(value)
      await db.set(STORES.CACHE, key, parsedValue, expiryMs)
    } catch {
      await db.set(STORES.CACHE, key, value, expiryMs)
    }
  },

  async removeItem(key: string): Promise<void> {
    await db.delete(STORES.CACHE, key)
  },

  async clear(): Promise<void> {
    await db.clear(STORES.CACHE)
  },
}

// Initialize on load and perform migration if needed
if (typeof window !== "undefined") {
  db.init().then(() => {
    // Optional: Perform one-time migration
    // db.migrateFromLocalStorage()
  })
}
