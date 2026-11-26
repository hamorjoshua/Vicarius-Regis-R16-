// Make. A day of work turns what it takes in into what it gives out, limited by its scarcest input.
// Last week's choices are carried out against what is there now.

import { AIDERS, Kn, NS, P, Rc, St } from '../tables.ts';
import { around, dist, hearthIndex, holdsByCell, kinOf, payRent, rec, struggle, tenancies, tie } from '../util.ts';
import { bear } from './grow.ts';
import type { Body, Bond, State, Work } from '../types.ts';

interface Job { b: Body; w: Work; m: number; aid: number }

export function make(s: State): void {
  const want = new Map<number, number>(), jobs: Job[] = [];
  for (const b of s.bodies) {
    if (!b.alive) continue;
    const helpLeft = b.store.map(q => q * P.days);
    for (const w of b.plan) {
      const r = Rc[w.r]!, c = s.cells[w.cell]!;
      let m = w.days * Math.max(0, 1 - P.travel * dist(s.side, b.home, w.cell)) * (b.skill[w.r] ?? 1), aid = -1;
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
  const lets = tenancies(s);
  const kin = kinOf(s);
  const hearths = hearthIndex(s);
  const dues = new Map<number, Bond[]>();
  for (const bd of s.bonds) if (bd.about === 'yield' && bd.due <= s.t && bd.easedTo <= s.t) { const l = dues.get(bd.a); if (l) l.push(bd); else dues.set(bd.a, [bd]); }
  for (const j of jobs) {
    const r = Rc[j.w.r]!, c = s.cells[j.w.cell]!, b = j.b;
    let m = j.m;
    for (const [st, q] of r.from) { const key = j.w.cell * NS + st, tot = want.get(key)!, a = avail.get(key)!; if (tot > a) m = Math.min(m, (j.m * a) / tot); void q; }
    for (const [k, q] of r.inp) if (q * m > b.store[k]!) m = b.store[k]! / q;
    for (const [st, q] of r.to) { const room = bear(c, st) - c.stock[st]!; if (q * m > room) m = Math.max(0, room / q); }
    if (m <= 1e-9) continue;
    // A taking from ground whose holder lives within reach is opposed, as a taking from a store is:
    // the taker carries off only what their might wins, and what is not won stays standing.
    if (r.from.length && r.out.length && !lets.some(x => x.cell === j.w.cell && x.lease.a === b.id)) {
      const over = holds.get(j.w.cell) ?? [];
      let sum = 0, guard: Body | undefined, most = 0;
      for (const h of over) {
        sum += h.strength;
        const hb = s.bodies[h.a]!;
        if (hb.alive && h.strength > most && dist(s.side, hb.home, j.w.cell) <= P.reach) { most = h.strength; guard = hb; }
      }
      if (sum >= P.held && guard && !over.some(h => h.a === b.id)) m *= struggle(s, kin, b, guard, s.nrec);
      if (m <= 1e-9) continue;
    }
    for (const [st, q] of r.from) c.stock[st] = Math.max(0, c.stock[st]! - q * m);
    for (const [k, q] of r.inp) b.store[k] = Math.max(0, b.store[k]! - q * m);
    for (const [k, q] of r.out) b.store[k] = b.store[k]! + q * m;
    for (const [st, q] of r.to) { c.stock[st] = c.stock[st]! + q * m; b.put[st] = (b.put[st] ?? 0) + q * m; }
    for (const [st, q] of r.from) if (St[st]!.sown) b.got[st] = (b.got[st] ?? 0) + q * m;
    // A share of what is gathered from sown ground goes to whoever it is owed to.
    if (r.from.some(([st]) => St[st]!.sown)) for (const bd of dues.get(b.id) ?? []) {
      const to = s.bodies[bd.b]!;
      if (!to.alive) continue;
      for (const [k, q] of r.out) {
        const pay = Math.min(b.store[k]!, q * m * bd.share);
        b.store[k] = b.store[k]! - pay; to.store[k] = to.store[k]! + pay;
        if (bd.way === 'crown') to.owedUp[k] = (to.owedUp[k] ?? 0) + pay;
      }
    }
    if (j.aid >= 0) b.store[j.aid] = Math.max(0, b.store[j.aid]! - (Kn[j.aid]!.use * j.w.days) / P.days);
    const first = r.out[0];
    const e = rec(s, 'make', { a: b.id, cell: j.w.cell, kind: first ? first[0] : -1, q: first ? first[1] * m : 0, kind2: j.w.r, q2: j.w.days });
    // Whoever puts something onto the land has used it; that is what a holding grows from.
    // One who works ground through another's bond pays the share agreed, and the use is the holder's.
    const let_ = r.from.length || r.to.length ? lets.find(x => x.cell === j.w.cell && x.lease.a === b.id) : undefined;
    if (let_) {
      let_.lease.used = s.t;
      for (const [k, q] of r.out) payRent(s, let_.lease, k, q * m);
    }
    if (r.to.length) s.uses.push({ body: let_ ? let_.root.a : b.id, cell: j.w.cell, days: j.w.days });
    // Taking from land that others hold, with no bond of one's own, is a taking against their bonds.
    const over = holds.get(j.w.cell) ?? [];
    if (!r.from.length || !first || let_ || over.some(h => h.a === b.id)) continue;
    let sum = 0;
    for (const h of over) sum += h.strength;
    if (sum < P.held) continue;
    e.k = 'take';
    for (const h of over) {
      // A holder who lives near saw who it was. One who does not, finds the ground stripped and must guess:
      // they lay it to whichever house within reach of the ground they already think worst of.
      const hb = s.bodies[h.a]!;
      let by = b.id;
      if (hb.alive && dist(s.side, hb.home, j.w.cell) > P.reach) {
        let worst = -Infinity;
        for (const x of around(hearths, s.side, j.w.cell, P.reach + 1)) {
          if (!x.alive || x.parts.length || x.id === hb.id || dist(s.side, x.home, j.w.cell) > P.reach + 1) continue;
          const ill = (hb.lore[`house:${x.id}`] ?? 0) - tie(s, hb.id, x.id) + (x.id === b.id ? 0.1 : 0);
          if (ill > worst) { worst = ill; by = x.id; }
        }
        rec(s, 'blame', { a: hb.id, b: by, cell: j.w.cell, kind: first[0], q2: by === b.id ? 0 : 1, kind2: b.id, cause: e.id });
      }
      s.wrongs.push({ by, to: h.a, kind: first[0], q: (first[1] * m * h.strength) / sum, rec: e.id, doer: b.id });
    }
  }
}
