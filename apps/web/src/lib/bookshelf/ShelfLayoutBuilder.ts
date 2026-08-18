import { getBookAppearance, type BookAppearance } from "@mums-bookshelf/shared";

export type ShelfBookSource = {
  appearance: BookAppearance;
  id: string;
  title: string;
  url: string;
};

export type ShelfBookLayout = ShelfBookSource & {
  depth: number;
  height: number;
  width: number;
};

export type ShelfLayout = {
  cabinetHeight: number;
  rows: ShelfBookLayout[][];
  shelfHeights: number[];
};

export function getShelfViewportHeight(
  rowCount: number,
  compact: boolean,
  viewportWidth: number,
): number {
  const baseHeight = compact ? 390 : 530;
  const rowHeight = viewportWidth * (3.55 / 15);
  return baseHeight + Math.max(rowCount - 1, 0) * rowHeight;
}

type ShelfLayoutBuilderOptions = {
  boardThickness: number;
  shelfPadding: number;
  shelfSpacing: number;
  shelfWidth: number;
};

export class ShelfLayoutBuilder {
  readonly boardThickness: number;
  readonly shelfPadding: number;
  readonly shelfSpacing: number;
  readonly shelfWidth: number;

  constructor(options: ShelfLayoutBuilderOptions) {
    this.boardThickness = options.boardThickness;
    this.shelfPadding = options.shelfPadding;
    this.shelfSpacing = options.shelfSpacing;
    this.shelfWidth = options.shelfWidth;
  }

  fromLinks(links: readonly HTMLAnchorElement[]): ShelfLayout {
    const rows: ShelfBookLayout[][] = [[]];
    const capacity = this.shelfWidth - this.shelfPadding * 2;
    let rowWidth = 0;

    links.forEach((link) => {
      const id =
        link.closest<HTMLElement>(".book-slot")?.dataset.workId ||
        link.dataset.bookTitle ||
        "book";
      const appearance = getBookAppearance(id);
      const book: ShelfBookLayout = {
        id,
        title: link.dataset.bookTitle || link.dataset.title || "Untitled story",
        url: link.href,
        appearance,
        width: appearance.width / 46,
        height: appearance.height / 78,
        depth: 0.42 + appearance.depth / 95,
      };
      const gap = rowWidth ? 0.08 : 0;
      if (rowWidth && rowWidth + gap + book.width > capacity) {
        rows.push([]);
        rowWidth = 0;
      }
      rows.at(-1)!.push(book);
      rowWidth += (rowWidth ? 0.08 : 0) + book.width;
    });

    const shelfHeights = rows.map(
      (_, index) => 0.25 + index * this.shelfSpacing,
    );
    return {
      rows,
      shelfHeights,
      cabinetHeight: Math.max(4.25, rows.length * this.shelfSpacing + 0.9),
    };
  }
}
