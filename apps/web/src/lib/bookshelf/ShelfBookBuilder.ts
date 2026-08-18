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
    const openSpread = new THREE.Group();
    const coverThickness = 0.08;
    const spineDepth = 0.12;
    const coverMaterial = new THREE.MeshStandardMaterial({
      color: appearance.primaryColor,
      roughness: appearance.materialStyle === "leather" ? 0.38 : 0.68,
      metalness: 0.03,
    });
    const pageMaterial = new THREE.MeshStandardMaterial({
      color: "#e9ddc4",
      roughness: 0.84,
    });
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, spineDepth),
      coverMaterial,
    );
    spine.position.z = depth / 2 - spineDepth / 2;
    spine.castShadow = true;
    root.add(spine);

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
    title.position.z = depth / 2 + 0.006;
    title.renderOrder = 1;
    root.add(
      title,
      this.makeEmbossedBadge(width, height, appearance.accentColor, depth / 2),
    );

    const pageWidth = THREE.MathUtils.clamp(height * 0.5, 0.9, 1.38);
    const pageHeight = height * 0.84;
    openSpread.position.z = -depth / 2 + coverThickness;
    this.addOpenLeaf(
      frontCover,
      -1,
      pageWidth,
      pageHeight,
      coverThickness,
      coverMaterial,
      pageMaterial,
    );
    this.addOpenLeaf(
      backCover,
      1,
      pageWidth,
      pageHeight,
      coverThickness,
      coverMaterial,
      pageMaterial,
    );
    openSpread.add(frontCover, backCover);
    openSpread.visible = false;
    root.add(openSpread);

    root.position.copy(home);
    root.rotation.z = THREE.MathUtils.degToRad(appearance.lean);
    return new ShelfBook({
      root,
      frontCover,
      backCover,
      openSpread,
      home,
      homeLean: root.rotation.z,
      url: layout.url,
    });
  }

  private addOpenLeaf(
    leaf: THREE.Group,
    direction: -1 | 1,
    pageWidth: number,
    pageHeight: number,
    coverThickness: number,
    coverMaterial: THREE.MeshStandardMaterial,
    pageMaterial: THREE.MeshStandardMaterial,
  ) {
    const centerX = direction * pageWidth * 0.5;
    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(
        pageWidth + coverThickness,
        pageHeight + coverThickness,
        coverThickness,
      ),
      coverMaterial,
    );
    cover.position.set(centerX, 0, 0);
    cover.castShadow = true;
    const pageBlock = new THREE.Mesh(
      new THREE.BoxGeometry(pageWidth * 0.96, pageHeight * 0.96, 0.1),
      pageMaterial,
    );
    pageBlock.position.set(centerX, 0, -0.09);
    pageBlock.castShadow = true;
    const pageSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(pageWidth * 0.91, pageHeight * 0.91),
      new THREE.MeshStandardMaterial({
        color: "#f6ecd8",
        roughness: 0.92,
      }),
    );
    pageSurface.rotation.y = Math.PI;
    pageSurface.position.set(centerX, 0, -0.145);
    leaf.add(cover, pageBlock, pageSurface);
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
