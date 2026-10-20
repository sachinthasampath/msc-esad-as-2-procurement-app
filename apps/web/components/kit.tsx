"use client";

import { Button, SearchField, StatusBadge } from "@procurex/ui";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  search,
  onSearch,
  onExport,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  search?: string;
  onSearch?: (value: string) => void;
  onExport?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-xs font-medium text-[var(--px-muted)]">{eyebrow}</p> : null}
        <h1 className="text-[22px] font-semibold">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-[var(--px-muted)]">{subtitle}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onSearch ? <div className="w-56"><SearchField placeholder="Search…" value={search} onChange={(event) => onSearch(event.target.value)} /></div> : null}
        {onExport ? <Button variant="secondary" onClick={onExport}>Export</Button> : null}
        {action}
      </div>
    </div>
  );
}

export function FilterChips({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-full px-3 py-1 text-sm ${value === option ? "bg-[var(--px-navy)] text-white" : "bg-white text-slate-600 ring-1 ring-[var(--px-line)]"}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return <section className="rounded-2xl border border-[var(--px-line)] bg-white p-4 shadow-[var(--px-shadow)]">{children}</section>;
}

export function DataTable({
  columns,
  children,
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-400">
            {columns.map((column) => (
              <th key={column} className="px-3 py-3 font-medium">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--px-line)]">{children}</tbody>
      </table>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <div className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-950">{children}</div>;
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="rounded-2xl border border-[var(--px-line)] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--px-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--px-muted)]">{hint}</p> : null}
    </article>
  );
}

export function MatchTrio({
  orderedQty,
  acceptedQty,
  invoiceQty,
  orderedAmount,
  acceptedAmount,
  invoiceAmount,
}: {
  orderedQty: number;
  acceptedQty: number;
  invoiceQty: number;
  orderedAmount: number;
  acceptedAmount: number;
  invoiceAmount: number;
}) {
  const tiles = [
    ["Purchase order", orderedQty, orderedAmount, "bg-[var(--px-success-bg)]"],
    ["Goods receipt", acceptedQty, acceptedAmount, acceptedQty < orderedQty ? "bg-[var(--px-warning-bg)]" : "bg-[var(--px-success-bg)]"],
    ["Invoice", invoiceQty, invoiceAmount, Math.abs(invoiceAmount - acceptedAmount) > 0.5 ? "bg-[var(--px-danger-bg)]" : "bg-[var(--px-success-bg)]"],
  ] as const;
  return (
    <div>
      <p className="mb-2 text-sm font-medium">3-way match verification</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map(([label, qty, amount, tone]) => (
          <div key={label} className={`rounded-xl p-3 ${tone}`}>
            <p className="text-xs uppercase text-slate-500">{label}</p>
            <p className="text-2xl font-semibold">{qty}</p>
            <p className="text-xs text-slate-600">units @ Rs. {Math.round(amount).toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DiscrepancyBanner({ message }: { message: string }) {
  return <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>;
}

export function BadgeCell({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}
