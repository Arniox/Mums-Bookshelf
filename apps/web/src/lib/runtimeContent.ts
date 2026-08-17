import type { PublicSettings, Work } from "@mums-bookshelf/shared";

interface ApiEnvelope<T> {
  data: T;
}

const apiBase = __API_BASE_URL__.replace(/\/$/, "");

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`Content API returned ${response.status} for ${path}.`);
  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}

export async function getRuntimePublicWorks(): Promise<Work[]> {
  const result = await get<{ items: Work[] }>("/api/v1/works?pageSize=50");
  return result.items;
}

export function getRuntimePublicWork(slug: string): Promise<Work> {
  return get<Work>(`/api/v1/works/${encodeURIComponent(slug)}`);
}

export function getRuntimePublicSettings(): Promise<PublicSettings> {
  return get<PublicSettings>("/api/v1/settings/public");
}