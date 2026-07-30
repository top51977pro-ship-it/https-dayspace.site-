/* ============================================================================
   GOLDEN XI — Ultimate Football  (self-contained HTML5 match engine)
   All teams, players and crests are ORIGINAL & FICTIONAL by design.
   Landscape football: virtual joystick + PASS/THROUGH/SHOOT/SPRINT.
   12 difficulty levels (saved), premium 2.5D presentation.
   ========================================================================== */
(() => {
'use strict';

// ---------------------------------------------------------------- constants
const L = 110, W = 72;              // pitch size in metres
const GOAL_W = 12, HALF_GOAL = GOAL_W / 2;
const BOX_W = 40, BOX_D = 18;
const SIX_W = 20, SIX_D = 7;
const MATCH_SECS = 180;
const VIEW_H = 44;
const DT = 1 / 60;

const SPD_WALK = 7.2, SPD_SPRINT = 10.6, SPD_GK = 6.4;
const ACCEL = 42;
const BALL_FRICTION = 0.62;
const CONTROL_R = 1.5, DRIBBLE_LEAD = 1.0, TACKLE_R = 1.35;
const KICK_COOLDOWN = 0.28;

const COL = { pass:'#2F80ED', through:'#E0A400', shoot:'#E4572E', sprint:'#27AE60', gold:'#F5C518' };

// ---------------------------------------------------------------- difficulty (FC 7-tier, ai.js)
const TIERS = GXAI.TIERS, TIER_DESC = GXAI.TIER_DESC, NTIERS = 7;
let tierIndex = 3;                  // 0..6 → Beginner..Ultimate (Professional default)
let bestBeat = -1;                  // highest tier index beaten
const SETTINGS = {
  playerBased:false, competitor:false, preset:'Custom', debug:false,
  sliders:{ tackleAggression:50, buildupSpeed:50, shotFrequency:50,
            firstTouchPass:50, crossing:50, dribble:50, skillMove:50 },
};
function loadProgress(){
  try {
    tierIndex = clamp(parseInt(localStorage.getItem('gx_tier')||'3',10),0,6);
    bestBeat  = clamp(parseInt(localStorage.getItem('gx_best')||'-1',10),-1,6);
    const s = JSON.parse(localStorage.getItem('gx_settings')||'null');
    if (s){ SETTINGS.playerBased=!!s.playerBased; SETTINGS.competitor=!!s.competitor;
      SETTINGS.preset=s.preset||'Custom'; SETTINGS.debug=!!s.debug;
      if (s.sliders) Object.assign(SETTINGS.sliders, s.sliders); }
  } catch(e){}
}
function saveProgress(){
  try { localStorage.setItem('gx_tier', String(tierIndex));
        localStorage.setItem('gx_best', String(bestBeat));
        localStorage.setItem('gx_settings', JSON.stringify(SETTINGS)); } catch(e){}
}

// ---------------------------------------------------------------- teams
const NAMES = ['Russo','Vance','Okafor','Bianchi','Alvarez','Novak','Sato','Halvorsen','Mensah',
  'Petrov','Costa','Dubois','Larsen','Kim','Reyes','Ferro','Nakamura','Adeyemi','Sorensen',
  'Marchetti','Volkov','Osei','Lindqvist','Baros'];
const SKINS = ['#f1c9a5','#e0a878','#c98a56','#a9683b','#8a4e2a','#6d3b1f'];
const HAIRS = ['#140f0a','#2e2013','#0d0d10','#5a3a1e','#c9a24a','#7a4a28'];

const HOME = { name:'Golden XI', abbr:'GXI', crest:'GX', kit:'#F5C518', kit2:'#c99a00',
               num:'#241a00', short:'#141414', crestBg:'#b8860b', gk:'#12d6c2' };   // bright teal keeper
const AWAY = { name:'Kestrel United', abbr:'KES', crest:'KS', kit:'#2b3a67', kit2:'#1a2340',
               num:'#eef2ff', short:'#e9edf7', crestBg:'#1a2340', gk:'#ff2fa0' };   // bright pink keeper

const FORMATION = [
  {x:0.05,y:0.50,role:'GK'},
  {x:0.20,y:0.16,role:'DF'},{x:0.16,y:0.38,role:'DF'},{x:0.16,y:0.62,role:'DF'},{x:0.20,y:0.84,role:'DF'},
  {x:0.44,y:0.30,role:'MF'},{x:0.42,y:0.50,role:'MF'},{x:0.44,y:0.70,role:'MF'},
  {x:0.74,y:0.16,role:'FW'},{x:0.82,y:0.50,role:'FW'},{x:0.74,y:0.84,role:'FW'},
];

// ---------------------------------------------------------------- state
let canvas, ctx, radar, rctx, DPR = 1, crowdPat = null;
let state = 'menu';
let players = [], ball, cam = { x:L/2, y:W/2 };
let score = [0,0], clock = MATCH_SECS, kickTeam = 0;
let lastTouch = 0, active = 10, lastActiveSwitch = 0;
let restartLock = 0, secondHalf = false;
const touchCount = [0,0]; let possFrames = [0,0];
let acc = 0, lastT = 0, aiDecideCd = 0;
const fx = { flash:0, parts:[], shake:0 };

const move = { x:0, y:0, mag:0 };
const held = { sprint:false, shoot:false };
let shootStart = 0, shootCharge = 0, skillFlash = 0, autoChase = false;

// ---------------------------------------------------------------- helpers
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
const lerp = (a,b,t) => a + (b - a) * t;
const dist = (a,b) => Math.hypot(a.x - b.x, a.y - b.y);
const len = (x,y) => Math.hypot(x,y);
function norm(x,y){ const m = Math.hypot(x,y) || 1; return { x:x/m, y:y/m }; }
const $ = id => document.getElementById(id);
function goalX(team){ return team === 0 ? L : 0; }

// ---------------------------------------------------------------- setup match
function homePos(team, f){
  const attackRight = (team === 0);
  const nx = attackRight ? f.x : (1 - f.x);
  const ny = attackRight ? f.y : (1 - f.y);
  return { x: nx * L, y: ny * W };
}
function makeTeam(team){
  const arr = [];
  for (let i = 0; i < 11; i++){
    const f = FORMATION[i]; const p = homePos(team, f);
    const tc = team===0?HOME:AWAY, gk = f.role==='GK';
    const ratings = GXAI.makeRatings(f.role, (team*101 + i*7919 + 13) >>> 0);
    arr.push({ team, idx:i, role:f.role, form:f, x:p.x, y:p.y, vx:0, vy:0,
      dir:(team===0?0:Math.PI), isGK:gk, num:i===0?1:i+1,
      name:NAMES[(team*11 + i) % NAMES.length], skin:SKINS[(team*7+i)%SKINS.length],
      hair:HAIRS[(team*5+i*3)%HAIRS.length],
      kit3d: gk ? tc.gk : tc.kit, short3d: gk ? '#161616' : tc.short,
      h3d: 0.9 + (((team*11+i)*37) % 22) / 100,
      ratings, ovr:ratings.ovr, profile:null, ai:null, aiNext:0, decideInterval:0.27,
      tackleCd:0, stamina:1, slide:0, gait:Math.random()*6.28 });
  }
  return arr;
}
function resetPositions(kick){
  secondHalf = false;
  players = [...makeTeam(0), ...makeTeam(1)];
  ball = { x:L/2, y:W/2, vx:0, vy:0, owner:-1, kickCd:0 };
  const g = players.filter(p => p.team === kick);
  const taker = g[9]; taker.x = L/2 - (kick===0?1.2:-1.2); taker.y = W/2;
  ball.owner = players.indexOf(taker); lastTouch = kick;
  active = kick === 0 ? players.indexOf(taker) : nearestHomeToBall();
  restartLock = 0.6; cam.x = L/2; cam.y = W/2;
}
function nearestHomeToBall(){
  let best = -1, bd = 1e9;
  for (let i = 0; i < 22; i++){ const p = players[i];
    if (p.team !== 0 || p.isGK) continue;
    const d = dist(p, ball); if (d < bd){ bd = d; best = i; } }
  return best < 0 ? 10 : best;
}
function teamInPossession(){ return ball.owner >= 0 ? players[ball.owner].team : -1; }
function ballOwner(){ return ball.owner >= 0 ? players[ball.owner] : null; }
// ---------------------------------------------------------------- AI wiring (ai.js)
let simTime = 0, brainAcc = 1, st0 = null, st1 = null, stats0 = null, stats1 = null;
let cpuTeamProfile = null, userTeamProfile = null;
function buildWorld(){
  return { players, ball, L, W, goalW:GOAL_W, time:simTime, clock,
           matchSecs:MATCH_SECS, score, possTeam:teamInPossession() };
}
// Assign an effective difficulty profile to every player at kickoff.
// CPU (team 1) = selected tier (+Player-Based shifts); your team (0) = steady Professional.
function assignProfiles(){
  GXAI.setConfig({ tierIndex, playerBased:SETTINGS.playerBased, competitor:SETTINGS.competitor,
                   preset:SETTINGS.preset, sliders:SETTINGS.sliders, debug:SETTINGS.debug,
                   identity: pickIdentity() });
  cpuTeamProfile  = GXAI.profileByIndex(tierIndex);
  userTeamProfile = GXAI.PROFILES['Professional'];
  stats0 = GXAI.squadStats(players, 0);
  stats1 = GXAI.squadStats(players, 1);
  for (const p of players){
    if (p.team === 1){
      const ti = GXAI.effectiveTierIndex(p, tierIndex, stats1);
      p.profile = GXAI.profileByIndex(ti);
      GXAI.starTechnicalBoost(p, stats1);
    } else {
      p.profile = userTeamProfile;
    }
    p.decideInterval = p.profile.decisionIntervalMs / 1000;
    p.aiNext = p.idx * 0.017;        // stagger decisions across frames
    p.ai = null;
  }
  st0 = st1 = null; brainAcc = 1;
}
function pickIdentity(){
  if (SETTINGS.preset === 'Custom') return 'Balanced';
  const ids = ['Possession','Counterattack','Wing Play','High Press','Balanced','Low Block'];
  return ids[(tierIndex + 2) % ids.length];   // deterministic per tier for Tactical/Dynamic
}
function nearestOpponentTo(p, team){
  let best = null, bd = 1e9;
  for (const q of players){ if (q.team === team || q.isGK) continue;
    const d = dist(p, q); if (d < bd){ bd = d; best = q; } }
  return { p:best, d:bd };
}
function nearestPlayerToBall(team){
  let best = null, bd = 1e9;
  for (const q of players){ if (team >= 0 && q.team !== team) continue;
    if (q.isGK) continue;
    const d = dist(q, ball); if (d < bd){ bd = d; best = q; } }
  return best;
}
function rankByBall(team){
  return players.filter(q => q.team === team && !q.isGK)
                .sort((a,b) => dist(a,ball) - dist(b,ball));
}

function step(dt){
  simTime += dt;
  if (restartLock > 0) restartLock -= dt;
  ball.kickCd = Math.max(0, ball.kickCd - dt);
  skillFlash = Math.max(0, skillFlash - dt);
  fx.flash = Math.max(0, fx.flash - dt*1.6);
  fx.shake = Math.max(0, fx.shake - dt*3);

  const world = buildWorld();
  GXAI.tick(world, dt);

  if (teamInPossession() === 0){ active = ball.owner; }
  else if (performance.now()/1000 - lastActiveSwitch > 0.4){ active = nearestHomeToBall(); }

  // TeamBrain layer at ~4 Hz (formation shape, presser/cover, marking, phase, tactics)
  brainAcc += dt;
  if (brainAcc >= 0.25 || !st1){
    brainAcc = 0;
    st0 = GXAI.teamBrain(world, 0, userTeamProfile, stats0);
    st1 = GXAI.teamBrain(world, 1, cpuTeamProfile, stats1);
  }

  const possTeam = teamInPossession();
  for (const p of players){
    p.tackleCd = Math.max(0, p.tackleCd - dt);
    if (p.slide) p.slide = Math.max(0, p.slide - dt);
    let tgt, sprint = false;

    if (p.idx === active && p.team === 0 && restartLock <= 0){
      if (move.mag > 0.12){ tgt = { x:p.x + move.x*10, y:p.y + move.y*10 }; sprint = held.sprint; }
      else if (autoChase){ tgt = { x:ball.x, y:ball.y }; sprint = true; }   // test-only pressing
      else tgt = { x:p.x, y:p.y };
    } else if (p.isGK){
      tgt = GXAI.gkTarget(p, world, p.profile);
      sprint = dist(p, ball) < 12 && teamInPossession() !== p.team;
    } else {
      // PlayerBrain layer, staggered by profile decision interval (ball carrier decides faster)
      const carrier = (ball.owner === p.team*11 + p.idx);
      const interval = carrier ? Math.min(p.decideInterval, 0.11) : p.decideInterval;
      if (simTime >= (p.aiNext || 0) || !p.ai){
        GXAI.decide(p, world, p.profile, p.team === 1 ? st1 : st0);
        p.aiNext = simTime + interval;
      }
      tgt = { x:p.ai.tx, y:p.ai.ty }; sprint = p.ai.sprint;
    }

    const d = norm(tgt.x - p.x, tgt.y - p.y);
    const arriving = len(tgt.x - p.x, tgt.y - p.y) < 0.6;
    // PHYSICAL speed comes from player attributes + sprint/stamina — NEVER from difficulty.
    const maxSpd = GXAI.speedFromAttributes(p, sprint && p.stamina > 0.05);
    const desVx = arriving ? 0 : d.x * maxSpd;
    const desVy = arriving ? 0 : d.y * maxSpd;
    p.vx += clamp(desVx - p.vx, -ACCEL*dt, ACCEL*dt);
    p.vy += clamp(desVy - p.vy, -ACCEL*dt, ACCEL*dt);
    p.x = clamp(p.x + p.vx*dt, 0.5, L-0.5);
    p.y = clamp(p.y + p.vy*dt, 0.5, W-0.5);
    const spd = len(p.vx, p.vy);
    if (spd > 0.4) p.dir = Math.atan2(p.vy, p.vx);
    p.gait += spd * dt * 1.1;
    const stam = ((p.ratings && p.ratings.stamina) || 70) / 100;
    if (sprint && spd > 3) p.stamina = clamp(p.stamina - dt*(0.13 - 0.06*stam), 0, 1);
    else p.stamina = clamp(p.stamina + dt*0.05, 0, 1);
  }

  executeOwnerAction(world);
  tackling(world);
  updateBall(dt);
  cameraFollow(dt);
  if (possTeam >= 0) possFrames[possTeam]++;
  updateFX(dt);
}

// -------------------------------------------------- action execution (CPU/AI on-ball)
function executeOwnerAction(world){
  const owner = ballOwner();
  if (!owner || owner.isGK) return;
  if (owner.team === 0 && owner.idx === active) return;   // human on the ball
  const act = owner.ai && owner.ai.action;
  if (!act) return;
  const prof = owner.profile || userTeamProfile;
  const since = simTime - (ball.lastAct || 0);
  if (act.kind === 'shoot'){ if (since > 0.22){ cpuShoot(owner, prof); owner.ai.action = null; } }
  else if (act.kind === 'clear'){ if (since > 0.3){ cpuClear(owner); owner.ai.action = null; } }
  else if (act.target && (act.kind==='shortPass'||act.kind==='longPass'||act.kind==='throughPass'||act.kind==='cross')){
    if (since > prof.decisionIntervalMs/1000){ cpuPass(owner, act.target, act.kind, prof); owner.ai.action = null; }
  }
  // carry / shield / dribble → handled by movement target, no discrete kick
}
function cpuPass(owner, to, kind, prof){
  const through = kind==='throughPass'||kind==='longPass', cross = kind==='cross';
  const lead = through ? 6 : cross ? 4 : 2;
  let tx = to.x + (to.vx||0)*lead*0.12, ty = to.y + (to.vy||0)*lead*0.12;
  let dir = norm(tx - owner.x, ty - owner.y);
  const opp = nearestOpponentTo(owner, owner.team);
  const wf = (owner.ratings && owner.ratings.weakFoot || 3) <= 2 && Math.random() < 0.3;
  const sigma = GXAI.passAngleSigma(owner, prof, { long: through||cross, pressure: opp.d < 2.6, weakFoot: wf, badBody:false });
  const ang = Math.atan2(dir.y, dir.x) + GXAI._randn()*sigma;
  dir = { x:Math.cos(ang), y:Math.sin(ang) };
  const dd = Math.hypot(tx-owner.x, ty-owner.y);
  const speed = clamp((through?15:cross?24:12) + dd*0.55, 12, cross?30:through?34:30);
  fireBall(owner, dir, speed); ball.kickCd = KICK_COOLDOWN; touchCount[owner.team]++; ball.lastAct = simTime;
}
function cpuShoot(owner, prof){
  const gx = goalX(owner.team), gy = W/2;
  const opp = nearestOpponentTo(owner, owner.team);
  const sigmaM = GXAI.shotPlacementError(owner, prof, { pressure: opp.d < 2.6, weakFoot:false });
  const aimY = gy + GXAI._randn()*sigmaM;                 // unclamped → poor finishers miss the target
  const dir = norm(gx - owner.x, aimY - owner.y);
  const power = 0.6 + Math.random()*0.35;
  fireBall(owner, dir, clamp(24 + power*20, 24, 46)); ball.kickCd = KICK_COOLDOWN;
  touchCount[owner.team]++; ball.lastAct = simTime;
}
function cpuClear(owner){
  const gx = goalX(owner.team);
  fireBall(owner, norm(gx - owner.x, (Math.random()*2-1)*0.6), 30);
  ball.kickCd = KICK_COOLDOWN; ball.lastAct = simTime;
}

// -------------------------------------------------- human pass helper (kept)
function bestPassTarget(owner){
  const gx = goalX(owner.team);
  let best = null, bs = -1e9;
  for (const q of players){
    if (q.team !== owner.team || q === owner || q.isGK) continue;
    const forward = (gx - q.x) * (owner.team === 0 ? 1 : -1);
    const d = dist(owner, q); if (d < 4 || d > 42) continue;
    let laneRisk = 0;
    for (const e of players){ if (e.team === owner.team) continue;
      const t = projT(owner, q, e); if (t > 0.1 && t < 0.9){
        const px = lerp(owner.x, q.x, t), py = lerp(owner.y, q.y, t);
        if (Math.hypot(e.x-px, e.y-py) < 2.2) laneRisk += 6; } }
    const sc = forward*0.6 - laneRisk - Math.abs(q.y - owner.y)*0.05 - (d>28?4:0);
    if (sc > bs){ bs = sc; best = q; }
  }
  return best;
}
function projT(a,b,p){ const dx=b.x-a.x, dy=b.y-a.y; const l2=dx*dx+dy*dy||1;
  return ((p.x-a.x)*dx + (p.y-a.y)*dy)/l2; }

// -------------------------------------------------- tackling (attribute + timing based)
function tackling(world){
  const owner = ballOwner();
  if (!owner || ball.kickCd > 0) return;
  for (const p of players){
    if (p.team === owner.team || p.isGK || p.tackleCd > 0) continue;
    const sliding = p.slide > 0;
    const reach = sliding ? TACKLE_R + 1.0 : TACKLE_R + 0.25;
    if (dist(p, owner) >= reach) continue;
    const isHuman = (p.team === 0 && p.idx === active);
    const prof = p.profile || userTeamProfile;
    // AI defenders sometimes CONTAIN rather than lunge; better tiers pick moments well.
    if (!isHuman){
      const commit = 0.35 + 0.55 * prof.defenseIQ;      // willingness to commit to a tackle
      if (Math.random() > commit) continue;
    }
    // contact frequency (attempts/sec) → per-frame; each attempt resolved by ATTRIBUTES.
    const contactRate = isHuman ? 11 : 8;
    if (skillFlash > 0 && owner.idx === active && p.team === 1) { /* shielded */ if (Math.random() < 0.55) continue; }
    if (Math.random() < contactRate * DT){
      const out = GXAI.tackleOutcome(p, owner, prof, sliding);
      if (out.win){
        ball.owner = players.indexOf(p); lastTouch = p.team; ball.kickCd = KICK_COOLDOWN;
        p.tackleCd = 0.35; owner.tackleCd = 0.5;
        const away = norm(p.x - owner.x, p.y - owner.y);
        owner.vx += away.x * -3; owner.vy += away.y * -3;
        if (p.team === 0 && p.idx !== active){ active = players.indexOf(p); lastActiveSwitch = performance.now()/1000; }
      } else { p.tackleCd = 0.25; }   // missed/whiffed timing → brief recovery
    }
  }
}

// -------------------------------------------------- ball + rules
function updateBall(dt){
  const owner = ballOwner();
  if (owner){
    const lead = DRIBBLE_LEAD * (held.sprint && owner.idx===active ? 1.9 : 1.15);
    ball.x = lerp(ball.x, owner.x + Math.cos(owner.dir)*lead, 0.5);
    ball.y = lerp(ball.y, owner.y + Math.sin(owner.dir)*lead, 0.5);
    ball.vx = owner.vx; ball.vy = owner.vy; lastTouch = owner.team; return;
  }
  const fr = Math.pow(BALL_FRICTION, dt);
  ball.vx *= fr; ball.vy *= fr;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt;

  for (const p of players){ if (!p.isGK) continue;
    // keeper reach comes from diving/reflexes ATTRIBUTES, not difficulty
    const gr = p.ratings || {};
    const catchR = 1.4 + ((gr.diving||60)/100)*1.5 + ((gr.reflexes||60)/100)*0.6;
    if (dist(p, ball) < catchR && len(ball.vx,ball.vy) < 30){
      ball.owner = players.indexOf(p); ball.vx = ball.vy = 0; lastTouch = p.team;
      ball.kickCd = KICK_COOLDOWN; return; } }

  if (ball.kickCd <= 0){
    let best = null, bd = CONTROL_R;
    for (const p of players){ const d = dist(p, ball); if (d < bd){ bd = d; best = p; } }
    if (best){ ball.owner = players.indexOf(best); ball.vx = ball.vy = 0; lastTouch = best.team; }
  }
  handleBounds();
}
function handleBounds(){
  if (ball.x < 0 || ball.x > L){
    const inMouth = Math.abs(ball.y - W/2) < HALF_GOAL;
    const leftGoal = ball.x < 0;
    if (inMouth){ onGoal(leftGoal ? 1 : 0); return; }
    const attackTeam = leftGoal ? 1 : 0;         // team attacking that end
    const defTeam = 1 - attackTeam;
    if (lastTouch === defTeam){
      // CORNER KICK to the attacking team
      const cornerX = leftGoal ? 1 : L-1;
      const cornerY = ball.y < W/2 ? 1 : W-1;
      let best=null, bd=1e9;
      for (const p of players){ if (p.team!==attackTeam || p.isGK) continue;
        const d=Math.hypot(p.x-cornerX, p.y-cornerY); if (d<bd){ bd=d; best=p; } }
      if (best){ best.x=cornerX; best.y=cornerY; ball.owner=players.indexOf(best);
        ball.vx=ball.vy=0; ball.x=cornerX; ball.y=cornerY; ball.kickCd=KICK_COOLDOWN; lastTouch=attackTeam; }
      showToast('CORNER','',700); return;
    }
    // GOAL KICK to the defending keeper
    const gk = players.find(p => p.isGK && p.team === defTeam);
    ball.owner = players.indexOf(gk); ball.vx = ball.vy = 0; ball.kickCd = KICK_COOLDOWN;
    ball.x = clamp(ball.x, 0.5, L-0.5); showToast('GOAL KICK','',600); return;
  }
  if (ball.y < 0 || ball.y > W){
    ball.y = clamp(ball.y, 0.6, W-0.6); ball.vx *= 0.2; ball.vy = 0;
    const inTeam = 1 - lastTouch;
    let best = null, bd = 1e9;
    for (const p of players){ if (p.team !== inTeam || p.isGK) continue;
      const d = dist(p, ball); if (d < bd){ bd = d; best = p; } }
    if (best){ best.x = ball.x; best.y = clamp(ball.y, 1, W-1);
      ball.owner = players.indexOf(best); ball.vx = ball.vy = 0; ball.kickCd = KICK_COOLDOWN; }
  }
}
function onGoal(team){
  score[team]++;
  $('scoreHome').textContent = score[0]; $('scoreAway').textContent = score[1];
  showToast(team===0?'GOAL!':'CONCEDED', team===0?'goal':'', 1200);
  navigator.vibrate && navigator.vibrate(team===0?[40,40,80]:40);
  spawnConfetti(team===0);
  fx.flash = 0.9; fx.shake = 1;
  { const fl=$('flash'); if(fl){ fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); } }
  kickTeam = 1 - team;
  setTimeout(() => { if (state === 'play'){ resetPositions(kickTeam); showToast('KICK OFF','',700); } }, 900);
  ball.owner = -2; ball.vx = ball.vy = 0; ball.x = L/2; ball.y = W/2;
}
function cameraFollow(dt){
  const scale = (canvas.height / DPR) / VIEW_H;
  const viewWm = (canvas.width / DPR) / scale;
  const tx = clamp(ball.x, viewWm/2 - 6, L - viewWm/2 + 6);
  const ty = clamp(ball.y, VIEW_H/2 - 4, W - VIEW_H/2 + 4);
  cam.x = lerp(cam.x, tx, 1 - Math.pow(0.001, dt));
  cam.y = lerp(cam.y, ty, 1 - Math.pow(0.001, dt));
}

// ---------------------------------------------------------------- actions
function doPass(from, to, through, D){
  if (!from || !to) return;
  const err = D ? D.passErr : 0;                     // your passes (no D) are accurate
  const lead = through ? 5.5 : 2.0;
  let tx = to.x + (to.vx||0)*lead*0.12, ty = to.y + (to.vy||0)*lead*0.12;
  if (err){ tx += (Math.random()*2-1)*err*9; ty += (Math.random()*2-1)*err*9; }
  const dir = norm(tx - from.x, ty - from.y);
  const d = Math.hypot(tx-from.x, ty-from.y);
  const speed = clamp((through ? 15 : 12) + d*0.55, 12, through?34:30);
  fireBall(from, dir, speed); ball.kickCd = KICK_COOLDOWN; touchCount[from.team]++;
}
function humanPass(through){
  const owner = ballOwner(); if (!owner || owner.team !== 0) return;
  // CROSS: a lofted ball into the box when you play THROUGH from the attacking third
  if (through && owner.x > L*0.64){
    const tx = L*0.9, ty = W/2 + (Math.random()*2-1)*7;
    fireBall(owner, norm(tx-owner.x, ty-owner.y), 27);
    ball.kickCd = KICK_COOLDOWN; touchCount[0]++; showToast('CROSS','',500); return;
  }
  let target = null;
  if (move.mag > 0.25){ const aim = { x:move.x, y:move.y }; let bs = -1e9;
    for (const q of players){ if (q.team !== 0 || q === owner || q.isGK) continue;
      const dir = norm(q.x - owner.x, q.y - owner.y);
      const dot = dir.x*aim.x + dir.y*aim.y; const d = dist(owner, q);
      if (d < 3 || d > (through?46:34)) continue;
      const sc = dot*2 - d*0.03; if (sc > bs){ bs = sc; target = q; } } }
  if (!target) target = bestPassTarget(owner);
  if (!target){ fireBall(owner, norm(goalX(0)-owner.x,(W/2)-owner.y), through?26:20); ball.kickCd=KICK_COOLDOWN; return; }
  doPass(owner, target, through);
  active = players.indexOf(target); lastActiveSwitch = performance.now()/1000;
}
function doShoot(from, power, D){
  if (!from) return;
  const gx = goalX(from.team), gy = W/2;
  let aimY = gy + move.y * HALF_GOAL * 0.9;
  aimY = clamp(aimY, gy - HALF_GOAL + 0.6, gy + HALF_GOAL - 0.6);
  const errMul = D ? D.shotErr : 1.9;
  aimY += (errMul) * (1 - power) * (Math.random()*2 - 1);
  const dir = norm(gx - from.x, aimY - from.y);
  const speed = clamp(20 + power*24, 20, 46);
  fireBall(from, dir, speed); ball.kickCd = KICK_COOLDOWN; touchCount[from.team]++;
  navigator.vibrate && navigator.vibrate(20);
}
function fireBall(from, dir, speed){
  ball.owner = -1; ball.x = from.x + dir.x*1.1; ball.y = from.y + dir.y*1.1;
  ball.vx = dir.x*speed; ball.vy = dir.y*speed; lastTouch = from.team; from.tackleCd = 0.15;
  ball.lastAct = performance.now()/1000;
}
function pressAction(act){
  const inPoss = teamInPossession() === 0; const me = players[active];
  if (inPoss){
    if (act === 'pass') humanPass(false);
    else if (act === 'through') humanPass(true);
    else if (act === 'shoot'){ held.shoot = true; shootStart = performance.now(); }
    else if (act === 'sprint'){ held.sprint = true; trySkill(); }
  } else {
    if (act === 'pass'){ active = nearestHomeToBall(); lastActiveSwitch = performance.now()/1000; }
    else if (act === 'through' && me){ me.tackleCd = 0; lungeTackle(me, false); }
    else if (act === 'shoot' && me){ lungeTackle(me, true); }
    else if (act === 'sprint'){ held.sprint = true; }
  }
}
function releaseAction(act){
  if (act === 'sprint') held.sprint = false;
  else if (act === 'shoot' && held.shoot){
    held.shoot = false;
    const t = clamp((performance.now() - shootStart)/900, 0.15, 1);
    const timed = (t > 0.72 && t < 0.9) ? 1 : 0;
    const owner = ballOwner();
    if (owner && owner.team === 0) doShoot(owner, t, { shotErr: timed ? 0.4 : 1.6 });
    if (timed) showToast('TIMED!', '', 500);
    shootCharge = 0;
  }
}
function lungeTackle(p, slide){
  p.slide = slide ? 0.4 : 0.18;
  const d = norm(ball.x - p.x, ball.y - p.y);
  p.vx += d.x*(slide?10:6); p.vy += d.y*(slide?10:6);
}
function trySkill(){
  const owner = ballOwner();
  if (owner && owner.idx === active && owner.team === 0 && move.mag > 0.4){
    skillFlash = 0.5; owner.vx += move.x*4; owner.vy += move.y*4;
    navigator.vibrate && navigator.vibrate(15);
  }
}

// ---------------------------------------------------------------- FX
function spawnConfetti(gold){
  const cols = gold ? ['#F5C518','#fff','#ffd76a','#27AE60'] : ['#8fa9ff','#fff','#2b3a67'];
  for (let i=0;i<55;i++) fx.parts.push({
    x:Math.random(), y:-0.05-Math.random()*0.2, vx:(Math.random()-0.5)*0.25,
    vy:0.25+Math.random()*0.45, r:2+Math.random()*4, life:1.6+Math.random()*0.8,
    col:cols[i%cols.length], rot:Math.random()*6.28, vr:(Math.random()-0.5)*8 });
}
function updateFX(dt){
  for (const p of fx.parts){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=0.15*dt; p.rot+=p.vr*dt; p.life-=dt; }
  fx.parts = fx.parts.filter(p => p.life > 0 && p.y < 1.2);
}

// ---------------------------------------------------------------- RENDER
function W2S(wx, wy){
  const scale = (canvas.height / DPR) / VIEW_H;
  let ox = 0, oy = 0;
  if (fx.shake > 0){ ox = (Math.random()-0.5)*fx.shake*10; oy = (Math.random()-0.5)*fx.shake*10; }
  return { x:(wx - cam.x)*scale + (canvas.width/DPR)/2 + ox,
           y:(wy - cam.y)*scale + (canvas.height/DPR)/2 + oy, s:scale };
}
function makeCrowd(){
  const t = document.createElement('canvas'); t.width = t.height = 26;
  const c = t.getContext('2d');
  c.fillStyle = '#0c1116'; c.fillRect(0,0,26,26);
  const cols = ['#39404a','#4a5360','#2c333c','#565f6b','#3f4753'];
  for (let i=0;i<40;i++){ c.fillStyle = cols[i%cols.length];
    c.fillRect((Math.random()*26)|0, (Math.random()*26)|0, 2, 2); }
  crowdPat = ctx.createPattern(t, 'repeat');
}
function draw(){
  // 3D render path: the pitch/players/ball are drawn by the WebGL scene.
  if (window.Scene3D && Scene3D.ready()) { Scene3D.frame(players, ball, active, cam.x, cam.y); requestRadar(); return; }
  draw2D();
}
// Legacy 2D renderer (kept as a fallback if WebGL is unavailable).
function draw2D(){
  const cw = canvas.width/DPR, ch = canvas.height/DPR;
  const T = performance.now()/1000;
  ctx.clearRect(0,0,cw,ch);

  // stands (crowd) backdrop
  if (crowdPat){ ctx.fillStyle = crowdPat; ctx.fillRect(0,0,cw,ch); }
  else { ctx.fillStyle = '#0c1116'; ctx.fillRect(0,0,cw,ch); }
  ctx.fillStyle = 'rgba(10,16,20,.35)'; ctx.fillRect(0,0,cw,ch);

  const scale = ch / VIEW_H;
  drawPitch(scale);

  // depth-sort players by y so nearer ones draw on top
  const order = players.slice().sort((a,b) => a.y - b.y);
  drawBallShadow();
  for (const p of order) drawPlayer(p, T);
  drawBall(T);

  drawFloodlight(cw, ch);
  drawConfetti(cw, ch);
  if (fx.flash > 0){ ctx.fillStyle = `rgba(255,255,255,${fx.flash*0.5})`; ctx.fillRect(0,0,cw,ch); }
  requestRadar();
}
function drawPitch(scale){
  const o = W2S(0,0), e = W2S(L,W);
  // turf gradient
  const g = ctx.createLinearGradient(0, o.y, 0, e.y);
  g.addColorStop(0,'#3c8f4a'); g.addColorStop(0.5,'#2f7a3d'); g.addColorStop(1,'#276b35');
  ctx.fillStyle = g; ctx.fillRect(o.x, o.y, e.x-o.x, e.y-o.y);
  // mow stripes
  const bands = 12, bw = (e.x - o.x)/bands;
  for (let i=0;i<bands;i++){ ctx.fillStyle = i%2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)';
    ctx.fillRect(o.x + i*bw, o.y, bw+1, e.y-o.y); }
  // ad boards behind each touchline
  const adcol = ['#0e5bd6','#E4572E','#27AE60','#E0A400','#7d3cff'];
  for (const side of [0,1]){
    const y0 = side===0 ? -1.6 : W; const a = W2S(0,y0), b2 = W2S(L,y0+1.6);
    const segw = (b2.x-a.x)/14;
    for (let i=0;i<14;i++){ ctx.fillStyle = adcol[i%adcol.length];
      ctx.globalAlpha = 0.8; ctx.fillRect(a.x+i*segw, a.y, segw+1, b2.y-a.y); }
    ctx.globalAlpha = 1;
  }
  // lines
  ctx.lineWidth = Math.max(2, 0.14*scale); ctx.strokeStyle = 'rgba(255,255,255,.9)';
  const line = (x1,y1,x2,y2)=>{ const a=W2S(x1,y1),b=W2S(x2,y2);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); };
  const rect = (x,y,w,h)=>{ const a=W2S(x,y); ctx.strokeRect(a.x,a.y,w*scale,h*scale); };
  rect(0,0,L,W); line(L/2,0,L/2,W);
  const c = W2S(L/2,W/2);
  ctx.beginPath(); ctx.arc(c.x,c.y,9.15*scale,0,7); ctx.stroke();
  ctx.beginPath(); ctx.arc(c.x,c.y,0.5*scale,0,7); ctx.fillStyle='#fff'; ctx.fill();
  for (const end of [0,1]){
    const sign = end===0?1:-1, ex = end===0?0:L;
    rect(end===0?0:L-BOX_D, W/2-BOX_W/2, BOX_D, BOX_W);
    rect(end===0?0:L-SIX_D, W/2-SIX_W/2, SIX_D, SIX_W);
    const ps = W2S(ex + sign*12, W/2); ctx.beginPath(); ctx.arc(ps.x,ps.y,0.5*scale,0,7); ctx.fill();
    const ac = W2S(ex + sign*12, W/2);
    ctx.beginPath(); ctx.arc(ac.x,ac.y,9.15*scale, end===0?-0.9:Math.PI-0.9, end===0?0.9:Math.PI+0.9); ctx.stroke();
    // goal + net
    const g1=W2S(ex, W/2-HALF_GOAL), g2=W2S(ex, W/2+HALF_GOAL);
    const depth = sign * 2.4*scale;
    ctx.fillStyle='rgba(255,255,255,.10)';
    ctx.fillRect(Math.min(g1.x,g1.x-depth), g1.y, Math.abs(depth), g2.y-g1.y);
    ctx.strokeStyle='rgba(255,255,255,.28)'; ctx.lineWidth=1;
    for (let k=1;k<6;k++){ const yy=lerp(g1.y,g2.y,k/6);
      ctx.beginPath(); ctx.moveTo(g1.x,yy); ctx.lineTo(g1.x-depth,yy); ctx.stroke(); }
    for (let k=1;k<4;k++){ const xx=lerp(g1.x,g1.x-depth,k/4);
      ctx.beginPath(); ctx.moveTo(xx,g1.y); ctx.lineTo(xx,g2.y); ctx.stroke(); }
    ctx.strokeStyle='#fff'; ctx.lineWidth=Math.max(3,0.22*scale);
    ctx.beginPath(); ctx.moveTo(g1.x,g1.y); ctx.lineTo(g1.x,g2.y); ctx.stroke();
    ctx.lineWidth=Math.max(2,0.14*scale); ctx.strokeStyle='rgba(255,255,255,.9)';
  }
}
function drawFloodlight(cw, ch){
  // single soft vignette (one gradient/frame) — keeps depth without the framerate cost
  const v = ctx.createRadialGradient(cw/2, ch/2, ch*0.34, cw/2, ch/2, ch*0.86);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.42)');
  ctx.fillStyle = v; ctx.fillRect(0,0,cw,ch);
}
function drawBallShadow(){
  const s = W2S(ball.x, ball.y);
  ctx.fillStyle='rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(s.x+0.3*s.s, s.y+0.5*s.s, 0.55*s.s, 0.3*s.s, 0,0,7); ctx.fill();
}
function el(x,y,rx,ry){ ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,7); ctx.fill(); }
function drawPlayer(p, T){
  const s = W2S(p.x, p.y);
  const team = p.team===0?HOME:AWAY;
  const r = 1.25 * s.s;
  // ground shadow
  ctx.fillStyle='rgba(0,0,0,.30)';
  ctx.beginPath(); ctx.ellipse(s.x+0.45*s.s, s.y+0.55*s.s, r*0.95, r*0.5, 0,0,7); ctx.fill();
  // active ring at feet
  if (p.team===0 && p.idx===active){
    const pr = r*1.4 + 0.12*Math.sin(T*6)*s.s;
    ctx.strokeStyle = COL.sprint; ctx.lineWidth = Math.max(2,0.22*s.s);
    ctx.beginPath(); ctx.arc(s.x, s.y, pr, 0,7); ctx.stroke();
  }
  // rotated top-down footballer (head/kit/arms/legs, running animation)
  ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(p.dir);
  const kit = p.isGK?team.gk:team.kit;
  const sh  = p.isGK?'#161616':team.short;
  const hi  = p.kitHi || (p.kitHi = shade(kit,1.2));
  const sw  = Math.sin(p.gait) * r*0.4;
  ctx.fillStyle = sh;
  el(-r*0.1+sw, -r*0.32, r*0.3, r*0.15); el(-r*0.1-sw, r*0.32, r*0.3, r*0.15);
  ctx.fillStyle = '#111';
  el(r*0.22+sw, -r*0.32, r*0.17, r*0.1); el(r*0.22-sw, r*0.32, r*0.17, r*0.1);
  ctx.fillStyle = p.skin;
  el(-r*0.02, -r*0.7, r*0.2, r*0.12); el(-r*0.02, r*0.7, r*0.2, r*0.12);
  ctx.fillStyle = kit; el(0, 0, r*0.62, r*0.58);
  ctx.fillStyle = hi;  el(r*0.14, 0, r*0.34, r*0.4);
  ctx.strokeStyle='rgba(0,0,0,.35)'; ctx.lineWidth=Math.max(1,0.08*s.s);
  ctx.beginPath(); ctx.ellipse(0,0,r*0.62,r*0.58,0,0,7); ctx.stroke();
  ctx.fillStyle = p.skin; el(r*0.46, 0, r*0.4, r*0.4);
  ctx.fillStyle = p.hair;
  ctx.beginPath(); ctx.arc(r*0.44, 0, r*0.4, Math.PI*0.55, Math.PI*1.45); ctx.fill();
  ctx.restore();
  // upright squad number
  ctx.fillStyle = p.isGK ? '#fff' : team.num;
  ctx.font = `900 ${Math.max(7,0.7*s.s)}px system-ui, sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(p.num, s.x, s.y);
  // active chevron + name tag
  if (p.team===0 && p.idx===active){
    ctx.fillStyle = '#2fe0d6';
    const chy = s.y - r*2.0;
    ctx.beginPath(); ctx.moveTo(s.x-0.7*s.s, chy); ctx.lineTo(s.x+0.7*s.s, chy);
    ctx.lineTo(s.x, chy+0.9*s.s); ctx.closePath(); ctx.fill();
    ctx.font=`700 ${Math.max(8,0.72*s.s)}px system-ui`;
    const nm=p.name.toUpperCase(); const tw=ctx.measureText(nm).width;
    ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(s.x-tw/2-3, s.y+r*1.35, tw+6, 1.25*s.s+2);
    ctx.fillStyle='#fff'; ctx.textBaseline='top'; ctx.fillText(nm, s.x, s.y+r*1.45+2);
    ctx.textBaseline='middle';
  }
}
function drawBall(T){
  const s = W2S(ball.x, ball.y);
  const spd = len(ball.vx, ball.vy);
  const r = Math.max(3, 0.5*s.s);
  const bounce = ball.owner>=0 ? 0 : Math.abs(Math.sin(T*10))*2;
  // motion streak
  if (spd > 12){ const n = norm(ball.vx, ball.vy);
    ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=r*0.8;
    ctx.beginPath(); ctx.moveTo(s.x, s.y-bounce); ctx.lineTo(s.x-n.x*r*3, s.y-bounce-n.y*r*3); ctx.stroke(); }
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(s.x, s.y-bounce, r, 0,7); ctx.fill();
  ctx.lineWidth=1; ctx.strokeStyle='rgba(0,0,0,.4)'; ctx.stroke();
  ctx.fillStyle='rgba(20,20,20,.85)';
  ctx.beginPath(); ctx.arc(s.x, s.y-bounce, r*0.3, 0,7); ctx.fill();
}
function drawConfetti(cw, ch){
  for (const p of fx.parts){
    ctx.save(); ctx.translate(p.x*cw, p.y*ch); ctx.rotate(p.rot);
    ctx.globalAlpha = clamp(p.life,0,1); ctx.fillStyle = p.col;
    ctx.fillRect(-p.r/2, -p.r/2, p.r, p.r*0.6); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function shade(hex, f){
  const n = parseInt(hex.slice(1),16);
  let r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  r=clamp(Math.round(r*f),0,255); g=clamp(Math.round(g*f),0,255); b=clamp(Math.round(b*f),0,255);
  return `rgb(${r},${g},${b})`;
}

// radar
function requestRadar(){
  if (!rctx) return;
  const w = radar.width/DPR, h = radar.height/DPR;
  rctx.clearRect(0,0,w,h);
  rctx.fillStyle='rgba(10,26,15,.30)'; rctx.fillRect(0,0,w,h);
  rctx.strokeStyle='rgba(255,255,255,.35)'; rctx.lineWidth=1; rctx.strokeRect(2,2,w-4,h-4);
  rctx.beginPath(); rctx.moveTo(w/2,2); rctx.lineTo(w/2,h-2); rctx.stroke();
  rctx.beginPath(); rctx.arc(w/2,h/2,Math.min(w,h)*0.12,0,7); rctx.stroke();
  const rx = wx => 2 + (wx/L)*(w-4), ry = wy => 2 + (wy/W)*(h-4);
  for (const p of players){
    rctx.fillStyle = p.team===0 ? COL.gold : '#8fa9ff';
    if (p.team===1){ const x=rx(p.x), y=ry(p.y);
      rctx.beginPath(); rctx.moveTo(x,y-2.6); rctx.lineTo(x+2.4,y+2); rctx.lineTo(x-2.4,y+2); rctx.closePath(); rctx.fill();
    } else { rctx.beginPath(); rctx.arc(rx(p.x),ry(p.y),2.4,0,7); rctx.fill(); }
    if (p.team===0 && p.idx===active){ rctx.strokeStyle=COL.sprint; rctx.lineWidth=1.5;
      rctx.beginPath(); rctx.arc(rx(p.x),ry(p.y),4,0,7); rctx.stroke(); }
  }
  rctx.fillStyle='#fff'; rctx.beginPath(); rctx.arc(rx(ball.x),ry(ball.y),2,0,7); rctx.fill();
}

// ---------------------------------------------------------------- HUD / flow
function formatClock(){ const t=Math.max(0,Math.ceil(clock));
  return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`; }
let toastTimer = null;
function showToast(msg, cls, ms){
  const el = $('toast'); el.textContent = msg; el.className = 'toast show '+(cls||'');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>{ el.className='toast '+(cls||''); }, ms||900);
}
function updateHudLabels(){
  const inPoss = teamInPossession() === 0;
  $('lblPass').textContent = inPoss?'PASS':'SWITCH';
  $('lblThrough').textContent = inPoss?'THROUGH':'TACKLE';
  $('lblShoot').textContent = inPoss?'SHOOT':'SLIDE';
}
function possPct(){ const t=possFrames[0]+possFrames[1]||1; return Math.round(possFrames[0]/t*100); }

function frame(t){
  if (state !== 'play') return;
  const now = t/1000; let dtR = now - lastT; lastT = now;
  if (dtR > 0.05) dtR = 0.05; acc += dtR;
  while (acc >= DT){ if (ball.owner !== -2) step(DT); else updateFX(DT); acc -= DT; clockTick(DT); }
  if (held.shoot){ shootCharge = clamp((performance.now()-shootStart)/900,0,1);
    $('powerwrap').classList.add('show'); $('powerFill').style.width=(shootCharge*100)+'%'; }
  else $('powerwrap').classList.remove('show');
  updateHudLabels(); updateJoyArc();
  $('clock').textContent = formatClock();
  draw();
  if (SETTINGS.debug) updateDebug();
  requestAnimationFrame(frame);
}
function clockTick(dt){ if (restartLock>0 || ball.owner===-2) return;
  clock -= dt; if (clock<=0){ clock=0; endMatch(); } }

// AI debug overlay (Section 20) — team phase, states, targets, biases
function updateDebug(){
  const dp = $('dbgPanel'); if (!dp) return;
  const carrier = ballOwner(); const L2=[];
  L2.push(`Tier ${TIERS[tierIndex]}${SETTINGS.competitor?' +COMP':''}${SETTINGS.playerBased?' +PBD':''}  preset:${SETTINGS.preset}`);
  if (st1) L2.push(`CPU phase:${st1.phase} press#${st1.presser} cover#${st1.cover} runners:${st1.runners} risk:${(st1.risk||0).toFixed(2)}`);
  if (st0) L2.push(`YOU phase:${st0.phase}`);
  if (carrier) L2.push(`ball:${carrier.team===0?'GXI':'KES'}#${carrier.num}(${carrier.ovr}) ${carrier.ai?carrier.ai.state:''}${carrier.ai&&carrier.ai.action?' →'+carrier.ai.action.kind:''}`);
  const def = players.find(p=>p.team===1 && p.role==='DF' && p.ai);
  if (def) L2.push(`KES DF#${def.num}: ${def.ai.state}`);
  const fw = players.find(p=>p.team===1 && p.role==='FW' && p.ai);
  if (fw) L2.push(`KES FW#${fw.num}: ${fw.ai.state}`);
  L2.push(`bias sh${SETTINGS.sliders.shotFrequency} cr${SETTINGS.sliders.crossing} dr${SETTINGS.sliders.dribble} tk${SETTINGS.sliders.tackleAggression}`);
  dp.textContent = L2.join('\n');
}

function startMatch(){
  score=[0,0]; clock=MATCH_SECS; kickTeam=0; touchCount[0]=touchCount[1]=0; possFrames=[0,0];
  fx.parts.length=0; fx.flash=0; fx.shake=0; simTime=0;
  setTeamChrome(); resetPositions(0);
  GXAI.beginMatch((tierIndex*7919 + (SETTINGS.competitor?3:0) + 20260730) >>> 0);   // seed (locks difficulty for the match)
  assignProfiles();
  state='play';
  $('menu').classList.add('hidden'); $('fulltime').classList.add('hidden'); $('game').classList.remove('hidden');
  resize();
  if (window.Scene3D && Scene3D.ready()) Scene3D.buildTeams(players);
  $('lvlBadge').textContent = TIERS[tierIndex] + (SETTINGS.competitor?' · COMP':'');
  showToast(TIERS[tierIndex].toUpperCase(),'',1100);
  { const dp=$('dbgPanel'); if(dp) dp.classList.toggle('hidden', !SETTINGS.debug); }
  lastT = performance.now()/1000; acc=0; requestAnimationFrame(frame);
}
function endMatch(){
  state='fulltime';
  const win = score[0] > score[1], draw = score[0]===score[1];
  let title = draw ? 'FULL TIME' : (win ? 'YOU WIN!' : `${AWAY.abbr} WIN`);
  let sub = '';
  if (win && tierIndex > bestBeat){ bestBeat = tierIndex; saveProgress();
    sub = `You beat ${TIERS[tierIndex]}` + (tierIndex<6?` — ${TIERS[tierIndex+1]} awaits!`:` — the top tier!`);
    title = '🏆 ' + title;
  }
  $('ftTitle').textContent = title;
  $('ftScore').textContent = `${score[0]} – ${score[1]}`;
  const pool = players.filter(p=>p.team===0 && !p.isGK);
  const motm = pool.slice().sort((a,b)=>b.ovr-a.ovr)[0] || pool[0];
  $('ftMotm').innerHTML = `${sub ? sub+'<br>' : ''}<span style="opacity:.7">${TIERS[tierIndex]}`
    + (SETTINGS.playerBased?' · PBD':'') + (SETTINGS.competitor?' · Competitor':'')
    + ` · MOTM ${motm.name.toUpperCase()} (${motm.ovr}) · Possession ${possPct()}%</span>`;
  const nextBtn = $('btnNext');
  if (win && tierIndex < 6){ nextBtn.classList.remove('hidden'); nextBtn.textContent = `NEXT TIER (${TIERS[tierIndex+1]}) →`; }
  else nextBtn.classList.add('hidden');
  $('fulltime').classList.remove('hidden');
}
function setTeamChrome(){
  $('abbrHome').textContent=HOME.abbr; $('abbrAway').textContent=AWAY.abbr;
  $('crestHome').textContent=HOME.crest; $('crestAway').textContent=AWAY.crest;
  $('crestHome').style.background=HOME.crestBg; $('crestAway').style.background=AWAY.crestBg;
}

// ---------------------------------------------------------------- difficulty (tier) UI
function refreshLevelUI(){
  $('lvlValue').textContent = tierIndex+1;
  $('lvlName').textContent = TIERS[tierIndex];
  $('lvlDesc').textContent = TIER_DESC[tierIndex];
  $('bestLabel').textContent = bestBeat>=0 ? `Best beaten: ${TIERS[bestBeat]}` : 'No tier beaten yet';
  const bar = $('lvlFill'); if (bar) bar.style.width = ((tierIndex+1)/NTIERS*100)+'%';
  $('lvlDown').disabled = tierIndex<=0; $('lvlUp').disabled = tierIndex>=6;
  // Competitor Mode only on Legendary/Ultimate
  const compAllowed = tierIndex >= 5;
  const compEl = $('optCompetitor'); if (compEl){ compEl.disabled = !compAllowed;
    if (!compAllowed && SETTINGS.competitor){ SETTINGS.competitor=false; compEl.checked=false; } }
  const sl = $('sliderPanel'); if (sl) sl.classList.toggle('hidden', SETTINGS.preset!=='Custom');
}
function setLevel(n){ tierIndex = clamp(n,0,6); saveProgress(); refreshLevelUI(); }

// ---------------------------------------------------------------- input
function updateJoyArc(){
  const arc = $('joyArc');
  if (move.mag > 0.12){ const deg = Math.atan2(move.y, move.x)*180/Math.PI;
    arc.style.background = `conic-gradient(from ${deg-20}deg, ${COL.sprint} 0deg, ${COL.sprint} 40deg, transparent 40deg)`;
    arc.style.borderRadius='50%'; arc.style.opacity=0.5;
  } else { arc.style.background='none'; arc.style.opacity=0; }
}
function bindJoystick(){
  const joy=$('joystick'), knob=$('joyKnob'); const R=44; let id=null, cx=0, cy=0;
  const set=(mx,my)=>{ let dx=mx-cx, dy=my-cy; const m=Math.hypot(dx,dy);
    const cl=Math.min(m,R); const a=Math.atan2(dy,dx);
    knob.style.transform=`translate(${Math.cos(a)*cl}px,${Math.sin(a)*cl}px)`;
    move.x=Math.cos(a)*(cl/R); move.y=Math.sin(a)*(cl/R); move.mag=cl/R; };
  const start=e=>{ const t=e.changedTouches?e.changedTouches[0]:e; id=t.identifier??'m';
    const r=joy.getBoundingClientRect(); cx=r.left+r.width/2; cy=r.top+r.height/2; set(t.clientX,t.clientY); e.preventDefault(); };
  const moveEv=e=>{ if(id===null)return; const t=getTouch(e,id); if(!t)return; set(t.clientX,t.clientY); e.preventDefault(); };
  const end=e=>{ const t=getTouch(e,id,true); if(id!==null&&(t||!e.changedTouches)){ id=null; move.x=move.y=0; move.mag=0; knob.style.transform='translate(0,0)'; } };
  joy.addEventListener('touchstart',start,{passive:false});
  joy.addEventListener('touchmove',moveEv,{passive:false});
  joy.addEventListener('touchend',end); joy.addEventListener('touchcancel',end);
  joy.addEventListener('mousedown',e=>{start(e);
    const mm=ev=>set(ev.clientX,ev.clientY);
    const mu=()=>{ document.removeEventListener('mousemove',mm); document.removeEventListener('mouseup',mu);
      id=null; move.x=move.y=0; move.mag=0; knob.style.transform='translate(0,0)'; };
    document.addEventListener('mousemove',mm); document.addEventListener('mouseup',mu); });
}
function getTouch(e,id,end){ if(!e.changedTouches) return e;
  const list = end ? e.changedTouches : (e.touches||e.changedTouches);
  for (const t of list) if ((t.identifier??'m')===id) return t; return null; }
function bindButtons(){
  document.querySelectorAll('.act').forEach(btn=>{ const act=btn.dataset.act;
    const down=e=>{ e.preventDefault(); pressAction(act); };
    const up=e=>{ e.preventDefault(); releaseAction(act); };
    btn.addEventListener('touchstart',down,{passive:false});
    btn.addEventListener('touchend',up); btn.addEventListener('touchcancel',up);
    btn.addEventListener('mousedown',down); btn.addEventListener('mouseup',up);
    btn.addEventListener('mouseleave',()=>{ if(act==='sprint'||act==='shoot') releaseAction(act); });
  });
}
function bindKeyboard(){
  const k={};
  const apply=()=>{ let x=0,y=0; if(k['a']||k['arrowleft'])x-=1; if(k['d']||k['arrowright'])x+=1;
    if(k['w']||k['arrowup'])y-=1; if(k['s']||k['arrowdown'])y+=1;
    const m=Math.hypot(x,y)||1; move.x=x/m; move.y=y/m; move.mag=(x||y)?1:0; };
  window.addEventListener('keydown',e=>{ const key=e.key.toLowerCase();
    if(k[key])return; k[key]=true; apply(); if(state!=='play')return;
    if(key==='j')pressAction('pass'); else if(key==='k')pressAction('through');
    else if(key==='l')pressAction('shoot');
    else if(key==='shift'){ held.sprint=true; if(teamInPossession()===0) trySkill(); } });
  window.addEventListener('keyup',e=>{ const key=e.key.toLowerCase(); k[key]=false; apply();
    if(key==='l')releaseAction('shoot'); if(key==='shift')releaseAction('sprint'); });
}

// ---------------------------------------------------------------- resize
function resize(){
  DPR = Math.min(window.devicePixelRatio||1, 1.5);   // cap for smooth framerate on phones
  // radar stays a 2D canvas
  const rr = radar.getBoundingClientRect();
  radar.width = Math.max(1, rr.width*DPR); radar.height = Math.max(1, rr.height*DPR);
  rctx = radar.getContext('2d'); rctx.setTransform(DPR,0,0,DPR,0,0);
  // pitch is the WebGL canvas (3D)
  if (window.Scene3D && Scene3D.ready()){
    const pr = canvas.getBoundingClientRect();
    Scene3D.resize(pr.width, pr.height, DPR);
  }
  checkOrient();
}
function checkOrient(){ $('rotate').classList.toggle('hidden', window.innerWidth >= window.innerHeight); }

// ---------------------------------------------------------------- boot
function boot(){
  canvas=$('pitch'); radar=$('radar');
  try { Scene3D.init(canvas, L, W); } catch(e){ console.error('3D init failed', e); }
  rctx=radar.getContext('2d');
  loadProgress(); resize(); refreshLevelUI();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', ()=>setTimeout(resize,200));
  bindJoystick(); bindButtons(); bindKeyboard();
  $('btnPlay').addEventListener('click', startMatch);
  $('btnHowto').addEventListener('click', ()=>$('howto').classList.remove('hidden'));
  $('btnHowtoClose').addEventListener('click', ()=>$('howto').classList.add('hidden'));
  $('lvlUp').addEventListener('click', ()=>setLevel(tierIndex+1));
  $('lvlDown').addEventListener('click', ()=>setLevel(tierIndex-1));
  $('btnRematch').addEventListener('click', startMatch);
  $('btnNext').addEventListener('click', ()=>{ setLevel(tierIndex+1); startMatch(); });
  $('btnQuit').addEventListener('click', ()=>{ state='menu'; refreshLevelUI();
    $('game').classList.add('hidden'); $('fulltime').classList.add('hidden'); $('menu').classList.remove('hidden'); });
  bindSettings();
}
// -------- settings UI wiring (Player-Based Difficulty, Competitor, preset, sliders, debug) --------
function bindSettings(){
  const pb = $('optPlayerBased'), cm = $('optCompetitor'), pr = $('optPreset'), db = $('optDebug');
  if (pb){ pb.checked = SETTINGS.playerBased; pb.addEventListener('change', ()=>{ SETTINGS.playerBased=pb.checked; saveProgress(); }); }
  if (cm){ cm.checked = SETTINGS.competitor; cm.addEventListener('change', ()=>{ SETTINGS.competitor=cm.checked; saveProgress(); }); }
  if (db){ db.checked = SETTINGS.debug; db.addEventListener('change', ()=>{ SETTINGS.debug=db.checked; saveProgress(); }); }
  if (pr){ pr.value = SETTINGS.preset; pr.addEventListener('change', ()=>{ SETTINGS.preset=pr.value; saveProgress(); refreshLevelUI(); }); }
  document.querySelectorAll('.cpu-slider').forEach(s=>{
    const key = s.dataset.key; s.value = SETTINGS.sliders[key];
    const out = document.getElementById('val_'+key); if (out) out.textContent = s.value;
    s.addEventListener('input', ()=>{ SETTINGS.sliders[key]=+s.value; if(out) out.textContent=s.value; saveProgress(); });
  });
  refreshLevelUI();
}
if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();

window.GX = { get state(){return state;}, get score(){return score;}, players:()=>players,
  get clock(){return clock;}, get tier(){return tierIndex;}, get poss(){return possPct();},
  setLevel, setTier:setLevel,
  setConfig(c){ if(c.tierIndex!=null) tierIndex=clamp(c.tierIndex,0,6);
    if(c.playerBased!=null) SETTINGS.playerBased=!!c.playerBased;
    if(c.competitor!=null) SETTINGS.competitor=!!c.competitor;
    if(c.preset) SETTINGS.preset=c.preset;
    if(c.sliders) Object.assign(SETTINGS.sliders,c.sliders); refreshLevelUI(); },
  play(){ startMatch(); }, autoChase(v){ autoChase = !!v; }, endSoon(){ if(state==='play') clock=1.2; },
  teamState(){ return GXAI.teamState; } };
})();
