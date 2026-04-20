import * as XLSX from "xlsx";
import type {
  Partner,
  MonthlyAccount,
  MonthlyRevenue,
  HistoricalFYRow,
  MonthKey,
} from "./types";
import { getFYFromDate } from "./fy";

export async function readSheetRows(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    for (const actual of Object.keys(row)) {
      if (actual.trim().toLowerCase() === k.trim().toLowerCase()) return row[actual];
    }
  }
  return undefined;
}

function toNum(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

// ---------- Partner Master ----------
export function parsePartners(rows: Record<string, unknown>[]): Partner[] {
  return rows
    .map((r) => {
      const apCode = toStr(pick(r, ["AP Code", "AP_Code", "ApCode", "Code"]));
      if (!apCode) return null;
      const created = toDate(pick(r, ["Created Time", "Created Date", "Onboarding Date"]));
      return {
        apCode,
        apName: toStr(pick(r, ["AP Name", "Partner Name", "Name"])),
        rmName: toStr(pick(r, ["RM Name", "RM"])),
        leadStatus: toStr(pick(r, ["Lead Status", "LeadStatus", "Status"])),
        status: toStr(pick(r, ["Status"])),
        createdTime: created ? created.toISOString() : undefined,
        createdFY: getFYFromDate(created) ?? undefined,
        commissionPct: (() => {
          const v = pick(r, ["Commission %", "Commission Pct", "Commission"]);
          if (v === "" || v == null) return undefined;
          const n = toNum(v);
          return isNaN(n) ? undefined : n;
        })(),
      } as Partner;
    })
    .filter((p): p is Partner => !!p);
}

// ---------- Accounts (monthly) ----------
// Sub source = AP Code. We compute per-AP for the chosen month:
//   accountsOpened = count(rows where account opened date in month)
//   firstTrades    = count(rows where first trade date in month)  [== active]
export function parseAccountsForMonth(
  rows: Record<string, unknown>[],
  month: MonthKey,
): MonthlyAccount[] {
  const map = new Map<string, { opened: number; firstTrades: number }>();
  for (const r of rows) {
    const ap = toStr(pick(r, ["Sub source", "Sub Source", "SubSource", "AP Code"]));
    if (!ap) continue;
    const opened = toDate(pick(r, ["Account opened date", "Account Opened Date", "Opened Date"]));
    const ft = toDate(pick(r, ["First trade date", "First Trade Date", "FT Date"]));
    const cur = map.get(ap) ?? { opened: 0, firstTrades: 0 };
    if (opened && monthKey(opened) === month) cur.opened += 1;
    if (ft && monthKey(ft) === month) cur.firstTrades += 1;
    map.set(ap, cur);
  }
  return Array.from(map.entries())
    .filter(([, v]) => v.opened > 0 || v.firstTrades > 0)
    .map(([apCode, v]) => ({
      id: `${apCode}|${month}`,
      apCode,
      month,
      accountsOpened: v.opened,
      firstTrades: v.firstTrades,
    }));
}

// ---------- Revenue (monthly) ----------
// Client ID contains the AP code (alphanumeric prefix). We extract the leading
// alphanumeric token from the Client ID. Falls back to AP Code/Sub source columns
// if explicitly provided.
function extractApFromClientId(v: unknown): string {
  const s = toStr(v);
  if (!s) return "";
  // Try common patterns: "AP1234-56789", "AP1234_56789", "AP1234/56789", "AP1234 56789"
  const m = s.match(/^([A-Za-z]*\d+|[A-Za-z0-9]+?)[-_/\s.]/);
  if (m) return m[1];
  // No separator — assume the whole string IS the AP code
  return s;
}

export function parseRevenueForMonth(
  rows: Record<string, unknown>[],
  month: MonthKey,
): MonthlyRevenue[] {
  const map = new Map<string, { tot: number; intro: number }>();
  for (const r of rows) {
    let ap = toStr(pick(r, ["AP Code", "Sub source", "Sub Source", "SubSource"]));
    if (!ap) {
      ap = extractApFromClientId(pick(r, ["Client Id", "Client ID", "ClientId", "Client_Id"]));
    }
    if (!ap) continue;
    const tot = toNum(pick(r, ["Total Brk", "Total Brokerage", "Total_Brk"]));
    const intro = toNum(pick(r, ["Introducer Brk", "Introducer Brokerage", "Intro Brk"]));
    const cur = map.get(ap) ?? { tot: 0, intro: 0 };
    cur.tot += tot;
    cur.intro += intro;
    map.set(ap, cur);
  }
  return Array.from(map.entries()).map(([apCode, v]) => ({
    id: `${apCode}|${month}`,
    apCode,
    month,
    totalBrokerage: v.tot,
    introducerBrokerage: v.intro,
  }));
}

// ---------- FY 25-26 historical wide format ----------
// Columns: Apr(25)..Mar(25) (=accounts), Apr(25)r..Mar(25)r (=revenue),
//          Apr(25)c..Mar(25)c (=commission), Apr(25)A..Mar(25)A (=active accounts)
const HIST_MONTHS: { label: string; key: string }[] = [
  { label: "Apr", key: "2025-04" },
  { label: "May", key: "2025-05" },
  { label: "Jun", key: "2025-06" },
  { label: "Jul", key: "2025-07" },
  { label: "Aug", key: "2025-08" },
  { label: "Sep", key: "2025-09" },
  { label: "Oct", key: "2025-10" },
  { label: "Nov", key: "2025-11" },
  { label: "Dec", key: "2025-12" },
  { label: "Jan", key: "2026-01" },
  { label: "Feb", key: "2026-02" },
  { label: "Mar", key: "2026-03" },
];

function findMonthCol(
  row: Record<string, unknown>,
  label: string,
  suffix: "" | "r" | "c" | "A",
): unknown {
  const variants = [
    `${label}(25)${suffix}`,
    `${label.toLowerCase()}(25)${suffix}`,
    `${label}25${suffix}`,
  ];
  // also handle "June" vs "Jun", "Sept" vs "Sep", "August" vs "Aug"
  const longMap: Record<string, string[]> = {
    Jun: ["June"],
    Aug: ["August"],
    Sep: ["Sept", "September"],
  };
  if (longMap[label]) for (const l of longMap[label]) variants.push(`${l}(25)${suffix}`);
  // tolerate weird spaces / case
  for (const actual of Object.keys(row)) {
    const norm = actual.replace(/\s+/g, "").toLowerCase();
    for (const v of variants) {
      if (norm === v.replace(/\s+/g, "").toLowerCase()) return row[actual];
    }
  }
  return undefined;
}

export function parseHistoricalFY2526(
  rows: Record<string, unknown>[],
): { partners: Partner[]; historical: HistoricalFYRow[] } {
  const partners: Partner[] = [];
  const historical: HistoricalFYRow[] = [];
  for (const r of rows) {
    const apCode = toStr(pick(r, ["AP Code"]));
    if (!apCode) continue;
    const created = toDate(pick(r, ["Created Time"]));
    const partner: Partner = {
      apCode,
      apName: toStr(pick(r, ["AP Name"])),
      rmName: toStr(pick(r, ["RM Name"])),
      leadStatus: toStr(pick(r, ["Lead Status", "Status"])),
      status: toStr(pick(r, ["Status"])),
      createdTime: created ? created.toISOString() : undefined,
      createdFY:
        toStr(pick(r, ["FY Created Year", "Created FY"])) ||
        getFYFromDate(created) ||
        undefined,
    };
    partners.push(partner);

    const accountsByMonth: Record<string, number> = {};
    const revenueByMonth: Record<string, number> = {};
    const commissionByMonth: Record<string, number> = {};
    const activeByMonth: Record<string, number> = {};
    for (const m of HIST_MONTHS) {
      accountsByMonth[m.key] = toNum(findMonthCol(r, m.label, ""));
      revenueByMonth[m.key] = toNum(findMonthCol(r, m.label, "r"));
      commissionByMonth[m.key] = toNum(findMonthCol(r, m.label, "c"));
      activeByMonth[m.key] = toNum(findMonthCol(r, m.label, "A"));
    }
    historical.push({
      id: `FY 25-26|${apCode}`,
      fy: "FY 25-26",
      apCode,
      accountsByMonth,
      revenueByMonth,
      commissionByMonth,
      activeByMonth,
    });
  }
  return { partners, historical };
}

function monthKey(d: Date): MonthKey {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthKeyFromDate(d: Date): MonthKey {
  return monthKey(d);
}
