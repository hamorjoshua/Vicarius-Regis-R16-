// Helpers shared by the systems.

import { P } from './params.ts';
import { weekOf, type Holder, type State } from './types.ts';

/** Rations a holder needs in a week. */
export const need = (h: Holder): number => h.workers * P.rationWorker + h.deps * P.rationDep;

export const inRegion = (s: State, r: number): Holder[] => s.holders.filter(h => h.region === r);
export const ofEstate = (s: State, r: number, e: number): Holder[] => s.holders.filter(h => h.region === r && h.estate === e);

/** Weeks until the grain harvest is mostly in. */
export const weeksToHarvest = (w: number): number => (w <= P.harvestMid ? P.harvestMid - w : 52 + P.harvestMid - w);

/** The share of a normal year's crop customarily still in the barns in week w. */
export function barnShare(w: number): number {
  const a = P.harvestStart, b = P.harvestEnd, span = 52 - (b - a + 1);
  if (w >= a && w <= b) return (w - a + 1) / (b - a + 1);
  const since = w > b ? w - b : w + 52 - b;
  return Math.max(0, 1 - since / span);
}

export const quarterDays = (): number[] => [P.ladyDay, P.midsummer, P.michaelmas, P.christmas];
export const QUARTER_NAMES = ['Lady Day', 'Midsummer', 'Michaelmas', 'Christmas'];
export const isQuarterDay = (w: number): boolean => quarterDays().includes(w);

/** The next quarter day strictly after week t, as an absolute week. */
export function nextQuarter(t: number, skip = 0): number {
  const q = quarterDays();
  let n = skip;
  for (let k = t + 1; k < t + 120; k++) {
    if (q.includes(weekOf(k))) { if (n === 0) return k; n--; }
  }
  return t + 13;
}
export function quarterName(t: number): string {
  const i = quarterDays().indexOf(weekOf(t));
  return i < 0 ? `week ${weekOf(t)}` : QUARTER_NAMES[i]!;
}

/** Split `total` among holders by weight; returns each share. */
export function shares<T>(xs: readonly T[], weight: (x: T) => number, total: number): number[] {
  let sum = 0;
  const ws = xs.map(x => { const v = Math.max(0, weight(x)); sum += v; return v; });
  return ws.map(v => (sum > 0 ? (total * v) / sum : 0));
}

/** Give grain to holders in proportion to a weight. */
export function spreadGrain<T extends Holder>(xs: readonly T[], weight: (x: T) => number, total: number): void {
  const sh = shares(xs, weight, total);
  for (let i = 0; i < xs.length; i++) xs[i]!.grain += sh[i]!;
}
export function spreadCoin<T extends Holder>(xs: readonly T[], weight: (x: T) => number, total: number): void {
  const sh = shares(xs, weight, total);
  for (let i = 0; i < xs.length; i++) { xs[i]!.coin += sh[i]!; xs[i]!.got += sh[i]!; }
}

export const fmt = (x: number): number => Math.round(x * 100) / 100;
