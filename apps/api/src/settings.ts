import { publicSettingsSchema } from "@mums-bookshelf/shared/schemas";
import type { Context } from "hono";
import { rowToSettings } from "./db";
import { ApiError, parseJsonBody, success } from "./http";
import type { AppEnvironment } from "./types";

export async function getPublicSettings(context: Context<AppEnvironment>) {
  const row = await context.env.DB.prepare(
    "SELECT * FROM site_settings WHERE id = 1",
  ).first();
  if (!row)
    throw new ApiError(
      404,
      "settings_not_found",
      "Site settings were not found.",
    );
  return success(context, rowToSettings(row));
}

export async function updateSettings(context: Context<AppEnvironment>) {
  const parsed = publicSettingsSchema.safeParse(
    await parseJsonBody(context, 100_000),
  );
  if (!parsed.success) {
    throw new ApiError(
      422,
      "validation_failed",
      parsed.error.issues[0]?.message || "Settings are invalid.",
    );
  }
  const settings = parsed.data;
  await context.env.DB.prepare(
    `INSERT INTO site_settings (
       id, author_name, introduction, biography, profile_image_url, announcement,
       social_links_json, theme_settings_json, contact_link, updated_at
     ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       author_name = excluded.author_name, introduction = excluded.introduction,
       biography = excluded.biography, profile_image_url = excluded.profile_image_url,
       announcement = excluded.announcement, social_links_json = excluded.social_links_json,
       theme_settings_json = excluded.theme_settings_json, contact_link = excluded.contact_link,
       updated_at = excluded.updated_at`,
  )
    .bind(
      settings.authorName,
      settings.introduction,
      settings.biography,
      settings.profileImageUrl ?? null,
      settings.announcement ?? null,
      JSON.stringify(settings.socialLinks),
      JSON.stringify(settings.themeSettings),
      settings.contactLink ?? null,
      new Date().toISOString(),
    )
    .run();
  return getPublicSettings(context);
}
