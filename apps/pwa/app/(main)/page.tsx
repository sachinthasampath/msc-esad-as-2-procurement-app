"use client";

import { useEffect, useState } from "react";
import { OrderBoard } from "../../components/orders";
import { api } from "../../lib/api";

type Notice = { id: string; message: string };

export default function HomePage() {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    api.get<Notice[]>("/api/v1/notifications").then(setNotices).catch(() => setNotices([]));
  }, []);

  return (
    <>
      {notices.length > 0 ? (
        <ul className="mb-4 space-y-2">
          {notices.map((notice) => (
            <li key={notice.id} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {notice.message}
            </li>
          ))}
        </ul>
      ) : null}
      <OrderBoard home />
    </>
  );
}
