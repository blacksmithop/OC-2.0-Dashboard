import { db, STORES } from "@/lib/db/indexeddb"

export interface ThirdPartySettings {
  tornProbability: boolean
  crimesHub: boolean
  ffScouter: {
    enabled: boolean
    apiKey: string
  }
  tornStats: {
    enabled: boolean
    apiKey: string
  }
  yata: {
    enabled: boolean
  }
}

export const defaultThirdPartySettings: ThirdPartySettings = {
  tornProbability: true,
  crimesHub: true,
  ffScouter: {
    enabled: false,
    apiKey: "",
  },
  tornStats: {
    enabled: false,
    apiKey: "",
  },
  yata: {
    enabled: false,
  },
}

class ThirdPartySettingsManager {
  private readonly SETTINGS_KEY = "thirdPartySettings"
  private readonly FFSCOUTER_KEY = "FFSCOUTER_API_KEY"
  private readonly TORN_STATS_KEY = "TORN_STATS_API_KEY"

  async getSettings(): Promise<ThirdPartySettings> {
    try {
      const settings = await db.get<ThirdPartySettings>(STORES.CACHE, this.SETTINGS_KEY)

      if (settings) {
        return {
          ...defaultThirdPartySettings,
          ...settings,
          ffScouter: { ...defaultThirdPartySettings.ffScouter, ...(settings.ffScouter || {}) },
          tornStats: { ...defaultThirdPartySettings.tornStats, ...(settings.tornStats || {}) },
          yata: { ...defaultThirdPartySettings.yata, ...(settings.yata || {}) },
        }
      }

      // Fallback to localStorage for backwards compatibility
      const localSettings = localStorage.getItem(this.SETTINGS_KEY)
      if (localSettings) {
        const parsed = JSON.parse(localSettings)
        await this.saveSettings(parsed) // Migrate to IndexedDB
        return parsed
      }

      return defaultThirdPartySettings
    } catch (error) {
      console.error("[v0] Error getting third-party settings:", error)
      return defaultThirdPartySettings
    }
  }

  async saveSettings(settings: ThirdPartySettings): Promise<void> {
    try {
      await db.set(STORES.CACHE, this.SETTINGS_KEY, settings)

      // Store individual API keys for easy access
      if (settings.ffScouter.enabled && settings.ffScouter.apiKey) {
        await db.set(STORES.CACHE, this.FFSCOUTER_KEY, settings.ffScouter.apiKey)
      } else {
        await db.delete(STORES.CACHE, this.FFSCOUTER_KEY)
      }

      if (settings.tornStats.enabled && settings.tornStats.apiKey) {
        await db.set(STORES.CACHE, this.TORN_STATS_KEY, settings.tornStats.apiKey)
      } else {
        await db.delete(STORES.CACHE, this.TORN_STATS_KEY)
      }

      // Also save to localStorage for backwards compatibility
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings))
      if (settings.ffScouter.enabled && settings.ffScouter.apiKey) {
        localStorage.setItem(this.FFSCOUTER_KEY, settings.ffScouter.apiKey)
      } else {
        localStorage.removeItem(this.FFSCOUTER_KEY)
      }
      if (settings.tornStats.enabled && settings.tornStats.apiKey) {
        localStorage.setItem(this.TORN_STATS_KEY, settings.tornStats.apiKey)
      } else {
        localStorage.removeItem(this.TORN_STATS_KEY)
      }
    } catch (error) {
      console.error("[v0] Error saving third-party settings:", error)
      throw error
    }
  }

  async getFFScouterApiKey(): Promise<string | null> {
    try {
      const key = await db.get<string>(STORES.CACHE, this.FFSCOUTER_KEY)
      if (key) return key

      // Fallback to localStorage
      return localStorage.getItem(this.FFSCOUTER_KEY)
    } catch (error) {
      console.error("[v0] Error getting FF Scouter API key:", error)
      return localStorage.getItem(this.FFSCOUTER_KEY)
    }
  }

  async getTornStatsApiKey(): Promise<string | null> {
    try {
      const key = await db.get<string>(STORES.CACHE, this.TORN_STATS_KEY)
      if (key) return key

      // Fallback to localStorage
      return localStorage.getItem(this.TORN_STATS_KEY)
    } catch (error) {
      console.error("[v0] Error getting TornStats API key:", error)
      return localStorage.getItem(this.TORN_STATS_KEY)
    }
  }

  async clearSettings(): Promise<void> {
    try {
      await db.delete(STORES.CACHE, this.SETTINGS_KEY)
      await db.delete(STORES.CACHE, this.FFSCOUTER_KEY)
      await db.delete(STORES.CACHE, this.TORN_STATS_KEY)

      // Also clear localStorage
      localStorage.removeItem(this.SETTINGS_KEY)
      localStorage.removeItem(this.FFSCOUTER_KEY)
      localStorage.removeItem(this.TORN_STATS_KEY)
    } catch (error) {
      console.error("[v0] Error clearing third-party settings:", error)
    }
  }
}

export const thirdPartySettingsManager = new ThirdPartySettingsManager()
