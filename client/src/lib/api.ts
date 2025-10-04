
import type { Analysis } from "@shared/schema";
import { getDeviceId } from "./deviceId";

export async function analyzeFile(file: File): Promise<Analysis> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("deviceId", getDeviceId());

  const response = await fetch("/api/analyze", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to analyze file");
  }

  return response.json();
}

export async function getAnalysis(id: string): Promise<Analysis> {
  const response = await fetch(`/api/analysis/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get analysis");
  }

  return response.json();
}

export async function getDeviceHistory(): Promise<Analysis[]> {
  const deviceId = getDeviceId();
  const response = await fetch(`/api/analyses/device/${deviceId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get device history");
  }

  return response.json();
}

export async function clearDeviceHistory(): Promise<{ deletedCount: number }> {
  const deviceId = getDeviceId();
  const response = await fetch(`/api/analyses/device/${deviceId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to clear device history");
  }

  return response.json();
}
