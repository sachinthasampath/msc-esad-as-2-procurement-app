"use client";

import { createClient } from "@procurex/ui";

export const api = createClient(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000", () => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("procurex_token");
});

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  siteName: string | null;
};
