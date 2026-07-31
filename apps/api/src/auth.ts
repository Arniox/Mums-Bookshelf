import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context, Next } from "hono";
import {
  createAccessToken,
  randomToken,
  sha256,
  verifyAccessToken,
  verifyPassword,
} from "./crypto";
import { ApiError } from "./http";
import type { AppEnvironment } from "./types";

const refreshCookie = "__Host-author_refresh";

export async function enforceRateLimit(
  context: Context<AppEnvironment>,
  category: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const key = await sha256(
    `${category}:${identifier}:${context.env.IP_HASH_SECRET}`,
  );
  await context.env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count, expires_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1`,
  )
    .bind(key, windowStart, windowStart + windowSeconds * 2)
    .run();
  const row = await context.env.DB.prepare(
    "SELECT count FROM rate_limits WHERE key = ? AND window_start = ?",
  )
    .bind(key, windowStart)
    .first<{ count: number }>();
  if ((row?.count ?? 0) > limit) {
    throw new ApiError(
      429,
      "rate_limited",
      "Too many requests. Please try again later.",
    );
  }
}

export async function login(
  context: Context<AppEnvironment>,
  username: string,
  password: string,
) {
  const ip = context.req.header("CF-Connecting-IP") || "unknown";
  await enforceRateLimit(
    context,
    "login",
    `${ip}:${username.toLowerCase()}`,
    7,
    900,
  );
  const user = await context.env.DB.prepare(
    "SELECT id, username, password_hash, enabled FROM admin_users WHERE username = ? COLLATE NOCASE",
  )
    .bind(username)
    .first<{
      id: string;
      username: string;
      password_hash: string;
      enabled: number;
    }>();
  const valid =
    user?.enabled === 1 &&
    (await verifyPassword(
      password,
      context.env.PASSWORD_PEPPER,
      user.password_hash,
    ));
  if (!user || !valid) {
    throw new ApiError(
      401,
      "invalid_credentials",
      "Username or password is incorrect.",
    );
  }

  const sessionId = crypto.randomUUID();
  const refreshToken = randomToken();
  const refreshHash = await sha256(refreshToken);
  const ttl = Number(context.env.AUTH_REFRESH_TOKEN_TTL_SECONDS);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(sessionId, user.id, refreshHash, expiresAt, now),
    context.env.DB.prepare(
      "UPDATE admin_users SET last_login_at = ?, updated_at = ? WHERE id = ?",
    ).bind(now, now, user.id),
  ]);
  setCookie(context, refreshCookie, refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
    maxAge: ttl,
  });
  return {
    accessToken: await createAccessToken(context.env, user, sessionId),
    expiresIn: Number(context.env.AUTH_ACCESS_TOKEN_TTL_SECONDS),
    user: { id: user.id, username: user.username },
  };
}

export async function refresh(context: Context<AppEnvironment>) {
  const token = getCookie(context, refreshCookie);
  if (!token)
    throw new ApiError(
      401,
      "invalid_session",
      "Session is invalid or expired.",
    );
  const hash = await sha256(token);
  const session = await context.env.DB.prepare(
    `SELECT s.id, s.user_id, s.expires_at, s.revoked_at, u.username, u.enabled
     FROM sessions s JOIN admin_users u ON u.id = s.user_id WHERE s.token_hash = ?`,
  )
    .bind(hash)
    .first<{
      id: string;
      user_id: string;
      expires_at: string;
      revoked_at: string | null;
      username: string;
      enabled: number;
    }>();
  if (
    !session ||
    session.revoked_at ||
    session.enabled !== 1 ||
    Date.parse(session.expires_at) <= Date.now()
  ) {
    deleteCookie(context, refreshCookie, {
      path: "/",
      secure: true,
      sameSite: "None",
    });
    throw new ApiError(
      401,
      "invalid_session",
      "Session is invalid or expired.",
    );
  }
  return {
    accessToken: await createAccessToken(
      context.env,
      { id: session.user_id, username: session.username },
      session.id,
    ),
    expiresIn: Number(context.env.AUTH_ACCESS_TOKEN_TTL_SECONDS),
    user: { id: session.user_id, username: session.username },
  };
}

export async function logout(context: Context<AppEnvironment>) {
  const token = getCookie(context, refreshCookie);
  if (token) {
    const hash = await sha256(token);
    await context.env.DB.prepare(
      "UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
    )
      .bind(new Date().toISOString(), hash)
      .run();
  }
  deleteCookie(context, refreshCookie, {
    path: "/",
    secure: true,
    sameSite: "None",
  });
}

export async function requireAuth(
  context: Context<AppEnvironment>,
  next: Next,
) {
  const header = context.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(
      401,
      "authentication_required",
      "Authentication is required.",
    );
  }
  try {
    const { payload } = await verifyAccessToken(context.env, header.slice(7));
    const sessionId = String(payload.sid || "");
    const session = await context.env.DB.prepare(
      `SELECT s.revoked_at, s.expires_at, u.enabled
       FROM sessions s JOIN admin_users u ON u.id = s.user_id
       WHERE s.id = ? AND s.user_id = ?`,
    )
      .bind(sessionId, payload.sub)
      .first<{
        revoked_at: string | null;
        expires_at: string;
        enabled: number;
      }>();
    if (
      !session ||
      session.revoked_at ||
      session.enabled !== 1 ||
      Date.parse(session.expires_at) <= Date.now()
    ) {
      throw new Error("Inactive session");
    }
    context.set("user", {
      id: String(payload.sub),
      username: String(payload.username),
      sessionId,
    });
    await next();
  } catch {
    throw new ApiError(
      401,
      "invalid_access_token",
      "Authentication is invalid or expired.",
    );
  }
}
