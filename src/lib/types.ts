// AP Performance Dashboard - shared types

export type Partner = {
  apCode: string; // primary key
  apName: string;
  rmName: string;
  leadStatus: string;
  status?: string;
  createdTime?: string; // ISO
  createdFY?: string; // e.g. "FY 26-27"
  commissionPct?: number; // override; if absent, use global default
};

export type MonthKey = string; // "YYYY-MM" e.g. "2026-04"

export type MonthlyAccount = {
  // composite id: `${apCode}|${month}`
  id: string;
  apCode: string;
  month: MonthKey;
  accountsOpened: number;
  firstTrades: number; // = active accounts for that month (current FY definition)
};

export type MonthlyRevenue = {
  id: string; // `${apCode}|${month}`
  apCode: string;
  month: MonthKey;
  totalBrokerage: number;
  introducerBrokerage: number; // optional, kept for reference
};

// Locked historical FY 25-26 wide-format data per AP
export type HistoricalFYRow = {
  id: string; // `${fy}|${apCode}`
  fy: string; // "FY 25-26"
  apCode: string;
  // 12 monthly buckets
  accountsByMonth: Record<MonthKey, number>;
  revenueByMonth: Record<MonthKey, number>;
  commissionByMonth: Record<MonthKey, number>;
  activeByMonth: Record<MonthKey, number>;
};

export type Settings = {
  id: "global";
  defaultCommissionPct: number; // e.g. 20 means 20%
};
