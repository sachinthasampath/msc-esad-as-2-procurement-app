"use client";

import { Button, formatDate, Money, SearchField, StatusBadge, TextArea } from "@procurex/ui";
import { useEffect, useMemo, useState } from "react";
import { Sheet } from "./orders";
import { api } from "../lib/api";

type Order = {
  id: string;
  supplierName: string;
  siteName: string;
  requisitionId: string;
  amount: number;
  orderedQty: number;
  acceptedQty: number;
  status: string;
  requiredDate: string;
  lines: { id: string; description: string; quantityOrdered: number; cumulativeAcceptedQty: number }[];
};

function pill(order: Order) {
  const due = new Date(order.requiredDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (order.status === "FULLY_DELIVERED") return "FULLY_DELIVERED";
  if (order.status === "PARTIALLY_DELIVERED") return "PARTIALLY_DELIVERED";
  if (due < today) return "OVERDUE";
  return "PLACED";
}

export function DeliveryBoard() {
  const [rows, setRows] = useState<Order[]>([]);
  const [tab, setTab] = useState<"Active" | "Reviewed">("Active");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [conditions, setConditions] = useState<Record<string, "ACCEPTED" | "DAMAGED">>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function load() {
    api.get<Order[]>("/api/v1/purchase-orders").then(setRows).catch((caught) => setError(caught.message));
  }
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => rows.filter((row) => {
    const reviewed = row.status === "FULLY_DELIVERED";
    if (tab === "Reviewed" ? !reviewed : reviewed) return false;
    return `${row.id} ${row.supplierName} ${row.requisitionId}`.toLowerCase().includes(search.toLowerCase());
  }), [rows, tab, search]);

  function open(order: Order) {
    setSelected(order);
    setQuantities(Object.fromEntries(order.lines.map((line) => [line.id, "0"])));
    setConditions(Object.fromEntries(order.lines.map((line) => [line.id, "ACCEPTED"])));
    setPhotos({});
    setNote("");
    setError("");
  }

  async function save() {
    if (!selected) return;
    setError("");
    const lines = selected.lines
      .map((line) => ({
        poLineId: line.id,
        quantity: Number(quantities[line.id] || 0),
        condition: conditions[line.id] ?? "ACCEPTED",
        photoUrl: photos[line.id] || null,
        remark: note,
      }))
      .filter((line) => line.quantity > 0);
    try {
      await api.post(`/api/v1/purchase-orders/${selected.id}/deliveries`, { note, lines });
      setSelected(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the delivery");
    }
  }

  function onPhoto(lineId: string, file: File | undefined) {
    if (!file) return;
    if (file.size > 150_000) {
      setError("Use a photo under 150KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotos((current) => ({ ...current, [lineId]: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  return (
    <div className="px-4 pt-4">
      <h1 className="text-xl font-semibold">Orders</h1>
      <p className="text-sm text-[var(--px-muted)]">{rows[0]?.siteName ?? "Deliveries"}</p>
      <div className="mt-3"><SearchField placeholder="Search requisition, PO, or supplier" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <div className="mt-3 flex gap-4 text-sm">
        {(["Active", "Reviewed"] as const).map((item) => (
          <button key={item} className={tab === item ? "border-b-2 border-[var(--px-blue)] pb-1 font-semibold" : "text-slate-500"} onClick={() => setTab(item)}>{item}</button>
        ))}
      </div>
      {error && !selected ? <p className="mt-3 text-sm text-[var(--px-danger)]">{error}</p> : null}
      <div className="mt-3 space-y-3">
        {visible.map((row) => (
          <button key={row.id} className="w-full rounded-2xl bg-white p-4 text-left shadow-sm" onClick={() => row.status === "FULLY_DELIVERED" ? undefined : open(row)}>
            <div className="flex justify-between gap-2">
              <div>
                <p className="font-semibold">{row.supplierName}</p>
                <p className="text-sm text-[var(--px-muted)]">{row.siteName}</p>
                <p className="text-xs text-[var(--px-muted)]">{row.id} · {row.requisitionId}</p>
              </div>
              <StatusBadge status={pill(row)} />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-xs text-[var(--px-muted)]">Due {formatDate(row.requiredDate)}</p>
              <p className="font-semibold"><Money value={row.amount} /></p>
            </div>
            {row.status === "PARTIALLY_DELIVERED" ? <p className="mt-1 text-xs text-[var(--px-muted)]">{row.acceptedQty} of {row.orderedQty} units received</p> : null}
          </button>
        ))}
      </div>
      {selected ? (
        <Sheet title="Confirm items received today" onClose={() => setSelected(null)}>
          <p className="text-sm font-medium">{selected.id}</p>
          <p className="text-sm text-[var(--px-muted)]">{selected.siteName} · {selected.requisitionId}</p>
          <p className="mt-1 text-sm text-[var(--px-muted)]">{selected.acceptedQty} of {selected.orderedQty} units received across {selected.lines.length} line {selected.lines.length === 1 ? "item" : "items"}</p>
          <div className="mt-4 space-y-4">
            {selected.lines.map((line) => (
              <div key={line.id}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{line.description}</p>
                    <p className="text-xs text-[var(--px-muted)]">{line.cumulativeAcceptedQty} of {line.quantityOrdered} received so far</p>
                  </div>
                  <input className="w-16 rounded-xl border px-2 py-2 text-center" type="number" min={0} value={quantities[line.id] ?? "0"} onChange={(event) => setQuantities({ ...quantities, [line.id]: event.target.value })} />
                </div>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <span>Condition</span>
                  <select className="rounded-lg border px-2 py-1" value={conditions[line.id]} onChange={(event) => setConditions({ ...conditions, [line.id]: event.target.value as "ACCEPTED" | "DAMAGED" })}>
                    <option value="ACCEPTED">Accepted</option>
                    <option value="DAMAGED">Damaged</option>
                  </select>
                </label>
                {conditions[line.id] === "DAMAGED" ? <input className="mt-2 block text-sm" type="file" accept="image/*" onChange={(event) => onPhoto(line.id, event.target.files?.[0])} /> : null}
              </div>
            ))}
          </div>
          <div className="mt-4"><TextArea label="Delivery note (optional)" placeholder="e.g. door frame arrived scratched, returning to supplier" value={note} onChange={(event) => setNote(event.target.value)} /></div>
          {error ? <p className="mt-2 text-sm text-[var(--px-danger)]">{error}</p> : null}
          <Button className="mt-4 w-full" onClick={save}>Save delivery</Button>
          <button className="mt-3 w-full text-sm text-[var(--px-muted)]" onClick={() => setSelected(null)}>Cancel</button>
        </Sheet>
      ) : null}
    </div>
  );
}
