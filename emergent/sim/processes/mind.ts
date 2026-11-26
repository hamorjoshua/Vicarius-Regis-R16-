// Minds. What is known is known by people, not by hearths. A hearth acts on what the one who speaks
// for it knows; its grown members teach one another as far as each is ready to believe; and what a
// person knows goes with them when they leave, and is lost to the hearth when they die.

import { NS, P, Rc } from '../tables.ts';
import { weekOf } from '../types.ts';
import { grown, head } from '../util.ts';
import type { Body, Person, State } from '../types.ts';

const copy = (w: Record<string, { w: number; p: number }>): Record<string, { w: number; p: number }> => { const o: Record<string, { w: number; p: number }> = {}; for (const k in w) o[k] = { w: w[k]!.w, p: w[k]!.p }; return o; };
const speaker = (s: State, b: Body): Person | undefined => { const g = grown(s, b); let h: Person | undefined; for (const p of g) if (!h || p.born < h.born || (p.born === h.born && p.id < h.id)) h = p; return h ?? head(s, b); };

/** Before the week's choices: each hearth takes up the mind of the one who speaks for it. */
export function attend(s: State): void {
  for (const b of s.bodies) {
    if (!b.alive || b.parts.length) continue;
    const h = speaker(s, b);
    if (!h) continue;
    b.lore = { ...h.lore };
    b.ways = copy(h.ways);
    const g = grown(s, b);
    b.hope = h.hope.slice();
    b.plea = h.plea.slice();
    b.skill = Rc.map((_r, i) => (g.length ? g.reduce((x, p) => x + p.skill[i]!, 0) / g.length : P.green));
  }
}

/** After them: what the hearth learned is its speaker's; members teach one another; skill grows with use. */
export function settle(s: State): void {
  const days = new Map<number, number[]>();
  for (const r of s.log) if ((r.k === 'make' || (r.k === 'take' && r.b < 0)) && r.kind2 >= 0) { let d = days.get(r.a); if (!d) { d = Rc.map(() => 0); days.set(r.a, d); } d[r.kind2] = d[r.kind2]! + r.q2; }
  for (const b of s.bodies) {
    if (!b.alive || b.parts.length) continue;
    const h = speaker(s, b);
    if (!h) continue;
    const g = grown(s, b);
    // A way the hearth saw fail is dropped by all of it.
    for (const k of Object.keys(h.ways)) if (!b.ways[k]) for (const m of g) delete m.ways[k];
    h.lore = { ...b.lore };
    h.ways = copy(b.ways);
    // At midwinter each looks at what the year's putting-in returned, and believes a little more nearly that.
    if (weekOf(s.t) === 0) {
      for (let st = 0; st < NS; st++) {
        const put = b.put[st] ?? 0;
        if (put > 1) { const back = Math.max(0.5, Math.min(60, (b.got[st] ?? 0) / put)); for (const m of g) m.hope[st] = 0.7 * m.hope[st]! + 0.3 * back; }
      }
      b.put = []; b.got = [];
    }
    for (const m of g) if (m !== h) {
      for (let st = 0; st < NS; st++) m.hope[st] = m.hope[st]! + 0.05 * (h.hope[st]! - m.hope[st]!);
      for (let k = 0; k < h.plea.length; k++) m.plea[k] = m.plea[k]! + 0.05 * (h.plea[k]! - m.plea[k]!);
    }
    const d = days.get(b.id);
    for (const m of g) {
      if (m !== h) {
        for (const [k, w] of Object.entries(h.ways)) if (!m.ways[k]) m.ways[k] = { w: 1, p: w.p };
        for (const [k, w] of Object.entries(m.ways)) if (!h.ways[k]) { h.ways[k] = { w: 1, p: w.p }; b.ways[k] = { w: 1, p: w.p }; }
        // A belief is taken from another only by one ready enough to believe it.
        for (const [sign, v] of Object.entries(h.lore)) if (v >= P.tell && 0.9 * v > (m.lore[sign] ?? 0) && 1.2 * v > 1 - m.credulous) m.lore[sign] = 0.9 * v;
        for (const [sign, v] of Object.entries(m.lore)) {
          if (v >= P.tell && 0.9 * v > (h.lore[sign] ?? 0) && 1.2 * v > 1 - h.credulous) { h.lore[sign] = 0.9 * v; b.lore[sign] = 0.9 * v; }
          else if (!(h.lore[sign]! >= v)) { const f = v * P.forget; if (f < 0.02) delete m.lore[sign]; else m.lore[sign] = f; }
        }
      }
      // Skill comes with doing and slips without it.
      for (let i = 0; i < Rc.length; i++) {
        const did = d ? d[i]! / g.length : 0;
        m.skill[i] = m.skill[i]! + P.practise * did * (P.mastery - m.skill[i]!) - P.rust * (m.skill[i]! - P.green);
      }
    }
  }
}
