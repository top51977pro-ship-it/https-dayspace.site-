// Headless pilot: verify GLB load + rig-safe clone + per-actor mixers + all 7 clips.
// WebGL runs on SwiftShader (software) in headless Chromium — correctness, not device FPS.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const EXE = fs.existsSync(CHROME) ? { executablePath: CHROME } : {};

const PORT = 5199;
const server = spawn('node', ['serve.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 700));

const browser = await chromium.launch({
  ...EXE,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
const consoleErrors = [];
// Ignore the generic "Failed to load resource" line (no URL); the response
// listener below reports real >=400 URLs (favicon excluded).
page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) consoleErrors.push(m.text()); });
page.on('requestfailed', r => { if (!/favicon/.test(r.url())) consoleErrors.push('reqfail ' + r.url()); });
page.on('response', res => { if (res.status() >= 400 && !/favicon/.test(res.url())) consoleErrors.push('http ' + res.status() + ' ' + res.url()); });
page.on('pageerror', e => consoleErrors.push(String(e.message || e)));

let exitCode = 0;
try {
  await page.goto(`http://localhost:${PORT}/pilot.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction('window.__PILOT && window.__PILOT.done === true', { timeout: 30000 });
  await page.waitForTimeout(3500);           // let the state machine cycle + fps settle
  const D = await page.evaluate('window.__PILOT');
  await page.screenshot({ path: 'pilot_shot.png' });

  const wanted = ['Idle','Run','PassRight','KickRight','TackleSlide','Celebrate','GK_Save_Left'];
  const checks = [
    ['both GLB loaded', D.loaded === true && D.errors.length === 0],
    ['blue has all 7 clips', D.checks.blueHasAllClips === true],
    ['red has all 7 clips', D.checks.redHasAllClips === true],
    ['blue skinned meshes > 0', D.checks.blueSkinned > 0],
    ['red skinned meshes > 0', D.checks.redSkinned > 0],
    ['clones have independent skeletons', D.checks.independentSkeletons === true],
    ['clones share geometry buffers', D.checks.sharedGeometry === true],
    ['no page/console errors', D.errors.length === 0 && consoleErrors.length === 0],
    ['render loop producing frames (fps>0)', D.fps > 0],
  ];
  console.log('\n=== PILOT DIAGNOSTICS ===');
  console.log('blue clips:', D.clips.blue?.join(', '));
  console.log('red  clips:', D.clips.red?.join(', '));
  console.log('blue skinned meshes:', D.checks.blueSkinned, '| red skinned meshes:', D.checks.redSkinned);
  console.log('fps (software rasteriser):', D.fps);
  if (D.errors.length) console.log('errors:', D.errors);
  if (consoleErrors.length) console.log('console errors:', consoleErrors);
  console.log('\n=== CHECKS ===');
  let ok = true;
  for (const [name, pass] of checks) { console.log((pass ? 'PASS' : 'FAIL') + ' — ' + name); if (!pass) ok = false; }
  console.log('\nPILOT ' + (ok ? 'PASSED' : 'FAILED'));
  exitCode = ok ? 0 : 1;
} catch (e) {
  console.error('pilot crashed:', e.message);
  console.error('console errors:', consoleErrors);
  exitCode = 2;
} finally {
  await browser.close();
  server.kill();
}
process.exit(exitCode);
