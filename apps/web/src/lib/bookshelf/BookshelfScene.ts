import * as THREE from "three";

type BookshelfSceneOptions = {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  focusY: number;
};

export class BookshelfScene {
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();

  private readonly container: HTMLElement;
  private readonly resizeObserver: ResizeObserver;

  constructor(options: BookshelfSceneOptions) {
    this.container = options.container;
    this.renderer = new THREE.WebGLRenderer({
      canvas: options.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color("#482718");
    this.camera = new THREE.PerspectiveCamera(29, 1, 0.1, 100);
    this.camera.position.set(0, options.focusY + 0.65, 9.2);
    this.camera.lookAt(0, options.focusY, 0);
    this.addLighting();
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.container);
    this.resize();
  }

  setAnimationLoop(animate: () => void) {
    this.renderer.setAnimationLoop(animate);
  }

  render() {
    this.scene.updateMatrixWorld(true);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      const meshMaterials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      meshMaterials.forEach((material) => {
        if (!material) return;
        materials.add(material);
        const texture = (material as THREE.MeshBasicMaterial).map;
        if (texture) textures.add(texture);
      });
    });
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
    geometries.forEach((geometry) => geometry.dispose());
    this.renderer.dispose();
  }

  private readonly resize = () => {
    const { width, height } = this.container.getBoundingClientRect();
    const safeHeight = Math.max(height, 1);
    this.renderer.setSize(width, safeHeight, false);
    this.camera.aspect = width / safeHeight;
    this.camera.updateProjectionMatrix();
  };

  private addLighting() {
    const warmLight = new THREE.SpotLight(
      "#ffe2ad",
      260,
      30,
      Math.PI / 5,
      0.7,
      1.5,
    );
    warmLight.position.set(-5, 9, 8);
    warmLight.castShadow = true;
    warmLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(
      warmLight,
      new THREE.HemisphereLight("#f7dbad", "#25130c", 2.4),
    );
  }
}
