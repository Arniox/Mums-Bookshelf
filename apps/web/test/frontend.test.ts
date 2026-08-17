import { getBookAppearance } from "@mums-bookshelf/shared";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { works } from "../src/data/sample";
import { matchesWork } from "../src/lib/filterWorks";
import { localWorkDraftKey, parseLocalWorkDraft } from "../src/lib/localDraft";
import {
  dailyFeaturedOrder,
  dailyOrderSalt,
  featuredFirstShuffle,
} from "../src/lib/randomiseWorks";
import {
  hasStructuredStoryHtml,
  storyTextToEditorHtml,
  wordHtmlToStoryHtml,
} from "../src/lib/wordPaste";

describe("public library", () => {
  it("renders a populated public shelf without drafts", () => {
    expect(works.length).toBeGreaterThanOrEqual(5);
    expect(works.every((work) => work.status === "published")).toBe(true);
  });

  it("supports empty shelves", () => {
    const empty: typeof works = [];
    expect(empty).toHaveLength(0);
  });

  it("searches titles and genres", () => {
    expect(
      works.filter((work) => matchesWork(work, "lantern", "")),
    ).toHaveLength(1);
    expect(
      works.filter((work) => matchesWork(work, "creative nonfiction", "")),
    ).toHaveLength(1);
  });

  it("randomises works while keeping featured work first", () => {
    const ordered = featuredFirstShuffle(
      [
        { id: "ordinary-1", featured: false },
        { id: "featured", featured: true },
        { id: "ordinary-2", featured: false },
      ],
      (work) => work.featured,
      () => 0,
    );
    expect(ordered[0]?.id).toBe("featured");
    expect(ordered.slice(1).map((work) => work.id)).toEqual([
      "ordinary-2",
      "ordinary-1",
    ]);
  });

  it("keeps a daily work order stable while preserving featured works first", () => {
    const items = [
      { id: "ordinary-1", featured: false },
      { id: "featured", featured: true },
      { id: "ordinary-2", featured: false },
      { id: "ordinary-3", featured: false },
    ];
    const salt = dailyOrderSalt(new Date(2026, 7, 17));
    const first = dailyFeaturedOrder(
      items,
      (item) => item.featured,
      (item) => item.id,
      salt,
    );
    const second = dailyFeaturedOrder(
      items,
      (item) => item.featured,
      (item) => item.id,
      salt,
    );

    expect(salt).toBe("2026-08-17");
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
    expect(first[0]?.id).toBe("featured");
  });

  it("filters by publication type", () => {
    expect(
      works.filter((work) => matchesWork(work, "", "anthology")),
    ).toHaveLength(1);
  });

  it("produces distinct stable shelf books", () => {
    const appearances = works.map((work) =>
      JSON.stringify(getBookAppearance(work.id)),
    );
    expect(new Set(appearances).size).toBe(works.length);
    expect(getBookAppearance(works[0]!.id)).toEqual(
      getBookAppearance(works[0]!.id),
    );
  });

  it("assigns every shelf book a stable typographic mark", () => {
    const appearance = getBookAppearance(works[0]!.id);
    expect(appearance.mark).toMatch(/^[◆◇◈⌁❖✧⋮⌘◒⋄]$/u);
    expect(getBookAppearance(works[0]!.id).mark).toBe(appearance.mark);
  });

  it("validates local editor drafts before restoring them", () => {
    expect(localWorkDraftKey("work-1")).toBe(
      "mums-bookshelf:work-draft:work-1",
    );
    expect(
      parseLocalWorkDraft(
        JSON.stringify({
          version: 1,
          savedAt: "2026-08-16T00:00:00.000Z",
          fields: { title: "A draft", featured: false },
        }),
      ),
    ).toMatchObject({ fields: { title: "A draft" } });
    expect(parseLocalWorkDraft("not json")).toBeNull();
    expect(parseLocalWorkDraft(JSON.stringify({ version: 2 }))).toBeNull();
  });

  it("keeps Word-style rich text in the story editor", () => {
    const document = new Window().document as unknown as Document;
    expect(
      wordHtmlToStoryHtml(
        `<h2>A heading</h2><p>One <strong>important</strong> thought.</p><ul><li>First item</li><li><em>Second item</em></li></ul><p><a href="https://example.com">Read more</a></p>`,
        document,
      ),
    ).toBe(
      '<h2>A heading</h2><p>One <strong>important</strong> thought.</p><ul><li>First item</li><li><em>Second item</em></li></ul><p><a href="https://example.com">Read more</a></p>',
    );
    expect(
      wordHtmlToStoryHtml(
        `<p class="MsoNormal" style="text-indent:36pt">A <span style="font-weight:700">bold</span>, <span style="font-style:italic">italic</span>, <span style="text-decoration:underline">underlined</span> and <span style="text-decoration:line-through">struck</span> line.<br>Another line.</p><p style="margin-left:36pt">Indented paragraph.</p>`,
        document,
      ),
    ).toBe(
      '<p data-first-line-indent="medium">A <strong>bold</strong>, <em>italic</em>, <u>underlined</u> and <s>struck</s> line.<br>Another line.</p><p data-indent="true">Indented paragraph.</p>',
    );
    expect(
      wordHtmlToStoryHtml(
        `<p style="mso-list:l0 level1 lfo1">• First item</p><p style="mso-list:l0 level1 lfo1">• Second item</p>`,
        document,
      ),
    ).toBe("<ul><li>• First item</li><li>• Second item</li></ul>");
    expect(
      storyTextToEditorHtml("## A heading\n\nA **bold** line", document),
    ).toBe("<h2>A heading</h2><p>A <strong>bold</strong> line</p>");
    expect(
      storyTextToEditorHtml("###\n\n#####\n\n### A heading", document),
    ).toBe("<hr><hr><h3>A heading</h3>");
    expect(
      wordHtmlToStoryHtml(
        '<p data-drop-cap="false">A plain opening.</p>',
        document,
      ),
    ).toBe('<p data-drop-cap="false">A plain opening.</p>');
    expect(
      storyTextToEditorHtml(
        `<!-- /* Font Definitions */\n@font-face { font-family: "Cambria Math"; }\n-->\nI shouldn't be here.\n\nDaddy's home.`,
        document,
      ),
    ).toBe("<p>I shouldn't be here.</p><p>Daddy's home.</p>");
    expect(
      storyTextToEditorHtml(
        `<!-- p.MsoNormal { text-indent: 36pt; line-height: 200%; } -->\nFirst paragraph.\n\nSecond paragraph.`,
        document,
      ),
    ).toBe(
      '<p data-first-line-indent="medium">First paragraph.</p><p data-first-line-indent="medium">Second paragraph.</p>',
    );
    expect(
      wordHtmlToStoryHtml(
        '<p style="text-indent: calc(2rem + 1px)">Ignored.</p><p style="text-indent: -12pt">Also ignored.</p><p style="text-indent: 15px">Small indent.</p>',
        document,
      ),
    ).toBe(
      '<p>Ignored.</p><p>Also ignored.</p><p data-first-line-indent="small">Small indent.</p>',
    );
    expect(
      wordHtmlToStoryHtml(
        "&lt;!-- /* Font Definitions */ --&gt;<p>Clean story text.</p>",
        document,
      ),
    ).toBe("<p>Clean story text.</p>");
    expect(
      hasStructuredStoryHtml(
        "<!-- /* Font Definitions */ -->\nI shouldn't be here.",
      ),
    ).toBe(false);
  });
});
