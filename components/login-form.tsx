"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

interface LoginFormProps {
  onLogin?: (apiKey: string) => void
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const router = useRouter()
  const [apiKey, setApiKey] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const basicResponse = await fetch("https://api.torn.com/v2/faction/basic", {
        headers: {
          Authorization: `ApiKey ${apiKey}`,
          accept: "application/json",
        },
      })

      const basicData = await basicResponse.json()

      if (basicData.error) {
        if (basicData.error.code === 2) {
          throw new Error("API key does not have access to basic faction information")
        }
        throw new Error(basicData.error.error || "Invalid API key")
      }

      const factionId = basicData.basic?.id

      const membersResponse = await fetch("https://api.torn.com/v2/faction/members?striptags=true", {
        headers: {
          Authorization: `ApiKey ${apiKey}`,
          accept: "application/json",
        },
      })

      const membersData = await membersResponse.json()

      if (membersData.error) {
        if (membersData.error.code === 2) {
          throw new Error("API key does not have access to members")
        }
        throw new Error(membersData.error.error || "Invalid API key or insufficient permissions")
      }

      localStorage.setItem("factionApiKey", apiKey)
      localStorage.setItem("factionId", factionId.toString())
      localStorage.setItem("factionName", basicData.basic?.name || "")

      toast({
        title: "Success",
        description: `Authentication successful! Welcome, ${basicData.basic?.name || "Faction Member"}!`,
      })
      onLogin?.(apiKey)

      setTimeout(() => {
        router.push("/dashboard")
      }, 500)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to authenticate"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Faction API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your Torn API key"
          className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
          required
        />
        <p className="text-center text-base text-muted-foreground mt-4">
          <a
            href="https://www.torn.com/preferences.php#tab=api?step=addNewKey&title=TornOCApp&faction=armorynews,basic,crime,crimes,members&torn=items"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Create a Custom API Key
          </a>
        </p>
      </div>

      <div className="bg-card/50 border border-border rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-semibold text-foreground text-center">Data Policy</h3>
        <ul className="text-xs text-muted-foreground space-y-1.5">
          <li>• Your API Key is stored in the browser</li>
          <li>• Logging out will remove your key</li>
          <li>• All API calls are done in the browser</li>
          <li>
            • For queries please ask in the{" "}
            <a
              href="https://www.torn.com/forums.php#/p=threads&f=67&t=16516017&b=0"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              forums
            </a>{" "}
            or DM me :)
          </li>
        </ul>
      </div>

      <Button
        type="submit"
        disabled={isLoading || !apiKey}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Authenticating..." : "Access Dashboard"}
      </Button>
    </form>
  )
}
