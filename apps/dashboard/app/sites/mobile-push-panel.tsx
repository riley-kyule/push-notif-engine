"use client";

import { useEffect, useState, useTransition } from "react";

import type { SiteSummary } from "./sites.utils";

interface MobileCredentialsSummary {
  apnsConfigured: boolean;
  apnsKeyId: string | null;
  apnsTeamId: string | null;
  apnsBundleId: string | null;
  fcmConfigured: boolean;
  fcmProjectId: string | null;
  fcmClientEmail: string | null;
}

interface MobileDeviceCountSummary {
  ios: number;
  android: number;
  active: number;
  invalid: number;
  expired: number;
}

type MobileDevicePlatform = "ios" | "android";
type MobileDeviceStatus = "active" | "invalid" | "expired";

interface MobileDeviceRow {
  id: string;
  platform: MobileDevicePlatform;
  deviceToken: string;
  country: string | null;
  language: string | null;
  status: MobileDeviceStatus;
  lastSeenAt: string | null;
}

const DEVICE_PAGE_SIZE = 10;

function maskToken(token: string): string {
  if (token.length <= 12) {
    return token;
  }
  return `${token.slice(0, 8)}…${token.slice(-4)}`;
}

interface CredentialsForm {
  apnsKeyId: string;
  apnsTeamId: string;
  apnsBundleId: string;
  apnsPrivateKey: string;
  fcmProjectId: string;
  fcmClientEmail: string;
  fcmPrivateKey: string;
}

const emptyForm: CredentialsForm = {
  apnsKeyId: "",
  apnsTeamId: "",
  apnsBundleId: "",
  apnsPrivateKey: "",
  fcmProjectId: "",
  fcmClientEmail: "",
  fcmPrivateKey: "",
};

export function MobilePushPanel({ site }: { site: SiteSummary }) {
  const [credentials, setCredentials] = useState<MobileCredentialsSummary | null>(null);
  const [devices, setDevices] = useState<MobileDeviceCountSummary | null>(null);
  const [form, setForm] = useState<CredentialsForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [deviceRows, setDeviceRows] = useState<MobileDeviceRow[]>([]);
  const [deviceTotal, setDeviceTotal] = useState(0);
  const [devicePage, setDevicePage] = useState(1);
  const [platformFilter, setPlatformFilter] = useState<MobileDevicePlatform | "">("");
  const [statusFilter, setStatusFilter] = useState<MobileDeviceStatus | "">("");
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  function loadDeviceList(page: number, platform: MobileDevicePlatform | "", status: MobileDeviceStatus | "") {
    setDevicesLoading(true);
    setDeviceError(null);
    const query = new URLSearchParams({ page: String(page), limit: String(DEVICE_PAGE_SIZE) });
    if (platform) query.set("platform", platform);
    if (status) query.set("status", status);

    void fetch(`/api/dashboard/sites/${site.id}/mobile-devices?${query.toString()}`)
      .then((response) => response.json())
      .then((payload: { success?: boolean; data?: { items: MobileDeviceRow[]; total: number } }) => {
        if (!payload.success || !payload.data) {
          throw new Error("Unable to load devices");
        }
        setDeviceRows(payload.data.items);
        setDeviceTotal(payload.data.total);
      })
      .catch(() => setDeviceError("Unable to load devices"))
      .finally(() => setDevicesLoading(false));
  }

  useEffect(() => {
    loadDeviceList(devicePage, platformFilter, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id, devicePage, platformFilter, statusFilter]);

  function handleRevokeDevice(device: MobileDeviceRow) {
    if (!window.confirm("Revoke this device? It will stop receiving push notifications.")) {
      return;
    }

    setRevokingDeviceId(device.id);
    void fetch("/api/dashboard/mobile-devices/invalidate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId: site.id, platform: device.platform, deviceToken: device.deviceToken }),
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { success?: boolean } | null;
        if (!response.ok || !payload?.success) {
          throw new Error("Unable to revoke device");
        }
        loadDeviceList(devicePage, platformFilter, statusFilter);
      })
      .catch(() => setDeviceError("Unable to revoke device"))
      .finally(() => setRevokingDeviceId(null));
  }

  const deviceTotalPages = Math.max(1, Math.ceil(deviceTotal / DEVICE_PAGE_SIZE));

  useEffect(() => {
    void fetch(`/api/dashboard/sites/${site.id}/mobile-credentials`)
      .then((response) => response.json())
      .then((payload: { data?: MobileCredentialsSummary | null }) => {
        setCredentials(payload.data ?? null);
        if (payload.data) {
          setForm((current) => ({
            ...current,
            apnsKeyId: payload.data?.apnsKeyId ?? "",
            apnsTeamId: payload.data?.apnsTeamId ?? "",
            apnsBundleId: payload.data?.apnsBundleId ?? "",
            fcmProjectId: payload.data?.fcmProjectId ?? "",
            fcmClientEmail: payload.data?.fcmClientEmail ?? "",
          }));
        }
      })
      .catch(() => setCredentials(null));

    void fetch(`/api/dashboard/sites/${site.id}/mobile-devices/summary`)
      .then((response) => response.json())
      .then((payload: { data?: MobileDeviceCountSummary }) => setDevices(payload.data ?? null))
      .catch(() => setDevices(null));
  }, [site.id]);

  function handleFieldChange(field: keyof CredentialsForm) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  function handleSave() {
    setError(null);
    setSavedMessage(null);
    startTransition(() => {
      void fetch(`/api/dashboard/sites/${site.id}/mobile-credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apnsKeyId: form.apnsKeyId || undefined,
          apnsTeamId: form.apnsTeamId || undefined,
          apnsBundleId: form.apnsBundleId || undefined,
          apnsPrivateKey: form.apnsPrivateKey || undefined,
          fcmProjectId: form.fcmProjectId || undefined,
          fcmClientEmail: form.fcmClientEmail || undefined,
          fcmPrivateKey: form.fcmPrivateKey || undefined,
        }),
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as { success?: boolean; data?: MobileCredentialsSummary } | null;
          if (!response.ok || !payload?.success) {
            throw new Error("Unable to save mobile push credentials");
          }

          setCredentials(payload.data ?? null);
          setForm((current) => ({ ...current, apnsPrivateKey: "", fcmPrivateKey: "" }));
          setSavedMessage("Mobile push credentials saved.");
        })
        .catch((saveError) => {
          setError(saveError instanceof Error ? saveError.message : "Unable to save mobile push credentials");
        });
    });
  }

  function handleSendTest() {
    setDispatchMessage(null);
    startTransition(() => {
      void fetch("/api/dashboard/mobile-push/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.id,
          platform: "all",
          title: "Test notification",
          body: "This is a test push from the Exotic Push Engine dashboard.",
          url: site.url,
        }),
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as { success?: boolean } | null;
          if (!response.ok || !payload?.success) {
            throw new Error("Unable to dispatch test mobile push");
          }

          setDispatchMessage("Test notification queued for delivery.");
        })
        .catch((dispatchError) => {
          setDispatchMessage(dispatchError instanceof Error ? dispatchError.message : "Unable to dispatch test mobile push");
        });
    });
  }

  return (
    <section className="card" style={{ marginTop: 18 }}>
      <h3>Mobile Push (APNs / FCM)</h3>
      <p className="subtle">
        Native iOS and Android push credentials and registered devices for this site. Once configured, your app
        registers its own devices using the REST API credentials below — staff don&apos;t register devices manually.
      </p>

      <div className="grid cards-4" style={{ marginTop: 12 }}>
        <article className="card">
          <p className="subtle">APNs</p>
          <p className="stat">{credentials?.apnsConfigured ? "Configured" : "Not configured"}</p>
        </article>
        <article className="card">
          <p className="subtle">FCM</p>
          <p className="stat">{credentials?.fcmConfigured ? "Configured" : "Not configured"}</p>
        </article>
        <article className="card">
          <p className="subtle">iOS devices</p>
          <p className="stat">{devices?.ios ?? 0}</p>
        </article>
        <article className="card">
          <p className="subtle">Android devices</p>
          <p className="stat">{devices?.android ?? 0}</p>
        </article>
      </div>

      {devices ? (
        <p className="subtle" style={{ marginTop: 12 }}>
          {devices.active} active &middot; {devices.invalid} invalid &middot; {devices.expired} expired
        </p>
      ) : null}

      <div className="actions" style={{ marginTop: 18, alignItems: "center" }}>
        <strong>Registered devices</strong>
        <select
          className="select"
          value={platformFilter}
          onChange={(event) => {
            setDevicePage(1);
            setPlatformFilter(event.target.value as MobileDevicePlatform | "");
          }}
        >
          <option value="">All platforms</option>
          <option value="ios">iOS</option>
          <option value="android">Android</option>
        </select>
        <select
          className="select"
          value={statusFilter}
          onChange={(event) => {
            setDevicePage(1);
            setStatusFilter(event.target.value as MobileDeviceStatus | "");
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="invalid">Invalid</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <table className="table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Device</th>
            <th>Platform</th>
            <th>Country</th>
            <th>Language</th>
            <th>Last Seen</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {deviceRows.map((device) => (
            <tr key={device.id}>
              <td>
                <code>{maskToken(device.deviceToken)}</code>
              </td>
              <td>{device.platform === "ios" ? "iOS" : "Android"}</td>
              <td>{device.country ?? "—"}</td>
              <td>{device.language ?? "—"}</td>
              <td className="subtle">{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "Never"}</td>
              <td>
                <span className={`badge ${device.status}`}>{device.status}</span>
              </td>
              <td>
                {device.status === "active" ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => handleRevokeDevice(device)}
                    disabled={revokingDeviceId === device.id}
                  >
                    {revokingDeviceId === device.id ? "Revoking..." : "Revoke"}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {!devicesLoading && deviceRows.length === 0 ? (
            <tr>
              <td colSpan={7} className="subtle">
                No devices registered yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {deviceError ? <p className="badge failed" style={{ justifyContent: "flex-start", marginTop: 8 }}>{deviceError}</p> : null}

      {deviceTotalPages > 1 ? (
        <div className="actions" style={{ marginTop: 8 }}>
          <button
            className="button secondary"
            type="button"
            onClick={() => setDevicePage((current) => Math.max(1, current - 1))}
            disabled={devicePage <= 1 || devicesLoading}
          >
            Previous
          </button>
          <span className="subtle">
            Page {devicePage} of {deviceTotalPages}
          </span>
          <button
            className="button secondary"
            type="button"
            onClick={() => setDevicePage((current) => Math.min(deviceTotalPages, current + 1))}
            disabled={devicePage >= deviceTotalPages || devicesLoading}
          >
            Next
          </button>
        </div>
      ) : null}

      <div className="grid cards-2" style={{ marginTop: 18 }}>
        <div>
          <p className="subtle" style={{ marginBottom: 8 }}>
            <strong>APNs</strong>
          </p>
          <div className="field">
            <label htmlFor={`apns-key-id-${site.id}`}>Key ID</label>
            <input className="input" id={`apns-key-id-${site.id}`} value={form.apnsKeyId} onChange={handleFieldChange("apnsKeyId")} />
          </div>
          <div className="field">
            <label htmlFor={`apns-team-id-${site.id}`}>Team ID</label>
            <input className="input" id={`apns-team-id-${site.id}`} value={form.apnsTeamId} onChange={handleFieldChange("apnsTeamId")} />
          </div>
          <div className="field">
            <label htmlFor={`apns-bundle-id-${site.id}`}>Bundle ID</label>
            <input className="input" id={`apns-bundle-id-${site.id}`} value={form.apnsBundleId} onChange={handleFieldChange("apnsBundleId")} />
          </div>
          <div className="field">
            <label htmlFor={`apns-private-key-${site.id}`}>Private key</label>
            <textarea
              className="input"
              id={`apns-private-key-${site.id}`}
              placeholder={credentials?.apnsConfigured ? "Leave blank to keep existing" : ".p8 contents"}
              value={form.apnsPrivateKey}
              onChange={handleFieldChange("apnsPrivateKey")}
              rows={3}
            />
          </div>
        </div>
        <div>
          <p className="subtle" style={{ marginBottom: 8 }}>
            <strong>FCM</strong>
          </p>
          <div className="field">
            <label htmlFor={`fcm-project-id-${site.id}`}>Project ID</label>
            <input className="input" id={`fcm-project-id-${site.id}`} value={form.fcmProjectId} onChange={handleFieldChange("fcmProjectId")} />
          </div>
          <div className="field">
            <label htmlFor={`fcm-client-email-${site.id}`}>Client email</label>
            <input className="input" id={`fcm-client-email-${site.id}`} value={form.fcmClientEmail} onChange={handleFieldChange("fcmClientEmail")} />
          </div>
          <div className="field">
            <label htmlFor={`fcm-private-key-${site.id}`}>Private key</label>
            <textarea
              className="input"
              id={`fcm-private-key-${site.id}`}
              placeholder={credentials?.fcmConfigured ? "Leave blank to keep existing" : "Service account private key"}
              value={form.fcmPrivateKey}
              onChange={handleFieldChange("fcmPrivateKey")}
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="actions" style={{ marginTop: 16 }}>
        <button className="button primary" type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save credentials"}
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={handleSendTest}
          disabled={isPending || !(credentials?.apnsConfigured || credentials?.fcmConfigured)}
        >
          Send test notification
        </button>
      </div>

      {savedMessage ? <p className="subtle" style={{ marginTop: 12 }}>{savedMessage}</p> : null}
      {dispatchMessage ? <p className="subtle" style={{ marginTop: 12 }}>{dispatchMessage}</p> : null}
      {error ? <p className="badge failed" style={{ justifyContent: "flex-start", marginTop: 12 }}>{error}</p> : null}

      <p className="subtle" style={{ marginTop: 12 }}>
        Private keys are write-only — they are never sent back to the dashboard after saving.
      </p>
    </section>
  );
}
