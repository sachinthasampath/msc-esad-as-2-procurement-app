"use client";

import { formatDate, formatMoney, Money, StatusBadge } from "@procurex/ui";
import { useEffect, useState } from "react";
import { DataTable, PageHeader, Panel, StatCard } from "../../../components/kit";
import { api } from "../../../lib/api";

type Payload = {
  summary: { totalPaid: number; pendingCount: number; overdueCount: number; monthTotal: number };
  rows: { id: string; supplierName: string; amount: number; approvedDate: string; paymentDate: string; status: string }[];
};

export default function PaymentsPage() {
  const [data, setData] = useState<Payload | null>(null);
  useEffect(() => { api.get<Payload>("/api/v1/payments").then(setData).catch(() => undefined); }, []);
  return (
    <>
      <PageHeader title="Payments" subtitle="Track payments and supplier balances. Payments are processed by the accounts department." />
      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <StatCard label="Total paid" value={data ? formatMoney(data.summary.totalPaid) : "—"} />
        <StatCard label="Pending payment" value={String(data?.summary.pendingCount ?? "—")} />
        <StatCard label="On hold" value={String(data?.summary.overdueCount ?? "—")} />
        <StatCard label="This month" value={data ? formatMoney(data.summary.monthTotal) : "—"} />
      </div>
      <Panel>
        <h2 className="mb-2 font-medium">Payment history</h2>
        <DataTable columns={["Reference", "Supplier", "Amount", "Approved date", "Payment date", "Status"]}>
          {(data?.rows ?? []).map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-3 font-medium">{row.id}</td>
              <td className="px-3 py-3">{row.supplierName}</td>
              <td className="px-3 py-3"><Money value={row.amount} /></td>
              <td className="px-3 py-3">{formatDate(row.approvedDate)}</td>
              <td className="px-3 py-3">{formatDate(row.paymentDate)}</td>
              <td className="px-3 py-3"><StatusBadge status={row.status} /></td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
