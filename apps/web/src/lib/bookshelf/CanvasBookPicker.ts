import * as THREE from "three";
import type { ShelfBook } from "./ShelfBook";

type PickerOptions = {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  books: readonly ShelfBook[];
  onHover: (book: ShelfBook | undefined) => void;
  onPick: (book: ShelfBook) => void;
};

const touchTapSlopPixels = 12;

export class CanvasBookPicker {
  private readonly canvas: HTMLCanvasElement;
  private readonly camera: THREE.Camera;
  private readonly roots: THREE.Object3D[];
  private readonly booksByRoot = new Map<THREE.Object3D, ShelfBook>();
  private readonly onHover: (book: ShelfBook | undefined) => void;
  private readonly onPick: (book: ShelfBook) => void;
  private readonly pointer = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();
  private hoveredBook: ShelfBook | undefined;
  private touchMoved = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private suppressNextClick = false;

  constructor(options: PickerOptions) {
    this.canvas = options.canvas;
    this.camera = options.camera;
    this.roots = options.books.map((book) => {
      this.booksByRoot.set(book.root, book);
      return book.root;
    });
    this.onHover = options.onHover;
    this.onPick = options.onPick;
    this.canvas.addEventListener("pointermove", this.handlePointerMove, {
      passive: true,
    });
    this.canvas.addEventListener("pointerleave", this.handlePointerLeave);
    this.canvas.addEventListener("click", this.handleClick);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown, {
      passive: true,
    });
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
  }

  dispose() {
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerleave", this.handlePointerLeave);
    this.canvas.removeEventListener("click", this.handleClick);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.style.cursor = "default";
  }

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch") {
      this.touchMoved ||= Math.hypot(
        event.clientX - this.touchStartX,
        event.clientY - this.touchStartY,
      ) > touchTapSlopPixels;
      return;
    }
    const book = this.pick(event);
    this.hoveredBook = book;
    this.canvas.style.cursor = book ? "pointer" : "default";
    this.onHover(book);
  };

  private readonly handlePointerLeave = () => {
    this.hoveredBook = undefined;
    this.canvas.style.cursor = "default";
    this.onHover(undefined);
  };

  private readonly handleClick = (event: MouseEvent) => {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    const book = this.pick(event) ?? this.hoveredBook;
    if (book) this.onPick(book);
  };

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    this.touchMoved = false;
    this.touchStartX = event.clientX;
    this.touchStartY = event.clientY;
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    this.suppressNextClick = true;
    if (this.touchMoved) return;
    const book = this.pick(event);
    if (book) this.onPick(book);
  };

  private pick(event: MouseEvent): ShelfBook | undefined {
    const bounds = this.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return undefined;
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.roots, true)[0];
    let object = hit?.object;
    while (object) {
      const book = this.booksByRoot.get(object);
      if (book) return book;
      object = object.parent ?? undefined;
    }
    return undefined;
  }
}
