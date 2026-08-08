# GLSL Shader Basics for Three.js

Fundamentals for writing custom shaders with `ShaderMaterial` / R3F `shaderMaterial`. Assumes the scene setup rules from SKILL.md are already applied.

## Contents

- [The Two Shader Stages](#the-two-shader-stages)
- [Data Flow: Attributes, Uniforms, Varyings](#data-flow-attributes-uniforms-varyings)
- [Minimal ShaderMaterial Setup](#minimal-shadermaterial-setup)
- [Built-ins Three.js Provides](#built-ins-threejs-provides)
- [Coordinate Spaces](#coordinate-spaces)
- [Pattern: Gradients](#pattern-gradients)
- [Pattern: Fresnel](#pattern-fresnel)
- [Pattern: Noise](#pattern-noise)
- [Animating with Time](#animating-with-time)
- [Performance Rules](#performance-rules)
- [Debugging Shaders](#debugging-shaders)

## The Two Shader Stages

| | Vertex shader | Fragment shader |
|---|---|---|
| Runs once per | Vertex | Pixel (fragment) covered by the triangle |
| Job | Output `gl_Position` (clip-space position); pass data downstream | Output `gl_FragColor` (the pixel's color) |
| Typical count per frame | Thousands | Hundreds of thousands to millions |
| Use for | Displacement, waving, morphing, per-vertex data prep | Color, lighting, patterns, transparency |

The count difference is the core performance intuition: work done per-vertex is orders of magnitude cheaper than work done per-fragment. If a value can be computed in the vertex shader and interpolated, move it there.

## Data Flow: Attributes, Uniforms, Varyings

```
JS (per frame)  ──uniforms──►  vertex shader  ──varyings──►  fragment shader
geometry data   ──attributes─►  vertex shader
```

- **Attributes** — per-vertex data stored in the geometry: `position`, `normal`, `uv`, or custom (`geometry.setAttribute('aRandom', ...)`). Readable only in the vertex shader.
- **Uniforms** — global values set from JavaScript, identical for every vertex and fragment in the draw call: time, colors, mouse position, textures. Cheap to update per frame; this is how JS animates a shader.
- **Varyings** — values the vertex shader writes and the fragment shader reads, **interpolated** across the triangle face. Declare identically in both shaders (`varying vec2 vUv;`). The interpolation is free and is what makes gradients smooth.

Types you'll use constantly: `float`, `vec2/3/4`, `mat3/4`, `sampler2D`. GLSL is strict: `1.0` not `1`, no implicit int→float casts.

## Minimal ShaderMaterial Setup

```js
const material = new THREE.ShaderMaterial({
  uniforms: {
    uTime:  { value: 0 },
    uColorA:{ value: new THREE.Color('#1a2a6c') },
    uColorB:{ value: new THREE.Color('#fdbb2d') },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    varying vec2 vUv;
    void main() {
      vec3 color = mix(uColorA, uColorB, vUv.y);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
});
// per frame:
material.uniforms.uTime.value = clock.getElapsedTime();
```

R3F idiom with drei:

```jsx
import { shaderMaterial } from '@react-three/drei';
import { extend, useFrame } from '@react-three/fiber';

const GradientMaterial = shaderMaterial(
  { uTime: 0, uColorA: new THREE.Color('#1a2a6c'), uColorB: new THREE.Color('#fdbb2d') },
  vertexShader,
  fragmentShader
);
extend({ GradientMaterial });

function Blob() {
  const ref = useRef();
  useFrame((_, delta) => (ref.current.uTime += delta));
  return (
    <mesh>
      <icosahedronGeometry args={[1, 32]} />
      <gradientMaterial ref={ref} />
    </mesh>
  );
}
```

Convention: prefix uniforms `u`, varyings `v`, custom attributes `a`. It keeps three otherwise-identical `vec3`s distinguishable.

## Built-ins Three.js Provides

Inside `ShaderMaterial`, Three.js injects these — don't redeclare them:

| Name | Stage | Meaning |
|---|---|---|
| `position` | vertex (attribute) | Vertex position in model space |
| `normal` | vertex (attribute) | Vertex normal in model space |
| `uv` | vertex (attribute) | Texture coordinates, 0–1 |
| `modelMatrix` | vertex | Model → world |
| `modelViewMatrix` | vertex | Model → camera space |
| `projectionMatrix` | vertex | Camera space → clip space |
| `normalMatrix` | vertex | Correctly transforms normals to view space |
| `cameraPosition` | both | Camera world position |

`RawShaderMaterial` injects nothing — you declare everything yourself. Use it only when you need full control.

## Coordinate Spaces

The standard vertex transform, and where to intervene:

```glsl
vec4 modelPosition = modelMatrix * vec4(position, 1.0);  // world space — displace here for world-anchored effects
vec4 viewPosition  = viewMatrix * modelPosition;
gl_Position        = projectionMatrix * viewPosition;
```

- Displace in **model space** (raw `position`) for effects that stick to the object as it moves.
- Displace in **world space** for effects anchored to the scene (wind over a field, water plane).
- Fresnel and reflections need **world-space normal and view direction** (next sections).

## Pattern: Gradients

Varying interpolation does the work; you pick the axis and the easing.

```glsl
// fragment shader
varying vec2 vUv;
uniform vec3 uColorA;
uniform vec3 uColorB;

void main() {
  float t = vUv.y;                      // vertical gradient
  // t = length(vUv - 0.5) * 2.0;       // radial from center
  // t = smoothstep(0.2, 0.8, vUv.y);   // eased, banded to the 0.2–0.8 range
  vec3 color = mix(uColorA, uColorB, t);
  gl_FragColor = vec4(color, 1.0);
}
```

The three workhorse functions, memorize their shapes:

- `mix(a, b, t)` — linear blend; works on floats, vectors, colors.
- `smoothstep(lo, hi, x)` — 0 below `lo`, 1 above `hi`, smooth S-curve between. The default tool for soft edges and remapping.
- `step(edge, x)` — hard 0/1 cutoff. Combine two: `step(0.4, x) - step(0.6, x)` isolates a band.

Three-stop gradient: nest mixes — `mix(mix(a, b, smoothstep(0.0, 0.5, t)), c, smoothstep(0.5, 1.0, t))`.

## Pattern: Fresnel

Surfaces reflect more at grazing angles. In shader terms: the rim of an object (where the normal is perpendicular to the view direction) glows. This one term makes glass, ghosts, force fields, atmosphere, and "expensive-looking" product shots.

```glsl
// vertex shader — pass world-space normal and position
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
  vNormal = normalize(mat3(modelMatrix) * normal); // fine for uniform scale; use normalMatrix logic otherwise
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
```

```glsl
// fragment shader
varying vec3 vNormal;
varying vec3 vWorldPos;
uniform vec3 uRimColor;
uniform float uFresnelPower; // 1.0 = broad glow, 5.0 = tight rim

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - clamp(dot(viewDir, normalize(vNormal)), 0.0, 1.0), uFresnelPower);
  vec3 color = mix(vec3(0.02), uRimColor, fresnel);
  gl_FragColor = vec4(color, 1.0);
  // transparent variant: gl_FragColor = vec4(uRimColor, fresnel); with material.transparent = true
}
```

Normalize the varying normal **in the fragment shader** — interpolation denormalizes it, and skipping this causes subtle shading errors.

## Pattern: Noise

GLSL has no built-in random. Two tools:

**Hash (white noise)** — cheap, unstructured; good for grain, dithering, per-fragment jitter:

```glsl
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
```

**Simplex/Perlin (gradient noise)** — smooth, organic; good for terrain, clouds, blob displacement, flow. Don't hand-write it — paste a proven implementation (Ashima/webgl-noise `snoise`, MIT-licensed, the de-facto standard) or import from the `glsl-noise` npm package with glslify. `snoise` returns roughly −1..1; remap with `n * 0.5 + 0.5` when you need 0..1.

**FBM (fractal Brownian motion)** — stack octaves of noise for natural detail:

```glsl
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {          // 4 octaves; each adds cost, rarely need > 5
    value += amplitude * snoise(p);
    p *= 2.0;                             // double frequency
    amplitude *= 0.5;                     // halve contribution
  }
  return value;
}
```

Common uses:

```glsl
// Vertex displacement (organic blob) — vertex shader
float n = snoise(vec3(position * uFrequency + uTime * 0.2));
vec3 displaced = position + normal * n * uAmplitude;

// Animated fragment texture — fragment shader
float n = fbm(vUv * 3.0 + uTime * 0.1);
vec3 color = mix(uColorA, uColorB, smoothstep(-0.5, 0.5, n));
```

Noise is the most expensive thing in a typical custom shader — a 4-octave 3D FBM per fragment at full-screen coverage will show up on mobile. Prefer 2D noise over 3D, fewer octaves, or bake noise into a texture and sample it (`texture2D` is one lookup vs dozens of ALU ops).

## Animating with Time

Drive everything from one `uTime` uniform (seconds as float):

```glsl
sin(uTime)                          // oscillate −1..1
sin(uTime) * 0.5 + 0.5              // oscillate 0..1
fract(uTime * 0.25)                 // repeating 0..1 ramp, 4s period
uv + vec2(uTime * 0.05, 0.0)        // scroll a pattern
snoise(vec3(uv * 4.0, uTime * 0.3)) // evolving 2D noise via 3D noise's z-axis
```

Accumulate with delta (`uTime += delta` in `useFrame`) rather than absolute clock time if the scene can pause — and note that a shader animating every frame is incompatible with `frameloop="demand"` unless you keep calling `invalidate()`.

## Performance Rules

1. **Move work up the pipeline**: constant → compute in JS, set as uniform. Same for all fragments of a vertex's neighborhood → compute in vertex shader, pass as varying. Only truly per-pixel work belongs in the fragment shader.
2. **Fragment cost scales with covered pixels.** A full-screen shader at DPR 2 on a 390×844 phone shades ~2.6M fragments per frame. The SKILL.md pixelRatio cap matters double for heavy fragment shaders.
3. **Avoid branching on non-uniform values.** GPUs execute both sides of divergent `if`s within a warp. Prefer `mix`/`step`/`smoothstep` selects. Branching on a uniform is fine.
4. **Cap noise octaves** (3–4) and prefer texture lookups over procedural noise when the pattern doesn't need to be infinite.
5. **Prototype on `MeshStandardMaterial.onBeforeCompile` or drei's `<MeshTransmissionMaterial>` etc. before writing lighting from scratch** — re-implementing PBR lighting in a custom shader is a project, not a pattern. `CustomShaderMaterial` (three-custom-shader-material) injects your vertex/fragment logic into built-in materials and is usually the right tool for "standard material + custom displacement/color".

## Debugging Shaders

- **Output the value as color** — the shader equivalent of console.log: `gl_FragColor = vec4(vec3(myFloat), 1.0);` or `vec4(vNormal * 0.5 + 0.5, 1.0);`. Black = 0 or negative, white = ≥1.
- **Compile errors** appear in the browser console with line numbers offset by Three.js's injected prelude — count from your first line, not the reported one.
- **All black?** Usually: forgot to set a uniform's `value`, denormalized/NaN math (`pow` of a negative, divide by zero), or the material silently failed to compile.
- **Banding in gradients**: add a hair of hash-noise dither: `color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;`.
- Use the Spector.js browser extension to inspect a captured frame's actual draw calls and shader inputs.
