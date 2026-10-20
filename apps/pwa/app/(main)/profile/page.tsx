"use client";

import { Button } from "@procurex/ui";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type SessionUser } from "../../../lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    api.get<SessionUser>("/api/v1/auth/me").then(setUser).catch(() => undefined);
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-semibold">Profile</h1>
      <div className="mt-4 rounded-2xl bg-white p-4">
        <p className="text-lg font-semibold">{user?.name}</p>
        <p className="text-sm text-[var(--px-muted)]">{user?.email}</p>
        <p className="mt-2 text-sm">Site manager{user?.siteName ? ` · ${user.siteName}` : ""}</p>
        <p className="mt-2 text-sm">{online ? "Online — you can submit a requisition" : "Offline — submit is blocked"}</p>
      </div>
      <Button
        className="mt-4 w-full"
        variant="secondary"
        onClick={async () => {
          sessionStorage.removeItem("procurex_token");
          await api.post("/api/v1/auth/logout").catch(() => undefined);
          router.replace("/login");
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
