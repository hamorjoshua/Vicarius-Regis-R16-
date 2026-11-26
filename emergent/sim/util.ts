// Helpers shared by the processes. None of them knows a row by name.

import { clamp } from './math.ts';
import { P } from './tables.ts';
import type { Body, Bond, Person, Rec, State } from './types.ts';

export const dist = (side: number, a: number, b: number): number =>
  Math.max(Math.abs((a % side) - (b % side)), Math.abs(Math.floor(a / side) - Math.floor(b / side)));

const nearCache = new Map<string, number[]>();
/** The cells within r of cell i, nearest first. */
export function near(side: number, i: number, r: number): number[] {
  const key = `${side}:${i}:${r}`;
  let out = nearCache.get(key);
  if (!out) {
    out = [];
    for (let j = 0; j < side * side; j++) if (dist(side, i, j) <= r) out.push(j);
    out.sort((a, b) => dist(side, i, a) - dist(side, i, b) || a - b);
    nearCache.set(key, out);
  }
  return out;
}

/** Write one elementary happening into the week's record. */
export function rec(s: State, k: string, f: Partial<Rec> = {}): Rec {
  const r: Rec = { id: s.nrec++, t: s.t, k, a: -1, b: -1, cell: -1, kind: -1, q: 0, kind2: -1, q2: 0, need: -1, cause: -1, ...f };
  s.log.push(r);
  return r;
}

export const tie = (s: State, a: number, b: number): number => { const row = s.ties[a]; return row === undefined ? 0 : (row[b] ?? 0); };
export const setTie = (s: State, a: number, b: number, v: number): void => { (s.ties[a] ??= {})[b] = v; };
export function warm(s: State, a: number, b: number, d: number): void {
  if (a === b) return;
  setTie(s, a, b, clamp(tie(s, a, b) + d, -1, 1));
}

/** The share of a full day's work a person of this age can do. */
export function capacity(age: number): number {
  if (age < P.workFrom) return 0;
  if (age < P.workFull) return (age - P.workFrom) / (P.workFull - P.workFrom);
  if (age <= P.workWane) return 1;
  return clamp(1 - (0.8 * (age - P.workWane)) / (P.workEnd - P.workWane), 0.2, 1);
}
/** The share of a grown person's wants a person of this age has. */
export const appetite = (age: number): number => P.eatLeast + (1 - P.eatLeast) * clamp(age / P.eatFull, 0, 1);

export const living = (s: State, b: Body): Person[] => b.members.map(i => s.people[i]!).filter(p => p.alive);
export const grown = (s: State, b: Body): Person[] => living(s, b).filter(p => (s.t - p.born) / 52 >= P.workFull);

/** The eldest of a body speaks for it. */
export function head(s: State, b: Body): Person | undefined {
  let h: Person | undefined;
  for (const p of living(s, b)) if (!h || p.born < h.born || (p.born === h.born && p.id < h.id)) h = p;
  return h;
}

/** The days of work a body can muster in a week. */
export function muster(s: State, b: Body): number {
  let d = 0;
  for (const p of living(s, b)) d += P.days * capacity((s.t - p.born) / 52) * clamp(1 - p.wear / p.sound, 0.1, 1);
  return Math.max(0, d - b.spent);
}

/** Bodies bound by birth: every body that holds a parent or one of that parent's children. */
export function kinOf(s: State): Map<number, Set<number>> {
  const groups = new Map<number, Set<number>>();
  for (const bd of s.bonds) {
    if (bd.about !== 'person' || bd.basis !== 'birth') continue;
    const parent = s.people[bd.a]!, child = s.people[bd.b]!;
    if (!child.alive) continue;
    let g = groups.get(bd.a);
    if (!g) { g = new Set(); groups.set(bd.a, g); if (parent.alive) g.add(parent.body); }
    g.add(child.body);
  }
  const kin = new Map<number, Set<number>>();
  for (const g of groups.values()) {
    if (g.size < 2) continue;
    for (const a of g) for (const b of g) if (a !== b) { let k = kin.get(a); if (!k) { k = new Set(); kin.set(a, k); } k.add(b); }
  }
  return kin;
}

/** The bonds over each cell. */
export function holdsByCell(s: State): Map<number, Bond[]> {
  const m = new Map<number, Bond[]>();
  for (const bd of s.bonds) if (bd.about === 'land') { const l = m.get(bd.cell); if (l) l.push(bd); else m.set(bd.cell, [bd]); }
  return m;
}

export function bond(s: State, f: Partial<Bond> & Pick<Bond, 'about' | 'a' | 'basis'>): Bond {
  const b: Bond = { id: s.nbond++, b: -1, cell: -1, kind: -1, q: 0, due: -1, labour: false, on: -1, share: 0, secures: -1, used: s.t - 999, strength: 1, since: s.t, broken: false, rec: -1, way: '', doer: -1, ...f };
  s.bonds.push(b);
  return b;
}

/** What a body can bring to a struggle: its grown members, and half of nearby kin who bear the other no goodwill. */
export function might(s: State, kin: Map<number, Set<number>>, b: Body, against: number): number {
  let m = grown(s, b).length;
  const allies = new Set<number>(kin.get(b.id) ?? []);
  for (const f of fellows(s, b)) allies.add(f);
  for (const k of allies) {
    const kb = s.bodies[k]!;
    if (kb.alive && k !== against && k !== b.id && dist(s.side, kb.home, b.home) <= P.reach + 1 && tie(s, k, against) <= 0.2) m += 0.5 * grown(s, kb).length;
  }
  return m;
}

/** A taking that is opposed. Returns the share the taker carries off; both sides are hurt by the other's might. */
export function struggle(s: State, kin: Map<number, Set<number>>, taker: Body, holder: Body, at: number): number {
  const mT = might(s, kin, taker, holder.id), mH = might(s, kin, holder, taker.id);
  const p = mT + mH > 0 ? mT / (mT + mH) : 0.5;
  for (const x of grown(s, holder)) { x.wear += P.blow * p; x.blow = at; x.blowAt = s.t; }
  for (const x of grown(s, taker)) { x.wear += P.blow * (1 - p); x.blow = at; x.blowAt = s.t; }
  warm(s, holder.id, taker.id, -0.6); warm(s, taker.id, holder.id, -0.3);
  for (const k of kin.get(holder.id) ?? []) warm(s, k, taker.id, -0.2);
  for (const k of kin.get(taker.id) ?? []) warm(s, k, holder.id, -0.2);
  return p;
}

/** A right to use ground through another's bond: who uses it, on which cell, and the bonds it passes through. */
export interface Tenancy { lease: Bond; cell: number; root: Bond; depth: number }

/** Every lease traced down to the holding it rests on. A lease may rest on a lease, without limit. */
export function tenancies(s: State): Tenancy[] {
  const byId = new Map<number, Bond>();
  for (const b of s.bonds) byId.set(b.id, b);
  const out: Tenancy[] = [];
  for (const b of s.bonds) {
    if (b.about !== 'bond' || b.secures >= 0) continue;
    let cur = byId.get(b.on), depth = 1;
    while (cur && cur.about === 'bond' && depth < 20) { cur = byId.get(cur.on); depth++; }
    if (cur && cur.about === 'land') out.push({ lease: b, cell: cur.cell, root: cur, depth });
  }
  return out;
}

/** Pass a share of what a tenant gathered up through every bond the tenancy rests on. */
export function payRent(s: State, lease: Bond, kind: number, amount: number): void {
  const byId = new Map<number, Bond>();
  for (const b of s.bonds) byId.set(b.id, b);
  let cur: Bond | undefined = lease, payer = s.bodies[lease.a]!, due = amount;
  while (cur && cur.about === 'bond') {
    const over = byId.get(cur.on);
    if (!over) return;
    const pay = Math.min(payer.store[kind]!, due * cur.share), to = s.bodies[over.a]!;
    if (pay <= 0 || !to.alive) return;
    payer.store[kind] = payer.store[kind]! - pay;
    to.store[kind] = to.store[kind]! + pay;
    payer = to; due = pay; cur = over;
  }
}

/** The outermost body a body belongs to. */
export function top(s: State, b: Body): Body {
  let cur = b;
  for (let i = 0; i < 20 && cur.of >= 0 && s.bodies[cur.of]!.alive; i++) cur = s.bodies[cur.of]!;
  return cur;
}

/** The hearths a body is made of, however many bodies deep. */
export function leaves(s: State, b: Body, out: number[] = []): number[] {
  if (!b.parts.length) { if (b.alive) out.push(b.id); return out; }
  for (const p of b.parts) leaves(s, s.bodies[p]!, out);
  return out;
}

/** The other hearths that share a body with this one, at any level. */
export function fellows(s: State, b: Body): number[] {
  if (b.of < 0) return [];
  return leaves(s, top(s, b)).filter(i => i !== b.id);
}

/** How one body holds another: for bodies made of bodies, the mean of how their hearths hold one another. */
export function regard(s: State, a: Body, b: Body): number {
  const la = leaves(s, a), lb = leaves(s, b);
  if (!la.length || !lb.length) return 0;
  let sum = 0;
  for (const x of la) for (const y of lb) sum += tie(s, x, y);
  return sum / (la.length * lb.length);
}

/** A way of dealing served well or ill: both parties remember. A way that has only failed is forgotten. */
export function served(s: State, bd: Bond, good: boolean): void {
  if (!bd.way) return;
  for (const id of [bd.a, bd.b]) {
    const w = s.bodies[id]?.ways[bd.way];
    if (!w) continue;
    w.w += good ? 0.2 : -0.5;
    if (w.w <= 0) delete s.bodies[id]!.ways[bd.way];
  }
}

/** The hearths living on each cell. */
export function hearthIndex(s: State): Body[][] {
  const idx: Body[][] = s.cells.map(() => []);
  for (const b of s.bodies) if (b.alive && !b.parts.length) idx[b.home]!.push(b);
  return idx;
}

/** Everything indexed on the cells within r of a cell. */
export function around<T>(idx: T[][], side: number, cell: number, r: number): T[] {
  const out: T[] = [];
  for (const c of near(side, cell, r)) { const l = idx[c]!; for (let i = 0; i < l.length; i++) out.push(l[i]!); }
  return out;
}
