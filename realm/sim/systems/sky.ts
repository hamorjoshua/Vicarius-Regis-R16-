// Step 7. The sky: a seasonal baseline plus a persistent anomaly. The only place the weather is random.

import { clamp, cos, exp } from '../math.ts';
import { P } from '../params.ts';
import { z01, type Chance } from '../rng.ts';
import { event } from '../ledger.ts';
import { HIGH, weekOf, type State } from '../types.ts';

const TWO_PI = 6.283185307179586;

export const tBar = (r: number, w: number): number => P.tMean[r]! + P.tAmp[r]! * cos((TWO_PI * (w - P.hotWeek)) / 52);
export const rBar = (r: number, w: number): number => P.rainMean[r]! * (1 + P.rainSeason * cos((TWO_PI * (w - P.wetWeek)) / 52));

export function sky(prev: State, s: State, ch: Chance): void {
  const w = weekOf(s.t);
  const zT = z01(ch, s.seed, 'weather', 9, s.t, 0), zR = z01(ch, s.seed, 'weather', 9, s.t, 1);
  for (let r = 0; r < 3; r++) {
    const k = s.regions[r]!.sky, was = prev.regions[r]!.sky;
    k.aT = P.skyPersist * was.aT + P.skyRealm * zT + P.skyRegion * z01(ch, s.seed, 'weather', r, s.t, 0);
    k.aR = P.skyPersist * was.aR + P.skyRealm * zR + P.skyRegion * z01(ch, s.seed, 'weather', r, s.t, 1);
    k.tBar = tBar(r, w);
    k.rBar = rBar(r, w);
    k.temp = k.tBar + P.sigmaT * k.aT;
    k.rain = k.rBar * exp(P.sigmaR * k.aR);
    k.tmin = k.temp - P.tminGap;
    // Soil moisture is the running balance of rain against what a warm week dries.
    const dry = clamp(1 - P.evap * (k.temp - 10), 0.6, 1.3);
    k.moist = clamp(P.moistKeep * was.moist + (1 - P.moistKeep) * (k.rain / P.rainMean[r]!) * dry, 0.1, 3);
    // Snow lies while it is cold and runs off when it thaws.
    let melt = 0;
    if (k.temp < P.snowTemp) { k.snow = was.snow + k.rain; k.runoff = k.rain * 0.15; }
    else { melt = Math.min(was.snow, P.melt * k.temp); k.snow = was.snow - melt; k.runoff = k.rain + melt; }
    if (r === HIGH && k.snow > P.snowBlock && was.snow <= P.snowBlock) event(s, 'snow', r, { depth: Math.round(k.snow) });
    if (k.rain > 2.6 * k.rBar) event(s, 'storm', r, { rain: Math.round(k.rain), usual: Math.round(k.rBar) });
  }
}
