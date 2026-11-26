// Bind. People make bonds, keep or break them, and contest them when they cannot all be met.
// Use makes a holding; a taking makes a debt; a debt falls due; two people wed.

import { Kn, NEEDS, NK, NN, P, TOIL } from '../tables.ts';
import { askAhead, cover } from '../value.ts';
import { around, bond, setTie, dist, head, holdsByCell, kinOf, might, muster, rec, served as remember, struggle, tie, warm } from '../util.ts';
import type { Body, Bond, Person, State } from '../types.ts';

/** The needs a kind serves, for saying why someone's cover fell. */
const served = (kind: number): number[] => NEEDS.map((_, n) => n).filter(n => Kn[kind]!.serves[n]! > 0);

/** Whether a body can part with q of a kind and still hold a few weeks of everything it serves. */
function canSpare(s: State, b: Body, kind: number, q: number): boolean {
  if (b.store[kind]! < q) return false;
  const after = b.store.slice();
  after[kind] = after[kind]! - q;
  const c = cover(after, askAhead(s, b));
  for (let n = 0; n < NN; n++) if (Kn[kind]!.serves[n]! > 0 && c[n]! < P.short) return false;
  return true;
}

export function bind(s: State): void {
  const kin = kinOf(s);

  // Use makes and strengthens a holding, unless others already hold the ground.
  const holds = holdsByCell(s);
  for (const u of s.uses) {
    const over = holds.get(u.cell) ?? [];
    let h = over.find(x => x.a === u.body);
    if (!h) {
      let sum = 0;
      for (const x of over) sum += x.strength;
      if (sum >= P.held) continue;
      h = bond(s, { about: 'land', a: u.body, cell: u.cell, basis: 'use', strength: 0 });
      if (over.length) over.push(h); else holds.set(u.cell, [h]);
    }
    const was = h.strength;
    h.strength = Math.min(4, h.strength + P.claim * u.days);
    h.used = s.t;
    if (was < P.held && h.strength >= P.held) h.rec = rec(s, 'bind', { a: u.body, cell: u.cell }).id;
  }
  s.uses = [];

  // A taking leaves the taker owing what was taken.
  for (const w of s.wrongs) {
    if (w.q <= 0 || w.by === w.to) continue;
    const old = s.bonds.find(b => b.about === 'act' && b.basis === 'wrong' && b.a === w.by && b.b === w.to && b.kind === w.kind);
    if (old) { old.q += w.q; old.strength = 1; } else bond(s, { about: 'act', a: w.by, b: w.to, kind: w.kind, q: w.q, due: s.t, basis: 'wrong', rec: w.rec, doer: w.doer });
    warm(s, w.to, w.by, -0.4);
    for (const k of kin.get(w.to) ?? []) warm(s, k, w.by, -0.15);
    for (const n of served(w.kind)) s.bodies[w.to]!.why[n] = w.rec;
  }
  s.wrongs = [];

  // What is owed and due is paid, or broken, or fought over.
  const pay = (bd: Bond, D: Body, C: Body): void => {
    D.store[bd.kind] = D.store[bd.kind]! - bd.q;
    C.store[bd.kind] = C.store[bd.kind]! + bd.q;
    rec(s, 'keep', { a: D.id, b: C.id, kind: bd.kind, q: bd.q, cause: bd.rec });
    remember(s, bd, true);
    warm(s, C.id, D.id, 0.3); warm(s, D.id, C.id, 0.1);
    bd.q = 0;
  };
  for (const bd of s.bonds) {
    if (bd.about !== 'act' || bd.due > s.t || bd.q <= 0) continue;
    const D = s.bodies[bd.a]!, C = s.bodies[bd.b]!;
    if (!D.alive || !C.alive) { bd.q = 0; continue; }
    if (bd.labour) {
      // Work owed is done a part of each week, for as long as the two live within reach.
      if (dist(s.side, D.home, C.home) > P.dealReach) { rec(s, 'break', { a: D.id, b: C.id, q: bd.q, q2: 1, cause: bd.rec }); warm(s, C.id, D.id, -0.3); bd.q = 0; continue; }
      // Work owed is called for when the one owed has need of hands, or when it has been owed a year.
      if (!C.pressed && s.t - bd.since < 52) continue;
      const d = Math.min(bd.q, 0.5 * muster(s, D));
      D.spent += d; C.spent -= d; bd.q -= d;
      if (bd.q <= 0.05) { remember(s, bd, true); rec(s, 'keep', { a: D.id, b: C.id, q2: 1, cause: bd.rec }); warm(s, C.id, D.id, 0.2); bd.q = 0; }
      continue;
    }
    const hD = head(s, D), hC = head(s, C);
    if (!hD || !hC) continue;
    const have = D.store[bd.kind]!;
    if (canSpare(s, D, bd.kind, bd.q) || (!bd.broken && bd.basis === 'word' && have >= bd.q && hD.scruple > 0.8)) { pay(bd, D, C); continue; }
    // What cannot be paid in kind may be made good in something else of the same toil, if the other can spare it.
    let made = false;
    for (let j = 0; j < NK && !made; j++) {
      if (j === bd.kind || Kn[j]!.fixed) continue;
      const qj = (bd.q * TOIL[bd.kind]!) / TOIL[j]!;
      if (!Kn[j]!.serves.some(x => x > 0) || !canSpare(s, D, j, qj)) continue;
      D.store[j] = D.store[j]! - qj; C.store[j] = C.store[j]! + qj;
      rec(s, 'keep', { a: D.id, b: C.id, kind: j, q: qj, kind2: bd.kind, cause: bd.rec });
      warm(s, C.id, D.id, 0.15);
      bd.q = 0; made = true;
    }
    if (made) continue;
    // Or worked off, if the one who owes is of a mind to, or is the weaker.
    if (bd.broken && (hD.scruple > 0.4 || might(s, kin, C, D.id) > might(s, kin, D, C.id)) && dist(s.side, D.home, C.home) <= P.dealReach) {
      bd.q = bd.q * TOIL[bd.kind]!; bd.labour = true; bd.broken = false; bd.strength = 1;
      bd.rec = rec(s, 'promise', { a: D.id, b: C.id, kind: bd.kind, q2: bd.q, kind2: 1, cause: bd.rec }).id;
      continue;
    }
    if (!bd.broken) {
      // A debt secured on a holding: the holding passes, and there is nothing left to fight over.
      const pledge = s.bonds.find(x => x.about === 'bond' && x.secures === bd.id);
      const held = pledge && s.bonds.find(x => x.id === pledge.on && x.about === 'land');
      if (pledge && held) {
        held.a = C.id; held.basis = 'word';
        rec(s, 'take', { a: C.id, b: D.id, cell: held.cell, kind2: -2, cause: bd.rec });
        warm(s, D.id, C.id, -0.2);
        remember(s, bd, false);
        bd.q = 0; pledge.secures = -2;
        continue;
      }
      bd.broken = true;
      remember(s, bd, false);
      bd.due = s.t + 2;
      if (bd.basis !== 'wrong') {
        bd.rec = rec(s, 'break', { a: D.id, b: C.id, kind: bd.kind, q: bd.q, cause: bd.rec }).id;
        warm(s, C.id, D.id, -0.4);
        for (const n of served(bd.kind)) C.why[n] = bd.rec;
      }
      continue;
    }
    // The one owed weighs what is at stake against their own temper, and their strength against the other's.
    const aheadC = askAhead(s, C);
    let stake = 0.5;
    for (const n of served(bd.kind)) if (aheadC[n]! > 0) stake = Math.max(stake, Math.min(1.5, (bd.q * Kn[bd.kind]!.serves[n]!) / Kn[bd.kind]!.use / aheadC[n]! / 4));
    if (stake < hC.temper * 0.6) { bd.due = s.t + 13; continue; }
    const mC = might(s, kin, C, D.id), mD = might(s, kin, D, C.id);
    if (mC < 0.6 * mD) {
      if (tie(s, C.id, D.id) > -0.8) { setTie(s, C.id, D.id, -0.8); rec(s, 'bar', { a: C.id, b: D.id, cause: bd.rec }); }
      bd.due = s.t + 26;
      continue;
    }
    const want = Math.min(bd.q, have);
    // Nothing there to take: no one fights over an empty store.
    if (want < 0.05) { bd.due = s.t + 13; continue; }
    const covD = cover(D.store, askAhead(s, D));
    const pressed = served(bd.kind).some(n => covD[n]! < P.short);
    const resists = pressed && mD >= 0.6 * mC;
    let got = want;
    if (resists) {
      const e = rec(s, 'take', { a: C.id, b: D.id, kind: bd.kind, q: 0, q2: 1, cause: bd.rec });
      got = want * struggle(s, kin, C, D, e.id);
      e.q = got;
      for (const n of served(bd.kind)) D.why[n] = e.id;
    } else if (got > 0.01) {
      rec(s, 'take', { a: C.id, b: D.id, kind: bd.kind, q: got, cause: bd.rec });
      warm(s, D.id, C.id, -0.2);
    }
    D.store[bd.kind] = have - got;
    C.store[bd.kind] = C.store[bd.kind]! + got;
    bd.q -= got;
    bd.due = s.t + 13;
  }

  // Two unwed people within reach of one another, and not of one blood, wed.
  const taken = new Set<number>();
  const women: Person[][] = s.cells.map(() => []);
  for (const w of s.people) if (w.alive && w.sex === 1 && w.spouse < 0) women[s.bodies[w.body]!.home]!.push(w);
  for (const m of s.people) {
    if (!m.alive || m.sex !== 0 || m.spouse >= 0 || (s.t - m.born) / 52 < P.wedHe) continue;
    const mb = s.bodies[m.body]!;
    let best = -1, bestScore = Infinity;
    for (const w of around(women, s.side, mb.home, P.dealReach)) {
      if (!w.alive || w.sex !== 1 || w.spouse >= 0 || taken.has(w.id)) continue;
      const age = (s.t - w.born) / 52;
      if (age < P.wedShe || age > P.bearTo + 8) continue;
      if (w.id === m.mother || w.father === m.id) continue;
      if ((m.mother >= 0 && m.mother === w.mother) || (m.father >= 0 && m.father === w.father)) continue;
      const wb = s.bodies[w.body]!, d = dist(s.side, mb.home, wb.home), gap = Math.abs((w.born - m.born) / 52);
      if (d > P.dealReach || gap > 15 || tie(s, mb.id, wb.id) < P.barAt || tie(s, wb.id, mb.id) < P.barAt) continue;
      const score = d * 10 + gap;
      if (score < bestScore) { bestScore = score; best = w.id; }
    }
    if (best < 0) continue;
    const w = s.people[best]!;
    taken.add(best);
    m.spouse = w.id; w.spouse = m.id;
    bond(s, { about: 'person', a: m.id, b: w.id, basis: 'word' });
    rec(s, 'wed', { a: m.id, b: w.id, cell: mb.home });
  }
}
