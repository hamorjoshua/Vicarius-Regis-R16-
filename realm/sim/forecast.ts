// Forecasts. Previews never show the drawn future: `expected` assumes the season's baseline weather and no
// boundary events; `ensemble` runs futures on a separate stream and reports how often things happen.

import { P } from './params.ts';
import { EXPECTED, type Chance } from './rng.ts';
import { advance } from './step.ts';
import type { Ruling, State } from './types.ts';

export interface ForecastLine { path: string; from: number; to: number; delta: number; weight: number }
export interface Odds { what: string; withRuling: number; without: number; of: number }
export interface Forecast { weeks: number; lines: ForecastLine[]; odds: Odds[] }

/** The readouts a forecast watches, with a scale that makes their changes comparable. */
function watch(s: State, holder: string | null): [string, number, number][] {
  const out: [string, number, number][] = [['standing', s.standing, 1], ['purse', s.purse, 600], ['granary', s.granary, 4000]];
  for (let r = 0; r < 3; r++) {
    const R = s.regions[r]!;
    out.push([`price.${r}`, R.price, 0.12], [`unrest.${r}`, R.unrest, 0.4], [`readiness.${r}`, R.readiness, 0.08], [`hungry.${r}`, R.hungry, 150], [`sick.${r}`, R.sick, 0.01], [`bandits.${r}`, R.bandits, 10]);
  }
  for (let i = 0; i < 18; i++) out.push([`grievance.${i}`, s.grievance[i]!, 0.3]);
  for (const w of s.works) out.push([`works.${w.id}`, w.cond, 0.05]);
  for (const d of s.duties) if (d.kind === 'provisioning' || d.kind === 'relief') out.push([`duty.${d.id}`, d.provision, 0.1]);
  if (holder) { const h = s.holders.find(x => x.id === holder); if (h) out.push([`pressure.${holder}`, h.pressure, 0.6]); }
  return out;
}

function run(s: State, rulings: Ruling[], weeks: number, ch: Chance): State {
  let cur = advance(s, rulings, { chance: ch });
  for (let i = 1; i < weeks && !cur.over; i++) cur = advance(cur, [], { chance: ch });
  return cur;
}

/** What a ruling is expected to do over the coming weeks, against leaving the petition unheard. */
export function forecast(state: State, ruling: Ruling, weeks: number, mode: 'expected' | 'ensemble' = 'expected'): Forecast {
  const p = state.docket.find(x => x.id === ruling.petition);
  const holder = p ? p.for : null;
  const a = run(state, [ruling], weeks, EXPECTED), b = run(state, [], weeks, EXPECTED);
  const wa = watch(a, holder), wb = watch(b, holder);
  const lines: ForecastLine[] = [];
  for (let i = 0; i < wa.length; i++) {
    const d = wa[i]![1] - wb[i]![1];
    const weight = Math.abs(d) / wa[i]![2];
    if (weight > 0.5) lines.push({ path: wa[i]![0], from: wb[i]![1], to: wa[i]![1], delta: d, weight });
  }
  lines.sort((x, y) => y.weight - x.weight);
  const odds: Odds[] = [];
  if (mode === 'ensemble') {
    const kinds = ['flood', 'riot', 'breach', 'famine'];
    const count = (s: State, k: string): number => (s.record.some(e => e.t >= state.t && e.k === k) ? 1 : 0);
    const withR = kinds.map(() => 0), without = kinds.map(() => 0);
    for (let i = 0; i < P.ensemble; i++) {
      const ch: Chance = { mode: 'real', stream: 1000 + i };
      const fa = run(state, [ruling], weeks, ch), fb = run(state, [], weeks, ch);
      kinds.forEach((k, j) => { withR[j] = withR[j]! + count(fa, k); without[j] = without[j]! + count(fb, k); });
    }
    kinds.forEach((k, j) => { if (withR[j]! + without[j]! > 0) odds.push({ what: k, withRuling: withR[j]!, without: without[j]!, of: P.ensemble }); });
  }
  return { weeks, lines: lines.slice(0, 5), odds };
}
