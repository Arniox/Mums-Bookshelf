import * as THREE from "three";
import { BookTitleTextureFactory } from "./BookTitleTextureFactory";
import { BookshelfScene } from "./BookshelfScene";
import { CanvasBookPicker } from "./CanvasBookPicker";
import { ShelfBook } from "./ShelfBook";
import { ShelfBookBuilder } from "./ShelfBookBuilder";
import { ShelfFurnitureBuilder } from "./ShelfFurnitureBuilder";
import {
  getShelfViewportHeight,
  ShelfLayoutBuilder,
} from "./ShelfLayoutBuilder";

type BookshelfBuilderOptions = {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  hint?: HTMLElement;
  links: readonly HTMLAnchorElement[];
};

const shelfWidth = 8;
const shelfPadding = 0.65;
const shelfSpacing = 3.55;
const boardThickness = 0.28;

export class BookshelfBuilder {
  private readonly canvas: HTMLCanvasElement;
  private readonly container: HTMLElement;
  private readonly hint: HTMLElement | undefined;
  private readonly links: readonly HTMLAnchorElement[];
  private readonly books: ShelfBook[] = [];
  private hovered: ShelfBook | undefined;
  private picker: CanvasBookPicker | undefined;
  private scene: BookshelfScene | undefined;
  private selected: ShelfBook | undefined;
  private rowCount = 0;
  private viewportObserver: ResizeObserver | undefined;
  private viewportWidth = Number.NaN;

  constructor(options: BookshelfBuilderOptions) {
    this.canvas = options.canvas;
    this.container = options.container;
    this.hint = options.hint;
    this.links = options.links;
  }

  start() {
    const layout = new ShelfLayoutBuilder({
      shelfWidth,
      shelfPadding,
      shelfSpacing,
      boardThickness,
    }).fromLinks(this.links);
    this.rowCount = layout.rows.length;
    this.updateViewportHeight(layout.rows.length);
    const focusY =
      (layout.shelfHeights[0]! + layout.shelfHeights.at(-1)!) / 2 + 1.55;
    this.scene = new BookshelfScene({
      canvas: this.canvas,
      cabinetHeight: layout.cabinetHeight,
      container: this.container,
      focusY,
      shelfWidth,
    });
    this.scene.scene.add(
      new ShelfFurnitureBuilder().build({
        shelfWidth,
        boardThickness,
        cabinetHeight: layout.cabinetHeight,
        shelfHeights: layout.shelfHeights,
      }),
    );

    const books = new ShelfBookBuilder(
      new BookTitleTextureFactory(
        this.scene.renderer.capabilities.getMaxAnisotropy(),
      ),
    );
    layout.rows.forEach((row, rowIndex) => {
      const rowWidth = row.reduce(
        (total, book, index) => total + book.width + (index ? 0.08 : 0),
        0,
      );
      let cursor = -rowWidth / 2;
      row.forEach((book, bookIndex) => {
        const depthOffset = bookIndex % 2 === 0 ? 0.005 : -0.005;
        const home = new THREE.Vector3(
          cursor + book.width / 2,
          layout.shelfHeights[rowIndex]! +
            boardThickness / 2 +
            book.height / 2 +
            Math.abs(
              Math.sin(THREE.MathUtils.degToRad(book.appearance.lean)) *
                book.width *
                0.5,
            ) +
            0.025,
          0.2 + depthOffset,
        );
        const shelfBook = books.build(book, home);
        this.books.push(shelfBook);
        this.scene!.scene.add(shelfBook.root);
        cursor += book.width + 0.08;
      });
    });

    this.picker = new CanvasBookPicker({
      canvas: this.canvas,
      camera: this.scene.camera,
      books: this.books,
      onHover: (book) => {
        this.hovered = book;
      },
      onPick: this.pickBook,
    });
    this.viewportObserver = new ResizeObserver(this.handleViewportResize);
    this.viewportObserver.observe(this.container);
    this.scene.setAnimationLoop(this.animate);
  }

  dispose() {
    this.picker?.dispose();
    this.picker = undefined;
    this.viewportObserver?.disconnect();
    this.viewportObserver = undefined;
    this.scene?.dispose();
    this.scene = undefined;
    this.books.length = 0;
    this.hovered = undefined;
    this.selected = undefined;
  }

  private readonly animate = (time: number) => {
    const camera = this.scene?.camera;
    if (camera) {
      this.books.forEach((book) =>
        book.update(book === this.hovered, camera.position),
      );
    }
    this.scene?.updateLighting(time);
    this.scene?.render();
  };

  private readonly handleViewportResize = () => {
    this.updateViewportHeight(this.rowCount);
  };

  private readonly pickBook = (book: ShelfBook) => {
    if (this.selected === book) {
      window.location.assign(book.url);
      return;
    }
    this.selected = book;
    this.books.forEach((candidate) =>
      candidate.setSelected(candidate === book),
    );
    if (this.hint) {
      this.hint.textContent = "Select the open book again to begin reading.";
    }
  };

  private updateViewportHeight(rowCount: number) {
    const viewportWidth = this.container.getBoundingClientRect().width;
    if (Math.abs(viewportWidth - this.viewportWidth) < 1) return;
    this.viewportWidth = viewportWidth;
    this.container.style.setProperty(
      "--webgl-shelf-height",
      `${getShelfViewportHeight(
        rowCount,
        window.matchMedia("(max-width: 640px)").matches,
        viewportWidth,
        shelfWidth,
        shelfSpacing,
      )}px`,
    );
  }
}
