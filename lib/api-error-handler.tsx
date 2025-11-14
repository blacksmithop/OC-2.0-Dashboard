import { toast } from "@/hooks/use-toast"
import { buildApiKeyUrl, getSelectedScopes } from "@/lib/api-scopes"
import { handleFullLogout } from "@/lib/logout-handler"

export interface ApiErrorResponse {
  error: {
    code: number
    error: string
  }
}

export interface ApiScopeRequirement {
  scope: string
  required: boolean
  description: string
}

const SCOPE_REQUIREMENTS: Record<string, ApiScopeRequirement> = {
  basic: {
    scope: "basic",
    required: true,
    description: "Basic faction information (required for authentication)",
  },
  members: {
    scope: "members",
    required: true,
    description: "Faction member data (required for member stats and analysis)",
  },
  crimes: {
    scope: "crimes",
    required: true,
    description: "Organized crimes data (required for crime tracking)",
  },
  crime: {
    scope: "crime",
    required: false,
    description: "Individual crime refresh (optional, enables per-crime updates)",
  },
  items: {
    scope: "items",
    required: true,
    description: "Item database (required for displaying crime rewards)",
  },
  armorynews: {
    scope: "armorynews",
    required: false,
    description: "Armory news logs (optional, for armory page)",
  },
}

function getEndpointScope(endpoint: string): string {
  if (endpoint.includes("/faction/basic")) return "basic"
  if (endpoint.includes("/faction/members")) return "members"
  if (endpoint.includes("/faction/crimes")) return "crimes"
  if (endpoint.includes("/faction/") && endpoint.includes("/crime")) return "crime"
  if (endpoint.includes("/torn/items")) return "items"
  if (endpoint.includes("/faction/armorynews")) return "armorynews"
  return "unknown"
}

function getRequiredScopes(): ApiScopeRequirement[] {
  return Object.values(SCOPE_REQUIREMENTS).filter((req) => req.required)
}

function getOptionalScopes(): ApiScopeRequirement[] {
  return Object.values(SCOPE_REQUIREMENTS).filter((req) => !req.required)
}

export async function handleApiError(
  response: Response,
  endpoint: string,
  options?: { showToast?: boolean },
): Promise<never> {
  const showToast = options?.showToast !== false

  try {
    const errorData: ApiErrorResponse = await response.json()
    const scope = getEndpointScope(endpoint)
    const scopeInfo = SCOPE_REQUIREMENTS[scope]

    if (errorData.error?.code === 2 && errorData.error.error === "Incorrect key") {
      console.error("[v0] API key has been revoked - logging out")
      
      handleFullLogout()
      
      if (showToast) {
        toast({
          title: "API Key Revoked",
          description: "Your API key has been deleted. Please log in again with a valid key.",
          variant: "destructive",
          duration: 8000,
        })
      }

      // Redirect to login page
      if (typeof window !== "undefined") {
        window.location.href = "/"
      }

      throw new Error("API key has been revoked")
    }

    // Error code 16: Access level not high enough
    if (errorData.error?.code === 16) {
      const errorMessage = `API key access level too low for "${scope}" scope`
      const requiredScopes = getRequiredScopes()
      const optionalScopes = getOptionalScopes()

      const selectedScopes = getSelectedScopes()
      const apiKeyUrl = buildApiKeyUrl(selectedScopes)

      console.error(`[v0] API Access Error (Code 16):`, {
        endpoint,
        scope,
        isRequired: scopeInfo?.required,
        errorMessage: errorData.error.error,
      })

      if (showToast) {
        toast({
          title: "API Access Insufficient",
          description: (
            <div className="space-y-2">
              <p className="font-semibold">Missing scope: {scope}</p>
              <p className="text-xs">{scopeInfo?.description || "Required for this operation"}</p>
              <div className="mt-3 p-2 bg-card/50 rounded text-xs">
                <p className="font-semibold mb-1">Required Scopes:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {requiredScopes.map((req) => (
                    <li key={req.scope}>
                      <strong>{req.scope}</strong> - {req.description}
                    </li>
                  ))}
                </ul>
                <p className="font-semibold mt-2 mb-1">Optional Scopes:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {optionalScopes.map((req) => (
                    <li key={req.scope}>
                      <strong>{req.scope}</strong> - {req.description}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-muted-foreground">
                  Please{" "}
                  <a
                    href={apiKeyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    create a new API key
                  </a>{" "}
                  with the required scopes
                </p>
              </div>
            </div>
          ),
          variant: "destructive",
          duration: 10000,
        })
      }

      throw new Error(`API key does not have sufficient access level for "${scope}" scope`)
    }

    if (errorData.error?.code === 2) {
      const errorMessage = `API key does not have access to "${scope}" scope`
      const selectedScopes = getSelectedScopes()
      const apiKeyUrl = buildApiKeyUrl(selectedScopes)

      console.error(`[v0] API Access Error (Code 2):`, {
        endpoint,
        scope,
        errorMessage: errorData.error.error,
      })

      if (showToast) {
        toast({
          title: "API Access Denied",
          description: (
            <div className="space-y-2">
              <p>Missing required scope: {scope}</p>
              <p className="text-xs">{scopeInfo?.description || "Required for this operation"}</p>
              <p className="text-xs mt-2">
                Please{" "}
                <a href={apiKeyUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  regenerate your API key
                </a>{" "}
                with the required scopes
              </p>
            </div>
          ),
          variant: "destructive",
          duration: 8000,
        })
      }

      throw new Error(errorMessage)
    }

    // Other API errors
    const errorMessage = errorData.error?.error || "API request failed"
    console.error(`[v0] API Error (Code ${errorData.error?.code}):`, errorMessage)

    if (showToast) {
      toast({
        title: "API Error",
        description: errorMessage,
        variant: "destructive",
      })
    }

    throw new Error(errorMessage)
  } catch (e) {
    if (e instanceof Error) throw e
    throw new Error("Failed to process API response")
  }
}

export function validateApiResponse(data: any, endpoint: string, options?: { showToast?: boolean }): void {
  if (data.error) {
    const scope = getEndpointScope(endpoint)
    const scopeInfo = SCOPE_REQUIREMENTS[scope]

    if (data.error.code === 16 || data.error.code === 2) {
      handleApiError(new Response(JSON.stringify(data), { status: 403 }), endpoint, options).catch(() => {
        // Error already thrown
      })
    }

    throw new Error(data.error.error || "API request failed")
  }
}
