"use client"

import type React from "react"

import Link from "next/link"
import { Users, Shield, Package, DollarSign, FileText, Heart, Target } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface DashboardStatsProps {
  memberCount: number
  crimeCount: number
  historicalFetchComplete: boolean
  hasArmoryScope: boolean
  hasFundsScope: boolean
  hasMedicalScope: boolean
}

export function DashboardStats({
  memberCount,
  crimeCount,
  historicalFetchComplete,
  hasArmoryScope,
  hasFundsScope,
  hasMedicalScope,
}: DashboardStatsProps) {
  const { toast } = useToast()

  const handleDisabledClick = (e: React.MouseEvent, message: string) => {
    if (!historicalFetchComplete) {
      e.preventDefault()
      toast({
        title: "Please wait",
        description: "Historical data is still loading...",
        variant: "destructive",
      })
    } else {
      e.preventDefault()
      toast({
        title: "Feature Unavailable",
        description: message,
        variant: "destructive",
      })
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Link
        href="/dashboard/members"
        className={`bg-card border border-border rounded-lg p-4 hover:border-primary transition-all text-left group block ${
          !historicalFetchComplete ? "pointer-events-none opacity-50" : "cursor-pointer"
        }`}
        onClick={(e) => {
          if (!historicalFetchComplete) {
            handleDisabledClick(e, "Historical data is still loading...")
          }
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-primary/20 p-2 rounded-lg border border-primary/40">
            <Users size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">Members</h2>
            <p className="text-xs text-muted-foreground">View faction members</p>
          </div>
        </div>
        <div className="text-3xl font-bold text-primary mb-1">{memberCount}</div>
        <p className="text-xs text-muted-foreground">Total members with participation stats</p>
      </Link>

      <Link
        href="/dashboard/crimes"
        className={`bg-card border border-border rounded-lg p-4 hover:border-accent transition-all text-left group block ${
          !historicalFetchComplete ? "pointer-events-none opacity-50" : "cursor-pointer"
        }`}
        onClick={(e) => {
          if (!historicalFetchComplete) {
            handleDisabledClick(e, "Historical data is still loading...")
          }
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-accent/20 p-2 rounded-lg border border-accent/40">
            <Shield size={20} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-foreground group-hover:text-accent transition-colors">
              Organized Crimes
            </h2>
            <p className="text-xs text-muted-foreground">Manage operations</p>
          </div>
        </div>
        <div className="text-3xl font-bold text-accent mb-1">{crimeCount}</div>
        <p className="text-xs text-muted-foreground">Active and completed crimes</p>
      </Link>

      <Link
        href="/dashboard/cpr"
        className={`bg-card border rounded-lg p-4 transition-all text-left group block ${
          !historicalFetchComplete
            ? "pointer-events-none opacity-40 border-border/50"
            : "border-border hover:border-purple-500 cursor-pointer"
        }`}
        onClick={(e) => {
          if (!historicalFetchComplete) {
            handleDisabledClick(e, "Historical data is still loading...")
          }
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg border bg-purple-500/20 border-purple-500/40">
            <Target size={20} className="text-purple-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold transition-colors text-foreground group-hover:text-purple-500">
              CPR Dashboard
            </h2>
            <p className="text-xs text-muted-foreground">Checkpoint pass rates</p>
          </div>
        </div>
        <div className="text-3xl font-bold mb-1 text-purple-500">
          <Target size={32} />
        </div>
        <p className="text-xs text-muted-foreground">CPR distribution by crime</p>
      </Link>

      <Link
        href="/dashboard/armory"
        className={`bg-card border rounded-lg p-4 transition-all text-left group block ${
          !historicalFetchComplete || !hasArmoryScope
            ? "pointer-events-none opacity-40 border-border/50"
            : "border-border hover:border-orange-500 cursor-pointer"
        }`}
        onClick={(e) => {
          if (!historicalFetchComplete || !hasArmoryScope) {
            handleDisabledClick(
              e,
              !hasArmoryScope
                ? "Your API key does not have 'armorynews' scope. Please regenerate your key."
                : "Historical data is still loading...",
            )
          }
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className={`p-2 rounded-lg border ${
              hasArmoryScope ? "bg-orange-500/20 border-orange-500/40" : "bg-gray-500/20 border-gray-500/40"
            }`}
          >
            <Package size={20} className={hasArmoryScope ? "text-orange-500" : "text-gray-500"} />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              className={`text-lg font-bold transition-colors ${
                hasArmoryScope ? "text-foreground group-hover:text-orange-500" : "text-muted-foreground"
              }`}
            >
              Armory
            </h2>
            <p className="text-xs text-muted-foreground">
              {hasArmoryScope ? "View armory logs" : "Scope not available"}
            </p>
          </div>
        </div>
        <div className={`text-3xl font-bold mb-1 ${hasArmoryScope ? "text-orange-500" : "text-gray-500"}`}>
          <Package size={32} />
        </div>
        <p className="text-xs text-muted-foreground">Historical armory activity</p>
      </Link>

      <Link
        href="/dashboard/funds"
        className={`bg-card border rounded-lg p-4 transition-all text-left group block ${
          !historicalFetchComplete || !hasFundsScope
            ? "pointer-events-none opacity-40 border-border/50"
            : "border-border hover:border-yellow-500 cursor-pointer"
        }`}
        onClick={(e) => {
          if (!historicalFetchComplete || !hasFundsScope) {
            handleDisabledClick(
              e,
              !hasFundsScope
                ? "Your API key does not have 'fundsnews' scope. Please regenerate your key."
                : "Historical data is still loading...",
            )
          }
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className={`p-2 rounded-lg border ${
              hasFundsScope ? "bg-yellow-500/20 border-yellow-500/40" : "bg-gray-500/20 border-gray-500/40"
            }`}
          >
            <DollarSign size={20} className={hasFundsScope ? "text-yellow-500" : "text-gray-500"} />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              className={`text-lg font-bold transition-colors ${
                hasFundsScope ? "text-foreground group-hover:text-yellow-500" : "text-muted-foreground"
              }`}
            >
              Funds
            </h2>
            <p className="text-xs text-muted-foreground">
              {hasFundsScope ? "Fund transfer logs" : "Scope not available"}
            </p>
          </div>
        </div>
        <div className={`text-3xl font-bold mb-1 ${hasFundsScope ? "text-yellow-500" : "text-gray-500"}`}>
          <DollarSign size={32} />
        </div>
        <p className="text-xs text-muted-foreground">Historical fund transfers</p>
      </Link>

      <Link
        href="/dashboard/medical"
        className={`bg-card border rounded-lg p-4 transition-all text-left group block ${
          !historicalFetchComplete || !hasMedicalScope
            ? "pointer-events-none opacity-40 border-border/50"
            : "border-border hover:border-rose-500 cursor-pointer"
        }`}
        onClick={(e) => {
          if (!historicalFetchComplete || !hasMedicalScope) {
            handleDisabledClick(
              e,
              !hasMedicalScope
                ? "Your API key does not have 'medical' scope. Please regenerate your key."
                : "Historical data is still loading...",
            )
          }
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className={`p-2 rounded-lg border ${
              hasMedicalScope ? "bg-rose-500/20 border-rose-500/40" : "bg-gray-500/20 border-gray-500/40"
            }`}
          >
            <Heart size={20} className={hasMedicalScope ? "text-rose-500" : "text-gray-500"} />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              className={`text-lg font-bold transition-colors ${
                hasMedicalScope ? "text-foreground group-hover:text-rose-500" : "text-muted-foreground"
              }`}
            >
              Medical
            </h2>
            <p className="text-xs text-muted-foreground">
              {hasMedicalScope ? "Medical inventory" : "Scope not available"}
            </p>
          </div>
        </div>
        <div className={`text-3xl font-bold mb-1 ${hasMedicalScope ? "text-rose-500" : "text-gray-500"}`}>
          <Heart size={32} />
        </div>
        <p className="text-xs text-muted-foreground">Faction medical items</p>
      </Link>

      <Link
        href="/dashboard/reports"
        className={`bg-card border border-border rounded-lg p-4 hover:border-cyan-500 transition-all text-left group block ${
          !historicalFetchComplete ? "pointer-events-none opacity-50" : "cursor-pointer"
        }`}
        onClick={(e) => {
          if (!historicalFetchComplete) {
            handleDisabledClick(e, "Historical data is still loading...")
          }
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-cyan-500/20 p-2 rounded-lg border border-cyan-500/40">
            <FileText size={20} className="text-cyan-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-foreground group-hover:text-cyan-500 transition-colors">Reports</h2>
            <p className="text-xs text-muted-foreground">Detailed crime reports</p>
          </div>
        </div>
        <div className="text-3xl font-bold text-cyan-500 mb-1">
          <FileText size={32} />
        </div>
        <p className="text-xs text-muted-foreground">Historical data</p>
      </Link>
    </div>
  )
}
