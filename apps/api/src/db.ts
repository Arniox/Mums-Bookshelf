import type { PublicSettings, Work } from "@mums-bookshelf/shared";

type WorkRow = Record<string, unknown>;

export function rowToWork(row: WorkRow, privileged = false): Work {
  const visibility = String(row.content_visibility);
  const base = {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    status: String(row.status),
    publicationType: String(row.publication_type),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    blurb: String(row.blurb),
    contentVisibility: visibility,
    socialEmbedEnabled: Boolean(row.social_embed_enabled),
    genres: JSON.parse(String(row.genres_json || "[]")),
    featured: Boolean(row.featured),
  } as Work;

  const assign = (key: keyof Work, value: unknown) => {
    if (value !== null && value !== undefined && value !== "") {
      Object.assign(base, { [key]: value });
    }
  };

  assign("publishedAt", row.published_at);
  assign("wordCount", row.word_count);
  assign("readingTimeMinutes", row.reading_time_minutes);
  assign("publisherName", row.publisher_name);
  assign("primaryExternalUrl", row.primary_external_url);
  assign("purchaseUrl", row.purchase_url);
  assign("socialPostUrl", row.social_post_url);
  assign("socialProvider", row.social_provider);
  assign("workImageUrl", row.work_image_url);

  if (privileged || visibility === "full")
    assign("storyContent", row.story_content);

  return base;
}

export function rowToSettings(row: Record<string, unknown>): PublicSettings {
  return {
    authorName: String(row.author_name),
    introduction: String(row.introduction),
    biography: String(row.biography),
    ...(row.profile_image_url
      ? { profileImageUrl: String(row.profile_image_url) }
      : {}),
    ...(row.announcement ? { announcement: String(row.announcement) } : {}),
    socialLinks: JSON.parse(String(row.social_links_json || "{}")),
    themeSettings: JSON.parse(String(row.theme_settings_json || "{}")),
    ...(row.contact_link ? { contactLink: String(row.contact_link) } : {}),
  };
}

export const workColumns = `
  id, slug, title, status, publication_type, published_at, created_at, updated_at,
  word_count, reading_time_minutes, blurb, story_content, content_visibility,
  publisher_name, primary_external_url, purchase_url, social_post_url, social_provider,
  social_embed_enabled, work_image_url, genres_json, featured
`;
