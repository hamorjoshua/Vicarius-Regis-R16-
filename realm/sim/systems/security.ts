// Step 15. Security: order is kept by fed, paid soldiers and watchmen, and broken by desperate people and raiders.
// Bandits are people from the realm itself, not a spawn.

import { clamp, clamp01 } from '../math.ts';
import { P } from '../params.ts';
import { u01, type Chance } from '../rng.ts';
import { cause, event, woe } from '../ledger.ts';
import { COMMONER, HIGH, SOLDIER, cid, cohort, inWeeks, weekOf, work, type State } from '../types.ts';
import { inRegion, need, shares } from '../util.ts';

export function security(prev: State, s: State, ch: Chance): void {
  const w = weekOf(s.t);
  for (let r = 0; r < 3; r++) {
    const R = s.regions[r]!, hs = inRegion(s, r);
    const soldiers = hs.filter(h => h.estate === SOLDIER), troop = cohort(s, r, SOLDIER), commons = cohort(s, r, COMMONER);
    const men = soldiers.reduce((a, h) => a + h.workers, 0);
    const fed = soldiers.reduce((a, h) => a + h.n * h.workers, 0) / Math.max(1, men);
    const well = soldiers.reduce((a, h) => a + h.h * h.workers, 0) / Math.max(1, men);
    const owedWeeks = soldiers.reduce((a, h) => a + h.arrears, 0) / Math.max(1, men * P.paySoldier);
    const paid = 1 - clamp01(owedWeeks / P.arrearsWeeks);
    const strength = clamp01(men / (P.souls[r]![SOLDIER]! * P.workerShare));
    const target = Math.min(fed, 0.4 + 0.6 * paid) * well * (0.5 + 0.5 * strength);
    const was = R.readiness;
    R.readiness = 0.8 * R.readiness + 0.2 * target;
    if (R.readiness < was - 0.004) cause(s, `readiness.${r}`, fed < 0.4 + 0.6 * paid ? 'hungry garrison' : paid < 0.9 ? 'unpaid garrison' : well < 0.85 ? 'sickness' : 'thin ranks', R.readiness - was);

    // Unpaid or hungry soldiers desert, and plunder the households they are billeted on.
    if (owedWeeks > P.desertWeeks || fed < 0.7) {
      const gone = troop.workers * P.desertRate;
      troop.workers -= gone; R.bandits += gone;
      const take = men * P.plunder;
      const victims = hs.filter(h => h.estate === COMMONER && h.grain > 0);
      const sh = shares(victims, h => h.grain, take);
      let took = 0;
      victims.forEach((h, i) => { const g = Math.min(h.grain * 0.3, sh[i]!); h.grain -= g; took += g; woe(s, h, 'billet', g, 'garrison'); });
      const ns = shares(soldiers, need, took);
      soldiers.forEach((h, i) => { h.grain += ns[i]!; });
      if (!prev.record.some(e => e.k === 'desertion' && e.r === r && e.t > s.t - 8)) event(s, 'desertion', r, { why: owedWeeks > P.desertWeeks ? 'unpaid' : 'hungry', weeks: Math.round(owedWeeks) });
    }

    // The desperate take to the roads.
    if (commons.pressure >= P.roadPressure) {
      const go = commons.workers * P.roadRate * (commons.pressure - P.roadPressure + 1);
      commons.workers -= go; R.bandits += go;
      cause(s, `bandits.${r}`, 'the desperate', go);
    }
    const before = R.bandits;
    const caught = R.bandits * P.patrolRate * R.readiness * R.watch * (R.patrol > s.t ? 2.5 : 1);
    const home = commons.pressure < 2 ? R.bandits * P.banditReturn : 0;
    R.bandits = Math.max(0, R.bandits - caught - home);
    commons.workers += home + caught * 0.5;
    R.deaths += caught * 0.5;
    if (caught > 0.05) cause(s, `bandits.${r}`, R.patrol > s.t ? 'patrols' : 'the watch', -caught);
    if (prev.regions[r]!.bandits < P.banditLine && before >= P.banditLine) {
      const famine = prev.record.some(e => (e.k === 'famine' || e.k === 'desertion') && e.r === r && e.t > s.t - 16);
      event(s, 'bandits', r, { n: Math.round(before), after: famine ? 'hardship' : 'thin watch' });
    }
    // Bandits live on other people's stores.
    if (R.bandits > 1) {
      const take = R.bandits * P.banditEat;
      const victims = hs.filter(h => h.grain > 0);
      const sh = shares(victims, h => h.grain, take);
      victims.forEach((h, i) => { const g = Math.min(h.grain * 0.2, sh[i]!); h.grain -= g; if (R.bandits > P.banditLine / 2) woe(s, h, 'theft', g, 'bandits'); });
    }
    // In disorder, theft rises without any band on the road.
    if (R.stage >= 2) {
      const rich = hs.filter(h => h.estate !== COMMONER && h.grain > 0);
      let took = 0;
      for (const h of rich) { const g = h.grain * P.disorderTheft * (R.stage - 1); h.grain -= g; took += g; woe(s, h, 'theft', g, 'disorder'); }
      commons.grain += took;
    }
  }

  // The raid draw: does a band cross the Highland border?
  {
    const R = s.regions[HIGH]!, wall = work(s, 'wall.1');
    const season = inWeeks(w, P.raidStart, P.raidEnd) ? 1 : inWeeks(w, 12, P.raidStart - 1) ? 0.3 : 0.06;
    const fWall = 1 + P.raidWall * (1 - wall.cond), fReady = 1 + P.raidReady * (1 - R.readiness), fUnrest = 1 + 0.25 * R.unrest;
    const odds = clamp(P.raidOdds * season * fWall * fReady * fUnrest, 0, 0.6);
    s.ledger['odds.raid'] = [
      { k: 'season', a: season, t: s.t, x: '' }, { k: 'the wall', a: fWall, t: s.t, x: '' },
      { k: 'the garrison', a: fReady, t: s.t, x: '' }, { k: 'disorder', a: fUnrest, t: s.t, x: '' }, { k: 'odds', a: odds, t: s.t, x: '' },
    ];
    if (u01(ch, s.seed, 'raiders', HIGH, s.t, 0) < odds) {
      const size = 0.4 + 1.2 * u01(ch, s.seed, 'raiders', HIGH, s.t, 1);
      const bite = size * (1 - 0.8 * wall.cond * R.readiness);
      let grain = 0, beasts = 0;
      for (const h of inRegion(s, HIGH)) {
        const g = h.grain * P.raidGrain * bite, b = h.beasts * P.raidBeasts * bite;
        h.grain -= g; h.beasts -= b; grain += g; beasts += b;
        woe(s, h, 'raid', g + b * P.meatPerBeast, `w${w}`);
      }
      const dead = cohort(s, HIGH, COMMONER).workers * 0.004 * bite;
      cohort(s, HIGH, COMMONER).workers -= dead; R.deaths += dead;
      wall.cond = clamp01(wall.cond - 0.06 * size);
      R.rumour.raid = 1;
      const main = fWall >= fReady ? (wall.cond < 0.7 ? 'wall' : 'season') : R.readiness < 0.7 ? 'garrison' : 'season';
      event(s, 'draw', HIGH, { what: 'raid', oneIn: Math.round(1 / odds), main, wall: Math.round(wall.cond * 100), ready: Math.round(R.readiness * 100), grain: Math.round(grain), beasts: Math.round(beasts), dead: Math.round(dead) });
      if (R.readiness < 0.6) { s.grievance[cid(HIGH, COMMONER)] = s.grievance[cid(HIGH, COMMONER)]! + 0.4; cause(s, `grievance.${cid(HIGH, COMMONER)}`, 'raid unanswered', 0.4); }
    }
  }
}
