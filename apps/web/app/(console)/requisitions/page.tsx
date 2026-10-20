"use client";

import { Button, Money, Modal, StatusBadge, TextArea } from "@procurex/ui";
import { useEffect, useMemo, useState } from "react";
import { DataTable, FilterChips, Note, PageHeader, Panel } from "../../../components/kit";
import { api, type SessionUser } from "../../../lib/api";
import { downloadCsv } from "../../../lib/csv";

type Line = {
  id: string;
  description: string;
  quantity: number;
  negotiatedPrice: number;
  isPriceValid: boolean;
  approved: boolean;
  supplierName?: string;
  supplierId: string;
};
type Requisition = {
  id: string;
  status: string;
  siteName: string;
  accountName: string;
  createdByName: string;
  totalValue: number;
  comments: string;
  reviewComment: string;
  supplierSummary: string;
  requiredDate: string;
  lines: Line[];
};

const FILTERS = ["All", "Waiting", "Referred", "On hold", "Draft", "Approved", "Declined"];

function matches(row: Requisition, filter: string) {
  if (filter === "All") return true;
  if (filter === "Waiting") return row.status === "WAITING_APPROVAL";
  if (filter === "Referred") return row.status === "REFERRED";
  if (filter === "On hold") return row.status === "ON_HOLD";
  if (filter === "Draft") return row.status === "DRAFT" || row.status === "RETURNED";
  if (filter === "Approved") return row.status === "APPROVED" || row.status === "PARTIALLY_APPROVED";
  return row.status === "DECLINED" || row.status === "CANCELLED";
}

export default function RequisitionsPage() {
  const [rows, setRows] = useState<Requisition[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [filter, setFilter] = useState("Waiting");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Requisition | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  function load() {
    api.get<Requisition[]>("/api/v1/requisitions").then(setRows).catch((caught) => setError(caught.message));
  }

  useEffect(() => {
    load();
    api.get<SessionUser>("/api/v1/auth/me").then(setUser).catch(() => undefined);
  }, []);

  const visible = useMemo(
    () =>
      rows.filter((row) => matches(row, filter) && `${row.id} ${row.siteName} ${row.supplierSummary} ${row.createdByName}`.toLowerCase().includes(search.toLowerCase())),
    [rows, filter, search],
  );

  async function decide(action: "approve" | "decline" | "return" | "partial" | "refer") {
    if (!selected) return;
    setError("");
    try {
      await api.post(`/api/v1/requisitions/${selected.id}/decision`, { action, comment, lineIds: chosen });
      setSelected(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the decision");
    }
  }

  const canDecide = user?.role === "MANAGEMENT_STAFF" && selected && (selected.status === "WAITING_APPROVAL" || selected.status === "REFERRED");

  return (
    <>
      <PageHeader
        title="Requisitions"
        subtitle="Decide requests before they become purchase orders."
        search={search}
        onSearch={setSearch}
        onExport={() => downloadCsv("requisitions.csv", ["Requisition", "Site", "Manager", "Suppliers", "Amount", "Status"], visible.map((row) => [row.id, row.siteName, row.createdByName, row.supplierSummary, row.totalValue, row.status]))}
      />
      <Note>Operational management decides the middle band. Anything above the senior limit is referred, and only a senior manager can approve it.</Note>
      <Panel>
        <div className="mb-3">
          <FilterChips value={filter} options={FILTERS} onChange={setFilter} />
        </div>
        <DataTable columns={["Requisition", "Site", "Raised by", "Suppliers", "Amount", "Status", ""]}>
          {visible.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-3 font-medium">{row.id}</td>
              <td className="px-3 py-3">{row.siteName}</td>
              <td className="px-3 py-3">{row.createdByName}</td>
              <td className="px-3 py-3">{row.supplierSummary}</td>
              <td className="px-3 py-3"><Money value={row.totalValue} /></td>
              <td className="px-3 py-3"><StatusBadge status={row.status} /></td>
              <td className="px-3 py-3 text-right">
                <Button variant="secondary" onClick={() => { setSelected(row); setChosen(row.lines.map((line) => line.id)); setComment(""); setError(""); }}>View</Button>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
      {selected ? (
        <Modal
          title={selected.id}
          onClose={() => setSelected(null)}
          footer={
            canDecide ? (
              <>
                <Button variant="secondary" onClick={() => decide("decline")}>Decline</Button>
                <Button variant="secondary" onClick={() => decide("return")}>Return</Button>
                <Button variant="secondary" onClick={() => decide("refer")}>Refer</Button>
                <Button variant="secondary" onClick={() => decide("partial")}>Partial</Button>
                <Button onClick={() => decide("approve")}>Approve</Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
            )
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Site" value={selected.siteName} />
            <Info label="Account" value={selected.accountName} />
            <Info label="Amount" value={<Money value={selected.totalValue} />} />
            <Info label="Status" value={<StatusBadge status={selected.status} />} />
          </div>
          {selected.comments ? <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm">Comment from site manager: {selected.comments}</p> : null}
          <ul className="mt-4 divide-y">
            {selected.lines.map((line) => (
              <li key={line.id} className="flex items-center gap-3 py-2 text-sm">
                {canDecide ? (
                  <input
                    type="checkbox"
                    checked={chosen.includes(line.id)}
                    onChange={(event) => setChosen((current) => event.target.checked ? [...current, line.id] : current.filter((id) => id !== line.id))}
                  />
                ) : null}
                <span className="flex-1">{line.description} × {line.quantity}</span>
                <span>{line.isPriceValid ? <Money value={line.negotiatedPrice * line.quantity} /> : "Unpriced"}</span>
              </li>
            ))}
          </ul>
          {canDecide ? <div className="mt-4"><TextArea label="Comment" value={comment} onChange={(event) => setComment(event.target.value)} /></div> : null}
          {selected.reviewComment ? <p className="mt-3 text-sm text-[var(--px-muted)]">Last review: {selected.reviewComment}</p> : null}
          {error ? <p className="mt-3 text-sm text-[var(--px-danger)]">{error}</p> : null}
        </Modal>
      ) : null}
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
