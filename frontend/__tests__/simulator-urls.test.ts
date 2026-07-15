import { describe, it, expect } from "vitest"
import {
  getSimulatorUrl,
  hasSimulator,
  type CrimeSlotForSimulator,
} from "@/lib/crimes/simulator-urls"

describe("simulator-urls", () => {
  describe("hasSimulator", () => {
    it("knows which crimes have a simulator", () => {
      expect(hasSimulator("Break the Bank")).toBe(true)
      expect(hasSimulator("Totally Made Up Crime")).toBe(false)
    })
  })

  describe("getSimulatorUrl", () => {
    it("returns null for crimes without a simulator", () => {
      expect(getSimulatorUrl("Totally Made Up Crime")).toBeNull()
    })

    it("returns the base simulator path when not planning", () => {
      expect(getSimulatorUrl("Break the Bank")).toBe(
        "https://crimeshub-2b4b0.firebaseapp.com/oc/breakthebank/v2",
      )
    })

    it("does not append CPR params unless the crime is planning", () => {
      const slots: CrimeSlotForSimulator[] = [
        { position: "Looter", user: { id: 1 }, checkpoint_pass_rate: 80 },
      ]
      expect(getSimulatorUrl("Mob Mentality", slots, false)).toBe(
        "https://crimeshub-2b4b0.firebaseapp.com/oc/mobmentality",
      )
    })

    it("appends numbered CPR params for repeated positions while planning", () => {
      const slots: CrimeSlotForSimulator[] = [
        { position: "Looter", user: { id: 1 }, checkpoint_pass_rate: 80.4 },
        { position: "Looter", user: { id: 2 }, checkpoint_pass_rate: 60.6 },
      ]
      const url = getSimulatorUrl("Mob Mentality", slots, true)!
      const parsed = new URL(url)
      // CPR is rounded to the nearest integer, positions are numbered.
      expect(parsed.searchParams.get("Looter 1")).toBe("80")
      expect(parsed.searchParams.get("Looter 2")).toBe("61")
    })

    it("skips empty slots when building CPR params", () => {
      const slots: CrimeSlotForSimulator[] = [
        { position: "Looter", user: { id: 1 }, checkpoint_pass_rate: 80 },
        { position: "Looter", user: null, checkpoint_pass_rate: 90 },
      ]
      const url = getSimulatorUrl("Mob Mentality", slots, true)!
      const parsed = new URL(url)
      // The filled slot is emitted; the empty slot contributes nothing.
      expect(parsed.searchParams.get("Looter 1")).toBe("80")
      expect(parsed.searchParams.get("Looter 2")).toBeNull()
    })
  })
})
