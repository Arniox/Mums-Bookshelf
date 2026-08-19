import {
  calculateReadingTime,
  calculateReadingTimeFromWordCount,
  detectSocialProvider,
  slugify,
} from "@mums-bookshelf/shared/content";
import {
  workInputSchema,
  workPatchSchema,
} from "@mums-bookshelf/shared/schemas";
import type { Context } from "hono";
import { rowToWork, workColumns } from "./db";
import { ApiError, parseJsonBody, success } from "./http";
import type { AppEnvironment } from "./types";

export async function listPublicWorks(context: Context<AppEnvironment>) {
  const query = context.req.query("q")?.trim();
  const type = context.req.query("type")?.trim();
  const page = Math.max(1, Number(context.req.query("page") || 1));
  const pageSize = Math.min(
    250,
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
    `SELECT * FROM works WHERE ${conditions.join(" AND ")}
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
    "SELECT * FROM works WHERE slug = ? AND status = 'published'",
  )
    .bind(context.req.param("slug"))
    .first();
  if (!row) throw new ApiError(404, "work_not_found", "Work was not found.");
  return success(context, rowToWork(row));
}

export async function listAdminWorks(context: Context<AppEnvironment>) {
  const result = await context.env.DB.prepare(
    "SELECT * FROM works ORDER BY published_at DESC, updated_at DESC",
  ).all();
  return success(context, {
    items: result.results.map((row) => rowToWork(row, true)),
  });
}

export async function getAdminWork(context: Context<AppEnvironment>) {
  const row = await context.env.DB.prepare("SELECT * FROM works WHERE id = ?")
    .bind(context.req.param("id"))
    .first();
  if (!row) throw new ApiError(404, "work_not_found", "Work was not found.");
  return success(context, rowToWork(row, true));
}

export async function listWorkAudit(context: Context<AppEnvironment>) {
  const result = await context.env.DB.prepare(
    `SELECT action, actor_username, occurred_at, previous_updated_at, next_updated_at
     FROM work_audit_log WHERE work_id = ? ORDER BY occurred_at DESC, id DESC`,
  )
    .bind(context.req.param("id"))
    .all();
  return success(context, { items: result.results });
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
    (work.wordCount !== undefined
      ? calculateReadingTimeFromWordCount(work.wordCount)
      : work.storyContent
        ? calculateReadingTime(work.storyContent)
        : undefined);
  const socialProvider = work.socialPostUrl
    ? detectSocialProvider(work.socialPostUrl)
    : undefined;
  return { ...work, readingTimeMinutes, socialProvider };
}

function insertStatement(
  context: Context<AppEnvironment>,
  id: string,
  work: ReturnType<typeof normaliseWork>,
  createdAt: string,
  updatedAt: string,
  expectedUpdatedAt?: string,
  sourceWorkId?: string,
  storedSlug = work.slug || slugify(work.title),
) {
  return context.env.DB.prepare(
    `INSERT INTO works (${workColumns})
     VALUES (${Array.from({ length: 24 }, () => "?").join(",")})
     ON CONFLICT(id) DO UPDATE SET
       source_work_id = excluded.source_work_id, slug = excluded.slug, title = excluded.title,
       status = excluded.status, publication_type = excluded.publication_type,
       published_at = excluded.published_at, updated_at = excluded.updated_at,
       word_count = excluded.word_count, reading_time_minutes = excluded.reading_time_minutes,
       blurb = excluded.blurb, story_content = excluded.story_content,
       content_visibility = excluded.content_visibility, publisher_name = excluded.publisher_name,
       primary_external_url = excluded.primary_external_url, audio_url = excluded.audio_url,
       purchase_url = excluded.purchase_url,
       social_post_url = excluded.social_post_url, social_provider = excluded.social_provider,
       social_embed_enabled = excluded.social_embed_enabled, work_image_url = excluded.work_image_url,
       genres_json = excluded.genres_json, featured = excluded.featured
     WHERE works.updated_at = ?`,
  ).bind(
    id,
    sourceWorkId ?? null,
    storedSlug,
    work.title,
    work.status,
    work.publicationType,
    work.publishedAt ?? null,
    createdAt,
    updatedAt,
    work.wordCount ?? null,
    work.readingTimeMinutes ?? null,
    work.blurb,
    work.storyContent ?? null,
    work.contentVisibility,
    work.publisherName ?? null,
    work.primaryExternalUrl ?? null,
    work.audioUrl ?? null,
    work.purchaseUrl ?? null,
    work.socialPostUrl ?? null,
    work.socialProvider ?? null,
    work.socialEmbedEnabled ? 1 : 0,
    work.workImageUrl ?? null,
    JSON.stringify(work.genres),
    work.featured ? 1 : 0,
    expectedUpdatedAt ?? null,
  );
}

function auditStatement(
  context: Context<AppEnvironment>,
  action: "created" | "updated" | "archived",
  workId: string,
  occurredAt: string,
  previousUpdatedAt: string | undefined,
  nextUpdatedAt: string,
  before: unknown,
  after: unknown,
) {
  const user = context.get("user")!;
  return context.env.DB.prepare(
    `INSERT INTO work_audit_log (
       id, work_id, action, actor_user_id, actor_username, request_id,
       occurred_at, previous_updated_at, next_updated_at, before_json, after_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    workId,
    action,
    user.id,
    user.username,
    context.get("requestId"),
    occurredAt,
    previousUpdatedAt ?? null,
    nextUpdatedAt,
    before ? JSON.stringify(before) : null,
    JSON.stringify(after),
  );
}

function staleWorkError() {
  return new ApiError(
    409,
    "work_outdated",
    "This work changed in another session. Reopen it to review the latest version before saving.",
  );
}

export async function createWork(context: Context<AppEnvironment>) {
  const work = normaliseWork(await parseJsonBody(context));
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await insertStatement(context, id, work, now, now).run();
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
    "SELECT * FROM works WHERE id = ?",
  )
    .bind(id)
    .first();
  await auditStatement(
    context,
    "created",
    id,
    now,
    undefined,
    now,
    undefined,
    rowToWork(created!, true),
  ).run();
  return success(context, rowToWork(created!, true), 201);
}

export async function replaceWork(context: Context<AppEnvironment>) {
  const id = context.req.param("id")!;
  const existing = await context.env.DB.prepare(
    "SELECT * FROM works WHERE id = ?",
  )
    .bind(id)
    .first();
  if (!existing)
    throw new ApiError(404, "work_not_found", "Work was not found.");
  const { expectedUpdatedAt, ...work } = normaliseWork(
    await parseJsonBody(context),
  );
  if (!expectedUpdatedAt) throw staleWorkError();
  const createdAt = String(existing.created_at);
  const previous = rowToWork(existing, true);
  const updatedAt = new Date().toISOString();
  const sourceWorkId = existing.source_work_id
    ? String(existing.source_work_id)
    : undefined;

  if (sourceWorkId && work.status === "published") {
    const source = await context.env.DB.prepare(
      "SELECT * FROM works WHERE id = ? AND status = 'published'",
    )
      .bind(sourceWorkId)
      .first();
    if (!source)
      throw new ApiError(
        409,
        "published_source_missing",
        "The published version is no longer available. Reopen the draft before publishing.",
      );
    const publishedPrevious = rowToWork(source, true);
    const sourceUpdate = insertStatement(
      context,
      sourceWorkId,
      work,
      String(source.created_at),
      updatedAt,
      String(source.updated_at),
    );
    const deleteDraft = context.env.DB.prepare(
      "DELETE FROM works WHERE id = ? AND updated_at = ?",
    ).bind(id, expectedUpdatedAt);
    const results = await context.env.DB.batch([sourceUpdate, deleteDraft]);
    if (!results[0]?.meta.changes || !results[1]?.meta.changes)
      throw staleWorkError();
    const published = await context.env.DB.prepare(
      "SELECT * FROM works WHERE id = ?",
    )
      .bind(sourceWorkId)
      .first();
    await auditStatement(
      context,
      "updated",
      sourceWorkId,
      updatedAt,
      publishedPrevious.updatedAt,
      updatedAt,
      publishedPrevious,
      rowToWork(published!, true),
    ).run();
    return success(context, rowToWork(published!, true));
  }
  try {
    const result = await insertStatement(
      context,
      id,
      work,
      createdAt,
      updatedAt,
      expectedUpdatedAt,
      sourceWorkId,
      sourceWorkId ? String(existing.slug) : undefined,
    ).run();
    if (!result.meta.changes) throw staleWorkError();
  } catch (error) {
    if (String(error).includes("UNIQUE"))
      throw new ApiError(
        409,
        "slug_conflict",
        "That URL slug is already in use.",
      );
    throw error;
  }
  const updated = await context.env.DB.prepare(
    "SELECT * FROM works WHERE id = ?",
  )
    .bind(id)
    .first();
  await auditStatement(
    context,
    "updated",
    id,
    updatedAt,
    previous.updatedAt,
    updatedAt,
    previous,
    rowToWork(updated!, true),
  ).run();
  return success(context, rowToWork(updated!, true));
}

export async function createWorkDraft(context: Context<AppEnvironment>) {
  const sourceWorkId = context.req.param("id")!;
  const source = await context.env.DB.prepare(
    "SELECT * FROM works WHERE id = ? AND status = 'published'",
  )
    .bind(sourceWorkId)
    .first();
  if (!source)
    throw new ApiError(404, "work_not_found", "Published work was not found.");
  const existingDraft = await context.env.DB.prepare(
    "SELECT * FROM works WHERE source_work_id = ? AND status = 'draft'",
  )
    .bind(sourceWorkId)
    .first();
  if (existingDraft) return success(context, rowToWork(existingDraft, true));

  const draftId = crypto.randomUUID();
  const now = new Date().toISOString();
  const sourceWork = rowToWork(source, true);
  const draft = normaliseWork({ ...sourceWork, status: "draft" });
  const storedSlug = `${sourceWork.slug}-draft-${draftId.replaceAll("-", "").slice(0, 8)}`;
  await insertStatement(
    context,
    draftId,
    draft,
    now,
    now,
    undefined,
    sourceWorkId,
    storedSlug,
  ).run();
  const created = await context.env.DB.prepare(
    "SELECT * FROM works WHERE id = ?",
  )
    .bind(draftId)
    .first();
  return success(context, rowToWork(created!, true), 201);
}

export async function patchWork(context: Context<AppEnvironment>) {
  const id = context.req.param("id")!;
  const row = await context.env.DB.prepare("SELECT * FROM works WHERE id = ?")
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
  const { expectedUpdatedAt, ...patchData } = patch.data;
  if (!expectedUpdatedAt) throw staleWorkError();
  const existing = rowToWork(row, true);
  const work = normaliseWork({ ...existing, ...patchData });
  const updatedAt = new Date().toISOString();
  const result = await insertStatement(
    context,
    id,
    work,
    existing.createdAt,
    updatedAt,
    expectedUpdatedAt,
    existing.sourceWorkId,
    existing.sourceWorkId ? String(row.slug) : undefined,
  ).run();
  if (!result.meta.changes) throw staleWorkError();
  const updated = await context.env.DB.prepare(
    "SELECT * FROM works WHERE id = ?",
  )
    .bind(id)
    .first();
  await auditStatement(
    context,
    "updated",
    id,
    updatedAt,
    existing.updatedAt,
    updatedAt,
    existing,
    rowToWork(updated!, true),
  ).run();
  return success(context, rowToWork(updated!, true));
}

export async function archiveWork(context: Context<AppEnvironment>) {
  const expectedUpdatedAt = context.req.header("If-Unmodified-Since");
  if (!expectedUpdatedAt) throw staleWorkError();
  const id = context.req.param("id")!;
  const existing = await context.env.DB.prepare(
    "SELECT * FROM works WHERE id = ?",
  )
    .bind(id)
    .first();
  if (!existing)
    throw new ApiError(404, "work_not_found", "Work was not found.");
  const previous = rowToWork(existing, true);
  const updatedAt = new Date().toISOString();
  const result = await context.env.DB.prepare(
    "UPDATE works SET status = 'archived', updated_at = ? WHERE id = ? AND updated_at = ?",
  )
    .bind(updatedAt, id, expectedUpdatedAt)
    .run();
  if (!result.meta.changes) throw staleWorkError();
  const archived = { ...previous, status: "archived", updatedAt };
  await auditStatement(
    context,
    "archived",
    id,
    updatedAt,
    previous.updatedAt,
    updatedAt,
    previous,
    archived,
  ).run();
  return success(context, { archived: true });
}

export async function publishAllDrafts(context: Context<AppEnvironment>) {
  const publishedAt = new Date().toISOString();
  const result = await context.env.DB.prepare(
    `UPDATE works
     SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ?
     WHERE status = 'draft' AND source_work_id IS NULL`,
  )
    .bind(publishedAt, publishedAt)
    .run();

  return success(context, {
    published: result.meta.changes,
    publishedAt,
  });
}
