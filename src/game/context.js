// Shared game services, filled in by main.js (scene, camera director, post fx,
// effects, stage, settings, portraits, run state, …).
import * as THREE from 'three';

export const G = {
  scene: null,
  camera: null,
  cam: null,
  post: null,
  fx: null,
  stage: null,
  settings: null,
  portraits: null,
  run: null,
  fight: null,

  /** World position -> CSS pixel position. */
  project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight };
  },
};

export const _tmp = new THREE.Vector3();
