"use client";

import { useState, useTransition } from "react";

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
  const [state, setState] = useState<BrowserPushPanelState | null>(null);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      </div>

      {demoMessage ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="subtle">Demo preview</p>
          <p>{demoMessage}</p>
        </div>
      ) : null}
    </section>
  );
}
