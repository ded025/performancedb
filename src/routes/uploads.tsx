import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { db, exportAllJSON, importAllJSON, clearMonthData } from "@/lib/db";
import {
  parsePartners,
  parseAccountsForMonth,
  parseRevenueForMonth,
  parseHistoricalFY2526,
  readSheetRows,
} from "@/lib/parsers";
import { MonthPicker } from "@/components/MonthPicker";
import { Download, Upload as UploadIcon } from "lucide-react";

export const Route = createFileRoute("/uploads")({
  head: () => ({ meta: [{ title: "Uploads — AP Performance" }] }),
  component: UploadsPage,
});

function UploadsPage() {
  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Uploads</h1>
          <p className="text-sm text-muted-foreground">
            All data is saved locally in your browser. Use Backup to export a JSON file.
          </p>
        </div>
        <BackupRestore />
      </div>

      <PartnerUpload />
      <AccountsUpload />
      <RevenueUpload />
      <HistoricalUpload />
    </div>
  );
}

function defaultMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function PartnerUpload() {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <UploadCard
      title="Partner Master"
      columns="AP Code · AP Name · RM Name · Lead Status · Created Time · Commission % (optional)"
    >
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            const rows = await readSheetRows(f);
            const partners = parsePartners(rows);
            if (partners.length === 0) throw new Error("No valid rows (need an AP Code column)");
            await db.partners.bulkPut(partners);
            toast.success(`Imported ${partners.length} partners`);
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
            if (ref.current) ref.current.value = "";
          }
        }}
      />
      <Button onClick={() => ref.current?.click()} disabled={busy}>
        <UploadIcon className="h-4 w-4 mr-2" />
        {busy ? "Importing…" : "Upload Partners"}
      </Button>
    </UploadCard>
  );
}

function AccountsUpload() {
  const [month, setMonth] = useState(defaultMonth());
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <UploadCard
      title="Monthly Accounts"
      columns="Sub source · Account opened date · First trade date"
      tail={<MonthPicker value={month} onChange={setMonth} />}
    >
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (!month) return toast.error("Pick a month first");
          setBusy(true);
          try {
            const rows = await readSheetRows(f);
            const recs = parseAccountsForMonth(rows, month);
            await clearMonthData("monthlyAccounts", month);
            if (recs.length) await db.monthlyAccounts.bulkPut(recs);
            toast.success(`Saved ${recs.length} APs for ${month} (overwrote existing)`);
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
            if (ref.current) ref.current.value = "";
          }
        }}
      />
      <Button onClick={() => ref.current?.click()} disabled={busy}>
        <UploadIcon className="h-4 w-4 mr-2" />
        {busy ? "Importing…" : "Upload Accounts"}
      </Button>
    </UploadCard>
  );
}

function RevenueUpload() {
  const [month, setMonth] = useState(defaultMonth());
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <UploadCard
      title="Monthly Revenue"
      columns="Client Id · Total Brk · Introducer Brk · Sub source"
      tail={<MonthPicker value={month} onChange={setMonth} />}
    >
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (!month) return toast.error("Pick a month first");
          setBusy(true);
          try {
            const rows = await readSheetRows(f);
            const recs = parseRevenueForMonth(rows, month);
            await clearMonthData("monthlyRevenue", month);
            if (recs.length) await db.monthlyRevenue.bulkPut(recs);
            toast.success(`Saved revenue for ${recs.length} APs in ${month} (overwrote existing)`);
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
            if (ref.current) ref.current.value = "";
          }
        }}
      />
      <Button onClick={() => ref.current?.click()} disabled={busy}>
        <UploadIcon className="h-4 w-4 mr-2" />
        {busy ? "Importing…" : "Upload Revenue"}
      </Button>
    </UploadCard>
  );
}

function HistoricalUpload() {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <UploadCard
      title="FY 25-26 Historical (one-time)"
      columns="Wide format · Apr(25)…Mar(25), …r (revenue), …c (commission), …A (active)"
    >
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            const rows = await readSheetRows(f);
            const { partners, historical } = parseHistoricalFY2526(rows);
            if (partners.length) await db.partners.bulkPut(partners);
            await db.historicalFY.where("fy").equals("FY 25-26").delete();
            if (historical.length) await db.historicalFY.bulkPut(historical);
            toast.success(`FY 25-26: ${historical.length} APs imported`);
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
            if (ref.current) ref.current.value = "";
          }
        }}
      />
      <Button variant="secondary" onClick={() => ref.current?.click()} disabled={busy}>
        <UploadIcon className="h-4 w-4 mr-2" />
        {busy ? "Importing…" : "Upload FY 25-26"}
      </Button>
    </UploadCard>
  );
}

function UploadCard({
  title,
  columns,
  tail,
  children,
}: {
  title: string;
  columns: string;
  tail?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{columns}</p>
        </div>
        <div className="flex items-center gap-2">
          {tail}
          {children}
        </div>
      </div>
    </Card>
  );
}

function BackupRestore() {
  const importRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          const json = await exportAllJSON();
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `ap-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success("Backup downloaded");
        }}
      >
        <Download className="h-4 w-4 mr-2" />
        Backup
      </Button>
      <Input
        ref={importRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (!confirm("Restoring will REPLACE all current data. Continue?")) return;
          try {
            const text = await f.text();
            const r = await importAllJSON(text);
            toast.success(
              `Restored: ${r.partners} partners · ${r.monthlyAccounts} acc · ${r.monthlyRevenue} rev · ${r.historicalFY} historical`,
            );
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            if (importRef.current) importRef.current.value = "";
          }
        }}
      />
      <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
        <UploadIcon className="h-4 w-4 mr-2" />
        Restore
      </Button>
    </div>
  );
}
