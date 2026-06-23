"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { SiteSummary } from "./sites.utils";
import {
  sendBrowserPushDemoNotification,
  subscribeBrowserPush,
} from "../../src/browser-push/register-browser-push";

interface BrowserPushPanelState {
  supported: boolean;
  registered: boolean;
  subscribed: boolean;
  permission: NotificationPermission | "unsupported";
  endpoint: string | null;
  message: string;
}

export function BrowserPushPanel({ site }: { site: SiteSummary }) {
  const router = useRouter();
  const [state, setState] = useState<BrowserPushPanelState | null>(null);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const [vapidError, setVapidError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isGeneratingVapid, startVapidGeneration] = useTransition();

  function handleGenerateVapid() {
    if (
      site.vapidPublicKey &&
      !window.confirm("Regenerate VAPID keys? Every existing browser push subscriber for this site will stop receiving notifications and must re-subscribe.")
    ) {
      return;
    }

    setVapidError(null);
    startVapidGeneration(() => {
      void fetch(`/api/dashboard/sites/${site.id}/generate-vapid`, { method: "POST" })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
          if (!response.ok) {
            throw new Error(payload?.error?.message ?? "Unable to generate VAPID keys");
          }
          router.refresh();
        })
        .catch((error) => {
          setVapidError(error instanceof Error ? error.message : "Unable to generate VAPID keys");
        });
    });
  }

  function handleRegister() {
    startTransition(() => {
      void subscribeBrowserPush({
        scriptUrl: "/browser-push-sw.js",
        vapidPublicKey: site.vapidPublicKey,
      })
        .then((result) => {
          setState({
            ...result,
            message: result.subscribed
              ? "Browser push subscription is ready in the local dashboard."
              : result.supported
                ? "Browser push service worker is registered, but subscription needs a real VAPID key."
                : "Browser push is not supported in this browser.",
          });
        })
        .catch((error) => {
          setState({
            supported: true,
            registered: false,
            subscribed: false,
            permission: "unsupported",
            endpoint: null,
            message: error instanceof Error ? error.message : "Unable to register browser push.",
          });
      });
    });
  }

  function handleDemoPreview() {
    startTransition(() => {
      void sendBrowserPushDemoNotification(site)
        .then((result) => {
          setDemoMessage(result.message);
        })
        .catch((error) => {
          setDemoMessage(error instanceof Error ? error.message : "Unable to send the preview notification.");
        });
    });
  }

  return (
    <section className="card" style={{ marginTop: 18 }}>
      <h3>Browser Push</h3>
      <p className="subtle">Local browser push support for this site preview.</p>
      <div className="grid cards-3" style={{ marginTop: 12 }}>
        <article className="card">
          <p className="subtle">Service worker</p>
          <p className="stat">/browser-push-sw.js</p>
        </article>
        <article className="card">
          <p className="subtle">VAPID key</p>
          <p className="stat">{site.vapidPublicKey ? "Configured" : "Missing"}</p>
        </article>
        <article className="card">
          <p className="subtle">Permission</p>
          <p className="stat">{state?.permission ?? (typeof Notification !== "undefined" ? Notification.permission : "unsupported")}</p>
        </article>
      </div>

      {state ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="subtle">Result</p>
          <p>{state.message}</p>
          <p className="subtle">Endpoint</p>
          <p className="mono">{state.endpoint ?? "Not subscribed yet"}</p>
        </div>
      ) : null}

      <div className="actions" style={{ marginTop: 16 }}>
        <button className="button primary" type="button" onClick={handleRegister} disabled={isPending}>
          {isPending ? "Checking..." : "Register Browser Push"}
        </button>
        <button className="button secondary" type="button" onClick={handleDemoPreview} disabled={isPending}>
          Send Demo Notification
        </button>
        <button className="button secondary" type="button" onClick={handleGenerateVapid} disabled={isGeneratingVapid}>
          {isGeneratingVapid ? "Generating..." : site.vapidPublicKey ? "Regenerate VAPID keys" : "Generate VAPID keys"}
        </button>
      </div>

      {vapidError ? <p className="badge failed" style={{ justifyContent: "flex-start", marginTop: 12 }}>{vapidError}</p> : null}

      {demoMessage ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="subtle">Demo preview</p>
          <p>{demoMessage}</p>
        </div>
      ) : null}
    </section>
  );
}
