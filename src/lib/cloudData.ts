import { supabase } from "@/integrations/supabase/client";
import type {
  Partner,
  MonthlyAccount,
  MonthlyRevenue,
  HistoricalFYRow,
  Settings,
} from "./types";

// ---------- Row mappers (DB snake_case <-> app camelCase) ----------
type PartnerRow = {
  ap_code: string;
  ap_name: string;
  rm_name: string;
  lead_status: string;
  status: string | null;
  created_time: string | null;
  created_fy: string | null;
  commission_pct: number | null;
};

const partnerToRow = (p: Partner) => ({
  ap_code: p.apCode,
  ap_name: p.apName,
  rm_name: p.rmName ?? "",
  lead_status: p.leadStatus ?? "",
  status: p.status ?? null,
  created_time: p.createdTime ?? null,
  created_fy: p.createdFY ?? null,
  commission_pct: p.commissionPct ?? null,
});

const rowToPartner = (r: PartnerRow): Partner => ({
  apCode: r.ap_code,
  apName: r.ap_name,
  rmName: r.rm_name,
  leadStatus: r.lead_status,
  status: r.status ?? undefined,
  createdTime: r.created_time ?? undefined,
  createdFY: r.created_fy ?? undefined,
  commissionPct: r.commission_pct ?? undefined,
});

export async function fetchPartners(): Promise<Partner[]> {
  let allPartners: PartnerRow[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("partners")
      .select("*")
      .range(from, from + pageSize - 1)
      .order("ap_code", { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allPartners = [...allPartners, ...(data as PartnerRow[])];
      from += pageSize;
      
      if (data.length < pageSize) {
        hasMore = false;
      }
    }
  }

  return allPartners.map((r) => rowToPartner(r));
}

export async function upsertPartners(partners: Partner[]) {
  if (!partners.length) return;
  const rows = partners.map(partnerToRow);
  // chunk to avoid payload limits
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from("partners").upsert(chunk, { onConflict: "ap_code" });
    if (error) throw error;
  }
}

export async function clearPartners() {
  const { error } = await supabase.from("partners").delete().neq("ap_code", "__never__");
  if (error) throw error;
}

// ---------- Monthly Accounts ----------
export async function fetchMonthlyAccounts(): Promise<MonthlyAccount[]> {
  const { data, error } = await supabase.from("monthly_accounts").select("*");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    apCode: r.ap_code,
    month: r.month,
    accountsOpened: r.accounts_opened,
    firstTrades: r.first_trades,
  }));
}

export async function replaceMonthlyAccounts(month: string, recs: MonthlyAccount[]) {
  const { error: delErr } = await supabase.from("monthly_accounts").delete().eq("month", month);
  if (delErr) throw delErr;
  if (!recs.length) return;
  const rows = recs.map((r) => ({
    id: r.id,
    ap_code: r.apCode,
    month: r.month,
    accounts_opened: r.accountsOpened,
    first_trades: r.firstTrades,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("monthly_accounts").upsert(rows.slice(i, i + 500), { onConflict: "id" });
    if (error) throw error;
  }
}

export async function clearAllMonthlyAccounts() {
  const { error } = await supabase.from("monthly_accounts").delete().neq("id", "__never__");
  if (error) throw error;
}

// ---------- Monthly Revenue ----------
export async function fetchMonthlyRevenue(): Promise<MonthlyRevenue[]> {
  const { data, error } = await supabase.from("monthly_revenue").select("*");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    apCode: r.ap_code,
    month: r.month,
    totalBrokerage: Number(r.total_brokerage),
    introducerBrokerage: Number(r.introducer_brokerage),
  }));
}

export async function replaceMonthlyRevenue(month: string, recs: MonthlyRevenue[]) {
  const { error: delErr } = await supabase.from("monthly_revenue").delete().eq("month", month);
  if (delErr) throw delErr;
  if (!recs.length) return;
  const rows = recs.map((r) => ({
    id: r.id,
    ap_code: r.apCode,
    month: r.month,
    total_brokerage: r.totalBrokerage,
    introducer_brokerage: r.introducerBrokerage,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("monthly_revenue").upsert(rows.slice(i, i + 500), { onConflict: "id" });
    if (error) throw error;
  }
}

export async function clearAllMonthlyRevenue() {
  const { error } = await supabase.from("monthly_revenue").delete().neq("id", "__never__");
  if (error) throw error;
}

// ---------- Historical FY ----------
export async function fetchHistoricalFY(fy: string): Promise<HistoricalFYRow[]> {
  const { data, error } = await supabase.from("historical_fy").select("*").eq("fy", fy);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    fy: r.fy,
    apCode: r.ap_code,
    accountsByMonth: (r.accounts_by_month ?? {}) as Record<string, number>,
    revenueByMonth: (r.revenue_by_month ?? {}) as Record<string, number>,
    commissionByMonth: (r.commission_by_month ?? {}) as Record<string, number>,
    activeByMonth: (r.active_by_month ?? {}) as Record<string, number>,
  }));
}

export async function replaceHistoricalFY(fy: string, recs: HistoricalFYRow[]) {
  const { error: delErr } = await supabase.from("historical_fy").delete().eq("fy", fy);
  if (delErr) throw delErr;
  if (!recs.length) return;
  const rows = recs.map((r) => ({
    id: r.id,
    fy: r.fy,
    ap_code: r.apCode,
    accounts_by_month: r.accountsByMonth,
    revenue_by_month: r.revenueByMonth,
    commission_by_month: r.commissionByMonth,
    active_by_month: r.activeByMonth,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from("historical_fy").upsert(rows.slice(i, i + 200), { onConflict: "id" });
    if (error) throw error;
  }
}

export async function clearHistoricalFY(fy: string) {
  const { error } = await supabase.from("historical_fy").delete().eq("fy", fy);
  if (error) throw error;
}

// ---------- Settings ----------
export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase.from("app_settings").select("*").eq("id", "global").maybeSingle();
  if (error) throw error;
  if (!data) return { id: "global", defaultCommissionPct: 20 };
  return { id: "global", defaultCommissionPct: Number(data.default_commission_pct) };
}

export async function saveDefaultCommission(pct: number) {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: "global", default_commission_pct: pct }, { onConflict: "id" });
  if (error) throw error;
}

// ---------- Backup / Restore ----------
export async function exportAllJSON(): Promise<string> {
  const [partners, ma, mr, hist2526, settings] = await Promise.all([
    fetchPartners(),
    fetchMonthlyAccounts(),
    fetchMonthlyRevenue(),
    fetchHistoricalFY("FY 25-26"),
    fetchSettings(),
  ]);
  return JSON.stringify(
    {
      _format: "ap_dashboard_v1",
      exportedAt: new Date().toISOString(),
      partners,
      monthlyAccounts: ma,
      monthlyRevenue: mr,
      historicalFY: hist2526,
      settings: [settings],
    },
    null,
    2,
  );
}

export async function importAllJSON(json: string) {
  const data = JSON.parse(json);
  if (data._format !== "ap_dashboard_v1") throw new Error("Invalid backup format");

  // Clear all
  await Promise.all([
    clearPartners(),
    clearAllMonthlyAccounts(),
    clearAllMonthlyRevenue(),
    clearHistoricalFY("FY 25-26"),
  ]);

  if (data.partners?.length) await upsertPartners(data.partners);

  // group monthly accounts by month
  const maByMonth = new Map<string, MonthlyAccount[]>();
  for (const r of data.monthlyAccounts ?? []) {
    const arr = maByMonth.get(r.month) ?? [];
    arr.push(r);
    maByMonth.set(r.month, arr);
  }
  for (const [m, recs] of maByMonth) await replaceMonthlyAccounts(m, recs);

  const mrByMonth = new Map<string, MonthlyRevenue[]>();
  for (const r of data.monthlyRevenue ?? []) {
    const arr = mrByMonth.get(r.month) ?? [];
    arr.push(r);
    mrByMonth.set(r.month, arr);
  }
  for (const [m, recs] of mrByMonth) await replaceMonthlyRevenue(m, recs);

  if (data.historicalFY?.length) await replaceHistoricalFY("FY 25-26", data.historicalFY);

  if (data.settings?.[0]?.defaultCommissionPct != null) {
    await saveDefaultCommission(data.settings[0].defaultCommissionPct);
  }

  return {
    partners: data.partners?.length ?? 0,
    monthlyAccounts: data.monthlyAccounts?.length ?? 0,
    monthlyRevenue: data.monthlyRevenue?.length ?? 0,
    historicalFY: data.historicalFY?.length ?? 0,
  };
}
