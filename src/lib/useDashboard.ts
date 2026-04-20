import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Partner } from "@/lib/types";
import { fyMonthKeys, type FY } from "@/lib/fy";

export type APYearly = {
  apCode: string;
  apName: string;
  rmName: string;
  createdFY?: string;
  leadStatus: string;
  accounts: number;
  activeAccounts: number;
  revenue: number;
  commission: number;
  monthly: {
    month: string;
    accounts: number;
    active: number;
    revenue: number;
    commission: number;
  }[];
};

export type DashboardFilters = {
  reportFY: FY;
  onboardingFY: FY | "ALL";
  rm: string | "ALL";
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
    partners: number;
    contributionPct: number;
  }[];
  monthly: {
    month: string;
    accounts: number;
    active: number;
    revenue: number;
    commission: number;
    onboardings: number;
  }[];
  totals: {
    accounts: number;
    activeAccounts: number;
    revenue: number;
    commission: number;
    partners: number;
    newOnboardings: number;
  };
  rmList: string[];
  onboardingFYList: string[];
};

export function useDashboardData(filters: DashboardFilters): DashboardData | undefined {
  return useLiveQuery(async () => {
    const [allPartners, settingsRow, allHistorical] = await Promise.all([
      db.partners.toArray(),
      db.settings.get("global"),
      db.historicalFY.where("fy").equals(filters.reportFY).toArray(),
    ]);
    const settings = settingsRow ?? { id: "global" as const, defaultCommissionPct: 20 };

    const months = fyMonthKeys(filters.reportFY);

    // Filter partner set by Onboarding FY + RM
    const partnersFiltered = allPartners.filter((p) => {
      if (filters.onboardingFY !== "ALL" && p.createdFY !== filters.onboardingFY) return false;
      if (filters.rm !== "ALL" && p.rmName !== filters.rm) return false;
      return true;
    });
    const partnerByCode = new Map(allPartners.map((p) => [p.apCode, p]));

    // Pull current-FY monthly data only if reportFY != FY 25-26 (historical is locked separate)
    const isHistorical = filters.reportFY === "FY 25-26" && allHistorical.length > 0;

    const accountsByAPMonth = new Map<string, { opened: number; firstTrades: number }>();
    const revenueByAPMonth = new Map<string, { rev: number }>();

    if (!isHistorical) {
      const [acc, rev] = await Promise.all([
        db.monthlyAccounts.where("month").anyOf(months).toArray(),
        db.monthlyRevenue.where("month").anyOf(months).toArray(),
      ]);
      for (const a of acc)
        accountsByAPMonth.set(`${a.apCode}|${a.month}`, {
          opened: a.accountsOpened,
          firstTrades: a.firstTrades,
        });
      for (const r of rev) revenueByAPMonth.set(`${r.apCode}|${r.month}`, { rev: r.totalBrokerage });
    }

    // Build APYearly. The "AP universe" for the report = union of (filtered partners) and APs that have data this FY
    const apCodesInScope = new Set<string>(partnersFiltered.map((p) => p.apCode));
    if (isHistorical) {
      for (const h of allHistorical) {
        const p = partnerByCode.get(h.apCode);
        if (filters.onboardingFY !== "ALL" && p?.createdFY !== filters.onboardingFY) continue;
        if (filters.rm !== "ALL" && p?.rmName !== filters.rm) continue;
        apCodesInScope.add(h.apCode);
      }
    } else {
      for (const k of accountsByAPMonth.keys()) {
        const ap = k.split("|")[0];
        const p = partnerByCode.get(ap);
        if (filters.onboardingFY !== "ALL" && p?.createdFY !== filters.onboardingFY) continue;
        if (filters.rm !== "ALL" && p?.rmName !== filters.rm) continue;
        apCodesInScope.add(ap);
      }
      for (const k of revenueByAPMonth.keys()) {
        const ap = k.split("|")[0];
        const p = partnerByCode.get(ap);
        if (filters.onboardingFY !== "ALL" && p?.createdFY !== filters.onboardingFY) continue;
        if (filters.rm !== "ALL" && p?.rmName !== filters.rm) continue;
        apCodesInScope.add(ap);
      }
    }

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
          const pct = p?.commissionPct ?? settings.defaultCommissionPct;
          commission = (revenue * pct) / 100;
        }
        return { month: m, accounts, active, revenue, commission };
      });
      perAP.push({
        apCode,
        apName: p?.apName ?? apCode,
        rmName: p?.rmName ?? "—",
        createdFY: p?.createdFY,
        leadStatus: p?.leadStatus ?? "",
        accounts: monthlyArr.reduce((s, x) => s + x.accounts, 0),
        activeAccounts: monthlyArr.reduce((s, x) => s + x.active, 0),
        revenue: monthlyArr.reduce((s, x) => s + x.revenue, 0),
        commission: monthlyArr.reduce((s, x) => s + x.commission, 0),
        monthly: monthlyArr,
      });
    }

    const totalRevenue = perAP.reduce((s, x) => s + x.revenue, 0);
    const rmMap = new Map<
      string,
      {
        accounts: number;
        activeAccounts: number;
        revenue: number;
        commission: number;
        partners: number;
      }
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

    // monthly aggregate (for MoM chart). Onboardings = partners whose createdTime falls in that month.
    const monthly = months.map((m) => {
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

    const totals = {
      accounts: perAP.reduce((s, x) => s + x.accounts, 0),
      activeAccounts: perAP.reduce((s, x) => s + x.activeAccounts, 0),
      revenue: totalRevenue,
      commission: perAP.reduce((s, x) => s + x.commission, 0),
      partners: perAP.length,
      newOnboardings: monthly.reduce((s, x) => s + x.onboardings, 0),
    };

    const rmList = Array.from(new Set(allPartners.map((p) => p.rmName).filter(Boolean))).sort();
    const onboardingFYList = Array.from(
      new Set(allPartners.map((p) => p.createdFY).filter((x): x is string => !!x)),
    ).sort();

    return {
      partners: partnersFiltered,
      perAP: perAP.sort((a, b) => b.revenue - a.revenue),
      byRM,
      monthly,
      totals,
      rmList,
      onboardingFYList,
    };
  }, [filters.reportFY, filters.onboardingFY, filters.rm]);
}
