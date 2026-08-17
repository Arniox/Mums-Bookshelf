import {
    commentInputSchema,
    commentModerationSchema,
} from "@mums-bookshelf/shared/schemas";
import type { Context } from "hono";
import { enforceRateLimit } from "./auth";
import { sha256 } from "./crypto";
import { ApiError, parseJsonBody, success } from "./http";
import type { AppEnvironment } from "./types";

function commentsEnabled(context: Context<AppEnvironment>) {
  return context.env.PUBLIC_COMMENTS_ENABLED.toLowerCase() === "true";
}

function sanitiseCommentText(value: string): string {
  return [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || code >= 32;
    })
    .join("");
}

export async function listPublicComments(context: Context<AppEnvironment>) {
  if (!commentsEnabled(context))
    return success(context, { items: [], enabled: false });
  const result = await context.env.DB.prepare(
    `SELECT id, display_name, body, created_at, parent_comment_id
     FROM comments WHERE work_id = ? AND moderation_status = 'approved' AND deleted_at IS NULL
     ORDER BY created_at ASC LIMIT 100`,
  )
    .bind(context.req.param("id"))
    .all();
  return success(context, {
    enabled: true,
    items: result.results.map((row) => ({
      id: row.id,
      displayName: row.display_name || "Anonymous",
      body: row.body,
      createdAt: row.created_at,
      parentCommentId: row.parent_comment_id,
    })),
  });
}

async function verifyTurnstile(
  context: Context<AppEnvironment>,
  token?: string,
) {
  if (!context.env.TURNSTILE_SECRET_KEY) return;
  if (!token)
    throw new ApiError(
      422,
      "turnstile_required",
      "Please complete the verification.",
    );
  const body = new FormData();
  body.set("secret", context.env.TURNSTILE_SECRET_KEY);
  body.set("response", token);
  body.set("remoteip", context.req.header("CF-Connecting-IP") || "");
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body,
    },
  );
  const result = (await response.json()) as { success: boolean };
  if (!result.success)
    throw new ApiError(422, "turnstile_failed", "Verification failed.");
}

export async function createComment(context: Context<AppEnvironment>) {
  if (!commentsEnabled(context))
    throw new ApiError(404, "comments_disabled", "Comments are not enabled.");
  const parsed = commentInputSchema.safeParse(
    await parseJsonBody(context, 10_000),
  );
  if (!parsed.success) {
    throw new ApiError(
      422,
      "validation_failed",
      parsed.error.issues[0]?.message || "Comment is invalid.",
    );
  }
  if (parsed.data.website) return success(context, { pending: true }, 201);
  const work = await context.env.DB.prepare(
    "SELECT id FROM works WHERE id = ? AND status = 'published'",
  )
    .bind(context.req.param("id"))
    .first();
  if (!work) throw new ApiError(404, "work_not_found", "Work was not found.");
  const ip = context.req.header("CF-Connecting-IP") || "unknown";
  await enforceRateLimit(context, "comment", ip, 5, 3600);
  await verifyTurnstile(context, parsed.data.turnstileToken);
  await context.env.DB.prepare(
    `INSERT INTO comments
      (id, work_id, display_name, body, moderation_status, created_at, ip_hash)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      context.req.param("id"),
      parsed.data.displayName || null,
      sanitiseCommentText(parsed.data.body),
      new Date().toISOString(),
      await sha256(`${ip}:${context.env.IP_HASH_SECRET}`),
    )
    .run();
  return success(context, { pending: true }, 201);
}

export async function listAdminComments(context: Context<AppEnvironment>) {
  const status = context.req.query("status") || "pending";
  const result = await context.env.DB.prepare(
    `SELECT c.id, c.work_id, c.display_name, c.body, c.moderation_status, c.created_at,
            c.approved_at, w.title AS work_title
     FROM comments c JOIN works w ON w.id = c.work_id
     WHERE c.deleted_at IS NULL AND (? = 'all' OR c.moderation_status = ?)
     ORDER BY c.created_at DESC LIMIT 200`,
  )
    .bind(status, status)
    .all();
  return success(context, { items: result.results });
}

export async function moderateComment(context: Context<AppEnvironment>) {
  const parsed = commentModerationSchema.safeParse(
    await parseJsonBody(context, 2_000),
  );
  if (!parsed.success)
    throw new ApiError(
      422,
      "validation_failed",
      "Moderation status is invalid.",
    );
  const approvedAt =
    parsed.data.moderationStatus === "approved"
      ? new Date().toISOString()
      : null;
  const result = await context.env.DB.prepare(
    "UPDATE comments SET moderation_status = ?, approved_at = ? WHERE id = ? AND deleted_at IS NULL",
  )
    .bind(parsed.data.moderationStatus, approvedAt, context.req.param("id"))
    .run();
  if (!result.meta.changes)
    throw new ApiError(404, "comment_not_found", "Comment was not found.");
  return success(context, { updated: true });
}

export async function deleteComment(context: Context<AppEnvironment>) {
  const result = await context.env.DB.prepare(
    "UPDATE comments SET deleted_at = ?, deleted_reason = 'admin' WHERE id = ? AND deleted_at IS NULL",
  )
    .bind(new Date().toISOString(), context.req.param("id"))
    .run();
  if (!result.meta.changes)
    throw new ApiError(404, "comment_not_found", "Comment was not found.");
  return success(context, { deleted: true });
}
