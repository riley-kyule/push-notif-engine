"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { postJson } from "../../../lib/api-client";
import { useToast } from "../../_components/toast";

export function RetryTransientButton({ siteId }: { siteId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  function retry() {
    if (!window.confirm(`Queue eligible transient failures${siteId ? " for this site" : " across all sites"}? Successful and permanent failures will not be resent.`)) {
      return;
    }

    startTransition(() => {
      void postJson<{ data: { queued: number } }>("/api/dashboard/browser-push/retry-transient-failures", {
        ...(siteId ? { siteId } : {}),
        limit: 5_000,
      })
        .then((result) => {
          toast.showSuccess(`Queued ${result.data.queued.toLocaleString()} transient delivery ${result.data.queued === 1 ? "retry" : "retries"}.`);
          router.refresh();
        })
        .catch((error) => toast.showError(error instanceof Error ? error.message : "Unable to retry transient failures."));
    });
  }

  return (
    <button className="button primary" type="button" onClick={retry} disabled={isPending}>
      {isPending ? "Queueing retries..." : "Retry transient failures"}
    </button>
  );
}
