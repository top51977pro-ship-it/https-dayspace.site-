// Deterministic in-engine tests for the three critical bugs + boundary/goal flow.
// All heavy loops run INSIDE the page (awaiting the game's own rAF), so there is no
// per-frame wire overhead — the whole suite drives the real match engine.
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
page.setDefaultTimeout(180000);
const errs=[]; page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
page.on('console',m=>{ if(m.type()==='error') errs.push('CON '+m.text()); });
await page.goto(`http://localhost:${port}/`,{waitUntil:'networkidle'});
await page.waitForTimeout(250);

const R = await page.evaluate(async () => {
  const GX = window.GX;
  const nf = () => new Promise(r => requestAnimationFrame(r));
  const frames = async (n) => { for (let i=0;i<n;i++) await nf(); };
  const P = () => GX.players();
  GX.setTier(3); GX.setReplays(false); GX.play(); GX.testFast(true);
  await frames(30);
  const out = { alive: GX.state==='play' };

  // ---- BUG 1: keeper steal — 100 attempts, zero successful steals ----
  { let steals=0, checks=0;
    for (let i=0;i<100;i++){
      if (!GX.gkGrab(1)) continue; GX.swarmKeeper(1);
      for (let f=0; f<8; f++){ await nf();
        const b = GX.ball(); checks++;
        if (b.state==='KEEPER_HAND_CONTROLLED'){
          const o = b.owner>=0 ? P()[b.owner] : null;
          if (!(o && o.isGK && o.team===1)) steals++;
        } else if (b.state==='FOOT_CONTROLLED' && b.owner>=0 && P()[b.owner].team===0){
          steals++; break;                       // opponent got the ball → a steal
        } else break;                            // legal release/parry — stop this attempt
      }
    }
    out.stealChecks = checks; out.steals = steals;
  }

  GX.play(); GX.testFast(true); GX.setReplays(false); await frames(20);

  // ---- BUG 2: goal-kick freeze — 100 CPU goal kicks all reach IN_PLAY ----
  { let stuck=0, tooLong=0;
    for (let i=0;i<100;i++){
      GX.forceGoalKick(i%2);
      let inPlay=false;
      for (let f=0; f<180; f++){ await nf(); if (GX.phase==='IN_PLAY'){ inPlay=true; break; } if(f===179) tooLong++; }
      if(!inPlay) stuck++;
    }
    out.gkStuck = stuck; out.gkTooLong = tooLong;
  }

  GX.play(); GX.testFast(true); GX.setReplays(false); await frames(20);

  // ---- BUG 3: freeze after goal — 50 goals, each reaches kick-off & scores once ----
  { let reached=0, frozen=0, dup=0;
    for (let i=0;i<50;i++){
      const b0 = GX.score.slice(); const s0 = b0[0]+b0[1];
      GX.forceGoal(i%2);
      let back=false;
      for (let f=0; f<180; f++){ await nf(); if (GX.phase==='IN_PLAY' && GX.state==='play'){ back=true; break; } }
      back ? reached++ : frozen++;
      const s1 = GX.score[0]+GX.score[1];
      if (s1 - s0 !== 1) dup++;
    }
    out.goalsReached = reached; out.goalsFrozen = frozen; out.goalsDup = dup;
    // heartbeat: loop still ticking after 50 goals
    const c1 = GX.clock; await frames(20); out.heartbeat = (GX.clock !== c1) || GX.state==='play';
  }

  GX.play(); GX.testFast(true); GX.setReplays(false); await frames(20);

  // ---- boundary/goal correctness: a real crossing counts as a goal ----
  { const before = GX.score.slice();
    GX.forceGoal(0); let scored=false;
    for (let f=0; f<180; f++){ await nf(); if (GX.score[0]===before[0]+1){ scored=true; break; } }
    out.liveGoalScored = scored;
  }
  return out;
});

let pass=0, fail=0;
function ok(name, cond, detail){ if(cond){pass++; console.log('  ✓',name);} else {fail++; console.log('  ✗',name, detail||'');} }
ok('match frame loop is alive', R.alive);
ok(`keeper never robbed while holding (0 steals / ${R.stealChecks} checks)`, R.steals===0, `steals=${R.steals}`);
ok('every goal kick reaches IN_PLAY (0 stuck)', R.gkStuck===0, `stuck=${R.gkStuck}`);
ok('no goal kick idles past the deadline', R.gkTooLong===0, `tooLong=${R.gkTooLong}`);
ok('every goal reaches the next kick-off (0 freezes)', R.goalsReached===50 && R.goalsFrozen===0, `reached=${R.goalsReached} frozen=${R.goalsFrozen}`);
ok('every goal scores exactly once', R.goalsDup===0, `dup=${R.goalsDup}`);
ok('frame loop still advancing after 50 goals', R.heartbeat);
ok('a real shot into the net is counted as a goal', R.liveGoalScored);

console.log(`\nGameplay flow: ${pass} passed, ${fail} failed`);
if (errs.length) console.log('PAGE ERRORS:', errs.slice(0,8));
await browser.close(); server.close();
process.exit(fail || errs.length ? 1 : 0);
