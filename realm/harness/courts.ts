// Scripted courts. Each plays a reign by a fixed habit, so the simulation can be judged before any player sees it.

import { EXPECTED } from '../sim/rng.ts';
import { advance } from '../sim/step.ts';
import { petitions } from '../sim/court/petitions.ts';
import type { Petition, Ruling, State } from '../sim/types.ts';

export type Court = (s: State, audience: Petition[]) => Ruling[];

/** The harness's own dice. The simulation never sees them. */
function dice(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** How good a state looks to a court that cares for its standing and its people. */
export function worth(s: State): number {
  let v = s.standing * 2 - (s.over === 'fallen' ? 50 : 0);
  for (const g of s.grievance) v -= Math.max(0, g - 1) * Math.max(0, g - 1);
  for (const R of s.regions) v -= 0.4 * R.unrest + R.hungry / 400 + R.sick * 8 + R.bandits / 100;
  for (const w of s.works) v += 0.6 * w.cond;
  v += Math.min(s.purse, 30000) / 15000 + Math.min(s.granary, 60000) / 30000;
  return v;
}

function ahead(s: State, r: Ruling[], weeks: number): number {
  let cur = advance(s, r, { chance: EXPECTED });
  for (let i = 1; i < weeks && !cur.over; i++) cur = advance(cur, [], { chance: EXPECTED });
  return worth(cur);
}

export const COURTS: Record<string, (seed: number) => Court> = {
  /** Hears no one. */
  null: () => () => [],
  /** Grants every ask. */
  naive: () => (_s, a) => a.slice(0, 3).map(p => ({ petition: p.id, option: 0 })),
  /** Chooses at random. */
  random: seed => { const u = dice(seed); return (_s, a) => a.slice(0, 3).map(p => ({ petition: p.id, option: Math.floor(u() * p.options.length) })); },
  /** Grants only what the Crown itself pays for, and denies the rest: a consistent court, for the learning check. */
  steady: () => (_s, a) => a.slice(0, 3).map(p => { const i = p.options.findIndex(o => !o.deny && o.payer === 'court'); return { petition: p.id, option: i >= 0 ? i : p.options.length - 1 }; }),
  /** Never spends the Crown's own: grants only what someone else pays for. The steady court's opposite, for the learning check. */
  stingy: () => (_s, a) => a.slice(0, 3).map(p => { const i = p.options.findIndex(o => !o.deny && o.payer !== 'court'); return { petition: p.id, option: i >= 0 ? i : p.options.length - 1 }; }),
  /** Maximises next week's standing and quiet. */
  greedy: () => (s, a) => {
    const out: Ruling[] = [];
    for (const p of a.slice(0, 3)) {
      let best = 0, bv = -1e9;
      p.options.forEach((_o, i) => { const v = ahead(s, [...out, { petition: p.id, option: i }], 1); if (v > bv) { bv = v; best = i; } });
      out.push({ petition: p.id, option: best });
    }
    return out;
  },
  /** Uses forecasts, hears keepers first and mends works before need. */
  careful: () => (s, a) => {
    const order = a.slice().sort((x, y) => (y.keeper ? 2 : 0) + y.urgency - ((x.keeper ? 2 : 0) + x.urgency)).slice(0, 3);
    const out: Ruling[] = [];
    for (const p of order) {
      let best = -1, bv = ahead(s, out, 3);
      p.options.forEach((_o, i) => { const v = ahead(s, [...out, { petition: p.id, option: i }], 3); if (v > bv) { bv = v; best = i; } });
      if (best >= 0) out.push({ petition: p.id, option: best });
    }
    return out;
  },
};

export interface Reign { final: State; weeks: number; kept: boolean; asks: { t: number; key: string; estate: number }[] }

/** Play one reign from a founded state. */
export function play(s0: State, court: Court): Reign {
  let s = s0;
  const asks: Reign['asks'] = [], seen = new Set<string>();
  while (!s.over) {
    const a = petitions(s);
    for (const p of s.docket) if (!seen.has(p.id)) { seen.add(p.id); asks.push({ t: s.t, key: `${p.options[0]!.means}|${p.options[0]!.payer}`, estate: p.estate }); }
    s = advance(s, court(s, a));
  }
  return { final: s, weeks: s.t, kept: s.over === 'kept', asks };
}
