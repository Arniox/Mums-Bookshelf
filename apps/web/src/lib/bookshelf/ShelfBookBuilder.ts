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
    const leftLeaf = new THREE.Group();
    const rightLeaf = new THREE.Group();
    const coverThickness = 0.08;
    const paperThickness = Math.max(0.12, depth * 0.38);
    const coverHeight = height;
    const pageWidth = THREE.MathUtils.clamp(height * 0.58, 1.05, 1.48);
    const pageHeight = coverHeight - coverThickness * 3;
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
      new THREE.BoxGeometry(width, height, coverThickness),
      coverMaterial,
    );
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
    title.position.z = coverThickness / 2 + 0.006;
    title.renderOrder = 1;
    root.add(
      title,
      this.makeEmbossedBadge(
        width,
        height,
        appearance.accentColor,
        coverThickness / 2,
      ),
    );

    this.addLeaf(
      leftLeaf,
      -1,
      pageWidth,
      pageHeight,
      coverHeight,
      coverThickness,
      coverMaterial,
      pageMaterial,
      paperThickness,
    );
    this.addLeaf(
      rightLeaf,
      1,
      pageWidth,
      pageHeight,
      coverHeight,
      coverThickness,
      coverMaterial,
      pageMaterial,
      paperThickness,
    );
    leftLeaf.rotation.y = -Math.PI / 2;
    rightLeaf.rotation.y = Math.PI / 2;
    root.add(leftLeaf, rightLeaf);

    root.position.copy(home);
    root.rotation.z = THREE.MathUtils.degToRad(appearance.lean);
    return new ShelfBook({
      root,
      leftLeaf,
      rightLeaf,
      home,
      homeLean: root.rotation.z,
      url: layout.url,
    });
  }

  private addLeaf(
    leaf: THREE.Group,
    direction: -1 | 1,
    pageWidth: number,
    pageHeight: number,
    coverHeight: number,
    coverThickness: number,
    coverMaterial: THREE.MeshStandardMaterial,
    pageMaterial: THREE.MeshStandardMaterial,
    paperThickness: number,
  ) {
    const centerX = direction * (pageWidth * 0.5 - 0.025);
    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(
        pageWidth + coverThickness,
        coverHeight,
        coverThickness,
      ),
      coverMaterial,
    );
    cover.position.set(centerX, 0, paperThickness / 2 + coverThickness / 2);
    cover.castShadow = true;
    const pageBlock = new THREE.Mesh(
      new THREE.BoxGeometry(
        pageWidth * 0.96,
        pageHeight * 0.96,
        paperThickness,
      ),
      pageMaterial,
    );
    pageBlock.position.set(centerX, 0, 0);
    pageBlock.castShadow = true;
    const pageSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(pageWidth * 0.91, pageHeight * 0.91),
      new THREE.MeshStandardMaterial({
        color: "#f6ecd8",
        roughness: 0.92,
      }),
    );
    pageSurface.position.set(centerX, 0, -paperThickness / 2 - 0.002);
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
    badge.position.set(0, -height / 2 + radius * 2.1, frontZ + 0.018);
    return badge;
  }
}
