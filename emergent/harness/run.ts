// Watch the toy. `node harness/run.ts years [years] [seed]` runs a realm with no court and prints
// what its people did each year. This file is a reader: it may name things; the rules may not.

import { found } from '../sim/found.ts';
import { step } from '../sim/step.ts';
import { KINDS, NEEDS, RECIPES } from '../sim/tables.ts';
import type { State } from '../sim/types.ts';

const [cmd = 'years', a1, a2] = process.argv.slice(2);

function tally(s: State, c: Record<string, number>): void {
  const add = (k: string, n = 1): void => { c[k] = (c[k] ?? 0) + n; };
  for (const r of s.log) {
    if (r.k === 'make') add(`days ${RECIPES[r.kind2]!.id}`, r.q2);
    else if (r.k === 'die') add(r.need >= 0 ? `died for want of ${NEEDS[r.need]!.id}` : r.cause >= 0 ? 'died of blows' : r.q < 2 ? 'died in infancy' : 'died of age');
    else if (r.k === 'take') add(r.kind2 >= 0 && r.b < 0 ? 'took from held land' : r.need < 0 ? (r.q2 ? 'seized what was owed, and fought' : 'seized what was owed') : 'took from a store, and fought');
    else if (r.k === 'trade') { add('trade'); add(`  got ${KINDS[r.kind]!.id} for ${KINDS[r.kind2]!.id}`); }
    else add(r.k);
  }
}

if (cmd === 'years') {
  const years = Number(a1 ?? 30), seed = Number(a2 ?? 1);
  let s = found(seed);
  const t0 = Date.now();
  console.log(`seed ${seed}: ${s.people.length} people in ${s.bodies.length} hearths`);
  for (let y = 0; y < years; y++) {
    const c: Record<string, number> = {};
    for (let w = 0; w < 52; w++) { s = step(s); tally(s, c); }
    const alive = s.people.filter(p => p.alive), bodies = s.bodies.filter(b => b.alive);
    const store = KINDS.map((k, i) => `${k.id} ${Math.round(bodies.reduce((x, b) => x + b.store[i]!, 0))}`).join(', ');
    const homes = new Set(bodies.map(b => b.home)).size;
    console.log(`\nyear ${y + 1}: ${alive.length} people, ${bodies.length} hearths on ${homes} cells, ${s.bonds.filter(b => b.about === 'land').length} holdings, ${s.bonds.filter(b => b.about === 'act').length} debts`);
    console.log(`  stores: ${store}`);
    const keys = Object.keys(c).sort();
    console.log('  ' + keys.filter(k => !k.startsWith('  ')).map(k => `${k} ${Math.round(c[k]!)}`).join(' · '));
    const swaps = keys.filter(k => k.startsWith('  ')).sort((x, y2) => c[y2]! - c[x]!).slice(0, 6);
    if (swaps.length) console.log('  swaps:' + swaps.map(k => `${k.trim().slice(4)} ×${c[k]}`).join(' ·'));
    if (!alive.length) break;
  }
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
