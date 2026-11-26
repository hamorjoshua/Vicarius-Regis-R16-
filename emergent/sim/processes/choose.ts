// Choose. A body takes the acts it believes will most ease its scarcest need: work, trade, give,
// promise, take, move. Nothing more specific exists. Every body reads the realm as the step began.

import { exp } from '../math.ts';
import { AIDERS, BY_HARM, Kn, NEEDS, NK, NN, NS, P, Rc, St } from '../tables.ts';
import { askAhead, cover, welfare, welfareLater, zeros } from '../value.ts';
import { bond, dist, grown, head, holdsByCell, kinOf, muster, near, rec, struggle, tie, warm } from '../util.ts';
import { bear } from './grow.ts';
import { tBar } from './sky.ts';
import { weekOf, type Body, type Bond, type Person, type State } from '../types.ts';

interface Opt { r: number; cell: number; mine: number; take: boolean; score: number }
interface Ctx {
  b: Body; h: Person; days: number; grown: number;
  ahead: number[]; cov: number[]; W: number;
  /** Worth of one more unit of each kind; `extra` is the part that comes from what it can be made into or help make. */
  v: number[]; extra: number[];
  scarce: number; press: number; pressNeed: number;
  opts: Opt[];
  /** What it expects to gather later from what already stands on its own ground. */
  pend: number[];
  /** Things on its own ground that it could not gather in the time the cold leaves, were it to wait. */
  rush: boolean[];
}

/** Everything about the land that is worked out once a week. */
interface Land { holds: Map<number, Bond[]>; bears: number[][]; left: Map<number, number>; homes: number[] }

/** Where a living thing will stand after T more growing weeks. */
const ripen = (x: number, K: number, r: number, T: number): number => (x <= 0 || K <= 0 ? 0 : K / (1 + (K / x - 1) * exp(-r * T)));

/** Growing weeks left to a thing on a cell in the usual year. */
function weeksLeft(s: State, L: Land, cell: number, st: number): number {
  const key = cell * NS + st;
  let n = L.left.get(key);
  if (n === undefined) {
    n = 0;
    const high = s.cells[cell]!.high, w = weekOf(s.t), lo = St[st]!.lo;
    while (n < 40 && tBar(high, (w + n + 1) % 52) >= lo) n++;
    n = Math.max(0, n - P.prudence);
    L.left.set(key, n);
  }
  return n;
}

/** The temperature expected on a cell i weeks on: the usual year, shifted by how far this week is from usual, fading. */
function outlook(s: State, cell: number, i: number): number {
  const high = s.cells[cell]!.high, w = weekOf(s.t);
  let fade = 1;
  for (let k = 0; k < i; k++) fade *= P.skyPersist;
  return tBar(high, (w + i) % 52) + (s.sky.temp[cell]! - tBar(high, w)) * fade;
}

/** How much more there will be in four weeks if it is left alone. */
function growth(s: State, L: Land, cell: number, st: number): number {
  const r = St[st]!, x0 = s.cells[cell]!.stock[st]!;
  if (x0 <= 0) return 1;
  if (r.eats.length) {
    let fed = 1;
    for (const [prey, each] of r.eats) fed = Math.min(fed, (s.cells[cell]!.stock[prey]! * 0.5) / (each * x0));
    return 1 + 4 * (r.r * fed - (r.starve ?? 0) * (1 - fed));
  }
  const K = L.bears[cell]![st]!;
  let x = x0;
  for (let i = 1; i <= 4; i++) {
    const te = outlook(s, cell, i);
    if (te >= r.lo) x += K > 0 ? r.r * x * (1 - x / K) : 0;
    else if (te < r.kill) x *= 1 - r.frost;
  }
  return x / x0;
}

/** Weeks until the cold is expected to wither a thing on a cell. */
function witherIn(s: State, cell: number, st: number): number {
  const r = St[st]!;
  if (r.frost <= 0) return 99;
  for (let i = 1; i <= 12; i++) if (outlook(s, cell, i) < r.kill) return i;
  return 99;
}

function rights(L: Land, body: number, cell: number): { mine: number; free: boolean } {
  let sum = 0, own = 0;
  for (const h of L.holds.get(cell) ?? []) { sum += h.strength; if (h.a === body) own += h.strength; }
  if (own > 0) return { mine: own / sum, free: true };
  return { mine: 0, free: sum < P.held };
}

/** What one unit of a thing on the land becomes in the store when gathered. */
function gathered(st: number): [number, number][] {
  const r = St[st]!.reap < 0 ? null : Rc[St[st]!.reap]!;
  if (!r) return [];
  const per = r.from[0]![1];
  return r.out.map(([k, q]) => [k, q / per]);
}

function options(s: State, L: Land, b: Body): Opt[] {
  const out: Opt[] = [];
  for (let ri = 0; ri < Rc.length; ri++) {
    const r = Rc[ri]!;
    if (!r.from.length && !r.to.length) { out.push({ r: ri, cell: b.home, mine: 1, take: false, score: 1 }); continue; }
    const cands: Opt[] = [];
    for (const cell of near(s.side, b.home, P.reach)) {
      const c = s.cells[cell]!, far = 1 - P.travel * dist(s.side, b.home, cell);
      let score = 0;
      if (r.from.length) {
        const st = r.from[0]![0], x = c.stock[st]!;
        if (x < 1) continue;
        score = (x / (x + St[st]!.thin)) * far;
      } else {
        const st = r.to[0]![0], K = L.bears[cell]![st]!;
        if (K < 20) continue;
        const T = weeksLeft(s, L, cell, st), x = c.stock[st]!;
        if (T < 6) continue;
        score = ((ripen(x + 10, K, St[st]!.r, T) - ripen(x, K, St[st]!.r, T)) / 10) * far;
        if (score < 1.2) continue;
      }
      const rt = rights(L, b.id, cell);
      // Nobody puts their own onto ground another has begun to hold.
      if (r.to.length && rt.mine <= 0 && (!rt.free || (L.holds.get(cell)?.length ?? 0) > 0)) continue;
      cands.push({ r: ri, cell, mine: rt.mine, take: !rt.free, score });
    }
    cands.sort((a, b2) => b2.score - a.score || a.cell - b2.cell);
    let free = 0, barred = 0;
    for (const c of cands) {
      if (c.take) { if (barred++ < 1) out.push(c); } else if (free++ < 3) out.push(c);
    }
  }
  return out;
}

function context(s: State, L: Land, b: Body): Ctx | null {
  const h = head(s, b);
  if (!h) return null;
  const ahead = askAhead(s, b), cov = cover(b.store, ahead), W = welfare(b.store, ahead);
  const direct = zeros(), tmp = b.store.slice();
  for (let k = 0; k < NK; k++) { tmp[k] = tmp[k]! + 1; direct[k] = welfare(tmp, ahead) - W; tmp[k] = b.store[k]!; }
  let scarce = 0, press = 0, pressNeed = -1;
  for (let n = 0; n < NN; n++) {
    const N = NEEDS[n]!;
    if (N.harm * exp((-3 * cov[n]!) / N.horizon) > NEEDS[scarce]!.harm * exp((-3 * cov[scarce]!) / NEEDS[scarce]!.horizon)) scarce = n;
    const p = N.harm * (1 - cov[n]! / P.dire);
    if (p > press) { press = p; pressNeed = n; }
  }
  const opts = options(s, L, b), nGrown = grown(s, b).length;

  // What stands on its own ground and will be gathered later.
  const pend = zeros();
  const standing = St.map(() => 0), soon = St.map(() => 99);
  for (const [cell, over] of L.holds) {
    let sum = 0, own = 0;
    for (const x of over) { sum += x.strength; if (x.a === b.id) own += x.strength; }
    if (own <= 0) continue;
    for (let st = 0; st < NS; st++) {
      if (!St[st]!.sown) continue;
      const x = s.cells[cell]!.stock[st]!;
      if (x <= 0) continue;
      standing[st] = standing[st]! + (x * own) / sum;
      soon[st] = Math.min(soon[st]!, witherIn(s, cell, st));
      const end = ripen(x, L.bears[cell]![st]!, St[st]!.r, weeksLeft(s, L, cell, st));
      for (const [k, q] of gathered(st)) pend[k] = pend[k]! + (end * q * own) / sum;
    }
  }

  // What a day of each kind of work is worth, and so what its inputs and its helps are worth.
  const extra = zeros();
  const outWorth = (o: Opt): number => {
    const r = Rc[o.r]!;
    let w = 0;
    for (const [k, q] of r.out) w += q * (direct[k]! + extra[k]!);
    for (const [st, q] of r.to) for (const [k, per] of gathered(st)) w += q * o.score * per * direct[k]! * P.later;
    return w;
  };
  for (const k of Object.keys(AIDERS)) {
    let best = 0;
    for (const o of opts) if (!o.take && Rc[o.r]!.aid === k) best = Math.max(best, outWorth(o) * (Rc[o.r]!.from.length ? o.score : 1));
    for (const kind of AIDERS[k]!) extra[kind] = Math.max(extra[kind]!, (Kn[kind]!.aids[k]! - 1) * best * P.aidDays * Math.max(0, 1 - b.store[kind]! / Math.max(1, nGrown)));
  }
  for (let pass = 0; pass < 2; pass++) {
    for (const o of opts) {
      const r = Rc[o.r]!;
      if (o.take || !r.inp.length) continue;
      const w = outWorth(o);
      for (const [k, q] of r.inp) extra[k] = Math.max(extra[k]!, (P.inputShare * w) / q / r.inp.length - direct[k]!);
    }
  }
  const v = direct.map((d, k) => d + extra[k]!);
  const days = muster(s, b);
  const rush = St.map((row, st) => row.reap >= 0 && standing[st]! > 0 && standing[st]! / Math.max(1, 0.5 * Rc[row.reap]!.from[0]![1] * days) >= soon[st]! - 1);
  return { b, h, days, rush, grown: nGrown, ahead, cov, W, v, extra, scarce, press, pressNeed, opts, pend };
}

/** The good to a body of a change to a store. */
function gain(c: Ctx, store: number[], W0: number, delta: [number, number][]): number {
  const tmp = store.slice();
  let g = 0;
  for (const [k, q] of delta) { tmp[k] = Math.max(0, tmp[k]! + q); g += (c.extra[k]! * q) / (1 + store[k]! / P.pile); }
  return g + welfare(tmp, c.ahead) - W0;
}

// --- Dealings: trade, give, promise, take ---

function deal(s: State, cs: Map<number, Ctx>, kin: Map<number, Set<number>>, A: Ctx): void {
  const a = A.b;
  const partners: Ctx[] = [];
  for (const B of cs.values()) if (B !== A && dist(s.side, a.home, B.b.home) <= P.dealReach) partners.push(B);
  if (!partners.length) return;
  const kinds = Kn.map((_k, i) => i).filter(k => !Kn[k]!.fixed);
  const wants = kinds.slice().sort((x, y) => A.v[y]! - A.v[x]! || x - y).slice(0, 3).filter(k => A.v[k]! > 1e-6);
  const offers = kinds.filter(k => a.store[k]! > 0.01).sort((x, y) => A.v[x]! - A.v[y]! || x - y).slice(0, 3);

  // Trade: each gives what it values less for what it values more.
  let best: { B: Ctx; k: number; j: number; ra: number; rb: number } | null = null, bestEst = 0;
  for (const B of partners) {
    if (tie(s, a.id, B.b.id) < P.barAt || tie(s, B.b.id, a.id) < P.barAt) continue;
    for (const k of wants) {
      if (B.b.store[k]! < 0.05) continue;
      for (const j of offers) {
        if (j === k || B.v[j]! < 1e-6) continue;
        const ra = A.v[k]! / Math.max(A.v[j]!, 1e-6), rb = B.v[k]! / B.v[j]!;
        if (ra <= rb * P.edge) continue;
        const est = Math.min(B.b.store[k]! * P.part, (a.store[j]! * 0.5) / rb) * A.v[k]! * (1 - Math.sqrt(rb / ra));
        if (est > bestEst) { bestEst = est; best = { B, k, j, ra, rb }; }
      }
    }
  }
  if (best) {
    const { B, k, j, ra, rb } = best, b = B.b;
    const rate = Math.sqrt(Math.min(ra, rb * 4) * rb);
    let qk = Math.min(b.store[k]! * P.part, (a.store[j]! * 0.5) / rate);
    const Wa = welfare(a.store, A.ahead), Wb = welfare(b.store, B.ahead);
    for (let tries = 0; tries < 4 && qk > 0.01; tries++, qk /= 2) {
      const qj = qk * rate;
      if (gain(A, a.store, Wa, [[k, qk], [j, -qj]]) <= 0 || gain(B, b.store, Wb, [[k, -qk], [j, qj]]) <= 0) continue;
      a.store[k] = a.store[k]! + qk; a.store[j] = a.store[j]! - qj;
      b.store[k] = b.store[k]! - qk; b.store[j] = b.store[j]! + qj;
      a.spent += Math.min(2, (qk * Kn[k]!.weight + qj * Kn[j]!.weight) * dist(s.side, a.home, b.home) * P.carry);
      warm(s, a.id, b.id, P.warm); warm(s, b.id, a.id, P.warm);
      rec(s, 'trade', { a: a.id, b: b.id, kind: k, q: qk, kind2: j, q2: qj, need: A.scarce, cell: b.home });
      return;
    }
  }

  // Short of a need, and nothing to trade for it: ask kin, then ask for a loan, then, if desperate, take.
  const n = A.pressNeed >= 0 ? A.pressNeed : A.scarce;
  if (A.cov[n]! >= P.short) return;
  const lack = Math.max(0, 3 * A.ahead[n]!);
  const amount = (B: Ctx, k: number): number => Math.min(B.b.store[k]! * P.part, (lack * Kn[k]!.use) / Kn[k]!.serves[n]!);
  const serving = kinds.filter(k => Kn[k]!.serves[n]! > 0);
  const kinOfA = kin.get(a.id);
  let giver: Ctx | null = null, gk = -1, gBest = 0;
  for (const B of partners) {
    if (!kinOfA?.has(B.b.id)) continue;
    for (const k of serving) {
      const q = amount(B, k), worth = P.kin * A.v[k]! - B.v[k]!;
      if (q > 0.05 && worth > 0 && worth * q > gBest) { gBest = worth * q; giver = B; gk = k; }
    }
  }
  if (giver) {
    const q = amount(giver, gk);
    giver.b.store[gk] = giver.b.store[gk]! - q; a.store[gk] = a.store[gk]! + q;
    warm(s, a.id, giver.b.id, 3 * P.warm);
    rec(s, 'give', { a: giver.b.id, b: a.id, kind: gk, q, need: n, cause: a.why[n]! });
    return;
  }
  let lender: Ctx | null = null, lk = -1, lBest = 0;
  for (const B of partners) {
    const trust = Math.min(1, P.trust + 0.6 * tie(s, B.b.id, a.id));
    if (trust * (1 + P.premium) <= 1) continue;
    for (const k of serving) {
      const q = amount(B, k);
      if (q > 0.05 && B.v[k]! < 0.6 * A.v[k]! && B.cov[n]! > 2 * P.short && q * trust > lBest) { lBest = q * trust; lender = B; lk = k; }
    }
  }
  if (lender) {
    const q = amount(lender, lk);
    lender.b.store[lk] = lender.b.store[lk]! - q; a.store[lk] = a.store[lk]! + q;
    const e = rec(s, 'promise', { a: a.id, b: lender.b.id, kind: lk, q, q2: q * (1 + P.premium), need: n, cause: a.why[n]! });
    bond(s, { about: 'act', a: a.id, b: lender.b.id, kind: lk, q: q * (1 + P.premium), due: s.t + P.term, basis: 'word', rec: e.id });
    return;
  }
  if (A.cov[n]! >= P.dire) return;
  let victim: Ctx | null = null, vk = -1, vBest = 0;
  for (const B of partners) {
    if (kinOfA?.has(B.b.id) || dist(s.side, a.home, B.b.home) > P.reach + 1) continue;
    const regard = tie(s, a.id, B.b.id);
    if (A.press <= A.h.scruple * Math.max(0.7, 1 + regard)) continue;
    for (const k of serving) {
      const q = amount(B, k) * (1 - 0.5 * regard);
      if (q > vBest) { vBest = q; victim = B; vk = k; }
    }
  }
  if (victim && vBest > 0.05) {
    // The holder is at home: the taking is opposed, and the taker carries off only what their might wins.
    const e = rec(s, 'take', { a: a.id, b: victim.b.id, kind: vk, q: 0, q2: 1, need: n, cause: a.why[n]! });
    const q = amount(victim, vk) * struggle(s, kin, a, victim.b, e.id);
    e.q = q;
    victim.b.store[vk] = victim.b.store[vk]! - q; a.store[vk] = a.store[vk]! + q;
    s.wrongs.push({ by: a.id, to: victim.b.id, kind: vk, q, rec: e.id });
  }
}

// --- Work: the week's days, a block at a time, each to whatever then eases most ---

function work(s: State, L: Land, c: Ctx): void {
  const b = c.b, proj = b.store.slice(), pend = c.pend.slice();
  const planned = new Map<number, number>(), sown = new Map<number, number>();
  const helpLeft = proj.map(q => q * P.days);
  const bold = c.press > c.h.scruple;
  let left = muster(s, b);
  b.plan = [];
  while (left > 0.05) {
    const d = Math.min(P.block, left);
    const W0 = welfare(proj, c.ahead);
    let best: Opt | null = null, bestGain = P.rest * d, bestM = 0, bestAid = -1;
    for (const o of c.opts) {
      const r = Rc[o.r]!, cell = s.cells[o.cell]!;
      // Only want of the very thing drives a body to take it from ground that others hold.
      if (o.take && !(bold && r.out.some(([k]) => Kn[k]!.serves[c.pressNeed]! > 0))) continue;
      let m = d * (1 - P.travel * dist(s.side, b.home, o.cell)), aid = -1;
      if (r.aid) for (const k of AIDERS[r.aid] ?? []) if (helpLeft[k]! >= d) { m *= Kn[k]!.aids[r.aid]!; aid = k; break; }
      let waitFor = 1;
      for (const [st, q] of r.from) {
        const key = o.cell * NS + st, x = Math.max(0, cell.stock[st]! - (planned.get(key) ?? 0));
        m *= x / (x + St[st]!.thin);
        if (q * m > x * P.glean) m = (x * P.glean) / q;
        // What is still growing on one's own ground is worth leaving, unless the need is dire.
        const dire = r.out.some(([k]) => Kn[k]!.serves.some((sv, n) => sv > 0 && c.cov[n]! < P.dire && NEEDS[n]!.harm >= 0.5));
        if (!dire && o.mine > 0 && !c.rush[st]) waitFor = Math.max(0, 1 - P.wait * (growth(s, L, o.cell, st) - 1) * o.mine);
      }
      for (const [k, q] of r.inp) if (q * m > proj[k]!) m = proj[k]! / q;
      if (m <= 1e-6) continue;
      const delta: [number, number][] = [];
      for (const [k, q] of r.inp) delta.push([k, -q * m]);
      for (const [k, q] of r.out) delta.push([k, q * m]);
      let g = gain(c, proj, W0, delta) * waitFor;
      for (const [st, q] of r.to) {
        const key = o.cell * NS + st, K = L.bears[o.cell]![st]!, T = weeksLeft(s, L, o.cell, st);
        const x = cell.stock[st]! + (sown.get(key) ?? 0);
        const more = ripen(x + q * m, K, St[st]!.r, T) - ripen(x, K, St[st]!.r, T);
        const after = pend.slice();
        for (const [k, per] of gathered(st)) after[k] = after[k]! + more * per;
        g += P.later * (welfareLater(proj, after, c.ahead, T) - welfareLater(proj, pend, c.ahead, T));
      }
      if (g > bestGain) { bestGain = g; best = o; bestM = m; bestAid = aid; }
    }
    if (!best) break;
    const r = Rc[best.r]!;
    for (const [k, q] of r.inp) proj[k] = Math.max(0, proj[k]! - q * bestM);
    for (const [k, q] of r.out) proj[k] = proj[k]! + q * bestM;
    for (const [st, q] of r.from) { const key = best.cell * NS + st; planned.set(key, (planned.get(key) ?? 0) + q * bestM); }
    for (const [st, q] of r.to) {
      const key = best.cell * NS + st, K = L.bears[best.cell]![st]!, T = weeksLeft(s, L, best.cell, st);
      const x = s.cells[best.cell]!.stock[st]! + (sown.get(key) ?? 0);
      const more = ripen(x + q * bestM, K, St[st]!.r, T) - ripen(x, K, St[st]!.r, T);
      for (const [k, per] of gathered(st)) pend[k] = pend[k]! + more * per;
      sown.set(key, (sown.get(key) ?? 0) + q * bestM);
    }
    if (bestAid >= 0) helpLeft[bestAid] = helpLeft[bestAid]! - d;
    const same = b.plan.find(w => w.r === best!.r && w.cell === best!.cell);
    if (same) same.days += d; else b.plan.push({ r: best.r, cell: best.cell, days: d });
    left -= d;
  }
}

// --- Moving: a body goes where the ground within reach promises more ---

function prospect(s: State, L: Land, c: Ctx, home: number): number {
  let sum = 0;
  for (const cell of near(s.side, home, P.reach)) {
    const rt = rights(L, c.b.id, cell);
    if (!rt.free) continue;
    const far = 1 - P.travel * dist(s.side, home, cell);
    const share = rt.mine > 0 ? rt.mine : 1 / (1 + L.homes[cell]!);
    for (let st = 0; st < NS; st++) {
      const have = St[st]!.sown ? L.bears[cell]![st]! : s.cells[cell]!.stock[st]! * (St[st]!.r > 0 || St[st]!.self > 0 ? 1 : 0.05);
      if (have <= 0) continue;
      for (const [k, per] of gathered(st)) sum += have * per * c.v[k]! * far * share;
    }
  }
  return sum;
}

function roam(s: State, L: Land, c: Ctx): void {
  const b = c.b;
  // Only want of the most harmful thing uproots a body, and not one that has only just settled.
  if (c.pressNeed !== BY_HARM[0] || s.t - b.since < 26) return;
  const here = prospect(s, L, c, b.home);
  let best = -1, bestP = here * P.stay;
  for (const cell of near(s.side, b.home, P.scout)) {
    if (cell === b.home) continue;
    const p = prospect(s, L, c, cell) * (1 - 0.05 * dist(s.side, b.home, cell));
    if (p > bestP) { bestP = p; best = cell; }
  }
  if (best < 0) return;
  b.goto = best;
  b.plan = [];
}

export function choose(s: State): void {
  const L: Land = { holds: holdsByCell(s), bears: s.cells.map(c => St.map((_r, k) => bear(c, k))), left: new Map(), homes: new Array<number>(s.cells.length).fill(0) };
  for (const b of s.bodies) if (b.alive) for (const cell of near(s.side, b.home, P.reach)) L.homes[cell] = L.homes[cell]! + 1;
  const cs = new Map<number, Ctx>();
  for (const b of s.bodies) {
    if (!b.alive) continue;
    const c = context(s, L, b);
    if (c) cs.set(b.id, c);
  }
  const kin = kinOf(s);
  for (const c of cs.values()) deal(s, cs, kin, c);
  for (const c of cs.values()) { work(s, L, c); roam(s, L, c); }
}
