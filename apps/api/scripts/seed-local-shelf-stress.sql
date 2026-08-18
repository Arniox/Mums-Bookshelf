WITH RECURSIVE books(number) AS (
  VALUES(1)
  UNION ALL
  SELECT number + 1 FROM books WHERE number < 100
)
INSERT OR REPLACE INTO works (
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
  genres_json,
  featured
)
SELECT
  printf('stress-book-%03d', number),
  printf('stress-book-%03d', number),
  printf('Shelf stress test book %03d', number),
  'published',
  'short-story',
  datetime('now', printf('-%d days', number)),
  datetime('now'),
  datetime('now'),
  1200,
  5,
  printf('Local shelf layout test entry %03d.', number),
  printf('Local test content for shelf stress book %03d.', number),
  'full',
  '["test","shelf"]',
  CASE WHEN number = 1 THEN 1 ELSE 0 END
FROM books;