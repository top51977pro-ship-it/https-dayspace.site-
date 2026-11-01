// The studio, the camera choreography and the deterministic render(t) for the RTX 5090 film.
// Every frame is a pure function of timeline time t (seconds): HyperFrames seeks frames out of order.
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { makeMaterials, makeGPU, spinFans, DIM } from "./gpu.js";

const W = 1920, H = 1080;
const FLOOR_Y = -DIM.H / 2 - 2.5;
const GREEN = new THREE.Color("#76B900");

// ---------- easing + keyframe tracks ---------------------------------------------------
const E = {
  linear: (p) => p,
  sineInOut: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  p2InOut: (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
  p3InOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  p2Out: (p) => 1 - (1 - p) * (1 - p),
  p3Out: (p) => 1 - Math.pow(1 - p, 3),
  expoOut: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
  p2In: (p) => p * p,
};
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, p) => a + (b - a) * p;
// piecewise track: keys = [[t, v], ...]; eased between keys
function track(t, keys, ease = E.sineInOut) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) return lerp(v0, v1, ease(clamp01((t - t0) / (t1 - t0))));
  }
  return keys[keys.length - 1][1];
}
const D2R = Math.PI / 180;

// ---------- shots ---------------------------------------------------------------------------
// Camera = spherical(az, el, r) around a moving target. az 0 = looking at the fan face (+Z).
const SHOTS = [
  { // 1 DARKNESS — macro grazing the bevel where the left fan ring meets the top rail
    t0: 0.0, t1: 4.2, ease: E.sineInOut,
    target: [[-5.9, 5.0, 2.0], [-4.9, 5.25, 2.0]], az: [-64, -52], el: [30, 25], r: [7.2, 6.6], fov: [30, 30],
    yaw: [0, 0], dof: { aperture: 0.0055, maxblur: 0.007 },
  },
  { // 2 REVEAL — continuous pull-back and orbit to the full card
    t0: 4.2, t1: 9.0, ease: E.p3InOut, rLog: true,
    target: [[-4.9, 5.25, 2.0], [0.0, 0.6, 0.0]], az: [-52, -27], el: [25, 13], r: [6.6, 60], fov: [30, 26],
    yaw: [0, 0], dof: { aperture: [0.004, 0.0004], maxblur: 0.006 },
  },
  { // 3a fan hub macro, push-in with a slight roll
    t0: 9.0, t1: 10.8, ease: E.sineInOut,
    target: [[4.6, 0.6, 1.6], [5.3, 0.4, 1.6]], az: [16, 6], el: [7, 3], r: [16.5, 13.0], fov: [30, 30], roll: [-3.5, 0.5],
    yaw: [0, 0], dof: { aperture: 0.0035, maxblur: 0.006 },
  },
  { // 3b lateral track along the top edge past the GEFORCE RTX wordmark
    t0: 10.8, t1: 12.4, ease: E.sineInOut,
    target: [[-9.5, 4.6, 0.6], [-2.2, 4.6, 0.6]], az: [-18, -9], el: [30, 27], r: [13.5, 12.2], fov: [30, 30],
    yaw: [0, 0], dof: { aperture: 0.004, maxblur: 0.007 },
  },
  { // 3c low grazing pass along the fan face: the rings recede in perspective, bevels catch the strip light
    t0: 12.4, t1: 14.0, ease: E.sineInOut,
    target: [[7.0, -1.2, 4.6], [-1.0, -0.8, 4.6]], az: [80, 70], el: [-9, -5], r: [21, 19], fov: [32, 32],
    yaw: [0, 0], dof: { aperture: 0.0025, maxblur: 0.006 },
  },
  { // 4 HERO — the card yaws into position while the camera arcs
    t0: 14.0, t1: 20.0, ease: E.p2Out,
    target: [[0, 2.6, 0], [0, 2.3, 0]], az: [-2, -19], el: [3.5, 8], r: [62, 68], fov: [25, 25],
    yaw: [-34, 0], yawEase: E.expoOut, yawDur: 4.6, dof: { aperture: 0.00025, maxblur: 0.0015 },
  },
  { // 5 FINAL — near-still
    t0: 20.0, t1: 25.0, ease: E.sineInOut,
    target: [[0, 2.3, 0], [0, 2.25, 0]], az: [-19, -20.2], el: [8, 8.3], r: [68, 67.2], fov: [25, 25],
    yaw: [0, 0], dof: { aperture: 0.00025, maxblur: 0.0015 },
  },
];

function shotAt(t) {
  for (const s of SHOTS) if (t < s.t1) return s;
  return SHOTS[SHOTS.length - 1];
}

// ---------- build ---------------------------------------------------------------------------
export async function buildStage(canvas) {
  RectAreaLightUniformsLib.init();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  const DPR = Math.max(1, Math.round(window.devicePixelRatio || 1)); // 2 for a true 4K render (--resolution 4k)
  renderer.setPixelRatio(DPR);
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // --- studio environment: black room + softbox strips, prefiltered once, rotated per frame
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x000000);
  const strip = (w, h, x, y, z, intensity, look = [0, 0, 0], color = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(...look); envScene.add(m);
  };
  strip(70, 30, 0, 45, 5, 2.2);              // overhead softbox
  strip(5, 46, -42, 6, 14, 4.0);             // left vertical strip
  strip(5, 46, 44, 4, -4, 3.0);              // right vertical strip
  strip(80, 3.5, 0, 14, -46, 3.4, [0, 0, 0], 0xdfe8ff); // rear rim strip (cool)
  strip(60, 2.5, 0, -4, 48, 0.35);           // faint low front fill
  strip(46, 16, -8, 30, 44, 0.9);            // large soft front-top softbox: a gradient on the flat faces
  strip(3, 30, -30, 8, 40, 2.2);             // narrow front-left strip: a crisp line on the bevels
  { // wide gradient softbox where the flat fan face reflects for the hero angles (front, slightly right, near horizon)
    const c = document.createElement("canvas"); c.width = 512; c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 512, 0);
    grd.addColorStop(0.0, "rgba(0,0,0,1)"); grd.addColorStop(0.3, "rgb(90,90,92)");
    grd.addColorStop(0.55, "rgb(255,255,255)"); grd.addColorStop(0.62, "rgb(200,200,202)");
    grd.addColorStop(1.0, "rgba(0,0,0,1)");
    g.fillStyle = grd; g.fillRect(0, 0, 512, 64);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 34), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.3, 1.3, 1.3), side: THREE.DoubleSide }));
    m.position.set(14, -4, 47); m.lookAt(0, 0, 0); envScene.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(envScene, 0.02);
  scene.environment = envRT.texture;

  // --- card + mirrored reflection
  const M = makeMaterials();
  const pivot = new THREE.Group();
  const card = makeGPU(M);
  pivot.add(card);
  scene.add(pivot);

  const mirrorRoot = new THREE.Group();
  mirrorRoot.position.y = 2 * FLOOR_Y;
  mirrorRoot.scale.y = -1;
  const mPivot = new THREE.Group();
  const mCard = makeGPU(M);
  mPivot.add(mCard);
  mirrorRoot.add(mPivot);
  scene.add(mirrorRoot);

  // --- satin floor (semi-transparent so the mirrored card reads as a reflection)
  const floorAlpha = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(256, 256, 10, 256, 256, 256);
    grd.addColorStop(0, "rgb(205,205,205)");
    grd.addColorStop(0.3, "rgb(232,232,232)");
    grd.addColorStop(1, "rgb(255,255,255)");
    g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(c); return tex;
  })();
  const floorPool = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    grd.addColorStop(0, "rgb(34,35,38)");
    grd.addColorStop(0.25, "rgb(18,18,20)");
    grd.addColorStop(0.6, "rgb(5,5,6)");
    grd.addColorStop(1, "rgb(0,0,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
  })();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 150),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x000000), map: floorPool, transparent: true, alphaMap: floorAlpha }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  scene.add(floor);

  // --- lights
  const key = new THREE.RectAreaLight(0xfff4ea, 0, 40, 12);   // large softbox, upper-left front
  key.position.set(-26, 30, 26); key.lookAt(0, 0, 0); scene.add(key);
  const rim = new THREE.RectAreaLight(0xdfe9ff, 0, 50, 4);    // behind and above: separates the top edge
  rim.position.set(6, 22, -30); rim.lookAt(0, 2, 0); scene.add(rim);
  const scan = new THREE.RectAreaLight(0xffffff, 0, 0.9, 30); // the narrow light of shot 1
  scene.add(scan);
  const blade = new THREE.RectAreaLight(GREEN, 0, 0.7, 34);   // the green light blade of the hero
  scene.add(blade);
  const bladeRim = new THREE.RectAreaLight(GREEN, 0, 0.6, 12);
  scene.add(bladeRim);

  // --- camera + post
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.5, 2000);
  const rt = new THREE.WebGLRenderTarget(W * DPR, H * DPR, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(DPR);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = new BokehPass(scene, camera, { focus: 20, aperture: 0.0005, maxblur: 0.004 });
  composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.22, 0.55, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(W, H) }, uFrame: { value: 0 }, uVig: { value: 0.22 }, uGrain: { value: 0.016 }, uFade: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uFrame, uVig, uGrain, uFade; varying vec2 vUv;
      float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        vec2 d = vUv - 0.5; d.x *= 1.25;
        float v = smoothstep(0.85, 0.18, length(d));
        c *= mix(1.0 - uVig, 1.0, v);
        // cool-neutral split: a touch of blue in the shadows, neutral highlights
        float l = dot(c, vec3(0.2126,0.7152,0.0722));
        c += vec3(-0.004, 0.0, 0.010) * (1.0 - smoothstep(0.0, 0.35, l));
        float n = hash(floor(vUv*uRes) + uFrame*17.31) - 0.5; // grain in 1080p cells: same look at 4K
        c += n * uGrain * (0.35 + 0.65 * smoothstep(0.0, 0.25, l));
        gl_FragColor = vec4(max(c, 0.0) * uFade, 1.0);
      }`,
  });
  composer.addPass(grade);

  // ---------- render(t) ------------------------------------------------------------------
  const tmpT = new THREE.Vector3();
  function render(t) {
    t = Math.min(Math.max(t, 0), 25);
    const s = shotAt(t);
    const p = clamp01((t - s.t0) / (s.t1 - s.t0));
    const e = s.ease(p);
    // camera
    const [a, b] = s.target;
    tmpT.set(lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e));
    const az = lerp(s.az[0], s.az[1], e) * D2R;
    const el = lerp(s.el[0], s.el[1], e) * D2R;
    const r = s.rLog ? Math.exp(lerp(Math.log(s.r[0]), Math.log(s.r[1]), e)) : lerp(s.r[0], s.r[1], e);
    camera.fov = lerp(s.fov[0], s.fov[1], e);
    camera.position.set(tmpT.x + r * Math.cos(el) * Math.sin(az), tmpT.y + r * Math.sin(el), tmpT.z + r * Math.cos(el) * Math.cos(az));
    camera.up.set(0, 1, 0);
    camera.lookAt(tmpT);
    if (s.roll) camera.rotateZ(lerp(s.roll[0], s.roll[1], e) * D2R);
    camera.updateProjectionMatrix();

    // product yaw (hero) — long-tailed arrival
    const yp = s.yawDur ? (s.yawEase || E.p3Out)(clamp01((t - s.t0) / s.yawDur)) : e;
    const yaw = lerp(s.yaw[0], s.yaw[1], yp) * D2R;
    pivot.rotation.set(0, yaw, 0);
    mPivot.rotation.copy(pivot.rotation);
    spinFans(card, t); spinFans(mCard, t);

    // depth of field focused on the target
    const focus = camera.position.distanceTo(tmpT);
    const ap = Array.isArray(s.dof.aperture) ? lerp(s.dof.aperture[0], s.dof.aperture[1], e) : s.dof.aperture;
    bokeh.uniforms.focus.value = focus;
    bokeh.uniforms.aperture.value = ap;
    bokeh.uniforms.maxblur.value = s.dof.maxblur;
    bokeh.enabled = ap > 0.0006; // the hero shots are deep-focus: skip the DOF pass entirely
    // the reflection can only be seen in the wide shots
    mirrorRoot.visible = floor.visible = t >= 14.0 || (t > 6.0 && t < 9.0);

    // light design over time
    const envI = track(t, [[0, 0], [1.2, 0.0], [3.6, 0.05], [4.6, 0.06], [7.8, 1.0], [9.0, 1.0], [14.0, 1.0], [14.01, 1.15], [25, 1.15]]);
    scene.environmentIntensity = envI;
    const envRot = t < 9 ? track(t, [[0, -0.9], [9, 0.25]], E.linear)
      : t < 12.4 ? track(t, [[9, 0.55], [12.4, 0.9]], E.linear)
      : t < 14 ? track(t, [[12.4, 2.35], [14, 2.75]], E.linear)
      : t < 20 ? track(t, [[14, -0.55], [20, 0.05]], E.p2Out)
      : track(t, [[20, 0.05], [25, 0.16]], E.linear);
    scene.environmentRotation.set(0, envRot, 0);
    key.intensity = track(t, [[0, 0], [4.8, 0], [8.0, 2.6], [14, 2.6], [14.01, 3.6], [25, 3.6]]);
    rim.intensity = track(t, [[0, 0], [3.0, 0], [6.0, 3.0], [25, 3.0]]);
    floor.material.color.setScalar(track(t, [[0, 0], [5.0, 0], [8.5, 1.0], [25, 1.0]]));
    // scanner strip (shot 1) — slides left to right along the bevel, then hands over to the studio
    const sx = track(t, [[0.3, -19], [5.0, 6]], E.sineInOut);
    scan.position.set(sx, 13, 11);
    scan.lookAt(sx + 2, 4.5, 1.5);
    scan.intensity = track(t, [[0.35, 0], [1.6, 42], [4.0, 42], [6.4, 0]]);
    // green blade (hero) — one pass, left to right, in front of the card
    const bx = track(t, [[15.3, -40], [17.1, 52]], E.p2InOut);
    blade.position.set(bx, -3, 46);
    blade.lookAt(bx * 0.35, 1, 0);
    blade.intensity = track(t, [[15.3, 0], [15.7, 20], [16.7, 20], [17.1, 0]]);
    const rx = track(t, [[15.3, -26], [17.1, 26]], E.p2InOut);
    bladeRim.position.set(rx, 15, -9);
    bladeRim.lookAt(rx, DIM.H / 2, 0.5);
    bladeRim.intensity = track(t, [[15.3, 0], [15.7, 40], [16.7, 40], [17.1, 0]]);
    // wordmark glow: barely on in shot 1 (a hint in the dark), steady afterwards
    M.wordmark.emissiveIntensity = track(t, [[0, 0], [2.0, 0], [4.5, 1.0], [8, 1.35], [25, 1.35]]);

    for (const l of [key, rim, scan, blade, bladeRim]) l.visible = l.intensity > 0.001;
    renderer.toneMappingExposure = track(t, [[0, 1.0], [14, 1.0], [14.01, 1.05], [25, 1.05]]);
    grade.uniforms.uFrame.value = Math.round(t * 30);
    grade.uniforms.uFade.value = track(t, [[0, 1], [23.4, 1], [24.8, 0]], E.p2InOut);
    composer.render();
  }

  return { render, renderer };
}
