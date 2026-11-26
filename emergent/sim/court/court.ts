// The court. A matter reaches the regent only when nothing below can settle it: when no rule covers
// it, when two bodies' rules disagree, or when a rule is itself challenged. A ruling cuts the matter at
// one of three widths: this case, a rule for one body, a rule for the realm. Once there is a rule, the
// next like case is settled below and the regent never sees it. Nothing here names a kind of case: a
// matter is a bond that cannot be met, or a want with something behind it, and its shape is read off it.

import { Kn, NEEDS, NK, NN, P, TOIL } from '../tables.ts';
import { askAhead, cover } from '../value.ts';
import { around, bond, hearthIndex, leaves, rec, top } from '../util.ts';
import type { Body, Bond, Court, Petition, Rule, State } from '../types.ts';

export type Width = 'case' | 'body' | 'realm';
export interface Ruling { petition: number; cut: string; width: Width }

export const openCourt = (s: State): Court => (s.court = { standing: 5, docket: [], rules: [], grief: {}, seen: {}, next: 0, quiet: 0 });

const grieve = (c: Court, id: number, by: number): void => { c.grief[id] = (c.grief[id] ?? 0) + by; };
const firstNeed = (kind: number): number => (kind < 0 ? -1 : Kn[kind]!.serves.findIndex(x => x > 0));

/** The shape of a matter, without its parties. */
function shapeOf(bd: Bond | undefined, need: number, causeKind: string): string {
  if (bd) return `owed:${bd.labour ? 'work' : 'goods'}:${bd.basis}:${bd.way || '-'}:${firstNeed(bd.kind) >= 0 ? NEEDS[firstNeed(bd.kind)]!.id : '-'}`;
  return `want:${NEEDS[need]!.id}:${causeKind}`;
}

/** The cuts the court could make in a matter. They follow from what the matter is. */
export function cuts(s: State, p: Petition): string[] {
  if (p.reason === 'challenge') return ['uphold', 'strike'];
  const bd = s.bonds.find(b => b.id === p.bond);
  if (bd) return bd.basis === 'wrong' && bd.doer >= 0 && bd.doer !== bd.a ? ['hold', 'part', 'release', 'inquire'] : ['hold', 'part', 'release'];
  return ['levy', 'dismiss'];
}

/** Carry out a cut. Returns false if there was nothing left to cut. */
function carry(s: State, c: Court, p: Petition, cut: string): boolean {
  const by = s.bodies[p.by]!;
  if (p.reason === 'challenge') {
    const i = c.rules.findIndex(r => r.id === p.bond);
    if (i < 0) return false;
    if (cut === 'strike') { rec(s, 'rule', { a: p.by, kind2: -1, q2: c.rules[i]!.scope, way: c.rules[i]!.shape }); c.rules.splice(i, 1); c.grief[p.by] = 0; } else grieve(c, p.by, P.harmReversed);
    return true;
  }
  if (p.bond >= 0) {
    const bd = s.bonds.find(b => b.id === p.bond);
    if (!bd || bd.q <= 0.05) return false;
    const D = s.bodies[bd.a]!, C = s.bodies[bd.b]!;
    if (!D.alive || !C.alive) return false;
    if (cut === 'inquire') {
      // An inquest shows what the ledger knows: who truly did it.
      if (bd.doer >= 0 && bd.doer !== bd.a && s.bodies[bd.doer]!.alive) { grieve(c, bd.a, -P.harmPaid); bd.a = bd.doer; p.against = bd.doer; }
      rec(s, 'judge', { a: p.by, b: bd.a, kind: bd.kind, q2: 3, cause: bd.rec });
      return true;
    }
    const share = cut === 'hold' ? 1 : cut === 'part' ? 0.5 : 0;
    const owed = bd.q * share;
    if (owed > 0 && !bd.labour) {
      // What is held to is paid now as far as it can be, and the rest is worked off.
      const pay = Math.min(owed, D.store[bd.kind]!);
      D.store[bd.kind] = D.store[bd.kind]! - pay; C.store[bd.kind] = C.store[bd.kind]! + pay;
      const left = owed - pay;
      if (left > 0.05) bond(s, { about: 'act', a: D.id, b: C.id, kind: bd.kind, q: left * TOIL[bd.kind]!, due: s.t, labour: true, basis: 'grant', rec: bd.rec, way: bd.way });
      const c2 = cover(D.store, askAhead(s, D));
      grieve(c, D.id, P.harmPaid + (c2.some((x, n) => NEEDS[n]!.harm >= 0.5 && x < P.dire) ? P.harmLost : 0));
    }
    if (share < 1) grieve(c, C.id, P.harmLost * (1 - share));
    rec(s, 'judge', { a: C.id, b: D.id, kind: bd.kind, q: owed, q2: share, cause: bd.rec });
    bd.q = 0;
    return true;
  }
  // A want with nobody to answer for it: the court can lay it on those nearby who have most, against repayment.
  if (cut === 'levy') {
    const idx = hearthIndex(s);
    let best: Body | undefined, bestK = -1, most = 0;
    for (const x of around(idx, s.side, by.home, P.dealReach)) {
      if (x === by) continue;
      for (let k = 0; k < NK; k++) if (!Kn[k]!.fixed && Kn[k]!.serves[p.need]! > 0 && x.store[k]! > most) { most = x.store[k]!; best = x; bestK = k; }
    }
    if (!best || most < 1) return false;
    const want = (3 * askAhead(s, by)[p.need]! * Kn[bestK]!.use) / Kn[bestK]!.serves[p.need]!, q = Math.min(most * P.part, want);
    best.store[bestK] = best.store[bestK]! - q; by.store[bestK] = by.store[bestK]! + q;
    const e = rec(s, 'judge', { a: p.by, b: best.id, kind: bestK, q, q2: 2, need: p.need, cause: p.rec });
    bond(s, { about: 'act', a: by.id, b: best.id, kind: bestK, q, due: s.t + P.term, basis: 'grant', rec: e.id });
    grieve(c, best.id, P.harmPaid);
    return true;
  }
  grieve(c, p.by, P.harmUnheard * 2);
  rec(s, 'judge', { a: p.by, q2: 0, need: p.need, cause: p.rec });
  return true;
}

const scopeOf = (s: State, id: number): number => { const t = top(s, s.bodies[id]!); return t.id === id ? -2 : t.id; };

/** The rule that settles a matter below, if there is exactly one answer to it. */
function ruleFor(s: State, c: Court, p: Petition): Rule | 'clash' | null {
  const a = scopeOf(s, p.by), b = p.against >= 0 ? scopeOf(s, p.against) : a;
  const find = (scope: number): Rule | undefined => c.rules.find(r => r.shape === p.shape && r.scope === scope);
  // Two of one body are settled by that body's rule. Two of different bodies whose rules differ cannot be.
  if (a >= 0 && a === b) { const r = find(a); if (r) return r; }
  else if (a >= 0 && b >= 0) { const m = find(a), t = find(b); if (m && t && m.cut !== t.cut) return 'clash'; }
  return find(-1) ?? null;
}

/**
 * The audience. Gathers the week's matters, settles below whatever a rule covers, and seats the most
 * urgent of the rest. Returns those seated.
 */
export function audience(s: State): Petition[] {
  const c = s.court;
  if (!c) return [];
  const live = new Map<number, Bond>();
  for (const b of s.bonds) live.set(b.id, b);
  const fresh: Petition[] = [];
  const add = (key: string, f: Omit<Petition, 'id' | 't' | 'waited' | 'urgency' | 'speaksFor' | 'reason'>): void => {
    if (s.t - (c.seen[key] ?? -999) < 26) return;
    c.seen[key] = s.t;
    fresh.push({ ...f, id: c.next++, t: s.t, waited: 0, urgency: 0, speaksFor: leaves(s, top(s, s.bodies[f.by]!)).length, reason: 'none' });
  };
  // A bond that cannot be met: something owed and broken, or owed for a taking.
  for (const bd of s.bonds) {
    if (bd.about !== 'act' || bd.labour || bd.q <= 0.05 || !(bd.broken || bd.basis === 'wrong')) continue;
    if (!s.bodies[bd.a]!.alive || !s.bodies[bd.b]!.alive) continue;
    add(`b${bd.id}`, { by: bd.b, against: bd.a, bond: bd.id, need: firstNeed(bd.kind), rec: bd.rec, shape: shapeOf(bd, -1, '') });
  }
  // A want that is dire, with whatever lies behind it.
  for (const b of s.bodies) {
    if (!b.alive || b.parts.length || !b.members.length) continue;
    const cov = cover(b.store, askAhead(s, b));
    for (let n = 0; n < NN; n++) {
      if (NEEDS[n]!.harm < 0.25 || cov[n]! >= P.dire) continue;
      add(`w${b.id}:${n}`, { by: b.id, against: -1, bond: -1, need: n, rec: b.why[n]!, shape: shapeOf(undefined, n, b.why[n]! >= 0 ? 'caused' : 'bare') });
      break;
    }
  }
  // Settle below what a rule covers; what two bodies' rules answer differently goes up.
  for (const p of fresh) {
    const r = ruleFor(s, c, p);
    if (r === 'clash') { p.reason = 'clash'; c.docket.push(p); continue; }
    if (!r) { c.docket.push(p); continue; }
    const before = c.grief[p.by] ?? 0, beforeD = p.against >= 0 ? c.grief[p.against] ?? 0 : 0;
    if (carry(s, c, p, r.cut)) { r.uses++; rec(s, 'rule', { a: p.by, b: p.against, kind2: 1, q2: r.scope, way: p.shape }); }
    // One who has been hurt enough by a rule challenges it.
    for (const [who, was] of [[p.by, before], [p.against, beforeD]] as const) {
      if (who < 0 || (c.grief[who] ?? 0) - was < P.harmPaid || (c.grief[who] ?? 0) < P.aggrieved) continue;
      const key = `c${r.id}`;
      if (s.t - (c.seen[key] ?? -999) < 52) continue;
      c.seen[key] = s.t;
      c.docket.push({ id: c.next++, t: s.t, by: who, against: -1, bond: r.id, need: -1, rec: -1, shape: `rule:${r.shape}`, reason: 'challenge', speaksFor: leaves(s, top(s, s.bodies[who]!)).length, waited: 0, urgency: 0 });
    }
  }
  // Those who waited too long, or whose matter is gone, leave; the rest are ranked.
  c.docket = c.docket.filter(p => {
    if (!s.bodies[p.by]!.alive) return false;
    if (p.reason !== 'challenge' && p.bond >= 0 && !((live.get(p.bond)?.q ?? 0) > 0.05)) return false;
    if (p.waited > P.wait) { grieve(c, p.by, P.harmUnheard * 2); return false; }
    return true;
  });
  for (const p of c.docket) {
    const b = s.bodies[p.by]!, cov = cover(b.store, askAhead(s, b));
    let press = 0;
    for (let n = 0; n < NN; n++) press = Math.max(press, NEEDS[n]!.harm * Math.max(0, 1 - cov[n]! / P.short));
    p.urgency = press * 3 + Math.log2(1 + p.speaksFor) + p.waited / 4 + (p.reason !== 'none' ? 1 : 0);
  }
  c.docket.sort((x, y) => y.urgency - x.urgency || x.id - y.id);
  return c.docket.slice(0, P.seats);
}

/** The hearings: up to three rulings, or a fourth at a cost in standing. Then the week's reckoning. */
export function hear(s: State, rulings: Ruling[]): void {
  const c = s.court;
  if (!c) return;
  const heard = rulings.slice(0, P.hearings + 1);
  if (heard.length > P.hearings) c.standing -= 0.5;
  for (const r of heard) {
    const p = c.docket.find(x => x.id === r.petition);
    if (!p || !cuts(s, p).includes(r.cut)) continue;
    const done = carry(s, c, p, r.cut);
    if (r.cut === 'inquire' && done) continue;
    c.docket = c.docket.filter(x => x !== p);
    if (!done || r.width === 'case' || p.reason === 'challenge') continue;
    // A rule: for the body the petitioner belongs to, or for everyone. It replaces any rule it contradicts there.
    const scope = r.width === 'realm' ? -1 : scopeOf(s, p.by);
    if (scope === -2) continue;
    const old = c.rules.findIndex(x => x.shape === p.shape && x.scope === scope);
    if (old >= 0) c.rules.splice(old, 1);
    c.rules.push({ id: c.next++, scope, shape: p.shape, cut: r.cut, since: s.t, uses: 0 });
    rec(s, 'rule', { a: p.by, kind2: 0, q2: scope, way: p.shape });
    // Everyone whose open matter of this shape is now answered against them had built on the old understanding.
    if (scope === -1) for (const q of c.docket) if (q.shape === p.shape && q !== p) grieve(c, r.cut === 'release' ? q.by : q.against >= 0 ? q.against : q.by, P.harmReversed);
  }
  // Those still waiting in want hold it against the court.
  for (const p of c.docket) { p.waited++; if (p.urgency > 3) grieve(c, p.by, P.harmUnheard); }
  // Enough houses with enough grievance withdraw their confidence.
  let hearths = 0, sore = 0;
  for (const b of s.bodies) if (b.alive && !b.parts.length && b.members.length) { hearths++; if ((c.grief[b.id] ?? 0) >= P.aggrieved) sore++; }
  for (const k in c.grief) { const v = c.grief[k]! * P.griefFade; if (v < 0.5 || !s.bodies[Number(k)]!.alive) delete c.grief[k]; else c.grief[k] = v; }
  if (hearths > 0 && sore >= P.faction * hearths) {
    c.standing -= 1; c.quiet = 0;
    for (const k in c.grief) c.grief[k] = c.grief[k]! * 0.5;
    rec(s, 'withdraw', { q: sore, q2: hearths });
  } else if (++c.quiet % 13 === 0 && c.standing < 5) c.standing = Math.min(5, c.standing + 0.25);
}
