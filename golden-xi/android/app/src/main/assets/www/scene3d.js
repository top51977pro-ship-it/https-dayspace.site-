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
  function buildPlayer(p) {
    const g = new THREE.Group();
    const h = p.h3d || 1;
    const kit = mat(p.kit3d, 0.7), skin = mat(p.skin, 0.85), hair = mat(p.hair, 0.9), sh = mat(p.short3d, 0.8);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; shadow.scale.set(1.15, 1.15, 1.15); g.add(shadow);
    const legL = limb(sh, 0.24, 0.75 * h, 0.24, 0.17, 0.75 * h); g.add(legL);
    const legR = limb(sh, 0.24, 0.75 * h, 0.24, -0.17, 0.75 * h); g.add(legR);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.0 * h, 0.42), kit); torso.position.y = 1.05 * h; g.add(torso);
    const armL = limb(skin, 0.16, 0.72 * h, 0.16, 0.5, 1.42 * h); g.add(armL);
    const armR = limb(skin, 0.16, 0.72 * h, 0.16, -0.5, 1.42 * h); g.add(armR);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), skin); head.position.y = 1.8 * h; g.add(head);
    const hairm = new THREE.Mesh(new THREE.SphereGeometry(0.30, 16, 10), hair);
    hairm.scale.y = 0.6; hairm.position.y = 1.88 * h; g.add(hairm);
    const spr = numberSprite(p.num, p.team === 0 ? '#241a00' : '#eef2ff', p.team === 0 ? '#F5C518' : '#2b3a67');
    spr.position.y = 2.7 * h; spr.scale.set(1.5, 0.8, 1); g.add(spr);
    g.userData = { legL, legR, armL, armR };
    return g;
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
      const p = players[i], g = groups[i];
      g.position.set(p.x, 0, p.y);
      g.rotation.y = -p.dir;
      // running animation: swing legs/arms proportional to speed
      const spd = Math.hypot(p.vx || 0, p.vy || 0);
      const sw = Math.sin(p.gait) * Math.min(1, spd / 6) * 0.8;
      const u = g.userData;
      if (u) { u.legL.rotation.z = sw; u.legR.rotation.z = -sw; u.armL.rotation.z = -sw * 0.7; u.armR.rotation.z = sw * 0.7; }
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
