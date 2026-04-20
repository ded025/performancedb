import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db, getSettings, setDefaultCommission } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — AP Performance" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useLiveQuery(() => getSettings());
  const [pct, setPct] = useState("20");
  useEffect(() => {
    if (settings) setPct(String(settings.defaultCommissionPct));
  }, [settings]);

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Global commission %. Per-AP override goes in the Partner Master file (Commission % column).
        </p>
      </div>
      <Card className="p-5 space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Default Commission %
          </label>
          <div className="flex gap-2 mt-1">
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              className="w-40"
            />
            <Button
              onClick={async () => {
                const n = parseFloat(pct);
                if (isNaN(n) || n < 0 || n > 100) return toast.error("Enter 0–100");
                await setDefaultCommission(n);
                toast.success("Saved");
              }}
            >
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Applied as: commission = revenue × % for current-FY months. Historical FY 25-26 uses
            its own commission columns.
          </p>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Danger Zone</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (!confirm("Delete ALL monthly account records?")) return;
              await db.monthlyAccounts.clear();
              toast.success("Cleared monthly accounts");
            }}
          >
            Clear All Monthly Accounts
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (!confirm("Delete ALL monthly revenue records?")) return;
              await db.monthlyRevenue.clear();
              toast.success("Cleared monthly revenue");
            }}
          >
            Clear All Monthly Revenue
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (!confirm("Delete FY 25-26 historical data?")) return;
              await db.historicalFY.clear();
              toast.success("Cleared historical");
            }}
          >
            Clear FY 25-26 Historical
          </Button>
        </div>
      </Card>
    </div>
  );
}
