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

// ---------------------------------------------------------------- difficulty
const MAXLEVEL = 12;
const LEVELS = ['Rookie','Amateur','Semi-Pro','Pro','Veteran','Elite','World Class',
                'Legendary','Ultimate','Insane','Nightmare','IMPOSSIBLE'];
const LEVEL_DESC = [
  'Gentle. The bot barely presses.', 'Learning the ropes.', 'Light pressure.',
  'A real contest.', 'Sharper, quicker bot.', 'Tight marking, clinical.',
  'Relentless press, few mistakes.', 'Brutal. Punishes every error.',
  'Suffocating. Elite finishing.', 'Nearly unbeatable.',
  'The bot rarely loses the ball.', 'Good luck. You will need it.'];

// Opponent behaviour scales with the selected level; your team stays constant.
function diffFor(level){
  const d = (level - 1) / (MAXLEVEL - 1);           // 0..1
  return {
    d,
    decide:    0.30 - 0.22 * d,     // easy AI thinks slowly; hard AI reacts fast
    tackleRate:1.3 + 3.2 * d,       // AI steal-attempts/sec when defending YOU
    stealScale:1 - 0.62 * d,        // multiplier on YOUR steal rate (easy=1, hard≈0.38)
    pressers:  d > 0.6 ? 3 : d > 0.3 ? 2 : 1,
    passErr:   0.42 * (1 - d),      // easy AI misplaces passes → loose balls for you
    passCd:    0.60 - 0.36 * d,     // easy AI dawdles on the ball; hard AI moves it fast
    shotErr:   2.4 * (1 - 0.8 * d),
    shotRange: 16 + 13 * d,
    speed:     0.9 + 0.2 * d,       // easy AI slower than you, hard AI faster
    stamina:   1 + 0.6 * d,
    gkReach:   1.25 + 0.95 * d,
    aggro:     d,
  };
}
const BASE = diffFor(4);            // your AI team-mates play at a steady level
let DF = diffFor(3);               // opponent difficulty (set at kickoff)

let level = 3, bestBeat = 0;
function loadProgress(){
  try {
    level = clamp(parseInt(localStorage.getItem('gx_level')||'3',10)||3, 1, MAXLEVEL);
    bestBeat = clamp(parseInt(localStorage.getItem('gx_best')||'0',10)||0, 0, MAXLEVEL);
  } catch(e){}
}
function saveProgress(){
  try { localStorage.setItem('gx_level', String(level));
        localStorage.setItem('gx_best', String(bestBeat)); } catch(e){}
}

// ---------------------------------------------------------------- teams
const NAMES = ['Russo','Vance','Okafor','Bianchi','Alvarez','Novak','Sato','Halvorsen','Mensah',
  'Petrov','Costa','Dubois','Larsen','Kim','Reyes','Ferro','Nakamura','Adeyemi','Sorensen',
  'Marchetti','Volkov','Osei','Lindqvist','Baros'];
const SKINS = ['#f1c9a5','#e0a878','#c98a56','#a9683b','#8a4e2a','#6d3b1f'];
const HAIRS = ['#140f0a','#2e2013','#0d0d10','#5a3a1e','#c9a24a','#7a4a28'];

const HOME = { name:'Golden XI', abbr:'GXI', crest:'GX', kit:'#F5C518', kit2:'#c99a00',
               num:'#241a00', short:'#141414', crestBg:'#b8860b', gk:'#1f8a4c' };
const AWAY = { name:'Kestrel United', abbr:'KES', crest:'KS', kit:'#2b3a67', kit2:'#1a2340',
               num:'#eef2ff', short:'#e9edf7', crestBg:'#1a2340', gk:'#e08a1e' };

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
    arr.push({ team, idx:i, role:f.role, form:f, x:p.x, y:p.y, vx:0, vy:0,
      dir:(team===0?0:Math.PI), isGK:f.role==='GK', num:i===0?1:i+1,
      name:NAMES[(team*11 + i) % NAMES.length], skin:SKINS[(team*7+i)%SKINS.length],
      hair:HAIRS[(team*5+i*3)%HAIRS.length],
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
const teamDiff = t => (t === 1 ? DF : BASE);

// ---------------------------------------------------------------- AI targets
function formationTarget(p){
  const base = homePos(p.team, p.form);
  const attackRight = (p.team === 0);
  const ballBias = clamp((ball.x - L/2) / (L/2), -1, 1);
  const dirSign = attackRight ? 1 : -1;
  let tx = base.x + dirSign * ballBias * 16;
  let ty = base.y + (ball.y - W/2) * 0.35;
  if (p.role === 'FW' && teamInPossession() === p.team) tx += dirSign * 8;
  if (p.role === 'DF' && teamInPossession() !== p.team) tx -= dirSign * 4;
  return { x:clamp(tx, 2, L-2), y:clamp(ty, 3, W-3) };
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
  if (restartLock > 0) restartLock -= dt;
  ball.kickCd = Math.max(0, ball.kickCd - dt);
  skillFlash = Math.max(0, skillFlash - dt);
  fx.flash = Math.max(0, fx.flash - dt*1.6);
  fx.shake = Math.max(0, fx.shake - dt*3);

  if (teamInPossession() === 0){ active = ball.owner; }
  else if (performance.now()/1000 - lastActiveSwitch > 0.4){ active = nearestHomeToBall(); }

  // precompute defensive press ranking for the team out of possession
  const possTeam = teamInPossession();
  let pressSet = null;
  if (possTeam >= 0){
    const defTeam = 1 - possTeam;
    const D = teamDiff(defTeam);
    // the AI opponent always challenges with at least 2 players so it "attacks" the ball
    const pressN = defTeam === 1 ? Math.max(2, D.pressers) : D.pressers;
    pressSet = new Set(rankByBall(defTeam).slice(0, pressN));
  }

  for (const p of players){
    p.tackleCd = Math.max(0, p.tackleCd - dt);
    if (p.slide) p.slide = Math.max(0, p.slide - dt);
    let tgt, sprint = false;

    if (p.idx === active && p.team === 0 && restartLock <= 0){
      if (move.mag > 0.12){ tgt = { x:p.x + move.x*10, y:p.y + move.y*10 }; sprint = held.sprint; }
      else if (autoChase){ tgt = { x:ball.x, y:ball.y }; sprint = true; }   // test-only pressing
      else tgt = { x:p.x, y:p.y };
    } else if (p.isGK){
      tgt = gkTarget(p); sprint = dist(p, ball) < 10 && teamInPossession() !== p.team;
    } else {
      const ai = aiTarget(p, pressSet); tgt = ai.tgt; sprint = ai.sprint;
    }

    const d = norm(tgt.x - p.x, tgt.y - p.y);
    const arriving = len(tgt.x - p.x, tgt.y - p.y) < 0.6;
    const D = teamDiff(p.team);
    let maxSpd = p.isGK ? SPD_GK*(p.team===1?DF.speed:1)
                        : (sprint && p.stamina > 0.05 ? SPD_SPRINT : SPD_WALK) * (p.team===1?DF.speed:1);
    const desVx = arriving ? 0 : d.x * maxSpd;
    const desVy = arriving ? 0 : d.y * maxSpd;
    p.vx += clamp(desVx - p.vx, -ACCEL*dt, ACCEL*dt);
    p.vy += clamp(desVy - p.vy, -ACCEL*dt, ACCEL*dt);
    p.x = clamp(p.x + p.vx*dt, 0.5, L-0.5);
    p.y = clamp(p.y + p.vy*dt, 0.5, W-0.5);
    const spd = len(p.vx, p.vy);
    if (spd > 0.4) p.dir = Math.atan2(p.vy, p.vx);
    p.gait += spd * dt * 1.1;                        // running animation phase
    const drain = 0.10 / (p.team===1?DF.stamina:1);
    if (sprint && spd > 3) p.stamina = clamp(p.stamina - dt*drain, 0, 1);
    else p.stamina = clamp(p.stamina + dt*0.05, 0, 1);
  }

  aiActions();
  tackling();
  updateBall(dt);
  cameraFollow(dt);
  if (possTeam >= 0) possFrames[possTeam]++;
  updateFX(dt);
}

// -------------------------------------------------- goalkeeper
function gkTarget(p){
  const own = goalX(1 - p.team);
  const line = own === 0 ? 2.2 : L - 2.2;
  const ballDeep = Math.abs(ball.x - own) < 22 && teamInPossession() !== p.team;
  const outX = own === 0 ? clamp(line + (22 - Math.abs(ball.x-own))*0.18, 2.2, 9)
                         : clamp(line - (22 - Math.abs(ball.x-own))*0.18, L-9, L-2.2);
  const tx = ballDeep ? outX : line;
  const ty = clamp(ball.y, W/2 - HALF_GOAL - 2.5, W/2 + HALF_GOAL + 2.5);
  return { x:tx, y:ty };
}

// -------------------------------------------------- outfield AI
function aiTarget(p, pressSet){
  const owner = ballOwner();
  const attackRight = (p.team === 0);
  const dirSign = attackRight ? 1 : -1;
  const D = teamDiff(p.team);

  if (owner === p){
    const gx = goalX(p.team), gy = W/2;
    const toGoal = norm(gx - p.x, gy - p.y);
    const opp = nearestOpponentTo(p, p.team);
    let ax = toGoal.x, ay = toGoal.y;
    if (opp.p && opp.d < 6){ const away = norm(p.x - opp.p.x, p.y - opp.p.y);
      ax += away.x * 0.7; ay += away.y * 0.7; }
    const n = norm(ax, ay);
    return { tgt:{ x:p.x + n.x*8, y:p.y + n.y*8 }, sprint: opp.d > 3 && Math.abs(gx-p.x) > 12 };
  }

  const possTeam = teamInPossession();
  if (possTeam === p.team){
    const t = formationTarget(p);
    if (p.role === 'FW'){ t.x += dirSign * (6 + 4*D.aggro); t.y += (p.idx % 2 ? 3 : -3); }
    return { tgt:t, sprint: p.role === 'FW' };
  }
  if (possTeam === (1 - p.team)){
    if (pressSet && pressSet.has(p)){
      return { tgt:{ x:ball.x, y:ball.y }, sprint:true };   // press the ball
    }
    // mark tighter as difficulty rises
    const t = formationTarget(p);
    const gx = goalX(1 - p.team);
    t.x = lerp(t.x, gx + dirSign * 18, 0.25);
    if (D.aggro > 0.4){ const mk = nearestOpponentTo(p, p.team);
      if (mk.p && mk.d < 16){ t.x = lerp(t.x, mk.p.x - dirSign*1.5, D.aggro*0.5);
                              t.y = lerp(t.y, mk.p.y, D.aggro*0.5); } }
    return { tgt:t, sprint: D.aggro > 0.5 };
  }
  const chaser = nearestPlayerToBall(p.team);
  if (chaser === p) return { tgt:{ x:ball.x, y:ball.y }, sprint:true };
  return { tgt:formationTarget(p), sprint:false };
}

function aiActions(){
  const owner = ballOwner();
  if (!owner) return;
  if (owner.team === 0 && owner.idx === active) return;   // human-controlled
  aiDecideCd -= DT;
  const D = teamDiff(owner.team);
  if (aiDecideCd > 0) return;
  aiDecideCd = D.decide;

  const gx = goalX(owner.team), gy = W/2;
  const distGoal = Math.abs(gx - owner.x);
  const opp = nearestOpponentTo(owner, owner.team);
  const pressured = opp.p && opp.d < 3.0;
  const sinceAct = performance.now()/1000 - (ball.lastAct || 0);

  if (distGoal < D.shotRange && Math.abs(owner.y - gy) < 18 && (distGoal < 12 || Math.random() < 0.4)){
    doShoot(owner, 0.5 + Math.random()*0.4, D); return;
  }
  // Only move the ball on after a cooldown — otherwise the AI keeps it, dribbles,
  // and can actually be tackled (easy levels dawdle a lot; hard levels move it fast).
  if (pressured && sinceAct > D.passCd){
    const mate = bestPassTarget(owner);
    if (mate){ doPass(owner, mate, false, D); return; }
  }
  if (!pressured && sinceAct > D.passCd && Math.random() < 0.12 + 0.4*D.aggro){
    const mate = bestPassTarget(owner);
    if (mate) doPass(owner, mate, false, D);
  }
}
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

// -------------------------------------------------- tackling
function tackling(){
  const owner = ballOwner();
  if (!owner || ball.kickCd > 0) return;
  for (const p of players){
    if (p.team === owner.team || p.tackleCd > 0) continue;
    const reach = (p.slide > 0 ? TACKLE_R + 1.0 : TACKLE_R + 0.25);   // generous contact range
    if (dist(p, owner) >= reach) continue;
    // `rate` = steal attempts per second while in contact (converted per-frame below).
    let rate;
    if (p.team === 0){                       // YOU / your team winning it back
      rate = 3.6 * DF.stealScale + (p.slide > 0 ? 3.0 : 0) + (p.idx === active ? 1.8 : 0);
    } else {                                 // the AI opponent tackling you (scales with level)
      rate = DF.tackleRate + (p.slide > 0 ? 2.5 : 0);
    }
    if (owner.stamina < 0.3) rate += 1;
    if (skillFlash > 0 && owner.idx === active) rate *= 0.45;   // skill move shields briefly
    if (Math.random() < rate * DT){
      ball.owner = players.indexOf(p); lastTouch = p.team; ball.kickCd = KICK_COOLDOWN;
      p.tackleCd = 0.3; owner.tackleCd = 0.5;
      const away = norm(p.x - owner.x, p.y - owner.y);
      owner.vx += away.x * -3; owner.vy += away.y * -3;
      if (p.team === 0 && p.idx !== active){ active = players.indexOf(p); lastActiveSwitch = performance.now()/1000; }
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
    const catchR = 1.4 * (p.team===1?DF.gkReach:1.7);
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
  rctx.fillStyle='rgba(10,26,15,.85)'; rctx.fillRect(0,0,w,h);
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
  requestAnimationFrame(frame);
}
function clockTick(dt){ if (restartLock>0 || ball.owner===-2) return;
  clock -= dt; if (clock<=0){ clock=0; endMatch(); } }

function startMatch(){
  DF = diffFor(level);
  score=[0,0]; clock=MATCH_SECS; kickTeam=0; touchCount[0]=touchCount[1]=0; possFrames=[0,0];
  fx.parts.length=0; fx.flash=0; fx.shake=0;
  setTeamChrome(); resetPositions(0); state='play';
  $('menu').classList.add('hidden'); $('fulltime').classList.add('hidden'); $('game').classList.remove('hidden');
  resize();
  $('lvlBadge').textContent = 'Lv '+level+' · '+LEVELS[level-1];
  showToast(LEVELS[level-1].toUpperCase(),'',1100);
  lastT = performance.now()/1000; acc=0; requestAnimationFrame(frame);
}
function endMatch(){
  state='fulltime';
  const win = score[0] > score[1], draw = score[0]===score[1];
  let title = draw ? 'FULL TIME' : (win ? 'YOU WIN!' : `${AWAY.abbr} WIN`);
  let sub = '';
  if (win && level === bestBeat + 1 && level <= MAXLEVEL){
    bestBeat = level; saveProgress();
    sub = level < MAXLEVEL ? `Level ${level} cleared — Level ${level+1} unlocked!`
                           : `You beat ${LEVELS[MAXLEVEL-1]} — the final level!`;
    title = '🏆 ' + title;
  }
  $('ftTitle').textContent = title;
  $('ftScore').textContent = `${score[0]} – ${score[1]}`;
  const pool = players.filter(p=>p.team===0 && !p.isGK);
  const motm = pool[Math.floor(Math.random()*pool.length)];
  $('ftMotm').innerHTML = `${sub ? sub+'<br>' : ''}<span style="opacity:.7">Level ${level} · ${LEVELS[level-1]} · `
    + `MOTM ${motm.name.toUpperCase()} · Possession ${possPct()}%</span>`;
  // offer "next level" button when you just cleared and can go up
  const nextBtn = $('btnNext');
  if (win && level < MAXLEVEL){ nextBtn.classList.remove('hidden'); nextBtn.textContent = `NEXT LEVEL (${LEVELS[level]}) →`; }
  else nextBtn.classList.add('hidden');
  $('fulltime').classList.remove('hidden');
}
function setTeamChrome(){
  $('abbrHome').textContent=HOME.abbr; $('abbrAway').textContent=AWAY.abbr;
  $('crestHome').textContent=HOME.crest; $('crestAway').textContent=AWAY.crest;
  $('crestHome').style.background=HOME.crestBg; $('crestAway').style.background=AWAY.crestBg;
}

// ---------------------------------------------------------------- level UI
function refreshLevelUI(){
  $('lvlValue').textContent = level;
  $('lvlName').textContent = LEVELS[level-1];
  $('lvlDesc').textContent = LEVEL_DESC[level-1];
  $('bestLabel').textContent = bestBeat>0 ? `Best cleared: Lv ${bestBeat} · ${LEVELS[bestBeat-1]}` : 'No level cleared yet';
  const bar = $('lvlFill'); if (bar) bar.style.width = (level/MAXLEVEL*100)+'%';
  $('lvlDown').disabled = level<=1; $('lvlUp').disabled = level>=MAXLEVEL;
}
function setLevel(n){ level = clamp(n,1,MAXLEVEL); saveProgress(); refreshLevelUI(); }

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
  for (const c of [canvas, radar]){ const r = c.getBoundingClientRect();
    c.width = Math.max(1, r.width*DPR); c.height = Math.max(1, r.height*DPR);
    c.getContext('2d').setTransform(DPR,0,0,DPR,0,0); }
  ctx = canvas.getContext('2d'); rctx = radar.getContext('2d');
  makeCrowd(); checkOrient();
}
function checkOrient(){ $('rotate').classList.toggle('hidden', window.innerWidth >= window.innerHeight); }

// ---------------------------------------------------------------- boot
function boot(){
  canvas=$('pitch'); radar=$('radar'); ctx=canvas.getContext('2d'); rctx=radar.getContext('2d');
  loadProgress(); resize(); refreshLevelUI();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', ()=>setTimeout(resize,200));
  bindJoystick(); bindButtons(); bindKeyboard();
  $('btnPlay').addEventListener('click', startMatch);
  $('btnHowto').addEventListener('click', ()=>$('howto').classList.remove('hidden'));
  $('btnHowtoClose').addEventListener('click', ()=>$('howto').classList.add('hidden'));
  $('lvlUp').addEventListener('click', ()=>setLevel(level+1));
  $('lvlDown').addEventListener('click', ()=>setLevel(level-1));
  $('btnRematch').addEventListener('click', startMatch);
  $('btnNext').addEventListener('click', ()=>{ setLevel(level+1); startMatch(); });
  $('btnQuit').addEventListener('click', ()=>{ state='menu'; refreshLevelUI();
    $('game').classList.add('hidden'); $('fulltime').classList.add('hidden'); $('menu').classList.remove('hidden'); });
}
if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();

window.GX = { get state(){return state;}, get score(){return score;}, players:()=>players,
  get clock(){return clock;}, get level(){return level;}, get poss(){return possPct();}, setLevel,
  play(){ startMatch(); }, autoChase(v){ autoChase = !!v; }, endSoon(){ if(state==='play') clock=1.2; } };
})();
