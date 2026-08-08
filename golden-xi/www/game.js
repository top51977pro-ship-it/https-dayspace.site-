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
  playerBased:false, competitor:false, preset:'Custom', debug:false, replays:true,
  sliders:{ tackleAggression:50, buildupSpeed:50, shotFrequency:50,
            firstTouchPass:50, crossing:50, dribble:50, skillMove:50 },
};
function loadProgress(){
  try {
    tierIndex = clamp(parseInt(localStorage.getItem('gx_tier')||'3',10),0,6);
    bestBeat  = clamp(parseInt(localStorage.getItem('gx_best')||'-1',10),-1,6);
    const s = JSON.parse(localStorage.getItem('gx_settings')||'null');
    if (s){ SETTINGS.playerBased=!!s.playerBased; SETTINGS.competitor=!!s.competitor;
      SETTINGS.preset=s.preset||'Custom'; SETTINGS.debug=!!s.debug; SETTINGS.replays=s.replays!==false;
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
// instant-replay recording + playback
let recBuf = [], replay = null, lastShooter = null, saveReplayCd = 0, repLastT = 0;
const REC_MAX = 340;               // ~5.7s of history at 60 Hz
const fx = { flash:0, parts:[], shake:0 };

const move = { x:0, y:0, mag:0 };
const held = { sprint:false, shoot:false };
let shootStart = 0, shootCharge = 0, skillFlash = 0, autoChase = false;

/* ============================================================================
   AUTHORITATIVE RULES + MATCH FLOW  (fixes the three freeze/steal bugs)
   - GXR: pure Rules Engine (rules.js) — decides; never acts.
   - BallStateController: the ball has exactly ONE authoritative state.
   - MatchFlowController: the ONLY authority that changes the match phase, via a
     single validated TryTransition(). Every restart/goal carries a generation id
     so stale async callbacks can never drive the current match.
   ========================================================================== */
const GXR = (typeof window!=='undefined' && window.GXRules) || null;
const BS = GXR ? GXR.BALL : { DEAD_BALL:'DEAD_BALL',FREE:'FREE',FOOT_CONTROLLED:'FOOT_CONTROLLED',
  KEEPER_HAND_CONTROLLED:'KEEPER_HAND_CONTROLLED',RESTART_LOCKED:'RESTART_LOCKED',
  IN_FLIGHT:'IN_FLIGHT',OUT_OF_PLAY:'OUT_OF_PLAY' };
const PH = GXR ? GXR.PHASE : {};

// match-flow phase (distinct from `state`, which governs the screen: menu/play/replay/fulltime)
let phase = 'IN_PLAY';
let flowGen = 0;          // bumped on every phase change — invalidates stale callbacks
let restartId = 0;        // unique id per restart — stale restart events are ignored
let goalSeq = 0;          // unique id per goal crossing — a goal is processed exactly once
let processedGoal = -1;   // highest goalSeq already scored (dedupe)
let restart = null;       // active restart descriptor (taker, target, timers) or null
let goalTimer = 0;        // real-seconds watchdog inside GOAL/RESET states
let testFastFlow = false; // tests only: shorten celebration/restart delays for fast regression runs

// The one validated transition method. Rejects stale/duplicate transitions.
function tryTransition(expected, next, reason){
  if (phase !== expected){
    if (SETTINGS.debug) console.warn(`[flow] rejected ${phase}→${next} (expected ${expected}) :: ${reason}`);
    return false;
  }
  phase = next; flowGen++;
  if (SETTINGS.debug) console.log(`[flow] ${expected}→${next} gen=${flowGen} :: ${reason}`);
  return true;
}

// ---- BallStateController: one authoritative state, no contradictory booleans ----
function setBallState(s, owner){
  ball.state = s;
  if (owner !== undefined) ball.owner = owner;
  if (s !== BS.KEEPER_HAND_CONTROLLED){ ball.gkHolder = -1; ball.gkHoldT = 0; }
}
function keeperHolding(){ return ball.state === BS.KEEPER_HAND_CONTROLLED && ball.gkHolder >= 0; }

// Dev-build invariant checks — surface contradictory state instead of freezing on it.
function assertInvariants(where){
  if (!SETTINGS.debug) return;
  const problems = [];
  if ((ball.state===BS.DEAD_BALL || ball.state===BS.RESTART_LOCKED) && ball.owner>=0
      && !(restart && restart.takerIdx===ball.owner))
    problems.push('DEAD/LOCKED ball has a dribble owner');
  if (ball.state===BS.KEEPER_HAND_CONTROLLED && !(ball.gkHolder>=0 && players[ball.gkHolder] && players[ball.gkHolder].isGK))
    problems.push('KEEPER_HAND_CONTROLLED without a valid GK owner');
  if (ball.state===BS.FREE && ball.gkHolder>=0) problems.push('ball is both FREE and keeper-held');
  if (problems.length) console.error(`[invariant@${where}]`, problems.join(' | '),
    { phase, state:ball.state, owner:ball.owner, gk:ball.gkHolder, restartId, goalSeq });
}

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
      h3d: 0.92 + (((ratings.pace||60)) % 18) / 100,                 // height varies a bit
      build3d: 0.90 + clamp(((ratings.strength||60)-40)/60,0,1)*0.26, // slim → stocky by strength
      ratings, ovr:ratings.ovr, profile:null, ai:null, aiNext:0, decideInterval:0.27,
      tackleCd:0, stamina:1, slide:0, gait:Math.random()*6.28, gkDiveT:0, gkDiveSide:0, celebrateT:0 });
  }
  return arr;
}
function newBall(){
  return { x:L/2, y:W/2, vx:0, vy:0, owner:-1, kickCd:0,
           state:BS.RESTART_LOCKED, prevx:L/2, prevy:W/2,
           gkHolder:-1, gkHoldT:0, noReHandle:-1 };
}
// FULL (re)build — match start / half start only. Rebuilds squads from scratch.
function resetPositions(kick){
  secondHalf = false;
  players = [...makeTeam(0), ...makeTeam(1)];
  ball = newBall();
  placeKickoff(kick);
}
// Reposition the EXISTING players to their kick-off formation, PRESERVING their
// profiles / AI / ratings. This is the bug-3 fix: the old code rebuilt every player
// with profile:null and never re-assigned, so the next AI tick threw and the frame
// loop died (permanent freeze). Force-placing existing players cannot do that.
function placeKickoff(kick){
  for (const p of players){
    const hp = homePos(p.team, p.form);
    p.x = hp.x; p.y = hp.y; p.vx = 0; p.vy = 0;
    p.dir = p.team === 0 ? 0 : Math.PI;
    p.ai = null; p.slide = 0; p.tackleCd = 0; p.celebrateT = 0; p.gkDiveT = 0;
    if (p.stamina == null) p.stamina = 1;
  }
  ball.x = L/2; ball.y = W/2; ball.vx = 0; ball.vy = 0; ball.prevx = L/2; ball.prevy = W/2;
  ball.kickCd = 0; ball.gkHolder = -1; ball.gkHoldT = 0; ball.noReHandle = -1;
  const g = players.filter(p => p.team === kick && !p.isGK).sort((a,b)=>a.idx-b.idx);
  const taker = g.find(p=>p.role==='FW') || g[g.length-1] || players[kick*11+9];
  taker.x = L/2 - (kick===0 ? 1.2 : -1.2); taker.y = W/2;
  const ti = players.indexOf(taker);
  ball.owner = ti; setBallState(BS.FOOT_CONTROLLED, ti); lastTouch = kick;
  // safety net: if any profile is missing (e.g. loaded state), re-assign so AI never
  // dereferences null. Cheap and idempotent.
  if (players.some(p=>!p.profile)) { try { assignProfiles(); } catch(e){} }
  active = kick === 0 ? ti : nearestHomeToBall();
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
    if (p.actT) { p.actT = Math.max(0, p.actT - dt); if (p.actT === 0) p.act = null; }   // 3D kick/pass anim window
    if (p.gkDiveT) p.gkDiveT = Math.max(0, p.gkDiveT - dt);
    if (p.celebrateT) p.celebrateT = Math.max(0, p.celebrateT - dt);
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

  if (restart && !restart.kicked){
    updateRestart(dt);                 // restart being set up / taken — RestartManager owns the ball
  } else {
    executeOwnerAction(world);
    tackling(world);
    updateBall(dt);
    if (restart && restart.kicked) updateRestart(dt);   // detect the restart is now in play
  }
  assertInvariants('step');
  cameraFollow(dt);
  if (possTeam >= 0) possFrames[possTeam]++;
  updateFX(dt);
  recBuf.push(snapshot()); if (recBuf.length > REC_MAX) recBuf.shift();   // record for replays
  saveReplayCd = Math.max(0, saveReplayCd - dt);
}

// ---------------------------------------------------------------- instant replay
function snapshot(){
  const a = new Float32Array(22*6 + 2);
  for (let i=0;i<22;i++){ const p=players[i], o=i*6;
    a[o]=p.x; a[o+1]=p.y; a[o+2]=p.dir; a[o+3]=p.gait; a[o+4]=p.vx; a[o+5]=p.vy; }
  a[132]=ball.x; a[133]=ball.y; return a;
}
function applyFrame(a){
  for (let i=0;i<22;i++){ const p=players[i], o=i*6;
    p.x=a[o]; p.y=a[o+1]; p.dir=a[o+2]; p.gait=a[o+3]; p.vx=a[o+4]; p.vy=a[o+5]; }
  ball.x=a[132]; ball.y=a[133];
}
function startReplay(focus, kind){
  // too little footage → skip the replay; the goal flow's flowTick watchdog reaches kick-off
  if (!SETTINGS.replays || recBuf.length < 40) return;
  const end = recBuf.length - 1;
  const start = Math.max(0, end - Math.floor(3.4*60));      // last ~3.4 seconds
  replay = { kind, focus: focus ? players.indexOf(focus) : nearestHomeToBall(),
             start, end, segs:['sideLow','behindGoal','pov'], seg:0, cursor:start };
  players.forEach(p=>{ p.celebrateT=0; });   // replayed footage shows natural running, not frozen celebration
  state = 'replay'; repLastT = 0;
  { const g=$('game'); if(g) g.classList.add('replaying'); }
  const b = $('replayBadge'); if (b) b.classList.remove('hidden');
  showToast(kind==='goal' ? 'REPLAY' : 'CHANCE!', '', 800);
}
function scheduleKickoff(){ beginGoalReset(); }   // kept for compatibility; routes through the flow
function replayCam(mode){
  const bx=ball.x, bz=ball.y;
  if (mode==='sideLow')    return { px:bx, py:6.5, pz:W+13, lx:bx, ly:1.2, lz:W/2 };
  if (mode==='behindGoal'){ const right = bx > L/2;
    return right ? { px:L+16, py:9, pz:W/2, lx:L-14, ly:1.2, lz:W/2 }
                 : { px:-16,  py:9, pz:W/2, lx:14,   ly:1.2, lz:W/2 }; }
  // pov — first person from the focus player's eyes, gaze toward the ball & pitch ahead
  const f = players[replay.focus] || players[0];
  let gx = bx - f.x, gz = bz - f.y;                 // look toward the ball he's chasing/carrying
  const gm = Math.hypot(gx, gz);
  if (gm < 3){ gx = Math.cos(f.dir); gz = Math.sin(f.dir); }   // ball right at feet → look along run
  else { gx/=gm; gz/=gm; }
  return { px:f.x + gx*0.35, py:1.74, pz:f.y + gz*0.35,        // eye height, just ahead of the head
           lx:f.x + gx*9, ly:0.35, lz:f.y + gz*9 };            // gaze tilts down onto the grass ahead
}
function replayTick(){
  const now=performance.now()/1000; let dtR=now-(repLastT||now); repLastT=now; if(dtR>0.05)dtR=0.05;
  const seg = replay.segs[replay.seg];
  const speed = seg==='pov' ? 1.0 : 0.42;                  // slow-mo except the POV pass
  replay.cursor += dtR*60*speed;
  if (replay.cursor >= replay.end){
    replay.seg++;
    if (replay.seg >= replay.segs.length){ finishReplay(); return; }
    replay.cursor = replay.start;
  }
  applyFrame(recBuf[Math.min(replay.end, Math.floor(replay.cursor))]);
  if (window.Scene3D && Scene3D.ready()) Scene3D.frame(players, ball, -1, 0, 0, replayCam(seg));
  const lbl = $('replayLabel'); if (lbl) lbl.textContent = seg==='pov' ? 'PLAYER VIEW' : 'SLOW MOTION';
}
function finishReplay(){
  const kind = replay.kind; replay = null; repLastT = 0;
  { const g=$('game'); if(g) g.classList.remove('replaying'); }
  const b = $('replayBadge'); if (b) b.classList.add('hidden');
  state='play'; lastT=performance.now()/1000; acc=0;
  if (kind==='goal') beginGoalReset();    // robust reset (force-place, preserve profiles) → kick-off
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
  fireBall(owner, dir, speed, cross ? 'cross' : 'pass'); ball.kickCd = KICK_COOLDOWN; touchCount[owner.team]++; ball.lastAct = simTime;
}
function cpuShoot(owner, prof){
  lastShooter = owner;
  const gx = goalX(owner.team), gy = W/2;
  const opp = nearestOpponentTo(owner, owner.team);
  const sigmaM = GXAI.shotPlacementError(owner, prof, { pressure: opp.d < 2.6, weakFoot:false });
  const aimY = gy + GXAI._randn()*sigmaM;                 // unclamped → poor finishers miss the target
  const dir = norm(gx - owner.x, aimY - owner.y);
  const power = 0.6 + Math.random()*0.35;
  fireBall(owner, dir, clamp(24 + power*20, 24, 46), 'shot'); ball.kickCd = KICK_COOLDOWN;
  touchCount[owner.team]++; ball.lastAct = simTime;
}
function cpuClear(owner){
  const gx = goalX(owner.team);
  fireBall(owner, norm(gx - owner.x, (Math.random()*2-1)*0.6), 30, 'shot');
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
  // BUG-1 FIX: a keeper in secure hand control is challenge-protected. No tackle,
  // no "steal", no possession transfer until the release frame. (Law 12 / keeper
  // hand control.) A parry/rebound is state FREE, not KEEPER_HAND_CONTROLLED, so
  // those loose balls are still contestable — this guard only fires on a real catch.
  if (owner.isGK && keeperHolding()) return;
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

// ==================================================================== ball + rules
// One authoritative ball state; continuous whole-ball boundary/goal detection;
// keeper hand-control protection; all restarts through the RestartManager.
function recordTouch(idx, bodyPart, touchType, controlled, deliberate){
  const p = players[idx]; if (!p) return;
  ball.lastTouchEvent = { playerId:p.idx, teamId:p.team, timestamp:simTime, physicsFrame:0,
    position:{x:ball.x,y:ball.y}, bodyPart, touchType,
    deliberatePlay:!!deliberate, deliberateSave:false, controlledPossession:!!controlled };
  lastTouch = p.team;
}
function updateBall(dt){
  ball.prevx = ball.x; ball.prevy = ball.y;      // swept-crossing baseline (whole-ball test)

  // --- keeper in SECURE hand control: glued, protected, 8-second timer, distribution ---
  if (keeperHolding()){ keeperUpdate(dt); return; }

  const owner = ballOwner();
  if (owner && ball.state !== BS.RESTART_LOCKED){
    if (ball.state !== BS.FOOT_CONTROLLED) setBallState(BS.FOOT_CONTROLLED, ball.owner);
    const lead = DRIBBLE_LEAD * (held.sprint && owner.idx===active ? 1.9 : 1.15);
    ball.x = lerp(ball.x, owner.x + Math.cos(owner.dir)*lead, 0.5);
    ball.y = lerp(ball.y, owner.y + Math.sin(owner.dir)*lead, 0.5);
    ball.vx = owner.vx; ball.vy = owner.vy; lastTouch = owner.team;
    if (ball.noReHandle >= 0 && ball.owner !== ball.noReHandle) ball.noReHandle = -1;
    return;
  }

  // --- FREE ball physics ---
  const fr = Math.pow(BALL_FRICTION, dt);
  ball.vx *= fr; ball.vy *= fr;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt;
  if (ball.state !== BS.FREE && ball.state !== BS.IN_FLIGHT) setBallState(BS.FREE, -1);

  // --- goalkeeper reaching a free ball: SECURE CATCH vs PARRY (rebound stays FREE) ---
  for (const p of players){ if (!p.isGK) continue;
    const gi = players.indexOf(p);
    if (gi === ball.noReHandle) continue;                 // may not re-handle own release yet
    const gr = p.ratings || {};
    const catchR = 1.4 + ((gr.diving||60)/100)*1.5 + ((gr.reflexes||60)/100)*0.6;
    const bsp = len(ball.vx, ball.vy);
    if (dist(p, ball) >= catchR) continue;
    const res = GXR ? GXR.keeperCatch({ dist:dist(p,ball), catchR, ballSpeed:bsp,
                        handling:(gr.reflexes||gr.diving||60), rng:Math.random() })
                    : { secure: bsp < 20, parry: bsp >= 20 };
    if (bsp > 15){ p.gkDiveT = 0.6; p.gkDiveSide = Math.sign(ball.y - p.y) || 1; }   // dive anim
    if (bsp > 24 && SETTINGS.replays && saveReplayCd <= 0 && lastShooter && phase==='IN_PLAY' &&
        Math.abs(goalX(lastShooter.team) - lastShooter.x) < 30){
      saveReplayCd = 14; startReplay(lastShooter, 'save');
    }
    if (res.secure){
      // back-pass / handling offence: keeper may not handle a deliberate team-mate pass / throw-in
      const off = GXR && GXR.keeperHandlingOffence(ball.lastTouchEvent, p);
      if (off && phase==='IN_PLAY'){ off.x = p.x; off.y = p.y; awardRestart(off); return; }
      ball.gkHolder = gi; ball.gkHoldT = 0;
      setBallState(BS.KEEPER_HAND_CONTROLLED, gi); lastTouch = p.team;
      recordTouch(gi, 'hand', 'save', true, false);
      ball.vx = ball.vy = 0; ball.kickCd = KICK_COOLDOWN;
      return;
    } else {                                              // PARRY — deflect, ball stays contestable
      const away = norm(ball.x - p.x, ball.y - p.y);
      const psp = Math.min(bsp*0.55, 15);
      ball.vx = away.x*psp + (Math.random()*2-1)*2; ball.vy = away.y*psp + (Math.random()*2-1)*2;
      lastTouch = p.team; ball.noReHandle = -1; setBallState(BS.FREE, -1);
      recordTouch(gi, 'hand', 'parry', false, false); ball.kickCd = 0.12;
      return;
    }
  }

  // --- outfield control acquisition ---
  if (ball.kickCd <= 0){
    let best = null, bd = CONTROL_R;
    for (const p of players){ if (p.isGK) continue; const d = dist(p, ball); if (d < bd){ bd = d; best = p; } }
    if (best){ const bi = players.indexOf(best); setBallState(BS.FOOT_CONTROLLED, bi);
      ball.vx = ball.vy = 0; lastTouch = best.team; ball.noReHandle = -1;
      recordTouch(bi, 'foot', 'control', true, false); }
  }

  // --- continuous whole-ball boundary / goal detection (open play only) ---
  if (phase === 'IN_PLAY' && GXR){
    const dec = GXR.evaluateBoundary({ prev:{x:ball.prevx,y:ball.prevy},
                  cur:{x:ball.x,y:ball.y}, lastTouchTeam:lastTouch });
    if (dec){
      if (dec.type === 'GOAL') onGoal(dec.scoringTeamId);
      else awardRestart(dec);
    }
  }
}

// ---- goalkeeper hand control (bug-1 fix: protected, 8s rule, legal release) ----
function keeperUpdate(dt){
  const gk = players[ball.gkHolder];
  if (!gk || !gk.isGK){ setBallState(BS.FREE, -1); return; }
  ball.x = gk.x + Math.cos(gk.dir)*0.7; ball.y = gk.y + Math.sin(gk.dir)*0.7;
  ball.vx = ball.vy = 0; ball.owner = ball.gkHolder; lastTouch = gk.team;
  ball.gkHoldT += dt;
  const viol = GXR && GXR.keeperHoldViolation(ball.gkHoldT, gk.team, gk.y);   // 8-second rule → corner
  if (viol){ awardRestart(viol); return; }
  const pressed = nearestOpponentTo(gk, gk.team).d < 6.5;
  const holdMax = pressed ? 0.7 : 1.6;                    // release before pressure / after a beat
  if (ball.gkHoldT >= holdMax) keeperDistribute(gk);
}
function keeperDistribute(gk){
  const mates = players.filter(p => p.team===gk.team && !p.isGK);
  const dirSign = gk.team===0 ? 1 : -1;
  let best=null, bs=-1e9;
  for (const m of mates){ const forward=(m.x-gk.x)*dirSign; const opp=nearestOpponentTo(m,gk.team).d;
    const sc = forward*0.5 + opp*0.7 - Math.abs(m.y-gk.y)*0.04; if (sc>bs){ bs=sc; best=m; } }
  const target = best || mates[0] || gk;
  const long = nearestOpponentTo(gk,gk.team).d < 6 || Math.random() < 0.35;
  const dir = norm(target.x - gk.x, target.y - gk.y);
  const gi = ball.gkHolder;
  ball.gkHolder = -1; ball.gkHoldT = 0;
  fireBall(gk, dir, long ? 30 : 18);                      // detach → restore physics → velocity
  ball.noReHandle = gi;                                   // no re-handle before another player touches
  ball.kickCd = KICK_COOLDOWN; lastTouch = gk.team;
}

// ======================================================= RestartManager
// One authoritative, transactional path for every restart (goal kick / corner /
// throw-in / indirect FK). Guarantees the ball is put back into play — never an
// infinite wait on an animation, a path or an unavailable player (bug-2 fix).
function pickRestartTaker(type, team, spot){
  if (type === 'GOAL_KICK'){
    const gk = players.find(p => p.isGK && p.team===team);
    if (gk) return gk;
  }
  let best=null, bd=1e9;
  for (const p of players){ if (p.team!==team) continue;
    if (type!=='GOAL_KICK' && p.isGK) continue;
    const d = Math.hypot(p.x-spot.x, p.y-spot.y); if (d<bd){ bd=d; best=p; } }
  return best || players.find(p=>p.team===team && !p.isGK) || players.find(p=>p.team===team);
}
function awardRestart(dec){
  if (!dec) return;
  restartId++;
  let type = dec.type, team = dec.restartTeamId, spot, label, ph;
  if (type==='CORNER'){ spot=GXR.cornerSpot(dec.lineX, dec.side); label='CORNER'; ph='CORNER_SETUP'; }
  else if (type==='THROW_IN'){ spot={x:clamp(dec.x,1,L-1), y: dec.side===0?0.6:W-0.6}; label='THROW IN'; ph='THROW_IN_SETUP'; }
  else if (type==='INDIRECT_FK'){ spot={x:clamp(dec.x,2,L-2), y:clamp(dec.y,2,W-2)}; label='FREE KICK'; ph='THROW_IN_SETUP'; }
  else { type='GOAL_KICK'; spot=GXR.goalKickSpot(team); label='GOAL KICK'; ph='GOAL_KICK_SETUP'; }
  // transactional entry: stop battles, lock ball, clear owner/keeper, place legally, zero velocity
  setBallState(BS.RESTART_LOCKED, -1);
  ball.vx=ball.vy=0; ball.gkHolder=-1; ball.gkHoldT=0; ball.kickCd=0; ball.noReHandle=-1;
  ball.x=spot.x; ball.y=spot.y; ball.prevx=spot.x; ball.prevy=spot.y;
  for (const p of players){ if (p.ai) p.ai.action=null; p.slide=0; }
  phase = ph; flowGen++;
  const taker = pickRestartTaker(type, team, spot);
  const ti = players.indexOf(taker);
  if (taker){ taker.x = (type==='THROW_IN') ? clamp(spot.x,1,L-1) : spot.x - (team===0?1.0:-1.0);
    taker.y = spot.y; taker.vx=taker.vy=0; }
  ball.owner = ti;
  restart = { id:restartId, type, team, takerIdx:ti, spot:{x:spot.x,y:spot.y},
              t:0, kicked:false, gen:flowGen, ready: testFastFlow?0.15:0.7, hard: testFastFlow?1.0:3.5 };
  lastTouch = team;
  active = team===0 ? (ti>=0?ti:nearestHomeToBall()) : nearestHomeToBall();
  restartLock = 0.3;
  showToast(label,'',700);
}
function updateRestart(dt){
  if (!restart) return;
  restart.t += dt;
  const taker = players[restart.takerIdx];
  if (!restart.kicked){
    ball.x = restart.spot.x; ball.y = restart.spot.y; ball.vx=ball.vy=0;
    if (taker){ ball.owner = restart.takerIdx;
      taker.x = lerp(taker.x, restart.spot.x - (restart.team===0?0.9:-0.9), 0.4);
      taker.y = lerp(taker.y, restart.spot.y, 0.4); }
    // take the kick after the ready delay; FORCE it at the hard deadline (no infinite wait)
    if (restart.t >= restart.ready || restart.t >= restart.hard) takeRestartKick(restart.t >= restart.hard);
    return;
  }
  // ball kicked: resume once it is clearly in play (moved away from the spot), or shortly after
  const moved = Math.hypot(ball.x-restart.spot.x, ball.y-restart.spot.y) > 1.5;
  const settle = (restart.t - (restart.kickAt || restart.t)) > 0.4;   // bounded post-kick settle
  if (moved || settle || restart.t >= restart.hard + 1.0){
    phase = 'IN_PLAY'; flowGen++;
    if (ball.state === BS.RESTART_LOCKED) setBallState(BS.FREE, -1);
    restart = null;
  }
}
function takeRestartKick(forced){
  const r = restart; if (!r) return;
  let taker = players[r.takerIdx];
  if (!taker){ taker = pickRestartTaker(r.type, r.team, r.spot); r.takerIdx = players.indexOf(taker); }
  if (!taker){                                            // last resort — force-place the keeper
    const gk = players.find(p=>p.isGK && p.team===r.team);
    if (gk){ gk.x=r.spot.x; gk.y=r.spot.y; taker=gk; r.takerIdx=players.indexOf(gk); }
  }
  const dirSign = r.team===0 ? 1 : -1;
  const mates = players.filter(p => p.team===r.team && !p.isGK && players.indexOf(p)!==r.takerIdx);
  let best=null, bs=-1e9;
  for (const m of mates){ const forward=(m.x-r.spot.x)*dirSign; const opp=nearestOpponentTo(m,r.team).d;
    const sc = forward*0.5 + opp*0.7 - Math.abs(m.y-r.spot.y)*0.03; if (sc>bs){ bs=sc; best=m; } }
  let dir, speed;
  if (forced || !best){ dir = { x:dirSign, y:(Math.random()*2-1)*0.25 }; speed = r.type==='THROW_IN'?16:30; }
  else { const long = r.type!=='THROW_IN' && (Math.random()<0.5 || nearestOpponentTo(taker,r.team).d<7);
    dir = norm(best.x-r.spot.x, best.y-r.spot.y); speed = r.type==='THROW_IN'?16:(long?30:20); }
  if (taker) fireBall(taker, dir, speed);
  else { ball.owner=-1; ball.vx=dir.x*30; ball.vy=dir.y*30; setBallState(BS.IN_FLIGHT,-1); }
  ball.kickCd = KICK_COOLDOWN; r.kicked = true; r.kickAt = r.t; ball.noReHandle = -1;
}

// ======================================================= goal + reset (bug-3 fix)
function onGoal(team){
  const seq = ++goalSeq;
  if (phase !== 'IN_PLAY') return;                        // only score from open play
  if (processedGoal >= seq) return;                       // dedupe
  if (!tryTransition('IN_PLAY','GOAL_SCORED','goal by team '+team)) return;
  processedGoal = seq;
  score[team]++;                                          // score EXACTLY once
  kickTeam = 1 - team;
  for (const p of players){ if (p.ai) p.ai.action = null; }   // cancel pending AI
  restart = null;
  setBallState(BS.DEAD_BALL, -2); ball.vx=ball.vy=0; ball.x=L/2; ball.y=W/2;
  ball.gkHolder=-1; ball.gkHoldT=0;
  const cgk = players.find(p => p.isGK && p.team === 1-team);
  if (cgk){ cgk.gkDiveT = 0.7; cgk.gkDiveSide = Math.sign(ball.y - cgk.y) || 1; }
  if (window.Scene3D && Scene3D.ready() && Scene3D.celebrate)
    Scene3D.celebrate(ball.x, ball.y, team===0 ? 0xF5C518 : 0x2b3a67);
  players.filter(p=>p.team===team && !p.isGK).sort((a,b)=>dist(a,ball)-dist(b,ball))
         .slice(0,3).forEach(p=> p.celebrateT = 1.7);
  $('scoreHome').textContent = score[0]; $('scoreAway').textContent = score[1];
  showToast(team===0?'GOAL!':'CONCEDED', team===0?'goal':'', 1200);
  navigator.vibrate && navigator.vibrate(team===0?[40,40,80]:40);
  spawnConfetti(team===0); fx.flash = 0.9; fx.shake = 1;
  { const fl=$('flash'); if(fl){ fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); } }
  goalTimer = 0;
  tryTransition('GOAL_SCORED','GOAL_CELEBRATION','celebrate');
  const scorer = (lastShooter && lastShooter.team === team) ? lastShooter
    : players.filter(p => p.team === team && !p.isGK).sort((a,b)=>dist(a,ball)-dist(b,ball))[0];
  if (SETTINGS.replays) startReplay(scorer, 'goal');     // finishReplay → beginGoalReset
  // (if replays off, the flowTick watchdog in frame() calls beginGoalReset)
}
// Robust post-goal reset: FORCE-PLACE existing players (preserving profiles), re-arm,
// reach kick-off. Cannot deadlock — no waiting for perfect navigation.
function beginGoalReset(){
  if (phase!=='GOAL_CELEBRATION' && phase!=='GOAL_SCORED' && phase!=='RESET_AFTER_GOAL') return;
  phase = 'RESET_AFTER_GOAL'; flowGen++;
  restart = null;
  placeKickoff(kickTeam);          // preserves profiles/AI/ratings → no null-profile crash
  restartId++;
  goalTimer = 0;
  phase = 'IN_PLAY'; flowGen++;    // (KICKOFF_READY collapsed; restartLock briefly gates input)
  showToast('KICK OFF','',700);
}
function flowTick(dt){
  goalTimer += dt;
  if (goalTimer > (testFastFlow ? 0.25 : 1.2)) beginGoalReset();   // absolute watchdog — never stuck
}
function recoverFromError(){
  try { restart = null; phase = 'IN_PLAY';
        if (players.some(p=>!p.profile)){ try { assignProfiles(); } catch(e){} }
        placeKickoff(kickTeam); }
  catch(e){ console.error('[recover] failed', e); }
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
    fireBall(owner, norm(tx-owner.x, ty-owner.y), 27, 'cross');
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
  lastShooter = from;
  const gx = goalX(from.team), gy = W/2;
  let aimY = gy + move.y * HALF_GOAL * 0.9;
  aimY = clamp(aimY, gy - HALF_GOAL + 0.6, gy + HALF_GOAL - 0.6);
  const errMul = D ? D.shotErr : 1.9;
  aimY += (errMul) * (1 - power) * (Math.random()*2 - 1);
  const dir = norm(gx - from.x, aimY - from.y);
  const speed = clamp(20 + power*24, 20, 46);
  fireBall(from, dir, speed, 'shot'); ball.kickCd = KICK_COOLDOWN; touchCount[from.team]++;
  navigator.vibrate && navigator.vibrate(20);
}
function fireBall(from, dir, speed, act){
  ball.owner = -1; ball.x = from.x + dir.x*1.1; ball.y = from.y + dir.y*1.1;
  ball.vx = dir.x*speed; ball.vy = dir.y*speed; from.tackleCd = 0.15;
  ball.lastAct = performance.now()/1000;
  setBallState(BS.IN_FLIGHT, -1); ball.noReHandle = -1;
  from.act = act || 'pass'; from.actT = 0.30;   // one-shot 3D kick/pass animation (PassRight/KickRight)
  recordTouch(players.indexOf(from), 'foot', 'kick', false, true);   // deliberate foot play
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
  if (testFastFlow) return;   // headless regression runs skip the (slow software-WebGL) render
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
  if (state === 'replay'){ replayTick(); requestAnimationFrame(frame); return; }
  if (state !== 'play') return;
  const now = t/1000; let dtR = now - lastT; lastT = now;
  if (dtR > 0.05) dtR = 0.05; acc += dtR;
  // A stray exception must NEVER kill the loop (that was the permanent freeze). Any throw
  // is caught, logged, and the match force-recovers to kick-off; rAF keeps running.
  try {
    while (acc >= DT){
      const frozen = (phase==='GOAL_SCORED' || phase==='GOAL_CELEBRATION' || phase==='RESET_AFTER_GOAL');
      if (frozen){ flowTick(DT); updateFX(DT); }
      else { step(DT); clockTick(DT); }
      acc -= DT;
    }
  } catch(err){ console.error('[frame] step threw — recovering to kick-off', err); recoverFromError(); acc = 0; }
  if (held.shoot){ shootCharge = clamp((performance.now()-shootStart)/900,0,1);
    $('powerwrap').classList.add('show'); $('powerFill').style.width=(shootCharge*100)+'%'; }
  else $('powerwrap').classList.remove('show');
  updateHudLabels(); updateJoyArc();
  $('clock').textContent = formatClock();
  draw();
  if (SETTINGS.debug) updateDebug();
  requestAnimationFrame(frame);
}
function clockTick(dt){ if (restartLock>0 || phase!=='IN_PLAY') return;
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
  recBuf=[]; replay=null; lastShooter=null; saveReplayCd=0; repLastT=0;
  // reset the match-flow state machine + ball-state controller
  phase='IN_PLAY'; flowGen=0; restartId=0; goalSeq=0; processedGoal=-1; restart=null; goalTimer=0;
  { const b=$('replayBadge'); if(b) b.classList.add('hidden'); const g=$('game'); if(g) g.classList.remove('replaying'); }
  setTeamChrome();
  GXAI.beginMatch((tierIndex*7919 + (SETTINGS.competitor?3:0) + 20260730) >>> 0);   // seed (locks difficulty for the match)
  resetPositions(0);
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
  const pb = $('optPlayerBased'), cm = $('optCompetitor'), pr = $('optPreset'), db = $('optDebug'), rp = $('optReplays');
  if (pb){ pb.checked = SETTINGS.playerBased; pb.addEventListener('change', ()=>{ SETTINGS.playerBased=pb.checked; saveProgress(); }); }
  if (cm){ cm.checked = SETTINGS.competitor; cm.addEventListener('change', ()=>{ SETTINGS.competitor=cm.checked; saveProgress(); }); }
  if (db){ db.checked = SETTINGS.debug; db.addEventListener('change', ()=>{ SETTINGS.debug=db.checked; saveProgress(); }); }
  if (rp){ rp.checked = SETTINGS.replays; rp.addEventListener('change', ()=>{ SETTINGS.replays=rp.checked; saveProgress(); }); }
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
  teamState(){ return GXAI.teamState; },
  get replay(){ return replay; },
  forceReplay(seg){ lastShooter = nearestHomeToBall(); startReplay(lastShooter,'goal');
    if(replay && seg!=null){ replay.seg = seg; } },
  replaySeg(){ return replay ? replay.segs[replay.seg] : null; },
  // ---- authoritative-flow inspection + deterministic test hooks ----
  get phase(){ return phase; },
  get ballState(){ return ball ? ball.state : null; },
  get gkHolder(){ return ball ? ball.gkHolder : -1; },
  get gkHoldT(){ return ball ? ball.gkHoldT : 0; },
  get restartActive(){ return !!restart; },
  ball(){ return { x:ball.x, y:ball.y, vx:ball.vx, vy:ball.vy, owner:ball.owner,
                   state:ball.state, gkHolder:ball.gkHolder }; },
  // force the keeper of `team` into secure hand control right now (steal-protection test)
  gkGrab(team){ const gk = players.find(p=>p.isGK && p.team===team); if(!gk) return false;
    ball.x = gk.x + Math.cos(gk.dir)*0.7; ball.y = gk.y + Math.sin(gk.dir)*0.7;
    ball.vx=ball.vy=0; ball.gkHolder=players.indexOf(gk); ball.gkHoldT=0;
    setBallState(BS.KEEPER_HAND_CONTROLLED, players.indexOf(gk)); lastTouch=team; return true; },
  // drop an attacker of `1-team` right on top of the keeper to try to steal
  swarmKeeper(team){ const gk=players.find(p=>p.isGK&&p.team===team); if(!gk) return;
    players.filter(p=>p.team!==team && !p.isGK).slice(0,3).forEach((a,i)=>{
      a.x=gk.x+(i-1)*0.4; a.y=gk.y+0.3; a.vx=a.vy=0; }); },
  // fire the ball into `team`'s goal from open play (goal-processing test)
  forceGoal(team){ const intoX = team===0 ? L : 0;   // team scores into the OTHER goal
    if (phase!=='IN_PLAY'){ phase='IN_PLAY'; }
    ball.gkHolder=-1; setBallState(BS.IN_FLIGHT,-1); ball.owner=-1;
    // place it just short of the line and past the keeper's reach so it crosses cleanly
    ball.x = intoX===0 ? 1.5 : L-1.5; ball.y = W/2;
    ball.prevx = ball.x; ball.prevy = ball.y;
    ball.vx = (intoX===0 ? -1 : 1)*60; ball.vy = 0; lastTouch = team;
    ball.lastTouchEvent = { playerId:9, teamId:team, bodyPart:'foot', touchType:'shot', deliberatePlay:true }; },
  // put the ball out for a goal kick to `team` (goal-kick restart test)
  forceGoalKick(team){ if (GXR) awardRestart({ type:'GOAL_KICK', restartTeamId:team, decisionId:0 }); },
  forceCorner(team){ if (GXR) awardRestart({ type:'CORNER', restartTeamId:team, lineX: team===0?0:L, side:0 }); },
  restartInfo(){ return restart ? { type:restart.type, team:restart.team, kicked:restart.kicked,
                   t:+restart.t.toFixed(2), takerIdx:restart.takerIdx } : null; },
  testFast(v){ testFastFlow = !!v; },
  setReplays(v){ SETTINGS.replays = !!v; } };
})();
