// The court. A matter is a bond that stands between someone and what they need: one they are owed on
// and cannot get, one they owe on and cannot bear, or one another holds over something they lack. It
// reaches the regent only when no rule covers its shape, when two bodies' rules answer it differently,
// or when a rule is itself challenged. The court can do five things to any bond: enforce it, part it,
// strike it, stay it, or turn it over to the one who asks. A ruling is made for this case, for one body,
// or for the realm; once there is a rule, like cases are settled below and the regent never sees them.
// Nothing here names a kind of case. A matter's shape is read off the bond, the need and the parties.

import { Kn, NEEDS, NK, NN, P, TOIL } from '../tables.ts';
import { askAhead, cover } from '../value.ts';
import { around, bond, dist, grown, head, hearthIndex, kinOf, leaves, might, rec, top } from '../util.ts';
import type { Body, Bond, Court, Petition, Rule, State } from '../types.ts';

export type Width = 'case' | 'body' | 'realm';
export interface Ruling { petition: number; cut: string; width: Width }

export function openCourt(s: State): Court {
  // The Crown's store: for each pressing need, what would see the whole realm through a week or so, in the thing that keeps best.
  const store = new Array<number>(NK).fill(0);
  let heads = 0;
  for (const p of s.people) if (p.alive) heads++;
  for (let n = 0; n < NN; n++) {
    if (NEEDS[n]!.harm < 0.25) continue;
    let k = -1;
    for (let j = 0; j < NK; j++) if (!Kn[j]!.fixed && Kn[j]!.serves[n]! > 0 && (k < 0 || Kn[j]!.keep < Kn[k]!.keep)) k = j;
    if (k >= 0) store[k] = Math.max(store[k]!, (heads * P.crownWeeks * (NEEDS[n]!.per + NEEDS[n]!.cold * 5) * Kn[k]!.use) / Kn[k]!.serves[n]!);
  }
  return (s.court = { standing: 5, docket: [], rules: [], grief: {}, seen: {}, next: 0, quiet: 0, declined: 0, chilled: 0, store, words: [], wordsKept: 0, wordsBroken: 0, store0: store.reduce((x, y) => x + y, 0) });
}

/** Give a house three weeks of what it needs out of the Crown's store. False if the store has not got it. */
function relieve(s: State, c: Court, to: Body, need: number): number {
  let k = -1;
  for (let j = 0; j < NK; j++) if (Kn[j]!.serves[need]! > 0 && c.store[j]! > (k < 0 ? 0.05 : c.store[k]!)) k = j;
  if (k < 0) return 0;
  const q = Math.min(c.store[k]!, (3 * askAhead(s, to)[need]! * Kn[k]!.use) / Kn[k]!.serves[need]!);
  if (q < 0.05) return 0;
  c.store[k] = c.store[k]! - q; to.store[k] = to.store[k]! + q;
  return q;
}

const grieve = (c: Court, id: number, by: number): void => { if (id >= 0) c.grief[id] = Math.max(0, (c.grief[id] ?? 0) + by); };
const scopeOf = (s: State, id: number): number => { const t = top(s, s.bodies[id]!); return t.id === id ? -2 : t.id; };

/** The form of a bond, without its parties: what it is about, all the way down, and on what basis. */
export function formOf(byId: Map<number, Bond>, b: Bond | undefined, depth = 0): string {
  if (!b || depth > 12) return 'gone';
  if (b.about === 'bond') return `${b.secures >= 0 ? 'pledge' : b.share > 0 ? 'lease for a share' : 'lease'} of ${formOf(byId, byId.get(b.on), depth + 1)}`;
  if (b.about === 'land') return `holding by ${b.basis}`;
  if (b.about === 'yield') return `share of all it gathers owed by ${b.basis}${b.way ? ' (' + b.way + ')' : ''}`;
  if (b.about === 'act') return `${b.labour ? 'work' : 'goods'} owed by ${b.basis}${b.way ? ' (' + b.way + ')' : ''}`;
  return `tie of ${b.basis}`;
}

export const SIDES = ['owed', 'owes', 'outside', 'bare'] as const;
/** How far a cut finds for the one who asked, by how they stood. */
const FAVOUR: Record<string, Record<string, number>> = {
  owed: { enforce: 1, redeem: 1, part: 0.5, stay: 0.2, strike: 0 },
  owes: { strike: 1, redeem: 1, give: 1, stay: 0.7, ease: 0.7, part: 0.5, enforce: 0, dismiss: 0 },
  outside: { turn: 1, part: 0.6, strike: 0.4, enforce: 0 },
  bare: { give: 1, vouch: 1, levy: 1, promise: 0.8, dismiss: 0 },
};

/** A house that has been before the court, and those who live near enough to see, change what they expect of it. */
function teach(s: State, idx: Body[][], by: number, side: string, found: number, own: number): void {
  const k = SIDES.indexOf(side as (typeof SIDES)[number]), home = s.bodies[by]!.home;
  if (k < 0) return;
  for (const b of around(idx, s.side, home, P.reach)) {
    const w = b.id === by ? own : P.pleaSeen;
    for (const p of grown(s, b)) p.plea[k] = p.plea[k]! + w * (found - p.plea[k]!);
  }
}

/**
 * How far a bond of some form, were it made today between two bodies, could be counted on by the one it
 * would favour. People know the rules they live under: where a rule says such bonds are struck or stayed,
 * the one who would be owed counts on less. Where there is no rule, they go by what they expect of the court.
 */
export function upheld(s: State, side: string, way: string, bearer: number, gainer: number): number {
  const c = s.court;
  if (!c) return 1;
  const part = side === 'L' || side === 'LS' ? `goods owed by word (${way})` : side === 'D' || side === 'DS' ? `work owed by word (${way})` : side === 'Y' ? 'lease for a share of' : side === 'U' ? 'lease of' : 'pledge of';
  const A = s.bodies[bearer]!, B = s.bodies[gainer]!, same = A.of >= 0 && top(s, A).id === top(s, B).id ? top(s, A).id : -9;
  let sum = 0, n = 0;
  for (const r of c.rules) {
    if ((r.scope !== -1 && r.scope !== same) || !r.shape.includes(part)) continue;
    if (r.shape.startsWith('owed on')) { sum += FAVOUR.owed![r.cut] ?? 0.5; n++; }
    else if (r.shape.startsWith('bound by')) { sum += 1 - (FAVOUR.owes![r.cut] ?? 0.5); n++; }
  }
  if (n) return 0.2 + sum / n;
  return Math.max(0.7, Math.min(1.2, 0.5 + (B.plea[0] ?? 0.5)));
}

/** One who found nobody to deal with because of what the law now says holds it against the court. */
export function chilled(s: State, id: number): void {
  if (!s.court) return;
  s.court.chilled++;
  grieve(s.court, id, P.harmChilled);
}

/** Who answers for a bond on the other side from a body. */
const other = (bd: Bond, by: number): number => (bd.a === by ? bd.b : bd.a);

/** The cuts the court could make in a matter. They follow from what stands in the way. */
export function cuts(s: State, p: Petition): string[] {
  if (p.reason === 'challenge') return ['uphold', 'strike'];
  // A house in want with things weighing on it: any one of them may be eased for a year, or relief given, or neither.
  if (p.burdens.length) return [...p.burdens.filter(id => s.bonds.some(b => b.id === id)).map(id => `ease:${id}`), 'give', 'dismiss'];
  const bd = s.bonds.find(b => b.id === p.bond);
  // A want with nothing behind it: relief, or none. One shunned may also be vouched for.
  if (!bd) return p.shape.includes('shunned') ? ['vouch', 'give', 'dismiss'] : ['give', 'dismiss'];
  // Ground: it stays with its holder or goes to the one who asks.
  if (bd.about === 'land') return ['enforce', 'turn'];
  // Anything owed: held to, let go, or put off a year.
  const c = ['enforce', 'strike', 'stay'];
  // Whoever is said to have done a wrong may or may not have. An inquest can be held on any of them, once.
  if (bd.about === 'act' && bd.basis === 'wrong' && bd.doer >= 0) c.push('inquire');
  return c;
}

/** Carry out a cut on whatever the matter is about. Returns false if there was nothing left to cut. */
function carry(s: State, c: Court, p: Petition, cut: string): boolean {
  const by = s.bodies[p.by]!;
  if (p.reason === 'challenge') {
    const i = c.rules.findIndex(r => r.id === p.bond);
    if (i < 0) return false;
    if (cut === 'strike') { rec(s, 'rule', { a: p.by, kind2: -1, q2: c.rules[i]!.scope, way: c.rules[i]!.shape }); c.rules.splice(i, 1); c.grief[p.by] = 0; }
    else { grieve(c, p.by, P.harmReversed); c.seen[`c${p.bond}`] = s.t + 100000; }
    return true;
  }
  if (cut.startsWith('ease:')) {
    const eb = s.bonds.find(b => b.id === Number(cut.slice(5)));
    if (!eb) return false;
    if (eb.about === 'act') { eb.due = Math.max(eb.due, s.t) + 52; eb.broken = false; } else eb.easedTo = s.t + 52;
    grieve(c, other(eb, p.by), P.harmUnheard * 2);
    rec(s, 'judge', { a: p.by, b: other(eb, p.by), need: p.need, cause: eb.rec, way: `ease ${formOf(new Map(s.bonds.map(b => [b.id, b])), eb)}` });
    return true;
  }
  const bd = s.bonds.find(b => b.id === p.bond);
  if (!bd || cut === 'give' || cut === 'dismiss' || cut === 'vouch') {
    // A want with nothing standing in its way that the court can cut: it can be laid on those nearby who have most.
    // Out of the Crown's own store, now; or the regent's word that it will come.
    if (cut === 'give') { const q = relieve(s, c, by, p.need); if (q <= 0) return false; rec(s, 'judge', { a: p.by, q, need: p.need, cause: p.rec, way: `give ${p.shape}` }); return true; }
    if (cut === 'vouch') {
      // The regent vouches for a house its neighbours will not deal with. They defer, and hold it against him.
      for (const x of around(hearthIndex(s), s.side, by.home, P.dealReach)) {
        if (x === by || (x.lore.new ?? 0) <= P.heed) continue;
        x.lore.new = x.lore.new! * 0.3;
        for (const m of grown(s, x)) if (m.lore.new) m.lore.new *= 0.3;
        grieve(c, x.id, P.harmUnheard);
      }
      by.since = -1e6;
      rec(s, 'judge', { a: p.by, need: p.need, cause: p.rec, way: `vouch ${p.shape}` });
      return true;
    }
    if (cut === 'promise') { c.words.push({ to: p.by, need: p.need, due: s.t + P.wordWeeks }); rec(s, 'judge', { a: p.by, need: p.need, cause: p.rec, way: `promise ${p.shape}` }); return true; }
    if (cut !== 'levy') { grieve(c, p.by, P.harmUnheard * 2); rec(s, 'judge', { a: p.by, q2: 0, need: p.need, way: `dismiss ${p.shape}` }); return true; }
    let best: Body | undefined, bestK = -1, most = 0;
    for (const x of around(hearthIndex(s), s.side, by.home, P.dealReach)) {
      if (x === by) continue;
      for (let k = 0; k < NK; k++) if (!Kn[k]!.fixed && Kn[k]!.serves[p.need]! > 0 && x.store[k]! > most) { most = x.store[k]!; best = x; bestK = k; }
    }
    if (!best || most < 1) return false;
    const q = Math.min(most * P.part, (3 * askAhead(s, by)[p.need]! * Kn[bestK]!.use) / Kn[bestK]!.serves[p.need]!);
    best.store[bestK] = best.store[bestK]! - q; by.store[bestK] = by.store[bestK]! + q;
    const e = rec(s, 'judge', { a: p.by, b: best.id, kind: bestK, q, need: p.need, cause: p.rec, way: `levy ${p.shape}` });
    bond(s, { about: 'act', a: by.id, b: best.id, kind: bestK, q, due: s.t + P.term, basis: 'grant', rec: e.id });
    grieve(c, best.id, P.harmPaid);
    return true;
  }
  if (bd.about === 'act' && bd.q <= 0.05) return false;
  // Who gains by the bond and who bears it.
  const bears = bd.about === 'act' || bd.about === 'yield' ? bd.a : bd.about === 'land' ? (p.side === 'outside' ? p.by : other(bd, p.by)) : bd.secures >= 0 ? bd.b : bd.a;
  const gains = bd.about === 'act' || bd.about === 'yield' ? bd.b : bd.about === 'land' ? bd.a : bd.secures >= 0 ? bd.a : bd.b;
  const e = rec(s, 'judge', { a: p.by, b: p.against, kind: bd.kind, q: bd.q, cell: bd.cell, need: p.need, cause: bd.rec, way: `${cut} ${p.shape}` });
  if (cut === 'inquire') {
    // An inquest shows what the ledger knows: who truly did it.
    e.b = bd.doer; e.q2 = bd.doer !== bd.a ? 1 : 0;
    if (bd.doer !== bd.a && s.bodies[bd.doer]!.alive) {
      // The one wrongly held to it is cleared; the debt falls on the one who did it. If it was the accused who asked, their matter is done.
      grieve(c, bd.a, -P.harmLost);
      if (p.side === 'owes') { bd.a = bd.doer; bd.doer = -1; return false; }
      bd.a = bd.doer; p.against = bd.doer;
    }
    bd.doer = -1;
    return true;
  }
  if (cut === 'redeem') {
    // The Crown pays what is owed, as far as its store goes, and the rest is let go.
    const pay = Math.min(bd.q, c.store[bd.kind]!);
    if (pay < 0.5 * bd.q) return false;
    c.store[bd.kind] = c.store[bd.kind]! - pay; s.bodies[bd.b]!.store[bd.kind] = s.bodies[bd.b]!.store[bd.kind]! + pay;
    bd.q = 0;
    return true;
  }
  if (cut === 'stay') { if (bd.about === 'act') { bd.due = Math.max(bd.due, s.t) + 52; bd.broken = false; } else bd.easedTo = s.t + 52; grieve(c, gains, P.harmUnheard); return true; }
  const share = cut === 'enforce' ? 1 : cut === 'part' ? 0.5 : 0;
  if (bd.about === 'act') {
    const D = s.bodies[bd.a]!, C = s.bodies[bd.b]!;
    if (!D.alive || !C.alive) return false;
    const owed = bd.q * share;
    if (owed > 0 && !bd.labour) {
      // What is enforced is paid now as far as it can be, and the rest is worked off.
      const pay = Math.min(owed, D.store[bd.kind]!);
      // The court keeps a share of what it enforces.
      D.store[bd.kind] = D.store[bd.kind]! - pay; C.store[bd.kind] = C.store[bd.kind]! + pay * (1 - P.crownFee); c.store[bd.kind] = c.store[bd.kind]! + pay * P.crownFee;
      if (owed - pay > 0.05) bond(s, { about: 'act', a: D.id, b: C.id, kind: bd.kind, q: (owed - pay) * TOIL[bd.kind]!, due: s.t, labour: true, basis: 'grant', rec: e.id, way: bd.way });
      const after = cover(D.store, askAhead(s, D));
      grieve(c, D.id, P.harmPaid + (after.some((x, n) => NEEDS[n]!.harm >= 0.5 && x < P.dire) ? P.harmLost : 0));
      bd.q = 0;
    } else if (owed > 0) { bd.q = owed; grieve(c, D.id, P.harmPaid); } else bd.q = 0;
    if (share < 1) grieve(c, C.id, P.harmLost * (1 - share));
    return true;
  }
  if (bd.about === 'land') {
    // Ground: confirmed to its holder, shared with the one who asks, taken from the holder, or turned over.
    if (cut === 'enforce') { bd.strength = Math.max(bd.strength, 3); grieve(c, p.by, P.harmUnheard * 2); }
    else if (cut === 'part') { bd.strength /= 2; bond(s, { about: 'land', a: p.by, cell: bd.cell, basis: 'grant', strength: bd.strength, rec: e.id }); grieve(c, gains, P.harmLost / 2); }
    else if (cut === 'strike') { bd.strength = 0; grieve(c, gains, P.harmLost); }
    else { grieve(c, gains, P.harmLost); bd.a = p.by; bd.basis = 'grant'; }
    return true;
  }
  if (bd.about === 'yield') {
    // A standing share of what is gathered: confirmed, halved, ended, or lifted for a year.
    if (cut === 'enforce') grieve(c, bears, P.harmPaid);
    else if (cut === 'part') { bd.share /= 2; grieve(c, gains, P.harmPaid); }
    else { bd.share = 0; grieve(c, gains, P.harmLost); }
    return true;
  }
  // A bond about a bond: a surety or a letting.
  if (cut === 'enforce') {
    if (bd.secures >= 0) { const held = s.bonds.find(x => x.id === bd.on); const debt = s.bonds.find(x => x.id === bd.secures); if (held && debt) { held.a = bd.a; held.basis = 'grant'; debt.q = 0; bd.secures = -2; } }
    else bd.due = Math.max(bd.due, s.t + P.lease);
    grieve(c, bears, P.harmLost);
  } else if (cut === 'part') { if (bd.share > 0) bd.share /= 2; else bd.due = Math.min(bd.due, s.t + 26); grieve(c, gains, P.harmPaid); }
  else { if (bd.secures >= 0) bd.secures = -2; else bd.due = s.t; grieve(c, gains, P.harmLost); }
  return true;
}

/** The rule that settles a matter below, if there is one answer to it. */
function ruleFor(s: State, c: Court, p: Petition): Rule | 'clash' | null {
  const a = scopeOf(s, p.by), b = p.against >= 0 ? scopeOf(s, p.against) : a;
  const find = (scope: number): Rule | undefined => c.rules.find(r => r.shape === p.shape && r.scope === scope);
  // Two of one body are settled by that body's rule. Two of different bodies whose rules differ cannot be.
  if (a >= 0 && a === b) { const r = find(a); if (r) return r; }
  else if (a >= 0 && b >= 0) { const m = find(a), t = find(b); if (m && t && m.cut !== t.cut) return 'clash'; }
  return find(-1) ?? null;
}

/** Settle a matter by a rule. One hurt enough by it may challenge the rule, once. */
function below(s: State, c: Court, p: Petition, r: Rule): void {
  const before = [p.by, p.against].map(w => (w >= 0 ? c.grief[w] ?? 0 : 0));
  carry(s, c, p, r.cut);
  teach(s, hearthIndex(s), p.by, p.side, FAVOUR[p.side]?.[r.cut] ?? 0.5, P.pleaOwn);
  r.uses++;
  rec(s, 'rule', { a: p.by, b: p.against, kind2: 1, q2: r.scope, way: p.shape });
  [p.by, p.against].forEach((who, i) => {
    if (who < 0 || !s.bodies[who]!.alive || (c.grief[who] ?? 0) - before[i]! < P.harmPaid || (c.grief[who] ?? 0) < P.aggrieved) return;
    const key = `c${r.id}`;
    if (s.t - (c.seen[key] ?? -999) < 52) return;
    c.seen[key] = s.t;
    c.docket.push({ id: c.next++, t: s.t, by: who, against: -1, bond: r.id, need: -1, rec: -1, shape: `against the rule: ${r.cut} ${r.shape}`, burdens: [], shapes: [], side: 'bare', reason: 'challenge', speaksFor: leaves(s, top(s, s.bodies[who]!)).length, waited: 0, urgency: 0 });
  });
}

/**
 * The audience. Gathers the week's matters, settles below whatever a rule covers, and seats the most
 * urgent of the rest, one of each shape. Returns those seated.
 */
export function audience(s: State): Petition[] {
  const c = s.court;
  if (!c) return [];
  const byId = new Map<number, Bond>();
  for (const b of s.bonds) byId.set(b.id, b);
  const kin = kinOf(s), idx = hearthIndex(s);
  const fresh: Petition[] = [];
  const shapeFor = (by: number, against: number, bd: Bond | undefined, side: Petition['side'], need: number, extra = ''): string => {
    const A = s.bodies[by]!, B = against >= 0 ? s.bodies[against]! : undefined;
    const near = !B ? 'nobody' : kin.get(by)?.has(against) ? 'kin' : A.of >= 0 && top(s, A).id === top(s, B).id ? 'of one body' : dist(s.side, A.home, B.home) <= P.reach ? 'a neighbour' : 'a stranger';
    return `${side === 'owed' ? 'owed on' : side === 'owes' ? 'bound by' : side === 'outside' ? 'shut out by' : 'in want'} ${bd ? formOf(byId, bd) : extra}; for ${need >= 0 ? NEEDS[need]!.id : 'nothing pressing'}; against ${near}`;
  };
  const add = (by: number, against: number, bd: Bond | undefined, side: Petition['side'], need: number, recId: number, extra = '', keyed = ''): void => {
    const key = keyed || (bd ? `${side}${bd.id}` : `w${by}:${need}`);
    if (s.t - (c.seen[key] ?? -999) < 26) return;
    const A = s.bodies[by]!, B = against >= 0 ? s.bodies[against]! : undefined;
    // Whether to go to court at all. A house weighs what it expects of the court, less the trouble of going,
    // against its own way: what its might would win in a struggle, or what dealing may yet bring.
    const hope = A.plea[SIDES.indexOf(side)] ?? 0.5;
    let own = A.stuck >= P.stuck ? 0 : 0.25;
    if (side === 'owed' && B) { const mA = might(s, kin, A, B.id), mB = might(s, kin, B, A.id); own = mA + mB > 0 ? mA / (mA + mB) - 0.15 : 0.35; }
    if (hope - P.pleaCost <= own) { c.seen[key] = s.t - 18; c.declined++; return; }
    c.seen[key] = s.t;
    A.away += P.pleaDays;
    // One who has gone to court holds their hand while the matter waits.
    if (bd && bd.about === 'act' && side === 'owed') bd.due = Math.max(bd.due, s.t + P.wait);
    const shape = shapeFor(by, against, bd, side, need, extra);
    fresh.push({ burdens: [], shapes: [], id: c.next++, t: s.t, by, against, bond: bd ? bd.id : -1, need, rec: recId, shape, side, reason: 'none', speaksFor: leaves(s, top(s, A)).length, waited: 0, urgency: 0 });
  };

  // What each hearth lacks most, if it lacks anything.
  const lack = new Map<number, number>();
  for (const b of s.bodies) {
    if (!b.alive || b.parts.length || !b.members.length) continue;
    const cov = cover(b.store, askAhead(s, b));
    let worst = -1, by = 0;
    for (let n = 0; n < NN; n++) { const v = NEEDS[n]!.harm * (1 - cov[n]! / P.short); if (NEEDS[n]!.harm >= 0.25 && v > by) { by = v; worst = n; } }
    if (worst >= 0) lack.set(b.id, worst);
    else if (cov.some((x, n) => NEEDS[n]!.harm >= 0.25 && x < P.dire)) lack.set(b.id, cov.findIndex((x, n) => NEEDS[n]!.harm >= 0.25 && x < P.dire));
  }
  const rights = new Map<number, number>(), letOn = new Set<number>();
  for (const bd of s.bonds) {
    if (bd.about === 'land' && bd.strength >= P.held) rights.set(bd.a, (rights.get(bd.a) ?? 0) + 1);
    else if (bd.about === 'bond' && bd.secures < 0) { rights.set(bd.a, (rights.get(bd.a) ?? 0) + 1); letOn.add(bd.on); }
  }
  // What weighs on each house in want. It comes to court once, with all of it.
  const weights = new Map<number, Bond[]>();
  const weigh = (id: number, bd: Bond): void => { const l = weights.get(id); if (l) l.push(bd); else weights.set(id, [bd]); };
  const landShort = (b: Body): boolean => (rights.get(b.id) ?? 0) < grown(s, b).length;
  for (const bd of s.bonds) {
    if (bd.about === 'person') continue;
    const A = s.bodies[bd.a], B = bd.b >= 0 ? s.bodies[bd.b] : undefined;
    if (!A || !A.alive || (B && !B.alive)) continue;
    if (bd.about === 'act') {
      if (bd.q <= 0.05 || !B) continue;
      // Owed on and not met: the one owed asks. Owing and in want: the one who owes asks.
      if ((!bd.labour && bd.broken) || bd.basis === 'wrong') add(bd.b, bd.a, bd, 'owed', lack.get(bd.b) ?? -1, bd.rec);
      // One held to a wrong they did not do asks to be cleared of it.
      // So, brazenly, may one who did.
      if (bd.basis === 'wrong' && bd.doer >= 0 && (bd.doer !== bd.a || (head(s, A)?.scruple ?? 1) < 0.4)) add(bd.a, bd.b, bd, 'owes', lack.get(bd.a) ?? -1, bd.rec);
      if (lack.has(bd.a) && (bd.labour || bd.due - s.t < 13)) weigh(bd.a, bd);
    } else if (bd.about === 'yield' && B) {
      if (lack.has(bd.a) && bd.due <= s.t && bd.easedTo <= s.t) weigh(bd.a, bd);
    } else if (bd.about === 'bond' && B) {
      // A surety or a letting weighs on one side of it when that side is in want.
      const bears = bd.secures >= 0 ? bd.b : bd.a;
      if (lack.has(bears) && (bd.secures >= 0 || bd.share > 0) && bd.easedTo <= s.t) weigh(bears, bd);
      // One who let ground and is now short of it asks for it back.
      if (bd.secures < 0 && landShort(B)) add(bd.b, bd.a, bd, 'owed', lack.get(bd.b) ?? -1, bd.rec);
    } else if (bd.about === 'land' && bd.strength >= 0.5 && !letOn.has(bd.id) && s.t - bd.used >= P.idle && s.t - bd.since >= P.idle) {
      // Ground held and left idle, within reach of one who has too little: the one shut out asks.
      for (const x of around(idx, s.side, bd.cell, P.reach)) {
        if (x.id === bd.a || !landShort(x) || !lack.has(x.id)) continue;
        add(x.id, bd.a, bd, 'outside', lack.get(x.id)!, bd.rec);
        break;
      }
    }
  }
  const heft = (bd: Bond): number => (bd.about === 'yield' || (bd.about === 'bond' && bd.secures < 0) ? bd.share * 100 : bd.about === 'bond' ? 40 : bd.q / 5);
  for (const [id, list] of weights) {
    list.sort((x, y) => heft(y) - heft(x) || x.id - y.id);
    // One of each kind of thing owed to each party is enough to say what weighs on it.
    const kinds = new Set<string>();
    const top3 = list.filter(b => { const k = `${other(b, id)}|${b.about}|${b.secures >= 0}|${b.way}|${b.labour}`; if (kinds.has(k)) return false; kinds.add(k); return true; }).slice(0, 3), before = fresh.length;
    add(id, other(top3[0]!, id), top3[0], 'owes', lack.get(id)!, top3[0]!.rec, '', `o${id}`);
    if (fresh.length === before) continue;
    const p = fresh[fresh.length - 1]!;
    p.burdens = top3.map(b => b.id);
    p.shapes = top3.map(b => shapeFor(id, other(b, id), b, 'owes', lack.get(id)!));
  }
  // A dire want with nothing the court can cut.
  for (const [id, n] of lack) {
    const b = s.bodies[id]!;
    if (fresh.some(f => f.by === id)) continue;
    // A house lately come, in want, whose neighbours hold that newcomers bring harm and will not deal with it.
    let shut = 0;
    if (b.since > -1e5 && s.t - b.since < 52) for (const x of around(idx, s.side, b.home, P.dealReach)) if (x !== b && (x.lore.new ?? 0) > P.heed) shut++;
    if (shut >= 2) add(id, -1, undefined, 'bare', n, b.why[n]!, 'and shunned as a newcomer');
    else if (cover(b.store, askAhead(s, b))[n]! < P.dire) add(id, -1, undefined, 'bare', n, b.why[n]!, b.why[n]! >= 0 ? 'after a loss' : 'with nothing behind it');
  }

  // Settle below what a rule covers; what two bodies' rules answer differently goes up.
  for (const p of fresh) {
    if (p.burdens.length) {
      // Whatever weighs on it that a rule already eases is eased below, and it need not come up.
      let eased = false;
      p.burdens.forEach((id, i) => {
        const r = c.rules.find(x => x.shape === p.shapes[i] && x.cut === 'stay' && (x.scope === -1 || x.scope === scopeOf(s, p.by)));
        if (!r || !carry(s, c, p, `ease:${id}`)) return;
        r.uses++; eased = true;
        rec(s, 'rule', { a: p.by, kind2: 1, q2: r.scope, way: p.shapes[i]! });
      });
      if (eased) teach(s, idx, p.by, 'owes', 0.7, P.pleaOwn); else c.docket.push(p);
      continue;
    }
    const r = ruleFor(s, c, p);
    if (r === 'clash') { p.reason = 'clash'; p.shape = `two rules on: ${p.shape}`; c.docket.push(p); } else if (r) below(s, c, p, r); else c.docket.push(p);
  }
  // Those who waited too long, or whose matter is gone, leave; the rest are ranked.
  c.docket = c.docket.filter(p => {
    if (!s.bodies[p.by]!.alive) return false;
    if (p.burdens.length) { if (!p.burdens.some(id => byId.has(id))) return false; } else if (p.reason !== 'challenge' && p.bond >= 0) { const bd = byId.get(p.bond); if (!bd || (bd.about === 'act' && bd.q <= 0.05) || (bd.about === 'land' && bd.strength < 0.05)) return false; }
    if (p.waited > P.wait) { grieve(c, p.by, P.harmUnheard * 2); teach(s, idx, p.by, p.side, 0, P.pleaOwn / 2); return false; }
    return true;
  });
  for (const p of c.docket) {
    const b = s.bodies[p.by]!, cov = cover(b.store, askAhead(s, b));
    let press = 0;
    for (let n = 0; n < NN; n++) press = Math.max(press, NEEDS[n]!.harm * Math.max(0, 1 - cov[n]! / P.short));
    p.urgency = press * 3 + Math.log2(1 + p.speaksFor) + p.waited / 4 + (p.reason !== 'none' ? 1 : 0);
  }
  c.docket.sort((x, y) => y.urgency - x.urgency || x.id - y.id);
  const seated: Petition[] = [], shapes = new Set<string>();
  for (const p of c.docket) { if (seated.length >= P.seats) break; if (shapes.has(p.shape)) continue; shapes.add(p.shape); seated.push(p); }
  return seated;
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
    if (p.reason === 'none') teach(s, hearthIndex(s), p.by, p.side, done ? FAVOUR[p.side]?.[r.cut.split(':')[0]!] ?? 0.5 : 0, P.pleaOwn);
    c.docket = c.docket.filter(x => x !== p);
    if (r.width === 'case' || p.reason === 'challenge') continue;
    // A rule: for the body the petitioner belongs to, or for everyone. It replaces any rule it contradicts there.
    const scope = r.width === 'realm' ? -1 : scopeOf(s, p.by);
    if (scope === -2) continue;
    const easing = r.cut.startsWith('ease:'), ruleCut = easing ? 'stay' : r.cut;
    if (!easing && p.burdens.length) continue;
    const shape = easing ? p.shapes[p.burdens.indexOf(Number(r.cut.slice(5)))] ?? p.shape : p.shape.replace(/^two rules on: /, '');
    const old = c.rules.findIndex(x => x.shape === shape && x.scope === scope);
    if (old >= 0) c.rules.splice(old, 1);
    const rule: Rule = { id: c.next++, scope, shape, cut: ruleCut, since: s.t, uses: 0 };
    c.rules.push(rule);
    rec(s, 'rule', { a: p.by, kind2: 0, q2: scope, way: `${ruleCut} ${shape}` });
    // Everyone already waiting with a like matter is answered by it at once. Those answered against had built on the old understanding.
    for (const q of c.docket.slice()) {
      const bi = q.shapes.indexOf(shape);
      if (q.burdens.length) {
        if (!easing || bi < 0 || !(scope === -1 || scope === scopeOf(s, q.by))) continue;
        c.docket = c.docket.filter(x => x !== q);
        if (carry(s, c, q, `ease:${q.burdens[bi]}`)) { rule.uses++; rec(s, 'rule', { a: q.by, kind2: 1, q2: scope, way: shape }); teach(s, hearthIndex(s), q.by, 'owes', 0.7, P.pleaOwn); }
        continue;
      }
      if (q.shape !== shape || q.reason !== 'none' || ruleFor(s, c, q) !== rule) continue;
      c.docket = c.docket.filter(x => x !== q);
      below(s, c, q, rule);
      if (scope === -1) grieve(c, r.cut === 'enforce' ? (q.side === 'owed' ? q.against : q.by) : q.side === 'owed' ? q.by : q.against, P.harmReversed);
    }
  }
  // What the Crown has laid by spoils like anything else. The regent's word falls due: kept out of the store, or broken before everyone.
  for (let k = 0; k < NK; k++) c.store[k] = c.store[k]! * (1 - Kn[k]!.keep);
  const idx = hearthIndex(s);
  c.words = c.words.filter(w => {
    if (w.due > s.t) return true;
    const to = s.bodies[w.to]!;
    if (!to.alive) return false;
    if (relieve(s, c, to, w.need) > 0) { c.wordsKept++; rec(s, 'keep', { b: w.to, need: w.need, q2: 9 }); teach(s, idx, w.to, 'bare', 1, P.pleaOwn); return false; }
    c.wordsBroken++;
    rec(s, 'break', { b: w.to, need: w.need, q2: 9 });
    grieve(c, w.to, P.harmWord);
    for (const b of around(idx, s.side, to.home, P.reach)) if (b.id !== w.to) grieve(c, b.id, P.harmWord / 5);
    teach(s, idx, w.to, 'bare', 0, P.pleaOwn);
    return false;
  });
  // The king's bailiffs send up what they took in for the Crown. When the store runs low they take for the king
  // from those with most, and pay nothing: a taking like any other, and the court's own.
  const low = c.store.reduce((x, y) => x + y, 0) < 0.5 * c.store0 && s.t % 13 === 0;
  for (const b of s.bodies) {
    if (!b.alive || b.rank !== 'bailiff') continue;
    for (let k = 0; k < NK; k++) { const up = Math.min(b.owedUp[k] ?? 0, b.store[k]!); if (up > 0) { b.store[k] = b.store[k]! - up; c.store[k] = c.store[k]! + up; } }
    b.owedUp = [];
    if (!low) continue;
    const payers = s.bonds.filter(x => x.about === 'yield' && x.b === b.id && x.way === 'crown').map(x => s.bodies[x.a]!).filter(x => x.alive && !x.rank);
    let kind = -1;
    for (let k = 0; k < NK; k++) if (!Kn[k]!.fixed && Kn[k]!.serves.some((v, n) => v > 0 && NEEDS[n]!.harm >= 0.5) && (kind < 0 || c.store[k]! < c.store[kind]!)) kind = k;
    if (kind < 0) continue;
    for (const v of payers.sort((x, y) => y.store[kind]! - x.store[kind]! || x.id - y.id).slice(0, 3)) {
      const q = v.store[kind]! * 0.15;
      if (q < 1) continue;
      v.store[kind] = v.store[kind]! - q; c.store[kind] = c.store[kind]! + q;
      const e = rec(s, 'take', { a: b.id, b: v.id, kind, q, kind2: -3 });
      s.wrongs.push({ by: b.id, to: v.id, kind, q, rec: e.id, doer: b.id });
      grieve(c, v.id, P.harmPaid);
    }
  }
  // Those still waiting in want hold it against the court.
  for (const p of c.docket) { p.waited++; if (p.urgency > 3) grieve(c, p.by, P.harmUnheard); }
  // Enough houses with enough grievance withdraw their confidence.
  let hearths = 0, sore = 0;
  for (const b of s.bodies) if (b.alive && !b.parts.length && b.members.length) { hearths++; if ((c.grief[b.id] ?? 0) >= P.aggrieved) sore++; }
  for (const k in c.grief) { const v = c.grief[k]! * P.griefFade; if (v < 0.5 || !s.bodies[Number(k)]!.alive) delete c.grief[k]; else c.grief[k] = v; }
  // Confidence once withdrawn is not withdrawn again for a season: people wait to see what the court does next.
  c.quiet++;
  if (hearths > 0 && sore >= P.faction * hearths && c.quiet > 8) {
    c.standing -= 1; c.quiet = 0;
    for (const k in c.grief) c.grief[k] = c.grief[k]! * 0.5;
    rec(s, 'withdraw', { q: sore, q2: hearths });
  } else if (c.quiet % 13 === 0 && c.standing < 5) c.standing = Math.min(5, c.standing + 0.25);
}
