import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "AP Performance" }] }),
  component: GatePage,
});

function GatePage() {
  const { enter, isAuthed } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);

  if (isAuthed) {
    throw redirect({ to: "/" });
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { ok } = enter(code);
    if (!ok) {
      setErr(true);
      return;
    }
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6 space-y-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Internal</div>
          <h1 className="text-xl font-semibold mt-1">AP Performance</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            type="password"
            autoFocus
            placeholder="Enter passcode"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (err) setErr(false);
            }}
          />
          {err && <p className="text-xs text-destructive">Invalid passcode</p>}
          <Button type="submit" className="w-full">
            Enter
          </Button>
        </form>
      </Card>
    </div>
  );
}
