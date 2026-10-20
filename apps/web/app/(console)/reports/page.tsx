"use client";

import { Money } from "@procurex/ui";
import { useEffect, useState } from "react";
import { DataTable, PageHeader, Panel } from "../../../components/kit";
import { api } from "../../../lib/api";

type Group = { name: string; count: number; total: number };

export default function ReportsPage() {
  const [data, setData] = useState<{ byManager: Group[]; bySupplier: Group[] } | null>(null);
  useEffect(() => { api.get<NonNullable<typeof data>>("/api/v1/reports").then(setData).catch(() => undefined); }, []);
  return (
    <>
      <PageHeader title="Reports" subtitle="Purchase orders grouped the way the brief asks: by site manager, and by supplier." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-2 font-medium">By site manager</h2>
          <DataTable columns={["Site manager", "Orders", "Value"]}>
            {(data?.byManager ?? []).map((row) => (
              <tr key={row.name}>
                <td className="px-3 py-3">{row.name}</td>
                <td className="px-3 py-3">{row.count}</td>
                <td className="px-3 py-3"><Money value={row.total} /></td>
              </tr>
            ))}
          </DataTable>
        </Panel>
        <Panel>
          <h2 className="mb-2 font-medium">By supplier</h2>
          <DataTable columns={["Supplier", "Orders", "Value"]}>
            {(data?.bySupplier ?? []).map((row) => (
              <tr key={row.name}>
                <td className="px-3 py-3">{row.name}</td>
                <td className="px-3 py-3">{row.count}</td>
                <td className="px-3 py-3"><Money value={row.total} /></td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </div>
    </>
  );
}
