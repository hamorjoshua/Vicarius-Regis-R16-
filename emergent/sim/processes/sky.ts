// The forcing. A seasonal baseline plus an anomaly that persists, drawn for the realm, for each
// quarter of the map and, lightly, for each cell. The only place the weather is random.

import { cos, exp } from '../math.ts';
import { draw, normal } from '../rng.ts';
import { P } from '../tables.ts';
import { weekOf, type State } from '../types.ts';

const TWO_PI = 6.283185307179586;

export const tBar = (high: number, w: number): number => P.tMean - P.upland * high + P.tAmp * cos((TWO_PI * (w - P.hotWeek)) / 52);
export const rBar = (w: number): number => P.rainMean * (1 + P.rainSeason * cos((TWO_PI * (w - P.wetWeek)) / 52));
export const quarterOf = (side: number, i: number): number => ((i % side) * 2 < side ? 0 : 1) + (Math.floor(i / side) * 2 < side ? 0 : 2);

export function sky(prev: State, s: State): void {
  const z = (place: number, k: number): number => normal(draw(s.seed, 'weather', place, s.t, k));
  const zT = z(9000, 0), zR = z(9000, 1), w = weekOf(s.t);
  for (let q = 0; q < 4; q++) {
    s.sky.aT[q] = P.skyPersist * prev.sky.aT[q]! + P.skyRealm * zT + P.skyQuarter * z(9001 + q, 0);
    s.sky.aR[q] = P.skyPersist * prev.sky.aR[q]! + P.skyRealm * zR + P.skyQuarter * z(9001 + q, 1);
  }
  for (let i = 0; i < s.cells.length; i++) {
    const q = quarterOf(s.side, i);
    s.sky.temp[i] = tBar(s.cells[i]!.high, w) + P.sigmaT * (s.sky.aT[q]! + P.skyCell * z(i, 0));
    s.sky.rain[i] = rBar(w) * exp(P.sigmaR * (s.sky.aR[q]! + P.skyCell * z(i, 1)));
  }
}
