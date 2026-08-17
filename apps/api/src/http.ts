import type { Context, Next } from "hono";
import type { AppEnvironment } from "./types";

export class ApiError extends Error {
  constructor(
    public status:
      400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500 | 502 | 503,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function success<T>(context: Context, data: T, status: 200 | 201 = 200) {
  return context.json({ data, requestId: context.get("requestId") }, status);
}

export async function noStorePublicContent(
  context: Context,
  next: Next,
) {
  context.header("Cache-Control", "no-store");
  await next();
}

export function allowedOrigins(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export async function corsMiddleware(
  context: Context<AppEnvironment>,
  next: Next,
) {
  const origin = context.req.header("Origin");
  const allowed = allowedOrigins(context.env.ALLOWED_ORIGINS);
  if (origin && allowed.has(origin)) {
    context.header("Access-Control-Allow-Origin", origin);
    context.header("Access-Control-Allow-Credentials", "true");
    context.header("Vary", "Origin");
    context.header(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, X-CSRF-Token",
    );
    context.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
  }
  if (context.req.method === "OPTIONS") {
    if (!origin || !allowed.has(origin))
      throw new ApiError(403, "origin_not_allowed", "Origin is not allowed.");
    return context.body(null, 204);
  }
  await next();
}

export async function requireAllowedMutationOrigin(
  context: Context<AppEnvironment>,
  next: Next,
) {
  const origin = context.req.header("Origin");
  if (!origin || !allowedOrigins(context.env.ALLOWED_ORIGINS).has(origin)) {
    throw new ApiError(403, "origin_not_allowed", "Origin is not allowed.");
  }
  await next();
}

export async function parseJsonBody(
  context: Context,
  maxBytes = 1_100_000,
): Promise<unknown> {
  const length = Number(context.req.header("Content-Length") || "0");
  if (length > maxBytes)
    throw new ApiError(413, "request_too_large", "Request body is too large.");
  const text = await context.req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new ApiError(413, "request_too_large", "Request body is too large.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
}
