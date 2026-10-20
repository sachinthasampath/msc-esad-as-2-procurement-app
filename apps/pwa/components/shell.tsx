"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type SessionUser } from "../lib/api";

const TABS = [
  ["/", "Home"],
  ["/orders", "Orders"],
  ["/deliveries", "Deliveries"],
  ["/profile", "Profile"],
] as const;

export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [online, setOnline] = useState(true);
  const [blocked, setBlocked] = useState("");

  useEffect(() => {
    api
      .get<SessionUser>("/api/v1/auth/me")
      .then((next) => {
        if (next.role !== "SITE_MANAGER") {
          setBlocked("This app is for site managers. Office staff use ProcureX on port 3000.");
          return;
        }
        setUser(next);
      })
      .catch(() => router.replace("/login"));
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [router]);

  if (blocked) return <main className="grid min-h-screen place-items-center p-6 text-center">{blocked}</main>;
  if (!user) return <main className="grid min-h-screen place-items-center text-[var(--px-muted)]">Loading SiteFlow…</main>;

  return (
    <div className="min-h-screen bg-[#e7edf5]">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col bg-[var(--px-canvas)] shadow-xl">
        {!online ? <p className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950">You are offline. You can look around, but a requisition can only be submitted online.</p> : null}
        <div className="flex-1 pb-20">{children}</div>
        <nav className="fixed bottom-0 left-1/2 flex w-full max-w-[420px] -translate-x-1/2 border-t border-[var(--px-line)] bg-white">
          {TABS.map(([href, label]) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} className={`flex-1 py-3 text-center text-xs ${active ? "font-semibold text-[var(--px-blue)]" : "text-slate-500"}`}>
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
