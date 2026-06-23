"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function CheckConnectionButton({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCheck() {
    setMessage(null);
    startTransition(() => {
      void fetch(`/api/dashboard/sites/${siteId}/check-connection`, { method: "POST" })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as { success?: boolean; error?: { message?: string } } | null;
          if (!response.ok || !payload?.success) {
            throw new Error(payload?.error?.message ?? "Site is unreachable right now.");
          }

          setMessage("Reachable just now.");
          router.refresh();
        })
        .catch((error) => {
          setMessage(error instanceof Error ? error.message : "Site is unreachable right now.");
        });
    });
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 6 }}>
      <button className="button secondary" type="button" onClick={handleCheck} disabled={isPending}>
        {isPending ? "Checking..." : "Check connection now"}
      </button>
      {message ? <span className="subtle">{message}</span> : null}
    </span>
  );
}
