"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type SessionUser } from "../lib/api";

const GROUPS = [
  {
    label: "Main",
    items: [
      ["/dashboard", "Dashboard"],
      ["/requisitions", "Requisitions"],
      ["/purchase-orders", "Purchase Orders"],
      ["/deliveries", "Deliveries"],
    ],
  },
  {
    label: "Finance",
    items: [
      ["/invoices", "Invoices"],
      ["/payments", "Payments"],
      ["/reports", "Reports"],
    ],
  },
  {
    label: "Admin",
    items: [
      ["/suppliers", "Suppliers"],
      ["/catalogue", "Catalogue"],
      ["/settings", "Settings"],
    ],
  },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<SessionUser>("/api/v1/auth/me")
      .then((next) => {
        if (next.role === "SITE_MANAGER") {
          setError("Site managers use the SiteFlow app on port 3001.");
          return;
        }
        setUser(next);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (error) {
    return <main className="grid min-h-screen place-items-center p-6 text-center">{error}</main>;
  }
  if (!user) return <main className="grid min-h-screen place-items-center text-[var(--px-muted)]">Loading ProcureX…</main>;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col bg-[var(--px-navy)] text-slate-300">
        <div className="flex items-center gap-3 px-5 py-5 text-white">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--px-blue)] text-sm font-bold">P</span>
          <span>
            <span className="block text-sm font-semibold">ProcureX</span>
            <span className="block text-[11px] text-slate-400">Construction ERP</span>
          </span>
        </div>
        <nav className="flex-1 overflow-auto px-3 pb-4">
          {GROUPS.map((group) => (
            <div key={group.label} className="mt-4">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
              <ul className="mt-1 space-y-1">
                {group.items.map(([href, label]) => {
                  const active = pathname === href;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        className={`block rounded-lg px-3 py-2 text-sm ${active ? "bg-[var(--px-blue)] text-white" : "hover:bg-[var(--px-navy-2)]"}`}
                      >
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-4 text-xs">
          <p className="font-medium text-white">{user.name}</p>
          <p className="text-slate-400">{user.role === "MANAGEMENT_STAFF" ? `${user.level === "SENIOR" ? "Senior" : "Operational"} management` : "Procurement"}</p>
          <button
            className="mt-2 text-slate-300 underline"
            onClick={async () => {
              await api.post("/api/v1/auth/logout");
              router.replace("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
