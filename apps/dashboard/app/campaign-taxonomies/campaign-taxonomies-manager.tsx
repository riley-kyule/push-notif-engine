"use client";

import { useMemo, useState, useTransition } from "react";

import type { CampaignTaxonomyChoice } from "../_data/campaign-taxonomies";

function emptyForm() {
  return {
    slug: "",
    label: "",
    description: "",
    sortOrder: "0",
    isActive: true,
  };
}

export function CampaignTaxonomiesManager({ initialTaxonomies }: { initialTaxonomies: CampaignTaxonomyChoice[] }) {
  const [taxonomies, setTaxonomies] = useState(initialTaxonomies);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const editingTaxonomy = useMemo(() => taxonomies.find((taxonomy) => taxonomy.id === editingId) ?? null, [editingId, taxonomies]);

  function beginCreate() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function beginEdit(taxonomy: CampaignTaxonomyChoice) {
    setEditingId(taxonomy.id);
    setForm({
      slug: taxonomy.slug,
      label: taxonomy.label,
      description: taxonomy.description ?? "",
      sortOrder: String(taxonomy.sortOrder),
      isActive: taxonomy.isActive,
    });
  }

  function reload(nextTaxonomies: CampaignTaxonomyChoice[]) {
    setTaxonomies(nextTaxonomies.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)));
  }

  function submitForm() {
    setMessage(null);
    startTransition(() => {
      const payload = {
        slug: form.slug,
        label: form.label,
        description: form.description || null,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };

      const request = editingId
        ? fetch(`/api/dashboard/campaign-taxonomies/${editingId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
        : fetch("/api/dashboard/campaign-taxonomies", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });

      void request
        .then(async (response) => {
          const data = (await response.json().catch(() => null)) as { success?: boolean; data?: CampaignTaxonomyChoice; error?: { message?: string } } | null;
          if (!response.ok || !data?.data) {
            throw new Error(data?.error?.message ?? "Unable to save taxonomy");
          }

          if (editingId) {
            reload(taxonomies.map((taxonomy) => (taxonomy.id === editingId ? data.data! : taxonomy)));
            setMessage("Taxonomy updated.");
          } else {
            reload([...taxonomies, data.data]);
            setMessage("Taxonomy added.");
          }

          beginCreate();
        })
        .catch((error) => {
          setMessage(error instanceof Error ? error.message : "Unable to save taxonomy");
        });
    });
  }

  function handleDelete(id: string) {
    setMessage(null);
    startTransition(() => {
      void fetch(`/api/dashboard/campaign-taxonomies/${id}`, { method: "DELETE" })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Unable to delete taxonomy");
          }
          reload(taxonomies.filter((taxonomy) => taxonomy.id !== id));
          if (editingId === id) {
            beginCreate();
          }
          setMessage("Taxonomy deleted.");
        })
        .catch((error) => {
          setMessage(error instanceof Error ? error.message : "Unable to delete taxonomy");
        });
    });
  }

  return (
    <div className="grid cards-2">
      <section className="card">
        <h3>{editingTaxonomy ? "Edit taxonomy" : "Add taxonomy"}</h3>
        <div className="field">
          <label htmlFor="slug">Slug</label>
          <input
            className="input"
            id="slug"
            value={form.slug}
            disabled={Boolean(editingId)}
            onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="label">Label</label>
          <input className="input" id="label" value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} />
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            className="textarea"
            id="description"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
        </div>
        <div className="grid cards-2">
          <div className="field">
            <label htmlFor="sortOrder">Sort order</label>
            <input
              className="input"
              id="sortOrder"
              type="number"
              value={form.sortOrder}
              onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
            />
          </div>
          <label htmlFor="isActive" style={{ display: "inline-flex", alignSelf: "end", alignItems: "center", gap: 8 }}>
            <input
              id="isActive"
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            <span>Active</span>
          </label>
        </div>
        <div className="actions" style={{ justifyContent: "space-between", marginTop: 18 }}>
          <button className="button secondary" type="button" onClick={beginCreate} disabled={isPending}>
            Reset
          </button>
          <button className="button primary" type="button" onClick={submitForm} disabled={isPending || !form.slug.trim() || !form.label.trim()}>
            {editingId ? "Update taxonomy" : "Add taxonomy"}
          </button>
        </div>
        {message ? <p className="subtle" style={{ marginTop: 12 }}>{message}</p> : null}
      </section>

      <section className="card">
        <h3>Managed taxonomies</h3>
        <div style={{ display: "grid", gap: 12 }}>
          {taxonomies.map((taxonomy) => (
            <article key={taxonomy.id} className="card" style={{ boxShadow: "none", background: "var(--surface-raised)" }}>
              <div className="actions" style={{ justifyContent: "space-between" }}>
                <div>
                  <strong>{taxonomy.label}</strong>
                  <div className="subtle">{taxonomy.slug}</div>
                  {taxonomy.description ? <div className="subtle">{taxonomy.description}</div> : null}
                </div>
                <span className={`badge ${taxonomy.isActive ? "active" : "inactive"}`}>{taxonomy.isActive ? "Active" : "Inactive"}</span>
              </div>
              <div className="actions" style={{ marginTop: 12 }}>
                <button className="button secondary" type="button" onClick={() => beginEdit(taxonomy)}>
                  Edit
                </button>
                <button className="button secondary" type="button" onClick={() => handleDelete(taxonomy.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
