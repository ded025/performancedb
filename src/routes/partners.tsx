import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchPartners, clearPartners } from "@/lib/cloudData";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useInvalidateData } from "@/lib/useDashboard";
import { FY_MONTH_LABELS } from "@/lib/fy";

export const Route = createFileRoute("/partners")({
  head: () => ({ meta: [{ title: "Partners — AP Performance" }] }),
  component: Partners,
});

function Partners() {
  const { isAdmin } = useAuth();
  const invalidate = useInvalidateData();
  const { data: partners = [] } = useQuery({ queryKey: ["partners"], queryFn: fetchPartners });

  const [q, setQ] = useState("");
  const [rm, setRm] = useState<string>("ALL");
  const [fy, setFy] = useState<string>("ALL");
  const [month, setMonth] = useState<string>("ALL"); // 1..12 of created month
  const [lead, setLead] = useState<string>("ALL");

  const rmList = useMemo(
    () => Array.from(new Set(partners.map((p) => p.rmName).filter(Boolean))).sort(),
    [partners],
  );
  const fyList = useMemo(
    () =>
      Array.from(new Set(partners.map((p) => p.createdFY).filter((x): x is string => !!x))).sort(),
    [partners],
  );
  const leadList = useMemo(
    () => Array.from(new Set(partners.map((p) => p.leadStatus).filter(Boolean))).sort(),
    [partners],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return partners.filter((p) => {
      if (s) {
        const hit =
          p.apCode.toLowerCase().includes(s) ||
          p.apName.toLowerCase().includes(s) ||
          (p.rmName ?? "").toLowerCase().includes(s);
        if (!hit) return false;
      }
      if (rm !== "ALL" && (p.rmName || "") !== rm) return false;
      if (fy !== "ALL" && p.createdFY !== fy) return false;
      if (lead !== "ALL" && (p.leadStatus || "") !== lead) return false;
      if (month !== "ALL") {
        if (!p.createdTime) return false;
        const mm = String(new Date(p.createdTime).getMonth() + 1).padStart(2, "0");
        if (mm !== month) return false;
      }
      return true;
    });
  }, [partners, q, rm, fy, month, lead]);

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Partner Master</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {partners.length} partners · re-upload from Uploads to refresh
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!confirm("Delete ALL partner records?")) return;
              try {
                await clearPartners();
                invalidate();
                toast.success("Cleared partner master");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Clear All
          </Button>
        )}
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap gap-2 items-end">
          <Field label="Search">
            <Input
              placeholder="AP code, name, RM…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-64 h-9"
            />
          </Field>
          <Field label="RM Name">
            <Select value={rm} onValueChange={setRm}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All RMs</SelectItem>
                {rmList.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Onboarding FY">
            <Select value={fy} onValueChange={setFy}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All FYs</SelectItem>
                {fyList.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Created Month">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All months</SelectItem>
                {FY_MONTH_LABELS.map((label, i) => {
                  // calendar order Jan..Dec uses i+1; FY_MONTH_LABELS starts at Apr
                  // Build value from actual calendar month using mapping
                  const calMonth = [4,5,6,7,8,9,10,11,12,1,2,3][i];
                  const v = String(calMonth).padStart(2, "0");
                  return <SelectItem key={v} value={v}>{label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Lead Status">
            <Select value={lead} onValueChange={setLead}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {leadList.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ(""); setRm("ALL"); setFy("ALL"); setMonth("ALL"); setLead("ALL");
            }}
          >
            Reset
          </Button>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>AP Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>RM Name</TableHead>
                <TableHead>Lead Status</TableHead>
                <TableHead>Onb FY</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.apCode}>
                  <TableCell className="font-mono text-xs">{p.apCode}</TableCell>
                  <TableCell>{p.apName}</TableCell>
                  <TableCell>{p.rmName || "—"}</TableCell>
                  <TableCell>
                    {p.leadStatus ? <Badge variant="secondary">{p.leadStatus}</Badge> : "—"}
                  </TableCell>
                  <TableCell>{p.createdFY ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.createdTime ? new Date(p.createdTime).toLocaleDateString("en-IN") : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    No partners match the current filters.
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
