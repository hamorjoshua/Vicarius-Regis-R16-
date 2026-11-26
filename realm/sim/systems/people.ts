// Step 13. Consumption: everyone eats what they can get; nourishment, births and deaths.

import { clamp } from '../math.ts';
import { P } from '../params.ts';
import { draw } from '../rng.ts';
import { cause, event } from '../ledger.ts';
import { souls, work, type Holder, type State } from '../types.ts';
import { need } from '../util.ts';

/** The head of a house has died: the heir succeeds to holdings, debts and grudges. */
export function succeed(s: State, h: Holder, why: string): void {
  const hs = h.hs!;
  const dead = hs.head;
  hs.gen++;
  hs.head = hs.line[hs.gen % hs.line.length]! + (hs.gen >= hs.line.length ? ' the younger' : '');
  hs.hazard = 0;
  hs.sick = false;
  // Constitution is drawn once per person, at birth: a designated draw.
  hs.constitution = 0.5 + draw(s.seed, 'constitution', s.holders.indexOf(h), hs.gen);
  hs.esteem *= 0.7;
  h.workers = Math.max(1, h.workers - 1);
  event(s, 'death', h.region, { house: h.id, dead, heir: hs.head, why });
  if (hs.office && hs.esteem < P.officeEsteem) {
    const o = s.offices.find(x => x.id === hs.office);
    if (o) { o.holder = null; event(s, 'vacancy', h.region, { office: o.id, dead }); }
    hs.office = null;
  }
}

export function people(prev: State, s: State): void {
  for (const R of s.regions) { R.hungry = 0; R.deaths = 0; }
  const room = [0, 1, 2].map(r => clamp(1 + P.birthRoom * (s.regions[r]!.souls0 / Math.max(1, s.holders.reduce((a, h) => a + (h.region === r ? souls(h) : 0), 0)) - 1), 0.6, 2));
  for (const h of s.holders) {
    const R = s.regions[h.region]!, nd = need(h);
    if (nd <= 0) continue;
    const eat = Math.min(h.grain, nd);
    h.grain -= eat;
    h.short = nd - eat;
    h.n = 0.7 * h.n + 0.3 * (eat / nd);
    h.h = clamp(0.9 * h.h + 0.1 * (0.45 + 0.55 * h.n) - (h.hs && h.hs.sick ? 0.03 : 0), 0.3, 1);
    h.grain *= 1 - P.spoil * (R.sky.moist > 1.3 ? 1.5 : 1);
    if (h.short > 0.05 * nd) R.hungry += souls(h) * (h.short / nd);

    const gap = Math.max(0, P.hungerLine - h.n);
    const hz = P.deathHunger * gap * gap;
    const births = h.workers * P.birth0 * (h.n > 0.8 ? 1 : 0.5) * room[h.region]!, grow = h.deps * P.mature;
    const dW = h.workers * (P.death0 + hz), dD = h.deps * (P.death0 * 1.4 + hz * 1.5);
    if (h.hs === null) {
      h.workers += grow - dW; h.deps += births - grow - dD;
      R.deaths += dW + dD;
      if (hz > P.death0) cause(s, `deaths.${h.region}`, 'hunger', (h.workers + h.deps) * hz);
    } else {
      // A named person either dies or does not: hazard gathers until it passes the constitution drawn at birth.
      const hs = h.hs;
      hs.hazard += P.hazardAge + hz * P.hazardHunger + (hs.sick ? P.hazardSick : 0);
      h.deps = Math.max(0, h.deps + births - grow - dD);
      h.workers = Math.max(1, h.workers + grow - h.workers * hz);
      if (hs.hazard > hs.constitution) succeed(s, h, hs.sick ? 'sickness' : hz > 0.002 ? 'hunger' : 'age');
    }
  }
  for (let r = 0; r < 3; r++) {
    const R = s.regions[r]!, n = s.holders.reduce((a, h) => a + (h.region === r ? souls(h) : 0), 0);
    if (R.hungry > P.famineLine * n && !prev.record.some(e => e.k === 'famine' && e.r === r && e.t > s.t - 10)) event(s, 'famine', r, { hungry: Math.round(R.hungry) });
  }
  const g = work(s, 'granary');
  const rot = s.granary * P.spoil * (1 + P.granaryRot * (1 - g.cond));
  s.granary -= rot;
  cause(s, 'granary', 'spoilage', -rot);
}
