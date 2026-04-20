import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useDashboardData } from "@/lib/useDashboard";
import { listFYs, currentFY, monthLabelFromKey, bucketLabel, fyMonthKeys, FY_MONTH_LABELS } from "@/lib/fy";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — AP Performance" }] }),
  component: Dashboard,
});

const fmt = (n: number) =>
  n >= 1e7
    ? `${(n / 1e7).toFixed(2)} Cr`
    : n >= 1e5
      ? `${(n / 1e5).toFixed(2)} L`
      : n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

const RM_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "hsl(280 60% 55%)",
  "hsl(20 80% 55%)",
  "hsl(160 50% 45%)",
];

function Dashboard() {
  const fys = listFYs(2024, 6);
  const [reportFY, setReportFY] = useState(currentFY());
  const [onboardingFY, setOnboardingFY] = useState<string>("ALL");
  const [rm, setRm] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const fyMonths = useMemo(() => fyMonthKeys(reportFY), [reportFY]);
  const data = useDashboardData({
    reportFY,
    onboardingFY: onboardingFY as never,
    rm,
    months: selectedMonths,
  });

  const filteredAP = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.perAP;
    return data.perAP.filter(
      (a) =>
        a.apCode.toLowerCase().includes(q) ||
        a.apName.toLowerCase().includes(q) ||
        a.rmName.toLowerCase().includes(q),
    );
  }, [data, search]);

  const monthLabel =
    selectedMonths.length === 0
      ? "All months"
      : selectedMonths.length === 1
        ? monthLabelFromKey(selectedMonths[0])
        : `${selectedMonths.length} months`;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AP Performance Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Onboarding FY filters which APs are in scope · Report FY decides whose performance is shown
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <FilterField label="Onboarding FY">
            <Select value={onboardingFY} onValueChange={setOnboardingFY}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {(data?.onboardingFYList ?? fys).map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Report FY">
            <Select
              value={reportFY}
              onValueChange={(v) => {
                setReportFY(v);
                setSelectedMonths([]);
              }}
            >
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {fys.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Months">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 w-[170px] justify-start font-normal">
                  {monthLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 space-y-2" align="end">
                <div className="flex justify-between text-xs">
                  <button
                    onClick={() => setSelectedMonths(fyMonths)}
                    className="text-primary hover:underline"
                  >
                    Select all
                  </button>
                  <button
                    onClick={() => setSelectedMonths([])}
                    className="text-muted-foreground hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {fyMonths.map((m, i) => {
                    const checked = selectedMonths.includes(m);
                    return (
                      <label key={m} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            setSelectedMonths((prev) =>
                              c ? [...prev, m] : prev.filter((x) => x !== m),
                            );
                          }}
                        />
                        {FY_MONTH_LABELS[i]}
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </FilterField>
          <FilterField label="RM">
            <Select value={rm} onValueChange={setRm}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All RMs</SelectItem>
                {(data?.rmList ?? []).map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="Partners" value={fmt(data?.totals.partners ?? 0)} />
        <KPI label="New Onboardings" value={fmt(data?.totals.newOnboardings ?? 0)} hint={reportFY} />
        <KPI label="Accounts" value={fmt(data?.totals.accounts ?? 0)} />
        <KPI label="Active Accounts" value={fmt(data?.totals.activeAccounts ?? 0)} />
        <KPI label="Revenue" value={`₹ ${fmt(data?.totals.revenue ?? 0)}`} accent />
        <KPI label="Commission" value={`₹ ${fmt(data?.totals.commission ?? 0)}`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KPI
          label="Avg Revenue / Partner"
          value={`₹ ${fmt(data?.totals.revPerPartner ?? 0)}`}
          hint="Across revenue-generating APs"
        />
        <KPI
          label="ARPU"
          value={`₹ ${fmt(data?.totals.arpu ?? 0)}`}
          hint="Revenue / Active accounts"
        />
        <KPI
          label="Activation Rate"
          value={`${(data?.totals.activationRate ?? 0).toFixed(1)}%`}
          hint="Active / Accounts opened"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Month-on-Month — {reportFY}</h2>
            <div className="text-xs text-muted-foreground">Revenue, Accounts, Active</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(data?.monthly ?? []).map((m) => ({ ...m, label: monthLabelFromKey(m.month) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v, name) => {
                    const num = Number(v) || 0;
                    return name === "Revenue" ? [`₹ ${fmt(num)}`, String(name)] : [fmt(num), String(name)];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="accounts" name="Accounts" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="active" name="Active" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Partner Onboarding</h2>
            <div className="text-xs text-muted-foreground">By month · {reportFY}</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={(data?.monthly ?? []).map((m) => ({ ...m, label: monthLabelFromKey(m.month) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="onboardings" name="New Partners" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold">RM-wise Revenue (Stacked) — {reportFY}</h2>
            <p className="text-xs text-muted-foreground">Top {data?.rmNames.length ?? 0} RMs by revenue</p>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={(data?.rmMonthly ?? []).map((m) => ({ ...m, label: monthLabelFromKey(m.month as string) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `₹ ${fmt(Number(v) || 0)}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {(data?.rmNames ?? []).map((rmName, i) => (
                <Bar
                  key={rmName}
                  dataKey={rmName}
                  stackId="rm"
                  fill={RM_COLORS[i % RM_COLORS.length]}
                  radius={i === (data?.rmNames.length ?? 0) - 1 ? [4, 4, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold">RM Pivot — {reportFY}</h2>
            <p className="text-xs text-muted-foreground">Sum of accounts, active, revenue, commission and contribution</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RM Name</TableHead>
                <TableHead className="text-right">Partners</TableHead>
                <TableHead className="text-right">Accounts</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">% Contribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.byRM ?? []).map((r) => (
                <TableRow key={r.rmName}>
                  <TableCell className="font-medium">{r.rmName}</TableCell>
                  <TableCell className="text-right">{fmt(r.partners)}</TableCell>
                  <TableCell className="text-right">{fmt(r.accounts)}</TableCell>
                  <TableCell className="text-right">{fmt(r.activeAccounts)}</TableCell>
                  <TableCell className="text-right">₹ {fmt(r.revenue)}</TableCell>
                  <TableCell className="text-right">₹ {fmt(r.commission)}</TableCell>
                  <TableCell className="text-right">{r.contributionPct.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
              {(!data || data.byRM.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    No data for selected filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold">AP Performance — {reportFY}</h2>
            <p className="text-xs text-muted-foreground">Bucket = floor(yearly revenue / 50,000)</p>
          </div>
          <Input
            placeholder="Search AP code, name, RM…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs h-9"
          />
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>AP Code</TableHead>
                <TableHead>AP Name</TableHead>
                <TableHead>RM</TableHead>
                <TableHead>Onb FY</TableHead>
                <TableHead className="text-right">Accounts</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead>Bucket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAP.map((a) => (
                <TableRow key={a.apCode}>
                  <TableCell className="font-mono text-xs">{a.apCode}</TableCell>
                  <TableCell>{a.apName}</TableCell>
                  <TableCell>{a.rmName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.createdFY ?? "—"}</TableCell>
                  <TableCell className="text-right">{fmt(a.accounts)}</TableCell>
                  <TableCell className="text-right">{fmt(a.activeAccounts)}</TableCell>
                  <TableCell className="text-right">₹ {fmt(a.revenue)}</TableCell>
                  <TableCell className="text-right">₹ {fmt(a.commission)}</TableCell>
                  <TableCell className="text-xs">{bucketLabel(a.revenue)}</TableCell>
                </TableRow>
              ))}
              {filteredAP.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                    No APs to show. Upload data from the Uploads tab.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function KPI({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Card className={"p-4 " + (accent ? "bg-accent/40 border-primary/30" : "")}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  );
}
