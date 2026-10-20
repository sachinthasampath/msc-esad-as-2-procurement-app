"use client";

import { createClient } from "@procurex/ui";

export const api = createClient("", () => null);

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  level: string | null;
  siteId: string | null;
  siteName: string | null;
};
