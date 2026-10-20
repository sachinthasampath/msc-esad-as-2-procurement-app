"use client";

import { Button, formatMoney, TextField } from "@procurex/ui";
import { useEffect, useState } from "react";
import { Note, PageHeader, Panel } from "../../../components/kit";
import { api } from "../../../lib/api";

export default function SettingsPage() {
  const [autoApproveLimit, setAuto] = useState("10000");
  const [managerLimit, setManager] = useState("100000");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<{ autoApproveLimit: number; managerLimit: number }>("/api/v1/settings").then((policy) => {
      setAuto(String(policy.autoApproveLimit));
      setManager(String(policy.managerLimit));
    });
  }, []);

  const auto = Number(autoApproveLimit);
  const manager = Number(managerLimit);
  const example = 50_000;
  const path = example <= auto ? "be approved by the system" : example <= manager ? "wait for operational management" : "be referred to senior management";

  async function save() {
    setError("");
    setMessage("");
    try {
      await api.put("/api/v1/settings", { autoApproveLimit: auto, managerLimit: manager });
      setMessage("Approval rules saved. The next submission uses them.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save");
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="These two numbers are the approval strategy. Change them to show another procurement context." />
      <Panel>
        <div className="grid max-w-xl gap-4">
          <TextField label="Auto-approve at or under (Rs.)" type="number" value={autoApproveLimit} onChange={(event) => setAuto(event.target.value)} />
          <TextField label="Operational manager at or under (Rs.)" type="number" value={managerLimit} onChange={(event) => setManager(event.target.value)} />
          <Note>A requisition of {formatMoney(example)} would {path}.</Note>
          {message ? <p className="text-sm text-[var(--px-success)]">{message}</p> : null}
          {error ? <p className="text-sm text-[var(--px-danger)]">{error}</p> : null}
          <Button onClick={save} className="w-fit">Save rules</Button>
        </div>
      </Panel>
    </>
  );
}
