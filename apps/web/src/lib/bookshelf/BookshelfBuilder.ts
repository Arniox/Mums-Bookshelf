import * as THREE from "three";
import { BookTitleTextureFactory } from "./BookTitleTextureFactory";
import { BookshelfScene } from "./BookshelfScene";
import { CanvasBookPicker } from "./CanvasBookPicker";
import { ShelfBook } from "./ShelfBook";
import { ShelfBookBuilder } from "./ShelfBookBuilder";
import { ShelfFurnitureBuilder } from "./ShelfFurnitureBuilder";
import {
  getResponsiveShelfWidth,
  getShelfViewportHeight,
  ShelfLayoutBuilder,
} from "./ShelfLayoutBuilder";

type BookshelfBuilderOptions = {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  hint?: HTMLElement;
  links: readonly HTMLAnchorElement[];
};

const shelfPadding = 0.65;
const shelfSpacing = 3.55;
const boardThickness = 0.28;
const redirectDelayMilliseconds = 25;

export class BookshelfBuilder {
  private readonly canvas: HTMLCanvasElement;
  private readonly container: HTMLElement;
  private readonly hint: HTMLElement | undefined;
  private readonly links: readonly HTMLAnchorElement[];
  private readonly books: ShelfBook[] = [];
  private readonly activeBooks = new Set<ShelfBook>();
  private hovered: ShelfBook | undefined;
  private picker: CanvasBookPicker | undefined;
  private scene: BookshelfScene | undefined;
  private selected: ShelfBook | undefined;
  private redirectTimer: number | undefined;
  private rowCount = 0;
  private shelfWidth = 8;
  private animationRunning = false;
  private viewportObserver: ResizeObserver | undefined;
  private viewportWidth = Number.NaN;

  constructor(options: BookshelfBuilderOptions) {
    this.canvas = options.canvas;
    this.container = options.container;
    this.hint = options.hint;
    this.links = options.links;
  }

  start() {
    this.viewportObserver = new ResizeObserver(this.handleViewportResize);
    this.viewportObserver.observe(this.container);
    window.addEventListener("pageshow", this.handlePageShow);
    this.rebuildShelf();
  }

  dispose() {
    window.removeEventListener("pageshow", this.handlePageShow);
    this.viewportObserver?.disconnect();
    this.viewportObserver = undefined;
    this.disposeShelf();
  }

  private rebuildShelf() {
    const viewportWidth = this.container.getBoundingClientRect().width;
    if (!viewportWidth) return;
    this.disposeShelf();
    this.shelfWidth = getResponsiveShelfWidth(viewportWidth);
    const layout = new ShelfLayoutBuilder({
      shelfWidth: this.shelfWidth,
      shelfPadding,
      shelfSpacing,
      boardThickness,
    }).fromLinks(this.links);
    this.rowCount = layout.rows.length;
    this.updateViewportHeight(viewportWidth, true);
    const focusY =
      (layout.shelfHeights[0]! + layout.shelfHeights.at(-1)!) / 2 + 1.55;
    this.scene = new BookshelfScene({
      canvas: this.canvas,
      cabinetHeight: layout.cabinetHeight,
      container: this.container,
      focusY,
      shelfWidth: this.shelfWidth,
    });
    this.scene.scene.add(
      new ShelfFurnitureBuilder().build({
        shelfWidth: this.shelfWidth,
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
        if (book === this.hovered) return;
        if (this.hovered) this.activeBooks.add(this.hovered);
        this.hovered = book;
        if (book) this.activeBooks.add(book);
        this.requestAnimation();
      },
      onPick: this.pickBook,
    });
    this.scene.render();
  }

  private disposeShelf() {
    if (this.redirectTimer !== undefined) {
      window.clearTimeout(this.redirectTimer);
      this.redirectTimer = undefined;
    }
    this.picker?.dispose();
    this.picker = undefined;
    this.scene?.dispose();
    this.scene = undefined;
    this.books.length = 0;
    this.activeBooks.clear();
    this.animationRunning = false;
    this.hovered = undefined;
    this.selected = undefined;
  }

  private readonly animate = () => {
    const camera = this.scene?.camera;
    if (!camera || !this.scene) return;
    this.activeBooks.forEach((book) => {
      if (!book.update(book === this.hovered, camera.position)) {
        this.activeBooks.delete(book);
        if (book === this.selected) this.scheduleNavigation(book);
      }
    });
    this.scene.render();
    if (!this.activeBooks.size) {
      this.scene.setAnimationLoop(null);
      this.animationRunning = false;
    }
  };

  private readonly handleViewportResize = () => {
    const viewportWidth = this.container.getBoundingClientRect().width;
    if (Math.abs(viewportWidth - this.viewportWidth) < 1) return;
    this.rebuildShelf();
  };

  private readonly pickBook = (book: ShelfBook) => {
    if (this.selected) return;
    this.selected = book;
    this.books.forEach((candidate) => {
      candidate.setSelected(candidate === book);
      this.activeBooks.add(candidate);
    });
    this.requestAnimation();
    if (this.hint) {
      this.hint.textContent = "Opening your story...";
    }
  };

  private scheduleNavigation(book: ShelfBook) {
    if (this.redirectTimer !== undefined) return;
    this.redirectTimer = window.setTimeout(() => {
      window.location.assign(book.url);
    }, redirectDelayMilliseconds);
  }

  private readonly handlePageShow = () => {
    if (this.redirectTimer !== undefined) {
      window.clearTimeout(this.redirectTimer);
      this.redirectTimer = undefined;
    }
    this.selected = undefined;
    this.books.forEach((book) => {
      book.setSelected(false);
      this.activeBooks.add(book);
    });
    if (this.hint) {
      this.hint.textContent = "Select a book to pull it from the shelf.";
    }
    this.requestAnimation();
  };

  private requestAnimation() {
    if (!this.scene || this.animationRunning) return;
    this.animationRunning = true;
    this.scene.setAnimationLoop(this.animate);
  }

  private updateViewportHeight(viewportWidth: number, force = false) {
    if (!force && Math.abs(viewportWidth - this.viewportWidth) < 1) return;
    this.viewportWidth = viewportWidth;
    this.container.style.setProperty(
      "--webgl-shelf-height",
      `${getShelfViewportHeight(
        this.rowCount,
        window.matchMedia("(max-width: 640px)").matches,
        viewportWidth,
        this.shelfWidth,
        shelfSpacing,
      )}px`,
    );
  }
}
