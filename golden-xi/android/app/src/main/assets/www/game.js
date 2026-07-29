/* ============================================================================
   GOLDEN XI — Ultimate Football  (self-contained HTML5 match engine)
   All teams, players and crests are ORIGINAL & FICTIONAL by design.
   Landscape arcade football: virtual joystick + PASS/THROUGH/SHOOT/SPRINT.
   ========================================================================== */
(() => {
'use strict';

// ---------------------------------------------------------------- constants
const L = 110, W = 72;              // pitch size in metres
const GOAL_W = 12;                  // goal mouth width (arcade-generous)
const HALF_GOAL = GOAL_W / 2;
const BOX_W = 40, BOX_D = 18;       // penalty box (width across, depth in)
const SIX_W = 20, SIX_D = 7;
const MATCH_SECS = 180;             // 3:00
const VIEW_H = 46;                  // metres shown vertically (camera zoom)
const DT = 1 / 60;

// movement / physics
const SPD_WALK = 7.2, SPD_SPRINT = 10.6, SPD_GK = 6.4;   // m/s
const ACCEL = 42;                                        // steering accel
const BALL_FRICTION = 0.62;                              // per second decay factor base
const CONTROL_R = 1.5, DRIBBLE_LEAD = 1.0, TACKLE_R = 1.35;
const KICK_COOLDOWN = 0.28;

// action colours
const COL = { pass:'#2F80ED', through:'#E0A400', shoot:'#E4572E', sprint:'#27AE60', gold:'#F5C518' };

// ---------------------------------------------------------------- teams
const NAMES = ['Russo','Vance','Okafor','Bianchi','Alvarez','Novak','Sato','Halvorsen','Mensah',
  'Petrov','Costa','Dubois','Larsen','Kane-lo','Reyes','Ferro','Nakamura','Adeyemi','Sorensen',
  'Marchetti','Volkov','Osei','Lindqvist','Baros'];

const HOME = { name:'Golden XI', abbr:'GXI', crest:'GX', kit:'#F5C518', num:'#241a00',
               crestBg:'#b8860b', gk:'#1f8a4c' };
const AWAY = { name:'Kestrel United', abbr:'KES', crest:'KS', kit:'#28345a', num:'#eef2ff',
               crestBg:'#1a2340', gk:'#e08a1e' };

// 4-3-3, normalised: x 0=own goal-line → 1=opponent goal-line, y 0=top → 1=bottom
const FORMATION = [
  {x:0.05,y:0.50,role:'GK'},
  {x:0.20,y:0.16,role:'DF'},{x:0.16,y:0.38,role:'DF'},{x:0.16,y:0.62,role:'DF'},{x:0.20,y:0.84,role:'DF'},
  {x:0.44,y:0.30,role:'MF'},{x:0.42,y:0.50,role:'MF'},{x:0.44,y:0.70,role:'MF'},
  {x:0.74,y:0.16,role:'FW'},{x:0.82,y:0.50,role:'FW'},{x:0.74,y:0.84,role:'FW'},
];

// ---------------------------------------------------------------- state
let canvas, ctx, radar, rctx, DPR = 1;
let state = 'menu';          // menu | play | fulltime
let players = [], ball, cam = { x:L/2, y:W/2 };
let score = [0,0], clock = MATCH_SECS, kickTeam = 0;
let lastTouch = 0, active = 10, lastActiveSwitch = 0;
let restartLock = 0;         // pause control briefly at kickoff
const touchCount = [0,0];    // pass/shot counts
let possFrames = [0,0];      // time-on-ball accumulator for the possession stat
let acc = 0, lastT = 0;

// input
const move = { x:0, y:0, mag:0 };
const held = { sprint:false, shoot:false };
let shootStart = 0, shootCharge = 0;
let prevMoveAng = 0, skillFlash = 0;

// ---------------------------------------------------------------- helpers
const clamp = (v,a,b) => v < a ? a : v > b ? b : v;
const lerp = (a,b,t) => a + (b - a) * t;
const dist = (a,b) => Math.hypot(a.x - b.x, a.y - b.y);
const len = (x,y) => Math.hypot(x,y);
function norm(x,y){ const m = Math.hypot(x,y) || 1; return { x:x/m, y:y/m }; }
const $ = id => document.getElementById(id);

// which world-goal each team attacks (x coordinate of target goal centre)
function goalX(team){ return team === 0 ? L : 0; }        // home attacks +x
const GOAL = { x0:0, x1:L, cy:W/2 };

// ---------------------------------------------------------------- setup match
function homePos(team, f){
  // convert formation (attack +x) to world for this team's attacking direction
  const attackRight = (team === 0) ^ (secondHalf);
  const nx = attackRight ? f.x : (1 - f.x);
  const ny = attackRight ? f.y : (1 - f.y);
  return { x: nx * L, y: ny * W };
}
let secondHalf = false;

function makeTeam(team){
  const arr = [];
  for (let i = 0; i < 11; i++){
    const f = FORMATION[i];
    const p = homePos(team, f);
    arr.push({
      team, idx:i, role:f.role, form:f,
      x:p.x, y:p.y, vx:0, vy:0, dir:(team===0?0:Math.PI),
      isGK:f.role==='GK', num:i===0?1:i+1,
      name:NAMES[(team*11 + i) % NAMES.length],
      tackleCd:0, stamina:1,
    });
  }
  return arr;
}

function resetPositions(kick){
  // Single continuous half; teams keep their ends the whole match (arcade).
  secondHalf = false;
  players = [...makeTeam(0), ...makeTeam(1)];
  ball = { x:L/2, y:W/2, vx:0, vy:0, owner:-1, kickCd:0, spin:0 };
  // give kickoff to `kick` team: nearest forward steps to centre
  const g = players.filter(p => p.team === kick);
  const taker = g[9]; taker.x = L/2 - (kick===0?1.2:-1.2); taker.y = W/2;
  ball.owner = players.indexOf(taker); lastTouch = kick;
  active = kick === 0 ? players.indexOf(taker) : nearestHomeToBall();
  restartLock = 0.6;
  cam.x = L/2; cam.y = W/2;
}

function nearestHomeToBall(){
  let best = -1, bd = 1e9;
  for (let i = 0; i < 22; i++){ const p = players[i];
    if (p.team !== 0 || p.isGK) continue;
    const d = dist(p, ball); if (d < bd){ bd = d; best = i; } }
  return best < 0 ? 10 : best;
}

// ---------------------------------------------------------------- AI target
function formationTarget(p){
  // slide whole shape toward the ball, keep role depth
  const base = homePos(p.team, p.form);
  const attackRight = (p.team === 0) ^ secondHalf;
  const ballBias = clamp((ball.x - L/2) / (L/2), -1, 1);   // -1..1
  const dirSign = attackRight ? 1 : -1;
  let tx = base.x + dirSign * ballBias * 16;
  let ty = base.y + (ball.y - W/2) * 0.35;
  // forwards push higher when own team attacks
  if (p.role === 'FW' && teamInPossession() === p.team) tx += dirSign * 8;
  if (p.role === 'DF' && teamInPossession() !== p.team) tx -= dirSign * 4;
  return { x:clamp(tx, 2, L-2), y:clamp(ty, 3, W-3) };
}

function teamInPossession(){ return ball.owner >= 0 ? players[ball.owner].team : -1; }

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

// ---------------------------------------------------------------- simulation
function step(dt){
  if (restartLock > 0) restartLock -= dt;
  ball.kickCd = Math.max(0, ball.kickCd - dt);
  skillFlash = Math.max(0, skillFlash - dt);

  // auto-switch active (home) to ball carrier or nearest, unless we hold one meaningfully
  if (teamInPossession() === 0){
    active = ball.owner;
  } else if (performance.now()/1000 - lastActiveSwitch > 0.15){
    active = nearestHomeToBall();
  }

  for (const p of players){
    p.tackleCd = Math.max(0, p.tackleCd - dt);
    let tgt, sprint = false;

    if (p.idx === active && p.team === 0 && restartLock <= 0){
      // ---- human-controlled player
      if (move.mag > 0.12){
        tgt = { x:p.x + move.x*10, y:p.y + move.y*10 };
        sprint = held.sprint;
      } else {
        tgt = { x:p.x, y:p.y };
      }
    } else if (p.isGK){
      tgt = gkTarget(p); sprint = dist(p, ball) < 10 && teamInPossession() !== p.team;
    } else {
      const ai = aiTarget(p); tgt = ai.tgt; sprint = ai.sprint;
    }

    // steer
    const d = norm(tgt.x - p.x, tgt.y - p.y);
    const arriving = len(tgt.x - p.x, tgt.y - p.y) < 0.6;
    let maxSpd = p.isGK ? SPD_GK : (sprint && p.stamina > 0.05 ? SPD_SPRINT : SPD_WALK);
    if (p === ballOwner() && p.idx !== active) maxSpd *= 0.94;          // dribblers a touch slower
    if (p === ballOwner() && sprint) maxSpd *= 1.0;
    const desVx = arriving ? 0 : d.x * maxSpd;
    const desVy = arriving ? 0 : d.y * maxSpd;
    p.vx += clamp(desVx - p.vx, -ACCEL*dt, ACCEL*dt);
    p.vy += clamp(desVy - p.vy, -ACCEL*dt, ACCEL*dt);
    p.x = clamp(p.x + p.vx*dt, 0.5, L-0.5);
    p.y = clamp(p.y + p.vy*dt, 0.5, W-0.5);
    if (len(p.vx, p.vy) > 0.4) p.dir = Math.atan2(p.vy, p.vx);

    // stamina
    if (sprint && (Math.abs(p.vx)+Math.abs(p.vy) > 3)) p.stamina = clamp(p.stamina - dt*0.10, 0, 1);
    else p.stamina = clamp(p.stamina + dt*0.05, 0, 1);
  }

  aiActions();
  tackling();
  updateBall(dt);
  cameraFollow(dt);
  const pt = teamInPossession(); if (pt >= 0) possFrames[pt]++;
}

function ballOwner(){ return ball.owner >= 0 ? players[ball.owner] : null; }

// -------------------------------------------------- goalkeeper behaviour
function gkTarget(p){
  const own = goalX(1 - p.team);                    // GK guards own goal
  const line = own === 0 ? 2.2 : L - 2.2;
  // come off the line if the ball is close & dangerous
  const ballDeep = Math.abs(ball.x - own) < 22 && teamInPossession() !== p.team;
  const outX = own === 0 ? clamp(line + (22 - Math.abs(ball.x-own))*0.18, 2.2, 9)
                         : clamp(line - (22 - Math.abs(ball.x-own))*0.18, L-9, L-2.2);
  const tx = ballDeep ? outX : line;
  const ty = clamp(ball.y, W/2 - HALF_GOAL - 2.5, W/2 + HALF_GOAL + 2.5);
  return { x:tx, y:ty };
}

// -------------------------------------------------- outfield AI
function aiTarget(p){
  const owner = ballOwner();
  const attackRight = (p.team === 0) ^ secondHalf;
  const dirSign = attackRight ? 1 : -1;

  if (owner === p){                                   // I have the ball (AI)
    const gx = goalX(p.team), gy = W/2;
    const toGoal = norm(gx - p.x, gy - p.y);
    const opp = nearestOpponentTo(p, p.team);
    // steer around nearest defender a little
    let ax = toGoal.x, ay = toGoal.y;
    if (opp.p && opp.d < 6){
      const away = norm(p.x - opp.p.x, p.y - opp.p.y);
      ax += away.x * 0.7; ay += away.y * 0.7;
    }
    const n = norm(ax, ay);
    return { tgt:{ x:p.x + n.x*8, y:p.y + n.y*8 }, sprint: opp.d > 3 && Math.abs(gx-p.x) > 12 };
  }

  const possTeam = teamInPossession();
  if (possTeam === p.team){                           // team-mate off the ball → attack shape / runs
    const t = formationTarget(p);
    if (p.role === 'FW'){ t.x += dirSign * 6; t.y += (p.idx % 2 ? 3 : -3); }
    return { tgt:t, sprint: p.role === 'FW' };
  }

  if (possTeam === (1 - p.team)){                     // defending
    const chaser = nearestPlayerToBall(p.team);
    if (chaser === p){
      return { tgt:{ x:ball.x, y:ball.y }, sprint:true }; // press the ball
    }
    // else mark space between own goal and ball, biased to assignment
    const t = formationTarget(p);
    const gx = goalX(1 - p.team);
    t.x = lerp(t.x, gx + dirSign * 18, 0.25);
    return { tgt:t, sprint:false };
  }
  // loose ball: nearest goes for it
  const chaser = nearestPlayerToBall(p.team);
  if (chaser === p) return { tgt:{ x:ball.x, y:ball.y }, sprint:true };
  return { tgt:formationTarget(p), sprint:false };
}

// AI decides passes / shots for whichever AI player owns the ball
let aiDecideCd = 0;
function aiActions(){
  const owner = ballOwner();
  if (!owner) return;
  const humanControlled = (owner.team === 0 && owner.idx === active);
  if (humanControlled) return;
  aiDecideCd -= DT;
  if (aiDecideCd > 0) return;
  aiDecideCd = 0.18;

  const gx = goalX(owner.team), gy = W/2;
  const distGoal = Math.abs(gx - owner.x);
  const opp = nearestOpponentTo(owner, owner.team);
  const pressured = opp.p && opp.d < 2.6;

  // shoot if close-ish and roughly central
  if (distGoal < 26 && Math.abs(owner.y - gy) < 20 && (Math.random() < 0.5 || distGoal < 14)){
    doShoot(owner, 0.55 + Math.random()*0.35, 0); return;
  }
  if (pressured || Math.random() < 0.25){
    const mate = bestPassTarget(owner);
    if (mate){ doPass(owner, mate, false); return; }
  }
  // else keep dribbling (handled by movement target)
}

function bestPassTarget(owner){
  const gx = goalX(owner.team);
  let best = null, bs = -1e9;
  for (const q of players){
    if (q.team !== owner.team || q === owner || q.isGK) continue;
    const forward = (gx - q.x) * (owner.team === 0 ? 1 : -1);   // more forward = better
    const d = dist(owner, q);
    if (d < 4 || d > 42) continue;
    // penalise if a defender sits on the passing lane
    let laneRisk = 0;
    for (const e of players){ if (e.team === owner.team) continue;
      const t = projT(owner, q, e); if (t > 0.1 && t < 0.9){
        const px = lerp(owner.x, q.x, t), py = lerp(owner.y, q.y, t);
        if (Math.hypot(e.x-px, e.y-py) < 2.2) laneRisk += 6; } }
    const score = forward*0.6 - laneRisk - Math.abs(q.y - owner.y)*0.05 - (d>28?4:0);
    if (score > bs){ bs = score; best = q; }
  }
  return best;
}
function projT(a,b,p){ const dx=b.x-a.x, dy=b.y-a.y; const l2=dx*dx+dy*dy||1;
  return ((p.x-a.x)*dx + (p.y-a.y)*dy)/l2; }

// -------------------------------------------------- tackling / possession win
function tackling(){
  const owner = ballOwner();
  if (!owner || ball.kickCd > 0) return;
  for (const p of players){
    if (p.team === owner.team || p.tackleCd > 0) continue;
    const d = dist(p, owner);
    const reach = p.slide > 0 ? TACKLE_R + 0.9 : TACKLE_R;
    if (d < reach){
      // probability scales with closing & facing; GK auto-collects near goal
      let chance = 0.18 + (p.slide > 0 ? 0.35 : 0) + (owner.stamina < 0.3 ? 0.1 : 0);
      if (skillFlash > 0 && owner.idx === active) chance *= 0.4;   // skill move shields
      if (Math.random() < chance){
        ball.owner = players.indexOf(p); lastTouch = p.team;
        ball.kickCd = KICK_COOLDOWN;
        p.tackleCd = 0.4; owner.tackleCd = 0.5;
        // small knock-on
        const away = norm(p.x - owner.x, p.y - owner.y);
        owner.vx += away.x * -3; owner.vy += away.y * -3;
      }
    }
    if (p.slide !== undefined) p.slide = Math.max(0, (p.slide||0) - DT);
  }
}

// -------------------------------------------------- ball physics + rules
function updateBall(dt){
  const owner = ballOwner();
  if (owner){
    // glue slightly ahead of dribbler
    const lead = DRIBBLE_LEAD * (held.sprint && owner.idx===active ? 1.9 : 1.15);
    const tx = owner.x + Math.cos(owner.dir) * lead;
    const ty = owner.y + Math.sin(owner.dir) * lead;
    ball.x = lerp(ball.x, tx, 0.5); ball.y = lerp(ball.y, ty, 0.5);
    ball.vx = owner.vx; ball.vy = owner.vy;
    lastTouch = owner.team;
    return;
  }
  // free ball
  const fr = Math.pow(BALL_FRICTION, dt);
  ball.vx *= fr; ball.vy *= fr;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt;

  // GK catch / save
  for (const p of players){ if (!p.isGK) continue;
    if (dist(p, ball) < 1.7 && len(ball.vx,ball.vy) < 26){
      ball.owner = players.indexOf(p); ball.vx = ball.vy = 0; lastTouch = p.team;
      ball.kickCd = KICK_COOLDOWN; return; } }

  // capture by any player
  if (ball.kickCd <= 0){
    let best = null, bd = CONTROL_R;
    for (const p of players){ const d = dist(p, ball); if (d < bd){ bd = d; best = p; } }
    if (best){ ball.owner = players.indexOf(best); ball.vx = ball.vy = 0; lastTouch = best.team; }
  }

  // boundaries & goals
  handleBounds();
}

function handleBounds(){
  // end lines
  if (ball.x < 0 || ball.x > L){
    const inMouth = Math.abs(ball.y - W/2) < HALF_GOAL;
    const leftGoal = ball.x < 0;
    if (inMouth){
      // goal scored by the team attacking that end
      const scorer = leftGoal ? (secondHalf ? 0 : 1) : (secondHalf ? 1 : 0);
      onGoal(scorer); return;
    }
    // out over end line → goal kick to defending GK (simplified)
    const defTeam = leftGoal ? ((secondHalf)?1:0) : ((secondHalf)?0:1);
    const gk = players.find(p => p.isGK && p.team === defTeam);
    ball.owner = players.indexOf(gk); ball.vx = ball.vy = 0; ball.kickCd = KICK_COOLDOWN;
    ball.x = clamp(ball.x, 0.5, L-0.5); return;
  }
  // side lines → throw-in to team that didn't touch last
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
  $('scoreHome').textContent = score[0];
  $('scoreAway').textContent = score[1];
  const who = team === 0 ? HOME.name : AWAY.name;
  showToast('GOAL!', 'goal', 1200);
  navigator.vibrate && navigator.vibrate(60);
  kickTeam = 1 - team;                 // conceding team kicks off
  setTimeout(() => { if (state === 'play') resetPositions(kickTeam); showToast('KICK OFF', '', 800); }, 1200);
  // freeze ball at centre meanwhile
  ball.owner = -2; ball.vx = ball.vy = 0; ball.x = L/2; ball.y = W/2;
}

// -------------------------------------------------- camera
function cameraFollow(dt){
  const scale = (canvas.height / DPR) / VIEW_H;
  const viewWm = (canvas.width / DPR) / scale;
  const tx = clamp(ball.x, viewWm/2 - 6, L - viewWm/2 + 6);
  const ty = clamp(ball.y, VIEW_H/2 - 4, W - VIEW_H/2 + 4);
  cam.x = lerp(cam.x, tx, 1 - Math.pow(0.001, dt));
  cam.y = lerp(cam.y, ty, 1 - Math.pow(0.001, dt));
}

// ---------------------------------------------------------------- ACTIONS
function doPass(from, to, through){
  if (!from || !to) return;
  const lead = through ? 5.5 : 2.0;
  const tvx = to.vx || 0, tvy = to.vy || 0;
  const tx = to.x + (tvx)*lead*0.12, ty = to.y + (tvy)*lead*0.12;
  const dir = norm(tx - from.x, ty - from.y);
  const d = Math.hypot(tx-from.x, ty-from.y);
  const speed = clamp((through ? 15 : 12) + d*0.55, 12, through?34:30);
  fireBall(from, dir, speed);
  ball.kickCd = KICK_COOLDOWN;
  touchCount[from.team]++;
}

function humanPass(through){
  const owner = ballOwner();
  if (!owner || owner.team !== 0) return;
  // choose target in the direction of the joystick, else best forward option
  let target = null;
  if (move.mag > 0.25){
    const aim = { x:move.x, y:move.y };
    let bs = -1e9;
    for (const q of players){ if (q.team !== 0 || q === owner || q.isGK) continue;
      const dir = norm(q.x - owner.x, q.y - owner.y);
      const dot = dir.x*aim.x + dir.y*aim.y;
      const d = dist(owner, q);
      if (d < 3 || d > (through?46:34)) continue;
      const sc = dot*2 - d*0.03;
      if (sc > bs){ bs = sc; target = q; } }
  }
  if (!target) target = bestPassTarget(owner);
  if (!target){
    // no mate → punt forward
    const gx = goalX(0);
    fireBall(owner, norm(gx-owner.x, (W/2)-owner.y), through?26:20); ball.kickCd=KICK_COOLDOWN; return;
  }
  doPass(owner, target, through);
  active = players.indexOf(target);      // hand control to receiver's vicinity
  lastActiveSwitch = performance.now()/1000;
}

function doShoot(from, power, timedBonus){
  if (!from) return;
  const gx = goalX(from.team), gy = W/2;
  // placement: joystick vertical nudges aim within the goal; add inaccuracy
  let aimY = gy + (from.team===0? move.y : move.y) * HALF_GOAL * 0.9;
  aimY = clamp(aimY, gy - HALF_GOAL + 0.6, gy + HALF_GOAL - 0.6);
  const err = (1 - timedBonus) * (1.8 + (1-power)) * (Math.random()*2 - 1);
  aimY += err;
  const dir = norm(gx - from.x, aimY - from.y);
  const speed = clamp(20 + power*24, 20, 46);
  fireBall(from, dir, speed);
  ball.kickCd = KICK_COOLDOWN;
  touchCount[from.team]++;
  navigator.vibrate && navigator.vibrate(20);
}

function fireBall(from, dir, speed){
  ball.owner = -1;
  ball.x = from.x + dir.x * 1.1; ball.y = from.y + dir.y * 1.1;
  ball.vx = dir.x * speed; ball.vy = dir.y * speed;
  lastTouch = from.team; from.tackleCd = 0.15;
}

// human action button dispatch (respects offense/defense remap)
function pressAction(act){
  const inPoss = teamInPossession() === 0;
  const me = players[active];
  if (inPoss){
    if (act === 'pass') humanPass(false);
    else if (act === 'through') humanPass(true);
    else if (act === 'shoot'){ held.shoot = true; shootStart = performance.now(); }
    else if (act === 'sprint'){ held.sprint = true; trySkill(); }
  } else {
    if (act === 'pass'){ active = nearestHomeToBall(); lastActiveSwitch = performance.now()/1000; }
    else if (act === 'through' && me){ me.tackleCd = 0; lungeTackle(me, false); }
    else if (act === 'shoot' && me){ lungeTackle(me, true); }   // slide
    else if (act === 'sprint'){ held.sprint = true; }
  }
}
function releaseAction(act){
  if (act === 'sprint') held.sprint = false;
  else if (act === 'shoot' && held.shoot){
    held.shoot = false;
    const t = clamp((performance.now() - shootStart)/900, 0.15, 1);
    const timed = (t > 0.72 && t < 0.9) ? 1 : 0;             // green window
    const owner = ballOwner();
    if (owner && owner.team === 0) doShoot(owner, t, timed);
    if (timed) showToast('TIMED!', '', 500);
    shootCharge = 0;
  }
}
function lungeTackle(p, slide){
  p.slide = slide ? 0.4 : 0.18;
  const d = norm(ball.x - p.x, ball.y - p.y);
  p.vx += d.x * (slide?10:6); p.vy += d.y * (slide?10:6);
}
function trySkill(){
  const owner = ballOwner();
  if (owner && owner.idx === active && owner.team === 0 && move.mag > 0.4){
    skillFlash = 0.5;                    // brief shield + burst
    owner.vx += move.x * 4; owner.vy += move.y * 4;
    navigator.vibrate && navigator.vibrate(15);
  }
}

// ---------------------------------------------------------------- RENDER
function W2S(wx, wy){
  const scale = (canvas.height / DPR) / VIEW_H;
  return { x:(wx - cam.x)*scale + (canvas.width/DPR)/2,
           y:(wy - cam.y)*scale + (canvas.height/DPR)/2, s:scale };
}

function draw(){
  const cw = canvas.width/DPR, ch = canvas.height/DPR;
  ctx.clearRect(0,0,cw,ch);
  const scale = ch / VIEW_H;

  // grass base
  ctx.fillStyle = '#2b6d38'; ctx.fillRect(0,0,cw,ch);
  drawPitch(scale);

  // shadows
  for (const p of players) drawShadow(p);
  drawShadow(ball, true);

  // ball trail then ball
  drawPlayers();
  drawBall();

  requestRadar();
}

function drawPitch(scale){
  const o = W2S(0,0), e = W2S(L,W);
  // stripes
  const bands = 10, bw = (e.x - o.x)/bands;
  for (let i=0;i<bands;i++){ ctx.fillStyle = i%2 ? '#2f7a3d' : '#2b6d38';
    ctx.fillRect(o.x + i*bw, o.y, bw+1, e.y - o.y); }
  ctx.lineWidth = Math.max(2, 0.14*scale);
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  const line = (x1,y1,x2,y2)=>{ const a=W2S(x1,y1),b=W2S(x2,y2); ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke(); };
  const rect = (x,y,w,h)=>{ const a=W2S(x,y); ctx.strokeRect(a.x,a.y,w*scale,h*scale); };
  // outline + halfway
  rect(0,0,L,W);
  line(L/2,0,L/2,W);
  // centre circle + spot
  const c=W2S(L/2,W/2);
  ctx.beginPath(); ctx.arc(c.x,c.y,9.15*scale,0,7); ctx.stroke();
  ctx.beginPath(); ctx.arc(c.x,c.y,0.4*scale,0,7); ctx.fillStyle='#fff'; ctx.fill();
  // boxes both ends
  for (const end of [0,1]){
    const sign = end===0?1:-1, ex = end===0?0:L;
    // penalty box
    rect(end===0?0:L-BOX_D, W/2-BOX_W/2, BOX_D, BOX_W);
    // six-yard
    rect(end===0?0:L-SIX_D, W/2-SIX_W/2, SIX_D, SIX_W);
    // pen spot
    const ps = W2S(ex + sign*12, W/2); ctx.beginPath(); ctx.arc(ps.x,ps.y,0.4*scale,0,7); ctx.fill();
    // arc
    const ac = W2S(ex + sign*12, W/2);
    ctx.beginPath(); ctx.arc(ac.x,ac.y,9.15*scale, end===0?-0.9:Math.PI-0.9, end===0?0.9:Math.PI+0.9); ctx.stroke();
    // goal
    const g1=W2S(ex, W/2-HALF_GOAL), g2=W2S(ex, W/2+HALF_GOAL);
    ctx.strokeStyle='rgba(255,255,255,.95)'; ctx.lineWidth=Math.max(3,0.2*scale);
    const depth = sign* -2.2*scale;
    ctx.strokeRect(Math.min(g1.x,g1.x+depth), g1.y, Math.abs(depth), g2.y-g1.y);
    ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=Math.max(2,0.14*scale);
  }
}

function drawShadow(o, isBall){
  const s = W2S(o.x, o.y);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(s.x, s.y + (isBall?3:5), (isBall?0.5:1.1)*s.s, (isBall?0.3:0.55)*s.s, 0,0,7); ctx.fill();
}

function drawPlayers(){
  for (const p of players){
    const s = W2S(p.x, p.y);
    const team = p.team===0?HOME:AWAY;
    const r = 1.05 * s.s;
    // active ring
    if (p.team===0 && p.idx===active){
      ctx.strokeStyle = COL.sprint; ctx.lineWidth = Math.max(2,0.22*s.s);
      ctx.beginPath(); ctx.arc(s.x, s.y, r+0.55*s.s, 0,7); ctx.stroke();
    }
    // body
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 7);
    ctx.fillStyle = p.isGK ? team.gk : team.kit; ctx.fill();
    ctx.lineWidth = Math.max(1,0.12*s.s); ctx.strokeStyle='rgba(0,0,0,.35)'; ctx.stroke();
    // number
    ctx.fillStyle = p.isGK ? '#fff' : team.num;
    ctx.font = `900 ${Math.max(8,1.0*s.s)}px system-ui, sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(p.num, s.x, s.y+0.05*s.s);
    // facing tick
    ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=Math.max(1,0.14*s.s);
    ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.x+Math.cos(p.dir)*r*1.1, s.y+Math.sin(p.dir)*r*1.1); ctx.stroke();
    // active chevron + name
    if (p.team===0 && p.idx===active){
      ctx.fillStyle = '#2fe0d6';
      ctx.beginPath(); const cy=s.y-r-1.4*s.s;
      ctx.moveTo(s.x-0.7*s.s, cy); ctx.lineTo(s.x+0.7*s.s, cy); ctx.lineTo(s.x, cy+0.9*s.s); ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(0,0,0,.55)';
      ctx.font=`700 ${Math.max(8,0.8*s.s)}px system-ui`;
      const nm=p.name.toUpperCase(); const tw=ctx.measureText(nm).width;
      ctx.fillRect(s.x-tw/2-3, s.y+r+0.4*s.s, tw+6, 1.3*s.s+2);
      ctx.fillStyle='#fff'; ctx.textBaseline='top';
      ctx.fillText(nm, s.x, s.y+r+0.6*s.s);
      ctx.textBaseline='middle';
    }
  }
}

function drawBall(){
  const s = W2S(ball.x, ball.y);
  const r = Math.max(3, 0.55*s.s);
  ctx.beginPath(); ctx.arc(s.x, s.y - (ball.owner>=0?0:2), r, 0, 7);
  ctx.fillStyle='#fff'; ctx.fill();
  ctx.lineWidth=1; ctx.strokeStyle='rgba(0,0,0,.4)'; ctx.stroke();
  ctx.fillStyle='rgba(0,0,0,.55)';
  ctx.beginPath(); ctx.arc(s.x-r*0.25, s.y-2-r*0.2, r*0.34,0,7); ctx.fill();
}

// ---------------------------------------------------------------- radar
function requestRadar(){
  if (!rctx) return;
  const w = radar.width/DPR, h = radar.height/DPR;
  rctx.clearRect(0,0,w,h);
  rctx.fillStyle='rgba(10,26,15,.85)'; rctx.fillRect(0,0,w,h);
  rctx.strokeStyle='rgba(255,255,255,.35)'; rctx.lineWidth=1;
  rctx.strokeRect(2,2,w-4,h-4);
  rctx.beginPath(); rctx.moveTo(w/2,2); rctx.lineTo(w/2,h-2); rctx.stroke();
  rctx.beginPath(); rctx.arc(w/2,h/2,Math.min(w,h)*0.12,0,7); rctx.stroke();
  const rx = wx => 2 + (wx/L)*(w-4), ry = wy => 2 + (wy/W)*(h-4);
  for (const p of players){
    rctx.fillStyle = p.team===0 ? COL.gold : '#8fa9ff';
    if (p.team===1){ // triangle for away
      const x=rx(p.x), y=ry(p.y); rctx.beginPath();
      rctx.moveTo(x,y-2.6); rctx.lineTo(x+2.4,y+2); rctx.lineTo(x-2.4,y+2); rctx.closePath(); rctx.fill();
    } else {
      rctx.beginPath(); rctx.arc(rx(p.x),ry(p.y),2.4,0,7); rctx.fill();
    }
    if (p.team===0 && p.idx===active){
      rctx.strokeStyle=COL.sprint; rctx.lineWidth=1.5;
      rctx.beginPath(); rctx.arc(rx(p.x),ry(p.y),4,0,7); rctx.stroke();
    }
  }
  rctx.fillStyle='#fff'; rctx.beginPath(); rctx.arc(rx(ball.x),ry(ball.y),2,0,7); rctx.fill();
}

// ---------------------------------------------------------------- HUD
function formatClock(){
  const t = Math.max(0, Math.ceil(clock));
  const m = String(Math.floor(t/60)).padStart(2,'0');
  const s = String(t%60).padStart(2,'0');
  return `${m}:${s}`;
}
let toastTimer = null;
function showToast(msg, cls, ms){
  const el = $('toast'); el.textContent = msg;
  el.className = 'toast show ' + (cls||'');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ el.className='toast '+(cls||''); }, ms||900);
}
function updateHudLabels(){
  const inPoss = teamInPossession() === 0;
  $('lblPass').textContent    = inPoss ? 'PASS'    : 'SWITCH';
  $('lblThrough').textContent = inPoss ? 'THROUGH' : 'TACKLE';
  $('lblShoot').textContent   = inPoss ? 'SHOOT'   : 'SLIDE';
}

// ---------------------------------------------------------------- loop
function frame(t){
  if (state !== 'play'){ return; }
  const now = t/1000;
  let dtR = now - lastT; lastT = now;
  if (dtR > 0.05) dtR = 0.05;                 // clamp big gaps
  acc += dtR;
  while (acc >= DT){ if (ball.owner !== -2) step(DT); acc -= DT; clockTick(DT); }
  // charge bar
  if (held.shoot){ shootCharge = clamp((performance.now()-shootStart)/900,0,1);
    $('powerwrap').classList.add('show'); $('powerFill').style.width = (shootCharge*100)+'%'; }
  else $('powerwrap').classList.remove('show');
  updateHudLabels();
  updateJoyArc();
  $('clock').textContent = formatClock();
  draw();
  requestAnimationFrame(frame);
}
function clockTick(dt){
  if (restartLock > 0 || ball.owner === -2) return;
  clock -= dt;
  if (clock <= 0){ clock = 0; endMatch(); }
}

// ---------------------------------------------------------------- match flow
function startMatch(){
  score=[0,0]; clock=MATCH_SECS; kickTeam=0; touchCount[0]=touchCount[1]=0; possFrames=[0,0]; secondHalf=false;
  $('scoreHome').textContent='0'; $('scoreAway').textContent='0';
  setTeamChrome();
  resetPositions(0);
  state='play';
  $('menu').classList.add('hidden'); $('fulltime').classList.add('hidden'); $('game').classList.remove('hidden');
  resize();                        // canvases were 0×0 while #game was hidden — size them now
  showToast('KICK OFF','',900);
  lastT = performance.now()/1000; acc=0;
  requestAnimationFrame(frame);
}
function endMatch(){
  state='fulltime';
  const res = score[0]===score[1] ? 'FULL TIME' : (score[0]>score[1]?`${HOME.abbr} WIN`:`${AWAY.abbr} WIN`);
  $('ftTitle').textContent = res;
  $('ftScore').textContent = `${score[0]} – ${score[1]}`;
  // MOTM: home player with a fun heuristic
  const pool = players.filter(p=>p.team===0 && !p.isGK);
  const motm = pool[Math.floor(Math.random()*pool.length)];
  $('ftMotm').textContent = `MOTM · ${motm.name.toUpperCase()} (${HOME.abbr})   ·   Possession ${possPct()}%`;
  $('fulltime').classList.remove('hidden');
}
function possPct(){ const t=possFrames[0]+possFrames[1]||1; return Math.round(possFrames[0]/t*100); }

function setTeamChrome(){
  $('abbrHome').textContent=HOME.abbr; $('abbrAway').textContent=AWAY.abbr;
  $('crestHome').textContent=HOME.crest; $('crestAway').textContent=AWAY.crest;
  $('crestHome').style.background=HOME.crestBg; $('crestAway').style.background=AWAY.crestBg;
}

// ---------------------------------------------------------------- input wiring
function updateJoyArc(){
  const arc = $('joyArc');
  if (move.mag > 0.12){
    const deg = Math.atan2(move.y, move.x)*180/Math.PI;
    arc.style.borderTopColor='transparent';
    arc.style.background = `conic-gradient(from ${deg-20}deg, ${COL.sprint} 0deg, ${COL.sprint} 40deg, transparent 40deg)`;
    arc.style.borderRadius='50%'; arc.style.opacity=0.5;
  } else { arc.style.background='none'; arc.style.opacity=0; }
}

function bindJoystick(){
  const joy=$('joystick'), knob=$('joyKnob');
  const R=44; let id=null, cx=0, cy=0;
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
  document.querySelectorAll('.act').forEach(btn=>{
    const act=btn.dataset.act;
    const down=e=>{ e.preventDefault(); pressAction(act); };
    const up=e=>{ e.preventDefault(); releaseAction(act); };
    btn.addEventListener('touchstart',down,{passive:false});
    btn.addEventListener('touchend',up); btn.addEventListener('touchcancel',up);
    btn.addEventListener('mousedown',down); btn.addEventListener('mouseup',up);
    btn.addEventListener('mouseleave',e=>{ if(act==='sprint'||act==='shoot') releaseAction(act); });
  });
}

function bindKeyboard(){
  const k={};
  const apply=()=>{ let x=0,y=0; if(k['a']||k['arrowleft'])x-=1; if(k['d']||k['arrowright'])x+=1;
    if(k['w']||k['arrowup'])y-=1; if(k['s']||k['arrowdown'])y+=1;
    const m=Math.hypot(x,y)||1; move.x=x/m*(x||y?1:0); move.y=y/m*(x||y?1:0); move.mag=(x||y)?1:0; };
  window.addEventListener('keydown',e=>{ const key=e.key.toLowerCase();
    if(k[key])return; k[key]=true; apply();
    if(state!=='play')return;
    if(key==='j')pressAction(teamInPossession()===0?'pass':'pass');
    else if(key==='k')pressAction(teamInPossession()===0?'through':'through');
    else if(key==='l')pressAction('shoot');
    else if(key==='shift'){ held.sprint=true; if(teamInPossession()===0) trySkill(); }
  });
  window.addEventListener('keyup',e=>{ const key=e.key.toLowerCase(); k[key]=false; apply();
    if(key==='l')releaseAction('shoot'); if(key==='shift')releaseAction('sprint'); });
}

// ---------------------------------------------------------------- resize / orient
function resize(){
  DPR = Math.min(window.devicePixelRatio||1, 2);
  for (const c of [canvas, radar]){
    const r = c.getBoundingClientRect();
    c.width = Math.max(1, r.width*DPR); c.height = Math.max(1, r.height*DPR);
    c.getContext('2d').setTransform(DPR,0,0,DPR,0,0);
  }
  ctx = canvas.getContext('2d'); rctx = radar.getContext('2d');
  checkOrient();
}
function checkOrient(){
  const landscape = window.innerWidth >= window.innerHeight;
  $('rotate').classList.toggle('hidden', landscape);
}

// ---------------------------------------------------------------- boot
function boot(){
  canvas=$('pitch'); radar=$('radar');
  ctx=canvas.getContext('2d'); rctx=radar.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', ()=>setTimeout(resize,200));
  bindJoystick(); bindButtons(); bindKeyboard();

  $('btnPlay').addEventListener('click', startMatch);
  $('btnHowto').addEventListener('click', ()=>$('howto').classList.remove('hidden'));
  $('btnHowtoClose').addEventListener('click', ()=>$('howto').classList.add('hidden'));
  $('btnRematch').addEventListener('click', startMatch);
  $('btnQuit').addEventListener('click', ()=>{ state='menu';
    $('game').classList.add('hidden'); $('fulltime').classList.add('hidden'); $('menu').classList.remove('hidden'); });
}
if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

// expose a couple of things for debugging / QA in a console
window.GX = { get state(){return state;}, get score(){return score;}, players:()=>players,
  get clock(){return clock;}, endSoon(){ if (state==='play') clock = 1.2; } };
})();
