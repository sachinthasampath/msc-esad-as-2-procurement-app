"use client";

import { Button, Money, StatusBadge } from "@procurex/ui";
import { useEffect, useState } from "react";
import { DataTable, PageHeader, Panel } from "../../../components/kit";
import { api, type SessionUser } from "../../../lib/api";

type Item = { id: string; supplierName: string; description: string; unitOfMeasure: string; agreedPrice: number | null; priced: boolean };

export default function CataloguePage() {
  const [rows, setRows] = useState<Item[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  function load() {
    api.get<Item[]>("/api/v1/catalogue").then((items) => {
      setRows(items);
      setPrices(Object.fromEntries(items.map((item) => [item.id, item.agreedPrice ? String(item.agreedPrice) : ""])));
    });
  }
  useEffect(() => {
    load();
    api.get<SessionUser>("/api/v1/auth/me").then(setUser).catch(() => undefined);
  }, []);

  async function save(id: string) {
    setError("");
    try {
      await api.post(`/api/v1/catalogue/${id}/price`, { price: Number(prices[id]) });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the price");
    }
  }

  return (
    <>
      <PageHeader title="Catalogue" subtitle="Procurement sets the agreed price. An unpriced line holds the requisition until a price is saved." />
      {error ? <p className="mb-3 text-sm text-[var(--px-danger)]">{error}</p> : null}
      <Panel>
        <DataTable columns={["Item", "Supplier", "Unit", "Agreed price", ""]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-3 font-medium">{row.description}</td>
              <td className="px-3 py-3">{row.supplierName}</td>
              <td className="px-3 py-3">{row.unitOfMeasure}</td>
              <td className="px-3 py-3">
                {row.priced ? <Money value={row.agreedPrice ?? 0} /> : <StatusBadge status="ON_HOLD" />}
                {user?.role === "PROCUREMENT_STAFF" ? (
                  <input
                    className="ml-2 w-28 rounded-lg border px-2 py-1"
                    value={prices[row.id] ?? ""}
                    onChange={(event) => setPrices({ ...prices, [row.id]: event.target.value })}
                    aria-label={`Price for ${row.description}`}
                  />
                ) : null}
              </td>
              <td className="px-3 py-3">
                {user?.role === "PROCUREMENT_STAFF" ? <Button variant="secondary" onClick={() => save(row.id)}>Save price</Button> : null}
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
