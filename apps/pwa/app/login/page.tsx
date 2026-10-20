"use client";

import { Button, TextField } from "@procurex/ui";
import { FormEvent, useState } from "react";
import { api } from "../../lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("sachintha@procurex.test");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api.post<{ token: string }>("/api/v1/auth/login", { email, password });
      sessionStorage.setItem("procurex_token", result.token);
      window.location.href = "/";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#e7edf5] px-4">
      <form onSubmit={onSubmit} className="w-full max-w-[420px] rounded-3xl bg-white p-6 shadow-xl">
        <h1 className="text-xl font-semibold">SiteFlow</h1>
        <p className="mb-4 text-sm text-[var(--px-muted)]">Site manager sign in</p>
        <div className="space-y-3">
          <TextField label="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {error ? <p className="mt-3 text-sm text-[var(--px-danger)]">{error}</p> : null}
        <Button className="mt-4 w-full" type="submit">Sign in</Button>
        <p className="mt-4 text-xs text-[var(--px-muted)]">sachintha@procurex.test · demo1234</p>
      </form>
    </main>
  );
}
