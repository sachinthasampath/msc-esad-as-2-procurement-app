"use client";

import { Button, Money, ProgressBar, SearchField, Select, StatusBadge, TextArea, TextField } from "@procurex/ui";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Line = { id: string; itemId: string; supplierId: string; description: string; quantity: number; negotiatedPrice: number; isPriceValid: boolean; supplierName?: string };
type Po = { id: string; supplierName: string; status: string; orderedQty: number; acceptedQty: number };
export type Requisition = {
  id: string;
  status: string;
  siteName: string;
  siteId: string;
  accountId: string;
  totalValue: number;
  requiredDate: string;
  comments: string;
  reviewComment: string;
  supplierSummary: string;
  lineCount: number;
  lines: Line[];
  purchaseOrders: Po[];
};
type Site = { id: string; siteName: string };
type Account = { id: string; accountName: string };
type Supplier = { id: string; name: string; depots: { id: string; location: string }[] };
type Item = { id: string; description: string; agreedPrice: number | null; priced: boolean; supplierId: string };

const TABS = ["All Orders", "Drafts", "On Hold", "Waiting Approval"] as const;
const CHIPS = ["All", "Pending", "Approved", "Partial"] as const;

function inTab(row: Requisition, tab: (typeof TABS)[number]) {
  if (tab === "Drafts") return row.status === "DRAFT" || row.status === "RETURNED";
  if (tab === "On Hold") return row.status === "ON_HOLD";
  if (tab === "Waiting Approval") return row.status === "WAITING_APPROVAL" || row.status === "REFERRED";
  return true;
}

function inChip(row: Requisition, chip: (typeof CHIPS)[number]) {
  const partial = row.status === "PARTIALLY_APPROVED" || row.purchaseOrders.some((order) => order.status === "PARTIALLY_DELIVERED");
  const pending = ["WAITING_APPROVAL", "REFERRED", "ON_HOLD", "DRAFT", "RETURNED"].includes(row.status);
  const approved = row.status === "APPROVED" || row.purchaseOrders.some((order) => order.acceptedQty >= order.orderedQty && order.orderedQty > 0);
  if (chip === "Pending") return pending;
  if (chip === "Approved") return approved && !partial;
  if (chip === "Partial") return partial;
  return true;
}

export function OrderBoard({ home = false }: { home?: boolean }) {
  const [rows, setRows] = useState<Requisition[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("All Orders");
  const [chip, setChip] = useState<(typeof CHIPS)[number]>("All");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Requisition | null>(null);
  const [viewing, setViewing] = useState<Requisition | null>(null);
  const [error, setError] = useState("");

  function load() {
    api.get<Requisition[]>("/api/v1/requisitions").then(setRows).catch((caught) => setError(caught.message));
  }
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    return rows.filter((row) => {
      if (home) {
        const needsAction = ["DRAFT", "ON_HOLD", "WAITING_APPROVAL", "REFERRED", "RETURNED"].includes(row.status);
        const overdue = row.purchaseOrders.some((order) => order.status !== "FULLY_DELIVERED" && new Date(row.requiredDate) < new Date());
        if (!needsAction && !overdue) return false;
      } else if (!inTab(row, tab) || !inChip(row, chip)) return false;
      return `${row.id} ${row.supplierSummary} ${row.purchaseOrders.map((order) => order.id).join(" ")}`.toLowerCase().includes(search.toLowerCase());
    });
  }, [rows, tab, chip, search, home]);

  async function cancel(id: string) {
    if (!confirm("Cancel this requisition?")) return;
    await api.post(`/api/v1/requisitions/${id}/cancel`);
    setViewing(null);
    load();
  }

  return (
    <div className="px-4 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{home ? "Home" : "Orders"}</h1>
          <p className="text-sm text-[var(--px-muted)]">{home ? "Needs your attention" : "Track requisitions and deliveries"}</p>
        </div>
        <Button onClick={() => { setEditing(null); setCreating(true); }}>+ New</Button>
      </div>
      <SearchField placeholder="Search order, PO, or supplier" value={search} onChange={(event) => setSearch(event.target.value)} />
      {home ? null : (
        <>
          <div className="mt-3 flex gap-2 overflow-auto text-sm">
            {TABS.map((item) => (
              <button key={item} className={`whitespace-nowrap rounded-full px-3 py-1 ${tab === item ? "bg-[var(--px-navy)] text-white" : "bg-white"}`} onClick={() => setTab(item)}>{item}</button>
            ))}
          </div>
          <div className="mt-2 flex gap-2 text-sm">
            {CHIPS.map((item) => (
              <button key={item} className={`rounded-full px-3 py-1 ${chip === item ? "bg-blue-100 text-blue-800" : "text-slate-500"}`} onClick={() => setChip(item)}>{item}</button>
            ))}
          </div>
        </>
      )}
      {error ? <p className="mt-3 text-sm text-[var(--px-danger)]">{error}</p> : null}
      <div className="mt-3 space-y-3">
        {visible.map((row) => {
          const po = row.purchaseOrders[0];
          const ordered = po?.orderedQty ?? row.lines.reduce((sum, line) => sum + line.quantity, 0);
          const accepted = po?.acceptedQty ?? 0;
          return (
            <article key={row.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{row.id}{po ? ` · ${po.id}` : ""}</p>
                  <p className="text-sm text-[var(--px-muted)]">{row.siteName} · {row.lineCount} items</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <div>
                  <p className="text-xs text-[var(--px-muted)]">Amount</p>
                  <p className="font-semibold"><Money value={row.totalValue} /></p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--px-muted)]">Supplier</p>
                  <p>{row.supplierSummary}</p>
                </div>
              </div>
              {po ? <div className="mt-3"><ProgressBar accepted={accepted} ordered={ordered} /></div> : null}
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setViewing(row)}>View</Button>
                {row.status === "WAITING_APPROVAL" || row.status === "ON_HOLD" ? <Button variant="danger" className="flex-1" onClick={() => cancel(row.id)}>Cancel</Button> : null}
                {row.status === "DRAFT" || row.status === "RETURNED" ? <Button className="flex-1" onClick={() => { setEditing(row); setCreating(true); }}>Edit</Button> : null}
              </div>
            </article>
          );
        })}
        {visible.length === 0 ? <p className="py-8 text-center text-sm text-[var(--px-muted)]">Nothing in this list.</p> : null}
      </div>
      {creating ? <RequisitionSheet existing={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); load(); }} /> : null}
      {viewing ? (
        <Sheet title={viewing.id} onClose={() => setViewing(null)}>
          <p className="text-sm text-[var(--px-muted)]">{viewing.siteName} · {viewing.supplierSummary}</p>
          <div className="mt-2"><StatusBadge status={viewing.status} /></div>
          {viewing.reviewComment ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">{viewing.reviewComment}</p> : null}
          <ul className="mt-3 divide-y text-sm">
            {viewing.lines.map((line) => (
              <li key={line.id} className="flex justify-between py-2">
                <span>{line.description} × {line.quantity}</span>
                <span>{line.isPriceValid ? <Money value={line.negotiatedPrice * line.quantity} /> : "Unpriced"}</span>
              </li>
            ))}
          </ul>
          {viewing.purchaseOrders.map((order) => (
            <p key={order.id} className="mt-2 text-sm">{order.id} · {order.supplierName} · {order.acceptedQty}/{order.orderedQty}</p>
          ))}
        </Sheet>
      ) : null}
    </div>
  );
}

function RequisitionSheet({ existing, onClose, onSaved }: { existing: Requisition | null; onClose: () => void; onSaved: () => void }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [siteId, setSiteId] = useState(existing?.siteId ?? "");
  const [accountId, setAccountId] = useState(existing?.accountId ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [depotId, setDepotId] = useState("");
  const [query, setQuery] = useState("");
  const [requiredDate, setRequiredDate] = useState(existing?.requiredDate.slice(0, 10) ?? "2026-10-30");
  const [comments, setComments] = useState(existing?.comments ?? "");
  const [lines, setLines] = useState<{ itemId: string; supplierId: string; description: string; quantity: number; priced: boolean; price: number }[]>(
    existing?.lines.map((line) => ({
      itemId: line.itemId,
      supplierId: line.supplierId,
      description: line.description,
      quantity: line.quantity,
      priced: line.isPriceValid,
      price: line.negotiatedPrice,
    })) ?? [],
  );
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Site[]>("/api/v1/sites").then((next) => { setSites(next); setSiteId((current) => current || next[0]?.id || ""); });
    api.get<Account[]>("/api/v1/accounts").then((next) => { setAccounts(next); setAccountId((current) => current || next[0]?.id || ""); });
    api.get<Supplier[]>("/api/v1/suppliers").then((next) => { setSuppliers(next); setSupplierId((current) => current || next[0]?.id || ""); });
  }, []);

  useEffect(() => {
    if (!supplierId) return;
    api.get<Item[]>(`/api/v1/catalogue?supplierId=${supplierId}`).then(setItems).catch(() => undefined);
  }, [supplierId]);

  const depots = suppliers.find((supplier) => supplier.id === supplierId)?.depots ?? [];
  const matches = items.filter((item) => item.description.toLowerCase().includes(query.toLowerCase()));

  function add(item: Item) {
    setLines((current) => {
      const found = current.find((line) => line.itemId === item.id);
      if (found) return current.map((line) => line.itemId === item.id ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { itemId: item.id, supplierId: item.supplierId, description: item.description, quantity: 1, priced: item.priced, price: item.agreedPrice ?? 0 }];
    });
  }

  async function save(submit: boolean, event?: FormEvent) {
    event?.preventDefault();
    setError("");
    if (!navigator.onLine && submit) {
      setError("A requisition can only be submitted when the device is online");
      return;
    }
    const payload = {
      siteId,
      accountId,
      requiredDate,
      comments,
      lines: lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity, depotId: line.supplierId === supplierId ? depotId || null : null })),
    };
    try {
      const saved = existing
        ? await api.patch<Requisition>(`/api/v1/requisitions/${existing.id}`, payload)
        : await api.post<Requisition>("/api/v1/requisitions", payload);
      if (submit) await api.post(`/api/v1/requisitions/${saved.id}/submit`, { online: navigator.onLine });
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save");
    }
  }

  return (
    <Sheet title="New purchase order" onClose={onClose}>
      <form className="space-y-3" onSubmit={(event) => save(true, event)}>
        <Select label="Site" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
          {sites.map((site) => <option key={site.id} value={site.id}>{site.siteName}</option>)}
        </Select>
        <Select label="Funding account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.accountName}</option>)}
        </Select>
        <Select label="Supplier" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </Select>
        <Select label="Depot (optional)" value={depotId} onChange={(event) => setDepotId(event.target.value)}>
          <option value="">Any depot</option>
          {depots.map((depot) => <option key={depot.id} value={depot.id}>{depot.location}</option>)}
        </Select>
        <TextField label="Required date" type="date" value={requiredDate} onChange={(event) => setRequiredDate(event.target.value)} />
        <TextField label="Items" placeholder="Search the catalogue" value={query} onChange={(event) => setQuery(event.target.value)} />
        <ul className="max-h-40 overflow-auto rounded-xl border">
          {matches.slice(0, 8).map((item) => (
            <li key={item.id}>
              <button type="button" className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => add(item)}>
                <span>{item.description}</span>
                <span>{item.priced ? <Money value={item.agreedPrice ?? 0} /> : <span className="text-[var(--px-danger)]">Unpriced</span>}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-[var(--px-muted)]">Change supplier and add more lines. Approval creates one purchase order per supplier.</p>
        <ul className="space-y-2">
          {lines.map((line) => (
            <li key={line.itemId} className="flex items-center justify-between text-sm">
              <span>{line.description}{line.priced ? "" : " · Unpriced"}</span>
              <input className="w-16 rounded-lg border px-2 py-1" type="number" min={1} value={line.quantity} onChange={(event) => setLines((current) => current.map((entry) => entry.itemId === line.itemId ? { ...entry, quantity: Number(event.target.value) } : entry))} />
            </li>
          ))}
        </ul>
        <TextArea label="Comment for the approver" value={comments} onChange={(event) => setComments(event.target.value)} />
        {error ? <p className="text-sm text-[var(--px-danger)]">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={typeof navigator !== "undefined" && !navigator.onLine}>Submit</Button>
          <Button type="button" variant="secondary" className="flex-1" onClick={() => save(false)}>Save draft</Button>
        </div>
      </form>
    </Sheet>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-[420px] overflow-auto rounded-t-3xl bg-white p-5" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={title}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
