// Grow. Living things increase toward what their ground can bear, and feed on one another.
// The same rule gives every plant, beast and person; nothing here knows which is which.

import { clamp, pow } from '../math.ts';
import { draw, normal } from '../rng.ts';
import { BY_HARM, NN, NS, P, St } from '../tables.ts';
import { askAhead, cover } from '../value.ts';
import { bond, holdsByCell, near, rec } from '../util.ts';
import type { Body, Cell, Person, State } from '../types.ts';

/** What a cell can bear of one living or lying thing. */
export function bear(c: Cell, k: number): number {
  const r = St[k]!;
  let b = r.cap * c.pot[k]!;
  if (b <= 0) return 0;
  if (r.soil) b *= pow(c.soil, r.soil);
  if (r.wet) b *= clamp(0.4 + 0.6 * c.wet, 0.3, 1.25);
  return b;
}

/** A new person. Thresholds are drawn once, centred on the parents'. */
export function person(s: State, mother: Person | null, father: Person | null, born: number): Person {
  const id = s.people.length;
  const z = (k: number): number => normal(draw(s.seed, 'thresholds', id, 0, k));
  const u = (k: number): number => draw(s.seed, 'thresholds', id, 0, k);
  const mid = (f: (p: Person) => number, base: number): number => (mother && father ? 0.5 * base + 0.25 * (f(mother) + f(father)) : base);
  const p: Person = {
    id, born, sex: u(0) < 0.5 ? 0 : 1, body: -1,
    mother: mother ? mother.id : -1, father: father ? father.id : -1, spouse: -1, alive: true, wear: 0,
    sound: clamp(mid(x => x.sound, P.sound) + P.soundSpread * z(1), 0.3, 1.8),
    scruple: clamp(mid(x => x.scruple, 0.5) + 0.25 * z(2), 0.15, 1.5),
    temper: clamp(mid(x => x.temper, 0.5) + 0.25 * z(3), 0.05, 1.5),
    spacing: Math.round(clamp(mid(x => x.spacing, P.spacing) + 25 * z(4), 70, 260)),
    credulous: clamp(mid(x => x.credulous, 0.5) + 0.2 * u(5) - 0.1 + 0.15 * z(6), 0.1, 0.9), omen: -1,
    bore: s.t - 999, blow: -1, blowAt: s.t - 999, fed: new Array<number>(NN).fill(1),
  };
  s.people.push(p);
  return p;
}

export function grow(s: State): void {
  const holds = holdsByCell(s);
  const homes = new Map<number, Body[]>();
  for (const b of s.bodies) if (b.alive && !b.parts.length) { const l = homes.get(b.home); if (l) l.push(b); else homes.set(b.home, [b]); }
  for (let i = 0; i < s.cells.length; i++) {
    const c = s.cells[i]!, temp = s.sky.temp[i]!;
    for (let k = 0; k < NS; k++) {
      const r = St[k]!;
      if (r.eater) continue;
      const x = c.stock[k]!, K = bear(c, k);
      if (K <= 0) { if (x > 0) c.stock[k] = x * 0.5; continue; }
      if (temp >= r.lo) {
        const g = r.r * x * (1 - x / K) + r.self * (1 - x / K);
        c.stock[k] = Math.max(0, x + g);
        if (r.drain && g > 0) c.soil = Math.max(0.05, c.soil - r.drain * g);
      } else if (temp < r.kill && r.frost > 0 && x > 0) {
        const lost = r.frost * x;
        c.stock[k] = x - lost;
        if (r.sown && lost > 5) {
          const e = rec(s, 'decay', { cell: i, kind2: k, q: lost });
          for (const h of holds.get(i) ?? []) for (const n of r.needs) s.bodies[h.a]!.why[n] = e.id;
        }
      }
    }
    for (let k = 0; k < NS; k++) {
      const r = St[k]!, x = c.stock[k]!;
      if (!r.eater) continue;
      const thrives = r.wet ? Math.max(0, c.wet - 1.1) * 5 : 1;
      if (x <= 0) { c.stock[k] = r.self * c.pot[k]! * Math.min(1, thrives); continue; }
      if (temp < r.kill && r.frost > 0) { c.stock[k] = x * (1 - r.frost) < 0.05 ? 0 : x * (1 - r.frost); continue; }
      let fed = 1;
      for (const [prey, each] of r.eats) {
        const want = each * x, got = Math.min(want, c.stock[prey]! * 0.5);
        c.stock[prey] = c.stock[prey]! - got;
        fed = Math.min(fed, got / want);
      }
      // Some feed on what people have laid by.
      for (const [kind, each] of r.eatsStore) {
        const here = homes.get(i) ?? [];
        let have = 0;
        for (const b of here) have += b.store[kind]!;
        const want = each * x, got = Math.min(want, have * 0.05);
        if (have > 0) for (const b of here) b.store[kind] = b.store[kind]! * (1 - got / have);
        fed = Math.min(fed, got / want);
        if (got > 5) rec(s, 'decay', { cell: i, kind, q: got, kind2: k, q2: 2 });
      }
      c.stock[k] = x * (1 + r.r * fed * Math.max(thrives, 0.2) - (r.starve ?? 0) * (1 - fed)) + r.self * c.pot[k]! * fed * Math.min(1, thrives);
      if (c.stock[k]! < 0.05) c.stock[k] = 0;
      if (r.dung) c.soil = Math.min(c.soil0 + 0.25, c.soil + r.dung * c.stock[k]!);
    }
    c.soil += (c.soil0 - c.soil) * P.soilMend;
  }

  // What feeds on other things wanders toward where there is more to feed on.
  for (let k = 0; k < NS; k++) {
    const r = St[k]!;
    if (!r.roams) continue;
    const fare = s.cells.map((c, i) => {
      let f = 0;
      for (const [prey] of r.eats) f += c.stock[prey]!;
      for (const [kind] of r.eatsStore) for (const b of homes.get(i) ?? []) f += b.store[kind]!;
      return f;
    });
    const was = s.cells.map(c => c.stock[k]!);
    for (let i = 0; i < s.cells.length; i++) {
      const x = was[i]!;
      if (x < 0.5) continue;
      let best = -1, bestF = (1.5 * fare[i]!) / (x + 1);
      for (const j of near(s.side, i, 1)) { const f = fare[j]! / (was[j]! + 1); if (j !== i && s.cells[j]!.pot[k]! >= 0 && f > bestF) { bestF = f; best = j; } }
      if (best < 0) continue;
      s.cells[i]!.stock[k] = s.cells[i]!.stock[k]! - r.roams * x;
      s.cells[best]!.stock[k] = s.cells[best]!.stock[k]! + r.roams * x;
    }
  }

  // People: a child comes to a wedded pair when the house is fed and the mother is well.
  const first = BY_HARM[0]!;
  const count = s.people.length;
  for (let i = 0; i < count; i++) {
    const m = s.people[i]!;
    if (!m.alive || m.sex !== 1 || m.spouse < 0) continue;
    const f = s.people[m.spouse]!, age = (s.t - m.born) / 52;
    if (!f.alive || f.body !== m.body || age < P.wedShe || age > P.bearTo) continue;
    if (s.t - m.bore < m.spacing || m.wear > 0.5 * m.sound || m.fed[first]! < 0.95) continue;
    const b = s.bodies[m.body]!;
    const c = cover(b.store, askAhead(s, b))[first]!;
    if (c < P.fertile) continue;
    // A house that believes children born in such a state come to harm, waits.
    const omen = c < 13 ? 0 : c < 26 ? 1 : c < 52 ? 2 : 3;
    if ((b.lore[`born:${omen}`] ?? 0) > P.heed) continue;
    const child = person(s, m, f, s.t);
    child.body = b.id; b.members.push(child.id);
    child.omen = omen;
    m.bore = s.t;
    bond(s, { about: 'person', a: m.id, b: child.id, basis: 'birth' });
    bond(s, { about: 'person', a: f.id, b: child.id, basis: 'birth' });
    rec(s, 'born', { a: child.id, b: b.id, cell: b.home });
  }
}
