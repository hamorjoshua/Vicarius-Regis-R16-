// Gather. People who keep acting together become a body; a body that stops, dissolves.
// In this stage the only body is a hearth: people who share one store.

import { Kn, NK, NN, P } from '../tables.ts';
import { askAhead, heads, welfare } from '../value.ts';
import { around, bond, dist, head, kinOf, leaves, living, rec, regard } from '../util.ts';
import type { Body, Person, State } from '../types.ts';

export function body(s: State, home: number): Body {
  const b: Body = { id: s.bodies.length, home, store: new Array<number>(NK).fill(0), members: [], parts: [], of: -1, alive: true, since: s.t, plan: [], spent: 0, goto: -1, why: new Array<number>(NN).fill(-1), ways: {}, stuck: 0, pressed: false, lore: {}, recent: [], skill: [], aim: null, hope: [], put: [], got: [], plea: [], away: 0, rank: '', owedUp: [] };
  s.bodies.push(b);
  return b;
}

function shift(s: State, p: Person, to: Body): void {
  const from = s.bodies[p.body]!;
  from.members = from.members.filter(i => i !== p.id);
  to.members.push(p.id);
  p.body = to.id;
}

/** Hand everything a body holds or owes to another. */
function handOver(s: State, from: Body, to: Body, share: number): void {
  if (share >= 1 && from.rank && !to.rank) to.rank = from.rank;
  for (let k = 0; k < NK; k++) {
    if (Kn[k]!.fixed && to.home !== from.home) continue;
    const q = from.store[k]! * share;
    from.store[k] = from.store[k]! - q;
    to.store[k] = to.store[k]! + q;
  }
  for (const bd of s.bonds.slice()) {
    if (share >= 1 && bd.about !== 'person' && bd.about !== 'act') {
      // Everything passes whole: the bond itself changes hands, so that whatever rests on it still does.
      if (bd.a === from.id) bd.a = to.id;
      if (bd.b === from.id) bd.b = to.id;
    } else if (bd.about === 'land' && bd.a === from.id) {
      const mine = s.bonds.find(x => x.about === 'land' && x.a === to.id && x.cell === bd.cell);
      if (mine) mine.strength += bd.strength * share; else bond(s, { about: 'land', a: to.id, cell: bd.cell, basis: bd.basis, strength: bd.strength * share, since: bd.since });
      bd.strength *= 1 - share;
    } else if (bd.about === 'act' && share >= 1) {
      if (bd.a === from.id) bd.a = to.id;
      if (bd.b === from.id) bd.b = to.id;
      if (bd.a === bd.b) bd.q = 0;
    }
  }
}

const depth = (s: State, b: Body): number => (b.parts.length ? 1 + Math.max(...b.parts.map(p => depth(s, s.bodies[p]!))) : 0);

/** Bodies that hold one another well enough, all round, become one body; one that no longer does, comes apart. */
function band(s: State): void {
  // Coming apart: a part that the rest no longer hold well leaves; a body of fewer than two is no body.
  for (const c of s.bodies) {
    if (!c.alive || !c.parts.length) continue;
    c.parts = c.parts.filter(p => s.bodies[p]!.alive);
    for (const p of c.parts.slice()) {
      const pb = s.bodies[p]!;
      let sum = 0, n = 0;
      for (const q of c.parts) if (q !== p) { sum += regard(s, pb, s.bodies[q]!) + regard(s, s.bodies[q]!, pb); n += 2; }
      if (n && sum / n >= 0) continue;
      c.parts = c.parts.filter(x => x !== p);
      pb.of = -1;
      rec(s, 'leave', { a: p, b: c.id, kind2: -3, cell: pb.home });
    }
    if (c.parts.length >= 2) { c.home = s.bodies[c.parts[0]!]!.home; continue; }
    const last = c.parts[0] !== undefined ? s.bodies[c.parts[0]]! : undefined;
    if (last) { handOver(s, c, last, 1); last.of = -1; }
    c.alive = false; c.parts = [];
    rec(s, 'leave', { b: c.id, kind2: -4, cell: c.home });
  }
  // Coming together.
  const units = s.bodies.filter(b => b.alive && b.of < 0 && (b.parts.length > 0 || b.members.length > 0));
  const done = new Set<number>();
  const unitsAt: Body[][] = s.cells.map(() => []);
  for (const u of units) unitsAt[u.home]!.push(u);
  const friends = (a: Body, b: Body): boolean => dist(s.side, a.home, b.home) <= P.dealReach && regard(s, a, b) >= P.band && regard(s, b, a) >= P.band;
  for (const u of units) {
    if (done.has(u.id)) continue;
    const group = [u];
    for (const v of around(unitsAt, s.side, u.home, P.dealReach)) if (v !== u && !done.has(v.id) && group.length < 8 && group.every(g => friends(g, v))) group.push(v);
    if (group.length < P.bandOf) continue;
    const c = body(s, u.home);
    c.parts = group.map(g => g.id);
    for (const g of group) { g.of = c.id; done.add(g.id); }
    rec(s, 'gather', { a: c.id, cell: u.home, q: leaves(s, c).length, q2: depth(s, c) });
  }
}

export function gather(kin: Map<number, Set<number>>, s: State): void {
  for (const b of s.bodies) if (b.alive) b.members = b.members.filter(i => s.people[i]!.alive);

  // The wedded come to live at one hearth: the one from the poorer house crosses.
  for (const p of s.people) {
    if (!p.alive || p.spouse < 0 || p.id > p.spouse) continue;
    const q = s.people[p.spouse]!;
    if (!q.alive || q.body === p.body) continue;
    const bp = s.bodies[p.body]!, bq = s.bodies[q.body]!;
    const wp = welfare(bp.store, askAhead(s, bp)), wq = welfare(bq.store, askAhead(s, bq));
    const [mover, to] = wp < wq || (wp === wq && bp.id > bq.id) ? [p, bq] : [q, bp];
    const from = s.bodies[mover.body]!;
    rec(s, 'leave', { a: mover.id, b: mover.body });
    shift(s, mover, to);
    // The last to leave a hearth carries with them what it held.
    if (!from.members.length) { handOver(s, from, to, 1); from.alive = false; }
    rec(s, 'join', { a: mover.id, b: to.id });
  }

  // A hearth grown too full divides: a wedded pair that does not lead it leaves with its children and its share.
  for (const b of s.bodies.slice()) {
    if (!b.alive || b.members.length <= P.hearth) continue;
    const h = head(s, b);
    const pair = living(s, b).find(p => p.sex === 0 && p.spouse >= 0 && s.people[p.spouse]!.body === b.id && p.id !== h?.id && p.spouse !== h?.id);
    if (!pair) continue;
    const wife = s.people[pair.spouse]!;
    const going = living(s, b).filter(p => p === pair || p === wife || (p.spouse < 0 && (p.mother === wife.id || p.father === pair.id) && (s.t - p.born) / 52 < P.wedShe));
    if (going.length >= b.members.length) continue;
    const before = heads(s, b);
    const nb = body(s, b.home);
    for (const p of going) shift(s, p, nb);
    const share = before > 0 ? heads(s, nb) / before : 0;
    handOver(s, b, nb, share);
    nb.why = b.why.slice();
    nb.ways = structuredClone(b.ways);
    nb.lore = { ...b.lore };
    nb.since = b.since;
    rec(s, 'leave', { a: pair.id, b: b.id, kind2: nb.id, q: going.length, cell: b.home });
  }

  // A hearth with no one grown sends its children to kin; one with no one at all passes to kin, or is left.
  const nearestKin = (b: Body): Body | undefined => {
    let best: Body | undefined, bestD = Infinity;
    for (const k of kin.get(b.id) ?? []) {
      const kb = s.bodies[k];
      if (!kb || !kb.alive || kb.id === b.id || !kb.members.length) continue;
      const d = dist(s.side, kb.home, b.home);
      if (d < bestD || (d === bestD && kb.id < best!.id)) { best = kb; bestD = d; }
    }
    return best;
  };
  for (const b of s.bodies) {
    if (!b.alive || b.parts.length) continue;
    if (b.members.length && living(s, b).some(p => (s.t - p.born) / 52 >= 14)) continue;
    const heir = nearestKin(b);
    if (b.members.length && !heir) continue;
    if (heir) {
      for (const p of living(s, b)) { shift(s, p, heir); rec(s, 'join', { a: p.id, b: heir.id }); }
      handOver(s, b, heir, 1);
      rec(s, 'inherit', { a: heir.id, b: b.id, cell: b.home });
    } else {
      let left = 0;
      for (let k = 0; k < NK; k++) left += b.store[k]!;
      rec(s, 'leave', { b: b.id, cell: b.home, q2: left });
    }
    b.alive = false;
    b.plan = [];
  }

  if (s.t % 13 === 0) band(s);

  // Bonds end with the people and bodies they bound, or when too weak to matter.
  s.bonds = s.bonds.filter(bd => {
    if (bd.about === 'person') return s.people[bd.b]!.alive && (bd.basis === 'birth' || s.people[bd.a]!.alive);
    if (bd.about === 'land') return s.bodies[bd.a]!.alive && bd.strength >= 0.05;
    if (bd.about === 'yield') return s.bodies[bd.a]!.alive && s.bodies[bd.b]!.alive && bd.share > 0.001;
    if (bd.about === 'bond') return s.bodies[bd.a]!.alive && (bd.secures >= 0 || (bd.secures === -1 && bd.due > s.t));
    return bd.q > 0.05 && bd.strength >= 0.3 && s.bodies[bd.a]!.alive && s.bodies[bd.b]!.alive;
  });
  // A bond about a bond ends with the bond it is about, or with the debt it secured.
  for (let pass = 0; pass < 3; pass++) {
    const ids = new Set(s.bonds.map(b => b.id));
    s.bonds = s.bonds.filter(bd => bd.about !== 'bond' || (ids.has(bd.on) && (bd.secures < 0 || ids.has(bd.secures))));
  }
}
