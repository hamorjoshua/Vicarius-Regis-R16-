// Make. A day of work turns what it takes in into what it gives out, limited by its scarcest input.
// Last week's choices are carried out against what is there now.

import { AIDERS, Kn, NS, P, Rc, St } from '../tables.ts';
import { dist, holdsByCell, rec } from '../util.ts';
import { bear } from './grow.ts';
import type { Body, State, Work } from '../types.ts';

interface Job { b: Body; w: Work; m: number; aid: number }

export function make(s: State): void {
  const want = new Map<number, number>(), jobs: Job[] = [];
  for (const b of s.bodies) {
    if (!b.alive) continue;
    const helpLeft = b.store.map(q => q * P.days);
    for (const w of b.plan) {
      const r = Rc[w.r]!, c = s.cells[w.cell]!;
      let m = w.days * Math.max(0, 1 - P.travel * dist(s.side, b.home, w.cell)), aid = -1;
      if (r.aid) for (const k of AIDERS[r.aid] ?? []) if (helpLeft[k]! >= w.days) { helpLeft[k] = helpLeft[k]! - w.days; m *= Kn[k]!.aids[r.aid]!; aid = k; break; }
      for (const [st] of r.from) { const x = c.stock[st]!; m *= x / (x + St[st]!.thin); }
      if (m <= 0) continue;
      jobs.push({ b, w, m, aid });
      for (const [st, q] of r.from) { const key = w.cell * NS + st; want.set(key, (want.get(key) ?? 0) + q * m); }
    }
    b.plan = [];
    b.spent = 0;
  }
  // When more is wanted of a thing than stands there, everyone gets the same share of their want.
  const avail = new Map<number, number>();
  for (const [key] of want) avail.set(key, s.cells[Math.floor(key / NS)]!.stock[key % NS]! * P.glean);
  const holds = holdsByCell(s);
  for (const j of jobs) {
    const r = Rc[j.w.r]!, c = s.cells[j.w.cell]!, b = j.b;
    let m = j.m;
    for (const [st, q] of r.from) { const key = j.w.cell * NS + st, tot = want.get(key)!, a = avail.get(key)!; if (tot > a) m = Math.min(m, (j.m * a) / tot); void q; }
    for (const [k, q] of r.inp) if (q * m > b.store[k]!) m = b.store[k]! / q;
    for (const [st, q] of r.to) { const room = bear(c, st) - c.stock[st]!; if (q * m > room) m = Math.max(0, room / q); }
    if (m <= 1e-9) continue;
    for (const [st, q] of r.from) c.stock[st] = Math.max(0, c.stock[st]! - q * m);
    for (const [k, q] of r.inp) b.store[k] = Math.max(0, b.store[k]! - q * m);
    for (const [k, q] of r.out) b.store[k] = b.store[k]! + q * m;
    for (const [st, q] of r.to) c.stock[st] = c.stock[st]! + q * m;
    if (j.aid >= 0) b.store[j.aid] = Math.max(0, b.store[j.aid]! - (Kn[j.aid]!.use * j.w.days) / P.days);
    const first = r.out[0];
    const e = rec(s, 'make', { a: b.id, cell: j.w.cell, kind: first ? first[0] : -1, q: first ? first[1] * m : 0, kind2: j.w.r, q2: j.w.days });
    // Whoever puts something onto the land has used it; that is what a holding grows from.
    if (r.to.length) s.uses.push({ body: b.id, cell: j.w.cell, days: j.w.days });
    // Taking from land that others hold, with no bond of one's own, is a taking against their bonds.
    const over = holds.get(j.w.cell) ?? [];
    if (!r.from.length || !first || over.some(h => h.a === b.id)) continue;
    let sum = 0;
    for (const h of over) sum += h.strength;
    if (sum < P.held) continue;
    e.k = 'take';
    for (const h of over) s.wrongs.push({ by: b.id, to: h.a, kind: first[0], q: (first[1] * m * h.strength) / sum, rec: e.id });
  }
}
