import * as THREE from "three";
import { BookTitleTextureFactory } from "./BookTitleTextureFactory";
import { ShelfBook } from "./ShelfBook";
import type { ShelfBookLayout } from "./ShelfLayoutBuilder";

export class ShelfBookBuilder {
  private readonly titleTextures: BookTitleTextureFactory;

  constructor(titleTextures: BookTitleTextureFactory) {
    this.titleTextures = titleTextures;
  }

  build(layout: ShelfBookLayout, home: THREE.Vector3): ShelfBook {
    const { appearance, depth, height, width } = layout;
    const root = new THREE.Group();
    const frontCover = new THREE.Group();
    const backCover = new THREE.Group();
    const coverThickness = 0.11;
    const pageDepth = Math.max(0.16, depth - coverThickness * 2);
    const coverMaterial = new THREE.MeshStandardMaterial({
      color: appearance.primaryColor,
      roughness: appearance.materialStyle === "leather" ? 0.38 : 0.68,
      metalness: 0.03,
    });
    const pageMaterial = new THREE.MeshStandardMaterial({
      color: "#eadfc9",
      roughness: 0.9,
    });
    const pages = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.12, height - 0.14, pageDepth),
      pageMaterial,
    );
    pages.castShadow = true;
    root.add(pages);

    const coverZ = pageDepth / 2 + coverThickness / 2;
    frontCover.position.x = -width / 2;
    const front = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, coverThickness),
      coverMaterial,
    );
    front.position.set(width / 2, 0, coverZ);
    front.castShadow = true;
    frontCover.add(front);

    backCover.position.x = -width / 2;
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, coverThickness),
      coverMaterial,
    );
    back.position.set(width / 2, 0, -coverZ);
    back.castShadow = true;
    backCover.add(back);

    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(coverThickness, height, depth),
      coverMaterial,
    );
    spine.position.x = -width / 2;
    spine.castShadow = true;
    root.add(frontCover, backCover, spine);

    const titleTexture = this.titleTextures.create({
      title: layout.title,
      accent: appearance.accentColor,
      appearance,
      width,
      height,
    });
    const title = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 0.94, height * 0.76),
      new THREE.MeshBasicMaterial({
        map: titleTexture,
        transparent: true,
        depthWrite: false,
      }),
    );
    title.position.set(width / 2, 0, coverZ + coverThickness / 2 + 0.006);
    title.renderOrder = 1;
    frontCover.add(
      title,
      this.makeEmbossedBadge(
        width,
        height,
        appearance.accentColor,
        coverZ + coverThickness / 2,
      ),
    );

    root.position.copy(home);
    root.rotation.z = THREE.MathUtils.degToRad(appearance.lean);
    return new ShelfBook({
      root,
      frontCover,
      backCover,
      home,
      homeLean: root.rotation.z,
      url: layout.url,
    });
  }

  private makeEmbossedBadge(
    width: number,
    height: number,
    accent: string,
    frontZ: number,
  ) {
    const radius = Math.min(width * 0.18, 0.09);
    const badge = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({
      color: accent,
      metalness: 0.45,
      roughness: 0.34,
    });
    const recess = new THREE.MeshStandardMaterial({
      color: "#2d1a10",
      roughness: 0.55,
      metalness: 0.08,
    });
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.018, 12),
      recess,
    );
    base.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.7, radius * 0.18, 6, 12),
      metal,
    );
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(radius * 0.32),
      metal,
    );
    gem.scale.z = 0.24;
    rim.position.z = 0.016;
    gem.position.z = 0.03;
    badge.add(base, rim, gem);
    badge.position.set(width / 2, -height / 2 + radius * 2.1, frontZ + 0.018);
    return badge;
  }
}
