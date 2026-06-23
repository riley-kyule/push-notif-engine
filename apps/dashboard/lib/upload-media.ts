export interface UploadedMediaAsset {
  id: string;
  publicUrl: string;
}

export async function uploadMedia(siteId: string, kind: "image" | "icon", file: File): Promise<UploadedMediaAsset> {
  const formData = new FormData();
  formData.set("siteId", siteId);
  formData.set("kind", kind);
  formData.set("file", file);

  const response = await fetch("/api/dashboard/campaign-media", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { success?: boolean; data?: UploadedMediaAsset };
  if (!payload.success || !payload.data) {
    throw new Error("Upload failed");
  }

  return payload.data;
}
