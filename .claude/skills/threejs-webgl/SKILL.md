---
name: threejs-webgl
description: "When the user wants to build a 3D scene, WebGL experience, or shader effect for the web. Triggers: \"Three.js\", \"React Three Fiber\", \"R3F\", \"WebGL\", \"3D scene\", \"shader\", \"GLTF\", \"3D on my landing page\", \"hero 3D\". Covers renderer setup, R3F vs vanilla choice, performance budgets, GLTF compression pipeline, lighting cost, mobile fallbacks, loading UX, and memory disposal — scene fundamentals that ship at 60fps on real devices. For scroll-linked 3D, see scroll-animation. For page performance budgets the scene must fit in, see frontend-performance."
metadata:
  version: 1.0.0
---

# Three.js / WebGL Scene Fundamentals

Act as a senior graphics engineer who ships 3D web experiences that hold 60fps on a mid-range Android phone, not just on the dev machine's M-series GPU. The outcome: a scene with correct renderer configuration, a compressed asset pipeline, an explicit performance budget, and a fallback path for devices that can't run it — decided up front, not patched in after the client complains about a hot phone.

For GLSL specifics (vertex vs fragment, uniforms/varyings, noise, fresnel, gradients), read `references/shader-basics.md`.

## Before Starting

Ask these, grouped, in one message:

1. **Stack** — React app (use React Three Fiber) or vanilla JS/other framework (use plain Three.js)? Existing bundler, or starting fresh?
2. **Assets** — Are there existing 3D models (GLTF/GLB, FBX, OBJ)? Who made them and can they be re-exported? Or is the scene procedural (geometry generated in code)?
3. **Target devices** — Desktop only, or must it run on mobile? What's the oldest device that matters? Is there an acceptable fallback (static render, poster image) for low-end hardware?
4. **Interactivity** — Static hero visual, camera orbit, object hover/click, or full game-like interaction? Does the scene animate continuously or only on input? (This decides the frameloop strategy.)
5. **Context** — Is this the whole page or one section of a content page that also has its own JS budget?

## Renderer Configuration

These defaults are wrong out of the box more often than any other part of Three.js. Set them explicitly:

| Setting | Value | Why |
|---|---|---|
| `antialias` | `true` on desktop, consider `false` on weak mobile GPUs | MSAA costs fill rate; on low-end mobile it can be the difference between 60 and 40fps. FXAA/SMAA postprocessing is a cheaper fallback. |
| `pixelRatio` | `Math.min(window.devicePixelRatio, 2)` | A DPR-3 phone renders 9× the fragments of DPR-1; capping at 2 cuts that to 4× with no visible difference at phone viewing distance. Uncapped DPR is the single most common mobile perf bug. |
| `toneMapping` | `THREE.ACESFilmicToneMapping` | Maps HDR lighting into displayable range with filmic rolloff; without it, env-map lighting clips to white. |
| `outputColorSpace` | `THREE.SRGBColorSpace` | Correct gamma on output. Wrong color space = washed-out or too-dark renders that people "fix" by cranking lights. |
| `powerPreference` | `"high-performance"` | Requests the discrete GPU on dual-GPU laptops. |

Vanilla scaffold with all of the above:

```js
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
```

R3F equivalent — note R3F already defaults to ACESFilmic + sRGB, so only dpr needs explicit care:

```jsx
<Canvas
  dpr={[1, 2]}
  gl={{ antialias: true, powerPreference: 'high-performance' }}
  camera={{ fov: 45, position: [0, 1.5, 4] }}
>
```

## R3F vs Vanilla Three.js

| Concern | React Three Fiber | Vanilla Three.js |
|---|---|---|
| Scene graph | Declarative JSX; React reconciles adds/removes | Imperative `scene.add()` / manual bookkeeping |
| Ecosystem | drei (helpers: `useGLTF`, `OrbitControls`, `Environment`), @react-three/rapier (physics), postprocessing wrappers | Assemble equivalents by hand from three/examples |
| Disposal | Automatic on unmount for JSX-declared objects | Fully manual |
| State/UI integration | Same React state drives DOM and 3D | Bridge layer needed |
| Overhead | React render cost per state change (useFrame mutations bypass it) | None; you own the loop |
| Best fit | React apps, product configurators, marketing sites with UI-coupled 3D | Non-React sites, engine-like projects, tight control over every frame, embeds where the React runtime isn't worth 45kB |

Rule: in a React codebase, use R3F — hand-rolled Three.js inside `useEffect` recreates R3F badly and leaks on unmount. Outside React, don't drag React in just for drei.

## Performance Budgets

Starting targets, not laws — profile on real hardware and adjust:

| Metric | Mobile | Desktop | Notes |
|---|---|---|---|
| Draw calls | < 100 | < 300 | Check `renderer.info.render.calls`. Each call has CPU overhead; this is usually the first bottleneck. |
| Triangles | < 100k (hero scene) | < 500k | `renderer.info.render.triangles`. Vertex count matters less than draw calls until you hit skinned meshes. |
| Texture size | 2048² max, prefer 1024² | 4096² max | Prefer KTX2/Basis compressed — stays compressed in GPU memory (a 2048² PNG decompresses to ~16MB on-GPU; KTX2 stays ~4MB). |
| Frame time | 16.7ms total | 16.7ms total | Includes React render, DOM work, and GC — the GPU doesn't get the whole 16.7ms. Budget the scene at ~10ms. |
| Lights | 1–2 real-time | 2–4 real-time | See lighting table below. |

## Lighting Cost (cheap → expensive)

| Approach | Cost | Use when |
|---|---|---|
| Baked lightmaps / vertex colors | Near-free at runtime | Static scenes; bake in Blender |
| Environment map (IBL) via `<Environment>` / `scene.environment` | One cubemap sample per fragment | Default choice — realistic PBR lighting from a single HDRI, no light objects at all |
| 1–2 directional lights | Cheap | Sun/key light on top of IBL |
| Point/spot lights (several) | Per-light per-fragment cost | Sparingly; each adds shader work for every pixel it might touch |
| Shadows | Extra render pass per casting light | One shadow-casting light max on mobile. Tighten `shadow.camera` bounds to the subject — a loose shadow frustum wastes the entire shadow map's resolution on empty space, producing blurry shadows at high cost. |

## Workflow

1. **Set the budget first.** Pick target devices, write down draw call / triangle / texture numbers from the table above. Every later decision checks against this.

2. **Scaffold with correct renderer config.** R3F: `<Canvas dpr={[1, 2]} shadows camera={{ fov: 45, position: [...] }}>`. Vanilla: set pixelRatio cap, ACESFilmic, sRGB explicitly. Add `renderer.info` logging or `<Perf />` from r3f-perf during development.

3. **Compress assets before importing them.** Run every GLTF through gltf-transform:
   ```bash
   npx @gltf-transform/cli optimize input.glb output.glb --compress draco --texture-compress ktx2
   ```
   Draco (geometry) + KTX2 (textures) typically cuts file size 5–10×. Meshopt (`--compress meshopt`) decodes faster than Draco and is preferable when download size is less critical than parse time. Load and preload:
   ```jsx
   function Model(props) {
     const { scene } = useGLTF('/models/product.glb');
     return <primitive object={scene} {...props} />;
   }
   useGLTF.preload('/models/product.glb'); // module scope — fetch starts before mount
   ```
   Vanilla: `GLTFLoader` + `DRACOLoader` (point `setDecoderPath` at the draco decoder assets) or `MeshoptDecoder`.

4. **Light with an environment map first.** `<Environment preset="city" />` (or a custom HDRI) plus one directional light covers most product/hero scenes. Only add point lights when the art direction demands it.

5. **Climb the optimization ladder only as far as needed** — measure after each rung:
   - **Merge static geometries** sharing one material (`BufferGeometryUtils.mergeGeometries`) — collapses N draw calls to 1. Cheapest win; do this first.
   - **Instance repeated objects** — same geometry drawn many times becomes one draw call:
     ```jsx
     <Instances limit={1000} geometry={treeGeo} material={treeMat}>
       {positions.map((p, i) => <Instance key={i} position={p} />)}
     </Instances>
     ```
     Vanilla: `new THREE.InstancedMesh(geo, mat, count)` + `setMatrixAt(i, matrix)`.
   - **LOD** (`THREE.LOD` / drei `<Detailed distances={[0, 10, 25]}>`) for high-poly meshes seen at varying distances.
   - **On-demand rendering**: `<Canvas frameloop="demand">` for static scenes — renders only when `invalidate()` is called (drei controls call it automatically). Drops GPU/battery use to ~zero at rest; this is the correct default for a scene that only moves on interaction. Vanilla equivalent: render inside event handlers instead of `requestAnimationFrame` looping unconditionally.

6. **Build the loading experience.** Wrap the scene in Suspense with visible progress:
   ```jsx
   <div style={{ position: 'relative', aspectRatio: '16 / 9' }}> {/* reserved box — no layout shift */}
     <Canvas dpr={[1, 2]}>
       <Suspense fallback={null}>
         <Scene />
       </Suspense>
     </Canvas>
     <Loader /> {/* drei; or build custom UI from useProgress() */}
   </div>
   ```
   Reserve the canvas's layout box with explicit CSS dimensions before the scene loads — a canvas popping in and shifting the page is a layout jank bug, not a 3D bug. Fade the scene in on ready (opacity transition on first rendered frame) rather than snapping.

7. **Implement the mobile/low-end fallback.** Capability-detect, don't user-agent sniff:
   ```js
   function sceneTier() {
     const gl = document.createElement('canvas').getContext('webgl2');
     if (!gl) return 'poster';                                   // no WebGL2 → static image
     const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 4
                 || (navigator.deviceMemory ?? 8) <= 4;
     return lowEnd ? 'lite' : 'full';                            // lite: dpr 1, no AA, no shadows
   }
   ```
   Tiers in descending capability: full scene → dpr 1, antialias off, shadows off → `frameloop="demand"` static render → poster image (`<img>` of a pre-rendered frame). Also pause the loop when the tab or section isn't visible (`document.visibilityState`, IntersectionObserver) — a hero scene spinning below the fold drains battery for nobody. Sustained load matters too: a scene that holds 60fps for 30 seconds can thermal-throttle to 30fps by minute two; prefer demand rendering wherever the scene allows it.

8. **Verify disposal.** Mount/unmount the scene component several times and watch `renderer.info.memory` (geometries, textures) — the numbers must return to baseline. R3F disposes objects declared in JSX, but anything created manually needs explicit cleanup:
   ```js
   useEffect(() => {
     const tex = new THREE.TextureLoader().load(url);   // manual = your responsibility
     return () => tex.dispose();
   }, [url]);
   ```
   Vanilla teardown must dispose geometry, material, every texture referenced by the material, render targets, and finally `renderer.dispose()`. Removing a mesh from the scene frees nothing on the GPU.

9. **Profile on a real mid-range phone** (not desktop DevTools throttling — it throttles CPU, not GPU). Confirm frame time, thermals over 2+ minutes, and the fallback path.

## Common Mistakes

1. **Uncapped devicePixelRatio.** `setPixelRatio(window.devicePixelRatio)` on a DPR-3 phone renders 9× the fragments of DPR-1 for gains invisible at arm's length. Fix: `Math.min(devicePixelRatio, 2)` / R3F `dpr={[1, 2]}`.

2. **Continuous frameloop for a static scene.** A product shot that never moves re-renders 60 times per second, heating phones and draining laptops. Fix: `frameloop="demand"` + `invalidate()` on change; pause when offscreen.

3. **Shipping uncompressed GLTFs.** A 40MB GLB straight from Blender becomes 4–8MB with Draco + KTX2 and loads in a tenth the time. Fix: gltf-transform in the asset pipeline (workflow step 3), not "later."

4. **Many point lights + multiple shadow casters.** Each per-fragment light and each shadow pass multiplies cost. Fix: IBL environment map for base lighting, one directional key light, one shadow caster with tight `shadow.camera` bounds — or bake.

5. **Memory leaks on unmount.** Removing a mesh from the scene does not free GPU memory; SPAs that navigate to and from a 3D page crash the tab eventually. Fix: dispose geometry, material, and every texture on the material; verify with `renderer.info.memory` (workflow step 8).

6. **Wrong color space, "fixed" with brighter lights.** Missing sRGB output or non-color textures (normal maps) tagged as sRGB makes renders washed-out or muddy, then lighting gets cranked to compensate. Fix: sRGB output + ACESFilmic; leave normal/roughness maps in linear/no-color space.

7. **Hand-rolled Three.js inside useEffect in a React app.** Manual init/teardown in effects double-mounts under StrictMode, leaks renderers, and fights React state. Fix: use R3F in React codebases.

8. **Testing only on the dev machine.** A desktop GPU hides every mistake above. Fix: real mid-range phone before calling it done; ship the poster-image fallback for devices below the floor.

## Output Format

Deliver:

- **Budget statement** — target devices, draw call / triangle / texture / frame-time numbers chosen, and the fallback tier for devices below the floor.
- **Scene code** — Canvas/renderer config with the settings from the renderer table set explicitly; components organized so the 3D scene is one lazy-loadable unit.
- **Asset pipeline commands** — the exact gltf-transform invocation used, with before/after file sizes.
- **Loading + fallback** — Suspense/progress UI, reserved layout box, capability detection, poster path.
- **Verification notes** — `renderer.info` numbers observed (calls, triangles, memory), disposal check result, and what device(s) it was profiled on.

Custom shader work (materials, noise, fresnel, gradient effects): follow `references/shader-basics.md`.
