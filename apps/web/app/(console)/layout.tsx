"use client";

import { AppShell } from "../../components/shell";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="px-7 py-6">{children}</div>
    </AppShell>
  );
}
