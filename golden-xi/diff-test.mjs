// Proves difficulty levels change AI possession. Runs each level with NO human
// input for ~12s and reports YOUR possession % (home). Low level → you keep more.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve('www');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml' };
const server = http.createServer((req,res)=>{ let f=decodeURIComponent(req.url.split('?')[0]);
  if(f==='/')f='/index.html'; const fp=path.join(ROOT,f);
  if(!fp.startsWith(ROOT)||!fs.existsSync(fp)){res.writeHead(404);return res.end();}
  res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'});
  fs.createReadStream(fp).pipe(res); });
await new Promise(r=>server.listen(0,r)); const port=server.address().port;
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
await page.goto(`http://localhost:${port}/`, { waitUntil:'networkidle' });
for (const lvl of [1, 6, 12]){
  await page.evaluate(l => { window.GX.setLevel(l); window.GX.play(); window.GX.autoChase(true); }, lvl);
  await page.waitForTimeout(12000);
  const poss = await page.evaluate(() => window.GX.poss);
  console.log(`Level ${String(lvl).padStart(2)} → YOUR possession ${poss}%`);
  await page.evaluate(() => { window.GX.endSoon(); });
  await page.waitForTimeout(1400);
  await page.click('#btnQuit').catch(()=>{});
  await page.waitForTimeout(200);
}
await browser.close(); server.close();
