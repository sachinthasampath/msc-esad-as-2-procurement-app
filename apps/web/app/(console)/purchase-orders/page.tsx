"use client";

import { Button, formatDate, Money, Modal, StatusBadge, TextField } from "@procurex/ui";
import { useEffect, useMemo, useState } from "react";
import { DataTable, DiscrepancyBanner, FilterChips, MatchTrio, Note, PageHeader, Panel } from "../../../components/kit";
import { api, type SessionUser } from "../../../lib/api";
import { downloadCsv } from "../../../lib/csv";

type Match = {
  outcome: string;
  message: string;
  orderedQty: number;
  acceptedQty: number;
  invoiceQty: number;
  orderedAmount: number;
  acceptedAmount: number;
  invoiceAmount: number;
};
type Order = {
  id: string;
  requisitionId: string;
  supplierName: string;
  depotName: string | null;
  siteName: string;
  amount: number;
  orderedQty: number;
  acceptedQty: number;
  status: string;
  listBadge: string;
  placedDate: string;
  requiredDate: string;
  invoice: null | { id: string; status: string; invoiceNumber: string; match: Match };
  deliveries: { id: string; timestamp: string; noteRef: string; note: string; siteManagerName: string; lines: { description: string; quantityReceived: number; condition: string }[] }[];
};

export default function PurchaseOrdersPage() {
  const [rows, setRows] = useState<Order[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [audit, setAudit] = useState(false);
  const [error, setError] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");

  function load(keepId?: string) {
    api.get<Order[]>("/api/v1/purchase-orders").then((next) => {
      setRows(next);
      if (keepId) setSelected(next.find((row) => row.id === keepId) ?? null);
    });
  }

  useEffect(() => {
    load();
    api.get<SessionUser>("/api/v1/auth/me").then(setUser).catch(() => undefined);
  }, []);

  const visible = useMemo(() => {
    return rows.filter((row) => {
      const text = `${row.id} ${row.supplierName} ${row.siteName}`.toLowerCase().includes(search.toLowerCase());
      if (!text) return false;
      if (filter === "Pending") return row.listBadge === "PENDING";
      if (filter === "Approved") return row.listBadge === "APPROVED";
      if (filter === "Delivered") return row.status === "FULLY_DELIVERED";
      return true;
    });
  }, [rows, filter, search]);

  async function act(action: "approve" | "approve-partial" | "hold" | "reject" | "credit" | "pay") {
    if (!selected?.invoice) return;
    setError("");
    try {
      await api.post(`/api/v1/invoices/${selected.invoice.id}/actions`, {
        action,
        amount: Number(creditAmount),
        reason: creditReason,
      });
      load(selected.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the invoice");
    }
  }

  const match = selected?.invoice?.match;
  const procurement = user?.role === "PROCUREMENT_STAFF";
  const open = selected?.invoice && selected.invoice.status !== "PAID" && selected.invoice.status !== "REJECTED";

  return (
    <>
      <PageHeader
        eyebrow="Purchase Orders"
        title="Purchase Orders"
        subtitle="Approved requisitions generate POs. Track order status and manage deliveries."
        search={search}
        onSearch={setSearch}
        onExport={() => downloadCsv("purchase-orders.csv", ["PO", "Supplier", "Site", "Amount", "Delivered", "Status"], visible.map((row) => [row.id, row.supplierName, row.siteName, row.amount, `${row.acceptedQty}/${row.orderedQty}`, row.listBadge]))}
      />
      <Note>Purchase orders — approved requisitions generate POs. Track order status and manage deliveries.</Note>
      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">All purchase orders</h2>
          <FilterChips value={filter} options={["All", "Pending", "Approved", "Delivered"]} onChange={setFilter} />
        </div>
        <DataTable columns={["PO ID", "Supplier", "Site", "Amount", "Delivered", "Status", "Action"]}>
          {visible.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-3">
                <p className="font-medium">{row.id}</p>
                <p className="text-xs text-[var(--px-muted)]">{row.requisitionId}</p>
              </td>
              <td className="px-3 py-3">{row.supplierName}</td>
              <td className="px-3 py-3">{row.siteName}</td>
              <td className="px-3 py-3"><Money value={row.amount} /></td>
              <td className="px-3 py-3">{row.acceptedQty}/{row.orderedQty} ({row.orderedQty ? Math.round((row.acceptedQty / row.orderedQty) * 100) : 0}%)</td>
              <td className="px-3 py-3"><StatusBadge status={row.listBadge} /></td>
              <td className="px-3 py-3"><Button variant="secondary" onClick={() => { setSelected(row); setAudit(false); setError(""); }}>View</Button></td>
            </tr>
          ))}
        </DataTable>
      </Panel>
      {selected ? (
        <Modal
          title={selected.id}
          onClose={() => setSelected(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
              {selected.deliveries.length > 0 ? <Button variant="secondary" onClick={() => setAudit((value) => !value)}>Audit trail</Button> : null}
              {procurement && open && match?.outcome === "FULL_MATCH" && selected.invoice?.status !== "APPROVED" ? <Button onClick={() => act("approve")}>Approve for payment</Button> : null}
              {procurement && selected.invoice?.status === "APPROVED" ? <Button onClick={() => act("pay")}>Record payment</Button> : null}
              {procurement && open && match?.outcome === "PARTIAL_DELIVERY" ? <Button onClick={() => act("approve-partial")}>Approve partial</Button> : null}
              {procurement && open && (match?.outcome === "PARTIAL_DELIVERY" || match?.outcome === "PRICE_MISMATCH") ? <Button variant="danger" onClick={() => act("hold")}>Hold invoice</Button> : null}
              {procurement && open ? <Button variant="danger" onClick={() => act("reject")}>Reject</Button> : null}
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Tile label="Requisition" value={selected.requisitionId} />
            <Tile label="Supplier" value={selected.supplierName} />
            <Tile label="Depot" value={selected.depotName ?? "Any depot"} />
            <Tile label="Site" value={selected.siteName} />
            <Tile label="Amount" value={<Money value={selected.amount} />} />
            <Tile label="Order date" value={formatDate(selected.placedDate)} />
            <Tile label="Status" value={<StatusBadge status={selected.listBadge} />} />
          </div>
          {match ? (
            <div className="mt-4">
              <MatchTrio {...match} />
              {match.outcome !== "FULL_MATCH" ? <DiscrepancyBanner message={match.message} /> : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--px-muted)]">No invoice has been entered for this purchase order.</p>
          )}
          {procurement && match?.outcome === "PRICE_MISMATCH" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <TextField label="Credit amount" type="number" value={creditAmount} onChange={(event) => setCreditAmount(event.target.value)} />
              <TextField label="Reason" value={creditReason} onChange={(event) => setCreditReason(event.target.value)} />
              <Button variant="secondary" onClick={() => act("credit")}>Request credit note</Button>
            </div>
          ) : null}
          {audit ? (
            <ul className="mt-4 space-y-2 text-sm">
              {selected.deliveries.map((delivery) => (
                <li key={delivery.id} className="rounded-xl bg-slate-50 p-3">
                  <p className="font-medium">{delivery.noteRef} · {formatDate(delivery.timestamp)} · {delivery.siteManagerName}</p>
                  {delivery.lines.map((line) => (
                    <p key={line.description}>{line.description}: {line.quantityReceived} {line.condition.toLowerCase()}</p>
                  ))}
                </li>
              ))}
            </ul>
          ) : null}
          {error ? <p className="mt-3 text-sm text-[var(--px-danger)]">{error}</p> : null}
        </Modal>
      ) : null}
    </>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
