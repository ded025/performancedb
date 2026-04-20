import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Upload, Users, Settings as SettingsIcon } from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/uploads", label: "Uploads", icon: Upload },
  { to: "/partners", label: "Partners", icon: Users },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/60">Internal</div>
          <div className="text-lg font-semibold mt-0.5">AP Performance</div>
        </div>
        <nav className="p-3 space-y-1">
          {NAV.map((n) => {
            const active = loc.pathname === n.to || (n.to !== "/" && loc.pathname.startsWith(n.to));
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-4 text-[11px] text-sidebar-foreground/50">
          Local-only · IndexedDB
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden border-b border-border bg-card px-4 py-3 flex items-center gap-3">
          <div className="font-semibold">AP Performance</div>
          <nav className="ml-auto flex gap-1 text-xs">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className="px-2 py-1 rounded hover:bg-accent">
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
