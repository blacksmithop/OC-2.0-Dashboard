"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  thirdPartySettingsManager,
  defaultThirdPartySettings,
  type ThirdPartySettings,
} from "@/lib/settings/third-party-manager"
import { apiKeyManager } from "@/lib/auth/api-key-manager"
import { Button } from "@/components/ui/button"

type ValidationStatus = "idle" | "validating" | "valid" | "invalid"

interface ValidationResult {
  status: ValidationStatus
  message?: string
}

export default function IntegrationsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [settings, setSettings] = useState<ThirdPartySettings>(defaultThirdPartySettings)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Validation states
  const [tornStatsValidation, setTornStatsValidation] = useState<ValidationResult>({ status: "idle" })
  const [ffScouterValidation, setFFScouterValidation] = useState<ValidationResult>({ status: "idle" })
  const [yataValidation, setYataValidation] = useState<ValidationResult>({ status: "idle" })
  const [tornProbValidation, setTornProbValidation] = useState<ValidationResult>({ status: "idle" })

  // Visibility toggles
  const [showTornStatsKey, setShowTornStatsKey] = useState(false)
  const [showFFScouterKey, setShowFFScouterKey] = useState(false)
  const [showYataKey, setShowYataKey] = useState(false)

  useEffect(() => {
    const load = async () => {
      const apiKey = await apiKeyManager.getApiKey()
      if (!apiKey) {
        router.push("/")
        return
      }
      const saved = await thirdPartySettingsManager.getSettings()
      setSettings(saved)
    }
    load()
  }, [router])

  const updateSettings = (updater: (prev: ThirdPartySettings) => ThirdPartySettings) => {
    setSettings((prev) => {
      const next = updater(prev)
      setHasChanges(true)
      return next
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await thirdPartySettingsManager.saveSettings(settings)
      setHasChanges(false)
      toast({ title: "Settings Saved", description: "Integration settings have been updated." })
    } catch {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  // ---- Validation Functions ----

  const validateTornStats = useCallback(async () => {
    const key = settings.tornStats.apiKey.trim()
    if (!key) {
      setTornStatsValidation({ status: "invalid", message: "No API key provided" })
      return
    }
    setTornStatsValidation({ status: "validating" })
    try {
      const res = await fetch(`https://www.tornstats.com/api/v2/${key}`)
      const data = await res.json()
      if (data.status === true) {
        setTornStatsValidation({ status: "valid", message: data.message || "Key is valid" })
      } else {
        setTornStatsValidation({
          status: "invalid",
          message: data.message || "Invalid key",
        })
      }
    } catch {
      setTornStatsValidation({ status: "invalid", message: "Failed to reach TornStats API" })
    }
  }, [settings.tornStats.apiKey])

  const validateFFScouter = useCallback(async () => {
    const key = settings.ffScouter.apiKey.trim()
    if (!key) {
      setFFScouterValidation({ status: "invalid", message: "No API key provided" })
      return
    }
    setFFScouterValidation({ status: "validating" })
    try {
      const res = await fetch(`https://ffscouter.com/api/v1/check-key?key=${key}`)
      const data = await res.json()
      if (data.is_registered === true) {
        const registered = data.registered_at
          ? new Date(data.registered_at * 1000).toLocaleDateString()
          : "Unknown"
        setFFScouterValidation({
          status: "valid",
          message: `Registered since ${registered}`,
        })
      } else {
        setFFScouterValidation({
          status: "invalid",
          message: data.error || "Key is not registered",
        })
      }
    } catch {
      setFFScouterValidation({ status: "invalid", message: "Failed to reach FF Scouter API" })
    }
  }, [settings.ffScouter.apiKey])

  const validateYata = useCallback(async () => {
    const key = settings.yata.apiKey.trim()
    if (!key) {
      setYataValidation({ status: "invalid", message: "No API key provided" })
      return
    }
    setYataValidation({ status: "validating" })
    try {
      const res = await fetch(`https://yata.yt/api/v1/spy/1712955/?key=${key}`)
      const data = await res.json()
      if (data.error) {
        setYataValidation({ status: "invalid", message: data.error.error || "Invalid API key" })
      } else {
        setYataValidation({ status: "valid", message: "API key accepted by Yata" })
      }
    } catch {
      setYataValidation({ status: "invalid", message: "Failed to reach Yata API" })
    }
  }, [settings.yata.apiKey])

  const validateTornProbability = useCallback(async () => {
    setTornProbValidation({ status: "validating" })
    try {
      const res = await fetch("https://tornproxy.abhinavkm.com/", { method: "GET" })
      if (res.ok) {
        setTornProbValidation({ status: "valid", message: "Proxy is reachable (HTTP 200)" })
      } else {
        setTornProbValidation({
          status: "invalid",
          message: `Proxy returned HTTP ${res.status}`,
        })
      }
    } catch {
      setTornProbValidation({ status: "invalid", message: "Failed to reach proxy" })
    }
  }, [])

  const StatusBadge = ({ validation }: { validation: ValidationResult }) => {
    switch (validation.status) {
      case "validating":
        return (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Checking...
          </span>
        )
      case "valid":
        return (
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle2 size={14} /> {validation.message}
          </span>
        )
      case "invalid":
        return (
          <span className="flex items-center gap-1.5 text-xs text-red-400">
            <XCircle size={14} /> {validation.message}
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="flex-shrink-0 border-b border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard/settings")}
            className="p-2 hover:bg-accent rounded-lg transition-colors border border-border"
            title="Back to Settings"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Integrations</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage API connections and validate keys
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="gap-2"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save All
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* ---- TornStats ---- */}
          <section className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-start justify-between gap-4 p-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <h2 className="text-lg font-semibold text-foreground">TornStats</h2>
                  <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">Optional</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Fetch CPR data from TornStats if available for your faction members.
                </p>
                <a
                  href="https://www.tornstats.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 mt-1.5 transition-colors"
                >
                  https://www.tornstats.com <ExternalLink size={10} />
                </a>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={settings.tornStats.enabled}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      tornStats: { ...prev.tornStats, enabled: e.target.checked },
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-muted rounded-full peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-foreground after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
              </label>
            </div>

            {settings.tornStats.enabled && (
              <div className="border-t border-border p-5 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">API Key</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showTornStatsKey ? "text" : "password"}
                        value={settings.tornStats.apiKey}
                        onChange={(e) =>
                          updateSettings((prev) => ({
                            ...prev,
                            tornStats: { ...prev.tornStats, apiKey: e.target.value },
                          }))
                        }
                        placeholder="Enter TornStats API key"
                        className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTornStatsKey(!showTornStatsKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showTornStatsKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={validateTornStats}
                      disabled={tornStatsValidation.status === "validating" || !settings.tornStats.apiKey.trim()}
                      className="gap-1.5 bg-transparent"
                    >
                      <ShieldCheck size={14} />
                      Validate
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Get your API key from your TornStats settings page.
                  </p>
                </div>
                <StatusBadge validation={tornStatsValidation} />
              </div>
            )}
          </section>

          {/* ---- FF Scouter ---- */}
          <section className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-start justify-between gap-4 p-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <h2 className="text-lg font-semibold text-foreground">FF Scouter</h2>
                  <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">Optional</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Fetch battle stat estimates for faction members.
                </p>
                <a
                  href="https://ffscouter.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 mt-1.5 transition-colors"
                >
                  https://ffscouter.com/ <ExternalLink size={10} />
                </a>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={settings.ffScouter.enabled}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      ffScouter: { ...prev.ffScouter, enabled: e.target.checked },
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-muted rounded-full peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-foreground after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
              </label>
            </div>

            {settings.ffScouter.enabled && (
              <div className="border-t border-border p-5 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">API Key</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showFFScouterKey ? "text" : "password"}
                        value={settings.ffScouter.apiKey}
                        onChange={(e) =>
                          updateSettings((prev) => ({
                            ...prev,
                            ffScouter: { ...prev.ffScouter, apiKey: e.target.value },
                          }))
                        }
                        placeholder="Enter FF Scouter API key"
                        className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFFScouterKey(!showFFScouterKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showFFScouterKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={validateFFScouter}
                      disabled={ffScouterValidation.status === "validating" || !settings.ffScouter.apiKey.trim()}
                      className="gap-1.5 bg-transparent"
                    >
                      <ShieldCheck size={14} />
                      Validate
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    16-character alphanumeric key from FF Scouter.
                  </p>
                </div>
                <StatusBadge validation={ffScouterValidation} />
              </div>
            )}
          </section>

          {/* ---- Yata ---- */}
          <section className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-start justify-between gap-4 p-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <h2 className="text-lg font-semibold text-foreground">Yata</h2>
                  <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">Optional</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Fetch spy data and faction member information from Yata.
                </p>
                <a
                  href="https://yata.yt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 mt-1.5 transition-colors"
                >
                  https://yata.yt <ExternalLink size={10} />
                </a>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={settings.yata.enabled}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      yata: { ...prev.yata, enabled: e.target.checked },
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-muted rounded-full peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-foreground after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
              </label>
            </div>

            {settings.yata.enabled && (
              <div className="border-t border-border p-5 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">API Key</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showYataKey ? "text" : "password"}
                        value={settings.yata.apiKey}
                        onChange={(e) =>
                          updateSettings((prev) => ({
                            ...prev,
                            yata: { ...prev.yata, apiKey: e.target.value },
                          }))
                        }
                        placeholder="Enter Yata API key"
                        className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowYataKey(!showYataKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showYataKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={validateYata}
                      disabled={yataValidation.status === "validating" || !settings.yata.apiKey.trim()}
                      className="gap-1.5 bg-transparent"
                    >
                      <ShieldCheck size={14} />
                      Validate
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Your Yata API key. This can be your Torn API key or a Yata-specific key.
                  </p>
                </div>
                <StatusBadge validation={yataValidation} />
              </div>
            )}
          </section>

          {/* ---- Torn Probability API ---- */}
          <section className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-start justify-between gap-4 p-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <h2 className="text-lg font-semibold text-foreground">Torn Probability API</h2>
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Required</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Fetches OC role weights and overall success probabilities. This integration is always active.
                </p>
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Proxy:</span>
                    <a
                      href="https://tornproxy.abhinavkm.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      https://tornproxy.abhinavkm.com/ <ExternalLink size={10} />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Source:</span>
                    <a
                      href="https://tornprobability.com:3000/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      https://tornprobability.com:3000/ <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              </div>
              <div className="mt-1 px-3 py-1 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                Always On
              </div>
            </div>

            <div className="border-t border-border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  No API key required. The proxy forwards requests to the Torn Probability API.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={validateTornProbability}
                  disabled={tornProbValidation.status === "validating"}
                  className="gap-1.5 shrink-0 bg-transparent"
                >
                  <ShieldCheck size={14} />
                  Test Connection
                </Button>
              </div>
              <StatusBadge validation={tornProbValidation} />
            </div>
          </section>

          {/* ---- CrimesHub ---- */}
          <section className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-start justify-between gap-4 p-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <h2 className="text-lg font-semibold text-foreground">CrimesHub</h2>
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Required</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Simulate CPR impact on OC outcome. This integration is always active.
                </p>
                <a
                  href="https://crimeshub-2b4b0.firebaseapp.com/home"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 mt-1.5 transition-colors"
                >
                  https://crimeshub-2b4b0.firebaseapp.com/home <ExternalLink size={10} />
                </a>
              </div>
              <div className="mt-1 px-3 py-1 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                Always On
              </div>
            </div>
          </section>

          {/* Sticky save bar */}
          {hasChanges && (
            <div className="sticky bottom-0 bg-card/95 backdrop-blur border border-border rounded-lg p-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">You have unsaved changes</p>
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save All
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
