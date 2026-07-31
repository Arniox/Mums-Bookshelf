import type { Context } from "hono";
import { rowToSettings, rowToWork, workColumns } from "./db";
import { success } from "./http";
import type { AppEnvironment } from "./types";

export async function exportData(context: Context<AppEnvironment>) {
  const [works, settings, comments] = await Promise.all([
    context.env.DB.prepare(
      `SELECT ${workColumns} FROM works ORDER BY created_at`,
    ).all(),
    context.env.DB.prepare("SELECT * FROM site_settings WHERE id = 1").first(),
    context.env.DB.prepare(
      `SELECT id, work_id, display_name, body, moderation_status, created_at, approved_at, parent_comment_id
       FROM comments WHERE moderation_status = 'approved' AND deleted_at IS NULL ORDER BY created_at`,
    ).all(),
  ]);
  context.header(
    "Content-Disposition",
    `attachment; filename="author-library-${new Date().toISOString().slice(0, 10)}.json"`,
  );
  return success(context, {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    works: works.results.map((row) => rowToWork(row, true)),
    settings: settings ? rowToSettings(settings) : {},
    comments: comments.results,
  });
}
