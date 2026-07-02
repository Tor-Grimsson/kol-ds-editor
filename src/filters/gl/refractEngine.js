// Refraction (2D lens) — a fullscreen three.js ShaderMaterial that samples the
// photo through a procedural animated surface, composited as a discrete GLASS
// OBJECT over the plain photo (the photo shows around it; refracted through it).
// Ported from kol-labs-single radar/refract/engine.js for the design editor:
//   - constructed on the given CANVAS (no container/ResizeObserver/self-canvas)
//   - source = a fitted canvas (THREE.CanvasTexture, uploaded on swap)
//   - self-RAF gated on { autoLoop }; the host drives frame(dt) otherwise
// The 3D version (LensScene) is the depth-true sibling — not ported (interactive
// camera/gizmo paradigm, see port notes).

import * as THREE from 'three'

// surface id → shader branch (H()). kaleido = the banded "hall of mirrors" folds.
const TYPE_INDEX = { glass: 0, ripple: 1, ice: 2, mirror: 3, kaleido: 4, waves: 5 }

const VERT = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPhoto;
  uniform float uHasPhoto, uTime, uScale, uDepth, uChromatic, uFrost, uSheen, uViewAspect, uImgAspect;
  uniform float uLightAngle, uTintAmt, uReflect, uFit, uZoom;
  uniform float uSize, uRadius, uEdge, uMagnify;
  uniform vec2 uOffset, uGlassPos;
  uniform vec3 uTint, uBg;
  uniform int uType, uShape;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),
               mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x), u.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; }

  // ---- LAYER 2 : the glass surface. Height field per surface character. ----
  float H(vec2 uv){
    float t = uTime;
    float f = 1.0 + uScale*6.0;
    if(uType==1){ // ripple — concentric water rings
      float r = length(uv-0.5);
      return sin(r*f*16.0 - t*2.0)*0.5+0.5;
    } else if(uType==2){ // ice — faceted (quantized fbm)
      float n = fbm(uv*f*3.0 + t*0.15);
      return floor(n*7.0)/7.0;
    } else if(uType==3){ // liquid metal — low freq flowing
      return fbm(uv*f*0.7 + t*0.1);
    } else if(uType==4){ // mirror — banded ridges (hall-of-mirrors folds)
      float n = fbm(uv*f*1.2 + t*0.1);
      return abs(sin((uv.x*0.6+uv.y*0.4)*f*10.0 + n*3.0 - t));
    } else if(uType==5){ // waves — directional water, fbm-perturbed
      float n = fbm(uv*f*1.5 + t*0.2);
      return sin((uv.x+uv.y)*f*9.0 + n*4.0 - t*1.6)*0.5+0.5;
    }
    return fbm(uv*f + t*0.12); // glass — organic bumps
  }

  // ---- LAYER 1 : the photo, placed in the frame (fit / zoom / offset). ----
  // Returns the image uv; inside-flag tells if it's within [0,1] (contain bars).
  vec2 placeUV(vec2 uv, out bool inside){
    vec2 sCover = uViewAspect > uImgAspect ? vec2(1.0, uImgAspect/uViewAspect) : vec2(uViewAspect/uImgAspect, 1.0);
    vec2 sContain = uViewAspect > uImgAspect ? vec2(uViewAspect/uImgAspect, 1.0) : vec2(1.0, uImgAspect/uViewAspect);
    vec2 s = mix(sCover, sContain, step(0.5, uFit));
    vec2 p = (uv - 0.5) * s / max(uZoom, 0.01) + 0.5 - uOffset;
    inside = p.x > 0.0 && p.x < 1.0 && p.y > 0.0 && p.y < 1.0;
    return p;
  }
  // Sample the photo at a screen-uv; outside the image (contain) gives bg colour.
  vec3 samplePhoto(vec2 uv){
    bool inside; vec2 p = placeUV(uv, inside);
    if(!inside && uFit > 0.5) return uBg;
    return texture2D(uPhoto, clamp(p, 0.001, 0.999)).rgb;
  }

  // ---- LAYER 2 bounds : the glass OBJECT. Signed distance, <0 = inside. ----
  float glassSDF(vec2 uv){
    vec2 p = (uv - uGlassPos);
    p.x *= uViewAspect;
    if(uShape == 1){ // circle / lens
      return length(p) - uSize;
    }
    vec2 d = abs(p) - vec2(uSize) + uRadius;
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - uRadius;
  }

  void main(){
    vec2 uv = vUv;
    if(uHasPhoto < 0.5){ gl_FragColor = vec4(0.02,0.025,0.04,1.0); return; }

    // === LAYER 1 — the photo, plain. Shows AROUND the glass. ===
    vec3 bg = samplePhoto(uv);

    float sd = glassSDF(uv);
    float inside = 1.0 - smoothstep(-0.004, 0.004, sd);

    // === LAYER 2 — the photo seen THROUGH the glass (refracted) ===
    float e = 0.004;
    vec2 grad = vec2(H(uv+vec2(e,0.0))-H(uv-vec2(e,0.0)), H(uv+vec2(0.0,e))-H(uv-vec2(0.0,e)));
    vec2 off = grad * uDepth * 8.0;
    float disp = uChromatic*0.0025 * (0.4 + uDepth*30.0);
    float mag = 1.0 + uMagnify + uDepth*3.0;
    vec2 guv = (uv - uGlassPos)/mag + uGlassPos - off;

    vec3 refr = vec3(
      samplePhoto(guv - off*disp).r,
      samplePhoto(guv).g,
      samplePhoto(guv + off*disp).b
    );
    if(uFrost > 0.001){
      vec3 acc = refr; float r = uFrost*0.01;
      acc += samplePhoto(guv + vec2(r,0.0));
      acc += samplePhoto(guv + vec2(-r,0.0));
      acc += samplePhoto(guv + vec2(0.0,r));
      acc += samplePhoto(guv + vec2(0.0,-r));
      refr = mix(refr, acc/5.0, clamp(uFrost*0.12, 0.0, 1.0));
    }
    refr = mix(refr, refr * uTint, uTintAmt);

    vec2 lightDir = vec2(cos(uLightAngle), sin(uLightAngle));
    float facing = clamp(dot(normalize(grad + 1e-5), lightDir), 0.0, 1.0);
    float steep = clamp(length(grad) * 18.0, 0.0, 1.0);
    refr += uReflect * (H(uv) - 0.5) * 0.8;
    refr += (pow(steep, 1.5) * 0.5 + pow(facing, 3.0)) * steep * uSheen;

    // === composite: glass object OVER the photo ===
    vec3 col = mix(bg, refr, inside);

    float rim = 1.0 - smoothstep(0.0, max(uEdge, 0.001), abs(sd));
    float lit = 0.5 + 0.5*dot(normalize(uv - uGlassPos + 1e-5), lightDir);
    col += rim * (0.35 + 0.65*lit) * (0.5 + uSheen);

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`

export class RefractEngine {
  constructor(canvas, { autoLoop = false } = {}) {
    this.canvas = canvas
    this.autoLoop = autoLoop
    this.playing = true
    this.time = 0
    this.flow = 1
    this._raf = null
    this.last = performance.now()
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
    this.scene = new THREE.Scene()
    this.cam = new THREE.Camera()
    this.uniforms = {
      uPhoto: { value: null },
      uHasPhoto: { value: 0 },
      uTime: { value: 0 },
      uType: { value: 0 },
      uScale: { value: 0.4 },
      uDepth: { value: 0.06 },
      uChromatic: { value: 6 },
      uFrost: { value: 0 },
      uSheen: { value: 0.5 },
      uLightAngle: { value: Math.PI * 0.25 },
      uTint: { value: new THREE.Vector3(1, 1, 1) },
      uTintAmt: { value: 0 },
      uReflect: { value: 0 },
      uFit: { value: 0 },
      uZoom: { value: 1 },
      uOffset: { value: new THREE.Vector2(0, 0) },
      uBg: { value: new THREE.Vector3(0.02, 0.025, 0.04) },
      uShape: { value: 0 },
      uSize: { value: 0.45 },
      uRadius: { value: 0.08 },
      uEdge: { value: 0.02 },
      uMagnify: { value: 0.1 },
      uGlassPos: { value: new THREE.Vector2(0.5, 0.5) },
      uViewAspect: { value: 1 },
      uImgAspect: { value: 1 },
    }
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms })
    this.geo = new THREE.PlaneGeometry(2, 2)
    this.scene.add(new THREE.Mesh(this.geo, this.mat))
    if (this.autoLoop) this.start()
  }

  resize(w, h) {
    if (!this.renderer || w < 1 || h < 1) return
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.setSize(w, h, false)
    this.uniforms.uViewAspect.value = w / h
  }

  /* Source = a fitted canvas from the editor. Uploaded once on swap; call
   * touchSource() after redrawing INTO the same canvas. Pass null to clear. */
  setSource(source) {
    if (!this.uniforms) return
    if (!source) { this.uniforms.uHasPhoto.value = 0; return }
    const tex = new THREE.CanvasTexture(source)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    if (this.tex) this.tex.dispose()
    this.tex = tex
    this.uniforms.uPhoto.value = tex
    this.uniforms.uHasPhoto.value = 1
    this.uniforms.uImgAspect.value = (source.width || 1) / (source.height || 1)
  }

  touchSource() {
    if (this.tex) this.tex.needsUpdate = true
  }

  setParams(p) {
    if (!this.uniforms) return
    if (p.type != null) this.uniforms.uType.value = TYPE_INDEX[p.type] ?? 0
    if (p.scale != null) this.uniforms.uScale.value = p.scale
    if (p.depth != null) this.uniforms.uDepth.value = p.depth / 1000
    if (p.chromatic != null) this.uniforms.uChromatic.value = p.chromatic
    if (p.frost != null) this.uniforms.uFrost.value = p.frost
    if (p.sheen != null) this.uniforms.uSheen.value = p.sheen
    if (p.reflect != null) this.uniforms.uReflect.value = p.reflect
    if (p.lightAngle != null) this.uniforms.uLightAngle.value = (p.lightAngle * Math.PI) / 180
    if (p.tint != null) {
      const n = parseInt(p.tint.slice(1), 16)
      this.uniforms.uTint.value.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
    }
    if (p.tintAmt != null) this.uniforms.uTintAmt.value = p.tintAmt
    if (p.fit != null) this.uniforms.uFit.value = p.fit === 'contain' ? 1 : 0
    if (p.zoom != null) this.uniforms.uZoom.value = p.zoom
    if (p.offsetX != null) this.uniforms.uOffset.value.x = p.offsetX
    if (p.offsetY != null) this.uniforms.uOffset.value.y = p.offsetY
    if (p.bg != null) {
      const n = parseInt(p.bg.slice(1), 16)
      this.uniforms.uBg.value.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
    }
    if (p.shape != null) this.uniforms.uShape.value = p.shape === 'circle' ? 1 : 0
    if (p.size != null) this.uniforms.uSize.value = p.size
    if (p.radius != null) this.uniforms.uRadius.value = p.radius
    if (p.edge != null) this.uniforms.uEdge.value = p.edge
    if (p.magnify != null) this.uniforms.uMagnify.value = p.magnify
    if (p.glassX != null) this.uniforms.uGlassPos.value.x = p.glassX
    if (p.glassY != null) this.uniforms.uGlassPos.value.y = p.glassY
    if (p.flow != null) this.flow = p.flow
  }

  setPlaying(v) { this.playing = v }
  resetTime() { this.time = 0; if (this.uniforms) this.uniforms.uTime.value = 0 }
  getTime() { return this.time }

  // Externally-driven step: advance the procedural-surface clock and render.
  // The host passes dt=0 while paused — still renders, so param edits repaint.
  frame(dt) {
    if (!this.renderer) return
    if (this.playing) this.time += dt * this.flow
    this.uniforms.uTime.value = this.time
    this.renderer.render(this.scene, this.cam)
  }

  // Self-RAF — only when constructed with { autoLoop: true }.
  start() {
    if (!this.autoLoop || this._raf) return
    const loop = () => {
      this._raf = requestAnimationFrame(loop)
      const now = performance.now()
      const dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      this.frame(dt)
    }
    this._raf = requestAnimationFrame(loop)
  }

  async exportBlob(w, h) {
    if (!this.renderer) return null
    if (w && h) {
      const prevW = this.canvas.width
      const prevH = this.canvas.height
      const prevAspect = this.uniforms.uViewAspect.value
      this.renderer.setPixelRatio(1)
      this.renderer.setSize(w, h, false)
      this.uniforms.uViewAspect.value = w / h
      this.renderer.render(this.scene, this.cam)
      const blob = await new Promise((res) => this.canvas.toBlob(res, 'image/png'))
      this.renderer.setSize(prevW, prevH, false)   // restore exact buffer px (ratio 1)
      this.uniforms.uViewAspect.value = prevAspect
      this.renderer.render(this.scene, this.cam)
      return blob
    }
    this.renderer.render(this.scene, this.cam)
    return new Promise((res) => this.canvas.toBlob(res, 'image/png'))
  }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = null
    if (this.tex) this.tex.dispose()
    this.mat.dispose()
    this.geo.dispose()
    if (this.renderer) { this.renderer.dispose(); this.renderer = null }
  }
}
