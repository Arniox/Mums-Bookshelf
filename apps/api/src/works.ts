import {
  calculateReadingTime,
  detectSocialProvider,
  slugify,
  workInputSchema,
  workPatchSchema,
} from "@mums-bookshelf/shared";
import type { Context } from "hono";
import { rowToWork, workColumns } from "./db";
import { ApiError, parseJsonBody, success } from "./http";
import type { AppEnvironment } from "./types";

export async function listPublicWorks(context: Context<AppEnvironment>) {
  const query = context.req.query("q")?.trim();
  const type = context.req.query("type")?.trim();
  const page = Math.max(1, Number(context.req.query("page") || 1));
  const pageSize = Math.min(
    50,
    Math.max(1, Number(context.req.query("pageSize") || 24)),
  );
  const conditions = ["status = 'published'"];
  const values: unknown[] = [];
  if (query) {
    conditions.push("(title LIKE ? ESCAPE '\\' OR blurb LIKE ? ESCAPE '\\')");
    const escaped = `%${query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    values.push(escaped, escaped);
  }
  if (type) {
    conditions.push("publication_type = ?");
    values.push(type);
  }
  values.push(pageSize, (page - 1) * pageSize);
  const result = await context.env.DB.prepare(
    `SELECT ${workColumns} FROM works WHERE ${conditions.join(" AND ")}
     ORDER BY featured DESC, published_at DESC, title LIMIT ? OFFSET ?`,
  )
    .bind(...values)
    .all();
  return success(context, {
    items: result.results.map((row) => rowToWork(row)),
    page,
    pageSize,
  });
}

export async function getPublicWork(context: Context<AppEnvironment>) {
  const row = await context.env.DB.prepare(
    `SELECT ${workColumns} FROM works WHERE slug = ? AND status = 'published'`,
  )
    .bind(context.req.param("slug"))
    .first();
  if (!row) throw new ApiError(404, "work_not_found", "Work was not found.");
  return success(context, rowToWork(row));
}

export async function listAdminWorks(context: Context<AppEnvironment>) {
  const result = await context.env.DB.prepare(
    `SELECT ${workColumns} FROM works ORDER BY updated_at DESC`,
  ).all();
  return success(context, {
    items: result.results.map((row) => rowToWork(row, true)),
  });
}

export async function getAdminWork(context: Context<AppEnvironment>) {
  const row = await context.env.DB.prepare(
    `SELECT ${workColumns} FROM works WHERE id = ?`,
  )
    .bind(context.req.param("id"))
    .first();
  if (!row) throw new ApiError(404, "work_not_found", "Work was not found.");
  return success(context, rowToWork(row, true));
}

function normaliseWork(raw: unknown) {
  const parsed = workInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(
      422,
      "validation_failed",
      parsed.error.issues[0]?.message || "Work is invalid.",
    );
  }
  const work = parsed.data;
  const readingTimeMinutes =
    work.readingTimeMinutes ??
    (work.storyContent ? calculateReadingTime(work.storyContent) : undefined);
  const socialProvider = work.socialPostUrl
    ? detectSocialProvider(work.socialPostUrl)
    : undefined;
  return { ...work, readingTimeMinutes, socialProvider };
}

function insertStatement(
  context: Context<AppEnvironment>,
  id: string,
  work: ReturnType<typeof normaliseWork>,
  now: string,
) {
  return context.env.DB.prepare(
    `INSERT INTO works (${workColumns})
     VALUES (${Array.from({ length: 22 }, () => "?").join(",")})
     ON CONFLICT(id) DO UPDATE SET
       slug = excluded.slug, title = excluded.title,
       status = excluded.status, publication_type = excluded.publication_type,
       published_at = excluded.published_at, updated_at = excluded.updated_at,
       word_count = excluded.word_count, reading_time_minutes = excluded.reading_time_minutes,
       blurb = excluded.blurb, story_content = excluded.story_content,
       content_visibility = excluded.content_visibility, publisher_name = excluded.publisher_name,
       primary_external_url = excluded.primary_external_url, purchase_url = excluded.purchase_url,
       social_post_url = excluded.social_post_url, social_provider = excluded.social_provider,
       social_embed_enabled = excluded.social_embed_enabled, work_image_url = excluded.work_image_url,
       genres_json = excluded.genres_json, featured = excluded.featured`,
  ).bind(
    id,
    work.slug || slugify(work.title),
    work.title,
    work.status,
    work.publicationType,
    work.publishedAt ?? null,
    now,
    now,
    work.wordCount ?? null,
    work.readingTimeMinutes ?? null,
    work.blurb,
    work.storyContent ?? null,
    work.contentVisibility,
    work.publisherName ?? null,
    work.primaryExternalUrl ?? null,
    work.purchaseUrl ?? null,
    work.socialPostUrl ?? null,
    work.socialProvider ?? null,
    work.socialEmbedEnabled ? 1 : 0,
    work.workImageUrl ?? null,
    JSON.stringify(work.genres),
    work.featured ? 1 : 0,
  );
}

export async function createWork(context: Context<AppEnvironment>) {
  const work = normaliseWork(await parseJsonBody(context));
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await insertStatement(context, id, work, now).run();
  } catch (error) {
    if (String(error).includes("UNIQUE"))
      throw new ApiError(
        409,
        "slug_conflict",
        "That URL slug is already in use.",
      );
    throw error;
  }
  const created = await context.env.DB.prepare(
    `SELECT ${workColumns} FROM works WHERE id = ?`,
  )
    .bind(id)
    .first();
  return success(context, rowToWork(created!, true), 201);
}

export async function replaceWork(context: Context<AppEnvironment>) {
  const id = context.req.param("id")!;
  const existing = await context.env.DB.prepare(
    `SELECT ${workColumns} FROM works WHERE id = ?`,
  )
    .bind(id)
    .first();
  if (!existing)
    throw new ApiError(404, "work_not_found", "Work was not found.");
  const work = normaliseWork(await parseJsonBody(context));
  const createdAt = String(existing.created_at);
  try {
    await insertStatement(context, id, work, createdAt).run();
    await context.env.DB.prepare(
      "UPDATE works SET created_at = ?, updated_at = ? WHERE id = ?",
    )
      .bind(createdAt, new Date().toISOString(), id)
      .run();
  } catch (error) {
    if (String(error).includes("UNIQUE"))
      throw new ApiError(
        409,
        "slug_conflict",
        "That URL slug is already in use.",
      );
    throw error;
  }
  return getAdminWork(context);
}

export async function patchWork(context: Context<AppEnvironment>) {
  const id = context.req.param("id")!;
  const row = await context.env.DB.prepare(
    `SELECT ${workColumns} FROM works WHERE id = ?`,
  )
    .bind(id)
    .first();
  if (!row) throw new ApiError(404, "work_not_found", "Work was not found.");
  const patch = workPatchSchema.safeParse(await parseJsonBody(context));
  if (!patch.success) {
    throw new ApiError(
      422,
      "validation_failed",
      patch.error.issues[0]?.message || "Work is invalid.",
    );
  }
  const existing = rowToWork(row, true);
  const merged = normaliseWork({ ...existing, ...patch.data });
  await insertStatement(context, id, merged, existing.createdAt).run();
  await context.env.DB.prepare(
    "UPDATE works SET created_at = ?, updated_at = ? WHERE id = ?",
  )
    .bind(existing.createdAt, new Date().toISOString(), id)
    .run();
  return getAdminWork(context);
}

export async function archiveWork(context: Context<AppEnvironment>) {
  const result = await context.env.DB.prepare(
    "UPDATE works SET status = 'archived', updated_at = ? WHERE id = ?",
  )
    .bind(new Date().toISOString(), context.req.param("id"))
    .run();
  if (!result.meta.changes)
    throw new ApiError(404, "work_not_found", "Work was not found.");
  return success(context, { archived: true });
}

export async function publishAllDrafts(context: Context<AppEnvironment>) {
  const publishedAt = new Date().toISOString();
  const result = await context.env.DB.prepare(
    `UPDATE works
     SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ?
     WHERE status = 'draft'`,
  )
    .bind(publishedAt, publishedAt)
    .run();

  return success(context, {
    published: result.meta.changes,
    publishedAt,
  });
}
