import type { Analysis } from "@shared/schema";

export async function analyzeFile(file: File): Promise<Analysis> {
  const formData = new FormData();
  formData.append("file", file);

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

export async function getAllAnalyses(): Promise<Analysis[]> {
  const response = await fetch("/api/analyses");
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get analyses");
  }

  return response.json();
}
