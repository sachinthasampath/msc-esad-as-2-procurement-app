"use client";

import { Button, formatDate, Money, Modal, StatusBadge, TextArea, TextField } from "@procurex/ui";
import { useEffect, useMemo, useState } from "react";
import { DataTable, DiscrepancyBanner, FilterChips, MatchTrio, Note, PageHeader, Panel } from "../../../components/kit";
import { api } from "../../../lib/api";

type Invoice = {
  id: string;
  invoiceNumber: string;
  poId: string;
  supplierName: string;
  amount: number;
  status: string;
  invoiceDate: string;
  invoiceQuantity: number;
  itemDescription: string;
  notes: string;
  matchLabel: string;
  match: {
    outcome: string;
    message: string;
    orderedQty: number;
    acceptedQty: number;
    invoiceQty: number;
    orderedAmount: number;
    acceptedAmount: number;
    invoiceAmount: number;
  };
};
type OrderOption = { id: string; supplierName: string; acceptedQty: number; amount: number };

export default function InvoicesPage() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ poId: "", invoiceNumber: "", invoiceDate: "2026-10-20", totalAmount: "", invoiceQuantity: "", itemDescription: "", notes: "" });

  function load() {
    api.get<Invoice[]>("/api/v1/invoices").then(setRows).catch((caught) => setError(caught.message));
    api.get<OrderOption[]>("/api/v1/purchase-orders").then(setOrders).catch(() => undefined);
  }
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => rows.filter((row) => {
    const text = `${row.invoiceNumber} ${row.poId} ${row.supplierName}`.toLowerCase().includes(search.toLowerCase());
    if (!text) return false;
    if (filter === "All") return true;
    if (filter === "Hold") return row.status === "ON_HOLD";
    return row.status === filter.toUpperCase();
  }), [rows, filter, search]);

  async function createInvoice() {
    setError("");
    try {
      await api.post("/api/v1/invoices", {
        ...form,
        totalAmount: Number(form.totalAmount),
        invoiceQuantity: Number(form.invoiceQuantity),
      });
      setCreating(false);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the invoice");
    }
  }

  const chosen = orders.find((order) => order.id === form.poId);

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Verify invoices using 3-way match (PO, delivery, invoice). Only fully matched invoices are approved for payment."
        search={search}
        onSearch={setSearch}
        action={<Button onClick={() => { setCreating(true); setError(""); }}>+ Enter invoice</Button>}
      />
      <Note>Invoices — verify invoices using 3-way match. Only a matched invoice can be paid, and a held or rejected invoice cannot.</Note>
      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">All invoices</h2>
          <FilterChips value={filter} options={["All", "Pending", "Approved", "Hold", "Paid"]} onChange={setFilter} />
        </div>
        <DataTable columns={["Invoice #", "PO reference", "Supplier", "Amount", "3-way match", "Status", "Action"]}>
          {visible.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-3 font-medium">{row.invoiceNumber}</td>
              <td className="px-3 py-3">{row.poId}</td>
              <td className="px-3 py-3">{row.supplierName}</td>
              <td className="px-3 py-3"><Money value={row.amount} /></td>
              <td className="px-3 py-3">{row.matchLabel}</td>
              <td className="px-3 py-3"><StatusBadge status={row.status} /></td>
              <td className="px-3 py-3"><Button variant="secondary" onClick={() => setSelected(row)}>View</Button></td>
            </tr>
          ))}
        </DataTable>
      </Panel>
      {selected ? (
        <Modal title="3-way match review" onClose={() => setSelected(null)} footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}>
          <p className="mb-3 text-sm text-[var(--px-muted)]">{selected.invoiceNumber} · {selected.poId} · {formatDate(selected.invoiceDate)}</p>
          <MatchTrio {...selected.match} />
          {selected.match.outcome !== "FULL_MATCH" ? <DiscrepancyBanner message={selected.match.message} /> : null}
          <p className="mt-3 text-sm">{selected.itemDescription}</p>
        </Modal>
      ) : null}
      {creating ? (
        <Modal
          title="Enter invoice"
          onClose={() => setCreating(false)}
          footer={<><Button variant="secondary" onClick={() => setCreating(false)}>Cancel</Button><Button onClick={createInvoice}>Submit for 3-way match</Button></>}
        >
          <p className="mb-4 text-sm text-[var(--px-muted)]">Enter supplier invoice details for verification. The system checks them against the purchase order and delivery records.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Invoice number" value={form.invoiceNumber} onChange={(event) => setForm({ ...form, invoiceNumber: event.target.value })} />
            <TextField label="Invoice date" type="date" value={form.invoiceDate} onChange={(event) => setForm({ ...form, invoiceDate: event.target.value })} />
            <label className="block text-sm">
              <span className="mb-1 block font-medium">PO reference</span>
              <select className="w-full rounded-[10px] border px-3 py-2" value={form.poId} onChange={(event) => {
                const po = orders.find((order) => order.id === event.target.value);
                setForm({ ...form, poId: event.target.value, totalAmount: po ? String(Math.round(po.amount)) : form.totalAmount, invoiceQuantity: po ? String(po.acceptedQty) : form.invoiceQuantity });
              }}>
                <option value="">Select a purchase order</option>
                {orders.map((order) => <option key={order.id} value={order.id}>{order.id} · {order.supplierName}</option>)}
              </select>
            </label>
            <TextField label="Supplier" value={chosen?.supplierName ?? "Filled from the purchase order"} disabled />
            <TextField label="Invoice amount (Rs.)" type="number" value={form.totalAmount} onChange={(event) => setForm({ ...form, totalAmount: event.target.value })} />
            <TextField label="Invoice quantity" type="number" value={form.invoiceQuantity} onChange={(event) => setForm({ ...form, invoiceQuantity: event.target.value })} />
          </div>
          <div className="mt-3">
            <TextArea label="Item description" value={form.itemDescription} onChange={(event) => setForm({ ...form, itemDescription: event.target.value })} />
          </div>
          <div className="mt-3">
            <TextArea label="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
          {error ? <p className="mt-3 text-sm text-[var(--px-danger)]">{error}</p> : null}
        </Modal>
      ) : null}
    </>
  );
}
