// Procedural NVIDIA GeForce RTX 5090 Founders Edition.
// Units: centimetres. Card length along X (30.4), height along Y (13.7), thickness along Z (4.0).
// Fans face +Z. The top edge (+Y) carries the GEFORCE RTX wordmark and the 16-pin connector.
// The I/O bracket is at -X. See REFERENCES.md for which details are verified and which are approximated.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const DIM = { L: 30.4, H: 13.7, T: 4.0 };
export const FAN = { R_OPEN: 5.85, R_TIP: 5.62, R_HUB: 1.9, CX: 8.35 };

// --- deterministic noise -------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Brushed / bead-blasted roughness map: fine horizontal streaks.
function brushedRoughnessTexture(seed, base, amp) {
  const W = 512, H = 512;
  const rand = mulberry32(seed);
  const data = new Uint8Array(W * H * 4);
  const rows = new Float32Array(H);
  for (let y = 0; y < H; y++) rows[y] = (rand() - 0.5) * 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const streak = rows[y] * 0.55 + rows[(y + 1) % H] * 0.25 + rows[(y + H - 1) % H] * 0.2;
      const grain = (rand() - 0.5) * 0.6;
      const v = THREE.MathUtils.clamp(base + (streak + grain) * amp, 0, 1);
      const i = (y * W + x) * 4;
      // roughnessMap reads G, metalnessMap reads B
      data[i] = 255; data[i + 1] = Math.round(v * 255); data[i + 2] = 255; data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// --- materials -----------------------------------------------------------------------
export function makeMaterials() {
  const rough = brushedRoughnessTexture(7, 0.5, 0.06);
  rough.repeat.set(1 / 12, 1 / 1.2);
  const gunmetal = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#62656b"),
    metalness: 1.0,
    roughness: 0.78, // multiplied by map (~0.5) → ~0.39
    roughnessMap: rough,
    clearcoat: 0.18,
    clearcoatRoughness: 0.32,
    envMapIntensity: 1.0,
  });
  const centerRough = brushedRoughnessTexture(11, 0.5, 0.04);
  centerRough.repeat.set(1 / 8, 1 / 1.0);
  const centerPanel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#3a3c41"),
    metalness: 1.0,
    roughness: 0.84,
    roughnessMap: centerRough,
    clearcoat: 0.25,
    clearcoatRoughness: 0.28,
  });
  const fins = new THREE.MeshStandardMaterial({ color: new THREE.Color("#2a2c30"), metalness: 1.0, roughness: 0.34 });
  const finsDark = new THREE.MeshStandardMaterial({ color: new THREE.Color("#121315"), metalness: 0.6, roughness: 0.5 });
  const blade = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#17181a"), metalness: 0.15, roughness: 0.42,
    clearcoat: 0.45, clearcoatRoughness: 0.3, side: THREE.DoubleSide,
  });
  const hub = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#26282c"), metalness: 0.7, roughness: 0.36, clearcoat: 0.3, clearcoatRoughness: 0.25, side: THREE.DoubleSide,
  });
  const nickel = new THREE.MeshStandardMaterial({ color: new THREE.Color("#6f7275"), metalness: 1.0, roughness: 0.42 });
  const steel = new THREE.MeshStandardMaterial({ color: new THREE.Color("#b8babd"), metalness: 1.0, roughness: 0.32 });
  const black = new THREE.MeshStandardMaterial({ color: new THREE.Color("#060607"), metalness: 0.2, roughness: 0.6 });
  const pcb = new THREE.MeshStandardMaterial({ color: new THREE.Color("#0d1210"), metalness: 0.1, roughness: 0.55 });

  const goldMap = canvasTexture(1024, 64, (g, w, h) => {
    g.fillStyle = "#151a17"; g.fillRect(0, 0, w, h);
    const n = 46;
    for (let i = 0; i < n; i++) {
      const x0 = (i / n) * w + 3;
      if (i === 11) continue; // PCIe key notch region
      g.fillStyle = "#ffffff";
      g.fillRect(x0, 6, w / n - 7, h - 6);
    }
  });
  const gold = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#d9ac55"), metalness: 1.0, roughness: 0.22, map: goldMap,
  });
  return { gunmetal, centerPanel, fins, finsDark, blade, hub, nickel, steel, black, pcb, gold };
}

// --- geometry helpers ------------------------------------------------------------------
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function circlePath(cx, cy, r, cw = true) {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, cw);
  return p;
}

// The hourglass "X" panel between the two fan rings (the infinity-loop waist).
function hourglassShapeExact(ringR, halfH) {
  // Built from sampled points for robustness.
  const cx = FAN.CX;
  const pts = [];
  const dx = Math.sqrt(Math.max(ringR * ringR - halfH * halfH, 0));
  const aTop = Math.atan2(halfH, -dx); // right circle, top-left
  const N = 48;
  // top edge left→right
  pts.push(new THREE.Vector2(-(cx - dx), halfH));
  pts.push(new THREE.Vector2(cx - dx, halfH));
  // right arc: angle aTop → 2π - aTop passing through π (the waist at x = cx - ringR)
  for (let i = 1; i < N; i++) {
    const a = aTop + (i / N) * (2 * Math.PI - 2 * aTop);
    pts.push(new THREE.Vector2(cx + ringR * Math.cos(a), ringR * Math.sin(a)));
  }
  pts.push(new THREE.Vector2(cx - dx, -halfH));
  pts.push(new THREE.Vector2(-(cx - dx), -halfH));
  // left arc: mirror of right arc, bottom→top
  for (let i = 1; i < N; i++) {
    const a = aTop + (i / N) * (2 * Math.PI - 2 * aTop);
    pts.push(new THREE.Vector2(-(cx + ringR * Math.cos(a)), -ringR * Math.sin(a)));
  }
  return new THREE.Shape(pts);
}

// Parametric swept fan blade with pitch; thin double surface.
function bladeGeometry(seedAngle) {
  const NU = 26, NV = 14;
  const { R_HUB, R_TIP } = FAN;
  const thick = 0.07;
  const pos = [];
  const idx = [];
  const surf = (side) => {
    const base = pos.length / 3;
    for (let iu = 0; iu <= NU; iu++) {
      const u = iu / NU;
      const r = R_HUB - 0.05 + u * (R_TIP - R_HUB + 0.05);
      const span = THREE.MathUtils.lerp(0.62, 0.66, u) * (1 - 0.55 * Math.pow(u, 7));
      const sweep = 0.42 * Math.pow(u, 1.35);
      const pitch = THREE.MathUtils.lerp(0.95, 0.42, u);
      for (let iv = 0; iv <= NV; iv++) {
        const v = iv / NV;
        const camber = Math.sin(v * Math.PI) * 0.12; // curved airfoil
        const th = seedAngle + sweep + (v - 0.5) * span;
        const z = (v - 0.5) * pitch + camber + side * thick * Math.sin(v * Math.PI + 0.2);
        pos.push(r * Math.cos(th), r * Math.sin(th), z);
      }
    }
    for (let iu = 0; iu < NU; iu++) {
      for (let iv = 0; iv < NV; iv++) {
        const a = base + iu * (NV + 1) + iv;
        const b = a + NV + 1;
        if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
        else idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  };
  surf(1);
  surf(-1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function hubGeometry() {
  const { R_HUB } = FAN;
  const prof = [];
  prof.push(new THREE.Vector2(0.0001, 0.62));
  // shallow concave centre cap with fine machined steps
  for (let i = 0; i <= 10; i++) {
    const r = (i / 10) * (R_HUB - 0.35);
    const z = 0.6 - 0.03 * Math.sin((i / 10) * Math.PI) + (i % 2 ? 0.004 : 0);
    prof.push(new THREE.Vector2(r + 0.0001, z));
  }
  // rounded shoulder
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2);
    prof.push(new THREE.Vector2(R_HUB - 0.35 + Math.sin(a) * 0.35, 0.25 + Math.cos(a) * 0.35));
  }
  prof.push(new THREE.Vector2(R_HUB, -0.6));
  prof.push(new THREE.Vector2(0.0001, -0.6));
  return new THREE.LatheGeometry(prof, 96).rotateX(Math.PI / 2);
}

// --- the card ---------------------------------------------------------------------------
export function makeGPU(M, opts = {}) {
  const { L, H, T } = DIM;
  const card = new THREE.Group();
  card.name = "rtx5090";
  const fans = [];

  // 1) Shell: full-thickness gunmetal frame with two through-openings (flow-through).
  const bevel = 0.22;
  const outer = roundedRectShape(L - 2 * bevel, H - 2 * bevel, 0.55);
  outer.holes.push(circlePath(-FAN.CX, 0, FAN.R_OPEN + bevel, true));
  outer.holes.push(circlePath(FAN.CX, 0, FAN.R_OPEN + bevel, true));
  const shellGeo = new THREE.ExtrudeGeometry(outer, {
    depth: T - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 128,
  });
  shellGeo.translate(0, 0, -(T - 2 * bevel) / 2);
  shellGeo.computeVertexNormals();
  const shell = new THREE.Mesh(shellGeo, M.gunmetal);
  shell.castShadow = true;
  card.add(shell);

  // 2) Hourglass "X" centre panels on front and back (raised 0.4 mm, darker satin).
  const hgGeo = new THREE.ExtrudeGeometry(hourglassShapeExact(FAN.R_OPEN + 0.95, H / 2 - 1.05), {
    depth: 0.02, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.05, bevelSegments: 3, curveSegments: 64,
  });
  const hgFront = new THREE.Mesh(hgGeo, M.centerPanel);
  hgFront.position.z = T / 2 - 0.01;
  card.add(hgFront);
  const hgBack = new THREE.Mesh(hgGeo, M.centerPanel);
  hgBack.position.z = -T / 2 + 0.01;
  hgBack.rotation.y = Math.PI;
  card.add(hgBack);

  // 3) Fin stacks inside both openings: thin vertical fins clipped to the circle.
  const finGeo = new THREE.BoxGeometry(0.03, 1, T - 1.15);
  const pitch = 0.17;
  const nFins = Math.floor((2 * FAN.R_OPEN) / pitch);
  const finMesh = new THREE.InstancedMesh(finGeo, M.fins, nFins * 2);
  const m4 = new THREE.Matrix4();
  let k = 0;
  for (const side of [-1, 1]) {
    for (let i = 0; i < nFins; i++) {
      const x = -FAN.R_OPEN + pitch * (i + 0.5);
      const chord = 2 * Math.sqrt(Math.max(FAN.R_OPEN * FAN.R_OPEN - x * x, 0)) - 0.02;
      m4.compose(
        new THREE.Vector3(side * FAN.CX + x, 0, -0.55),
        new THREE.Quaternion(),
        new THREE.Vector3(1, Math.max(chord, 0.01), 1),
      );
      finMesh.setMatrixAt(k++, m4);
    }
  }
  finMesh.instanceMatrix.needsUpdate = true;
  card.add(finMesh);
  // dark core behind fins so the openings read as dense, not see-through
  for (const side of [-1, 1]) {
    const core = new THREE.Mesh(new THREE.CircleGeometry(FAN.R_OPEN + 0.05, 96), M.finsDark);
    core.position.set(side * FAN.CX, 0, -0.55);
    card.add(core);
  }
  // heat pipes (nickel-plated) running across both fin stacks, visible between the blades
  const pipeGeo = new THREE.CylinderGeometry(0.28, 0.28, L - 2.6, 24).rotateZ(Math.PI / 2);
  for (const y of [-3.6, -1.2, 1.2, 3.6]) {
    const p = new THREE.Mesh(pipeGeo, M.nickel);
    p.position.set(0, y, -0.15 + (Math.abs(y) > 2 ? 0.0 : 0.35));
    card.add(p);
  }

  // 4) Fans: hub + 7 swept blades, near the front of each opening.
  const blades = [];
  for (let b = 0; b < 7; b++) blades.push(bladeGeometry((b / 7) * Math.PI * 2));
  const bladeGeo = mergeGeometries(blades);
  const hubGeo = hubGeometry();
  for (const side of [-1, 1]) {
    const fan = new THREE.Group();
    fan.position.set(side * FAN.CX, 0, T / 2 - 0.85);
    const rotor = new THREE.Group();
    rotor.add(new THREE.Mesh(bladeGeo, M.blade));
    const hub = new THREE.Mesh(hubGeo, M.hub);
    hub.position.z = 0.05;
    rotor.add(hub);
    fan.add(rotor);
    card.add(fan);
    fans.push({ rotor, dir: 1 });
  }

  // 5) Top edge: inset strip with the illuminated GEFORCE RTX wordmark + 16-pin connector recess.
  const wordTex = canvasTexture(2048, 200, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff";
    g.font = "700 120px 'Inter HF', Inter, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    if ("letterSpacing" in g) g.letterSpacing = "18px";
    g.fillText("GEFORCE RTX", w / 2, h / 2 + 6);
  });
  const stripMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#050506"), metalness: 0.3, roughness: 0.45,
    emissive: new THREE.Color("#ffffff"), emissiveMap: wordTex, emissiveIntensity: 2.4,
  });
  M.wordmark = stripMat;
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 0.94), stripMat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(-6.0, H / 2 + 0.004, 0);
  card.add(strip);

  const conn = new THREE.Group();
  const recess = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.02, 1.05), M.black);
  conn.add(recess);
  const pinGeo = new THREE.BoxGeometry(0.22, 0.03, 0.22);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
    const pin = new THREE.Mesh(pinGeo, M.pcb);
    pin.position.set(-0.75 + i * 0.3, 0.005, -0.18 + j * 0.36);
    conn.add(pin);
  }
  conn.position.set(2.6, H / 2 + 0.005, 0);
  card.add(conn);

  // 6) I/O bracket at -X: steel plate, screw tab, 3× DP + 1× HDMI, vent slots.
  const bracket = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 12.0, 4.1), M.steel);
  bracket.add(plate);
  const tab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 4.1), M.steel);
  tab.position.set(-0.45, 6.0, 0);
  bracket.add(tab);
  const ports = [
    { y: 3.7, w: 1.62, h: 0.58 }, { y: 1.75, w: 1.62, h: 0.58 }, { y: -0.2, w: 1.62, h: 0.58 }, { y: -2.25, w: 1.48, h: 0.5 },
  ];
  for (const p of ports) {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.05, p.w + 0.16, p.h + 0.16), M.nickel);
    lip.position.set(-0.06, p.y, 1.05);
    bracket.add(lip);
    const port = new THREE.Mesh(new THREE.BoxGeometry(0.06, p.w, p.h), M.black);
    port.position.set(-0.085, p.y, 1.05);
    bracket.add(port);
  }
  // dense vent field (rounded slots) on the rear half of the bracket
  const slotGeo = new THREE.CapsuleGeometry(0.075, 0.9, 4, 8);
  for (let r = 0; r < 9; r++) for (let c = 0; c < 5; c++) {
    const sl = new THREE.Mesh(slotGeo, M.black);
    sl.scale.set(0.5, 1, 1);
    sl.position.set(-0.055, 4.6 - r * 1.12, -1.75 + c * 0.32);
    bracket.add(sl);
  }
  bracket.position.set(-L / 2 - 0.06, -0.55, 0);
  card.add(bracket);

  // 7) PCIe edge connector with gold fingers on the bottom edge near the bracket.
  const fingers = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.85, 0.16), [M.pcb, M.pcb, M.pcb, M.pcb, M.gold, M.gold]);
  fingers.position.set(-L / 2 + 6.9, -H / 2 - 0.42, -0.6);
  card.add(fingers);

  card.userData.fans = fans;
  return card;
}

export function spinFans(card, t) {
  for (const f of card.userData.fans) f.rotor.rotation.z = -t * 0.9 * f.dir;
}
