/* ============================================================================
   Golden XI — 3D renderer (WebGL via three.js).
   Renders the SAME match simulation (game.js) in real 3D on the device GPU.
   game.js keeps world coords (x, y); here world-y maps to 3D z.
   ========================================================================== */
window.Scene3D = (function () {
  'use strict';
  let renderer, scene, camera, ready = false;
  let L, W, ball3d, ring, groups = [];
  let ballShadow, shadowGeo, shadowMat;

  function init(canvas, worldL, worldW) {
    L = worldL; W = worldW;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setClearColor(0x0a1014, 1);

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a1014, 130, 300);

    camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.5, 800);

    scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x24331d, 1.0));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.05);
    sun.position.set(-40, 90, -20);
    scene.add(sun);

    // surrounding darker ground (stands feel)
    const surround = new THREE.Mesh(
      new THREE.PlaneGeometry(L * 4, W * 4),
      new THREE.MeshBasicMaterial({ color: 0x0c1a10 }));
    surround.rotation.x = -Math.PI / 2;
    surround.position.set(L / 2, -0.06, W / 2);
    scene.add(surround);

    // pitch
    const tex = new THREE.CanvasTexture(makePitchCanvas());
    tex.anisotropy = 4;
    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(L, W),
      new THREE.MeshLambertMaterial({ map: tex }));
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.set(L / 2, 0, W / 2);
    scene.add(pitch);

    // shared soft blob shadow
    shadowGeo = new THREE.CircleGeometry(1, 18);
    shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });

    // ball (bigger, easier to see) with a pentagon-ish pattern + shadow
    ball3d = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 20, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, map: makeBallTexture() }));
    scene.add(ball3d);
    ballShadow = new THREE.Mesh(shadowGeo, shadowMat);
    ballShadow.rotation.x = -Math.PI / 2; ballShadow.scale.set(0.55, 0.55, 0.55); ballShadow.position.y = 0.02;
    scene.add(ballShadow);

    // active-player ring
    ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.13, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0x2fe0a0 }));
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    scene.add(ring);

    buildStands();
    buildGoals();
    ready = true;
  }

  function makeCrowdCanvas() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = '#243043'; g.fillRect(0, 0, 256, 96);
    const cols = ['#e8ecf5', '#c9d2e0', '#9aa6bd', '#ff6a8a', '#6a8aff', '#ffd76a', '#7affc0', '#ff9a5a'];
    for (let i = 0; i < 2200; i++) {
      g.fillStyle = cols[(Math.random() * cols.length) | 0];
      g.fillRect((Math.random() * 256) | 0, (Math.random() * 96) | 0, 2, 3);
    }
    return c;
  }

  function buildStands() {
    const crowd = new THREE.CanvasTexture(makeCrowdCanvas());
    crowd.wrapS = crowd.wrapT = THREE.RepeatWrapping;
    const m = new THREE.MeshBasicMaterial({ map: crowd });   // unlit → crowd stays bright
    // four raised, inward-tilted slabs around the pitch
    const slab = (cx, cy, cz, w, h, d, rotY, rotX) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(cx, cy, cz);
      mesh.rotation.y = rotY; mesh.rotation.x = rotX;
      scene.add(mesh);
    };
    const long = L + 46, side = W + 46;
    slab(L / 2, 5, -12, long, 13, 7, 0, 0.4);          // far touchline
    slab(L / 2, 5, W + 12, long, 13, 7, 0, -0.4);      // near touchline
    slab(-12, 5, W / 2, 7, 13, side, 0, 0);            // left end
    slab(L + 12, 5, W / 2, 7, 13, side, 0, 0);         // right end
    crowd.repeat.set(28, 3);
  }

  function makePitchCanvas() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 680;
    const g = c.getContext('2d');
    const bands = 12;
    for (let i = 0; i < bands; i++) {
      g.fillStyle = i % 2 ? '#347f42' : '#2f7a3d';
      g.fillRect(i * c.width / bands, 0, c.width / bands + 1, c.height);
    }
    g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 5;
    g.strokeRect(20, 20, c.width - 40, c.height - 40);
    g.beginPath(); g.moveTo(c.width / 2, 20); g.lineTo(c.width / 2, c.height - 20); g.stroke();
    g.beginPath(); g.arc(c.width / 2, c.height / 2, 92, 0, 7); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(c.width / 2, c.height / 2, 6, 0, 7); g.fill();
    const bh = c.height * 0.58, bw = c.width * 0.15, by = c.height / 2 - bh / 2;
    g.strokeRect(20, by, bw, bh); g.strokeRect(c.width - 20 - bw, by, bw, bh);
    const sh = c.height * 0.30, sw = c.width * 0.06, sy = c.height / 2 - sh / 2;
    g.strokeRect(20, sy, sw, sh); g.strokeRect(c.width - 20 - sw, sy, sw, sh);
    return c;
  }

  function buildGoals() {
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const gw = 12, half = gw / 2;
    const netMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, side: THREE.DoubleSide });
    for (const end of [0, 1]) {
      const ex = end === 0 ? 0.3 : L - 0.3, out = end === 0 ? -1 : 1;
      const post = new THREE.BoxGeometry(0.28, 2.5, 0.28);
      const p1 = new THREE.Mesh(post, white); p1.position.set(ex, 1.25, W / 2 - half); scene.add(p1);
      const p2 = new THREE.Mesh(post, white); p2.position.set(ex, 1.25, W / 2 + half); scene.add(p2);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, gw), white);
      bar.position.set(ex, 2.5, W / 2); scene.add(bar);
      // net (translucent box behind the line) + back panel
      const net = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.5, gw), netMat);
      net.position.set(ex + out * 1.1, 1.25, W / 2); scene.add(net);
    }
  }

  function mat(cssColor, rough) {
    return new THREE.MeshStandardMaterial({ color: new THREE.Color(cssColor), roughness: rough });
  }

  // a limb hanging from a pivot at (xoff, pivotY) so it can swing when running
  function limb(material, w, ht, d, xoff, pivotY) {
    const pivot = new THREE.Group(); pivot.position.set(xoff, pivotY, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, ht, d), material); m.position.y = -ht / 2;
    pivot.add(m); return pivot;
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function numberSprite(num, fg, bg) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 34; const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,.4)'; roundRect(g, 0, 0, 64, 34, 9); g.fill();
    g.fillStyle = bg; roundRect(g, 3, 3, 58, 28, 7); g.fill();
    g.fillStyle = fg; g.font = 'bold 22px system-ui,Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(num), 32, 18);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    return spr;
  }
  function makeBallTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#1a1a1a';
    for (const [x, y] of [[20, 18], [46, 22], [32, 44], [10, 46], [52, 50]]) {
      g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
    }
    return new THREE.CanvasTexture(c);
  }
  // a bone: pivot group at (x,y) with a box hanging down length `len` (child attaches at y=-len)
  function joint(parent, material, w, len, d, x, y) {
    const pv = new THREE.Group(); pv.position.set(x, y, 0); parent.add(pv);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), material); m.position.y = -len / 2; pv.add(m);
    return pv;
  }
  function buildPlayer(p) {
    const g = new THREE.Group();
    const h = p.h3d || 1, bw = p.build3d || 1;
    const kit = mat(p.kit3d, 0.62), skin = mat(p.skin, 0.85), hair = mat(p.hair, 0.9),
          sh = mat(p.short3d, 0.8), sock = mat(p.kit3d, 0.85), boot = mat('#141414', 0.5);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; shadow.scale.set(1.15, 1.15, 1.15); g.add(shadow);
    const body = new THREE.Group(); g.add(body);
    const hip = 0.86 * h, shoulder = 1.5 * h;
    // legs: thigh → shin → foot (articulated for a real run cycle)
    const hips = new THREE.Group(); hips.position.y = hip; body.add(hips);
    const thighL = joint(hips, sh, 0.17 * bw, 0.42 * h, 0.19, 0.13 * bw, 0);
    const shinL = joint(thighL, sock, 0.15 * bw, 0.42 * h, 0.16, 0, -0.42 * h);
    const footL = joint(shinL, boot, 0.16, 0.12, 0.38, 0, -0.42 * h); footL.children[0].position.set(0.1, -0.06, 0);
    const thighR = joint(hips, sh, 0.17 * bw, 0.42 * h, 0.19, -0.13 * bw, 0);
    const shinR = joint(thighR, sock, 0.15 * bw, 0.42 * h, 0.16, 0, -0.42 * h);
    const footR = joint(shinR, boot, 0.16, 0.12, 0.38, 0, -0.42 * h); footR.children[0].position.set(0.1, -0.06, 0);
    // torso + shoulders
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66 * bw, 0.64 * h, 0.34 * bw), kit);
    torso.position.y = 1.18 * h; body.add(torso);
    const chest = new THREE.Group(); chest.position.y = shoulder; body.add(chest);
    const upperArmL = joint(chest, kit, 0.15, 0.32 * h, 0.15, 0.40 * bw, 0);
    const foreArmL = joint(upperArmL, skin, 0.13, 0.30 * h, 0.13, 0, -0.32 * h);
    const upperArmR = joint(chest, kit, 0.15, 0.32 * h, 0.15, -0.40 * bw, 0);
    const foreArmR = joint(upperArmR, skin, 0.13, 0.30 * h, 0.13, 0, -0.32 * h);
    // neck, head, hair, number
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.13, 8), skin); neck.position.y = 1.6 * h; body.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 14), skin);
    head.scale.set(0.92, 1.06, 0.98); head.position.y = 1.78 * h; body.add(head);
    const hairm = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), hair);
    hairm.scale.set(1, 0.62, 1); hairm.position.y = 1.86 * h; body.add(hairm);
    const spr = numberSprite(p.num, p.team === 0 ? '#241a00' : '#eef2ff', p.team === 0 ? '#F5C518' : '#2b3a67');
    spr.position.y = 2.7 * h; spr.scale.set(1.5, 0.8, 1); body.add(spr);
    g.userData = { body, thighL, shinL, thighR, shinR, upperArmL, foreArmL, upperArmR, foreArmR, isGK: p.isGK };
    return g;
  }
  function runCycle(u, phase, spd) {
    const amp = Math.min(1, spd / 6.5);
    u.thighL.rotation.z = Math.sin(phase) * 0.95 * amp;
    u.thighR.rotation.z = Math.sin(phase + Math.PI) * 0.95 * amp;
    u.shinL.rotation.z = -Math.max(0, Math.sin(phase + 1.0)) * 1.3 * amp - 0.08 * amp;
    u.shinR.rotation.z = -Math.max(0, Math.sin(phase + Math.PI + 1.0)) * 1.3 * amp - 0.08 * amp;
    u.upperArmL.rotation.set(0, 0, Math.sin(phase + Math.PI) * 0.75 * amp);
    u.upperArmR.rotation.set(0, 0, Math.sin(phase) * 0.75 * amp);
    u.foreArmL.rotation.z = -0.4 - 0.35 * amp;
    u.foreArmR.rotation.z = -0.4 - 0.35 * amp;
    u.body.position.y = Math.abs(Math.sin(phase)) * 0.06 * amp;
    u.body.rotation.set(0, 0, -0.16 * amp);   // lean forward into the run
  }
  function poseGK(p, u, g) {
    g.rotation.y = (p.team === 0 ? 0 : Math.PI);   // keeper faces the pitch
    const k = Math.min(1, (p.gkDiveT || 0) / 0.6);
    if (k > 0.01) {                                // DIVE / SAVE
      const side = p.gkDiveSide || 1;
      u.body.rotation.set(0, 0, 0); u.body.rotation.x = -side * 1.3 * k; u.body.position.y = 0.55 * k;
      u.upperArmL.rotation.set(-1.5 * k, 0, 0.5); u.upperArmR.rotation.set(-1.5 * k, 0, -0.5);
      u.foreArmL.rotation.z = -0.2; u.foreArmR.rotation.z = -0.2;
      u.thighL.rotation.z = 0.15; u.thighR.rotation.z = 0.15; u.shinL.rotation.z = -0.25; u.shinR.rotation.z = -0.25;
    } else {                                       // READY crouch, arms spread
      u.body.rotation.set(0, 0, 0); u.body.position.y = 0;
      u.thighL.rotation.z = 0.36; u.thighR.rotation.z = 0.36; u.shinL.rotation.z = -0.62; u.shinR.rotation.z = -0.62;
      u.upperArmL.rotation.set(-0.7, 0, 0.55); u.upperArmR.rotation.set(-0.7, 0, -0.55);
      u.foreArmL.rotation.z = -0.5; u.foreArmR.rotation.z = -0.5;
    }
  }

  function buildTeams(players) {
    for (const g of groups) { scene.remove(g); disposeGroup(g); }
    groups = [];
    for (const p of players) { const g = buildPlayer(p); groups.push(g); scene.add(g); }
  }
  function disposeGroup(g) {
    g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }

  function frame(players, ball, active, camX, camY) {
    for (let i = 0; i < groups.length && i < players.length; i++) {
      const p = players[i], g = groups[i], u = g.userData;
      g.position.set(p.x, 0, p.y);
      const spd = Math.hypot(p.vx || 0, p.vy || 0);
      if (u && u.isGK) { poseGK(p, u, g); }
      else { g.rotation.y = -p.dir; if (u) runCycle(u, p.gait, spd); }
    }
    ball3d.position.set(ball.x, 0.55, ball.y);
    ballShadow.position.set(ball.x, 0.02, ball.y);
    ball3d.rotation.x += (ball.vy || 0) * 0.02;      // roll
    ball3d.rotation.z -= (ball.vx || 0) * 0.02;
    const a = players[active];
    if (a && a.team === 0) { ring.visible = true; ring.position.set(a.x, 0.06, a.y); }
    else ring.visible = false;

    camera.position.set(camX, 27, camY + 31);
    camera.lookAt(camX, 0.5, camY - 3);
    renderer.render(scene, camera);
  }

  function resize(cssW, cssH, dpr) {
    if (!ready) return;
    renderer.setPixelRatio(dpr || 1);
    renderer.setSize(cssW, cssH, false);
    camera.aspect = cssW / cssH;
    camera.updateProjectionMatrix();
  }

  return { init: init, buildTeams: buildTeams, frame: frame, resize: resize, ready: function () { return ready; } };
})();
