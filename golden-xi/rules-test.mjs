// Deterministic unit tests for the Rules Engine (pure logic, no browser).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const R = require('./www/rules.js');

let pass = 0, fail = 0;
function ok(name, cond){ if (cond){ pass++; } else { fail++; console.log('  ✗ FAIL:', name); } }
function eq(name, a, b){ ok(name + ` (${JSON.stringify(a)} == ${JSON.stringify(b)})`, a === b); }

const { L, W, CY, HALF_GOAL, BALL_R } = R;

// ---------- boundary: partially over the line is STILL IN PLAY ----------
{
  // ball centre just past x=0 but not by a full radius → in play
  const d = R.evaluateBoundary({ prev:{x:0.3, y:CY}, cur:{x:-0.2, y:CY}, lastTouchTeam:0 });
  ok('partial over goal line stays in play', d === null);
}
{
  const d = R.evaluateBoundary({ prev:{x:1, y:0.2}, cur:{x:1, y:-0.2}, lastTouchTeam:0 });
  ok('partial over touchline stays in play', d === null);
}

// ---------- whole ball over touchline → throw-in to opponents ----------
{
  const d = R.evaluateBoundary({ prev:{x:40, y:0.5}, cur:{x:40, y:-1}, lastTouchTeam:0 });
  ok('touchline gives a decision', !!d);
  eq('throw-in type', d.type, 'THROW_IN');
  eq('throw-in to opponents of last toucher', d.restartTeamId, 1);
}

// ---------- whole ball over goal line, attacker last touch → goal kick ----------
{
  // team 0 attacks x=L; if team 0 last touched and it went over x=L outside posts → goal kick to team1
  const d = R.evaluateBoundary({ prev:{x:L-0.3, y:CY+HALF_GOAL+3}, cur:{x:L+1, y:CY+HALF_GOAL+3}, lastTouchTeam:0 });
  eq('attacker over goal line → goal kick', d.type, 'GOAL_KICK');
  eq('goal kick to defending team', d.restartTeamId, 1);
}

// ---------- whole ball over goal line, defender last touch → corner ----------
{
  const d = R.evaluateBoundary({ prev:{x:L-0.3, y:CY+HALF_GOAL+3}, cur:{x:L+1, y:CY+HALF_GOAL+3}, lastTouchTeam:1 });
  eq('defender over own goal line → corner', d.type, 'CORNER');
  eq('corner to attacking team', d.restartTeamId, 0);
}

// ---------- valid goal: whole ball between posts, below bar ----------
{
  const d = R.evaluateBoundary({ prev:{x:L-0.3, y:CY}, cur:{x:L+1, y:CY}, lastTouchTeam:0 });
  eq('goal between posts', d.type, 'GOAL');
  ok('goalAwarded', d.goalAwarded === true);
  eq('scoring team', d.scoringTeamId, 0);
}

// ---------- goal REJECTED outside the posts ----------
{
  const d = R.evaluateBoundary({ prev:{x:L-0.3, y:CY+HALF_GOAL+0.5}, cur:{x:L+1, y:CY+HALF_GOAL+0.5}, lastTouchTeam:0 });
  ok('outside post is NOT a goal', d.type !== 'GOAL');
}

// ---------- high-speed shot cannot tunnel (swept test) ----------
{
  // prev well in front of the line, cur well past it in one frame → still detected as goal
  const d = R.evaluateBoundary({ prev:{x:L-5, y:CY}, cur:{x:L+5, y:CY}, lastTouchTeam:0 });
  eq('fast shot still detected as goal (no tunnelling)', d.type, 'GOAL');
}

// ---------- crossingIsGoal geometry ----------
ok('centre is a goal', R.crossingIsGoal(CY));
ok('just inside post is a goal', R.crossingIsGoal(CY + HALF_GOAL - BALL_R - 0.01));
ok('outside post is not a goal', !R.crossingIsGoal(CY + HALF_GOAL + 0.01));

// ---------- keeper catch classification ----------
{
  // slow ball, in reach → secure catch regardless of rng
  let secures = 0, parries = 0;
  for (let i=0;i<100;i++){ const r = R.keeperCatch({ dist:1, catchR:2.5, ballSpeed:8, handling:70, rng:i/100 });
    if (r.secure) secures++; if (r.parry) parries++; }
  ok('slow ball is mostly a secure catch', secures > 80);
  // rocket → always a parry, never secure
  let rocketSecure = false;
  for (let i=0;i<100;i++){ if (R.keeperCatch({ dist:1, catchR:2.5, ballSpeed:45, handling:99, rng:i/100 }).secure) rocketSecure = true; }
  ok('a 45-speed rocket is never cleanly held', rocketSecure === false);
  // out of reach → nothing
  const oor = R.keeperCatch({ dist:5, catchR:2.5, ballSpeed:8, handling:70, rng:0.1 });
  ok('out of reach → no catch/parry', !oor.secure && !oor.parry);
}

// ---------- 8-second rule ----------
{
  ok('7s hold is legal', R.keeperHoldViolation(7, 0, 10) === null);
  const v = R.keeperHoldViolation(8.5, 0, 10);
  eq('8s+ hold → corner', v.type, 'CORNER');
  eq('corner to attackers', v.restartTeamId, 1);
}

// ---------- back-pass / handling offence ----------
{
  const keeper = { team:0, idx:0, x:5, y:CY };
  const legal = R.keeperHandlingOffence({ teamId:1, playerId:5, bodyPart:'foot', deliberatePlay:true }, keeper);
  ok('handling an OPPONENT pass is legal', legal === null);
  const backpass = R.keeperHandlingOffence({ teamId:0, playerId:4, bodyPart:'foot', deliberatePlay:true }, keeper);
  eq('deliberate team-mate foot pass handled → indirect FK', backpass.type, 'INDIRECT_FK');
  const header = R.keeperHandlingOffence({ teamId:0, playerId:4, bodyPart:'head', deliberatePlay:true }, keeper);
  ok('team-mate HEADER back is legal to handle', header === null);
  const thr = R.keeperHandlingOffence({ teamId:0, playerId:4, touchType:'throwIn' }, keeper);
  eq('team-mate throw-in handled → indirect FK', thr.type, 'INDIRECT_FK');
}

// ---------- restart spots are legal ----------
{
  const gk = R.goalKickSpot(1);   // team1 defends x=L
  ok('goal-kick spot inside goal area (x)', gk.x > L - R.GOALA_DEPTH && gk.x < L);
  const c = R.cornerSpot(L, 1);
  ok('corner spot near the flag', Math.abs(c.x - (L-0.8)) < 0.01 && Math.abs(c.y - (W-0.8)) < 0.01);
  const ko = R.kickoffSpot();
  ok('kickoff spot is centre', ko.x === L/2 && ko.y === CY);
}

// ---------- kickoff direct own goal → corner ----------
{
  const d = R.kickoffDirectOwnGoal(0);
  eq('kickoff own goal → corner', d.type, 'CORNER');
  eq('corner to opponents', d.restartTeamId, 1);
}

console.log(`\nRules Engine: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
