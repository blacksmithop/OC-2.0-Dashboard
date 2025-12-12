"use client"

import { useState, useEffect } from "react"
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { API_SCOPES, buildApiKeyUrl, saveSelectedScopes } from "@/lib/api-scopes"

export default function ApiKeyBuilder() {
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [apiUrl, setApiUrl] = useState("")
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const initialScopes = API_SCOPES.filter((s) => s.required).map((s) => s.id)
    setSelectedScopes(initialScopes)
    setApiUrl(buildApiKeyUrl(initialScopes))
  }, [])

  const handleScopeToggle = (scopeId: string, checked: boolean) => {
    const scope = API_SCOPES.find((s) => s.id === scopeId)

    // Don't allow unchecking required scopes
    if (!checked && scope?.required) {
      return
    }

    const newScopes = checked ? [...selectedScopes, scopeId] : selectedScopes.filter((id) => id !== scopeId)

    setSelectedScopes(newScopes)
    setApiUrl(buildApiKeyUrl(newScopes))
    saveSelectedScopes(newScopes)
  }

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const handleOpenApiUrl = () => {
    window.open(apiUrl, "_blank", "noopener,noreferrer")
  }

  const requiredScopes = API_SCOPES.filter((s) => s.required)
  const optionalScopes = API_SCOPES.filter((s) => !s.required)

  return (
    <div className="space-y-3">
      {!isExpanded && (
        <Button
          onClick={handleToggleExpand}
          className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
          variant="outline"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Get API Key
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      )}

      {isExpanded && (
        <TooltipProvider>
          <div className="bg-card/50 border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-medium">API Scopes</h3>
              <Button onClick={handleToggleExpand} variant="ghost" size="sm" className="h-7 px-2 hover:bg-background">
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {requiredScopes.map((scope) => {
                const isChecked = selectedScopes.includes(scope.id)

                return (
                  <div key={scope.id} className="flex items-center space-x-3">
                    <Checkbox id={scope.id} checked={isChecked} disabled className="cursor-not-allowed" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <label htmlFor={scope.id} className="text-sm cursor-help font-medium flex items-center">
                          {scope.name}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-destructive ml-1.5 text-base font-bold leading-none">*</span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>Required</p>
                            </TooltipContent>
                          </Tooltip>
                        </label>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p>{scope.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )
              })}

              {optionalScopes.map((scope) => {
                const isChecked = selectedScopes.includes(scope.id)

                return (
                  <div key={scope.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={scope.id}
                      checked={isChecked}
                      onCheckedChange={(checked) => handleScopeToggle(scope.id, checked as boolean)}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <label htmlFor={scope.id} className="text-sm cursor-help font-medium">
                          {scope.name}
                        </label>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p>{scope.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )
              })}
            </div>
            {/* </CHANGE> */}

            <p className="text-xs text-muted-foreground pt-2 border-t border-border flex items-center gap-1">
              <span className="text-destructive text-base font-bold leading-none">*</span> Required scope
            </p>
            {/* </CHANGE> */}

            <Button
              onClick={handleOpenApiUrl}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
              size="lg"
            >
              <ExternalLink className="h-5 w-5 mr-2" />
              Get API Key
            </Button>
          </div>
        </TooltipProvider>
      )}
    </div>
  )
}
