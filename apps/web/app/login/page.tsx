"use client";

import { Button, TextField } from "@procurex/ui";
import { FormEvent, useState } from "react";
import { api } from "../../lib/api";

const DEMOS = [
  ["pasan@procurex.test", "Pasan · Procurement"],
  ["jayamadhuka@procurex.test", "Jayamadhuka · Operational manager"],
  ["tharaka@procurex.test", "Tharaka · Senior manager"],
];

export default function LoginPage() {
  const [email, setEmail] = useState("pasan@procurex.test");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api.post("/api/v1/auth/login", { email, password });
      window.location.href = "/dashboard";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-[var(--px-shadow)]">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--px-blue)] font-bold text-white">P</span>
          <div>
            <h1 className="text-xl font-semibold">ProcureX</h1>
            <p className="text-sm text-[var(--px-muted)]">Construction procurement</p>
          </div>
        </div>
        <div className="space-y-3">
          <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        {error ? <p className="mt-3 text-sm text-[var(--px-danger)]">{error}</p> : null}
        <Button className="mt-5 w-full" type="submit">Sign in</Button>
        <ul className="mt-5 space-y-1 text-xs text-[var(--px-muted)]">
          {DEMOS.map(([address, label]) => (
            <li key={address}>
              <button type="button" className="underline" onClick={() => setEmail(address)}>
                {label}
              </button>
              {" · "}
              {address}
            </li>
          ))}
          <li>Password for every demo account: demo1234</li>
        </ul>
      </form>
    </main>
  );
}
