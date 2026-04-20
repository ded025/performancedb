import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchPartners, clearPartners } from "@/lib/cloudData";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/partners")({
  head: () => ({ meta: [{ title: "Partners — AP Performance" }] }),
  component: Partners,
});

function Partners() {
  const { isAdmin } = useAuth();
  const invalidate = useInvalidateData();
  const { data: partners = [] } = useQuery({ queryKey: ["partners"], queryFn: fetchPartners });
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return partners;
    return partners.filter(
      (p) =>
        p.apCode.toLowerCase().includes(s) ||
        p.apName.toLowerCase().includes(s) ||
        (p.rmName ?? "").toLowerCase().includes(s),
    );
  }, [partners, q]);

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Partner Master</h1>
          <p className="text-sm text-muted-foreground">
            {partners.length} partners · re-upload from Uploads to refresh
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Search code, name, RM…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-72 h-9"
          />
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
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto max-h-[75vh]">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>AP Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>RM Name</TableHead>
                <TableHead>Lead Status</TableHead>
                <TableHead>Onb FY</TableHead>
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
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No partners. Upload the Partner Master from Uploads.
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
