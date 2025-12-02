export interface MedicalItem {
  ID: number
  name: string
  type: string
  quantity: number
}

export interface MedicalAlertSettings {
  [itemId: number]: number
}

export const DEFAULT_MEDICAL_ALERTS: MedicalAlertSettings = {
  // Blood Bags (filled) - 200 default
  732: 200, // A+
  733: 200, // A-
  734: 200, // B+
  735: 200, // B-
  736: 200, // AB+
  737: 200, // AB-
  738: 200, // O+
  739: 200, // O-

  // Irradiated Blood Bag - 5 default
  1012: 5,

  // Empty Blood Bag - 100 default
  731: 100,

  // Neumune Tablet - 1 default
  361: 1,

  // Ipecac Syrup - 10 default
  1363: 10,

  // Morphine - 10 default
  203: 10,

  // First Aid Kits - 100 default
  68: 100, // Small First Aid Kit
  69: 100, // First Aid Kit
  70: 100, // Specialist First Aid Kit
  1040: 100, // Specialist Bandage
}

import { getItemFromFallback } from "./items-fallback"

export const ALL_BLOOD_BAGS = [
  { id: 732, name: "Blood Bag : A+" },
  { id: 733, name: "Blood Bag : A-" },
  { id: 734, name: "Blood Bag : B+" },
  { id: 735, name: "Blood Bag : B-" },
  { id: 736, name: "Blood Bag : AB+" },
  { id: 737, name: "Blood Bag : AB-" },
  { id: 738, name: "Blood Bag : O+" },
  { id: 739, name: "Blood Bag : O-" },
  { id: 1012, name: "Blood Bag : Irradiated" },
].map((item) => {
  const fallback = getItemFromFallback(item.id)
  return { id: item.id, name: fallback?.name || item.name }
})

export const ALL_EMPTY_BLOOD_BAGS = [{ id: 731, name: "Empty Blood Bag" }].map((item) => {
  const fallback = getItemFromFallback(item.id)
  return { id: item.id, name: fallback?.name || item.name }
})

export const ALL_FIRST_AID_KITS = [
  { id: 68, name: "Small First Aid Kit" },
  { id: 69, name: "First Aid Kit" },
  { id: 70, name: "Specialist First Aid Kit" },
  { id: 1040, name: "Specialist Bandage" },
].map((item) => {
  const fallback = getItemFromFallback(item.id)
  return { id: item.id, name: fallback?.name || item.name }
})
