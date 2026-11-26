// Move. Things cross from one place to the next when the difference is worth the cost:
// water runs downhill, and a body that chose to go, goes.

import { Kn, NK, NS, P, St } from '../tables.ts';
import { holdsByCell, near, rec } from '../util.ts';
import { bear } from './grow.ts';
import type { Cell, State } from '../types.ts';

/** How much of the rain what stands on a cell holds back. */
export function hold(c: Cell): number {
  let h = 0;
  for (let k = 0; k < NS; k++) { const r = St[k]!; if (!r.holds) continue; const K = bear(c, k); if (K > 0) h += r.holds * Math.min(1, c.stock[k]! / K); }
  return Math.min(1, h);
}

/** Send a week's rain downhill, cell to cell, from the highest ground to the lowest. */
export function route(s: State, rain: (i: number) => number): { flow: number[]; own: number[]; low: number[]; held: number[] } {
  const n = s.cells.length, flow = new Array<number>(n).fill(0), own = new Array<number>(n).fill(0), low = new Array<number>(n).fill(-1), held = new Array<number>(n).fill(0);
  const order = s.cells.map((_c, i) => i).sort((a, b) => s.cells[b]!.high - s.cells[a]!.high || a - b);
  for (const i of order) {
    const c = s.cells[i]!;
    held[i] = hold(c);
    own[i] = rain(i) * (1 - (0.3 + 0.5 * held[i]!));
    flow[i] = flow[i]! + own[i]!;
    let lowest = c.high;
    for (const j of near(s.side, i, 1)) if (s.cells[j]!.high < lowest) { lowest = s.cells[j]!.high; low[i] = j; }
    if (low[i]! >= 0) flow[low[i]!] = flow[low[i]!]! + flow[i]!;
  }
  return { flow, own, low, held };
}

export function move(prev: State, s: State): void {
  const n = s.cells.length;
  const R = route(s, i => s.sky.rain[i]! / P.rainMean);
  const holds = holdsByCell(s);
  for (let i = 0; i < n; i++) {
    const c = s.cells[i]!, was = prev.cells[i]!, ratio = s.sky.rain[i]! / P.rainMean;
    // What soaks in wets the ground; what runs off is gone downhill, and on a bare slope takes soil with it.
    const soak = ratio * (0.3 + 0.5 * R.held[i]!);
    c.wet = P.wetKeep * was.wet + (1 - P.wetKeep) * (soak / 0.55 + Math.min(1, (R.flow[i]! - R.own[i]!) * 0.1));
    c.flow = R.flow[i]!;
    c.flood = c.flow > c.bank ? c.flow / c.bank - 1 : 0;
    const lo = R.low[i]!;
    if (lo >= 0) {
      const washed = P.wash * R.own[i]! * (c.high - s.cells[lo]!.high) * (1 - R.held[i]!) * c.soil;
      c.soil = Math.max(0.05, c.soil - washed); c.soil0 = Math.max(0.05, c.soil0 - washed / 2);
      s.cells[lo]!.soil = Math.min(1.3, s.cells[lo]!.soil + washed); s.cells[lo]!.soil0 = Math.min(1.3, s.cells[lo]!.soil0 + washed / 2);
    }
    if (c.flood <= 0) continue;
    // Water over the bank carries off what stands in its way and what is laid by there.
    for (let k = 0; k < NS; k++) {
      const r = St[k]!;
      if (!r.drowns || c.stock[k]! <= 0) continue;
      const lost = c.stock[k]! * Math.min(0.8, r.drowns * c.flood);
      c.stock[k] = c.stock[k]! - lost;
      if (lost <= 5) continue;
      const e = rec(s, 'decay', { cell: i, kind2: k, q: lost, q2: 1 });
      for (const h of holds.get(i) ?? []) for (const need of r.needs) s.bodies[h.a]!.why[need] = e.id;
    }
    for (const b of s.bodies) {
      if (!b.alive || b.home !== i || b.parts.length) continue;
      const share = Math.min(0.5, 0.15 * c.flood);
      let lost = 0;
      for (let k = 0; k < NK; k++) if (!Kn[k]!.fixed && b.store[k]! > 0) { lost += b.store[k]! * share; b.store[k] = b.store[k]! * (1 - share); }
      if (lost > 5) rec(s, 'decay', { a: b.id, cell: i, q: lost, q2: 1 });
    }
  }

  for (const b of s.bodies) {
    if (!b.alive || b.goto < 0 || b.goto === b.home) { b.goto = -1; continue; }
    let left = 0;
    for (let k = 0; k < NK; k++) if (Kn[k]!.fixed && b.store[k]! > 0) { left += b.store[k]!; b.store[k] = 0; }
    rec(s, 'move', { a: b.id, cell: b.goto, q: left, q2: b.home });
    b.home = b.goto;
    b.since = s.t;
    b.goto = -1;
    b.plan = [];
  }
}
