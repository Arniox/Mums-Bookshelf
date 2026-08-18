---
name: threejs-max-performance
description: 'Build, optimize, debug, and review high-performance Three.js, WebGL, WebXR, GLSL shaders, and Astro 3D experiences. Use when creating a Three.js scene, animation, custom shader, glsl-canvas workflow, rendering optimization, GPU profiling, memory-leak fix, or responsive WebGL component. Targets Three.js ES modules and BufferGeometry.'
argument-hint: 'Describe the Three.js scene, shader, rendering issue, or optimization goal.'
user-invocable: true
---

# Three.js Max Performance

Create clean, modern Three.js experiences that sustain frame time, release GPU resources, and behave correctly across viewport changes and WebXR sessions.

## Project Context

- This workspace uses Astro with ESM and Three.js `^0.185.1` in `apps/web`.
- Keep browser-only Three.js setup out of Astro server rendering. Initialize it in a client script or client-only component lifecycle.
- Use Three.JS Snippets by aerokaido to accelerate familiar boilerplate, then validate generated code against the installed Three.js API and this workflow.
- Use glsl-canvas and Shader languages support by slevesque for `.glsl`, `.vert`, and `.frag` authoring, shader diagnostics, and fast shader iteration. Ship shaders through the project bundler rather than assuming a global editor runtime.

## Non-Negotiable Implementation Rules

- Use ES modules and current Three.js APIs. Never use removed `Geometry`; use `BufferGeometry` and typed buffer attributes.
- Use `renderer.setAnimationLoop(animate)` for continuous rendering. Stop it with `renderer.setAnimationLoop(null)` during teardown.
- Update `camera.aspect`, call `camera.updateProjectionMatrix()`, and call `renderer.setSize(width, height)` on every resize. Keep pixel ratio bounded with `Math.min(window.devicePixelRatio, 2)` unless the product has a measured reason to choose a different cap.
- Treat GPU resources as owned objects. Dispose geometries, materials, textures, render targets, controls, post-processing passes, and the renderer as applicable.
- Avoid allocations in animation and input hot paths. Reuse vectors, quaternions, matrices, colors, raycasters, and temporary arrays; mutate with methods such as `set`, `copy`, `addScaledVector`, and `multiplyScalar`.
- Do not mutate shared material or geometry assets unintentionally. Clone only where per-object variance is required, and dispose the clone with its owner.

## Workflow

1. Define the visual and performance contract.
   - Identify target devices, expected scene complexity, interaction, transparency needs, post-processing, animation count, and whether WebXR is required.
   - Establish a measurable budget: frame time, draw calls, triangles, texture dimensions, and memory ceiling. Optimize against the limiting target, not a desktop-only preview.

2. Choose the smallest rendering architecture.
   - For static or mostly static scenes, prefer demand-driven rendering; render after state changes instead of permanently animating.
   - For continuous movement, use one `setAnimationLoop` owner per canvas.
   - Reuse one renderer, scene, and camera for a single canvas. Use layers, render targets, or viewports before adding another renderer.
   - Prefer built-in materials where they meet the result. Use `ShaderMaterial` or `RawShaderMaterial` only when the visual requirement needs shader-level control.

3. Construct scene data for the GPU.
   - Use indexed `BufferGeometry` where suitable and set only attributes the shader consumes.
   - Use `InstancedMesh` for many objects sharing geometry and material. Use merged geometry only for static objects with identical material behavior.
   - Configure color spaces and tone mapping intentionally. Mark color textures with `SRGBColorSpace`; leave data textures in their appropriate non-color format.
   - Minimize transparent objects, material variants, shadows, lights, and texture switches, because each commonly increases draw calls or fill cost.

4. Build shaders as maintainable source files.
   - Keep vertex and fragment shader source in named `.vert`, `.frag`, or `.glsl` files where the bundler supports it; use the installed shader language extension for syntax support.
   - Pass values that change per object through attributes or instanced attributes, values that change per frame through uniforms, and static choices through shader defines only when variant count stays small.
   - Avoid dynamic loops, branching on per-fragment values, high-frequency noise, large dependent texture reads, and repeated normalization in fragment shaders when a cheaper formulation exists.
   - Use glsl-canvas for quick isolated shader experiments when useful, then port the final shader into the Three.js material with explicit uniforms, attributes, and color-space handling.

5. Implement lifecycle and responsiveness together.
   - Keep a single component-level `dispose()` function and invoke it when the owning page/component unmounts or replaces the scene.
   - Register named event handlers so each listener is removed in `dispose()`.
   - Dispose every material texture, including textures stored in material properties or uniforms. Traverse scene objects to dispose owned geometries and materials, deduplicating shared resources with `Set` instances.
   - Resize from the canvas container when layout can change independently of the window. Use `ResizeObserver` where that distinction matters, and disconnect it during disposal.

6. Optimize only after measurement.
   - Inspect `renderer.info` for render calls, triangles, textures, and geometries while exercising the representative scene.
   - Use browser performance tooling to distinguish CPU-bound JavaScript/layout work from GPU-bound rendering work.
   - If GPU-bound, reduce resolution/pixel ratio, overdraw, transparency, shadows, post-processing, draw calls, and shader fragment complexity.
   - If CPU-bound, reduce per-frame traversal, allocations, animation work, physics/update frequency, and duplicate event processing. Instancing or batching may help only after confirming draw-call pressure.

7. Verify the result before completion.
   - Confirm no deprecated APIs or per-frame object construction were introduced.
   - Confirm resize updates the camera projection and renderer dimensions without canvas distortion.
   - Navigate away or destroy the component, then confirm the animation loop stops, event observers/listeners detach, and owned WebGL resources dispose.
   - Test at the target viewport sizes and pixel ratios. Confirm the scene is nonblank, correctly framed, interactive where required, and free of console shader/WebGL warnings.
   - Run the focused frontend validation available in this repository: `npm run typecheck` and relevant tests from `apps/web`.

## Baseline Lifecycle Shape

Adapt this shape to the owning framework; do not create objects inside `animate` that can be reused.

```ts
import * as THREE from "three";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
const clock = new THREE.Clock();
const reusableDirection = new THREE.Vector3();

function resize(width: number, height: number) {
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
}

function animate() {
  const elapsedSeconds = clock.getElapsedTime();
  reusableDirection.set(Math.sin(elapsedSeconds), 0, Math.cos(elapsedSeconds));
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

function dispose() {
  renderer.setAnimationLoop(null);
  renderer.dispose();
  renderer.domElement.remove();
}
```

Expand `dispose()` to release all scene-owned geometries, materials, textures, render targets, controls, observers, and listeners introduced by the implementation.

## Review Checklist

- Does the implementation minimize draw calls, geometry size, texture bandwidth, shader cost, and render resolution for its visual target?
- Are reusable math and raycasting objects allocated outside frame callbacks?
- Is exactly one owner responsible for the animation loop and teardown?
- Is `dispose()` complete for the resources this scene owns, without disposing shared resources still in use?
- Does shader code handle color space, precision, uniforms, and asset imports deliberately?
- Has the change been measured or at least inspected with `renderer.info` and browser performance tooling before claiming an optimization?