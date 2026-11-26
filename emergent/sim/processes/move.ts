// Move. Things cross from one place to the next when the difference is worth the cost:
// water runs downhill, and a body that chose to go, goes.

import { Kn, NK, P } from '../tables.ts';
import { near, rec } from '../util.ts';
import type { State } from '../types.ts';

export function move(prev: State, s: State): void {
  const n = s.cells.length;
  for (let i = 0; i < n; i++) {
    const c = s.cells[i]!, was = prev.cells[i]!;
    c.wet = P.wetKeep * was.wet + (1 - P.wetKeep) * (s.sky.rain[i]! / P.rainMean);
  }
  for (let i = 0; i < n; i++) {
    const was = prev.cells[i]!;
    let low = -1, lowest = was.high;
    for (const j of near(s.side, i, 1)) if (prev.cells[j]!.high < lowest) { lowest = prev.cells[j]!.high; low = j; }
    if (low < 0) continue;
    const run = P.downhill * was.wet * P.wetKeep;
    s.cells[i]!.wet -= run;
    s.cells[low]!.wet += run;
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
