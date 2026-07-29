import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('www');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/index.html';
  const fp = path.join(ROOT, f);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

// menu screenshot
await page.screenshot({ path: 'shot_menu.png' });

// start match
await page.click('#btnPlay');
await page.waitForTimeout(500);
const started = await page.evaluate(() => window.GX.state);
console.log('state after Play =', started);

// drive it: hold "right" via keyboard + press shoot a few times, let AI play ~10s
await page.keyboard.down('d');
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(900);
  // occasionally pass / shoot
  await page.keyboard.press('j');
  await page.keyboard.down('l'); await page.waitForTimeout(700); await page.keyboard.up('l');
}
await page.keyboard.up('d');
await page.waitForTimeout(300);

const snap = await page.evaluate(() => {
  const ps = window.GX.players();
  const finite = ps.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.vx));
  return { state: window.GX.state, score: window.GX.score, players: ps.length,
           allFinite: finite, sampleClock: document.getElementById('clock').textContent };
});
console.log('SNAP:', JSON.stringify(snap));
await page.screenshot({ path: 'shot_match.png' });

// verify full-time flow
await page.evaluate(() => window.GX.endSoon());
await page.waitForTimeout(1600);
const ft = await page.evaluate(() => ({
  state: window.GX.state,
  ftVisible: !document.getElementById('fulltime').classList.contains('hidden'),
  ftScore: document.getElementById('ftScore').textContent,
  motm: document.getElementById('ftMotm').textContent,
}));
console.log('FULLTIME:', JSON.stringify(ft));

console.log('ERRORS:', errors.length ? errors.slice(0,10) : 'none');

const ok = errors.length === 0 && snap.allFinite && ft.state === 'fulltime' && ft.ftVisible;
console.log(ok ? 'SMOKE PASS ✅' : 'SMOKE FAIL ❌');
await browser.close();
server.close();
process.exit(ok ? 0 : 1);
