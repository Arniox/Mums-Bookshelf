import { describe, expect, it } from "vitest";
import { rowToWork } from "../src/db";

const row = {
  id: "1",
  slug: "secret-draft",
  title: "Secret",
  status: "published",
  publication_type: "short-story",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  blurb: "Public blurb",
  content_visibility: "external-only",
  story_content: "Restricted full story",
  social_embed_enabled: 0,
  genres_json: "[]",
  featured: 0,
};

describe("public work projection", () => {
  it("does not leak restricted external-only content", () => {
    const work = rowToWork(row);
    expect(work.storyContent).toBeUndefined();
    expect(work.audioUrl).toBeUndefined();
  });

  it("returns restricted fields to an authenticated administrator", () => {
    const work = rowToWork(row, true);
    expect(work.storyContent).toBe("Restricted full story");
  });
});
