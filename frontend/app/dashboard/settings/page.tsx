"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ThirdPartySettings {
  tornProbability: boolean
  crimesHub: boolean
  ffScouter: {
    enabled: boolean
    apiKey: string
  }
  cprTracker: {
    enabled: boolean
    apiKey: string
  }
  yata: {
    enabled: boolean
  }
}

export default function SettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const defaultSettings: ThirdPartySettings = {
    tornProbability: true,
    crimesHub: true,
    ffScouter: {
      enabled: false,
      apiKey: "",
    },
    cprTracker: {
      enabled: false,
      apiKey: "",
    },
    yata: {
      enabled: false,
    },
  }

  const [settings, setSettings] = useState<ThirdPartySettings>(defaultSettings)

  useEffect(() => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (!apiKey) {
      router.push("/")
      return
    }

    const savedSettings = localStorage.getItem("thirdPartySettings")
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings({
          ...defaultSettings,
          ...parsed,
          ffScouter: { ...defaultSettings.ffScouter, ...(parsed.ffScouter || {}) },
          cprTracker: { ...defaultSettings.cprTracker, ...(parsed.cprTracker || {}) },
          yata: { ...defaultSettings.yata, ...(parsed.yata || {}) },
        })
      } catch (err) {
        console.error("Error loading settings:", err)
      }
    }

    const ffScouterKey = localStorage.getItem("FFSCOUTER_API_KEY")
    const cprTrackerKey = localStorage.getItem("CPR_TRACKER_API_KEY")

    if (ffScouterKey) {
      setSettings((prev) => ({
        ...prev,
        ffScouter: {
          enabled: prev.ffScouter.enabled,
          apiKey: ffScouterKey || prev.ffScouter.apiKey,
        },
      }))
    }

    if (cprTrackerKey) {
      setSettings((prev) => ({
        ...prev,
        cprTracker: {
          enabled: prev.cprTracker.enabled,
          apiKey: cprTrackerKey || prev.cprTracker.apiKey,
        },
      }))
    }
  }, [router])

  const handleSave = () => {
    // Save settings to localStorage
    localStorage.setItem("thirdPartySettings", JSON.stringify(settings))

    // Save individual API keys
    if (settings.ffScouter.enabled && settings.ffScouter.apiKey) {
      localStorage.setItem("FFSCOUTER_API_KEY", settings.ffScouter.apiKey)
    } else {
      localStorage.removeItem("FFSCOUTER_API_KEY")
    }

    if (settings.cprTracker.enabled && settings.cprTracker.apiKey) {
      localStorage.setItem("CPR_TRACKER_API_KEY", settings.cprTracker.apiKey)
    } else {
      localStorage.removeItem("CPR_TRACKER_API_KEY")
    }

    toast({
      title: "Success",
      description: "Settings saved successfully",
    })
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
            <p className="text-muted-foreground mt-1">Configure third-party integrations</p>
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
              {/* Torn Probability API */}
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

              {/* CrimesHub */}
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

              {/* FF Scouter */}
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

              {/* CPR Tracker */}
              <div className="border border-border rounded-lg p-4 bg-card/50">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">CPR Tracker</h3>
                      <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">Optional</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Fetch CPR data for members in your faction. Please use the related <a href="https://greasyfork.org/en/scripts/556379-torn-faction-cpr-tracker" target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">userscript</a>
                    </p>
                    <a
                      href="https://ufd.abhinavkm.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      https://ufd.abhinavkm.com
                    </a>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.cprTracker.enabled}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        cprTracker: { ...prev.cprTracker, enabled: e.target.checked },
                      }))
                    }
                    className="mt-1 h-5 w-5 rounded border-border bg-background cursor-pointer"
                  />
                </div>
                {settings.cprTracker.enabled && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <label className="block text-sm font-medium text-foreground mb-2">Public API Key</label>
                    <input
                      type="password"
                      value={settings.cprTracker.apiKey}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          cprTracker: { ...prev.cprTracker, apiKey: e.target.value },
                        }))
                      }
                      placeholder="Enter CPR Tracker public API key"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              {/* Yata */}
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
