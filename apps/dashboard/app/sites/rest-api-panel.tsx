"use client";

import { useState, useTransition } from "react";

import type { SiteSummary } from "./sites.utils";

export function RestApiPanel({ site }: { site: SiteSummary }) {
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generatedKeyId, setGeneratedKeyId] = useState<string | null>(site.restApiKeyId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    startTransition(() => {
      void fetch(`/api/dashboard/sites/${site.id}/rest-api-credentials`, {
        method: "POST",
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as
            | { success?: boolean; data?: { site?: { restApiKeyId?: string }; authToken?: string } }
            | null;

          if (!response.ok || !payload?.data?.authToken) {
            throw new Error("Unable to generate REST API credentials");
          }

          setGeneratedKeyId(payload.data.site?.restApiKeyId ?? null);
          setGeneratedToken(payload.data.authToken);
        })
        .catch((generateError) => {
          setError(generateError instanceof Error ? generateError.message : "Unable to generate REST API credentials");
        });
    });
  }

  async function handleCopy(value: string | null) {
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
  }

  return (
    <section className="card" style={{ marginTop: 18 }}>
      <h3>REST API</h3>
      <p className="subtle">Use these site-scoped credentials for CRM-driven push and scheduling requests.</p>

      <div className="grid cards-2" style={{ marginTop: 12 }}>
        <article className="card">
          <p className="subtle">API key</p>
          <p className="mono">{generatedKeyId ?? site.restApiKeyId ?? "Not generated"}</p>
        </article>
        <article className="card">
          <p className="subtle">Auth token</p>
          <p className="mono">
            {generatedToken
              ? generatedToken
              : site.restApiAuthTokenLast4
                ? `••••${site.restApiAuthTokenLast4}`
                : "Not generated"}
          </p>
        </article>
      </div>

      <div className="actions" style={{ marginTop: 16 }}>
        <button className="button primary" type="button" onClick={handleGenerate} disabled={isPending}>
          {isPending ? "Generating..." : site.restApiKeyId ? "Rotate credentials" : "Generate credentials"}
        </button>
        <button className="button secondary" type="button" onClick={() => handleCopy(generatedToken)} disabled={!generatedToken}>
          Copy auth token
        </button>
      </div>

      <p className="subtle" style={{ marginTop: 12 }}>
        {generatedToken
          ? "Store the token securely now. It will not be shown again."
          : "The auth token is shown once when generated. After that, only the key id and token suffix are retained for reference."}
      </p>

      {error ? <p className="badge failed" style={{ justifyContent: "flex-start" }}>{error}</p> : null}
    </section>
  );
}
