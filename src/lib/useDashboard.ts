import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPartners,
  fetchMonthlyAccounts,
  fetchMonthlyRevenue,
  fetchHistoricalFY,
  fetchSettings,
} from "@/lib/cloudData";
import type { Partner } from "@/lib/types";
import { fyMonthKeys, type FY } from "@/lib/fy";
import { useAuth } from "@/lib/auth";

export type APYearly = {
  apCode: string;
  apName: string;
  rmName: string;
  createdFY?: string;
  createdTime?: string;
  leadStatus: string;
  accounts: number;
  activeAccounts: number;
  revenue: number;
  commission: number;
  orders: number;
  monthly: {
    month: string;
    accounts: number;
    active: number;
    revenue: number;
    commission: number;
    orders: number;
  }[];
};

export type DashboardFilters = {
  reportFY: FY;
  onboardingFY: FY | "ALL";
  rm: string | "ALL";
  months?: string[];
};

export type DashboardData = {
  partners: Partner[];
  perAP: APYearly[];
  byRM: {
    rmName: string;
    accounts: number;
    activeAccounts: number;
    revenue: number;
    commission: number;
    orders: number;
    partners: number;
    contributionPct: number;
  }[];
  rmMonthly: { month: string; [rmName: string]: number | string }[];
  rmNames: string[];
  monthly: {
    month: string;
    accounts: number;
    active: number;
    revenue: number;
    commission: number;
    onboardings: number;
    orders: number;
  }[];
  totals: {
    accounts: number;
    activeAccounts: number;
    revenue: number;
    commission: number;
    orders: number;
    partners: number;
    newOnboardings: number;
    arpu: number;
    revPerPartner: number;
    activationRate: number;
  };
  rmList: string[];
  onboardingFYList: string[];
};

// Slab-based commission rate on monthly revenue per AP
function commissionRate(monthlyRevenue: number): number {
  if (monthlyRevenue <= 99999) return 0.3;
  if (monthlyRevenue <= 199999) return 0.4;
  return 0.5;
}

const REVENUE_PER_ORDER = 20;

export function useInvalidateData() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["partners"] });
    qc.invalidateQueries({ queryKey: ["monthlyAccounts"] });
    qc.invalidateQueries({ queryKey: ["monthlyRevenue"] });
    qc.invalidateQueries({ queryKey: ["historicalFY"] });
    qc.invalidateQueries({ queryKey: ["settings"] });
  };
}

export function useDashboardData(filters: DashboardFilters): DashboardData | undefined {
  const { isAuthed } = useAuth();
  const enabled = isAuthed;

  const partnersQ = useQuery({ queryKey: ["partners"], queryFn: fetchPartners, enabled });
  const accountsQ = useQuery({ queryKey: ["monthlyAccounts"], queryFn: fetchMonthlyAccounts, enabled });
  const revenueQ = useQuery({ queryKey: ["monthlyRevenue"], queryFn: fetchMonthlyRevenue, enabled });
  const historicalQ = useQuery({
    queryKey: ["historicalFY", filters.reportFY],
    queryFn: () => fetchHistoricalFY(filters.reportFY),
    enabled,
  });
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: fetchSettings, enabled });

  if (
    !partnersQ.data ||
    !accountsQ.data ||
    !revenueQ.data ||
    !historicalQ.data ||
    !settingsQ.data
  )
    return undefined;

  const allPartners = partnersQ.data;
  const allMA = accountsQ.data;
  const allMR = revenueQ.data;
  const allHistorical = historicalQ.data;
  const settings = settingsQ.data;

  const months = fyMonthKeys(filters.reportFY);
  const monthSet = new Set(months);

  const partnersFiltered = allPartners.filter((p) => {
    if (filters.onboardingFY !== "ALL" && p.createdFY !== filters.onboardingFY) return false;
    if (filters.rm !== "ALL" && p.rmName !== filters.rm) return false;
    return true;
  });
  const partnerByCode = new Map(allPartners.map((p) => [p.apCode, p]));

  const isHistorical = filters.reportFY === "FY 25-26" && allHistorical.length > 0;

  const accountsByAPMonth = new Map<string, { opened: number; firstTrades: number }>();
  const revenueByAPMonth = new Map<string, { rev: number }>();

  // Restrict to AP codes that exist in the partner master (single source of truth)
  const masterApCodes = new Set(allPartners.map((p) => p.apCode));

  if (!isHistorical) {
    for (const a of allMA) {
      if (!monthSet.has(a.month)) continue;
      if (!masterApCodes.has(a.apCode)) continue;
      accountsByAPMonth.set(`${a.apCode}|${a.month}`, {
        opened: a.accountsOpened,
        firstTrades: a.firstTrades,
      });
    }
    for (const r of allMR) {
      if (!monthSet.has(r.month)) continue;
      if (!masterApCodes.has(r.apCode)) continue;
      revenueByAPMonth.set(`${r.apCode}|${r.month}`, { rev: r.totalBrokerage });
    }
  }

  // Source of truth: partner master. Only include APs that exist there.
  const apCodesInScope = new Set<string>(partnersFiltered.map((p) => p.apCode));
  if (isHistorical) {
    for (const h of allHistorical) {
      if (!masterApCodes.has(h.apCode)) continue;
      const p = partnerByCode.get(h.apCode);
      if (filters.onboardingFY !== "ALL" && p?.createdFY !== filters.onboardingFY) continue;
      if (filters.rm !== "ALL" && p?.rmName !== filters.rm) continue;
      apCodesInScope.add(h.apCode);
    }
  }

  const selectedMonthSet =
    filters.months && filters.months.length > 0
      ? new Set(filters.months.filter((m) => monthSet.has(m)))
      : new Set(months);

  const inScopeMonth = (m: string) => selectedMonthSet.has(m);

  const perAP: APYearly[] = [];
  for (const apCode of apCodesInScope) {
    const p = partnerByCode.get(apCode);
    const monthlyArr = months.map((m) => {
      let accounts = 0;
      let active = 0;
      let revenue = 0;
      let commission = 0;
      if (isHistorical) {
        const h = allHistorical.find((x) => x.apCode === apCode);
        if (h) {
          accounts = h.accountsByMonth[m] ?? 0;
          active = h.activeByMonth[m] ?? 0;
          revenue = h.revenueByMonth[m] ?? 0;
          commission = h.commissionByMonth[m] ?? 0;
        }
      } else {
        const a = accountsByAPMonth.get(`${apCode}|${m}`);
        const r = revenueByAPMonth.get(`${apCode}|${m}`);
        accounts = a?.opened ?? 0;
        active = a?.firstTrades ?? 0;
        revenue = r?.rev ?? 0;
        if (p?.commissionPct != null) {
          commission = (revenue * p.commissionPct) / 100;
        } else {
          commission = revenue * commissionRate(revenue);
        }
      }
      const orders = revenue > 0 ? revenue / REVENUE_PER_ORDER : 0;
      return { month: m, accounts, active, revenue, commission, orders };
    });
    const filteredMonthly = monthlyArr.filter((x) => inScopeMonth(x.month));
    perAP.push({
      apCode,
      apName: p?.apName ?? apCode,
      rmName: p?.rmName ?? "—",
      createdFY: p?.createdFY,
      createdTime: p?.createdTime,
      leadStatus: p?.leadStatus ?? "",
      accounts: filteredMonthly.reduce((s, x) => s + x.accounts, 0),
      activeAccounts: filteredMonthly.reduce((s, x) => s + x.active, 0),
      revenue: filteredMonthly.reduce((s, x) => s + x.revenue, 0),
      commission: filteredMonthly.reduce((s, x) => s + x.commission, 0),
      orders: filteredMonthly.reduce((s, x) => s + x.orders, 0),
      monthly: monthlyArr,
    });
  }

  const totalRevenue = perAP.reduce((s, x) => s + x.revenue, 0);
  const rmMap = new Map<
    string,
    { accounts: number; activeAccounts: number; revenue: number; commission: number; partners: number }
  >();
  for (const ap of perAP) {
    const key = ap.rmName || "—";
    const cur = rmMap.get(key) ?? {
      accounts: 0,
      activeAccounts: 0,
      revenue: 0,
      commission: 0,
      partners: 0,
    };
    cur.accounts += ap.accounts;
    cur.activeAccounts += ap.activeAccounts;
    cur.revenue += ap.revenue;
    cur.commission += ap.commission;
    cur.partners += 1;
    rmMap.set(key, cur);
  }
  const byRM = Array.from(rmMap.entries())
    .map(([rmName, v]) => ({
      rmName,
      ...v,
      contributionPct: totalRevenue > 0 ? (v.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const rmNames = byRM.slice(0, 8).map((r) => r.rmName);

  const monthly = months
    .filter(inScopeMonth)
    .map((m) => {
      const acc = perAP.reduce((s, x) => s + (x.monthly.find((mm) => mm.month === m)?.accounts ?? 0), 0);
      const active = perAP.reduce((s, x) => s + (x.monthly.find((mm) => mm.month === m)?.active ?? 0), 0);
      const rev = perAP.reduce((s, x) => s + (x.monthly.find((mm) => mm.month === m)?.revenue ?? 0), 0);
      const com = perAP.reduce((s, x) => s + (x.monthly.find((mm) => mm.month === m)?.commission ?? 0), 0);
      const onboardings = allPartners.filter((p) => {
        if (!p.createdTime) return false;
        const mk = p.createdTime.slice(0, 7);
        if (mk !== m) return false;
        if (filters.rm !== "ALL" && p.rmName !== filters.rm) return false;
        return true;
      }).length;
      return { month: m, accounts: acc, active, revenue: rev, commission: com, onboardings };
    });

  const rmMonthly = months
    .filter(inScopeMonth)
    .map((m) => {
      const row: { month: string; [k: string]: number | string } = { month: m };
      for (const rmName of rmNames) {
        row[rmName] = perAP
          .filter((ap) => (ap.rmName || "—") === rmName)
          .reduce((s, ap) => s + (ap.monthly.find((mm) => mm.month === m)?.revenue ?? 0), 0);
      }
      return row;
    });

  const totalAccounts = perAP.reduce((s, x) => s + x.accounts, 0);
  const totalActive = perAP.reduce((s, x) => s + x.activeAccounts, 0);
  const partnersWithRev = perAP.filter((x) => x.revenue > 0).length;

  const totals = {
    accounts: totalAccounts,
    activeAccounts: totalActive,
    revenue: totalRevenue,
    commission: perAP.reduce((s, x) => s + x.commission, 0),
    partners: perAP.length,
    newOnboardings: monthly.reduce((s, x) => s + x.onboardings, 0),
    arpu: totalActive > 0 ? totalRevenue / totalActive : 0,
    revPerPartner: partnersWithRev > 0 ? totalRevenue / partnersWithRev : 0,
    activationRate: totalAccounts > 0 ? (totalActive / totalAccounts) * 100 : 0,
  };

  const rmList = Array.from(new Set(allPartners.map((p) => p.rmName).filter(Boolean))).sort();
  const onboardingFYList = Array.from(
    new Set(allPartners.map((p) => p.createdFY).filter((x): x is string => !!x)),
  ).sort();

  return {
    partners: partnersFiltered,
    perAP: perAP.sort((a, b) => b.revenue - a.revenue),
    byRM,
    rmMonthly,
    rmNames,
    monthly,
    totals,
    rmList,
    onboardingFYList,
  };
}
