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
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
  args:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1000,height:600} });
page.setDefaultTimeout(60000);
const errs=[]; page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
page.on('console',m=>{ if(m.type()==='error') errs.push('CON '+m.text()); });
await page.goto(`http://localhost:${port}/`,{waitUntil:'networkidle'});
await page.waitForTimeout(250);

const R = await page.evaluate(async () => {
  const GX=window.GX; const nf=()=>new Promise(r=>requestAnimationFrame(r));
  const log=[];
  GX.setTier(3); GX.setReplays(false); GX.play(); GX.testFast(true);
  for(let i=0;i<30;i++) await nf();
  log.push('after start: phase='+GX.phase+' state='+GX.state+' ballState='+GX.ballState);

  // ONE goal kick, trace how many frames to IN_PLAY
  GX.forceGoalKick(1);
  log.push('gk awarded: '+JSON.stringify(GX.restartInfo())+' phase='+GX.phase);
  let f=0; for(; f<200; f++){ await nf(); if(GX.phase==='IN_PLAY') break; }
  log.push('gk reached IN_PLAY after '+f+' frames; restartInfo='+JSON.stringify(GX.restartInfo()));

  // ONE goal, trace frames to IN_PLAY
  const s0=GX.score.slice();
  GX.forceGoal(0);
  log.push('goal fired: phase='+GX.phase+' ballState='+GX.ballState);
  let g=0; for(; g<200; g++){ await nf(); if(GX.phase==='IN_PLAY'&&GX.state==='play') break; }
  log.push('goal reached kickoff after '+g+' frames; score '+JSON.stringify(s0)+'->'+JSON.stringify(GX.score));

  // ONE steal attempt trace
  GX.gkGrab(1); GX.swarmKeeper(1);
  let held=0; for(let k=0;k<8;k++){ await nf(); if(GX.ballState==='KEEPER_HAND_CONTROLLED') held++; }
  log.push('steal test: heldFrames='+held+'/8 finalState='+GX.ballState);
  return log;
});
console.log(R.join('\n'));
if(errs.length) console.log('ERRORS', errs.slice(0,8)); else console.log('no page errors');
await browser.close(); server.close();
