import Dexie, { type Table } from "dexie";
import type {
  Partner,
  MonthlyAccount,
  MonthlyRevenue,
  HistoricalFYRow,
  Settings,
} from "./types";

class APDashboardDB extends Dexie {
  partners!: Table<Partner, string>;
  monthlyAccounts!: Table<MonthlyAccount, string>;
  monthlyRevenue!: Table<MonthlyRevenue, string>;
  historicalFY!: Table<HistoricalFYRow, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("ap_dashboard_db");
    this.version(1).stores({
      partners: "apCode, rmName, createdFY, leadStatus",
      monthlyAccounts: "id, apCode, month",
      monthlyRevenue: "id, apCode, month",
      historicalFY: "id, fy, apCode",
      settings: "id",
    });
  }
}

export const db = new APDashboardDB();

export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get("global");
  if (existing) return existing;
  const def: Settings = { id: "global", defaultCommissionPct: 20 };
  await db.settings.put(def);
  return def;
}

export async function setDefaultCommission(pct: number) {
  await db.settings.put({ id: "global", defaultCommissionPct: pct });
}

// ---- Export / Import full backup ----
export async function exportAllJSON(): Promise<string> {
  const [partners, monthlyAccounts, monthlyRevenue, historicalFY, settings] =
    await Promise.all([
      db.partners.toArray(),
      db.monthlyAccounts.toArray(),
      db.monthlyRevenue.toArray(),
      db.historicalFY.toArray(),
      db.settings.toArray(),
    ]);
  return JSON.stringify(
    {
      _format: "ap_dashboard_v1",
      exportedAt: new Date().toISOString(),
      partners,
      monthlyAccounts,
      monthlyRevenue,
      historicalFY,
      settings,
    },
    null,
    2,
  );
}

export async function importAllJSON(json: string): Promise<{
  partners: number;
  monthlyAccounts: number;
  monthlyRevenue: number;
  historicalFY: number;
}> {
  const data = JSON.parse(json);
  if (data._format !== "ap_dashboard_v1") throw new Error("Invalid backup format");
  await db.transaction(
    "rw",
    [db.partners, db.monthlyAccounts, db.monthlyRevenue, db.historicalFY, db.settings],
    async () => {
      await Promise.all([
        db.partners.clear(),
        db.monthlyAccounts.clear(),
        db.monthlyRevenue.clear(),
        db.historicalFY.clear(),
        db.settings.clear(),
      ]);
      if (data.partners?.length) await db.partners.bulkPut(data.partners);
      if (data.monthlyAccounts?.length) await db.monthlyAccounts.bulkPut(data.monthlyAccounts);
      if (data.monthlyRevenue?.length) await db.monthlyRevenue.bulkPut(data.monthlyRevenue);
      if (data.historicalFY?.length) await db.historicalFY.bulkPut(data.historicalFY);
      if (data.settings?.length) await db.settings.bulkPut(data.settings);
    },
  );
  return {
    partners: data.partners?.length ?? 0,
    monthlyAccounts: data.monthlyAccounts?.length ?? 0,
    monthlyRevenue: data.monthlyRevenue?.length ?? 0,
    historicalFY: data.historicalFY?.length ?? 0,
  };
}

export async function clearMonthData(
  table: "monthlyAccounts" | "monthlyRevenue",
  month: string,
) {
  await db[table].where("month").equals(month).delete();
}
