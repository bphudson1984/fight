// PS1-style helpers: vertex snapping ("wobble") shared by every lit material.
import * as THREE from 'three';

// Flat shading derives normals from screen-space derivatives, which are zero for
// surfaces seen exactly edge-on -> normalize(0) = NaN. That NaN gets smeared across
// bloom and environment maps, so make it safe globally.
THREE.ShaderChunk.normal_fragment_begin = THREE.ShaderChunk.normal_fragment_begin.replace(
  'vec3 normal = normalize( cross( fdx, fdy ) );',
  'vec3 flatN = cross( fdx, fdy ); vec3 normal = dot( flatN, flatN ) > 1e-24 ? normalize( flatN ) : vec3( 0.0, 0.0, 1.0 );',
);

// Grid (in clip-space half-units) that vertices snap to. Updated on resize.
export const SNAP = { value: new THREE.Vector2(160, 120) };

export function ps1(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = SNAP;
    shader.vertexShader = 'uniform vec2 uSnap;\n' + shader.vertexShader.replace(
      '#include project_vertex',
      `#include project_vertex
      if (uSnap.x < 100000.0 && gl_Position.w > 0.001) {
        vec4 sp = gl_Position;
        sp.xy = floor(sp.xy / sp.w * uSnap + 0.5) / uSnap * sp.w;
        gl_Position = sp;
      }`
    );
  };
  return material;
}

export function lambert(color, extra = {}) {
  return ps1(new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra }));
}

export function canvasTexture(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}
