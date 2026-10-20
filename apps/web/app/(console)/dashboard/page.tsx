"use client";

import { formatMoney } from "@procurex/ui";
import { useEffect, useState } from "react";
import { Note, PageHeader, StatCard } from "../../../components/kit";
import { api } from "../../../lib/api";

export default function DashboardPage() {
  const [data, setData] = useState<{ waitingRequisitions: number; openPurchaseOrders: number; invoicesOnHold: number; paidThisMonth: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<NonNullable<typeof data>>("/api/v1/dashboard").then(setData).catch((caught) => setError(caught.message));
  }, []);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="What the office needs to act on today." />
      {error ? <p className="text-sm text-[var(--px-danger)]">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Waiting" value={String(data?.waitingRequisitions ?? "—")} hint="Requisitions on hold, waiting, or referred" />
        <StatCard label="Open orders" value={String(data?.openPurchaseOrders ?? "—")} hint="Placed or only partly delivered" />
        <StatCard label="Invoices on hold" value={String(data?.invoicesOnHold ?? "—")} />
        <StatCard label="Paid this month" value={data ? formatMoney(data.paidThisMonth) : "—"} />
      </div>
      <div className="mt-6">
        <Note>Approval bands are in Settings. A requisition at or under the auto-approve limit becomes purchase orders without a manager.</Note>
      </div>
    </>
  );
}
