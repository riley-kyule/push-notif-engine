import { apiJson } from "../../lib/server-api";

export type StorageHealthStatus = "healthy" | "unhealthy" | "unknown";

export interface StorageHealthSummary {
  status: StorageHealthStatus;
  label: string;
  badgeClass: "active" | "failed" | "pending";
}

interface StorageHealthApiResponse {
  success: true;
  data: {
    status: string;
  };
}

export function summarizeStorageHealth(status: string | null | undefined): StorageHealthSummary {
  if (status === "ok") {
    return { status: "healthy", label: "Storage healthy", badgeClass: "active" };
  }

  if (status) {
    return { status: "unhealthy", label: "Storage offline", badgeClass: "failed" };
  }

  return { status: "unknown", label: "Storage unknown", badgeClass: "pending" };
}

export async function getStorageHealthSummary(): Promise<StorageHealthSummary> {
  const response = await apiJson<StorageHealthApiResponse>("/health/storage");
  return summarizeStorageHealth(response?.data?.status);
}
