// Full integration test: boot the real game (index.html), start a match,
// verify 11 blue + 11 red GLB players spawn, animate, and the match runs
// without console/page errors. Measures rAF FPS (SwiftShader — software).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const EXE = fs.existsSync(CHROME) ? { executablePath: CHROME } : {};

const PORT = 5197;
const server = spawn('node', ['serve.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 700));

const browser = await chromium.launch({
  ...EXE,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e.message || e)));
page.on('response', res => { if (res.status() >= 400 && !/favicon/.test(res.url())) errors.push('http ' + res.status() + ' ' + res.url()); });

let code = 0;
try {
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load', timeout: 30000 });
  // wait for the two GLB models to finish loading
  await page.waitForFunction('window.Scene3D && Scene3D.ready() && Scene3D.debugState().glbReady === true', { timeout: 40000 });
  // start a match
  await page.click('#btnPlay');
  await page.waitForTimeout(500);
  // collect clips over ~8s of real play, actively pressing pass/shoot so the
  // one-shot PassRight/KickRight clips deterministically fire.
  const observed = {};
  for (let i = 0; i < 200; i++) {
    const live = await page.evaluate('window.Scene3D.debugState().liveClips');
    for (const k in live) observed[k] = (observed[k] || 0) + 1;
    await page.keyboard.press('j');                    // pass every tick (fires whenever team 0 has the ball)
    if (i % 7 === 0) await page.keyboard.press('l');    // shoot
    if (i % 5 === 0) await page.keyboard.press('k');    // through-ball
    await page.waitForTimeout(60);
  }
  // Deterministic mapping probe: drive the REAL 22 cloned mixers via
  // Scene3D.frame() with synthetic per-player action states and read back the
  // live clip each actor switched to. Exercises driveGLB's actual code path.
  const mapping = await page.evaluate(() => {
    const n = window.Scene3D.debugState().glbPlayers;
    const mk = (patch) => Array.from({ length: n }, (_, i) => Object.assign(
      { x: 40 + i, y: 36, dir: 0, vx: 0, vy: 0, team: i < n / 2 ? 0 : 1,
        celebrateT: 0, gkDiveT: 0, slide: 0, act: null }, patch));
    const ball = { x: 55, y: 36, vx: 0, vy: 0 };
    const probe = (patch) => {
      const ps = mk(patch);
      window.Scene3D.frame(ps, ball, -1, 55, 36);   // one frame to switch actions
      window.Scene3D.frame(ps, ball, -1, 55, 36);
      return window.Scene3D.debugState().liveClips;
    };
    return {
      pass:      probe({ act: 'pass' }),
      shot:      probe({ act: 'shot' }),
      cross:     probe({ act: 'cross' }),
      celebrate: probe({ celebrateT: 1.5 }),
      gksave:    probe({ gkDiveT: 0.6 }),
      idle:      probe({}),
    };
  });
  console.log('\n=== ANIMATION MAPPING (deterministic, real mixers) ===');
  for (const k of ['pass', 'shot', 'cross', 'celebrate', 'gksave', 'idle'])
    console.log(k.padEnd(10), '→', JSON.stringify(mapping[k]));

  const D = await page.evaluate('window.Scene3D.debugState()');

  // software-rasteriser FPS (SwiftShader) — NOT representative of a real GPU
  const fps = await page.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    (function tick(){ n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(+(n * 1000 / (performance.now() - t0)).toFixed(2)); })();
  }));

  await page.screenshot({ path: 'glb_match_shot.png' });

  console.log('\n=== IN-GAME DIAGNOSTICS ===');
  console.log('glbReady:', D.glbReady, '| glbFailed:', D.glbFailed);
  console.log('GLB players on pitch:', D.glbPlayers, '| goalkeepers:', D.teams.gk, '| outfield:', D.teams.field);
  console.log('draw calls:', D.drawCalls, '| triangles rendered:', D.triangles);
  console.log('clips observed during play:', Object.keys(observed).join(', '));
  console.log('total Scene3D.frame() renders during match:', D.frames);
  console.log('distinct clips seen across live sampling:', Object.keys(observed).length);
  console.log('rAF FPS (SwiftShader software — NOT a real-GPU figure):', fps);
  if (errors.length) console.log('errors:', errors);

  const checks = [
    ['GLB models loaded (not fallback)', D.glbReady === true && D.glbFailed === false],
    ['exactly 22 GLB players', D.glbPlayers === 22],
    ['2 goalkeepers', D.teams.gk === 2],
    ['20 outfield players', D.teams.field === 20],
    ['Idle clip seen in live play', !!observed.Idle],
    ['Run clip seen in live play', !!observed.Run],
    ['pass → PassRight (mapping)', !!mapping.pass.PassRight],
    ['shot → KickRight (mapping)', !!mapping.shot.KickRight],
    ['cross → KickRight (mapping)', !!mapping.cross.KickRight],
    ['celebrate → Celebrate (mapping)', !!mapping.celebrate.Celebrate],
    ['gk dive → GK_Save_Left on keepers (mapping)', (mapping.gksave.GK_Save_Left || 0) >= 2],
    ['no console/page errors', errors.length === 0],
    ['render loop advanced through match (frames & changing clips)', D.frames > 15 && Object.keys(observed).length >= 3],
  ];
  console.log('\n=== CHECKS ===');
  let ok = true;
  for (const [n, p] of checks) { console.log((p ? 'PASS' : 'FAIL') + ' — ' + n); if (!p) ok = false; }
  console.log('\nINTEGRATION ' + (ok ? 'PASSED' : 'FAILED'));
  code = ok ? 0 : 1;
} catch (e) {
  console.error('integration test crashed:', e.message);
  console.error('errors:', errors);
  code = 2;
} finally {
  await browser.close();
  server.kill();
}
process.exit(code);
