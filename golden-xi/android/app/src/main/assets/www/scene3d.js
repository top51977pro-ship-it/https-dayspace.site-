/* ============================================================================
   Golden XI — 3D renderer (WebGL via three.js).
   Renders the SAME match simulation (game.js) in real 3D on the device GPU.
   game.js keeps world coords (x, y); here world-y maps to 3D z.
   ========================================================================== */
window.Scene3D = (function () {
  'use strict';
  let renderer, scene, camera, ready = false;
  let L, W, ball3d, ring, groups = [];

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

    // ball
    ball3d = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }));
    scene.add(ball3d);

    // active-player ring
    ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.13, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0x2fe0a0 }));
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    scene.add(ring);

    buildGoals();
    ready = true;
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
    for (const ex of [0.3, L - 0.3]) {
      const post = new THREE.BoxGeometry(0.28, 2.5, 0.28);
      const p1 = new THREE.Mesh(post, white); p1.position.set(ex, 1.25, W / 2 - half); scene.add(p1);
      const p2 = new THREE.Mesh(post, white); p2.position.set(ex, 1.25, W / 2 + half); scene.add(p2);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, gw), white);
      bar.position.set(ex, 2.5, W / 2); scene.add(bar);
    }
  }

  function mat(cssColor, rough) {
    return new THREE.MeshStandardMaterial({ color: new THREE.Color(cssColor), roughness: rough });
  }

  function buildPlayer(p) {
    const g = new THREE.Group();
    const h = p.h3d || 1;
    const kit = mat(p.kit3d, 0.7), skin = mat(p.skin, 0.85), hair = mat(p.hair, 0.9), sh = mat(p.short3d, 0.8);
    const leg = new THREE.BoxGeometry(0.22, 0.75 * h, 0.22);
    const l1 = new THREE.Mesh(leg, sh); l1.position.set(0.16, 0.38 * h, 0); g.add(l1);
    const l2 = new THREE.Mesh(leg, sh); l2.position.set(-0.16, 0.38 * h, 0); g.add(l2);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.74, 1.0 * h, 0.42), kit);
    torso.position.y = 1.05 * h; g.add(torso);
    const arm = new THREE.BoxGeometry(0.16, 0.7 * h, 0.16);
    const a1 = new THREE.Mesh(arm, skin); a1.position.set(0.5, 1.05 * h, 0); g.add(a1);
    const a2 = new THREE.Mesh(arm, skin); a2.position.set(-0.5, 1.05 * h, 0); g.add(a2);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), skin);
    head.position.y = 1.78 * h; g.add(head);
    const hairm = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 10), hair);
    hairm.scale.y = 0.6; hairm.position.y = 1.86 * h; g.add(hairm);
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
    }
    ball3d.position.set(ball.x, 0.22, ball.y);
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
