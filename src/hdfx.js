// HD extras: stage-captured environment maps (so fighters reflect the arena),
// real-time soft shadows and a mirror-glossy arena floor.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

const GlossShader = {
  name: 'GlossFloorShader',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    opacity: { value: 0.4 },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vUv2;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vUv2 = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float opacity;
    varying vec4 vUv;
    varying vec2 vUv2;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec4 base = texture2DProj(tDiffuse, vUv);
      vec2 e = abs(vUv2 - 0.5) * 2.0;
      float edge = (1.0 - smoothstep(0.55, 1.0, e.x)) * (1.0 - smoothstep(0.4, 1.0, e.y));
      gl_FragColor = vec4(base.rgb * color * edge * opacity, 1.0);
      #include <colorspace_fragment>
    }
  `,
};

// How wet/glossy each stage floor looks.
const FLOOR_GLOSS = { temple: 0.32, neon: 0.6, volcano: 0.4, cyber: 0.5 };

export class HDStage {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.env = null;
    this.floor = null;
    this.size = new THREE.Vector2(1280, 720);
  }

  /** Call right after a stage is created (before fighters are added). */
  onStage(stage) {
    const { scene } = this;
    // 1. environment map captured from the stage itself
    scene.environment = null;
    this.env?.dispose();
    const hidden = [];
    scene.traverse((o) => {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const skip = o.isSprite || o.isPoints || o.isLine || o.isReflector
        || (m && (m.isShaderMaterial || m.isPointsMaterial || m.isMeshPhysicalMaterial));
      if (skip && o.visible) { o.visible = false; hidden.push(o); }
    });
    this.env = this.pmrem.fromScene(scene, 0.03, 0.1, 200, { position: new THREE.Vector3(0, 1.3, 0.5) });
    for (const o of hidden) o.visible = true;
    scene.environment = this.env.texture;

    // 2. shadows from the strongest directional light
    let key = null;
    scene.traverse((o) => {
      if (o.isDirectionalLight && (!key || o.intensity > key.intensity)) key = o;
      if (o.isMesh && !o.material?.isMeshBasicMaterial) o.receiveShadow = true;
    });
    if (key) {
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      const c = key.shadow.camera;
      c.left = -4.5; c.right = 4.5; c.top = 4.5; c.bottom = -4.5;
      c.near = 0.5; c.far = key.position.length() + 20;
      c.updateProjectionMatrix();
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.02;
      key.shadow.radius = 4;
      if (key.target.parent !== scene) scene.add(key.target);
      key.target.position.set(0, 0.8, 0);
    }

    // 3. glossy mirror floor over the fight zone
    this.disposeFloor();
    if (this.disableFloor) return;
    const floor = new Reflector(new THREE.PlaneGeometry(18, 10), {
      clipBias: 0.003,
      textureWidth: Math.round(this.size.x * 0.5),
      textureHeight: Math.round(this.size.y * 0.5),
      color: 0xffffff,
      shader: GlossShader,
      multisample: 0,
    });
    floor.material.uniforms.opacity.value = FLOOR_GLOSS[stage.id] ?? 0.4;
    floor.material.transparent = true;
    floor.material.blending = THREE.AdditiveBlending;
    floor.material.depthWrite = false;
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.006;
    floor.renderOrder = 1;
    scene.add(floor);
    this.floor = floor;
  }

  setSize(w, h) {
    this.size.set(w, h);
    this.floor?.getRenderTarget().setSize(Math.round(w * 0.5), Math.round(h * 0.5));
  }

  disposeFloor() {
    if (!this.floor) return;
    this.scene.remove(this.floor);
    this.floor.dispose();
    this.floor = null;
  }
}
