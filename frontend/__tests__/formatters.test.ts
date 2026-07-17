import { describe, it, expect } from "vitest"
import {
  formatDate,
  formatTime,
  formatDateTime,
  getTimeRemaining,
  formatNumber,
  formatCurrency,
} from "@/lib/crimes/formatters"

describe("formatters", () => {
  describe("formatDate / formatTime / formatDateTime", () => {
    it("returns null for falsy timestamps", () => {
      expect(formatDate(undefined)).toBeNull()
      expect(formatDate(0)).toBeNull()
      expect(formatTime(undefined)).toBeNull()
      expect(formatDateTime(0)).toBeNull()
    })

    it("zero-pads to the documented shapes", () => {
      // Values are Torn-style unix seconds; the exact clock time is
      // timezone-dependent, so assert the shape rather than the digits.
      expect(formatDate(1_700_000_000)).toMatch(/^\d{2}-\d{2}-\d{2}$/)
      expect(formatTime(1_700_000_000)).toMatch(/^\d{2}:\d{2}:\d{2}$/)
      expect(formatDateTime(1_700_000_000)).toMatch(/^\d{2}-\d{2}-\d{2} \d{2}:\d{2}$/)
    })
  })

  describe("getTimeRemaining", () => {
    it("returns null when there is no expiry", () => {
      expect(getTimeRemaining(0, 100)).toBeNull()
    })

    it("reports Expired once the deadline has passed", () => {
      expect(getTimeRemaining(100, 100)).toBe("Expired")
      expect(getTimeRemaining(100, 200)).toBe("Expired")
    })

    it("breaks the remaining seconds into d/h/m/s", () => {
      // 1 day, 1 hour, 1 minute, 1 second remaining.
      const remaining = 86400 + 3600 + 60 + 1
      expect(getTimeRemaining(remaining, 0)).toBe("1d 1h 1m 1s remaining")
    })

    it("omits zero-valued leading units but always keeps seconds", () => {
      expect(getTimeRemaining(65, 0)).toBe("1m 5s remaining")
      expect(getTimeRemaining(5, 0)).toBe("5s remaining")
    })
  })

  describe("formatNumber / formatCurrency", () => {
    it("groups thousands and prefixes currency with $", () => {
      expect(formatNumber(1234567)).toBe("1,234,567")
      expect(formatCurrency(1000)).toBe("$1,000")
    })
  })
})
