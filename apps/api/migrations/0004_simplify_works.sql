PRAGMA defer_foreign_keys = ON;

DROP INDEX IF EXISTS idx_comments_public;
DROP INDEX IF EXISTS idx_comments_moderation;
DROP INDEX IF EXISTS idx_works_public;
DROP INDEX IF EXISTS idx_works_featured;

ALTER TABLE comments RENAME TO comments_legacy;
ALTER TABLE works RENAME TO works_legacy;

CREATE TABLE works (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  publication_type TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  word_count INTEGER,
  reading_time_minutes INTEGER,
  blurb TEXT NOT NULL,
  story_content TEXT,
  content_visibility TEXT NOT NULL CHECK (content_visibility IN ('external-only', 'full')),
  publisher_name TEXT,
  primary_external_url TEXT,
  purchase_url TEXT,
  social_post_url TEXT,
  social_provider TEXT,
  social_embed_enabled INTEGER NOT NULL DEFAULT 0,
  work_image_url TEXT,
  genres_json TEXT NOT NULL DEFAULT '[]',
  featured INTEGER NOT NULL DEFAULT 0
);

INSERT INTO works (
  id,
  slug,
  title,
  status,
  publication_type,
  published_at,
  created_at,
  updated_at,
  word_count,
  reading_time_minutes,
  blurb,
  story_content,
  content_visibility,
  publisher_name,
  primary_external_url,
  purchase_url,
  social_post_url,
  social_provider,
  social_embed_enabled,
  work_image_url,
  genres_json,
  featured
)
SELECT
  id,
  slug,
  title,
  status,
  publication_type,
  published_at,
  created_at,
  updated_at,
  word_count,
  reading_time_minutes,
  blurb,
  story_content,
  CASE WHEN content_visibility = 'full' THEN 'full' ELSE 'external-only' END,
  CASE
    WHEN NULLIF(TRIM(publisher_name), '') IS NULL THEN NULLIF(TRIM(publication_name), '')
    WHEN NULLIF(TRIM(publication_name), '') IS NULL THEN TRIM(publisher_name)
    WHEN TRIM(publisher_name) = TRIM(publication_name) THEN TRIM(publisher_name)
    ELSE TRIM(publisher_name) || ' — ' || TRIM(publication_name)
  END,
  primary_external_url,
  purchase_url,
  social_post_url,
  social_provider,
  social_embed_enabled,
  cover_image_url,
  genres_json,
  featured
FROM works_legacy;

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  display_name TEXT,
  body TEXT NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  approved_at TEXT,
  parent_comment_id TEXT REFERENCES comments(id),
  deleted_at TEXT,
  deleted_reason TEXT,
  ip_hash TEXT
);

INSERT INTO comments (
  id,
  work_id,
  display_name,
  body,
  moderation_status,
  created_at,
  approved_at,
  parent_comment_id,
  deleted_at,
  deleted_reason,
  ip_hash
)
SELECT
  id,
  work_id,
  display_name,
  body,
  moderation_status,
  created_at,
  approved_at,
  parent_comment_id,
  deleted_at,
  deleted_reason,
  ip_hash
FROM comments_legacy;

DROP TABLE comments_legacy;
DROP TABLE works_legacy;

CREATE INDEX idx_works_public ON works(status, published_at DESC);
CREATE INDEX idx_works_featured ON works(featured);
CREATE INDEX idx_comments_public ON comments(work_id, moderation_status, created_at);
CREATE INDEX idx_comments_moderation ON comments(moderation_status, created_at);

PRAGMA defer_foreign_keys = OFF;
