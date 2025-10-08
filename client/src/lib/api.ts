
import type { Analysis, LiveSession, InsertLiveSession } from "@shared/schema";
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

export async function createLiveSession(session: Omit<InsertLiveSession, "deviceId">): Promise<LiveSession> {
  const response = await fetch("/api/live-sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...session,
      deviceId: getDeviceId(),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create live session");
  }

  return response.json();
}

export async function getLiveSession(id: string): Promise<LiveSession> {
  const response = await fetch(`/api/live-sessions/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get live session");
  }

  return response.json();
}

export async function updateLiveSession(id: string, updates: Partial<Omit<InsertLiveSession, "deviceId">>): Promise<LiveSession> {
  const response = await fetch(`/api/live-sessions/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update live session");
  }

  return response.json();
}

export async function getDeviceLiveSessions(): Promise<LiveSession[]> {
  const deviceId = getDeviceId();
  const response = await fetch(`/api/live-sessions/device/${deviceId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get device live sessions");
  }

  return response.json();
}

export async function deleteLiveSession(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/live-sessions/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete live session");
  }

  return response.json();
}

export async function clearDeviceLiveSessions(): Promise<{ deletedCount: number }> {
  const deviceId = getDeviceId();
  const response = await fetch(`/api/live-sessions/device/${deviceId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to clear device live sessions");
  }

  return response.json();
}
