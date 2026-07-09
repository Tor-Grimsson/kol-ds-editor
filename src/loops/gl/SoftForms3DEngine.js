// Soft Forms 3D — raymarched 3D SDF / metaball engine.
//
// What makes this look like something:
//   • Ambient occlusion: 6-sample AO along the surface normal. In metaball
//     merge zones the potential drops fast → deep AO → dark necks → you can
//     actually SEE the balls merging. Without this it's a lump.
//   • Soft shadows: 28-step shadow ray toward the world-space key light.
//     One form casts a soft shadow onto another — depth reads as real.
//   • World-space lighting: key light is fixed in the scene, not glued to the
//     camera. Diffuse shading changes as you orbit, so forms feel truly 3D.
//   • Matcap iridescence in view-space: the palette sweep across normal.xy
//     gives the Apple gradient-across-volume look, independent of orbit.
//   • Metaball amplitude: large enough motion (0.35 per axis) so balls cycle
//     from separated → neck → fully merged. That cycle is THE metaball visual.

import * as THREE from 'three'
import { GRAD_PALETTES, BACKDROPS } from './IridescentEngine.js'

export { GRAD_PALETTES, BACKDROPS }

const MAX_FORMS = 5

export const FORM_TYPES_3D = { sphere: 0, orb: 0, capsule: 1, pill: 1, teardrop: 2, lozenge: 3, super: 3 }

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }`

const FRAG = `
precision highp float;
varying vec2 vUv;

uniform float uTime, uAspect, uCount;
uniform float uTheta, uPhi, uDist;
uniform float uHue, uIrid, uSheen, uGloss;
uniform float uRim, uRimPow, uRimShift, uSSS;
uniform float uMotion, uGrain, uSpectral, uMetaball;
uniform vec2  uDir;
uniform vec3  uBg;
uniform vec3  uColors[5];
uniform float uType[5];
uniform vec3  uPos3[5];
uniform vec3  uScale3[5];
uniform float uRot3[5];
uniform float uHueOff[5];

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }

vec3 spectral(float t){
  t = fract(t);
  return 0.5 + 0.5*cos(6.28318*(t+vec3(0.,0.333,0.667)));
}
vec3 ramp(float t){
  t = fract(t)*4.;
  int i = int(floor(t));
  return mix(uColors[i], uColors[i+1<5?i+1:4], fract(t));
}
vec3 tint(float ci){ return mix(ramp(fract(ci)), spectral(ci), uSpectral); }

vec3 rotY(vec3 p, float a){ float c=cos(a),s=sin(a); return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z); }

float sdSphere(vec3 q){ return length(q)-1.; }
float sdCapsule(vec3 q){ q.y-=clamp(q.y,-0.5,0.5); return length(q)-0.5; }
float sdTeardrop(vec3 q){
  float tp = mix(1.,0.36,clamp(q.y*0.5+0.5,0.,1.));
  return length(vec3(q.x/tp,q.y,q.z/tp))-1.;
}
float sdLozenge(vec3 q){
  vec3 a = pow(abs(q),vec3(3.4));
  return pow(a.x+a.y+a.z,1./3.4)-1.;
}

// Forms: return (dist, hueOff_of_nearest).  Loop-index access of uHueOff[] is
// safe in GLSL ES 1.00 (loop induction variable, not a dynamic expression).
vec2 mapForms(vec3 p){
  vec2 res = vec2(1e9, 0.);
  for(int i=0;i<5;i++){
    if(float(i)>=uCount) break;
    float fi=float(i);
    vec3 anim = uMotion*vec3(sin(uTime*.38+fi*1.7),cos(uTime*.31+fi*2.3),sin(uTime*.43+fi*1.1))*0.06;
    vec3 sc = uScale3[i];
    vec3 q  = rotY(p-uPos3[i]-anim,-uRot3[i])/sc;
    float ty=uType[i],d;
    if     (ty<.5) d=sdSphere(q);
    else if(ty<1.5)d=sdCapsule(q);
    else if(ty<2.5)d=sdTeardrop(q);
    else           d=sdLozenge(q);
    d*=min(sc.x,min(sc.y,sc.z));
    if(d<res.x) res=vec2(d,uHueOff[i]);
  }
  return res;
}

// Metaballs: potential = Σ r²/(|p-c|²+ε);  isosurface at potential = 1.
// Animation amplitude 0.35 per axis so balls visibly cycle separated→merged.
vec2 mapMeta(vec3 p){
  float field=0.,wh=0.,wsum=0.;
  for(int i=0;i<5;i++){
    if(float(i)>=uCount) break;
    float fi=float(i);
    vec3 anim = uMotion*vec3(sin(uTime*.38+fi*1.7),cos(uTime*.31+fi*2.3),sin(uTime*.43+fi*1.1))*0.35;
    float r = uScale3[i].x;
    vec3  dv= p-uPos3[i]-anim;
    float w = r*r/(dot(dv,dv)+0.0001);
    field+=w; wh+=uHueOff[i]*w; wsum+=w;
  }
  return vec2(1.-field, wsum>0.?wh/wsum:0.);
}

vec2 map(vec3 p){ return uMetaball>.5 ? mapMeta(p) : mapForms(p); }

// World-space surface normal via central difference
vec3 calcNormal(vec3 p){
  const float E=0.002;
  return normalize(vec3(
    map(p+vec3(E,0,0)).x-map(p-vec3(E,0,0)).x,
    map(p+vec3(0,E,0)).x-map(p-vec3(0,E,0)).x,
    map(p+vec3(0,0,E)).x-map(p-vec3(0,0,E)).x
  ));
}

// AO: 6 samples along the world normal. Merge zones between metaballs have low
// potential headroom → small d values → high occlusion → dark necks.
float calcAO(vec3 p, vec3 n){
  float occ=0.,sca=1.;
  for(int i=1;i<=6;i++){
    float h = 0.006+0.08*float(i)/6.;
    float d = map(p+n*h).x;
    occ += max(h-d,0.)*sca;
    sca *= 0.87;
  }
  return clamp(1.-14.*occ, 0., 1.);
}

// Soft shadow: march from surface toward the world key light.
// One metaball casts a soft shadow onto another → depth is unmistakable.
float calcShadow(vec3 ro, vec3 rd){
  float sha=1.,t=0.02;
  for(int i=0;i<28;i++){
    float h=map(ro+rd*t).x;
    if(h<0.001) return 0.;
    sha=min(sha,8.*h/t);
    t+=clamp(h,0.01,0.18);
    if(sha<0.005||t>4.) break;
  }
  return clamp(sha,0.,1.);
}

// Shading: matcap iridescence (view-space) + world lighting (view-space L) + AO + shadow.
// nv = view-space normal (n.z=1 faces camera).
// Lv = world key light transformed to view space: diffuse changes as you orbit.
vec3 shade(vec3 nv, float hueOff, float ao, float sha, vec3 Lv){
  float ci = uHue+hueOff+uIrid*(dot(nv.xy,uDir)*.5+.5);
  vec3 base = tint(ci);

  // Key: world-space light, so shading shifts as camera orbits
  float diff = max(dot(nv,Lv),0.);
  base *= mix(0.15,1.,diff*sha)*ao;

  // Cool fill from opposite quarter (unshadowed, softer)
  base += tint(ci+0.5)*max(dot(nv,normalize(-Lv+vec3(.2,-.1,0.))),0.)*0.09*ao;

  // Gloss specular
  vec3 H = normalize(Lv+vec3(0,0,1));
  base += pow(max(dot(nv,H),0.),uGloss)*uSheen*sha;

  // Coloured fresnel rim at silhouette
  float fres = pow(1.-clamp(nv.z,0.,1.),uRimPow);
  base += tint(ci+uRimShift)*fres*uRim;

  // SSS: scattered inner glow — most visible at metaball neck/thin spots
  base += tint(ci+0.5)*fres*fres*uSSS*0.5;

  return base;
}

void main(){
  vec2 uv = vUv*2.-1.;
  uv.x *= uAspect;

  // Orbit camera
  float cosPhi=cos(uPhi);
  vec3 ro    = vec3(uDist*cosPhi*sin(uTheta), uDist*sin(uPhi), uDist*cosPhi*cos(uTheta));
  vec3 fwd   = normalize(-ro);
  vec3 right = normalize(cross(fwd,vec3(0,1,0)));
  vec3 upV   = cross(right,fwd);
  vec3 rd    = normalize(fwd+uv.x*right*.9+uv.y*upV*.9);

  // World key light → view space (so diffuse changes as you orbit)
  vec3 L_w = normalize(vec3(-.4,.8,.6));
  vec3 Lv  = normalize(vec3(dot(L_w,right),dot(L_w,upV),-dot(L_w,fwd)));

  vec3  col    = uBg;
  float t      = 0.1;
  float hitHue = 0.;
  bool  didHit = false;

  for(int i=0;i<200;i++){
    vec3  p = ro+rd*t;
    vec2  r = map(p);
    if(r.x<0.0012){ hitHue=r.y; didHit=true; break; }
    float step = r.x*0.85;
    if(uMetaball>.5) step=clamp(r.x*0.45, 0.005, 0.13); // conservative: field isn't a true SDF
    t+=step;
    if(t>10.) break;
  }

  if(didHit){
    vec3 p  = ro+rd*t;
    vec3 n  = calcNormal(p);                                        // world normal
    vec3 nv = normalize(vec3(dot(n,right),dot(n,upV),-dot(n,fwd))); // view normal

    float ao  = calcAO(p, n);
    float sha = calcShadow(p+n*0.006, L_w);

    col = shade(nv, hitHue, ao, sha, Lv);
  }

  // Cinematic vignette
  col *= 1.-0.55*pow(dot(uv,uv)/2.,1.4);
  col += (hash(vUv*1920.+uTime)-.5)*uGrain;
  gl_FragColor = vec4(clamp(col,0.,1.),1.);
}
`

const toVec3 = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export class SoftForms3DEngine {
  constructor() { this.renderer = null; this.time = 0; this.playing = true; this.speed = 1 }

  init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
    this.scene = new THREE.Scene()
    this.cam   = new THREE.Camera()
    this.uniforms = {
      uTime:     { value: 0 },
      uAspect:   { value: 1 },
      uCount:    { value: 1 },
      uTheta:    { value: 0.3 },
      uPhi:      { value: 0.15 },
      uDist:     { value: 3.2 },
      uHue:      { value: 0 },
      uIrid:     { value: 1.0 },
      uSheen:    { value: 0.4 },
      uGloss:    { value: 32 },
      uRim:      { value: 0.8 },
      uRimPow:   { value: 2.6 },
      uRimShift: { value: 0.12 },
      uSSS:      { value: 0.3 },
      uMotion:   { value: 0.0 },
      uGrain:    { value: 0.018 },
      uSpectral: { value: 1 },
      uMetaball: { value: 0 },
      uDir:      { value: new THREE.Vector2(0.3, 0.95) },
      uBg:       { value: toVec3('#000000') },
      uColors:   { value: GRAD_PALETTES[0].cols.map(toVec3) },
      uType:     { value: new Array(MAX_FORMS).fill(0) },
      uPos3:     { value: Array.from({ length: MAX_FORMS }, () => new THREE.Vector3()) },
      uScale3:   { value: Array.from({ length: MAX_FORMS }, () => new THREE.Vector3(0.7, 0.7, 0.7)) },
      uRot3:     { value: new Array(MAX_FORMS).fill(0) },
      uHueOff:   { value: new Array(MAX_FORMS).fill(0) },
    }
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms })
    this.geo = new THREE.PlaneGeometry(2, 2)
    this.scene.add(new THREE.Mesh(this.geo, this.mat))
  }

  resize(w, h) {
    if (!this.renderer) return
    this.renderer.setSize(w, h, false)
    this.uniforms.uAspect.value = w / h
  }

  setCamera({ theta, phi, dist }) {
    if (!this.uniforms) return
    this.uniforms.uTheta.value = theta
    this.uniforms.uPhi.value   = phi
    this.uniforms.uDist.value  = dist
  }

  setForms(forms) {
    if (!this.uniforms || !forms) return
    const u = this.uniforms
    const f = forms.slice(0, MAX_FORMS)
    u.uCount.value = f.length || 1
    for (let i = 0; i < MAX_FORMS; i++) {
      const o = f[i] || {}
      u.uType.value[i]   = FORM_TYPES_3D[o.t] ?? 0
      u.uPos3.value[i].set(o.x ?? 0, o.y ?? 0, o.z ?? 0)
      const sx = o.sx ?? 0.7
      u.uScale3.value[i].set(sx, o.sy ?? sx, o.sz ?? sx)
      u.uRot3.value[i]   = ((o.rot ?? 0) * Math.PI) / 180
      u.uHueOff.value[i] = o.hue ?? 0
    }
  }

  setParams(p) {
    if (!this.uniforms) return
    const u = this.uniforms
    const map = {
      hue: 'uHue', irid: 'uIrid', sheen: 'uSheen', gloss: 'uGloss',
      rim: 'uRim', rimPow: 'uRimPow', rimShift: 'uRimShift',
      sss: 'uSSS', motion: 'uMotion', grain: 'uGrain',
    }
    for (const k in map) if (p[k] != null) u[map[k]].value = p[k]
    if (p.spectral != null) u.uSpectral.value = p.spectral ? 1 : 0
    if (p.metaball != null) u.uMetaball.value = p.metaball ? 1 : 0
    if (p.sweep    != null) { const a = (p.sweep * Math.PI) / 180; u.uDir.value.set(Math.sin(a), Math.cos(a)) }
    if (p.speed    != null) this.speed = p.speed
    if (p.forms)             this.setForms(p.forms)
    if (p.palette  != null) { const pal = GRAD_PALETTES.find((x) => x.value === p.palette) || GRAD_PALETTES[0]; u.uColors.value = pal.cols.map(toVec3) }
    if (p.backdrop != null) { const bd = BACKDROPS.find((x) => x.value === p.backdrop) || BACKDROPS[0]; u.uBg.value = toVec3(bd.col) }
  }

  setPlaying(v) { this.playing = v }

  frame(dt) {
    if (!this.renderer) return
    if (this.playing) this.time += dt * this.speed
    this.uniforms.uTime.value = this.time
    this.renderer.render(this.scene, this.cam)
  }

  resetTime() { this.time = 0; this.uniforms.uTime.value = 0 }

  exportBlob(w, h) {
    return new Promise((res) => {
      if (!this.renderer) return res(null)
      const prev = { w: this.renderer.domElement.width, h: this.renderer.domElement.height }
      this.resize(w, h)
      this.renderer.render(this.scene, this.cam)
      this.renderer.domElement.toBlob((b) => { this.resize(prev.w, prev.h); res(b) }, 'image/png')
    })
  }

  destroy() {
    this.mat?.dispose()
    this.geo?.dispose()
    if (this.renderer) { this.renderer.dispose(); this.renderer = null }
  }
}
