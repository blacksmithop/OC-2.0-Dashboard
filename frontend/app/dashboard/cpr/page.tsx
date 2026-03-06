"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Target,
  RefreshCw,
  Users,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  X,
  ArrowUpDown,
  Settings,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  LineChart as LineChartIcon,
  Filter,
  Check,
  TrendingUp,
  TrendingDown,
  Layers,
  BarChart2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiKeyManager } from "@/lib/auth/api-key-manager";
import { thirdPartySettingsManager } from "@/lib/settings/third-party-manager";
import {
  getTornStatsCPRData,
  type TornStatsCPRData,
} from "@/lib/integration/cpr-tracker";
import {
  fetchAndCacheMembers,
  getCachedMembers,
} from "@/lib/cache/members-cache";
import { db, STORES } from "@/lib/db/indexeddb";
import { Button } from "@/components/ui/button";
import { ReportDateFilter } from "@/components/reports/report-date-filter";
import { cn } from "@/lib/utils";
import { isValid } from "date-fns";
import type { Crime, Member } from "@/types/crime";
import { CRIME_METADATA } from "@/lib/crimes/metadata";
import {
  extractCPRFromAllCrimes,
  extractCPRFromTornStats,
  mergeCPRData,
  DEFAULT_MIN_CPR,
  type AggregatedCPRData,
  type MemberCPREntry,
} from "@/lib/crimes/cpr-aggregator";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

interface MinCPRSettings {
  [crimeName: string]: {
    [roleName: string]: number;
  };
}

export default function CPRDashboard() {
  const router = useRouter();
  const { toast } = useToast();

  // Raw Data State
  const [allCrimes, setAllCrimes] = useState<Crime[]>([]);
  const [members, setMembers] = useState<Map<number, Member>>(new Map());
  const [memberNames, setMemberNames] = useState<Map<number, string>>(
    new Map(),
  );
  const [tornStatsData, setTornStatsData] = useState<TornStatsCPRData | null>(
    null,
  );

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedCrimes, setExpandedCrimes] = useState<Set<string>>(new Set());
  const [minCPRSettings, setMinCPRSettings] = useState<MinCPRSettings>({});
  const [hasTornStats, setHasTornStats] = useState(false);

  // Table State
  const [currentPage, setCurrentPage] = useState<Record<string, number>>({});
  const [sortColumn, setSortColumn] = useState<Record<string, string | null>>(
    {},
  );
  const [sortDirection, setSortDirection] = useState<
    Record<string, "asc" | "desc">
  >({});
  const [membersInOC, setMembersInOC] = useState<Set<number>>(new Set());
  const ITEMS_PER_PAGE = 10;

  // Filter State
  const [playerOpen, setPlayerOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [cprRange, setCprRange] = useState<[number, number]>([0, 100]);
  const [customDateRange, setCustomDateRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const [datePreset, setDatePreset] = useState<string>("all");

  // Modal State
  const [historyModal, setHistoryModal] = useState<{
    isOpen: boolean;
    memberId: number;
    memberName: string;
    crimeName: string;
    roleName: string;
  } | null>(null);

  const loadRawData = async (forceRefresh = false) => {
    const apiKey = await apiKeyManager.getApiKey();
    if (!apiKey) return;

    // 1. Load Members
    let membersData = getCachedMembers();
    if (!membersData || membersData.size === 0) {
      membersData = await fetchAndCacheMembers(apiKey);
    }
    setMembers(membersData);

    const namesMap = new Map<number, string>();
    for (const [id, member] of membersData) {
      namesMap.set(id, member.name);
    }
    setMemberNames(namesMap);

    // 2. Load Crimes
    const historicalCrimes = await db.get<Crime[]>(
      STORES.CACHE,
      "factionHistoricalCrimes",
    );
    const loadedCrimes = historicalCrimes || [];

    const crimesMap = new Map<number, Crime>();
    for (const crime of loadedCrimes) {
      crimesMap.set(crime.id, crime);
    }
    const uniqueCrimes = Array.from(crimesMap.values());
    setAllCrimes(uniqueCrimes);

    // 3. Find Members currently in Active OCs
    const inOCSet = new Set<number>();
    for (const crime of uniqueCrimes) {
      if (crime.status === "Planning" || crime.status === "Recruiting") {
        for (const slot of crime.slots) {
          if (slot.user?.id) {
            inOCSet.add(slot.user.id);
          }
        }
      }
    }
    setMembersInOC(inOCSet);

    // 4. Load TornStats
    const settings = await thirdPartySettingsManager.getSettings();
    if (settings.tornStats?.enabled && settings.tornStats?.apiKey) {
      setHasTornStats(true);
      const tsData = await getTornStatsCPRData(
        settings.tornStats.apiKey,
        forceRefresh,
      );
      setTornStatsData(tsData);
    } else {
      setHasTornStats(false);
      setTornStatsData(null);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const apiKey = await apiKeyManager.getApiKey();
      if (!apiKey) {
        router.push("/");
        return;
      }

      const savedMinCPR = await db.get<MinCPRSettings>(
        STORES.SETTINGS,
        "minCPRSettings",
      );
      if (savedMinCPR) {
        setMinCPRSettings(savedMinCPR);
      }

      await loadRawData();
      setIsLoading(false);
    };

    initialize();
  }, [router]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadRawData(true);
    toast({
      title: "Refreshed",
      description: "CPR data refreshed from all sources",
    });
    setIsRefreshing(false);
  };

  // Reactive Date Boundaries
  const { minDate, maxDate } = useMemo(() => {
    if (!allCrimes || allCrimes.length === 0) {
      return {
        minDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        maxDate: new Date(),
      };
    }
    const timestamps = allCrimes.map(
      (c) => (c.executed_at || c.created_at || Date.now() / 1000) * 1000,
    );
    return {
      minDate: new Date(Math.min(...timestamps)),
      maxDate: new Date(Math.max(...timestamps)),
    };
  }, [allCrimes]);

  const initialStartDate = useMemo(
    () =>
      customDateRange?.start && isValid(customDateRange.start)
        ? customDateRange.start
        : minDate,
    [customDateRange, minDate],
  );
  const initialEndDate = useMemo(
    () =>
      customDateRange?.end && isValid(customDateRange.end)
        ? customDateRange.end
        : maxDate,
    [customDateRange, maxDate],
  );

  // Reactively Filter Crimes by Date
  const dateFilteredCrimes = useMemo(() => {
    if (
      !customDateRange?.start ||
      !customDateRange?.end ||
      datePreset === "all"
    ) {
      return allCrimes;
    }
    return allCrimes.filter((crime) => {
      const time =
        (crime.executed_at || crime.created_at || Date.now() / 1000) * 1000;
      return (
        time >= customDateRange.start.getTime() &&
        time <= customDateRange.end.getTime()
      );
    });
  }, [allCrimes, customDateRange, datePreset]);

  // Extract CPR Data purely from filtered results
  const cprData = useMemo(() => {
    const crimesCPR = extractCPRFromAllCrimes(dateFilteredCrimes, memberNames);
    if (hasTornStats && tornStatsData) {
      const tsCPR = extractCPRFromTornStats(tornStatsData, memberNames);
      return mergeCPRData(crimesCPR, tsCPR);
    }
    return crimesCPR;
  }, [dateFilteredCrimes, tornStatsData, memberNames, hasTornStats]);

  const dataStats = useMemo(() => {
    let fromCrimes = 0;
    let fromTornStats = 0;
    if (cprData) {
      for (const crime of cprData.crimes.values()) {
        for (const role of crime.roles.values()) {
          role.entries.forEach((e) => {
            if (e.source === "tornstats") fromTornStats++;
            else fromCrimes++;
          });
        }
      }
    }
    return { fromCrimes, fromTornStats };
  }, [cprData]);

  const baseCrimeRoleCPRData = useMemo(() => {
    if (!cprData) return [];
    const result: {
      crimeName: string;
      roles: { roleName: string; entries: MemberCPREntry[] }[];
    }[] = [];

    for (const [crimeName, crimeData] of cprData.crimes) {
      const roles: { roleName: string; entries: MemberCPREntry[] }[] = [];
      for (const [roleName, roleData] of crimeData.roles) {
        roles.push({ roleName, entries: roleData.entries });
      }
      roles.sort((a, b) => a.roleName.localeCompare(b.roleName));
      result.push({ crimeName, roles });
    }
    result.sort((a, b) => a.crimeName.localeCompare(b.crimeName));
    return result;
  }, [cprData]);

  // Calculate the absolute minimum CPR available in the dataset for the slider
  const absoluteMinCPR = useMemo(() => {
    let min = 100;
    baseCrimeRoleCPRData.forEach((crime) => {
      crime.roles.forEach((role) => {
        role.entries.forEach((entry) => {
          if (entry.cpr < min) min = entry.cpr;
        });
      });
    });
    return min === 100 ? 0 : Math.floor(min);
  }, [baseCrimeRoleCPRData]);

  // Adjust CPR Range if absoluteMinCPR changes below current range
  useEffect(() => {
    if (cprRange[0] < absoluteMinCPR) {
      setCprRange([absoluteMinCPR, Math.max(cprRange[1], absoluteMinCPR)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absoluteMinCPR]);

  // FILTERED DATA: Apply user selected dropdown/slider filters
  const filteredCrimeRoleCPRData = useMemo(() => {
    if (!baseCrimeRoleCPRData.length) return [];

    let result = baseCrimeRoleCPRData;

    if (selectedScenarios.length > 0) {
      result = result.filter((c) => selectedScenarios.includes(c.crimeName));
    }

    return result
      .map((crime) => {
        let filteredRoles = crime.roles;

        if (selectedRoles.length > 0) {
          filteredRoles = filteredRoles.filter((role) =>
            selectedRoles.includes(role.roleName),
          );
        }

        filteredRoles = filteredRoles
          .map((role) => {
            const filteredEntries = role.entries.filter((entry) => {
              if (
                selectedMembers.length > 0 &&
                !selectedMembers.includes(entry.memberId)
              )
                return false;
              if (entry.cpr < cprRange[0] || entry.cpr > cprRange[1])
                return false;
              return true;
            });
            return { ...role, entries: filteredEntries };
          })
          .filter((role) => role.entries.length > 0);

        return { ...crime, roles: filteredRoles };
      })
      .filter((crime) => crime.roles.length > 0);
  }, [
    baseCrimeRoleCPRData,
    selectedScenarios,
    selectedMembers,
    selectedRoles,
    cprRange,
  ]);

  // Dynamic Lists for Comboboxes
  const allMembersList = useMemo(() => {
    const list = Array.from(members.values()).map((m) => ({
      id: m.id,
      name: m.name,
    }));
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [members]);

  const availableScenarios = useMemo(() => {
    let filtered = baseCrimeRoleCPRData;
    if (selectedMembers.length > 0) {
      filtered = filtered.filter((c) =>
        c.roles.some((r) =>
          r.entries.some((e) => selectedMembers.includes(e.memberId)),
        ),
      );
    }
    return Array.from(new Set(filtered.map((c) => c.crimeName))).sort();
  }, [baseCrimeRoleCPRData, selectedMembers]);

  const availableRoles = useMemo(() => {
    let filtered = baseCrimeRoleCPRData;
    if (selectedScenarios.length > 0) {
      filtered = filtered.filter((c) =>
        selectedScenarios.includes(c.crimeName),
      );
    }
    if (selectedMembers.length > 0) {
      filtered = filtered.map((c) => ({
        ...c,
        roles: c.roles.filter((r) =>
          r.entries.some((e) => selectedMembers.includes(e.memberId)),
        ),
      }));
    }
    const roles = new Set<string>();
    filtered.forEach((c) => c.roles.forEach((r) => roles.add(r.roleName)));
    return Array.from(roles).sort();
  }, [baseCrimeRoleCPRData, selectedScenarios, selectedMembers]);

  // Group by Difficulty
  const groupedByDifficulty = useMemo(() => {
    const groups = new Map<number, typeof filteredCrimeRoleCPRData>();
    filteredCrimeRoleCPRData.forEach((crime) => {
      const difficulty = CRIME_METADATA[crime.crimeName]?.difficulty || 0;
      if (!groups.has(difficulty)) {
        groups.set(difficulty, []);
      }
      groups.get(difficulty)!.push(crime);
    });

    // Sort keys descending (Highest Difficulty first) or Ascending based on preference
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => b - a);

    return sortedKeys.map((key) => ({
      difficulty: key,
      crimes: groups
        .get(key)!
        .sort((a, b) => a.crimeName.localeCompare(b.crimeName)),
    }));
  }, [filteredCrimeRoleCPRData]);

  // DISTRIBUTION CHART DATA
  const distributionData = useMemo(() => {
    return filteredCrimeRoleCPRData.map((crime) => {
      let low = 0,
        med = 0,
        high = 0,
        elite = 0;

      const uniqueMembers = new Map<number, number>();
      crime.roles.forEach((role) => {
        role.entries.forEach((e) => {
          const current = uniqueMembers.get(e.memberId) || 0;
          if (e.cpr > current) uniqueMembers.set(e.memberId, e.cpr);
        });
      });

      uniqueMembers.forEach((cpr) => {
        if (cpr < 50) low++;
        else if (cpr < 75) med++;
        else if (cpr < 90) high++;
        else elite++;
      });

      return {
        name: crime.crimeName,
        "Needs Improvement (<50)": low,
        "Average (50-74)": med,
        "Good (75-89)": high,
        "Excellent (90+)": elite,
      };
    });
  }, [filteredCrimeRoleCPRData]);

  // OVERALL CPR TREND CHART DATA
  const overallChartData = useMemo(() => {
    const grouped = new Map<
      string,
      { dateStr: string; timestamp: number; totalCPR: number; count: number }
    >();

    dateFilteredCrimes.forEach((crime) => {
      if (crime.status !== "Successful" && crime.status !== "Failed") return;
      if (
        selectedScenarios.length > 0 &&
        !selectedScenarios.includes(crime.name)
      )
        return;

      const time = crime.executed_at || crime.created_at;
      if (!time) return;

      const dateObj = new Date(time * 1000);
      const dateStr = dateObj.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "2-digit",
      });

      if (!grouped.has(dateStr)) {
        grouped.set(dateStr, {
          dateStr,
          timestamp: time,
          totalCPR: 0,
          count: 0,
        });
      }

      const dayData = grouped.get(dateStr)!;

      crime.slots.forEach((slot) => {
        if (slot.checkpoint_pass_rate !== undefined) {
          if (
            selectedMembers.length > 0 &&
            !selectedMembers.includes(slot.user?.id || 0)
          )
            return;
          if (
            selectedRoles.length > 0 &&
            !selectedRoles.includes(slot.position)
          )
            return;

          dayData.totalCPR += slot.checkpoint_pass_rate;
          dayData.count++;
        }
      });
    });

    return Array.from(grouped.values())
      .filter((d) => d.count > 0)
      .map((d) => ({
        dateStr: d.dateStr,
        timestamp: d.timestamp,
        cpr: Math.round((d.totalCPR / d.count) * 10) / 10,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [dateFilteredCrimes, selectedScenarios, selectedMembers, selectedRoles]);

  // HISTORY CHART DATA (Calculated on demand for the modal)
  const historyChartData = useMemo(() => {
    if (!historyModal || !dateFilteredCrimes.length) return [];
    const data: {
      dateStr: string;
      timestamp: number;
      cpr: number;
      status: string;
    }[] = [];

    dateFilteredCrimes.forEach((c) => {
      if (c.name !== historyModal.crimeName) return;

      const slot = c.slots.find(
        (s) =>
          s.position === historyModal.roleName &&
          s.user?.id === historyModal.memberId,
      );
      if (slot && slot.checkpoint_pass_rate !== undefined) {
        const time = c.executed_at || c.created_at || Date.now() / 1000;
        data.push({
          dateStr: new Date(time * 1000).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "2-digit",
          }),
          timestamp: time,
          cpr: slot.checkpoint_pass_rate,
          status: c.status,
        });
      }
    });

    return data.sort((a, b) => a.timestamp - b.timestamp);
  }, [historyModal, dateFilteredCrimes]);

  // Calculate Growth for Modal
  const cprGrowth = useMemo(() => {
    if (historyChartData.length < 2) return null;
    const first = historyChartData[0].cpr;
    const last = historyChartData[historyChartData.length - 1].cpr;
    return last - first;
  }, [historyChartData]);

  // Modern, softer colors for badges
  const getCPRColor = (cpr: number, minCPR: number): string => {
    if (cpr >= 90)
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    if (cpr >= minCPR)
      return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    return "text-rose-400 bg-rose-400/10 border-rose-400/20";
  };

  const handleMinCPRChange = async (
    crimeName: string,
    roleName: string,
    value: number,
  ) => {
    const newSettings = { ...minCPRSettings };
    if (!newSettings[crimeName]) newSettings[crimeName] = {};
    newSettings[crimeName][roleName] = value;
    setMinCPRSettings(newSettings);
    await db.set(STORES.SETTINGS, "minCPRSettings", newSettings);
  };

  const getMinCPR = (crimeName: string, roleName: string): number => {
    return minCPRSettings[crimeName]?.[roleName] ?? DEFAULT_MIN_CPR;
  };

  const toggleCrimeExpanded = (crimeName: string) => {
    const newExpanded = new Set(expandedCrimes);
    if (newExpanded.has(crimeName)) newExpanded.delete(crimeName);
    else newExpanded.add(crimeName);
    setExpandedCrimes(newExpanded);
  };

  const openHistoryModal = (
    memberId: number,
    memberName: string,
    crimeName: string,
    roleName: string,
  ) => {
    setHistoryModal({
      isOpen: true,
      memberId,
      memberName,
      crimeName,
      roleName,
    });
  };

  const getUniqueMembersForCrime = (
    crimeName: string,
    roles: { roleName: string; entries: MemberCPREntry[] }[],
  ) => {
    const memberIds = new Set<number>();
    const memberMap = new Map<number, string>();
    const memberCPRs = new Map<number, Map<string, number>>();

    for (const role of roles) {
      for (const entry of role.entries) {
        memberIds.add(entry.memberId);
        memberMap.set(entry.memberId, entry.memberName);
        if (!memberCPRs.has(entry.memberId))
          memberCPRs.set(entry.memberId, new Map());
        memberCPRs.get(entry.memberId)!.set(role.roleName, entry.cpr);
      }
    }

    let membersList = Array.from(memberIds).map((id) => ({
      memberId: id,
      memberName: memberMap.get(id) || `ID: ${id}`,
      cprs: memberCPRs.get(id) || new Map<string, number>(),
    }));

    const sortCol = sortColumn[crimeName];
    const sortDir = sortDirection[crimeName] || "desc";

    if (sortCol === "name") {
      membersList.sort((a, b) => {
        const cmp = a.memberName.localeCompare(b.memberName);
        return sortDir === "asc" ? cmp : -cmp;
      });
    } else if (sortCol) {
      membersList.sort((a, b) => {
        const aCpr = a.cprs.get(sortCol) ?? -1;
        const bCpr = b.cprs.get(sortCol) ?? -1;
        return sortDir === "asc" ? aCpr - bCpr : bCpr - aCpr;
      });
    } else {
      membersList.sort((a, b) => a.memberName.localeCompare(b.memberName));
    }

    return membersList;
  };

  const handleSort = (crimeName: string, column: string) => {
    const currentCol = sortColumn[crimeName];
    const currentDir = sortDirection[crimeName] || "desc";

    if (currentCol === column) {
      setSortDirection((prev) => ({
        ...prev,
        [crimeName]: currentDir === "asc" ? "desc" : "asc",
      }));
    } else {
      setSortColumn((prev) => ({ ...prev, [crimeName]: column }));
      setSortDirection((prev) => ({
        ...prev,
        [crimeName]: column === "name" ? "asc" : "desc",
      }));
    }
    setCurrentPage((prev) => ({ ...prev, [crimeName]: 0 }));
  };

  const getPageForCrime = (crimeName: string) => currentPage[crimeName] || 0;

  const getPaginationPages = (
    currentPg: number,
    totalPgs: number,
  ): (number | "...")[] => {
    if (totalPgs <= 5) return Array.from({ length: totalPgs }, (_, i) => i);
    const pages: (number | "...")[] = [0];
    if (currentPg > 2) pages.push("...");
    for (
      let i = Math.max(1, currentPg - 1);
      i <= Math.min(totalPgs - 2, currentPg + 1);
      i++
    ) {
      if (!pages.includes(i)) pages.push(i);
    }
    if (currentPg < totalPgs - 3) pages.push("...");
    if (!pages.includes(totalPgs - 1)) pages.push(totalPgs - 1);
    return pages;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground flex items-center gap-2">
          <RefreshCw size={20} className="animate-spin" />
          Loading CPR data...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="p-2 hover:bg-accent rounded-lg transition-colors border border-border"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <div className="bg-purple-500/20 p-2 rounded-lg border border-purple-500/40">
                    <Target size={24} className="text-purple-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      CPR Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Analyze Checkpoint Pass Rates
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-4">
                <span className="flex items-center gap-1 text-red-400">
                  <Database size={12} />
                  {dataStats.fromCrimes} records
                </span>
                {hasTornStats && (
                  <span className="flex items-center gap-1 text-purple-400">
                    <ExternalLink size={12} />
                    {dataStats.fromTornStats} via TornStats
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="gap-2 bg-transparent"
              >
                <RefreshCw
                  size={16}
                  className={isRefreshing ? "animate-spin" : ""}
                />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* FILTERS SECTION */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Filter size={18} className="text-primary" />
              Data Filters
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedMembers([]);
                setSelectedScenarios([]);
                setSelectedRoles([]);
                setCprRange([absoluteMinCPR, 100]);
              }}
              className="text-xs h-8 text-muted-foreground hover:text-foreground"
            >
              Clear All
            </Button>
          </div>

          {/* Row 1: Player | Scenario | Role */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Player Combobox */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Player
              </label>
              <Popover open={playerOpen} onOpenChange={setPlayerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between font-normal bg-background"
                  >
                    <span className="truncate">
                      {selectedMembers.length > 0
                        ? `${selectedMembers.length} Selected`
                        : "All Players"}
                    </span>
                    <ChevronDown size={14} className="opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search player..." />
                    <CommandList>
                      <CommandEmpty>No player found.</CommandEmpty>
                      <CommandGroup>
                        {allMembersList.map((m) => (
                          <CommandItem
                            key={m.id}
                            onSelect={() => {
                              setSelectedMembers((prev) =>
                                prev.includes(m.id)
                                  ? prev.filter((id) => id !== m.id)
                                  : [...prev, m.id],
                              );
                            }}
                          >
                            <div
                              className={cn(
                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                selectedMembers.includes(m.id)
                                  ? "bg-primary text-primary-foreground"
                                  : "opacity-50 [&_svg]:invisible",
                              )}
                            >
                              <Check className="h-3 w-3" />
                            </div>
                            {m.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Scenario Combobox */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Scenario
              </label>
              <Popover open={scenarioOpen} onOpenChange={setScenarioOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between font-normal bg-background"
                  >
                    <span className="truncate">
                      {selectedScenarios.length > 0
                        ? `${selectedScenarios.length} Selected`
                        : "All Scenarios"}
                    </span>
                    <ChevronDown size={14} className="opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search scenario..." />
                    <CommandList>
                      <CommandEmpty>No scenario found.</CommandEmpty>
                      <CommandGroup>
                        {availableScenarios.map((scen) => (
                          <CommandItem
                            key={scen}
                            onSelect={() => {
                              setSelectedScenarios((prev) =>
                                prev.includes(scen)
                                  ? prev.filter((s) => s !== scen)
                                  : [...prev, scen],
                              );
                            }}
                          >
                            <div
                              className={cn(
                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                selectedScenarios.includes(scen)
                                  ? "bg-primary text-primary-foreground"
                                  : "opacity-50 [&_svg]:invisible",
                              )}
                            >
                              <Check className="h-3 w-3" />
                            </div>
                            {scen}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Role Combobox */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Role
              </label>
              <Popover open={roleOpen} onOpenChange={setRoleOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between font-normal bg-background"
                  >
                    <span className="truncate">
                      {selectedRoles.length > 0
                        ? `${selectedRoles.length} Selected`
                        : "All Roles"}
                    </span>
                    <ChevronDown size={14} className="opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search role..." />
                    <CommandList>
                      <CommandEmpty>No role found.</CommandEmpty>
                      <CommandGroup>
                        {availableRoles.map((role) => (
                          <CommandItem
                            key={role}
                            onSelect={() => {
                              setSelectedRoles((prev) =>
                                prev.includes(role)
                                  ? prev.filter((r) => r !== role)
                                  : [...prev, role],
                              );
                            }}
                          >
                            <div
                              className={cn(
                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                selectedRoles.includes(role)
                                  ? "bg-primary text-primary-foreground"
                                  : "opacity-50 [&_svg]:invisible",
                              )}
                            >
                              <Check className="h-3 w-3" />
                            </div>
                            {role}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Row 2: Date Range | CPR Range */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            <div>
              <ReportDateFilter
                minDate={minDate}
                maxDate={maxDate}
                startDate={initialStartDate}
                endDate={initialEndDate}
                onDateRangeChange={(start, end) =>
                  setCustomDateRange({ start, end })
                }
                onPresetChange={setDatePreset}
                selectedPreset={datePreset}
              />
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-muted-foreground flex justify-between">
                <span>CPR Range</span>
                <span className="text-primary font-bold">
                  {cprRange[0]}% - {cprRange[1]}%
                </span>
              </label>
              <div className="pt-4 px-2">
                <Slider
                  min={absoluteMinCPR}
                  max={100}
                  step={1}
                  value={cprRange}
                  onValueChange={(val: number[]) =>
                    setCprRange([val[0], val[1]])
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* OVERALL CPR TREND CHART */}
        {overallChartData.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
              <LineChartIcon size={18} className="text-accent" />
              Overall CPR Trend (Average)
            </h3>
            <div className="w-full overflow-x-auto pb-2 custom-scrollbar">
              <div
                style={{
                  minWidth: `${Math.max(800, overallChartData.length * 40)}px`,
                  height: "300px",
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={overallChartData}
                    margin={{ top: 10, right: 20, left: -20, bottom: 50 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#333"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="dateStr"
                      tick={{ fill: "#888", fontSize: 11 }}
                      tickMargin={25}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      domain={[
                        absoluteMinCPR > 20 ? absoluteMinCPR - 10 : 0,
                        100,
                      ]}
                      tick={{ fill: "#888", fontSize: 11 }}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "#111",
                        borderColor: "#333",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
                      labelStyle={{ color: "#888", marginBottom: "8px" }}
                      formatter={(value: number) => [
                        `${value}%`,
                        `Average CPR`,
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="cpr"
                      stroke="#a855f7"
                      strokeWidth={3}
                      dot={{ r: 3, fill: "#a855f7", strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: "#fff", stroke: "#a855f7" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* DISTRIBUTION CHART */}
        {distributionData.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
              <BarChart2 size={18} className="text-accent" />
              CPR Distribution by Scenario
            </h3>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={distributionData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#333"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#888", fontSize: 11 }}
                    angle={-35}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                  <YAxis tick={{ fill: "#888", fontSize: 11 }} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "#111",
                      borderColor: "#333",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ fontSize: "12px" }}
                    labelStyle={{
                      color: "#fff",
                      fontWeight: "bold",
                      marginBottom: "8px",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                  />
                  <Bar
                    dataKey="Needs Improvement (<50)"
                    stackId="a"
                    fill="#ef4444"
                    radius={[0, 0, 4, 4]}
                  />
                  <Bar dataKey="Average (50-74)" stackId="a" fill="#f97316" />
                  <Bar dataKey="Good (75-89)" stackId="a" fill="#eab308" />
                  <Bar
                    dataKey="Excellent (90+)"
                    stackId="a"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TABLE SECTION */}
        {groupedByDifficulty.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <Target
              size={48}
              className="mx-auto text-muted-foreground mb-4 opacity-50"
            />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No CPR Data Found
            </h2>
            <p className="text-muted-foreground">
              Adjust your filters to view more results.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-medium">
                <Users size={14} className="inline mr-1" />
                Showing {filteredCrimeRoleCPRData.length} scenarios
              </p>
            </div>

            {groupedByDifficulty.map(({ difficulty, crimes }) => (
              <div key={`diff-${difficulty}`} className="space-y-4 mb-8">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <Layers size={18} className="text-primary" />
                  <h3 className="text-lg font-bold text-foreground">
                    Difficulty Level {difficulty}
                  </h3>
                </div>

                {crimes.map((crime) => {
                  const allMembers = getUniqueMembersForCrime(
                    crime.crimeName,
                    crime.roles,
                  );
                  const isExpanded = expandedCrimes.has(crime.crimeName);
                  const page = getPageForCrime(crime.crimeName);
                  const totalPages = Math.ceil(
                    allMembers.length / ITEMS_PER_PAGE,
                  );
                  const paginatedMembers = allMembers.slice(
                    page * ITEMS_PER_PAGE,
                    (page + 1) * ITEMS_PER_PAGE,
                  );

                  return (
                    <div
                      key={crime.crimeName}
                      className="bg-card border border-border rounded-lg overflow-hidden transition-all duration-200 hover:border-primary/50 shadow-sm"
                    >
                      <button
                        onClick={() => toggleCrimeExpanded(crime.crimeName)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-accent/10 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <h3 className="font-bold text-foreground text-base">
                            {crime.crimeName}
                          </h3>
                          <div className="flex gap-2">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded font-semibold">
                              {crime.roles.length} roles
                            </span>
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded font-semibold">
                              {allMembers.length} members
                            </span>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp
                            size={18}
                            className="text-muted-foreground"
                          />
                        ) : (
                          <ChevronDown
                            size={18}
                            className="text-muted-foreground"
                          />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border animate-in slide-in-from-top-2 duration-200 p-3">
                          <div className="overflow-x-auto rounded-md border border-border/40 bg-card">
                            <table className="w-full text-sm border-collapse whitespace-nowrap">
                              <thead className="bg-muted/20">
                                <tr className="border-b border-border/40">
                                  <th
                                    className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider sticky left-0 z-20 bg-muted/20 backdrop-blur-md cursor-pointer hover:text-foreground transition-colors"
                                    onClick={() =>
                                      handleSort(crime.crimeName, "name")
                                    }
                                  >
                                    <div className="flex items-center gap-1.5">
                                      Member
                                      <ArrowUpDown
                                        size={12}
                                        className={
                                          sortColumn[crime.crimeName] === "name"
                                            ? "text-primary"
                                            : "opacity-40"
                                        }
                                      />
                                    </div>
                                  </th>
                                  {crime.roles.map((role) => {
                                    const isSortedByThis =
                                      sortColumn[crime.crimeName] ===
                                      role.roleName;
                                    return (
                                      <th
                                        key={role.roleName}
                                        className="text-center px-3 py-2.5 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider min-w-[120px] cursor-pointer hover:text-foreground transition-colors"
                                        onClick={() =>
                                          handleSort(
                                            crime.crimeName,
                                            role.roleName,
                                          )
                                        }
                                      >
                                        <div className="flex items-center justify-center gap-1.5">
                                          <span
                                            className={
                                              isSortedByThis
                                                ? "text-primary font-bold"
                                                : ""
                                            }
                                          >
                                            {role.roleName}
                                          </span>
                                          <ArrowUpDown
                                            size={12}
                                            className={
                                              isSortedByThis
                                                ? "text-primary"
                                                : "opacity-40"
                                            }
                                          />
                                        </div>
                                      </th>
                                    );
                                  })}
                                  <th className="w-10 px-2 text-center">
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button className="p-1.5 hover:bg-accent rounded transition-colors border border-transparent hover:border-border">
                                          <Settings
                                            size={14}
                                            className="text-muted-foreground hover:text-foreground"
                                          />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        className="w-72 p-4"
                                        align="end"
                                      >
                                        <div className="space-y-4">
                                          <div>
                                            <h4 className="font-bold text-sm">
                                              Minimum CPR Thresholds
                                            </h4>
                                            <p className="text-xs text-muted-foreground mt-1">
                                              Adjust passing grades per role to
                                              highlight risks.
                                            </p>
                                          </div>
                                          <div className="space-y-3 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                                            {crime.roles.map((role) => (
                                              <div
                                                key={role.roleName}
                                                className="flex items-center justify-between gap-3 bg-background p-2 rounded border border-border/50"
                                              >
                                                <span className="text-sm font-medium truncate flex-1">
                                                  {role.roleName}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                  <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={getMinCPR(
                                                      crime.crimeName,
                                                      role.roleName,
                                                    )}
                                                    onChange={(e) =>
                                                      handleMinCPRChange(
                                                        crime.crimeName,
                                                        role.roleName,
                                                        parseInt(
                                                          e.target.value,
                                                        ) || 0,
                                                      )
                                                    }
                                                    className="w-14 px-2 py-1 text-sm bg-card border border-border rounded text-center focus:ring-1 focus:ring-primary outline-none"
                                                  />
                                                  <span className="text-xs text-muted-foreground">
                                                    %
                                                  </span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/20">
                                {paginatedMembers.map((member) => (
                                  <tr
                                    key={member.memberId}
                                    className="hover:bg-muted/30 transition-colors group"
                                  >
                                    <td className="px-4 py-2 sticky left-0 bg-card group-hover:bg-muted/30 transition-colors z-10">
                                      <div className="flex items-center gap-2">
                                        {membersInOC.has(member.memberId) && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <UserCheck
                                                  size={12}
                                                  className="text-emerald-400 shrink-0"
                                                />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Currently in an active OC</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                        <a
                                          href={`https://www.torn.com/profiles.php?XID=${member.memberId}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-foreground hover:text-primary hover:underline font-medium text-[13px] truncate max-w-[140px] transition-colors"
                                        >
                                          {member.memberName}
                                        </a>
                                      </div>
                                    </td>
                                    {crime.roles.map((role) => {
                                      const cpr = member.cprs.get(
                                        role.roleName,
                                      );
                                      const minCPR = getMinCPR(
                                        crime.crimeName,
                                        role.roleName,
                                      );
                                      const entry = role.entries.find(
                                        (e) => e.memberId === member.memberId,
                                      );

                                      return (
                                        <td
                                          key={role.roleName}
                                          className="text-center px-3 py-2"
                                        >
                                          {cpr !== undefined ? (
                                            <div className="flex items-center justify-center gap-1.5">
                                              <span
                                                className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[12px] font-bold border ${getCPRColor(cpr, minCPR)}`}
                                              >
                                                {cpr}%
                                                {entry?.source ===
                                                  "tornstats" && (
                                                  <ExternalLink
                                                    size={9}
                                                    className="ml-1 opacity-50"
                                                    title="Source: TornStats"
                                                  />
                                                )}
                                              </span>
                                              <button
                                                onClick={() =>
                                                  openHistoryModal(
                                                    member.memberId,
                                                    member.memberName,
                                                    crime.crimeName,
                                                    role.roleName,
                                                  )
                                                }
                                                className="text-muted-foreground/30 hover:text-primary transition-colors p-1 rounded hover:bg-primary/10 border border-transparent"
                                                title="View CPR History"
                                              >
                                                <LineChartIcon size={12} />
                                              </button>
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground/20 font-medium text-xs">
                                              -
                                            </span>
                                          )}
                                        </td>
                                      );
                                    })}
                                    <td className="w-10 bg-card group-hover:bg-muted/30 transition-colors" />
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {totalPages > 1 && (
                            <div className="flex items-center justify-between px-2 pt-3">
                              <span className="text-[11px] font-medium text-muted-foreground">
                                Showing {page * ITEMS_PER_PAGE + 1} -{" "}
                                {Math.min(
                                  (page + 1) * ITEMS_PER_PAGE,
                                  allMembers.length,
                                )}{" "}
                                of {allMembers.length}
                              </span>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={page === 0}
                                  onClick={() =>
                                    setCurrentPage((prev) => ({
                                      ...prev,
                                      [crime.crimeName]: page - 1,
                                    }))
                                  }
                                  className="h-6 w-6 p-0 bg-transparent"
                                >
                                  <ChevronLeft size={12} />
                                </Button>
                                {getPaginationPages(page, totalPages).map(
                                  (p, idx) =>
                                    p === "..." ? (
                                      <span
                                        key={`ellipsis-${idx}`}
                                        className="px-1 text-xs text-muted-foreground"
                                      >
                                        ...
                                      </span>
                                    ) : (
                                      <Button
                                        key={p}
                                        variant={
                                          page === p ? "default" : "outline"
                                        }
                                        size="sm"
                                        onClick={() =>
                                          setCurrentPage((prev) => ({
                                            ...prev,
                                            [crime.crimeName]: p as number,
                                          }))
                                        }
                                        className={`h-6 w-6 p-0 text-[11px] font-medium ${page === p ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground hover:text-foreground"}`}
                                      >
                                        {(p as number) + 1}
                                      </Button>
                                    ),
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={page >= totalPages - 1}
                                  onClick={() =>
                                    setCurrentPage((prev) => ({
                                      ...prev,
                                      [crime.crimeName]: page + 1,
                                    }))
                                  }
                                  className="h-6 w-6 p-0 bg-transparent"
                                >
                                  <ChevronRight size={12} />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* CPR HISTORY MODAL */}
      <Dialog
        open={!!historyModal}
        onOpenChange={(open) => !open && setHistoryModal(null)}
      >
        <DialogContent className="max-w-7xl w-[95vw] bg-card border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <LineChartIcon className="text-primary" />
              <span>
                CPR History:{" "}
                <span className="text-accent">{historyModal?.memberName}</span>
              </span>
              {cprGrowth !== null && (
                <span
                  className={cn(
                    "ml-auto text-sm px-2.5 py-0.5 rounded-full font-bold border",
                    cprGrowth > 0
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : cprGrowth < 0
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : "bg-muted/50 text-muted-foreground border-border",
                  )}
                >
                  {cprGrowth > 0 ? (
                    <TrendingUp size={14} className="inline mr-1" />
                  ) : cprGrowth < 0 ? (
                    <TrendingDown size={14} className="inline mr-1" />
                  ) : null}
                  {cprGrowth > 0 ? "+" : ""}
                  {cprGrowth.toFixed(1)}%
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium pt-1">
              {historyModal?.crimeName} •{" "}
              <span className="text-foreground">{historyModal?.roleName}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            {historyChartData.length === 0 ? (
              <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground bg-background rounded-lg border border-border border-dashed">
                <Database size={48} className="mb-4 opacity-50" />
                <p className="text-lg">
                  No recorded history for this user in this role.
                </p>
                <p className="text-sm opacity-70 mt-1">
                  (TornStats direct pulls are not graphed)
                </p>
              </div>
            ) : (
              <div className="h-[500px] w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={historyChartData}
                    margin={{ top: 5, right: 30, left: -20, bottom: 50 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#333"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="dateStr"
                      tick={{ fill: "#888", fontSize: 11 }}
                      tickMargin={25}
                      angle={-45}
                      textAnchor="end"
                    />
                    <YAxis
                      domain={["dataMin - 5", 100]}
                      tick={{ fill: "#888", fontSize: 11 }}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "#111",
                        borderColor: "#333",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: "#fff", fontWeight: "bold" }}
                      labelStyle={{ color: "#888", marginBottom: "4px" }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value}%`,
                        `CPR (Outcome: ${props.payload.status})`,
                      ]}
                    />
                    <Line
                      type="stepAfter"
                      dataKey="cpr"
                      stroke="#a855f7"
                      strokeWidth={3}
                      dot={{
                        r: 4,
                        fill: "#a855f7",
                        strokeWidth: 2,
                        stroke: "#111",
                      }}
                      activeDot={{ r: 6, fill: "#fff", stroke: "#a855f7" }}
                      name="CPR %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground/60 mt-4 text-center italic">
              Graph maps historical execution data cached on this device inside
              the selected date range.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
