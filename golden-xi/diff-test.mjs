// Scenario: you press (autoChase) for 14s at 3 tiers. Higher tier = CPU keeps
// the ball better & defends better → your possession should fall as tier rises.
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
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
await page.goto(`http://localhost:${port}/`, { waitUntil:'networkidle' });
const TIERS = ['Beginner','Professional','Ultimate'];
for (const [i,t] of [[0,'Beginner'],[3,'Professional'],[6,'Ultimate']]){
  await page.evaluate(l => { window.GX.setTier(l); window.GX.play(); window.GX.autoChase(true); }, i);
  await page.waitForTimeout(14000);
  const poss = await page.evaluate(() => window.GX.poss);
  console.log(`${t.padEnd(13)} → YOUR possession ${poss}%`);
  await page.evaluate(() => window.GX.endSoon());
  await page.waitForTimeout(1400);
  await page.click('#btnQuit').catch(()=>{});
  await page.waitForTimeout(200);
}
await browser.close(); server.close();
