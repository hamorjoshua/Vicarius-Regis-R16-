// One source of chance. Every number is a hash of (seed, channel, region, week, k):
// adding a channel or reordering systems never shifts another channel's numbers.

import { ln, sqrt } from './math.ts';

/** The designated draws. No other channel may be used; `draw` throws on anything else. */
export const CHANNELS = ['founding', 'weather', 'constitution', 'pestilence', 'raiders', 'abroad'] as const;
export type Channel = (typeof CHANNELS)[number];

const channelId: Record<string, number> = {};
CHANNELS.forEach((c, i) => { channelId[c] = (i + 1) * 0x9e3779b1; });

function mix(h: number): number {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Uniform in [0,1). */
export function draw(seed: number, channel: Channel, region: number, week: number, k = 0): number {
  const c = channelId[channel];
  if (c === undefined) throw new Error(`chance outside the boundary: "${channel}" is not a designated draw`);
  let h = mix((seed | 0) ^ 0x51ed270b);
  h = mix(h ^ c);
  h = mix(h ^ Math.imul(region + 1, 0x27d4eb2f));
  h = mix(h ^ Math.imul(week + 1, 0x165667b1));
  h = mix(h ^ Math.imul(k + 1, 0x9e3779b9));
  const h2 = mix(h ^ 0x6a09e667);
  return (h * 2097152 + (h2 >>> 11)) / 9007199254740992;
}

/** Standard normal by the inverse CDF (Acklam), from one uniform. */
export function normal(u: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  if (u < 1e-12) u = 1e-12;
  if (u > 1 - 1e-12) u = 1 - 1e-12;
  if (u < 0.02425) {
    const q = sqrt(-2 * ln(u));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (u > 1 - 0.02425) {
    const q = sqrt(-2 * ln(1 - u));
    return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  const q = u - 0.5, r = q * q;
  return ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

/** How the boundary is read this step. `expected` is the forecast's world: the season's
 *  baseline weather and no boundary events. `stream` separates ensemble futures from the real one. */
export interface Chance { mode: 'real' | 'expected'; stream: number }
export const REAL: Chance = { mode: 'real', stream: 0 };
export const EXPECTED: Chance = { mode: 'expected', stream: 0 };

export const u01 = (ch: Chance, seed: number, channel: Channel, region: number, week: number, k = 0): number =>
  ch.mode === 'expected' ? 0.999999 : draw(seed + Math.imul(ch.stream, 7919), channel, region, week, k);

export const z01 = (ch: Chance, seed: number, channel: Channel, region: number, week: number, k = 0): number =>
  ch.mode === 'expected' ? 0 : normal(draw(seed + Math.imul(ch.stream, 7919), channel, region, week, k));
