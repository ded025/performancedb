// Indian financial year helpers (Apr -> Mar)

export type FY = string; // "FY 26-27"

export const FY_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const;
export const FY_MONTH_LABELS = [
  "Apr", "May", "Jun", "Jul", "Aug", "Sep",
  "Oct", "Nov", "Dec", "Jan", "Feb", "Mar",
];

export function getFYFromDate(d: Date | string | null | undefined): FY | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return null;
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  const startYear = m >= 4 ? y : y - 1;
  const endYear = startYear + 1;
  return `FY ${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

export function fyMonthKeys(fy: FY): string[] {
  // returns ["YYYY-MM", ...] in FY order Apr..Mar
  const m = fy.match(/FY\s*(\d{2})-(\d{2})/);
  if (!m) return [];
  const startYear = 2000 + parseInt(m[1], 10);
  const endYear = 2000 + parseInt(m[2], 10);
  const keys: string[] = [];
  for (let mm = 4; mm <= 12; mm++) keys.push(`${startYear}-${String(mm).padStart(2, "0")}`);
  for (let mm = 1; mm <= 3; mm++) keys.push(`${endYear}-${String(mm).padStart(2, "0")}`);
  return keys;
}

export function monthLabelFromKey(key: string): string {
  // "2026-04" -> "Apr 26"
  const [y, m] = key.split("-").map(Number);
  return `${FY_MONTH_LABELS[m - 1]} ${String(y).slice(-2)}`;
}

export function listFYs(fromYear = 2024, count = 6): FY[] {
  const out: FY[] = [];
  for (let i = 0; i < count; i++) {
    const s = fromYear + i;
    out.push(`FY ${String(s).slice(-2)}-${String(s + 1).slice(-2)}`);
  }
  return out;
}

export function currentFY(): FY {
  return getFYFromDate(new Date()) ?? "FY 26-27";
}

export function bucketLabel(yearlyRevenue: number, size = 50000): string {
  if (!yearlyRevenue || yearlyRevenue < 0) return "0 - " + (size - 1).toString();
  const lo = Math.floor(yearlyRevenue / size) * size;
  const hi = lo + size - 1;
  return `${lo.toLocaleString("en-IN")} - ${hi.toLocaleString("en-IN")}`;
}

export function bucketSortKey(yearlyRevenue: number, size = 50000): number {
  return Math.floor((yearlyRevenue || 0) / size);
}
