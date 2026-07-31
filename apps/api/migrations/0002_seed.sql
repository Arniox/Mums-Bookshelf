INSERT OR REPLACE INTO site_settings (
  id, author_name, introduction, biography, announcement,
  social_links_json, theme_settings_json, contact_link, updated_at
) VALUES (
  1,
  'Eleanor Hart',
  'Stories about small rooms, long roads, and the brave choices made between them.',
  'Eleanor Hart writes fiction from a weatherboard house near the sea. Her work has appeared in magazines and anthologies, and often begins with an overheard sentence.',
  'New story: The Borrowed Lantern',
  '{"instagram":"https://example.com/eleanor-instagram","facebook":"https://example.com/eleanor-facebook"}',
  '{"accent":"plum","shelf":"walnut"}',
  'https://example.com/contact',
  '2026-01-12T09:00:00Z'
);

INSERT OR REPLACE INTO works (
  id, slug, title, subtitle, status, publication_type, published_at, created_at, updated_at,
  word_count, reading_time_minutes, blurb, excerpt, story_content, author_notes,
  content_visibility, publisher_name, publication_name, primary_external_url, purchase_url,
  social_post_url, social_provider, social_embed_enabled, cover_image_url, cover_image_alt,
  genres_json, tags_json, featured, display_order, seo_title, seo_description
) VALUES
(
  'work-north-road', 'the-long-road-north', 'The Long Road North', 'A novel of homecoming',
  'published', 'book', '2025-10-14T00:00:00Z', '2025-01-02T10:00:00Z', '2025-10-14T08:00:00Z',
  89200, 406, 'Mara returns to the orchard she fled twenty years earlier and finds the past has kept a room for her.',
  'The bus left Mara at the old stone gate just before rain.', NULL,
  'This novel began with a map drawn on the back of a grocery receipt.',
  'external-only', 'Kōwhai House Press', NULL, 'https://example.com/books/the-long-road-north',
  'https://example.com/shop/the-long-road-north', NULL, NULL, 0, NULL, NULL,
  '["literary fiction","family saga"]', '["homecoming","orchard","New Zealand"]', 1, 1,
  'The Long Road North — Eleanor Hart', 'A literary novel about homecoming, family and the stories a landscape keeps.'
),
(
  'work-lantern', 'the-borrowed-lantern', 'The Borrowed Lantern', NULL,
  'published', 'short-story', '2026-01-12T00:00:00Z', '2025-11-10T10:00:00Z', '2026-01-12T09:00:00Z',
  3480, 16, 'On the night the power fails, a widow follows a moving light through the flooded lower paddock.',
  'At half past nine, when the valley went dark, June saw a lantern moving below the macrocarpas.',
  'At half past nine, when the valley went dark, June saw a lantern moving below the macrocarpas.\n\nShe stood at the kitchen window with both hands around a mug gone cold. The light dipped, vanished behind the old pump shed, then rose again where no path ran.\n\n“Tom,” she said, before remembering the empty chair.\n\nJune pulled on her red coat and stepped into the rain. The paddock water took the porch light and broke it into trembling pieces. Ahead, the lantern waited.\n\n## The lower field\n\nBy the gate she found a small brass lantern hanging from the latch. It was the one she had lent to her neighbour twenty-six summers ago, on the evening his daughter was born. Its glass was warm.\n\nBeyond it, the flood had carried a white lamb against the wire. June set down the lantern, waded in, and began to pull.',
  'Written during three days of rain. The lantern is based on one my grandmother kept beside her bed.',
  'full', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL,
  '["literary fiction"]', '["rain","grief","rural life"]', 1, 2,
  'Read The Borrowed Lantern', 'A short story by Eleanor Hart, available to read online.'
),
(
  'work-tide-table', 'notes-from-a-tide-table', 'Notes from a Tide Table', NULL,
  'published', 'magazine', '2025-08-03T00:00:00Z', '2025-06-01T10:00:00Z', '2025-08-03T09:00:00Z',
  2200, 10, 'A daughter catalogues the objects her marine-biologist father leaves behind.',
  'There were twelve tide tables, one for every year he had promised to retire.', NULL, NULL,
  'excerpt', NULL, 'South & Salt Magazine', 'https://example.com/magazine/tide-table', NULL,
  'https://example.com/social/tide-table', 'facebook', 1, NULL, NULL,
  '["creative nonfiction"]', '["coast","memory"]', 0, 3, NULL, NULL
),
(
  'work-green-room', 'the-green-room', 'The Green Room', NULL,
  'published', 'anthology', '2025-04-19T00:00:00Z', '2025-02-05T10:00:00Z', '2025-04-19T09:00:00Z',
  5100, 24, 'Three strangers shelter backstage while a cyclone rearranges the town outside.',
  'By midnight the theatre belonged to the wind.', NULL, 'First published in the After Weather anthology.',
  'excerpt', 'Blue Wren Books', 'After Weather: New Stories', 'https://example.com/anthology/after-weather',
  'https://example.com/shop/after-weather', NULL, NULL, 0, NULL, NULL,
  '["short fiction"]', '["cyclone","theatre"]', 0, 4, NULL, NULL
),
(
  'work-pear-tree', 'the-last-pear-tree', 'The Last Pear Tree', NULL,
  'published', 'short-story', '2024-11-02T00:00:00Z', '2024-08-01T10:00:00Z', '2024-11-02T09:00:00Z',
  1850, 9, 'A tiny story about a tree, a boundary fence, and two neighbours who refuse to speak.',
  'The pear tree leaned exactly as far as it needed to.', NULL, NULL,
  'excerpt', NULL, 'Field Notes Quarterly', 'https://example.com/field-notes/pear-tree', NULL,
  NULL, NULL, 0, NULL, NULL, '["flash fiction"]', '["neighbours","garden"]', 0, 5, NULL, NULL
),
(
  'work-draft-moon', 'a-map-of-the-moon', 'A Map of the Moon', NULL,
  'draft', 'novella', NULL, '2026-01-20T10:00:00Z', '2026-01-29T09:00:00Z',
  17000, 78, 'A work in progress about an astronomer and her missing sister.',
  NULL, 'Draft material that must never be returned by a public endpoint.', NULL,
  'full', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL,
  '["speculative fiction"]', '["astronomy","sisters"]', 0, 6, NULL, NULL
);

