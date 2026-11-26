// Step 8. The land: the river, floods, and the works that decay and are repaired.

import { clamp, clamp01 } from '../math.ts';
import { P } from '../params.ts';
import { cause, event, woe } from '../ledger.ts';
import { HIGH, RIV, work, type State } from '../types.ts';
import { inRegion } from '../util.ts';

export function land(prev: State, s: State): void {
  // The river rises with Highland runoff from the week before and local runoff this week.
  const hi = prev.regions[HIGH]!.sky.runoff / P.rainMean[HIGH]!;
  const lo = s.regions[RIV]!.sky.runoff / P.rainMean[RIV]!;
  const level = P.riverBase + P.riverKH * hi + P.riverKR * lo;
  const levee = work(s, 'levee');
  // Even a ruined levee leaves the river its natural banks.
  const holds = P.leveeCap * (P.leveeBanks + (1 - P.leveeBanks) * levee.cond);
  s.river.level = level;
  s.river.flood = 0;
  if (level > holds) {
    // A plain already under water has less left to lose.
    const sev = clamp((level - holds) / holds, 0.08, 1) * (prev.river.flood > 0 ? 0.3 : 1);
    s.river.flood = sev;
    const R = s.regions[RIV]!;
    for (const c of R.crops) if (c.sown > 0) c.flood = 1 - (1 - c.flood) * (1 - P.floodCrop * sev);
    let lost = 0;
    for (const h of inRegion(s, RIV)) {
      const g = h.grain * P.floodStore * sev, b = h.beasts * P.floodBeasts * sev;
      h.grain -= g; h.beasts -= b; lost += g;
      woe(s, h, 'flood', g + b * P.meatPerBeast + h.sown[0]! * P.floodCrop * sev * 20, `w${s.t}`);
    }
    R.foul = clamp01(R.foul + P.floodFoul * sev);
    levee.cond = clamp01(levee.cond - P.floodLevee * sev);
    work(s, 'road.cr').cond = clamp01(work(s, 'road.cr').cond - P.floodRoad * sev);
    work(s, 'road.hr').cond = clamp01(work(s, 'road.hr').cond - P.floodRoad * sev);
    const storm = hi > lo * 1.2 ? 'highland' : 'local';
    event(s, 'flood', RIV, { sev: Math.round(sev * 100), level: Math.round(level * 100), holds: Math.round(holds * 100), levee: Math.round(prev.works.find(x => x.id === 'levee')!.cond * 100), storm, lost: Math.round(lost) });
    cause(s, 'works.levee', 'flood', -P.floodLevee * sev);
    cause(s, 'foul.2', 'flood', P.floodFoul * sev);
  }

  // Every work decays; rain, snow and neglect hurry it.
  for (const w of s.works) {
    const k = s.regions[w.region]!.sky;
    let decay = P.workDecay;
    if (w.kind === 'road') decay *= 1 + clamp(k.rain / k.rBar - 1, 0, 2) * 0.6;
    if (w.kind === 'granary' && k.moist > 1.3) decay *= 1.5;
    if (w.kind === 'wells') decay *= 1 + s.regions[w.region]!.foul;
    w.cond = clamp01(w.cond - decay);
    cause(s, `works.${w.id}`, 'decay', -decay);
    // Repairs paid from the purse are laid course by course.
    if (w.funded > 0) {
      const lay = Math.min(w.funded, P.repairPace);
      w.funded -= lay; w.cond = clamp01(w.cond + lay);
      cause(s, `works.${w.id}`, 'purse', lay);
    }
  }
  for (const R of s.regions) R.foul *= P.foulKeep;
}
