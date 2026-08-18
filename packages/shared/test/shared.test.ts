import { describe, expect, it } from "vitest";
import {
  areSameExternalUrls,
  calculateReadingTime,
  calculateReadingTimeFromWordCount,
  commentInputSchema,
  getBookAppearance,
  isAllowedExternalUrl,
  sanitiseHomepageHeading,
  sanitiseMarkdown,
  slugify,
  workSchema,
} from "../src/index";

describe("shared domain logic", () => {
  it("generates clean slugs", () => {
    expect(slugify("The Café’s Last Light!")).toBe("the-cafes-last-light");
  });

  it("calculates reading time using the default reading rate", () => {
    expect(calculateReadingTime("")).toBe(1);
    expect(
      calculateReadingTime(Array.from({ length: 231 }, () => "word").join(" ")),
    ).toBe(2);
    expect(calculateReadingTimeFromWordCount(2_900)).toBe(13);
  });

  it("accepts only normal web URLs", () => {
    expect(isAllowedExternalUrl("https://example.com/story")).toBe(true);
    expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
  });

  it("recognises equivalent publication and purchase URLs", () => {
    expect(
      areSameExternalUrls(
        "https://example.com/story/?edition=1&format=book#buy",
        "https://example.com/story?format=book&edition=1",
      ),
    ).toBe(true);
    expect(
      areSameExternalUrls(
        "https://example.com/story",
        "https://example.com/shop/story",
      ),
    ).toBe(false);
  });

  it("returns deterministic and distinct book appearances", () => {
    expect(getBookAppearance("story-one")).toEqual(
      getBookAppearance("story-one"),
    );
    expect(getBookAppearance("story-one")).not.toEqual(
      getBookAppearance("story-two"),
    );
  });

  it("sanitises Markdown", () => {
    const result = sanitiseMarkdown(
      "# Safe\n<script>alert(1)</script>[bad](javascript:alert(1))",
    );
    expect(result).not.toContain("<script");
    expect(result).not.toContain("javascript:");
  });

  it("sanitises rich homepage headings while retaining inline formatting", () => {
    const result = sanitiseHomepageHeading(
      'Stories for the <i>quietly curious</i><script>alert(1)</script><a href="javascript:alert(1)">.</a>',
    );
    expect(result).toContain("<i>quietly curious</i>");
    expect(result).not.toContain("<script");
    expect(result).not.toContain("javascript:");
  });

  it("rejects missing full story content", () => {
    const result = workSchema.safeParse({
      id: "1",
      slug: "missing-story",
      title: "Missing Story",
      status: "published",
      publicationType: "short-story",
      publishedAt: "2026-01-01T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      blurb: "A blurb.",
      contentVisibility: "full",
      socialEmbedEnabled: false,
      genres: [],
      featured: false,
    });
    expect(result.success).toBe(false);
  });

  it("requires a publication URL for link-only work", () => {
    const result = workSchema.safeParse({
      id: "1",
      slug: "missing-link",
      title: "Missing Link",
      status: "published",
      publicationType: "short-story",
      publishedAt: "2026-01-01T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      blurb: "A blurb.",
      contentVisibility: "external-only",
      socialEmbedEnabled: false,
      genres: [],
      featured: false,
    });
    expect(result.success).toBe(false);
  });

  it("does not use an optional audio URL in place of a publication URL", () => {
    const result = workSchema.safeParse({
      id: "audio-1",
      slug: "audio-only",
      title: "Audio Only",
      status: "published",
      publicationType: "short-story",
      publishedAt: "2026-01-01T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      blurb: "A story to listen to.",
      contentVisibility: "external-only",
      audioUrl: "https://example.com/audio/story",
      socialEmbedEnabled: false,
      genres: [],
      featured: false,
    });
    expect(result.success).toBe(false);
  });

  it("limits reader comments to 250 characters", () => {
    expect(
      commentInputSchema.safeParse({ body: "a".repeat(250) }).success,
    ).toBe(true);
    expect(
      commentInputSchema.safeParse({ body: "a".repeat(251) }).success,
    ).toBe(false);
  });
});
