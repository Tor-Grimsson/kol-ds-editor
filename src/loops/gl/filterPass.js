// Post-process filter for the 3D scene — one ShaderPass doing chromatic
// aberration (RGB split toward the edges) + film grain + vignette. Driven by
// uniforms so the Filter tab can dial each independently. The radar 2D filters
// are canvas-based and can't touch a live WebGL render; this is the GL equivalent.

export const FilterShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAberration: { value: 0 }, // RGB split amount
    uGrain: { value: 0 },      // film noise
    uVignette: { value: 0 },   // edge darkening
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uAberration, uGrain, uVignette, uTime;
    varying vec2 vUv;
    float rand(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 dir = uv - 0.5;
      // chromatic aberration — split R/B outward, scaled by distance from centre
      float a = uAberration * 0.02;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * a).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * a).b;
      // grain
      if (uGrain > 0.0) col += (rand(uv + fract(uTime)) - 0.5) * uGrain;
      // vignette
      if (uVignette > 0.0) {
        float v = smoothstep(0.85, 0.25, length(dir));
        col *= mix(1.0, v, uVignette);
      }
      gl_FragColor = vec4(col, 1.0);
    }
  `,
}
