"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface GalleryAsset {
  id: string;
  publicUrl: string;
  originalName: string;
  kind: "image" | "icon";
}

interface MediaGalleryPickerProps {
  siteId: string;
  kind: "image" | "icon";
  onSelect: (asset: { id: string; publicUrl: string }) => void;
}

export function MediaGalleryPicker({ siteId, kind, onSelect }: MediaGalleryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<GalleryAsset[]>([]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setIsLoading(true);
    setError(null);
    const search = new URLSearchParams({ siteId, kind });
    void fetch(`/api/dashboard/campaign-media?${search.toString()}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { success?: boolean; data?: { items?: GalleryAsset[] }; error?: { message?: string } }
          | null;

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error?.message ?? "Unable to load library");
        }

        setAssets(payload.data.items ?? []);
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load library");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, siteId, kind]);

  if (!isOpen) {
    return (
      <button type="button" className="button secondary gallery-trigger" disabled={!siteId} onClick={() => setIsOpen(true)}>
        Choose from library
      </button>
    );
  }

  return (
    <>
      <button type="button" className="button secondary gallery-trigger" onClick={() => setIsOpen(true)}>
        Choose from library
      </button>
      {createPortal(
        // Rendered at document.body, not in place -- .card (the form
        // wrapper this button sits inside) uses backdrop-filter, which
        // creates a new containing block for position:fixed descendants.
        // Left in place, this modal would center itself relative to that
        // tall scrollable card instead of the viewport, landing off-screen.
        <div className="modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="modal-panel-header">
              <h3>Media library</h3>
              <button type="button" className="button secondary" onClick={() => setIsOpen(false)}>
                Close
              </button>
            </div>

            {isLoading ? <p className="subtle">Loading...</p> : null}
            {error ? <p className="badge failed">{error}</p> : null}
            {!isLoading && !error && assets.length === 0 ? (
              <p className="subtle">No previously uploaded {kind === "image" ? "images" : "icons"} for this site yet.</p>
            ) : null}

            <div className="media-gallery-grid">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className="media-gallery-item"
                  title={asset.originalName}
                  onClick={() => {
                    onSelect({ id: asset.id, publicUrl: asset.publicUrl });
                    setIsOpen(false);
                  }}
                >
                  <img src={asset.publicUrl} alt={asset.originalName} />
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
