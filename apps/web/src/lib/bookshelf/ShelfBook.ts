import * as THREE from "three";

export type ShelfBookOptions = {
  root: THREE.Group;
  leftLeaf: THREE.Group;
  rightLeaf: THREE.Group;
  home: THREE.Vector3;
  homeLean: number;
  url: string;
};

export class ShelfBook {
  readonly root: THREE.Group;
  readonly leftLeaf: THREE.Group;
  readonly rightLeaf: THREE.Group;
  readonly home: THREE.Vector3;
  readonly homeLean: number;
  readonly url: string;

  private readonly targetPosition = new THREE.Vector3();
  private readonly cameraOffset = new THREE.Vector3();
  private open = 0;
  private hover = 0;
  private pageOpen = 0;
  private pull = 0;
  private pullStarted = false;
  private settle = 0;

  constructor(options: ShelfBookOptions) {
    this.root = options.root;
    this.leftLeaf = options.leftLeaf;
    this.rightLeaf = options.rightLeaf;
    this.home = options.home;
    this.homeLean = options.homeLean;
    this.url = options.url;
  }

  get isOpen() {
    return this.open === 1;
  }

  setSelected(selected: boolean) {
    this.open = Number(selected);
    this.pageOpen = 0;
    this.pull = 0;
    this.pullStarted = false;
    this.settle = 0;
  }

  update(isHovered: boolean, cameraPosition: THREE.Vector3): boolean {
    const hoverTarget = isHovered && !this.isOpen ? 1 : 0;
    this.hover = THREE.MathUtils.lerp(this.hover, hoverTarget, 0.16);
    if (this.isOpen) {
      this.settle = THREE.MathUtils.lerp(this.settle, 1, 0.12);
      if (this.settle > 0.96) this.pullStarted = true;
      if (this.pullStarted) {
        this.pull = THREE.MathUtils.lerp(this.pull, 1, 0.1);
      }
      this.targetPosition.copy(this.home);
      this.targetPosition.z += 1.65 * this.pull;
    } else {
      this.targetPosition.copy(this.home);
      this.targetPosition.y += this.hover * 0.24;
      this.targetPosition.z += this.hover * 0.18;
    }
    const pageOpenTarget = this.isOpen
      ? THREE.MathUtils.clamp((this.pull - 0.8) / 0.2, 0, 1)
      : 0;
    this.pageOpen = THREE.MathUtils.lerp(this.pageOpen, pageOpenTarget, 0.1);
    this.root.position.lerp(this.targetPosition, 0.11);
    this.cameraOffset.subVectors(cameraPosition, this.root.position);
    const openYaw =
      Math.PI + Math.atan2(this.cameraOffset.x, this.cameraOffset.z);
    this.root.rotation.y = THREE.MathUtils.lerp(
      this.root.rotation.y,
      this.isOpen ? openYaw * this.pull : 0,
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
    this.leftLeaf.rotation.y = THREE.MathUtils.lerp(
      this.leftLeaf.rotation.y,
      (-Math.PI / 2) * (1 - this.pageOpen),
      0.1,
    );
    this.rightLeaf.rotation.y = THREE.MathUtils.lerp(
      this.rightLeaf.rotation.y,
      (Math.PI / 2) * (1 - this.pageOpen),
      0.1,
    );
    const targetYaw = this.isOpen ? openYaw * this.pull : 0;
    const targetLean = this.isOpen
      ? this.homeLean * (1 - this.pull)
      : this.homeLean;
    const isMoving =
      Math.abs(hoverTarget - this.hover) > 0.0001 ||
      (this.isOpen &&
        (Math.abs(1 - this.settle) > 0.0001 ||
          Math.abs(1 - this.pull) > 0.0001)) ||
      Math.abs(pageOpenTarget - this.pageOpen) > 0.0001 ||
      this.targetPosition.distanceToSquared(this.root.position) > 0.000001 ||
      Math.abs(targetYaw - this.root.rotation.y) > 0.001 ||
      Math.abs(targetLean - this.root.rotation.z) > 0.001 ||
      Math.abs(
        (-Math.PI / 2) * (1 - this.pageOpen) - this.leftLeaf.rotation.y,
      ) > 0.001 ||
      Math.abs(
        (Math.PI / 2) * (1 - this.pageOpen) - this.rightLeaf.rotation.y,
      ) > 0.001;
    if (!isMoving) this.snapToRest(targetYaw, targetLean, pageOpenTarget);
    return isMoving;
  }

  private snapToRest(
    targetYaw: number,
    targetLean: number,
    pageOpenTarget: number,
  ) {
    this.hover = this.isOpen ? 0 : this.hover > 0.5 ? 1 : 0;
    if (this.isOpen) {
      this.settle = 1;
      this.pull = 1;
    }
    this.pageOpen = pageOpenTarget;
    this.root.position.copy(this.targetPosition);
    this.root.rotation.y = targetYaw;
    this.root.rotation.z = targetLean;
    this.leftLeaf.rotation.y = (-Math.PI / 2) * (1 - pageOpenTarget);
    this.rightLeaf.rotation.y = (Math.PI / 2) * (1 - pageOpenTarget);
  }
}
