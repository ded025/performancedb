import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useDashboardData } from "@/lib/useDashboard";
import { listFYs, currentFY, monthLabelFromKey, bucketLabel } from "@/lib/fy";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function Dashboard() {
  const fys = listFYs(2024, 6);
  const [reportFY, setReportFY] = useState(currentFY());
  const [onboardingFY, setOnboardingFY] = useState<string>("ALL");
  const [rm, setRm] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const data = useDashboardData({ reportFY, onboardingFY: onboardingFY as never, rm });

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
            <Select value={reportFY} onValueChange={setReportFY}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {fys.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Month-on-Month — {reportFY}</h2>
            <div className="text-xs text-muted-foreground">Revenue & Accounts</div>
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
                <Line yAxisId="right" type="monotone" dataKey="active" name="Active" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
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
