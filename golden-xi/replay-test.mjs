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
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1280,height:720}, deviceScaleFactor:1 });
const errs=[]; page.on('pageerror',e=>errs.push('PAGEERR '+e.message)); page.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text());});
await page.goto(`http://localhost:${port}/`,{waitUntil:'networkidle'});
await page.waitForTimeout(300);
await page.evaluate(()=>{ window.GX.setTier(3); window.GX.play(); });
await page.waitForTimeout(4500);          // let ~4.5s of play accumulate in recBuf

// Force a replay and capture each of the three camera segments
for (const [seg,name] of [[0,'sideLow'],[1,'behindGoal'],[2,'pov']]){
  await page.evaluate((s)=>{ window.GX.forceReplay(s); }, seg);
  await page.waitForTimeout(250);
  const info = await page.evaluate(()=>({ state:window.GX.state, seg:window.GX.replaySeg(),
    badge: !document.getElementById('replayBadge').classList.contains('hidden'),
    label: document.getElementById('replayLabel').textContent }));
  console.log(name, JSON.stringify(info));
  await page.screenshot({ path:`replay_${name}.png` });
}
console.log('ERRORS', errs.length?errs.slice(0,8):'none');
await browser.close(); server.close();
