// The founding: the land and the people as the run begins. Everything here is drawn once, from the
// founding channel, and nothing in it is a rule: it only fills the tables.

import { clamp, cos } from './math.ts';
import { draw } from './rng.ts';
import { Kn, NK, NS, P, Rc, SERVING, St, BY_HARM, NEEDS } from './tables.ts';
import { bear, person } from './processes/grow.ts';
import { body } from './processes/gather.ts';
import { bond, dist, near } from './util.ts';
import type { Cell, Person, State } from './types.ts';

export function found(seed: number): State {
  const side = P.side, n = side * side;
  let nth = 0;
  const u = (): number => draw(seed, 'founding', 0, 0, nth++);
  const s: State = {
    seed, t: 0, side, cells: [], people: [], bodies: [], bonds: [], ties: {},
    sky: { aT: [0, 0, 0, 0], aR: [0, 0, 0, 0], temp: new Array<number>(n).fill(P.tMean), rain: new Array<number>(n).fill(P.rainMean) },
    wrongs: [], uses: [], log: [], nrec: 0, nbond: 0,
  };

  // The lie of the land: a few long waves, so that there are hills, a plain and low wet ground.
  const waves = [0, 1, 2].map(() => ({ fx: (u() - 0.5) * 2.4, fy: (u() - 0.5) * 2.4, ph: u() * 6.283, a: 0.5 + u() }));
  const raw: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i % side) / side, y = Math.floor(i / side) / side;
    let h = 0;
    for (const w of waves) h += w.a * cos(6.283 * (w.fx * x + w.fy * y) + w.ph);
    raw.push(h + 0.15 * (u() - 0.5));
  }
  const lo = Math.min(...raw), hi = Math.max(...raw);
  const high = raw.map(h => (h - lo) / (hi - lo));
  const ranked = high.slice().sort((a, b) => a - b), wetLine = ranked[Math.floor(n * 0.14)]!;
  for (let i = 0; i < n; i++) {
    const h = high[i]!, water = h <= wetLine ? clamp(0.5 + (wetLine - h) / wetLine, 0.5, 1) : 0;
    const soil0 = clamp(0.35 + 0.7 * (1 - h) + 0.12 * (u() - 0.5), 0.15, 1.1);
    s.cells.push({ high: h, soil: soil0, soil0, wet: 1, water, pot: new Array<number>(NS).fill(0), stock: new Array<number>(NS).fill(0) });
  }
  for (let k = 0; k < NS; k++) {
    const L = St[k]!.lies;
    const pots = s.cells.map(c => {
      if (L.water && !c.water) return 0;
      if (!L.water && c.water) return 0;
      return clamp(L.base + L.low * (1 - c.high) + L.high * c.high + L.water * c.water, 0, 1.3);
    });
    if (L.rare) {
      const order = pots.map((p, i) => ({ i, v: p > 0 ? p + 0.6 * u() : -1 })).sort((a, b) => b.v - a.v);
      const keep = new Set(order.slice(0, L.rare).map(o => o.i));
      for (let i = 0; i < n; i++) if (!keep.has(i)) pots[i] = 0;
    }
    for (let i = 0; i < n; i++) s.cells[i]!.pot[k] = pots[i]!;
  }
  for (const c of s.cells) for (let k = 0; k < NS; k++) c.stock[k] = St[k]!.eats.length ? St[k]!.start * c.pot[k]! : St[k]!.start * bear(c, k);

  // Hamlets on the best dry ground, a few hearths in each.
  const sownBear = (c: Cell): number => { let b = 0; for (let k = 0; k < NS; k++) if (St[k]!.sown) b += bear(c, k); return b; };
  const sites = s.cells.map((c, i) => ({ i, v: c.water ? -1 : sownBear(c) * (0.6 + 0.8 * u()) })).sort((a, b) => b.v - a.v).slice(0, 14).map(x => x.i);
  const granted = new Set<number>();
  const first = BY_HARM[0]!;
  const year = (y: number): number => -Math.round(y * 52);
  while (s.people.filter(p => p.alive).length < P.souls) {
    const b = body(s, sites[Math.floor(u() * sites.length)]!);
    const settle = (p: Person): Person => { p.body = b.id; b.members.push(p.id); return p; };
    const ageHe = 22 + 26 * u(), ageShe = Math.max(18, ageHe - 6 * u());
    const he = settle(person(s, null, null, year(ageHe))), she = settle(person(s, null, null, year(ageShe)));
    he.sex = 0; she.sex = 1; he.spouse = she.id; she.spouse = he.id;
    bond(s, { about: 'person', a: he.id, b: she.id, basis: 'word' });
    for (let age = ageShe - 19 - 2 * u(); age > 0; age -= 2 + 2.5 * u()) {
      if (age > 16 || ageShe - age > P.bearTo) continue;
      const child = settle(person(s, she, he, year(age)));
      bond(s, { about: 'person', a: she.id, b: child.id, basis: 'birth' });
      bond(s, { about: 'person', a: he.id, b: child.id, basis: 'birth' });
      she.bore = Math.max(she.bore, child.born);
    }
    if (u() < 0.25) {
      const elder = settle(person(s, null, null, year(ageHe + 22 + 8 * u())));
      elder.sex = 1;
      bond(s, { about: 'person', a: elder.id, b: he.id, basis: 'birth' });
      he.mother = elder.id;
    }
    // A store to see the winter out and sow in the warm weeks, a roof, and now and then a help.
    let h = 0;
    for (const p of b.members) h += clamp((0 - s.people[p]!.born) / 52 / P.eatFull, P.eatLeast, 1);
    for (let need = 0; need < NEEDS.length; need++) {
      const N = NEEDS[need]!, k = SERVING[need]![SERVING[need]!.length - 1];
      if (k === undefined) continue;
      const weeks = need === first ? 46 + 16 * u() : Kn[k]!.fixed ? 0 : N.horizon * (0.3 + 0.5 * u());
      const per = N.per + N.cold * 5;
      b.store[k] = Math.max(b.store[k]!, Kn[k]!.fixed ? 1 : (h * per * weeks * Kn[k]!.use) / Kn[k]!.serves[need]!);
    }
    for (let k = 0; k < NK; k++) if (Object.keys(Kn[k]!.aids).length && u() < 0.45) b.store[k] = 1;
    // Ground of its own nearby, by grant.
    const plot = near(side, b.home, 3).filter(i => !granted.has(i) && !s.cells[i]!.water).sort((x, y) => sownBear(s.cells[y]!) * (1 - 0.2 * dist(side, b.home, y)) - sownBear(s.cells[x]!) * (1 - 0.2 * dist(side, b.home, x)))[0];
    if (plot !== undefined) { granted.add(plot); bond(s, { about: 'land', a: b.id, cell: plot, basis: 'grant', strength: 3 }); }
  }
  void Rc;
  return s;
}
