"use client";

import { useEffect, useState } from "react";
import { PageHeader, Panel } from "../../../components/kit";
import { api } from "../../../lib/api";

type Supplier = { id: string; name: string; address: string; taxId: string; depots: { id: string; location: string; contactDetails: string }[] };

export default function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  useEffect(() => { api.get<Supplier[]>("/api/v1/suppliers").then(setRows).catch(() => undefined); }, []);
  return (
    <>
      <PageHeader title="Suppliers" subtitle="Orders can only be raised against these suppliers. Each supplier can have more than one depot." />
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((supplier) => (
          <Panel key={supplier.id}>
            <h2 className="font-semibold">{supplier.name}</h2>
            <p className="text-sm text-[var(--px-muted)]">{supplier.address}</p>
            <p className="text-sm text-[var(--px-muted)]">Tax {supplier.taxId}</p>
            <ul className="mt-3 space-y-1 text-sm">
              {supplier.depots.map((depot) => (
                <li key={depot.id}>{depot.location} · {depot.contactDetails}</li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </>
  );
}
