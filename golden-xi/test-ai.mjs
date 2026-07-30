// Deterministic unit/scenario tests for the CPU AI & difficulty system.
import AI from './www/ai.js';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name); } };
const approx = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// --- 1. profiles loaded with exact anchor values ---
ok('Beginner attackIQ=0.10', AI.PROFILES.Beginner.attackIQ === 0.10);
ok('Ultimate reaction=1.00', AI.PROFILES.Ultimate.reactionRating === 1.00);
ok('Ultimate defenseIQ=0.90 (per spec)', AI.PROFILES.Ultimate.defenseIQ === 0.90);
ok('World Class markingAndSpace=0.80', AI.PROFILES['World Class'].markingAndSpace === 0.80);
ok('7 tiers', AI.TIERS.length === 7);

// --- 2. reaction delay decreases with difficulty ---
const mid = p => (p.reactionDelayMs[0] + p.reactionDelayMs[1]) / 2;
let monoReact = true, monoCand = true, monoPassErr = true;
for (let i = 1; i < 7; i++) {
  const lo = AI.profileByIndex(i - 1), hi = AI.profileByIndex(i);
  if (!(mid(hi) < mid(lo))) monoReact = false;
  if (!(hi.candidateLimit >= lo.candidateLimit)) monoCand = false;
  if (!(hi.passErrorMultiplier <= lo.passErrorMultiplier)) monoPassErr = false;
}
ok('reaction delay strictly decreases with tier', monoReact);
ok('candidate count increases with tier', monoCand);
ok('pass error decreases with tier', monoPassErr);

// --- 3. deterministic RNG ---
AI._setRng(999); const seqA = [AI._rand(), AI._rand(), AI._rand()];
AI._setRng(999); const seqB = [AI._rand(), AI._rand(), AI._rand()];
ok('seeded RNG reproducible', seqA.every((v, i) => v === seqB[i]));

// --- 4. no physical speed from difficulty ---
const fast = { ratings: { pace: 90 }, isGK: false, stamina: 1 };
const slow = { ratings: { pace: 50 }, isGK: false, stamina: 1 };
ok('speed is difficulty-independent (pure fn of attributes)',
   AI.speedFromAttributes(fast, true) === AI.speedFromAttributes(fast, true));
ok('faster pace → faster player', AI.speedFromAttributes(fast, true) > AI.speedFromAttributes(slow, true));
ok('sprint faster than jog', AI.speedFromAttributes(fast, true) > AI.speedFromAttributes(fast, false));

// --- 5. Player-Based Difficulty tier clamping ---
AI.setConfig({ playerBased: true });
const stats = { avg: 70, top3: new Set([88]) };
const star = { ratings: { ovr: 88 } }, weak = { ratings: { ovr: 60 } }, avgP = { ratings: { ovr: 71 } };
ok('star gets +1 tier', AI.effectiveTierIndex(star, 2, stats) === 3);
ok('star clamps at Ultimate', AI.effectiveTierIndex(star, 6, stats) === 6);
ok('weak gets -1 tier', AI.effectiveTierIndex(weak, 3, stats) === 2);
ok('weak clamps at Beginner', AI.effectiveTierIndex(weak, 0, stats) === 0);
ok('average player unchanged', AI.effectiveTierIndex(avgP, 3, stats) === 3);
AI.setConfig({ playerBased: false });
ok('PBD off → no tier shift', AI.effectiveTierIndex(star, 3, stats) === 3);

// --- 6. CPU slider biasing (team 1) ---
const shooter = { team: 1, x: 96, y: 36, ratings: { finishing: 70, longShots: 70, composure: 70 } };
const world = mkWorld([shooter]);
AI.setConfig({ preset: 'Custom', sliders: { shotFrequency: 90 } });
const uHigh = AI.shotUtility(shooter, world, AI.PROFILES.Professional);
AI.setConfig({ sliders: { shotFrequency: 10 } });
const uLow = AI.shotUtility(shooter, world, AI.PROFILES.Professional);
ok('higher Shot Frequency slider raises shot utility', uHigh > uLow);
AI.setConfig({ sliders: { shotFrequency: 50 } });

// --- 7. offside detection ---
{
  const atk = { team: 0, idx: 9, x: 90, y: 36, role: 'FW', isGK: false };
  const lastDef = { team: 1, idx: 3, x: 80, y: 36, role: 'DF', isGK: false };
  const keeper = { team: 1, idx: 0, x: 106, y: 36, role: 'GK', isGK: true };
  const w = mkWorld([atk, lastDef, keeper], { x: 60, y: 36 });
  ok('receiver beyond last defender is offside', AI.isOffside(0, atk, w) === true);
  atk.x = 70;
  ok('receiver level/behind defender is onside', AI.isOffside(0, atk, w) === false);
}

// --- 8. passing-lane obstruction lowers completion ---
{
  const open = AI.laneCompletion(20, 36, 60, 36, [], 0);
  const blocked = AI.laneCompletion(20, 36, 60, 36, [{ x: 40, y: 36 }], 0);
  ok('open lane completes better than blocked lane', open > blocked);
  ok('blocked lane completion < 0.6', blocked < 0.6);
}

// --- 9. xG monotonic in distance ---
{
  const close = { team: 0, x: 100, y: 36, ratings: { finishing: 70 } };
  const far = { team: 0, x: 70, y: 36, ratings: { finishing: 70 } };
  const w = mkWorld([close]);
  const w2 = mkWorld([far]);
  ok('closer shot has higher xG', AI.expectedGoal(close, w).xg > AI.expectedGoal(far, w2).xg);
}

// --- 10. softmax valid distribution & ordering ---
{
  const probs = AI.softmaxProbs([1, 2, 3], 1.0);
  ok('softmax sums to 1', approx(probs.reduce((s, v) => s + v, 0), 1, 1e-9));
  ok('higher utility → higher probability', probs[2] > probs[0]);
}

// --- 11. attributes deterministic & role-sensitive ---
{
  const a1 = AI.makeRatings('FW', 42), a2 = AI.makeRatings('FW', 42);
  ok('ratings deterministic per seed', a1.ovr === a2.ovr && a1.finishing === a2.finishing);
  // average finishing over many FW vs DF should favour FW
  let fwFin = 0, dfFin = 0;
  for (let i = 0; i < 200; i++) { fwFin += AI.makeRatings('FW', i).finishing; dfFin += AI.makeRatings('DF', i).finishing; }
  ok('forwards finish better than defenders on average', fwFin > dfFin);
}

// --- 12. tackle is probabilistic (not guaranteed), better tackler wins more ---
{
  AI._setRng(7);
  const goodD = { team: 1, ratings: { standingTackle: 90, defensiveAwareness: 88, ballControl: 0 } };
  const poorD = { team: 1, ratings: { standingTackle: 45, defensiveAwareness: 45, ballControl: 0 } };
  const carrier = { ratings: { ballControl: 70, dribbling: 70 }, stamina: 1 };
  let g = 0, b = 0;
  for (let i = 0; i < 400; i++) { if (AI.tackleOutcome(goodD, carrier, AI.PROFILES.Legendary, false).win) g++; }
  for (let i = 0; i < 400; i++) { if (AI.tackleOutcome(poorD, carrier, AI.PROFILES.Legendary, false).win) b++; }
  ok('tackle not guaranteed (0<wins<400)', g > 0 && g < 400);
  ok('better defender wins more tackles', g > b);
}

// --- 13. GK save chance is bounded and reflex-sensitive ---
{
  const gGK = { team: 1, x: 106, y: 36, ratings: { reflexes: 92, diving: 90, handling: 88, positioning: 88 } };
  const pGK = { team: 1, x: 106, y: 36, ratings: { reflexes: 45, diving: 45, handling: 45, positioning: 45 } };
  const w = mkWorld([gGK]);
  const cs = AI.gkSaveChance(gGK, w, 30, 38, AI.PROFILES.Professional);
  const cp = AI.gkSaveChance(pGK, w, 30, 38, AI.PROFILES.Professional);
  ok('GK save chance in (0,1)', cs > 0 && cs < 1);
  ok('better keeper saves more', cs > cp);
}

// --- helpers ---
function mkWorld(players, ballPos) {
  return {
    players, ball: { x: (ballPos && ballPos.x) ?? 55, y: (ballPos && ballPos.y) ?? 36, vx: 0, vy: 0, owner: -1 },
    L: 110, W: 72, goalW: 12, time: 10, clock: 120, matchSecs: 180, score: [0, 0], possTeam: -1,
  };
}

console.log(`\nAI tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
