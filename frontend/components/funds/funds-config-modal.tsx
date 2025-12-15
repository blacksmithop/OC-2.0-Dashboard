"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

interface FundsConfigModalProps {
  isOpen: boolean
  currentMaxFetch: number
  onSave: (maxFetch: number) => void
  onClose: () => void
}

export default function FundsConfigModal({ isOpen, currentMaxFetch, onSave, onClose }: FundsConfigModalProps) {
  const [maxFetch, setMaxFetch] = useState(currentMaxFetch)

  useEffect(() => {
    setMaxFetch(currentMaxFetch)
  }, [currentMaxFetch, isOpen])

  if (!isOpen) return null

  const handleSave = () => {
    if (maxFetch > 0) {
      onSave(maxFetch)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">Funds Settings</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Maximum Logs to Fetch</label>
            <input
              type="number"
              min="100"
              max="10000"
              step="100"
              value={maxFetch}
              onChange={(e) => setMaxFetch(Number.parseInt(e.target.value) || 1000)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">Recommended: 1000-2000 logs</p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
