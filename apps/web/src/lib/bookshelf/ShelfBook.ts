import * as THREE from "three";

export type ShelfBookOptions = {
  root: THREE.Group;
  frontCover: THREE.Group;
  backCover: THREE.Group;
  home: THREE.Vector3;
  homeLean: number;
  url: string;
};

export class ShelfBook {
  readonly root: THREE.Group;
  readonly frontCover: THREE.Group;
  readonly backCover: THREE.Group;
  readonly home: THREE.Vector3;
  readonly homeLean: number;
  readonly url: string;

  private readonly targetPosition = new THREE.Vector3();
  private open = 0;
  private hover = 0;
  private pull = 0;

  constructor(options: ShelfBookOptions) {
    this.root = options.root;
    this.frontCover = options.frontCover;
    this.backCover = options.backCover;
    this.home = options.home;
    this.homeLean = options.homeLean;
    this.url = options.url;
  }

  get isOpen() {
    return this.open === 1;
  }

  setSelected(selected: boolean) {
    this.open = Number(selected);
    if (!selected) this.pull = 0;
  }

  update(isHovered: boolean) {
    this.hover = THREE.MathUtils.lerp(
      this.hover,
      isHovered && !this.isOpen ? 1 : 0,
      0.16,
    );
    if (this.isOpen) {
      const hasReturnedToShelf =
        Math.abs(this.root.position.y - this.home.y) < 0.012 &&
        Math.abs(this.root.position.z - this.home.z) < 0.012;
      this.pull = hasReturnedToShelf
        ? THREE.MathUtils.lerp(this.pull, 1, 0.1)
        : 0;
      this.targetPosition.copy(this.home);
      this.targetPosition.z += 3.25 * this.pull;
    } else {
      this.targetPosition.copy(this.home);
      this.targetPosition.y += this.hover * 0.24;
      this.targetPosition.z += this.hover * 0.18;
    }
    this.root.position.lerp(this.targetPosition, 0.11);
    this.root.rotation.y = THREE.MathUtils.lerp(
      this.root.rotation.y,
      this.isOpen ? Math.PI * this.pull : 0,
      0.1,
    );
    this.root.rotation.z = THREE.MathUtils.lerp(
      this.root.rotation.z,
      this.isOpen ? this.homeLean * (1 - this.pull) : this.homeLean,
      0.1,
    );
    if (!this.isOpen) {
      this.root.rotation.x = THREE.MathUtils.lerp(this.root.rotation.x, 0, 0.1);
    }
    this.frontCover.rotation.y = THREE.MathUtils.lerp(
      this.frontCover.rotation.y,
      this.isOpen ? -1.18 * this.pull : 0,
      0.1,
    );
    this.backCover.rotation.y = THREE.MathUtils.lerp(
      this.backCover.rotation.y,
      this.isOpen ? 1.18 * this.pull : 0,
      0.1,
    );
  }
}
