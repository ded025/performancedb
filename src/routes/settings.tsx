import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  fetchSettings,
  saveDefaultCommission,
  clearAllMonthlyAccounts,
  clearAllMonthlyRevenue,
  clearHistoricalFY,
} from "@/lib/cloudData";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useInvalidateData } from "@/lib/useDashboard";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — AP Performance" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) {
    throw redirect({ to: "/" });
  }

  const invalidate = useInvalidateData();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
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
                try {
                  await saveDefaultCommission(n);
                  invalidate();
                  toast.success("Saved");
                } catch (e) {
                  toast.error((e as Error).message);
                }
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
              try {
                await clearAllMonthlyAccounts();
                invalidate();
                toast.success("Cleared monthly accounts");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Clear All Monthly Accounts
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (!confirm("Delete ALL monthly revenue records?")) return;
              try {
                await clearAllMonthlyRevenue();
                invalidate();
                toast.success("Cleared monthly revenue");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Clear All Monthly Revenue
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (!confirm("Delete FY 25-26 historical data?")) return;
              try {
                await clearHistoricalFY("FY 25-26");
                invalidate();
                toast.success("Cleared historical");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Clear FY 25-26 Historical
          </Button>
        </div>
      </Card>
    </div>
  );
}
