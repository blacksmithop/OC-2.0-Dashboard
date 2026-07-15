import { describe, it, expect } from "vitest"
import { API_SCOPES, buildApiKeyUrl } from "@/lib/api-scopes"

describe("api-scopes", () => {
  describe("API_SCOPES", () => {
    it("defines the required faction scopes the app depends on", () => {
      const required = API_SCOPES.filter((s) => s.required).map((s) => s.id)
      expect(required).toEqual(
        expect.arrayContaining(["basic", "members", "crimes", "crime", "items", "crimenews"]),
      )
    })

    it("tags each scope with a valid category", () => {
      for (const scope of API_SCOPES) {
        expect(["faction", "torn"]).toContain(scope.category)
      }
    })
  })

  describe("buildApiKeyUrl", () => {
    it("splits selected scopes into faction and torn query params", () => {
      const url = buildApiKeyUrl(["basic", "members", "items"])
      const parsed = new URL(url)

      expect(parsed.origin + parsed.pathname).toBe("https://www.torn.com/preferences.php")
      // The scope payload lives in the hash fragment.
      expect(url).toContain("faction=basic,members")
      expect(url).toContain("torn=items")
    })

    it("produces empty groups when a category has no selected scopes", () => {
      const url = buildApiKeyUrl(["items"])
      expect(url).toContain("faction=&")
      expect(url).toContain("torn=items")
    })

    it("ignores unknown scope ids", () => {
      const url = buildApiKeyUrl(["basic", "not-a-real-scope"])
      expect(url).toContain("faction=basic")
      expect(url).not.toContain("not-a-real-scope")
    })
  })
})
