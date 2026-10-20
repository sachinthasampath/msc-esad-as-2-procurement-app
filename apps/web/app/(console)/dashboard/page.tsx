"use client";

import { formatMoney } from "@procurex/ui";
import { useEffect, useState } from "react";
import { Note, PageHeader, StatCard } from "../../../components/kit";
import { api } from "../../../lib/api";

type Notice = { id: string; message: string; createdAt: string };

export default function DashboardPage() {
  const [data, setData] = useState<{ waitingRequisitions: number; openPurchaseOrders: number; invoicesOnHold: number; paidThisMonth: number } | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<NonNullable<typeof data>>("/api/v1/dashboard").then(setData).catch((caught) => setError(caught.message));
    api.get<Notice[]>("/api/v1/notifications").then(setNotices).catch((caught) => setError(caught.message));
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
        <h2 className="mb-2 text-sm font-semibold">Notices</h2>
        {notices.length === 0 ? (
          <Note>No purchase orders are waiting for an invoice.</Note>
        ) : (
          <ul className="space-y-2">
            {notices.map((notice) => (
              <li key={notice.id}>
                <Note>{notice.message}</Note>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
