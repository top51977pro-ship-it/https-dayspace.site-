// Empirical keeper-balance test: fire many placed shots at each difficulty tier
// and measure the goal rate. Goals must be POSSIBLE at every tier (not shut out)
// and the keeper must get HARDER as the tier rises.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve('www');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.glb':'model/gltf-binary','.json':'application/json' };
const server = http.createServer((req,res)=>{ let f=decodeURIComponent(req.url.split('?')[0]);
  if(f==='/')f='/index.html'; const fp=path.join(ROOT,f);
  if(!fp.startsWith(ROOT)||!fs.existsSync(fp)){res.writeHead(404);return res.end();}
  res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'});
  fs.createReadStream(fp).pipe(res); });
await new Promise(r=>server.listen(0,r)); const port=server.address().port;
const CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ ...(fs.existsSync(CHROME)?{executablePath:CHROME}:{}),
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:800,height:480} });
page.setDefaultTimeout(180000);
await page.goto(`http://localhost:${port}/`,{waitUntil:'load'});
await page.waitForTimeout(300);

const res = await page.evaluate(async () => {
  const GX = window.GX;
  const nf = () => new Promise(r => requestAnimationFrame(r));
  GX.setReplays(false);
  const rows = [];
  const SHOTS = 40, HALF_GOAL = 6;
  for (let tier=0; tier<7; tier++){
    GX.setTier(tier); GX.play(); GX.testFast(true);
    for (let i=0;i<10;i++) await nf();
    let goals=0, saves=0, misses=0;
    for (let s=0; s<SHOTS; s++){
      const before = GX.score[0];
      // aim at a spot inside the goal, biased to the corners where a keeper is beatable
      const corner = (Math.random()<0.5?-1:1) * (2.5 + Math.random()*3.0);   // ±2.5..5.5m from centre
      const aimY = 36 + corner;                 // W/2 = 36
      const speed = 30 + Math.random()*12;      // 30..42 m/s
      GX.setupShot(0, aimY, speed);
      let done=false;
      for (let f=0; f<70 && !done; f++){ await nf();
        if (GX.score[0] > before){ goals++; done=true; }
        else { const st = GX.ballState;
          if (st==='KEEPER_HAND_CONTROLLED'){ saves++; done=true; }
          else if (st==='DEAD_BALL' || st==='OUT_OF_PLAY' || GX.restartActive){ misses++; done=true; }
        }
      }
      if (!done) misses++;
      // reset to open play for the next shot
      GX.play(); GX.testFast(true); for (let i=0;i<6;i++) await nf();
    }
    rows.push({ tier, goals, saves, misses, goalPct: Math.round(100*goals/SHOTS) });
  }
  return rows;
});

console.log('\n=== KEEPER BALANCE (40 placed shots per tier) ===');
const names = ['Beginner','Amateur','Semi-Pro','Professional','World Class','Legendary','Ultimate'];
for (const r of res) console.log(`${names[r.tier].padEnd(13)} goals ${String(r.goals).padStart(2)}/40  (${r.goalPct}%)  saves ${r.saves}  misses ${r.misses}`);

const pcts = res.map(r=>r.goalPct);
const everyTierScorable = res.every(r=>r.goals >= 3);              // never a shut-out
const topHarderThanBottom = pcts[6] < pcts[0];                     // Ultimate saves more than Beginner
const topStillBeatable = res[6].goals >= 2;                        // but you can still score on Ultimate
console.log('\nchecks:');
console.log((everyTierScorable?'PASS':'FAIL')+' — every tier is scorable (>=3/40)');
console.log((topHarderThanBottom?'PASS':'FAIL')+' — keeper harder at Ultimate than Beginner ('+pcts[0]+'% → '+pcts[6]+'%)');
console.log((topStillBeatable?'PASS':'FAIL')+' — Ultimate keeper still beatable (>=2/40)');
const ok = everyTierScorable && topHarderThanBottom && topStillBeatable;
console.log('\nKEEPER '+(ok?'PASSED':'FAILED'));
await browser.close(); server.close(); process.exit(ok?0:1);
