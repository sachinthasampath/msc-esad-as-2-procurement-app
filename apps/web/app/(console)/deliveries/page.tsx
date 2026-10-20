"use client";

import { formatDate, Money, StatusBadge } from "@procurex/ui";
import { useEffect, useState } from "react";
import { DataTable, PageHeader, Panel } from "../../../components/kit";
import { api } from "../../../lib/api";

type Delivery = {
  id: string;
  poId: string;
  supplierName: string;
  siteName: string;
  timestamp: string;
  noteRef: string;
  note: string;
  siteManagerName: string;
  acceptedQty: number;
  damagedQty: number;
};

export default function DeliveriesPage() {
  const [rows, setRows] = useState<Delivery[]>([]);
  useEffect(() => { api.get<Delivery[]>("/api/v1/deliveries").then(setRows).catch(() => undefined); }, []);
  return (
    <>
      <PageHeader title="Deliveries" subtitle="Each receipt is kept. Accepted quantity is what the invoice match uses. Damaged quantity is not." />
      <Panel>
        <DataTable columns={["Receipt", "PO", "Supplier", "Site", "Date", "Accepted", "Damaged", "Logged by"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-3 font-medium">{row.noteRef}</td>
              <td className="px-3 py-3">{row.poId}</td>
              <td className="px-3 py-3">{row.supplierName}</td>
              <td className="px-3 py-3">{row.siteName}</td>
              <td className="px-3 py-3">{formatDate(row.timestamp)}</td>
              <td className="px-3 py-3">{row.acceptedQty}</td>
              <td className="px-3 py-3">{row.damagedQty > 0 ? <StatusBadge status="DAMAGED" /> : "0"}</td>
              <td className="px-3 py-3">{row.siteManagerName}</td>
            </tr>
          ))}
        </DataTable>
        {rows.some((row) => row.note) ? <p className="px-3 py-2 text-xs text-[var(--px-muted)]">Notes stay on the receipt the site manager saved.</p> : null}
        <p className="sr-only"><Money value={0} /></p>
      </Panel>
    </>
  );
}
