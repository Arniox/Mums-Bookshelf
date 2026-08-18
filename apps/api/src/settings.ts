import { sanitiseHomepageHeading } from "@mums-bookshelf/shared";
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
  const heading = sanitiseHomepageHeading(parsed.data.homepageHeadingHtml);
  if (!heading)
    throw new ApiError(
      422,
      "validation_failed",
      "Homepage heading must contain text.",
    );
  const settings = { ...parsed.data, homepageHeadingHtml: heading };
  await context.env.DB.prepare(
    `INSERT INTO site_settings (
       id, author_name, homepage_eyebrow, homepage_heading_html, introduction, biography, profile_image_url, announcement,
       social_links_json, theme_settings_json, contact_link, updated_at
     ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       author_name = excluded.author_name, introduction = excluded.introduction,
       homepage_eyebrow = excluded.homepage_eyebrow,
       homepage_heading_html = excluded.homepage_heading_html,
       biography = excluded.biography, profile_image_url = excluded.profile_image_url,
       announcement = excluded.announcement, social_links_json = excluded.social_links_json,
       theme_settings_json = excluded.theme_settings_json, contact_link = excluded.contact_link,
       updated_at = excluded.updated_at`,
  )
    .bind(
      settings.authorName,
      settings.homepageEyebrow,
      settings.homepageHeadingHtml,
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
