// Serve the project ROOT (so models/ is NOT next to play.html) → simulates the
// single-file artifact where GLB binaries can't be co-hosted. Must fall back to
// procedural players and stay fully playable with no fatal errors.
import { spawn } from 'node:child_process';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = path.resolve('.'); const PORT = 5196;
const srv = http.createServer((req,res)=>{ let f=decodeURIComponent(req.url.split('?')[0]); if(f==='/')f='/play.html';
  const fp=path.join(ROOT,f); if(!fp.startsWith(ROOT)||!fs.existsSync(fp)){res.writeHead(404);return res.end('nf');}
  res.writeHead(200,{'content-type':'text/html'}); fs.createReadStream(fp).pipe(res); }).listen(PORT);
await new Promise(r=>setTimeout(r,300));
const CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ ...(fs.existsSync(CHROME)?{executablePath:CHROME}:{}),
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const pg = await b.newPage({ viewport:{width:900,height:520} });
const fatal=[]; pg.on('pageerror',e=>fatal.push(String(e.message||e)));
await pg.goto(`http://localhost:${PORT}/play.html`,{waitUntil:'load',timeout:30000});
await pg.waitForFunction('window.Scene3D && Scene3D.ready()',{timeout:20000});
await pg.waitForTimeout(1500);
await pg.click('#btnPlay'); await pg.waitForTimeout(1500);
const D = await pg.evaluate('window.Scene3D.debugState()');
console.log('glbFailed(expected true):',D.glbFailed,'| glbPlayers(expected 0):',D.glbPlayers,'| groups:',D.groups);
console.log('fatal page errors:',fatal.length, fatal.slice(0,3));
const ok = D.glbFailed===true && D.groups===22 && D.glbPlayers===0 && fatal.length===0;
console.log('FALLBACK '+(ok?'PASSED — procedural players, playable, no fatal errors':'FAILED'));
await b.close(); srv.close(); process.exit(ok?0:1);
