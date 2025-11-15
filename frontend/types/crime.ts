export interface Member {
  id: number
  name: string
  level: number
  status: {
    description: string
    state: string
    color: string
  }
  position: string
  last_action: {
    status: string
    relative: string
    timestamp: number
  }
  days_in_faction: number
  is_in_oc: boolean
}

export interface CrimeSlot {
  position: string
  position_id: string
  user: {
    id: number
    name?: string
    outcome?: string
    item_outcome?: { owned_by: string; item_id: number; item_uid: number; outcome: string }
  } | null
  checkpoint_pass_rate?: number
  item_requirement?: {
    id: number
    is_reusable: boolean
    is_available: boolean
  }
}

export interface CrimeRewards {
  money: number
  items: Array<{ id: number; quantity: number }>
  respect: number
  scope?: number
  payout?: {
    type: string
    percentage: number
    paid_by: number
    paid_at: number
  }
}

export interface Crime {
  id: number
  name: string
  difficulty: number
  participants: number
  status: string
  planned_by: { id: number; name: string }
  initiated_by: { id: number; name: string } | null
  slots: CrimeSlot[]
  pass_rate?: number
  progress?: number
  item_requirement?: {
    id: number
    is_reusable: boolean
    is_available: boolean
  }
  created_at?: number
  planning_at?: number
  executed_at?: number
  ready_at?: number
  expired_at?: number
  rewards?: CrimeRewards
}

export interface CrimesResponse {
  crimes: Record<string, Crime>
}
