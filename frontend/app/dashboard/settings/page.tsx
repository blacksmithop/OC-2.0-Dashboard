"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  thirdPartySettingsManager,
  defaultThirdPartySettings,
  type ThirdPartySettings,
} from "@/lib/settings/third-party-manager"
import { apiKeyManager } from "@/lib/auth/api-key-manager"

export default function SettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [settings, setSettings] = useState<ThirdPartySettings>(defaultThirdPartySettings)

  useEffect(() => {
    const loadSettings = async () => {
      const apiKey = await apiKeyManager.getApiKey()
      if (!apiKey) {
        router.push("/")
        return
      }

      const savedSettings = await thirdPartySettingsManager.getSettings()
      setSettings(savedSettings)
    }

    loadSettings()
  }, [router])

  const handleSave = async () => {
    try {
      await thirdPartySettingsManager.saveSettings(settings)

      toast({
        title: "Success",
        description: "Settings saved successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="flex-shrink-0 border-b border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 hover:bg-accent rounded-lg transition-colors border border-border"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Configure third-party integrations</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Third Party Apps</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Configure external API integrations to enhance functionality
            </p>

            <div className="space-y-6">
              <div className="border border-border rounded-lg p-4 bg-card/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">Torn Probability API</h3>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">Required</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">Fetches OC role weights and overall success %</p>
                    <a
                      href="https://tornprobability.com:3000"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      https://tornprobability.com:3000
                    </a>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.tornProbability}
                    disabled
                    className="mt-1 h-5 w-5 rounded border-border bg-muted cursor-not-allowed opacity-50"
                  />
                </div>
              </div>

              <div className="border border-border rounded-lg p-4 bg-card/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">CrimesHub</h3>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">Required</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">Simulate CPR impact on OC outcome</p>
                    <a
                      href="https://crimeshub-2b4b0.firebaseapp.com/home"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      https://crimeshub-2b4b0.firebaseapp.com/home
                    </a>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.crimesHub}
                    disabled
                    className="mt-1 h-5 w-5 rounded border-border bg-muted cursor-not-allowed opacity-50"
                  />
                </div>
              </div>

              <div className="border border-border rounded-lg p-4 bg-card/50">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">FF Scouter</h3>
                      <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">Optional</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">Fetch battle stat estimates</p>
                    <a
                      href="https://ffscouter.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      https://ffscouter.com/
                    </a>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.ffScouter.enabled}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        ffScouter: { ...prev.ffScouter, enabled: e.target.checked },
                      }))
                    }
                    className="mt-1 h-5 w-5 rounded border-border bg-background cursor-pointer"
                  />
                </div>
                {settings.ffScouter.enabled && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <label className="block text-sm font-medium text-foreground mb-2">API Key</label>
                    <input
                      type="password"
                      value={settings.ffScouter.apiKey}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          ffScouter: { ...prev.ffScouter, apiKey: e.target.value },
                        }))
                      }
                      placeholder="Enter FF Scouter API key"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              <div className="border border-border rounded-lg p-4 bg-card/50">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">TornStats</h3>
                      <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">Optional</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Fetch CPR data if present on TornStats
                    </p>
                    <a
                      href="https://www.tornstats.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      https://www.tornstats.com
                    </a>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.tornStats.enabled}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        tornStats: { ...prev.tornStats, enabled: e.target.checked },
                      }))
                    }
                    className="mt-1 h-5 w-5 rounded border-border bg-background cursor-pointer"
                  />
                </div>
                {settings.tornStats.enabled && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <label className="block text-sm font-medium text-foreground mb-2">TornStats API Key</label>
                    <input
                      type="password"
                      value={settings.tornStats.apiKey}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          tornStats: { ...prev.tornStats, apiKey: e.target.value },
                        }))
                      }
                      placeholder="Enter TornStats API key"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Get your API key from TornStats settings page
                    </p>
                  </div>
                )}
              </div>

              <div className="border border-border rounded-lg p-4 bg-card/50">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">Yata</h3>
                      <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">Optional</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Fetch faction member information (uses main Torn API key)
                    </p>
                    <a
                      href="https://yata.yt"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      https://yata.yt
                    </a>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.yata.enabled}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        yata: { ...prev.yata, enabled: e.target.checked },
                      }))
                    }
                    className="mt-1 h-5 w-5 rounded border-border bg-background cursor-pointer"
                  />
                </div>
              </div>

              
            </div>

            <div className="mt-6 pt-6 border-t border-border">
              <button
                onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold"
              >
                <Save size={18} />
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
