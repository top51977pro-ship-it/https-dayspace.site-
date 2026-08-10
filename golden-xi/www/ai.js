/* ============================================================================
   GOLDEN XI — CPU AI & difficulty system  (FC-style, 4 layers)
   Perception → TeamBrain → PlayerBrain → (execution done by game.js).
   Pure logic, no DOM, no three.js — also require()-able for tests.
   Coordinates: world x in [0,L] (team 0 attacks +x, team 1 attacks -x),
   y in [0,W]. Difficulty changes DECISIONS, never raw speed/attributes.
   ========================================================================== */
(function (root) {
'use strict';

// ---------------------------------------------------------------- profiles
const TIERS = ['Beginner','Amateur','Semi-Pro','Professional','World Class','Legendary','Ultimate'];
const TIER_DESC = [
  'Barely presses, slow to react, loose technique.',
  'Learning shape; late reactions, misplaced passes.',
  'Organised but modest; a fair contest.',
  'Solid team play, sensible decisions.',
  'Sharp perception, quick reactions, clinical.',
  'Reads danger early, coordinated press, few errors.',
  'Elite decisions, minimal errors — beat it on merit.'];

const PROFILES = {
  Beginner:    { attackIQ:0.10, defenseIQ:0.10, reactionRating:0.20, markingAndSpace:0.15,
    reactionDelayMs:[600,850], decisionIntervalMs:480, perceptionNoiseMeters:2.50, predictionHorizonSeconds:0.25,
    candidateLimit:2, choiceTemperature:1.80, suboptimalChoiceChance:0.30,
    passErrorMultiplier:1.45, shotErrorMultiplier:1.55, firstTouchErrorMultiplier:1.40,
    tackleTimingErrorMs:280, markingSlackMeters:3.00, teamCoordination:0.10 },
  Amateur:     { attackIQ:0.20, defenseIQ:0.20, reactionRating:0.40, markingAndSpace:0.30,
    reactionDelayMs:[480,700], decisionIntervalMs:400, perceptionNoiseMeters:2.00, predictionHorizonSeconds:0.45,
    candidateLimit:3, choiceTemperature:1.55, suboptimalChoiceChance:0.24,
    passErrorMultiplier:1.30, shotErrorMultiplier:1.38, firstTouchErrorMultiplier:1.28,
    tackleTimingErrorMs:230, markingSlackMeters:2.60, teamCoordination:0.20 },
  'Semi-Pro':  { attackIQ:0.40, defenseIQ:0.40, reactionRating:0.50, markingAndSpace:0.50,
    reactionDelayMs:[350,520], decisionIntervalMs:330, perceptionNoiseMeters:1.40, predictionHorizonSeconds:0.75,
    candidateLimit:4, choiceTemperature:1.30, suboptimalChoiceChance:0.17,
    passErrorMultiplier:1.18, shotErrorMultiplier:1.22, firstTouchErrorMultiplier:1.16,
    tackleTimingErrorMs:180, markingSlackMeters:2.20, teamCoordination:0.40 },
  Professional:{ attackIQ:0.50, defenseIQ:0.50, reactionRating:0.70, markingAndSpace:0.60,
    reactionDelayMs:[250,400], decisionIntervalMs:270, perceptionNoiseMeters:0.90, predictionHorizonSeconds:1.05,
    candidateLimit:5, choiceTemperature:1.05, suboptimalChoiceChance:0.11,
    passErrorMultiplier:1.05, shotErrorMultiplier:1.08, firstTouchErrorMultiplier:1.05,
    tackleTimingErrorMs:135, markingSlackMeters:1.80, teamCoordination:0.50 },
  'World Class':{ attackIQ:0.75, defenseIQ:0.75, reactionRating:0.80, markingAndSpace:0.80,
    reactionDelayMs:[180,300], decisionIntervalMs:220, perceptionNoiseMeters:0.55, predictionHorizonSeconds:1.35,
    candidateLimit:7, choiceTemperature:0.80, suboptimalChoiceChance:0.07,
    passErrorMultiplier:0.96, shotErrorMultiplier:0.98, firstTouchErrorMultiplier:0.97,
    tackleTimingErrorMs:95, markingSlackMeters:1.45, teamCoordination:0.75 },
  Legendary:   { attackIQ:0.90, defenseIQ:0.90, reactionRating:0.90, markingAndSpace:0.90,
    reactionDelayMs:[120,220], decisionIntervalMs:175, perceptionNoiseMeters:0.32, predictionHorizonSeconds:1.65,
    candidateLimit:9, choiceTemperature:0.62, suboptimalChoiceChance:0.04,
    passErrorMultiplier:0.90, shotErrorMultiplier:0.92, firstTouchErrorMultiplier:0.92,
    tackleTimingErrorMs:65, markingSlackMeters:1.18, teamCoordination:0.90 },
  Ultimate:    { attackIQ:1.00, defenseIQ:0.90, reactionRating:1.00, markingAndSpace:1.00,
    reactionDelayMs:[90,170], decisionIntervalMs:140, perceptionNoiseMeters:0.18, predictionHorizonSeconds:1.95,
    candidateLimit:11, choiceTemperature:0.50, suboptimalChoiceChance:0.02,
    passErrorMultiplier:0.85, shotErrorMultiplier:0.88, firstTouchErrorMultiplier:0.88,
    tackleTimingErrorMs:45, markingSlackMeters:0.95, teamCoordination:1.00 },
};
function profileByIndex(i){ return PROFILES[TIERS[clamp(i,0,6)]]; }

// ---------------------------------------------------------------- math / rng
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function lerp(a,b,t){ return a+(b-a)*t; }
function hyp(ax,az,bx,bz){ return Math.hypot(ax-bx,az-bz); }
// mulberry32 — deterministic seeded PRNG
function makeRng(seed){ let s = seed>>>0 || 1; return function(){
  s |= 0; s = (s + 0x6D2B79F5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}; }
let RNG = makeRng(12345);
function rand(){ return RNG(); }
function randn(){ // Box–Muller
  let u = 0, v = 0; while(u===0) u = RNG(); while(v===0) v = RNG();
  return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v);
}
function softmaxPick(utils, temperature){
  const T = Math.max(0.05, temperature);
  let max = -Infinity; for (const u of utils) if (u>max) max=u;
  const ex = utils.map(u => Math.exp((u-max)/T));
  let sum = 0; for (const e of ex) sum += e;
  let r = rand()*sum, i = 0;
  for (; i < ex.length; i++){ r -= ex[i]; if (r <= 0) return i; }
  return ex.length-1;
}
function softmaxProbs(utils, temperature){    // exposed for tests
  const T = Math.max(0.05, temperature);
  let max = -Infinity; for (const u of utils) if (u>max) max=u;
  const ex = utils.map(u => Math.exp((u-max)/T));
  let s = 0; for (const e of ex) s += e;
  return ex.map(e => e/s);
}

// ---------------------------------------------------------------- attributes
const ROLE_FAMILIARITY = { out:0.20, base:0.60, plus:0.82, plusplus:1.00 };
// generate deterministic per-player attributes from role + seed
function makeRatings(role, seed){
  const r = makeRng(seed);
  const g = (mean, spread) => clamp(Math.round(mean + (r()*2-1)*spread), 30, 94);
  if (role === 'GK'){
    const ovrBase = 62 + r()*22;
    const a = { diving:g(ovrBase,7), handling:g(ovrBase,7), kicking:g(ovrBase-6,8),
      reflexes:g(ovrBase,7), gkSpeed:g(ovrBase-14,8), positioning:g(ovrBase,7), reactions:g(ovrBase,7) };
    a.ovr = Math.round((a.diving+a.handling+a.reflexes+a.positioning+a.reactions)/5);
    a.pace = 46 + r()*10; a.stamina = 60; return a;
  }
  const tierBias = { DF:{def:14,att:-8}, MF:{def:2,att:2}, FW:{def:-10,att:14} }[role] || {def:0,att:0};
  const base = 60 + r()*24;
  const a = {
    acceleration:g(base+6,8), sprintSpeed:g(base+6,8), agility:g(base,8), balance:g(base,8),
    reactions:g(base,7), ballControl:g(base+tierBias.att*0.4,8), dribbling:g(base+tierBias.att*0.4,9),
    shortPassing:g(base+2,8), longPassing:g(base,9), vision:g(base+tierBias.att*0.3,9),
    crossing:g(base,10), curve:g(base,10), finishing:g(base+tierBias.att,10), shotPower:g(base+4,9),
    longShots:g(base+tierBias.att*0.5,10), composure:g(base,8), attackingPositioning:g(base+tierBias.att,9),
    interceptions:g(base+tierBias.def,9), defensiveAwareness:g(base+tierBias.def,9),
    standingTackle:g(base+tierBias.def,9), slidingTackle:g(base+tierBias.def,10),
    aggression:g(base,10), strength:g(base,9), stamina:g(base,8),
    weakFoot:clamp(Math.round(2+r()*3),1,5), skillMoves:clamp(Math.round(2+r()*3),1,5),
  };
  a.pace = Math.round((a.acceleration + a.sprintSpeed)/2);
  // position-weighted OVR (not used for gameplay directly)
  const w = role==='FW' ? [a.finishing,a.attackingPositioning,a.dribbling,a.pace,a.shortPassing]
          : role==='DF' ? [a.defensiveAwareness,a.standingTackle,a.strength,a.pace,a.interceptions]
          : [a.shortPassing,a.vision,a.ballControl,a.stamina,a.dribbling];
  a.ovr = Math.round(w.reduce((s,v)=>s+v,0)/w.length);
  return a;
}
// effective mental quality: 0.25 + 0.50*difficulty + 0.25*attr, clamped [0.25,1]
function effectiveQuality(diffMetric, attrNorm){
  return clamp(0.25 + 0.50*diffMetric + 0.25*attrNorm, 0.25, 1.0);
}
// PHYSICAL speed from attributes ONLY (never difficulty). m/s.
function speedFromAttributes(p, sprint){
  const a = p.ratings || {};
  const pace = (a.pace || 62) / 100;
  const walk = 5.6 + pace * 2.2;                 // ~5.6..7.8
  const run  = 8.4 + pace * 3.4;                 // ~8.4..11.8
  let s = sprint ? run : walk;
  if (p.isGK) s = 5.4 + ((a.gkSpeed||55)/100)*2.2;
  const stam = p.stamina == null ? 1 : p.stamina;
  if (sprint && stam < 0.35) s *= (0.8 + stam*0.4);   // tired players slow down
  return s;
}

// ---------------------------------------------------------------- geometry
function goalX(team, L){ return team===0 ? L : 0; }
function projT(ax,az,bx,bz,px,pz){ const dx=bx-ax, dz=bz-az; const l2=dx*dx+dz*dz||1;
  return ((px-ax)*dx + (pz-az)*dz)/l2; }
// probability a pass along a->b is intercepted, given opponents
function laneCompletion(ax,az,bx,bz, opponents, ownerTeam){
  let worst = 1.0;
  const d = Math.hypot(bx-ax, bz-az) || 1;
  for (const e of opponents){
    const t = projT(ax,az,bx,bz,e.x,e.y);
    if (t <= 0.02 || t >= 0.98) continue;
    const px = lerp(ax,bx,t), pz = lerp(az,bz,t);
    const gap = Math.hypot(e.x-px, e.y-pz);
    // closer defender to the lane, and reachable in time, lowers completion
    const reach = clamp(1 - gap/(2.4 + t*d*0.05), 0, 1);
    worst = Math.min(worst, 1 - reach*0.95);
  }
  return clamp(worst, 0.02, 0.99);
}
function isOffside(team, receiver, world){
  // receiver ahead of ball and of 2nd-last defender in attacking half
  const L = world.L, gx = goalX(team, L);
  const atkDir = team===0 ? 1 : -1;
  if ((receiver.x - world.ball.x) * atkDir <= 0) return false;   // not ahead of ball
  const defs = world.players.filter(q => q.team !== team).map(q => q.x);
  defs.sort((a,b)=> team===0 ? b-a : a-b);                       // closest to their goal first
  const secondLast = defs.length>=2 ? defs[1] : defs[0];
  if (team===0) return receiver.x > secondLast + 0.4 && receiver.x > L/2;
  return receiver.x < secondLast - 0.4 && receiver.x < L/2;
}

// ---------------------------------------------------------------- config
let CFG = {
  tierIndex: 3,               // Professional
  playerBased: false,
  competitor: false,
  preset: 'Custom',           // Custom | Tactical | Dynamic
  sliders: { tackleAggression:50, buildupSpeed:50, shotFrequency:50,
    firstTouchPass:50, crossing:50, dribble:50, skillMove:50 },
  identity: 'Balanced',       // CPU team identity for Tactical preset
  debug: false,
};
function setConfig(c){ Object.assign(CFG, c || {}); if (c && c.sliders) CFG.sliders = Object.assign({}, CFG.sliders, c.sliders); }
function getConfig(){ return CFG; }
function sliderBias(name){ return ((CFG.sliders[name]||50) - 50) / 50; }   // -1..1

// team identity → base sliders (Tactical preset)
const IDENTITY_SLIDERS = {
  Possession:   { buildupSpeed:35, shotFrequency:42, firstTouchPass:70, crossing:45, dribble:48, skillMove:52, tackleAggression:45 },
  Counterattack:{ buildupSpeed:80, shotFrequency:58, firstTouchPass:60, crossing:50, dribble:55, skillMove:52, tackleAggression:55 },
  'Wing Play':  { buildupSpeed:55, shotFrequency:50, firstTouchPass:55, crossing:78, dribble:58, skillMove:55, tackleAggression:50 },
  'High Press': { buildupSpeed:62, shotFrequency:52, firstTouchPass:58, crossing:52, dribble:50, skillMove:50, tackleAggression:72 },
  Balanced:     { buildupSpeed:50, shotFrequency:50, firstTouchPass:50, crossing:50, dribble:50, skillMove:50, tackleAggression:50 },
  'Low Block':  { buildupSpeed:45, shotFrequency:46, firstTouchPass:50, crossing:48, dribble:46, skillMove:46, tackleAggression:40 },
};
function applyPreset(seed){
  if (CFG.preset === 'Tactical' || CFG.preset === 'Dynamic'){
    const base = IDENTITY_SLIDERS[CFG.identity] || IDENTITY_SLIDERS.Balanced;
    const s = Object.assign({}, base);
    if (CFG.preset === 'Dynamic'){
      const r = makeRng((seed||1) ^ 0x9e3779b9);
      for (const k in s) s[k] = clamp(Math.round(s[k] + (r()*2-1)*5), 0, 100);   // ±5, does NOT touch difficulty
    }
    CFG.sliders = Object.assign({ tackleAggression:50,buildupSpeed:50,shotFrequency:50,
      firstTouchPass:50,crossing:50,dribble:50,skillMove:50 }, s);
  }
}

// ---------------------------------------------------------------- squad / PBD
function squadStats(players, team){
  const outfield = players.filter(p => p.team===team && !p.isGK);
  const ovrs = outfield.map(p => (p.ratings && p.ratings.ovr) || 60).sort((a,b)=>b-a);
  const avg = ovrs.reduce((s,v)=>s+v,0)/(ovrs.length||1);
  const top3 = new Set(ovrs.slice(0,3));
  return { avg, top3, ovrs };
}
// effective cognitive tier index for a player (Player-Based Difficulty)
function effectiveTierIndex(p, baseTier, stats){
  if (!CFG.playerBased) return baseTier;
  const ovr = (p.ratings && p.ratings.ovr) || 60;
  let t = baseTier;
  const isStar = stats.top3.has(ovr) || ovr >= stats.avg + 8;
  const isWeak = ovr <= stats.avg - 8;
  if (isStar) t += 1; else if (isWeak) t -= 1;
  return clamp(t, 0, 6);
}
function starTechnicalBoost(p, stats){
  // classic FC +10 to on-ball technical attributes, capped 99, ONLY with PBD on.
  if (!CFG.playerBased || !p.ratings) return;
  const ovr = p.ratings.ovr, isStar = stats.top3.has(ovr) || ovr >= stats.avg + 8;
  if (!isStar || p._boosted) return;
  p._boosted = true; p.isStar = true;
  for (const k of ['ballControl','dribbling','shortPassing','longPassing','finishing','vision','composure'])
    if (p.ratings[k] != null) p.ratings[k] = Math.min(99, p.ratings[k] + 10);
  // NOTE: pace/acceleration/sprintSpeed deliberately untouched.
}

// ---------------------------------------------------------------- perception
// ring buffer of ball states so lower tiers act on older info
let ballHist = [];
function beginMatch(seed){
  RNG = makeRng((seed>>>0) || 1);
  ballHist = [];
  teamState = [null, null];
  applyPreset(seed);
}
function tick(world, dt){
  ballHist.push({ x:world.ball.x, y:world.ball.y, vx:world.ball.vx, vy:world.ball.vy, t:world.time });
  if (ballHist.length > 240) ballHist.shift();
}
function perceivedBall(profile, world){
  // sample ball state delayed by a reaction delay, add positional noise + predict
  const rd = lerp(profile.reactionDelayMs[0], profile.reactionDelayMs[1], 0.5) / 1000;
  const targetT = world.time - rd;
  let s = ballHist.length ? ballHist[0] : world.ball;
  for (let i = ballHist.length-1; i >= 0; i--){ if (ballHist[i].t <= targetT){ s = ballHist[i]; break; } }
  const n = profile.perceptionNoiseMeters;
  const px = s.x + randn()*n*0.5, py = s.y + randn()*n*0.5;
  const h = profile.predictionHorizonSeconds;
  return { x:px, y:py, vx:s.vx, vy:s.vy, predX:px + s.vx*h, predY:py + s.vy*h };
}

// ---------------------------------------------------------------- TeamBrain
let teamState = [null, null];
const PHASES = ['DefensiveLowBlock','DefensiveMidBlock','HighPress','TransitionToDefence',
  'BuildUp','Progression','FinalThird','CounterAttack','TransitionToAttack','SetPiece'];
function teamBrain(world, team, profile, stats){
  const L = world.L, W = world.W, ball = world.ball;
  const inPoss = world.possTeam === team;
  const atkDir = team===0 ? 1 : -1;
  const gx = goalX(team, L), owng = goalX(1-team, L);
  const st = teamState[team] || (teamState[team] = { phase:'BuildUp', line:L/2, marks:{}, presser:-1, cover:-1, runners:0, lastTurnover:0, risk:0 });

  // phase
  const ballAtkThird = ((ball.x - L/2) * atkDir) > L*0.16;
  const ballOwnThird = ((ball.x - L/2) * atkDir) < -L*0.16;
  if (inPoss){
    if (ballAtkThird) st.phase = 'FinalThird';
    else if (world.time - st.lastTurnover < 3.5 && profile.attackIQ > 0.3) st.phase = 'CounterAttack';
    else if (ballOwnThird) st.phase = 'BuildUp';
    else st.phase = 'Progression';
  } else if (world.possTeam === (1-team)){
    st.lastTurnover = world.time;
    const pressLust = profile.defenseIQ * (0.6 + 0.4*sliderNorm('tackleAggression', team));
    if (((ball.x - L/2)*atkDir) > L*0.12 && pressLust > 0.55) st.phase = 'HighPress';
    else if (ballOwnThird) st.phase = 'DefensiveLowBlock';
    else st.phase = 'DefensiveMidBlock';
  } else st.phase = inPoss ? 'TransitionToAttack' : 'TransitionToDefence';

  // defensive line height (own-goal-relative), higher with difficulty & press
  const aggro = 0.5 + 0.5*profile.defenseIQ;
  const lineTarget = st.phase==='HighPress' ? owng + atkDir*L*0.55
                   : st.phase==='DefensiveLowBlock' ? owng + atkDir*L*0.18
                   : owng + atkDir*L*(0.30 + 0.12*aggro);
  st.line = lerp(st.line, lineTarget, 0.2);

  // presser + cover (nearest two to ball) — prevents swarming
  const outs = world.players.filter(p => p.team===team && !p.isGK);
  const byBall = outs.slice().sort((a,b)=> hyp(a.x,a.y,ball.x,ball.y) - hyp(b.x,b.y,ball.x,ball.y));
  st.presser = byBall[0] ? byBall[0].idx : -1;
  st.cover   = byBall[1] ? byBall[1].idx : -1;

  // marking assignments (greedy) for dangerous opponents when defending
  st.marks = {};
  if (!inPoss){
    const opps = world.players.filter(p => p.team!==team && !p.isGK);
    // dangerous = closer to our goal / ahead of ball
    const danger = opps.map(o => ({ o, threat: 1 - Math.abs(o.x-owng)/L + Math.max(0,(o.x-ball.x)*atkDir)/L*0.3 }))
                       .sort((a,b)=> b.threat - a.threat);
    const used = new Set([st.presser, st.cover]);
    const markerPool = outs.filter(d => !used.has(d.idx));
    const slack = profile.markingSlackMeters;
    for (const { o } of danger){
      let best=null, bd=1e9;
      for (const d of markerPool){ if (d._marked) continue;
        const cost = hyp(d.x,d.y,o.x,o.y) + Math.abs(d.form.y*W - o.y)*0.3;   // distance + zone fit
        if (cost < bd){ bd = cost; best = d; } }
      if (best && bd < 22 + slack*4){ best._marked = true; st.marks[o.idx] = best.idx; }
    }
    for (const d of outs) d._marked = false;
  }

  // forward-runner budget when attacking (don't abandon structure)
  const baseRunners = st.phase==='FinalThird' ? 3 : st.phase==='CounterAttack' ? 3 : 2;
  st.runners = Math.max(1, Math.round(baseRunners * (0.6 + 0.4*profile.teamCoordination)));

  // tactical risk from score & time
  st.risk = tacticalRisk(world, team, profile);
  return st;
}
function sliderNorm(name, team){ return team===1 ? ((CFG.sliders[name]||50)/100) : 0.5; }

// ---------------------------------------------------------------- tactical adaptation
function tacticalRisk(world, team, profile){
  const gd = (world.score[team] - world.score[1-team]);
  const min = (1 - world.clock/world.matchSecs) * 90;   // scaled match minute
  let risk = 0;
  if (gd < 0){ risk = min>80 ? 0.9 : min>60 ? 0.55 : 0.3; }
  else if (gd > 0){ risk = min>75 ? -0.5 : -0.2; }
  return clamp(risk * (0.6 + 0.4*profile.attackIQ), -0.6, 0.9);
}

// ---------------------------------------------------------------- passing
function passCandidates(owner, world, profile){
  const L = world.L, team = owner.team, gx = goalX(team, L), atk = team===0?1:-1;
  const mates = world.players.filter(p => p.team===team && p!==owner && !p.isGK);
  const opps = world.players.filter(p => p.team!==team);
  const list = [];
  for (const m of mates){
    const d = hyp(owner.x,owner.y,m.x,m.y); if (d < 3 || d > 55) continue;
    const comp = laneCompletion(owner.x,owner.y,m.x,m.y, opps, team);
    const forward = (m.x - owner.x) * atk;                     // forward progress metres
    const nearestDef = opps.reduce((mn,e)=>Math.min(mn,hyp(e.x,e.y,m.x,m.y)), 99);
    const receiverSpace = clamp(nearestDef/8, 0, 1);
    const offside = isOffside(team, m, world);
    const futureThreat = clamp((1 - Math.abs(m.x-gx)/L), 0, 1) * receiverSpace;
    const through = forward > 8 && receiverSpace > 0.4 && d > 12;
    const kind = m.x*atk > owner.x*atk + 14 && d > 22 ? 'longPass'
               : (Math.abs(m.y-world.W/2) > world.W*0.30 && ((m.x-owner.x)*atk)>6 && Math.abs(gx-m.x)<L*0.28) ? 'cross'
               : through ? 'throughPass' : 'shortPass';
    if (offside && (kind==='throughPass'||kind==='longPass')) continue;   // don't play offside through-balls
    list.push({ kind, target:m, comp, forward, receiverSpace, futureThreat, dist:d, offside });
  }
  // limit candidates by perception budget
  list.sort((a,b)=> (b.forward*0.02 + b.comp) - (a.forward*0.02 + a.comp));
  return list.slice(0, profile.candidateLimit);
}
function passUtility(c, owner, world, profile){
  const turnoverRisk = (1 - c.comp) * (1 + Math.max(0,(goalX(1-owner.team, world.L)-owner.x)*(owner.team===0?-1:1)/world.L));
  let u = 0.30*c.comp + 0.18*clamp(c.forward/30,0,1) + 0.18*c.receiverSpace
        + 0.18*c.futureThreat + 0.10*roleFit(c.target) + 0.06*0.5
        - 0.22*clamp(turnoverRisk,0,1.4);
  // slider biases (CPU only)
  if (owner.team===1){
    if (c.kind==='cross') u += 0.16*sliderBias('crossing');
    if (c.kind==='throughPass'||c.kind==='longPass') u += 0.10*sliderBias('buildupSpeed');
    u += 0.05*sliderBias('firstTouchPass');
  }
  return u;
}
function roleFit(p){ return p.role==='FW'?0.75 : p.role==='MF'?0.6 : 0.4; }

// ---------------------------------------------------------------- shooting (xG)
function expectedGoal(shooter, world){
  const L = world.L, W = world.W, team = shooter.team, gx = goalX(team, L), gy = W/2;
  const dist = hyp(shooter.x,shooter.y,gx,gy);
  const angle = Math.atan2(6, Math.abs(gx-shooter.x)+0.1);      // wider when central & close
  let xg = clamp(1.05*Math.exp(-dist/11) * clamp(angle/0.9,0.2,1), 0.01, 0.92);
  // blockers between shooter and goal
  let blocks = 0;
  for (const e of world.players){ if (e.team===team) continue;
    const t = projT(shooter.x,shooter.y,gx,gy,e.x,e.y);
    if (t>0.05 && t<0.95){ const px=lerp(shooter.x,gx,t), py=lerp(shooter.y,gy,t);
      if (Math.hypot(e.x-px,e.y-py) < 2.2) blocks++; } }
  const blockProb = clamp(blocks*0.22, 0, 0.8);
  const fin = ((shooter.ratings&&shooter.ratings.finishing)||60)/100;
  xg *= (0.55 + 0.6*fin);
  return { xg: clamp(xg,0.01,0.95), blockProb };
}
function shotUtility(shooter, world, profile){
  const { xg, blockProb } = expectedGoal(shooter, world);
  const fin = ((shooter.ratings&&shooter.ratings.longShots)||60)/100;
  let u = 0.55*xg + 0.15*xg*0.3 + 0.10*fin + 0.10*0.5 + 0.10*0.5 - 0.25*blockProb;
  if (shooter.team===1) u += 0.14*sliderBias('shotFrequency');
  return u;
}

// ---------------------------------------------------------------- owner action
function chooseOwnerAction(owner, world, profile){
  const L = world.L, team = owner.team, gx = goalX(team, L), atk = team===0?1:-1;
  const distGoal = Math.abs(gx - owner.x);
  const opps = world.players.filter(p => p.team!==team);
  const nearest = opps.reduce((m,e)=>{ const d=hyp(e.x,e.y,owner.x,owner.y); return d<m.d?{d,e}:m; }, {d:99,e:null});
  const pressured = nearest.d < 2.8;

  const options = [];
  // shot
  if (distGoal < 30 && Math.abs(owner.y-world.W/2) < 24){
    options.push({ kind:'shoot', u: shotUtility(owner, world, profile) + (distGoal<12?0.1:0) });
  }
  // passes
  for (const c of passCandidates(owner, world, profile)){
    options.push({ kind:c.kind, target:c.target, u: passUtility(c, owner, world, profile) });
  }
  // dribble / carry (drive at goal)
  const dribBias = owner.team===1 ? 0.12*sliderBias('dribble') : 0;
  const carryU = 0.30 + 0.25*clamp((distGoal>10?1:0),0,1) - (pressured?0.28:0)
    + 0.15*(((owner.ratings&&owner.ratings.dribbling)||60)/100) + dribBias
    + 0.12*profile.attackIQ*(distGoal<40?1:0);
  options.push({ kind:'carry', u: carryU });
  // clear (defensive get-out under pressure deep in own half)
  if (pressured && (owner.x-goalX(1-team,L))*atk < L*0.22 && profile.attackIQ < 0.7){
    options.push({ kind:'clear', u: 0.35 + (1-profile.attackIQ)*0.3 });
  }
  // shield when pressured with no option
  options.push({ kind:'shield', u: pressured ? 0.2 : 0.02 });

  // Competitor Mode: prefer vertical passes & confident dribble
  if (CFG.competitor && (CFG.tierIndex>=5)){
    for (const o of options){ if (o.kind==='throughPass'||o.kind==='longPass') o.u += 0.12;
      if (o.kind==='carry') o.u += 0.06; }
  }
  // softmax selection (variety at low tiers, sharper at high)
  const idx = softmaxPick(options.map(o=>o.u), profile.choiceTemperature);
  // occasional deliberate "acceptable" choice at low skill (not a pass-to-opponent)
  if (rand() < profile.suboptimalChoiceChance && options.length > 1){
    const alt = Math.floor(rand()*options.length);
    return options[alt];
  }
  return options[idx];
}

// ---------------------------------------------------------------- PlayerBrain (off-ball target)
function decideOffball(p, world, profile, st){
  const L = world.L, W = world.W, team = p.team, atk = team===0?1:-1;
  const ball = world.ball, gx = goalX(team, L), owng = goalX(1-team, L);
  const inPoss = world.possTeam === team;
  const anchor = formationAnchor(p, world, st);

  let state, tx = anchor.x, ty = anchor.y, sprint = false;

  if (inPoss){
    // attacking movement — role based, limited runners, stay onside
    const wantRunner = (p.role==='FW' || (p.role==='MF' && p.idx%2===0));
    const runnerActive = wantRunner && countTeamRunners(world, team) < st.runners;
    if (runnerActive && ((ball.x-L/2)*atk) > -L*0.1){
      state = 'RunInBehind';
      tx = clamp(anchor.x + atk*14, 6, L-6);
      ty = clamp(anchor.y + (p.idx%2?6:-6), 5, W-5);
      // cancel run if it would be offside
      const probe = { x:tx, y:ty };
      if (isOffside(team, probe, world)){ tx = ball.x - atk*2; state='ShowForPass'; }
      sprint = true; p._runner = true;
    } else if (hyp(p.x,p.y,ball.x,ball.y) < 22 && !isBallCarrier(p, world)){
      state = 'SupportBallCarrier';
      // offer an angle: move to open space beside the carrier
      const side = (p.y < ball.y) ? -1 : 1;
      tx = clamp(ball.x + atk*6, 5, L-5); ty = clamp(ball.y + side*8, 5, W-5);
      p._runner = false;
    } else {
      state = 'HoldWidth'; p._runner = false;
      if (p.role==='FW') ty = anchor.y + (anchor.y<W/2? -4:4);
    }
  } else {
    // defending
    if (st.presser === p.idx){
      state = 'PressBall';
      const contain = profile.defenseIQ > 0.6 ? 1.4 : 2.2;   // better tiers contain, don't dive in
      const dir = norm(ball.x-p.x, ball.y-p.y);
      tx = ball.x - dir.x*contain; ty = ball.y - dir.y*contain; sprint = true;
    } else if (st.cover === p.idx){
      state = 'CoverTeammate';
      tx = lerp(ball.x, owng, 0.25); ty = lerp(ball.y, W/2, 0.3); sprint = hyp(p.x,p.y,tx,ty)>6;
    } else {
      // find our marking assignment
      let markIdx = -1; for (const oi in st.marks){ if (st.marks[oi]===p.idx){ markIdx = +oi; break; } }
      if (markIdx >= 0){
        const o = world.players.find(q => q.team!==team && q.idx===markIdx);
        if (o){ state='MarkOpponent';
          const slack = profile.markingSlackMeters;
          // goal-side of the man, tighter at higher tiers
          const gsx = lerp(o.x, owng, 0.14), gsy = o.y;
          tx = lerp(gsx, o.x, clamp(1 - slack/4,0,1));
          ty = gsy + (o.y - p.y)*0.1;
          sprint = hyp(p.x,p.y,o.x,o.y) > 6;
        }
      } else {
        state = 'HoldFormation';
        // compact toward the defensive line & ball side
        tx = lerp(anchor.x, st.line, 0.4);
        ty = lerp(anchor.y, ball.y, 0.18*profile.markingAndSpace);
      }
    }
  }
  return { tx:clamp(tx,1,L-1), ty:clamp(ty,1,W-1), sprint, state };
}
function norm(x,y){ const m=Math.hypot(x,y)||1; return {x:x/m,y:y/m}; }
function isBallCarrier(p, world){ return world.ball.owner === (p.team*11 + p.idx); }
function countTeamRunners(world, team){ let n=0; for (const p of world.players) if (p.team===team && p._runner) n++; return n; }
function formationAnchor(p, world, st){
  const L = world.L, W = world.W, atk = p.team===0?1:-1;
  const bx = clamp((world.ball.x - L/2)/(L/2), -1, 1);
  const base = { x: (p.team===0? p.form.x : 1-p.form.x)*L, y:(p.team===0? p.form.y : 1-p.form.y)*W };
  // shift shape toward ball longitudinally + laterally (compactness)
  let x = base.x + atk*bx*14;
  let y = base.y + (world.ball.y - W/2)*0.28;
  return { x:clamp(x,3,L-3), y:clamp(y,4,W-4) };
}

// ---------------------------------------------------------------- goalkeeper
function gkTarget(gk, world, profile){
  const L = world.L, W = world.W, own = goalX(1-gk.team, L);
  const ball = world.ball, atk = gk.team===0?1:-1;
  const line = own===0 ? 2.2 : L-2.2;
  const depthUrge = clamp(1 - Math.abs(ball.x-own)/26, 0, 1);
  const posQ = ((gk.ratings&&gk.ratings.positioning)||60)/100;
  // Positioning quality scales with the difficulty tier so lower tiers leave gaps
  // and never fully cover the goal — the shot placement can always beat them.
  const skill = profile ? profile.reactionRating : 0.7;
  const outX = own===0 ? clamp(line + depthUrge*(7*posQ)*(0.5+0.5*skill), 2.2, 10)
                       : clamp(line - depthUrge*(7*posQ)*(0.5+0.5*skill), L-10, L-2.2);
  // track the ball across the mouth, but capped (0.30..0.65) so the corners stay open
  const track = 0.30 + 0.35*skill;
  const ty = clamp(W/2 + (ball.y - W/2)*track, W/2 - HALFG(world) - 1.5, W/2 + HALFG(world) + 1.5);
  return { x:outX, y:ty };
}
function HALFG(world){ return (world.goalW||12)/2; }
// GK save chance for a shot heading on target
function gkSaveChance(gk, world, ballSpeed, onTargetY, profile){
  const r = gk.ratings || {};
  const reflex = (r.reflexes||60)/100, diving=(r.diving||60)/100, handling=(r.handling||60)/100;
  const reach = 2.2 + diving*2.0;                       // metres GK can cover
  const err = Math.abs(gk.y - onTargetY);
  const speedPenalty = clamp(1 - (ballSpeed-24)/40, 0.3, 1);
  let chance = clamp((reach - err)/reach, 0, 1) * (0.35 + 0.6*reflex) * speedPenalty;
  chance *= (0.85 + 0.15*handling);
  chance *= (0.6 + 0.4*profile.reactionRating);         // better tiers position/react better
  return clamp(chance, 0.02, 0.96);
}

// ---------------------------------------------------------------- execution helpers
// pass angle error sigma (radians) from the actual passer + context
function passAngleSigma(passer, profile, ctx){
  const a = passer.ratings || {};
  const passAttr = (ctx.long ? (a.longPassing||60) : (a.shortPassing||60));
  let sigmaDeg = lerp(9.0, 0.8, passAttr/100) * profile.passErrorMultiplier;
  sigmaDeg *= (ctx.pressure ? 1.35 : 1.0);
  sigmaDeg *= (ctx.weakFoot ? 1.3 : 1.0);
  sigmaDeg *= (1 + (1 - (passer.stamina==null?1:passer.stamina))*0.4);
  sigmaDeg *= (ctx.badBody ? 1.25 : 1.0);
  return sigmaDeg * Math.PI/180;
}
function shotPlacementError(shooter, profile, ctx){
  const a = shooter.ratings || {};
  const fin = (a.finishing||60)/100, comp=(a.composure||60)/100;
  let m = lerp(6.5, 0.7, (fin*0.6+comp*0.4)) * profile.shotErrorMultiplier;
  m *= (ctx.pressure ? 1.3 : 1.0);
  m *= (ctx.weakFoot ? 1.35 : 1.0);
  m *= (1 + (1-(shooter.stamina==null?1:shooter.stamina))*0.4);
  return m;   // metres of vertical placement sigma at goal
}
// tackle: decide + resolve. Returns {win:bool} ; success from attributes, not guaranteed.
function tackleOutcome(defender, owner, profile, sliding){
  const d = defender.ratings||{}, o = owner.ratings||{};
  const tackleAttr = ((sliding? d.slidingTackle : d.standingTackle)||60)/100;
  const awareness = (d.defensiveAwareness||60)/100;
  const control = (o.ballControl||60)/100, drib=(o.dribbling||60)/100;
  // timing error shrinks with difficulty (better WHEN, not guaranteed win)
  const timingErr = profile.tackleTimingErrorMs/1000;
  const wellTimed = rand() > clamp(timingErr*2.2, 0, 0.7);
  let base = 0.30 + 0.5*tackleAttr - 0.4*(control*0.5+drib*0.5) + 0.15*awareness;
  base *= (sliding ? 1.15 : 1.0);
  base += 0.12*(sliderBias('tackleAggression'))*(defender.team===1?1:0);
  if (!wellTimed) base *= 0.35;
  if ((owner.stamina!=null) && owner.stamina < 0.3) base += 0.08;
  return { win: rand() < clamp(base, 0.03, 0.9) };
}

// ---------------------------------------------------------------- top-level per-player decision
function decide(p, world, profile, st){
  const carrier = isBallCarrier(p, world);
  if (carrier){
    const act = chooseOwnerAction(p, world, profile);
    // movement while carrying: drive toward goal / open space
    const gx = goalX(p.team, world.L), gy = world.W/2;
    const tg = norm(gx-p.x, gy-p.y);
    const opp = world.players.filter(q=>q.team!==p.team)
      .reduce((m,e)=>{const d=hyp(e.x,e.y,p.x,p.y);return d<m.d?{d,e}:m;},{d:99,e:null});
    let ax=tg.x, ay=tg.y;
    if (opp.e && opp.d<6){ const aw=norm(p.x-opp.e.x,p.y-opp.e.y); ax+=aw.x*0.7; ay+=aw.y*0.7; }
    const n = norm(ax,ay);
    p.ai = { tx:clamp(p.x+n.x*8,1,world.L-1), ty:clamp(p.y+n.y*8,1,world.W-1),
             sprint: opp.d>3 && Math.abs(gx-p.x)>12, state:'CarryBall', action:act };
    return p.ai;
  }
  const off = decideOffball(p, world, profile, st);
  p.ai = { tx:off.tx, ty:off.ty, sprint:off.sprint, state:off.state, action:null };
  return p.ai;
}

// ---------------------------------------------------------------- exports
const API = {
  TIERS, TIER_DESC, PROFILES, profileByIndex,
  setConfig, getConfig, applyPreset, sliderBias,
  makeRatings, effectiveQuality, speedFromAttributes,
  squadStats, effectiveTierIndex, starTechnicalBoost,
  beginMatch, tick, perceivedBall, teamBrain, decide,
  chooseOwnerAction, passCandidates, passUtility, shotUtility, expectedGoal,
  gkTarget, gkSaveChance, passAngleSigma, shotPlacementError, tackleOutcome,
  isOffside, laneCompletion, softmaxProbs, makeRng,
  // test/debug helpers
  _setRng(seed){ RNG = makeRng(seed); }, _rand: rand, _randn: randn,
  get teamState(){ return teamState; },
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.GXAI = API;
})(typeof window !== 'undefined' ? window : globalThis);
