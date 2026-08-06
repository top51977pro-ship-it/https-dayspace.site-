/* Golden XI — Rules Engine (Laws of the Game, adapted to the 110×72 engine scale).
 *
 * PURE + DETERMINISTIC. This module never moves players, runs animations or
 * touches the DOM/UI. It only decides. The MatchFlowController (game.js) is the
 * sole authority that acts on these decisions.
 *
 * Node-requireable so the same logic is unit-tested headlessly (see rules-test.mjs).
 *
 * NOTE on scale: the renderer/sim uses a 110×72 pitch with a 12-unit goal mouth.
 * These are the engine's canonical internal units — all rule maths below use them
 * consistently. (A future pass could rescale to metric 105×68 / 7.32 m goals; the
 * region helpers are the only place that would change.)
 */
(function (root) {
  const L = 110, W = 72;            // pitch length / width (engine units)
  const GOAL_W = 12, HALF_GOAL = GOAL_W / 2;
  const BALL_R = 0.35;              // ball radius — used for whole-ball-over-line tests
  const CY = W / 2;                 // pitch centre line (goal-mouth centre)
  const PEN_DEPTH = 16.5 * (L / 105);   // penalty-area depth, scaled from metric
  const PEN_HALF  = (40.32 / 2) * (W / 68);
  const GOALA_DEPTH = 5.5 * (L / 105);
  const GOALA_HALF  = (18.32 / 2) * (W / 68);

  // ---- ball authoritative states -------------------------------------------
  const BALL = {
    DEAD_BALL: 'DEAD_BALL',
    FREE: 'FREE',
    FOOT_CONTROLLED: 'FOOT_CONTROLLED',
    KEEPER_HAND_CONTROLLED: 'KEEPER_HAND_CONTROLLED',
    RESTART_LOCKED: 'RESTART_LOCKED',
    IN_FLIGHT: 'IN_FLIGHT',
    OUT_OF_PLAY: 'OUT_OF_PLAY'
  };

  // ---- match-flow phases ----------------------------------------------------
  const PHASE = {
    IN_PLAY: 'IN_PLAY',
    GOAL_SCORED: 'GOAL_SCORED',
    GOAL_CELEBRATION: 'GOAL_CELEBRATION',
    RESET_AFTER_GOAL: 'RESET_AFTER_GOAL',
    KICKOFF_SETUP: 'KICKOFF_SETUP',
    KICKOFF_READY: 'KICKOFF_READY',
    GOAL_KICK_SETUP: 'GOAL_KICK_SETUP',
    GOAL_KICK_READY: 'GOAL_KICK_READY',
    CORNER_SETUP: 'CORNER_SETUP',
    CORNER_READY: 'CORNER_READY',
    THROW_IN_SETUP: 'THROW_IN_SETUP',
    THROW_IN_READY: 'THROW_IN_READY',
    HALF_TIME: 'HALF_TIME',
    FULL_TIME: 'FULL_TIME'
  };

  const RESTART = { KICKOFF:'KICKOFF', GOAL_KICK:'GOAL_KICK', CORNER:'CORNER',
                    THROW_IN:'THROW_IN', GOAL:'GOAL' };

  // which goal line a team attacks (team 0 → x=L, team 1 → x=0)
  function goalX(team){ return team === 0 ? L : 0; }

  // ---- region tests ---------------------------------------------------------
  // team = the DEFENDING team whose penalty area we test (their goal at goalX(1-... ))
  // Defending team `t` protects the goal at x = (t===0 ? 0 : L)  (they attack the other way).
  function ownGoalLineX(defTeam){ return defTeam === 0 ? 0 : L; }
  function inPenaltyArea(x, y, defTeam){
    const gl = ownGoalLineX(defTeam);
    const nearX = gl === 0 ? (x <= PEN_DEPTH) : (x >= L - PEN_DEPTH);
    return nearX && Math.abs(y - CY) <= PEN_HALF;
  }
  function inGoalArea(x, y, defTeam){
    const gl = ownGoalLineX(defTeam);
    const nearX = gl === 0 ? (x <= GOALA_DEPTH) : (x >= L - GOALA_DEPTH);
    return nearX && Math.abs(y - CY) <= GOALA_HALF;
  }

  // ---- continuous boundary + goal crossing ---------------------------------
  // Swept test: did the WHOLE ball cross a boundary plane between prev→cur?
  // For a goal/goal-line we require the ball centre to pass fully beyond the line
  // by its radius (whole ball over the line). Returns crossing detail or null.
  function sweptGoalLine(prev, cur, lineX){
    // moving toward the line? crossing plane at x = lineX ± BALL_R (whole ball)
    const plane = lineX === 0 ? (0 - BALL_R) : (L + BALL_R);
    const a = prev.x, b = cur.x;
    if (lineX === 0){
      if (a > plane && b <= plane){ const t = (plane - a) / (b - a || 1e-9);
        return { t, y: prev.y + (cur.y - prev.y) * clamp01(t) }; }
    } else {
      if (a < plane && b >= plane){ const t = (plane - a) / (b - a || 1e-9);
        return { t, y: prev.y + (cur.y - prev.y) * clamp01(t) }; }
    }
    return null;
  }
  function sweptTouchLine(prev, cur){
    // whole ball over y=0 or y=W
    if (prev.y > -BALL_R && cur.y <= -BALL_R){ const t=(-BALL_R-prev.y)/((cur.y-prev.y)||1e-9);
      return { side:0, t, x: prev.x + (cur.x-prev.x)*clamp01(t) }; }
    if (prev.y < W+BALL_R && cur.y >= W+BALL_R){ const t=(W+BALL_R-prev.y)/((cur.y-prev.y)||1e-9);
      return { side:1, t, x: prev.x + (cur.x-prev.x)*clamp01(t) }; }
    return null;
  }
  function clamp01(t){ return t < 0 ? 0 : t > 1 ? 1 : t; }

  // Is a goal-line crossing at height/`y` a valid goal? (between the posts, whole ball)
  function crossingIsGoal(y){ return Math.abs(y - CY) <= HALF_GOAL - BALL_R; }

  // Authoritative "what happened at the boundary" decision.
  // ctx: { prev:{x,y}, cur:{x,y}, lastTouchTeam, kickoffOwnGoalPossible }
  // Returns a RuleDecision or null (ball still fully in play).
  function evaluateBoundary(ctx){
    const { prev, cur, lastTouchTeam } = ctx;
    // goal lines first (x=0 and x=L)
    for (const lineX of [0, L]){
      const c = sweptGoalLine(prev, cur, lineX);
      if (!c) continue;
      const attackingTeam = lineX === 0 ? 1 : 0;   // team scoring into that goal
      const defTeam = 1 - attackingTeam;
      if (crossingIsGoal(c.y)){
        // A direct own-goal from certain restarts is not a goal (handled by flow via
        // kickoffOwnGoalPossible etc.); a normal open-play own goal counts.
        return decision('GOAL', { restartType:RESTART.KICKOFF, goalAwarded:true,
          scoringTeamId: attackingTeam, crossY:c.y, reason:'whole ball over goal line between posts' });
      }
      // ball fully over the goal line, outside the posts → corner or goal kick
      if (lastTouchTeam === defTeam){
        const side = c.y < CY ? 0 : 1;             // nearest corner
        return decision('CORNER', { restartType:RESTART.CORNER, restartTeamId:attackingTeam,
          side, lineX, reason:'defender last touch over own goal line' });
      } else {
        return decision('GOAL_KICK', { restartType:RESTART.GOAL_KICK, restartTeamId:defTeam,
          lineX, reason:'attacker last touch over goal line' });
      }
    }
    // touchlines
    const t = sweptTouchLine(prev, cur);
    if (t){
      const throwTeam = 1 - lastTouchTeam;         // opponents of last toucher
      return decision('THROW_IN', { restartType:RESTART.THROW_IN, restartTeamId:throwTeam,
        side:t.side, x:t.x, reason:'whole ball over touchline' });
    }
    return null;
  }

  function decision(type, extra){
    return Object.assign({ decisionId: (decision._n = (decision._n||0)+1),
      restartType:null, restartTeamId:-1, offendingPlayerId:-1, card:null,
      goalAwarded:false, scoringTeamId:-1, reason:'' , type }, extra);
  }

  // ---- goalkeeper hand control ---------------------------------------------
  // A shot/loose ball reaching the keeper: is it a SECURE CATCH (hand control) or
  // just a parry/rebound (stays FREE)? Fast balls or edge-of-reach contacts parry.
  // Deterministic given rng (0..1) so tests are reproducible.
  function keeperCatch(opts){
    const { dist, catchR, ballSpeed, handling, rng } = opts;
    if (dist > catchR) return { secure:false, parry:false, reach:false };
    // Very fast shots are hard to hold; strong handling raises the clean-catch ceiling.
    const holdCeiling = 20 + (handling || 60) / 100 * 16;   // ~20..36
    if (ballSpeed > 30) return { secure:false, parry:true, reach:true }; // never hold a rocket
    if (ballSpeed <= holdCeiling){
      // clean catch probability scales with how comfortably it's under the ceiling
      const margin = (holdCeiling - ballSpeed) / holdCeiling;   // 0..1
      const pCatch = 0.55 + 0.4 * margin;
      return { secure: rng < pCatch, parry: rng >= pCatch, reach:true };
    }
    return { secure:false, parry:true, reach:true };
  }

  // 8-second rule: exceeded holding time → corner to attackers on the keeper's side.
  function keeperHoldViolation(holdSeconds, keeperTeam, keeperY){
    if (holdSeconds <= 8) return null;
    const attackingTeam = 1 - keeperTeam;
    const side = keeperY < CY ? 0 : 1;
    return decision('CORNER', { restartType:RESTART.CORNER, restartTeamId:attackingTeam,
      side, lineX: ownGoalLineX(keeperTeam), reason:'keeper held ball more than 8 seconds' });
  }

  // Back-pass law: keeper may not handle a DELIBERATE foot pass / direct throw-in
  // from a team-mate. Returns an indirect-free-kick decision if illegal handling.
  function keeperHandlingOffence(lastTouch, keeper){
    if (!lastTouch) return null;
    const fromTeammate = lastTouch.teamId === keeper.team && lastTouch.playerId !== keeper.idx;
    const illegal = fromTeammate && (
      (lastTouch.bodyPart === 'foot' && lastTouch.deliberatePlay) ||
      lastTouch.touchType === 'throwIn');
    if (!illegal) return null;
    return decision('INDIRECT_FK', { restartType:'INDIRECT_FK', restartTeamId: 1 - keeper.team,
      x: keeper.x, y: keeper.y, reason:'keeper handled deliberate team-mate pass / throw-in' });
  }

  // ---- restart legal ball position -----------------------------------------
  function goalKickSpot(defTeam){
    const gl = ownGoalLineX(defTeam);
    // inside the goal area, on the side the ball went out (default centre-ish)
    const x = gl === 0 ? GOALA_DEPTH - 0.6 : L - GOALA_DEPTH + 0.6;
    return { x, y: CY };
  }
  function cornerSpot(lineX, side){
    return { x: lineX === 0 ? 0.8 : L - 0.8, y: side === 0 ? 0.8 : W - 0.8 };
  }
  function kickoffSpot(){ return { x: L/2, y: CY }; }

  // ---- kickoff own-goal special case ---------------------------------------
  // A ball put directly into the taker's own goal from a kickoff → corner (Law 8).
  function kickoffDirectOwnGoal(kickTeam){
    const defTeam = kickTeam;                    // they scored into their own goal
    const attackingTeam = 1 - defTeam;
    return decision('CORNER', { restartType:RESTART.CORNER, restartTeamId:attackingTeam,
      side:0, lineX: ownGoalLineX(defTeam), reason:'direct own goal from kick-off → corner' });
  }

  const API = {
    L, W, GOAL_W, HALF_GOAL, BALL_R, CY, PEN_DEPTH, PEN_HALF, GOALA_DEPTH, GOALA_HALF,
    BALL, PHASE, RESTART,
    goalX, ownGoalLineX, inPenaltyArea, inGoalArea,
    sweptGoalLine, sweptTouchLine, crossingIsGoal, evaluateBoundary,
    keeperCatch, keeperHoldViolation, keeperHandlingOffence,
    goalKickSpot, cornerSpot, kickoffSpot, kickoffDirectOwnGoal
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.GXRules = API;
})(typeof window !== 'undefined' ? window : globalThis);
