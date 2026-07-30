"use client";

import { useEffect, useState, useTransition } from "react";

import { useToast } from "../_components/toast";

interface NativeSignInSettings {
  nativeSignInEnabled: boolean;
  nativeSignInForced: boolean;
  googleClientId: string | null;
}

interface ApiPayload {
  data?: NativeSignInSettings;
  error?: { message?: string };
}

export function NativeSignInPanel() {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState<NativeSignInSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/dashboard/health/native-sign-in", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as ApiPayload | null;
        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error?.message ?? "Unable to load native sign-in status");
        }
        setSettings(payload.data);
      })
      .catch((error) => {
        toast.showError(error instanceof Error ? error.message : "Unable to load native sign-in status");
      })
      .finally(() => setLoading(false));
  }, [toast]);

  function update(enabled: boolean) {
    const confirmation = enabled
      ? "Enable email and password sign-in again?"
      : "Deactivate email and password sign-in? Existing sessions will remain active, but future password logins will be rejected.";
    if (!window.confirm(confirmation)) return;

    startTransition(() => {
      void fetch("/api/dashboard/health/native-sign-in", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as ApiPayload | null;
          if (!response.ok || !payload?.data) {
            throw new Error(payload?.error?.message ?? "Unable to update native sign-in");
          }
          setSettings(payload.data);
          toast.showSuccess(
            enabled
              ? "Native email and password sign-in is enabled."
              : "Native email and password sign-in is deactivated. Google Sign-In remains available.",
          );
        })
        .catch((error) => {
          toast.showError(error instanceof Error ? error.message : "Unable to update native sign-in");
        });
    });
  }

  const enabled = settings?.nativeSignInEnabled ?? true;
  const forced = settings?.nativeSignInForced ?? false;
  const googleConfigured = Boolean(settings?.googleClientId);

  return (
    <section className="card platform-health-deployment-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Authentication</p>
          <h3>Native sign-in</h3>
        </div>
        <span className="badge warn">Super admin only</span>
      </div>

      <div className="grid cards-2" style={{ marginTop: 14 }}>
        <article className="card" style={{ margin: 0 }}>
          <p className="eyebrow">Current status</p>
          <p className="stat" style={{ marginBottom: 6 }}>
            {loading ? "Checking..." : enabled ? "Enabled" : "Deactivated"}
          </p>
          <p className="subtle">
            {forced
              ? "Enabled by the EPE_FORCE_NATIVE_SIGN_IN emergency recovery override."
              : enabled
              ? "Users may sign in with email and password or Google."
              : "Email and password fields are hidden, and the API rejects native login attempts."}
          </p>
        </article>

        <article className="card" style={{ margin: 0 }}>
          <p className="eyebrow">Google Sign-In</p>
          <p className="stat" style={{ marginBottom: 6 }}>
            {loading ? "Checking..." : googleConfigured ? "Configured" : "Unavailable"}
          </p>
          <p className="subtle">
            Native sign-in cannot be deactivated unless Google Sign-In is configured as the recovery login method.
          </p>
        </article>
      </div>

      <button
        className="button primary"
        type="button"
        disabled={loading || isPending || !settings || forced || (enabled && !googleConfigured)}
        onClick={() => update(!enabled)}
        style={{ marginTop: 14 }}
      >
        {isPending
          ? "Saving..."
          : enabled
            ? "Deactivate native sign-in"
            : "Activate native sign-in"}
      </button>
    </section>
  );
}
