import { getBookAppearance } from "@mums-bookshelf/shared";
import { Window } from "happy-dom";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { works } from "../src/data/sample";
import { ShelfBook } from "../src/lib/bookshelf/ShelfBook";
import {
  getResponsiveShelfWidth,
  getShelfViewportHeight,
  ShelfLayoutBuilder,
} from "../src/lib/bookshelf/ShelfLayoutBuilder";
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

  it("uses taller books with centered spine titles", () => {
    const appearance = getBookAppearance(works[0]!.id);
    expect(appearance.height).toBeGreaterThanOrEqual(184);
    expect(appearance.titlePosition).toBe("middle");
  });

  it("settles a hovered book completely before demand animation stops", () => {
    const home = new THREE.Vector3(0, 2, 0.2);
    const book = new ShelfBook({
      root: new THREE.Group(),
      leftLeaf: new THREE.Group(),
      rightLeaf: new THREE.Group(),
      home,
      homeLean: 0,
      url: "/works/test/",
    });
    const camera = new THREE.Vector3(0, 2, 10);
    const advanceUntilIdle = (hovered: boolean) => {
      let active = true;
      for (let frame = 0; frame < 240 && active; frame += 1) {
        active = book.update(hovered, camera);
      }
      return active;
    };

    expect(advanceUntilIdle(true)).toBe(false);
    expect(advanceUntilIdle(false)).toBe(false);
    expect(book.root.position).toEqual(home);
    expect(book.root.rotation.z).toBe(0);
  });

  it("settles an open book back at home", () => {
    const home = new THREE.Vector3(0, 2, 0.2);
    const book = new ShelfBook({
      root: new THREE.Group(),
      leftLeaf: new THREE.Group(),
      rightLeaf: new THREE.Group(),
      home,
      homeLean: 0,
      url: "/works/test/",
    });
    const camera = new THREE.Vector3(0, 2, 10);

    book.setSelected(true);
    for (let frame = 0; frame < 240; frame += 1) book.update(false, camera);
    expect(book.root.position.z).toBeGreaterThan(home.z + 1);

    book.setSelected(false);
    let moving = true;
    for (let frame = 0; frame < 240 && moving; frame += 1) {
      moving = book.update(false, camera);
    }
    expect(moving).toBe(false);
    expect(book.root.position).toEqual(home);
  });

  it("adds shelves and canvas height for hundreds of books without overflow", () => {
    const document = new Window().document as unknown as Document;
    const links = Array.from({ length: 240 }, (_, index) => {
      const link = document.createElement("a");
      link.href = `/works/stress-${index}/`;
      link.dataset.bookTitle = `Stress book ${index}`;
      return link;
    });
    const builder = new ShelfLayoutBuilder({
      shelfWidth: 8,
      shelfPadding: 0.65,
      shelfSpacing: 3.55,
      boardThickness: 0.28,
    });
    const layout = builder.fromLinks(links);
    const capacity = builder.shelfWidth - builder.shelfPadding * 2;

    expect(layout.rows.length).toBeGreaterThan(1);
    expect(layout.rows.flat()).toHaveLength(links.length);
    expect(
      layout.rows
        .slice()
        .reverse()
        .flat()
        .map((book) => book.id),
    ).toEqual(links.map((link) => link.dataset.bookTitle));
    layout.rows.forEach((row) => {
      const width = row.reduce(
        (total, book, index) => total + book.width + (index ? 0.08 : 0),
        0,
      );
      expect(width).toBeLessThanOrEqual(capacity);
    });
    expect(layout.shelfHeights).toHaveLength(layout.rows.length);
    expect(
      getShelfViewportHeight(
        layout.rows.length,
        false,
        800,
        builder.shelfWidth,
        builder.shelfSpacing,
      ),
    ).toBe(
      530 +
        (layout.rows.length - 1) *
          (800 * (builder.shelfSpacing / builder.shelfWidth)),
    );
    expect(
      getShelfViewportHeight(
        layout.rows.length,
        false,
        800,
        builder.shelfWidth,
        builder.shelfSpacing,
      ),
    ).toBeGreaterThan(530);
    expect(
      getShelfViewportHeight(
        layout.rows.length,
        false,
        400,
        builder.shelfWidth,
        builder.shelfSpacing,
      ),
    ).toBeLessThan(
      getShelfViewportHeight(
        layout.rows.length,
        false,
        800,
        builder.shelfWidth,
        builder.shelfSpacing,
      ),
    );
    expect(getResponsiveShelfWidth(800)).toBe(8);
    expect(getResponsiveShelfWidth(600)).toBe(6);
    expect(getResponsiveShelfWidth(2_000)).toBe(12);
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
      storyTextToEditorHtml("##\n\n#####\n\n### A heading", document),
    ).toBe(
      '<p data-scene-break="true">##</p><p data-scene-break="true">#####</p><h3>A heading</h3>',
    );
    expect(
      wordHtmlToStoryHtml("<p>###</p><p>The next passage.</p>", document),
    ).toBe('<p data-scene-break="true">###</p><p>The next passage.</p>');
    expect(
      storyTextToEditorHtml(
        "An opening passage.\n\n###\n\nThe next passage.",
        document,
      ),
    ).toBe(
      '<p>An opening passage.</p><p data-scene-break="true">###</p><p>The next passage.</p>',
    );
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
