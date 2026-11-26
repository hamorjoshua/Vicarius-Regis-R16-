// Step 17. Mind: devotion, superstition, rumour, memory and expectation.
// People act on what they believe, and belief travels slowly and badly.

import { clamp, clamp01 } from '../math.ts';
import { P } from '../params.ts';
import { cause, event, fadeWoes, topCause } from '../ledger.ts';
import { CAP, CLERIC, COMMONER, ESTATES, MERCHANT, OFFICIAL, cid, cohort, souls, weekOf, type State } from '../types.ts';
import { inRegion } from '../util.ts';
import { growthIndex } from './crops.ts';

export function mind(prev: State, s: State): void {
  const w = weekOf(s.t);
  for (let r = 0; r < 3; r++) {
    const R = s.regions[r]!, was = prev.regions[r]!, hs = inRegion(s, r);
    const N = hs.reduce((a, h) => a + souls(h), 0);
    const clergy = hs.filter(h => h.estate === CLERIC).reduce((a, h) => a + souls(h), 0) / P.souls[r]![CLERIC]!;

    // Signs are real anomalies read by frightened people: nothing appears that the weather did not put there.
    let sign = '';
    const k = R.sky;
    if (k.tmin < 0 && w >= 13 && w <= 20) sign = 'frost in May';
    else if (s.river.flood > 0 && r === 2) sign = 'the river in flood';
    else if (k.rain > 3 * k.rBar && k.temp > 12) sign = 'a hailstorm';
    else if (k.temp > k.tBar + 6 && w >= 16 && w <= 30) sign = 'a burning sky';
    else if (R.deaths > 3 * R.deathsExp + 3) sign = 'the dying';
    else if (R.price > 1.8 * R.priceRef && was.price <= 1.8 * was.priceRef) sign = 'bread out of reach';
    const excess = clamp((R.deaths - R.deathsExp) / Math.max(1, R.deathsExp) / 4, 0, 1);
    const explained = s.t - R.inquestT < P.inquestWeeks ? P.inquestCalm : 0;
    const supWas = R.superstition;
    R.superstition = clamp01(R.superstition * P.superstitionKeep + (sign ? P.signFear : 0) + P.deathFear * excess - P.clergyExplain * clamp01(clergy) * R.devotion * R.superstition - explained * R.superstition);
    if (sign) {
      cause(s, `superstition.${r}`, sign, P.signFear);
      if (s.t - R.signT > 5 && R.superstition > P.signLine) { R.signT = s.t; R.sign = sign; event(s, 'sign', r, { sign }); }
    }
    if (excess > 0) cause(s, `superstition.${r}`, 'unexpected deaths', P.deathFear * excess);
    void supWas;

    // Scapegoating: fear looks for someone the ledger already resents.
    if (R.superstition > P.scapegoatLine && excess > 0.2 && R.blame < 0) {
      const pc = topCause(s, `price.${r}`);
      const blamed = pc && (pc.k === 'hoarding' || pc.k === 'carted away') ? MERCHANT : R.moved > 0.02 * R.souls0 && r === CAP ? -2 : s.grievance[cid(r, COMMONER)]! > 1.5 ? OFFICIAL : MERCHANT;
      R.blame = blamed === -2 ? MERCHANT : blamed;
      s.ties.push({ kind: 'grudge', a: `c${r}${COMMONER}`, b: `estate:${R.blame}`, w: 1, t: s.t });
      event(s, 'scapegoat', r, { blamed: ESTATES[R.blame]!, over: R.sign || 'the dying' });
    }
    if (R.blame >= 0 && R.superstition < P.scapegoatLine * 0.5) R.blame = -1;

    // Devotion is moved by what people live through.
    const suffering = clamp01(R.hungry / N * 4 + excess) * (1 - R.almsSeen);
    const dev = P.devotionPriests * clamp01(clergy) * (1 - R.devotion) + P.devotionAlms * R.almsSeen * (1 - R.devotion) - P.devotionSuffering * suffering * R.devotion - P.devotionDrift * (R.devotion - 0.5);
    R.devotion = clamp01(R.devotion + dev);
    if (Math.abs(dev) > 0.002) cause(s, `devotion.${r}`, dev > 0 ? (R.almsSeen > 0.3 ? 'alms seen' : 'priests present') : 'unrelieved suffering', dev);

    // Rumour of scarcity: born of the price trend, the harvest outlook and empty stalls; swollen by fear.
    const outlook = R.crops.reduce((a, c) => a + (c.sown > 0 ? Math.max(0, 1 - growthIndex(c) * (1 - c.frost) * (1 - c.blight) * (1 - c.flood)) : 0), 0) / 2;
    const dear = R.price > P.rumourDear * R.priceRef ? 1 : 0;
    const born = clamp01(P.rumourTrend * Math.max(0, R.trend) * dear + P.rumourOutlook * Math.max(0, outlook - 0.08) + (prev.record.some(e => e.k === 'shortage' && e.r === r && e.t >= s.t - 1) ? 0.3 : 0));
    let heard = 0;
    for (let q = 0; q < 3; q++) if (q !== r) heard = Math.max(heard, prev.regions[q]!.rumour.scarcity * P.rumourTravel);
    R.rumour.scarcity = clamp01(Math.max(was.rumour.scarcity * P.rumourKeep, (born + heard) * (1 + P.rumourFear * R.superstition + 0.2 * R.stage)) * (1 - explained));
    R.rumour.sickness = clamp01(Math.max(was.rumour.sickness * P.rumourKeep, R.sick * 8));
    R.rumour.raid = clamp01(R.rumour.raid * P.rumourKeep);
    // Expected scarcity is what holders hoard against.
    const hoardWas = R.hoard;
    R.hoard = clamp01(0.7 * R.hoard + 0.3 * clamp01(R.rumour.scarcity * P.hoardRumour + P.hoardTrend * Math.max(0, R.trend) * dear));
    if (hoardWas < P.hoardNote && R.hoard >= P.hoardNote) event(s, 'hoarding', r, { why: born >= heard ? (outlook > 0.15 ? 'a poor outlook' : 'rising prices') : 'rumour from afar' });

    R.deathsExp = 0.97 * R.deathsExp + 0.03 * R.deaths;
    // What a region takes for usual drifts slowly after the facts.
    R.priceRef = R.priceRef + P.refDrift * (R.price - R.priceRef);
    R.wageRef = R.wageRef + P.refDrift * (R.wage - R.wageRef);
  }

  // Memory: wrongs fade more slowly than favours. Expectation: counts decay, so the court can change its name.
  for (const h of s.holders) {
    fadeWoes(h, P.woeKeep);
    h.income = P.incomeKeep * h.income + (1 - P.incomeKeep) * h.got;
    if (h.hs) {
      h.hs.regard *= h.hs.regard < 0 ? P.wrongKeep : P.favourKeep;
      if (h.hs.memory.length > 8) h.hs.memory.splice(0, h.hs.memory.length - 8);
      if (h.hs.charge > 0 && s.t > h.hs.charge + 12) h.hs.charge = 0;
    }
  }
  for (const e of s.expect) for (const key in e) { e[key]!.asked *= P.expectKeep; e[key]!.granted *= P.expectKeep; }
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) s.accord[a]![b] = s.accord[a]![b]! * P.accordKeep;
  s.ties = s.ties.filter(x => { if (x.kind === 'grudge') x.w *= P.grudgeKeep; return x.kind !== 'grudge' || x.w > 0.15; });
  void cohort;
}

/** What an estate has learned the court grants, for a means and a payer. */
export function expects(s: State, estate: number, key: string): number {
  const e = s.expect[estate]![key];
  const asked = e ? e.asked : 0, granted = e ? e.granted : 0;
  return (granted + P.expectA) / (asked + P.expectA + P.expectB);
}
