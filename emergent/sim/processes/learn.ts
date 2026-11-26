// Learn, and pass on. A house that comes to harm blames what it lately met with: a house it dealt with,
// a way of dealing, a newcomer, the state it was in when a child was born. What is blamed may have had
// nothing to do with it. Beliefs are told to those who hold the teller well, lose something in the telling,
// and fade. Nothing here knows which beliefs are true.

import { P } from '../tables.ts';
import { dist, head, kinOf, leaves, rec, tie, warm } from '../util.ts';
import type { Body, State } from '../types.ts';

function believe(s: State, b: Body, sign: string, strength: number, from: number): void {
  const was = b.lore[sign] ?? 0, now = Math.min(1.5, strength);
  if (now <= was) return;
  b.lore[sign] = now;
  if (was <= P.heed && now > P.heed) rec(s, 'learn', { a: b.id, b: from, way: `belief:${sign}` });
}

export function learn(s: State): void {
  const meet = (id: number, sign: string): void => {
    const b = s.bodies[id];
    if (!b || !b.alive || b.parts.length) return;
    b.recent.push([sign, s.t]);
    if (b.recent.length > 16) b.recent.shift();
  };
  const harm = (id: number, weight: number): void => {
    const b = s.bodies[id];
    if (!b || !b.alive) return;
    const signs = new Set(b.recent.filter(([, t]) => s.t - t <= P.mind).map(([sg]) => sg));
    for (const sg of signs) believe(s, b, sg, (b.lore[sg] ?? 0) + (P.blame * weight) / Math.max(1, Math.sqrt(signs.size)), -1);
  };
  for (const r of s.log) {
    if ((r.k === 'trade' || r.k === 'promise') && r.b >= 0) {
      meet(r.a, `house:${r.b}`); meet(r.b, `house:${r.a}`);
      if (r.way) { meet(r.a, `way:${r.way}`); meet(r.b, `way:${r.way}`); }
    } else if (r.k === 'move') {
      for (const b of s.bodies) if (b.alive && b.id !== r.a && dist(s.side, b.home, r.cell) <= P.reach) { meet(b.id, 'new'); meet(b.id, `house:${r.a}`); }
    } else if (r.k === 'die') {
      const p = s.people[r.a]!;
      harm(r.b, 1);
      // A child dead in its first years is laid to the state of the house it was born into, by all who see it.
      if (p.omen >= 0 && r.q < 6) for (const b of s.bodies) {
        if (!b.alive || b.parts.length || dist(s.side, b.home, r.cell) > P.reach) continue;
        believe(s, b, `born:${p.omen}`, (b.lore[`born:${p.omen}`] ?? 0) + (b.id === r.b ? P.blame : P.blame / 3), b.id === r.b ? -1 : r.b);
      }
    } else if (r.k === 'take' && r.b >= 0) { meet(r.b, `house:${r.a}`); harm(r.b, 0.4); }
    else if (r.k === 'break') harm(r.b, 0.4);
  }

  // What half or more of a body holds is its way: its members take it up, and among them it does not fade.
  const kept = new Set<string>();
  for (const c of s.bodies) {
    if (!c.alive || !c.parts.length) continue;
    const members = leaves(s, c).map(i => s.bodies[i]!);
    if (members.length < 2) continue;
    const held = new Map<string, number>();
    for (const m of members) for (const [sign, v] of Object.entries(m.lore)) if (v > P.heed) held.set(sign, (held.get(sign) ?? 0) + 1);
    for (const [sign, n] of held) {
      if (n * 2 < members.length || n < 2) continue;
      for (const m of members) {
        if (sign === `house:${m.id}`) continue;
        believe(s, m, sign, P.heed + 0.1, c.id);
        kept.add(`${m.id}|${sign}`);
      }
    }
  }
  for (const b of s.bodies) {
    if (!b.alive) continue;
    for (const k of Object.keys(b.lore)) {
      if (kept.has(`${b.id}|${k}`)) continue;
      const v = b.lore[k]! * P.forget;
      if (v < 0.02) delete b.lore[k]; else b.lore[k] = v;
    }
  }
  if (s.t % 4 !== 0) return;

  // Telling: to kin, to fellows of the same body, and to any who hold the teller well.
  const kin = kinOf(s);
  for (const b of s.bodies) {
    if (!b.alive || b.parts.length) continue;
    // A house believed to bring harm is held the worse for it.
    for (const [sign, v] of Object.entries(b.lore)) if (v > P.heed && sign.startsWith('house:')) warm(s, b.id, Number(sign.slice(6)), -0.05 * v);
    const strong = Object.entries(b.lore).filter(([, v]) => v >= P.tell);
    if (!strong.length) continue;
    for (const t of s.bodies) {
      if (!t.alive || t === b || t.parts.length || dist(s.side, t.home, b.home) > P.dealReach) continue;
      const near = kin.get(b.id)?.has(t.id) || (b.of >= 0 && b.of === t.of) ? 0.3 : 0;
      const trust = near + tie(s, t.id, b.id);
      const h = head(s, t);
      if (!h || trust < 0.1) continue;
      for (const [sign, v] of strong) if (sign !== `house:${t.id}` && v * (0.5 + trust) > 1 - h.credulous) believe(s, t, sign, 0.8 * v, b.id);
    }
  }
}
