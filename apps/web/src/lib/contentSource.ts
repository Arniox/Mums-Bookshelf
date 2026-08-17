import type { PublicSettings, Work } from "@mums-bookshelf/shared";
import {
  settings as sampleSettings,
  works as sampleWorks,
} from "../data/sample";

interface ApiEnvelope<T> {
  data: T;
}

function configuredApi(): string | undefined {
  const value = process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (
    !value ||
    value.includes("example.workers.dev") ||
    value.includes("localhost")
  )
    return undefined;
  return value;
}

async function apiGet<T>(path: string): Promise<T> {
  const api = configuredApi();
  if (!api) throw new Error("No deployed content API is configured.");
  const response = await fetch(`${api}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`Content API returned ${response.status} for ${path}.`);
  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}

export async function getPublicWorks(): Promise<Work[]> {
  if (!configuredApi()) return sampleWorks;
  const result = await apiGet<{ items: Work[] }>("/api/v1/works?pageSize=50");
  return result.items;
}

export async function getPublicSettings(): Promise<PublicSettings> {
  if (!configuredApi()) return sampleSettings;
  return apiGet<PublicSettings>("/api/v1/settings/public");
}
