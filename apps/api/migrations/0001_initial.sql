PRAGMA foreign_keys = ON;

CREATE TABLE works (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  publication_type TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  word_count INTEGER,
  reading_time_minutes INTEGER,
  blurb TEXT NOT NULL,
  excerpt TEXT,
  story_content TEXT,
  author_notes TEXT,
  content_visibility TEXT NOT NULL CHECK (content_visibility IN ('external-only', 'excerpt', 'full')),
  publisher_name TEXT,
  publication_name TEXT,
  primary_external_url TEXT,
  purchase_url TEXT,
  social_post_url TEXT,
  social_provider TEXT,
  social_embed_enabled INTEGER NOT NULL DEFAULT 0,
  cover_image_url TEXT,
  cover_image_alt TEXT,
  genres_json TEXT NOT NULL DEFAULT '[]',
  tags_json TEXT NOT NULL DEFAULT '[]',
  featured INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER,
  seo_title TEXT,
  seo_description TEXT
);

CREATE INDEX idx_works_public ON works(status, published_at DESC);
CREATE INDEX idx_works_featured ON works(featured, display_order);

CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX idx_sessions_token ON sessions(token_hash, expires_at);
CREATE INDEX idx_sessions_user ON sessions(user_id, revoked_at);

CREATE TABLE site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  author_name TEXT NOT NULL,
  introduction TEXT NOT NULL,
  biography TEXT NOT NULL,
  profile_image_url TEXT,
  announcement TEXT,
  social_links_json TEXT NOT NULL DEFAULT '{}',
  theme_settings_json TEXT NOT NULL DEFAULT '{}',
  contact_link TEXT,
  updated_at TEXT NOT NULL
);

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

CREATE INDEX idx_comments_public ON comments(work_id, moderation_status, created_at);
CREATE INDEX idx_comments_moderation ON comments(moderation_status, created_at);

CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);

