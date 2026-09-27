// Post-processing: bloom + an "arcade" pass (chromatic aberration, radial zoom
// blur, impact-frame inversion, flashes, danger pulse, dim for super freezes).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Kills NaN/Inf pixels (e.g. from degenerate normals) before bloom spreads them.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b)) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = clamp(c, 0.0, 12.0);
    }`,
};

const ArcadeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAberr: { value: 0 },
    uZoom: { value: 0 },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uInvert: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uDanger: { value: 0 },
    uDim: { value: 0 },
    uSat: { value: 1.15 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uAberr, uZoom, uInvert, uFlash, uDanger, uDim, uSat, uTime;
    uniform vec2 uCenter;
    uniform vec3 uFlashColor;
    varying vec2 vUv;

    vec3 ca(vec2 uv, float a) {
      vec2 d = uv - 0.5;
      return vec3(
        texture2D(tDiffuse, uv + d * a).r,
        texture2D(tDiffuse, uv).g,
        texture2D(tDiffuse, uv - d * a).b);
    }

    void main() {
      vec2 uv = vUv;
      float a = 0.006 + uAberr * 0.05;
      vec3 col;
      if (uZoom > 0.002) {
        col = vec3(0.0);
        vec2 d = uv - uCenter;
        for (int i = 0; i < 10; i++) {
          float f = float(i) / 10.0;
          col += ca(uv - d * uZoom * f * 0.3, a);
        }
        col /= 10.0;
      } else {
        col = ca(uv, a);
      }
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSat);
      vec2 vd = uv - 0.5;
      float v = dot(vd, vd);
      col *= 1.0 - v * 0.9;                         // vignette
      col *= 1.0 - uDim * (0.55 + v * 1.2);         // super-freeze dim
      float pulse = 0.6 + 0.4 * sin(uTime * 9.0);
      col += vec3(0.5, 0.0, 0.03) * uDanger * pulse * smoothstep(0.08, 0.3, v);
      col = mix(col, vec3(1.0) - col, uInvert);
      col += uFlashColor * uFlash;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera, { samples = 0 } = {}) {
    this.renderer = renderer;
    const rt = new THREE.WebGLRenderTarget(320, 240, { type: THREE.HalfFloatType, samples });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.setPixelRatio(1);
    this.renderPass = new RenderPass(scene, camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(320, 240), 0.85, 0.45, 0.82);
    this.arcade = new ShaderPass(ArcadeShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(new ShaderPass(SanitizeShader));
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.arcade);
    this.composer.addPass(new OutputPass());
    this.u = this.arcade.uniforms;
    this.s = { aberr: 0, zoom: 0, flash: 0, invertFrames: 0, danger: 0, dim: 0, dimTarget: 0 };
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  /** Kick effects; values add to whatever is currently decaying. */
  pulse({ aberr = 0, zoom = 0, flash = 0, flashColor = null, invert = 0, center = null } = {}) {
    const s = this.s;
    s.aberr = Math.min(1.5, s.aberr + aberr);
    s.zoom = Math.min(1, Math.max(s.zoom, zoom));
    if (flash) {
      s.flash = Math.min(1, Math.max(s.flash, flash));
      this.u.uFlashColor.value.set(flashColor ?? 0xffffff);
    }
    if (invert) s.invertFrames = Math.max(s.invertFrames, invert);
    if (center) this.u.uCenter.value.copy(center);
  }

  setDanger(v) { this.s.danger = v; }
  setDim(v) { this.s.dimTarget = v; }

  render(rdt, time) {
    const s = this.s;
    const k = Math.exp(-rdt * 7);
    s.aberr *= Math.exp(-rdt * 5);
    s.zoom *= Math.exp(-rdt * 4);
    s.flash *= Math.exp(-rdt * 6);
    s.dim += (s.dimTarget - s.dim) * Math.min(1, rdt * 12);
    void k;
    const u = this.u;
    u.uAberr.value = s.aberr;
    u.uZoom.value = s.zoom;
    u.uFlash.value = s.flash;
    u.uInvert.value = s.invertFrames > 0 ? 1 : 0;
    if (s.invertFrames > 0) s.invertFrames--;
    u.uDanger.value = s.danger;
    u.uDim.value = s.dim;
    u.uTime.value = time;
    this.composer.render(rdt);
  }
}
