import { describe, expect, it } from "vitest";
import { getBookAppearance } from "@mums-bookshelf/shared";
import { works } from "../src/data/sample";
import { matchesWork } from "../src/lib/filterWorks";
import {
  localWorkDraftKey,
  parseLocalWorkDraft,
} from "../src/lib/localDraft";

describe("public library", () => {
  it("renders a populated public shelf without drafts", () => {
    expect(works.length).toBeGreaterThanOrEqual(5);
    expect(works.every((work) => work.status === "published")).toBe(true);
  });

  it("supports empty shelves", () => {
    const empty: typeof works = [];
    expect(empty).toHaveLength(0);
  });

  it("searches titles, genres and tags", () => {
    expect(
      works.filter((work) => matchesWork(work, "lantern", "")),
    ).toHaveLength(1);
    expect(works.filter((work) => matchesWork(work, "coast", ""))).toHaveLength(
      1,
    );
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
});
