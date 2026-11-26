// What a body wants and how much it has. Cover is weeks of a need already in the store;
// welfare falls off as cover nears a need's horizon, so the scarcest need is the one worth most.

import { exp } from './math.ts';
import { Kn, NEEDS, NK, NN, P, SERVING } from './tables.ts';
import { tBar } from './processes/sky.ts';
import { appetite, living } from './util.ts';
import { weekOf, type Body, type State } from './types.ts';

export const chill = (temp: number): number => (temp < P.chillFrom ? P.chillFrom - temp : 0);

const aheadCache = new Map<string, number>();
/** The mean chill of the usual year over the weeks ahead. */
function chillAhead(high: number, w: number, weeks: number): number {
  const key = `${high}:${w}:${weeks}`;
  let v = aheadCache.get(key);
  if (v === undefined) {
    v = 0;
    for (let i = 1; i <= weeks; i++) v += chill(tBar(high, (w + i) % 52));
    v /= weeks;
    aheadCache.set(key, v);
  }
  return v;
}

/** Grown-person equivalents in a body. */
export function heads(s: State, b: Body): number {
  let h = 0;
  for (const p of living(s, b)) h += appetite((s.t - p.born) / 52);
  return h;
}

/** What a body needs this week. */
export function ask(s: State, b: Body): number[] {
  const h = heads(s, b), c = chill(s.sky.temp[b.home]!);
  return NEEDS.map(n => h * (n.per + n.cold * c));
}

/** What a body expects to need in a usual week over each need's horizon. */
export function askAhead(s: State, b: Body, h = heads(s, b)): number[] {
  const high = s.cells[b.home]!.high, w = weekOf(s.t);
  return NEEDS.map(n => h * (n.per + (n.cold ? n.cold * chillAhead(high, w, Math.min(n.horizon, 52)) : 0)));
}

/** Weeks of each need a store covers. What spoils fast cannot cover long. */
export function cover(store: number[], ahead: number[]): number[] {
  const c = new Array<number>(NN);
  for (let n = 0; n < NN; n++) {
    const R = ahead[n]!;
    if (R <= 0) { c[n] = NEEDS[n]!.horizon * 2; continue; }
    let pw = 0;
    for (const k of SERVING[n]!) {
      const q = store[k]!;
      if (q <= 0) continue;
      const kn = Kn[k]!, x = (q * kn.serves[n]!) / kn.use;
      pw += kn.keep > 0.05 && x > R / kn.keep ? R / kn.keep : x;
    }
    c[n] = pw / R;
  }
  return c;
}

/** The good of holding c weeks of need n. Its slope at nothing is the need's harm. */
export const good = (n: number, c: number): number => { const N = NEEDS[n]!; return (N.harm * N.horizon * (1 - exp((-3 * c) / N.horizon))) / 3; };
export const slope = (n: number, c: number): number => { const N = NEEDS[n]!; return N.harm * exp((-3 * c) / N.horizon); };

export function welfare(store: number[], ahead: number[]): number {
  const c = cover(store, ahead);
  let w = 0;
  for (let n = 0; n < NN; n++) w += good(n, c[n]!);
  return w;
}

/** Welfare T weeks on: the store will have been drawn down by then, and what is pending will have come in. */
export function welfareLater(store: number[], pend: number[], ahead: number[], T: number): number {
  const c = cover(store, ahead), p = cover(pend, ahead);
  let w = 0;
  for (let n = 0; n < NN; n++) w += good(n, (c[n]! > T ? c[n]! - T : 0) + (ahead[n]! > 0 ? p[n]! : 0));
  return w;
}

export const zeros = (): number[] => new Array<number>(NK).fill(0);
