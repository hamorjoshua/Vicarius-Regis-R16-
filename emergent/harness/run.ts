// Watch the realm. Commands: years, chronicle, measures, hearth, cell (see the README).
// Each runs a realm with no court. This file is a reader: it may name things; the rules may not.

import { inherit } from '../sim/found.ts';
import { step } from '../sim/step.ts';
import { KINDS, NEEDS, RECIPES, STOCKS } from '../sim/tables.ts';
import { deflateSync } from 'node:zlib';
import { Readers, beliefWords, form, wayWords, year } from '../readers/readers.ts';
import { askAhead, cover } from '../sim/value.ts';
import type { State } from '../sim/types.ts';

const [cmd = 'years', a1, a2] = process.argv.slice(2);

function tally(s: State, c: Record<string, number>): void {
  const add = (k: string, n = 1): void => { c[k] = (c[k] ?? 0) + n; };
  for (const r of s.log) {
    if (r.k === 'make') add(`days ${RECIPES[r.kind2]!.id}`, r.q2);
    else if (r.k === 'die') add(r.need >= 0 ? `died for want of ${NEEDS[r.need]!.id}` : r.cause >= 0 ? 'died of blows' : r.q < 2 ? 'died in infancy' : 'died of age');
    else if (r.k === 'take') add(r.kind2 === -2 ? 'took pledged ground' : r.kind2 >= 0 && r.b < 0 ? 'took from held land' : r.need < 0 ? (r.q2 ? 'seized what was owed, and fought' : 'seized what was owed') : 'took from a store, and fought');
    else if (r.k === 'trade') { add('trade'); add(`  got ${KINDS[r.kind]!.id} for ${KINDS[r.kind2]!.id}`); }
    else if (r.k === 'give') add(r.kind2 === 1 ? (r.need >= 0 ? 'drew from the common store' : 'gave to the common store') : 'give');
    else if (r.k === 'leave') add(r.kind2 === -3 ? 'left a band' : r.kind2 === -4 ? 'band came apart' : 'leave');
    else if (r.k === 'promise' && r.way) add(`dealt ${r.way}`);
    else if (r.k === 'blame') add(r.q2 ? 'blamed the wrong house' : 'blamed the right house');
    else if (r.k === 'plan') add(r.q2 > 0 ? 'plan fulfilled' : r.q2 < 0 ? 'plan given up' : 'plan made');
    else if (r.k === 'learn') add(r.way?.startsWith('belief:') ? (r.b >= 0 ? 'was told a belief' : 'came to a belief') : 'learned a way');
    else if (r.k === 'promise') add(r.kind2 === 1 ? 'promise of work' : r.kind2 === 2 ? 'loan against ground' : r.kind2 >= 3 ? (r.kind2 > 3 ? 'lease of a lease' : 'lease') : 'promise');
    else add(r.k);
  }
}

if (cmd === 'years') {
  const years = Number(a1 ?? 30), seed = Number(a2 ?? 1);
  let s = inherit(seed);
  const t0 = Date.now();
  console.log(`seed ${seed}: ${s.people.length} people in ${s.bodies.length} hearths`);
  for (let y = 0; y < years; y++) {
    const c: Record<string, number> = {};
    for (let w = 0; w < 52; w++) { s = step(s); tally(s, c); }
    const alive = s.people.filter(p => p.alive), bodies = s.bodies.filter(b => b.alive && !b.parts.length);
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

function watch(years: number, seed: number, each?: (s: State, R: Readers) => void): { s: State; R: Readers; ms: number } {
  let s = inherit(seed);
  const R = new Readers(), t0 = Date.now();
  for (let w = 0; w < years * 52; w++) { s = step(s); R.read(s); each?.(s, R); }
  R.close();
  return { s, R, ms: (Date.now() - t0) / (years * 52) };
}

if (cmd === 'chronicle') {
  const years = Number(a1 ?? 30), seed = Number(a2 ?? 1);
  const { R } = watch(years, seed);
  console.log(`The chronicle of realm ${seed}\n`);
  for (let y = 1; y <= years; y++) {
    const evs = R.events.filter(e => year(e.t0) === y).sort((a, b) => b.size - a.size);
    const pop = R.pop[y * 52 - 1]!, was = y > 1 ? R.pop[(y - 1) * 52 - 1]! : R.pop[0]!;
    const small = evs.filter(e => e.name === 'exhaustion' || e.name === 'recovery' || e.name === 'house died out');
    const big = evs.filter(e => !small.includes(e));
    console.log(`Year ${y}. ${pop} souls${pop > was * 1.03 ? ', more than the year before' : pop < was * 0.97 ? ', fewer than the year before' : ''}.`);
    for (const e of big.slice(0, 6)) { console.log(`  ${e.text}`); for (const c of e.chain.slice(0, 2)) console.log(`      because ${c}`); }
    if (big.length > 6) console.log(`  And ${big.length - 6} lesser quarrels and troubles.`);
    const count = (n: string): number => small.filter(e => e.name === n).length;
    const bits = [count('exhaustion') && `${count('exhaustion')} grounds or waters were stripped bare`, count('recovery') && `${count('recovery')} came back`, count('house died out') && `${count('house died out')} houses died out`].filter(Boolean);
    if (bits.length) console.log(`  ${bits.join('; ')}.`);
  }
  const c = R.crash();
  console.log(`\nThe deepest fall: from ${c.peak} souls in year ${year(c.from)} to ${c.trough} in year ${year(c.to)} (${Math.round(c.depth * 100)}%).`);
}

if (cmd === 'measures') {
  const years = Number(a1 ?? 30), seeds = (a2 ?? '1,2,3,4').split(',').map(Number);
  const runs = seeds.map(seed => {
    const land: number[][] = [];
    const yearText: string[] = [], forms = new Map<string, number>(), atEnd = new Map<string, number>();
    let buf: string[] = [];
    const out = watch(years, seed, s => {
      for (const r of s.log) if (r.k !== 'make') buf.push(`${r.k}:${r.kind}:${r.need}:${r.q2 ? 1 : 0}`);
      if (s.t % 52 === 0) {
        yearText.push(buf.join(' ')); buf = [];
        land.push([...STOCKS.map((_k, i) => s.cells.reduce((x, c) => x + c.stock[i]!, 0)), s.cells.reduce((x, c) => x + c.soil, 0) / s.cells.length]);
        atEnd.clear();
        for (const b of s.bonds) { const f = form(s, b.id); if (!forms.has(f)) forms.set(f, s.t / 52); atEnd.set(f, (atEnd.get(f) ?? 0) + 1); }
      }
    });
    return { seed, yearText, forms, atEnd, land, ...out };
  });
  console.log(`Measures over ${seeds.length} realms of ${years} years\n`);
  console.log('| Seed | ms a week | Peak | Trough | Fall | Years falling | End |');
  console.log('| --- | --- | --- | --- | --- | --- | --- |');
  for (const r of runs) { const c = r.R.crash(); console.log(`| ${r.seed} | ${r.ms.toFixed(1)} | ${c.peak} | ${c.trough} | ${Math.round(c.depth * 100)}% | ${((c.to - c.from) / 52).toFixed(1)} | ${r.R.pop[r.R.pop.length - 1]} |`); }

  // Trouble at every scale: how many of each thing the readers found, and how large.
  const by = new Map<string, number[]>();
  for (const r of runs) for (const e of r.R.events) { const l = by.get(e.name) ?? []; l.push(e.size); by.set(e.name, l); }
  console.log('\n| What the readers found | Count | Median size | Largest |');
  console.log('| --- | --- | --- | --- |');
  for (const [name, sizes] of [...by].sort((a, b) => b[1].length - a[1].length)) { sizes.sort((a, b) => a - b); console.log(`| ${name} | ${sizes.length} | ${sizes[sizes.length >> 1]} | ${sizes[sizes.length - 1]} |`); }

  // Open-ended: how badly each year's record compresses given the years before. 1 is wholly new; near 0, a repeat.
  console.log('\nNovelty of each year\'s record against the years before it (1: wholly new, 0: a repeat), mean of the realms:');
  const nov: number[][] = [];
  for (const r of runs) r.yearText.forEach((txt, y) => {
    if (y === 0 || !txt) return;
    const dict = Buffer.from(r.yearText.slice(0, y).join(' ')).subarray(-32000);
    const alone = deflateSync(Buffer.from(txt)).length, given = dict.length ? deflateSync(Buffer.from(txt), { dictionary: dict }).length : alone;
    (nov[y] ??= []).push(given / alone);
  });
  console.log('  ' + nov.map((v, y) => (v ? `y${y + 1} ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)}` : '')).filter(Boolean).join(' · '));

  // Unforeseen: chains of causes found in no other realm, and shapes of event seen in only one.
  const strip = (c: string): string => c.replace(/[0-9(),]+/g, '#');
  const chains = runs.map(r => new Set(r.R.events.flatMap(e => e.chain.map(strip))));
  const all = chains.flatMap(c => [...c]);
  const lone = all.filter(c => chains.filter(x => x.has(c)).length === 1).length;
  console.log(`\nChains of causes: ${new Set(all).size} distinct shapes; ${all.length ? Math.round((100 * lone) / all.length) : 0}% appear in only one realm.`);
  const shapes = runs.map(r => new Set(r.R.events.map(e => e.shape)));
  console.log(`Shapes of event: ${new Set(shapes.flatMap(x => [...x])).size} in all; per realm ${shapes.map(x => x.size).join(', ')}.`);

  // Open-ended: forms of bond, the year each first stood at a year's end, and how many stand at the last.
  console.log('\nForms of bond (year first seen in each realm; number standing at the end):');
  const allForms = new Set(runs.flatMap(r => [...r.forms.keys()]));
  for (const f of [...allForms].sort((x, y2) => x.length - y2.length)) console.log(`  ${f}: first in year ${runs.map(r => r.forms.get(f) ?? '-').join(', ')}; at the end ${runs.map(r => r.atEnd.get(f) ?? 0).join(', ')}`);

  console.log('\nWays of dealing (year first used in each realm; times used; hearths that know it at the end):');
  const allWays = new Set(runs.flatMap(r => [...r.R.ways.keys()]));
  for (const w of [...allWays].sort()) console.log(`  ${wayWords(w)}: first in year ${runs.map(r => (r.R.ways.has(w) ? year(r.R.ways.get(w)!.first) : '-')).join(', ')}; used ${runs.map(r => r.R.ways.get(w)?.uses ?? 0).join(', ')}; known to ${runs.map(r => r.s.bodies.filter(b => b.alive && b.ways[w]).length).join(', ')}`);
  console.log('\nBeliefs (year first held in each realm; houses that came to it themselves / were told it; houses holding it at the end):');
  const allB = new Set(runs.flatMap(r => [...r.R.beliefs.keys()]));
  for (const k of [...allB].sort()) console.log(`  ${k === 'house:' ? 'that some named house brings harm' : beliefWords(k)}: first in year ${runs.map(r => (r.R.beliefs.has(k) ? year(r.R.beliefs.get(k)!.first) : '-')).join(', ')}; ${runs.map(r => { const b = r.R.beliefs.get(k); return b ? `${b.own}/${b.told}` : '0/0'; }).join(', ')}; at the end ${runs.map(r => r.s.bodies.filter(b => b.alive && Object.entries(b.lore).some(([sg, v]) => v > 0.5 && (k === 'house:' ? sg.startsWith('house:') : sg === k))).length).join(', ')}`);
  // The land: what stands on it at each tenth year, mean of the realms, and the floods of each ten years.
  console.log('\nThe land at the end of each tenth year (sum over all cells, mean of the realms):');
  const tens = Array.from({ length: Math.floor(years / 10) }, (_x, i) => (i + 1) * 10);
  const mean = (f: (r: (typeof runs)[number]) => number): number => runs.reduce((x, r) => x + f(r), 0) / runs.length;
  console.log(`  | | year 1 | ${tens.map(t => 'year ' + t).join(' | ')} |`);
  [...STOCKS.map(k => k.id), 'soil (mean)'].forEach((name, i) => console.log(`  | ${name} | ${[1, ...tens].map(t => { const v = mean(r => r.land[t - 1]![i]!); return v < 10 ? v.toFixed(2) : Math.round(v); }).join(' | ')} |`));
  console.log(`  | floods in the ten years to | - | ${tens.map(t => mean(r => r.R.events.filter(e => e.shape === 'flood' && e.t0 >= (t - 10) * 52 && e.t0 < t * 52).length).toFixed(1)).join(' | ')} |`);

  console.log(`\nTakings nobody saw (laid to the right house / to the wrong one), by realm: ${runs.map(r => `${r.R.blame.right}/${r.R.blame.wrong}`).join(', ')}`);
  console.log(`\nPlans held over weeks (made / fulfilled / given up), by realm: ${runs.map(r => `${r.R.plans.made}/${r.R.plans.done}/${r.R.plans.dropped}`).join(', ')}`);

  console.log(`\nWhat hearths believe a unit of seed returns at the end (least / mean / most), by realm: ${runs.map(r => { const hs = r.s.bodies.filter(b => b.alive && !b.parts.length && b.hope.length).map(b => b.hope[STOCKS.findIndex(k => k.id === 'corn')]!); return hs.length ? `${Math.min(...hs).toFixed(1)}/${(hs.reduce((x, y2) => x + y2, 0) / hs.length).toFixed(1)}/${Math.max(...hs).toFixed(1)}` : '-'; }).join(', ')}`);

  // Skill: how good the hearths are at each kind of work at the end, and how far the best stands above the rest.
  console.log('\nSkill at each kind of work at the end (mean of hearths / best hearth), by realm:');
  RECIPES.forEach((rc, i) => console.log(`  ${rc.id}: ${runs.map(r => { const hs = r.s.bodies.filter(b => b.alive && !b.parts.length && b.skill.length); return hs.length ? `${(hs.reduce((x, b) => x + b.skill[i]!, 0) / hs.length).toFixed(2)}/${Math.max(...hs.map(b => b.skill[i]!)).toFixed(2)}` : '-'; }).join(', ')}`));

  // Customs: what half or more of a body's houses hold, at the end.
  console.log('\nCustoms standing at the end (bodies in which half or more of the houses hold it), by realm:');
  const customs = runs.map(r => {
    const out = new Map<string, number>();
    for (const c of r.s.bodies) {
      if (!c.alive || !c.parts.length) continue;
      const stack = [...c.parts], hearths: number[] = [];
      while (stack.length) { const b = r.s.bodies[stack.pop()!]!; if (b.parts.length) stack.push(...b.parts); else if (b.alive) hearths.push(b.id); }
      const held = new Map<string, number>();
      for (const h of hearths) for (const [sg, v] of Object.entries(r.s.bodies[h]!.lore)) if (v > 0.5) { const k = sg.startsWith('house:') ? 'house:' : sg; held.set(k, (held.get(k) ?? 0) + 1); }
      for (const [k, n] of held) if (n * 2 >= hearths.length && n >= 2) out.set(k, (out.get(k) ?? 0) + 1);
    }
    return out;
  });
  for (const k of new Set(customs.flatMap(c => [...c.keys()]))) console.log(`  ${k === 'house:' ? 'that some named house brings harm' : beliefWords(k)}: ${customs.map(c => c.get(k) ?? 0).join(', ')}`);
  console.log(`\nBodies made of bodies standing at the end, by realm: ${runs.map(r => { const c = r.s.bodies.filter(b => b.alive && b.parts.length); return `${c.length} (deepest ${Math.max(0, ...c.map(b => { let d = 0, cur = [b]; while (cur.length) { d++; cur = cur.flatMap(x => x.parts.map(p => r.s.bodies[p]!)).filter(x => x.parts.length); } return d; }))})`; }).join(', ')}`);

  // What carried each fall.
  console.log('\nWhat happened during each fall:');
  for (const r of runs) {
    const c = r.R.crash(), n: Record<string, number> = {};
    for (const rec of r.R.index.values()) {
      if (rec.t < c.from || rec.t > c.to) continue;
      const k = rec.k === 'die' ? (rec.need >= 0 ? `died for want of ${NEEDS[rec.need]!.id}` : rec.cause >= 0 ? 'died of blows' : 'died otherwise') : rec.k === 'take' ? (rec.b < 0 ? 'gathered from held ground' : rec.need >= 0 ? 'took from a store' : 'fought or seized for a debt') : '';
      if (k) n[k] = (n[k] ?? 0) + 1;
    }
    console.log(`  seed ${r.seed}: ` + Object.entries(n).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
  }
}

if (cmd === 'hearth') {
  const id = Number(a1 ?? 0), years = Number(a2 ?? 30), seed = Number(process.argv[5] ?? 1);
  console.log(`House ${id} of realm ${seed}`);
  watch(years, seed, (s, R) => {
    const b = s.bodies[id];
    if (!b) return;
    for (const r of s.log) if (r.k !== 'make' && r.k !== 'trade' && (r.a === id || r.b === id) && !['born', 'die', 'wed', 'join'].includes(r.k)) console.log(`  y${year(r.t)} w${r.t % 52}: ${R.describe(r)}`);
    for (const r of s.log) if ((r.k === 'born' || r.k === 'die') && r.b === id) console.log(`  y${year(r.t)} w${r.t % 52}: ${r.k === 'born' ? 'a child was born' : `one of the house died, aged ${Math.floor(r.q)}${r.need >= 0 ? ', for want of ' + NEEDS[r.need]!.id : ''}`}`);
    if (s.t % 52 !== 0 || !b.alive) return;
    const cov = cover(b.store, askAhead(s, b));
    const lands = s.bonds.filter(x => x.about === 'land' && x.a === id).map(x => `${x.cell}(${x.strength.toFixed(1)})`).join(' ');
    console.log(`year ${s.t / 52}: ${b.members.length} at cell ${b.home}; weeks of cover: ${NEEDS.map((n, i) => `${n.id} ${Math.min(999, Math.round(cov[i]!))}`).join(', ')}; holds ${lands || 'nothing'}; owes ${s.bonds.filter(x => x.about === 'act' && x.a === id).length}, is owed ${s.bonds.filter(x => x.about === 'act' && x.b === id).length}`);
  });
}

if (cmd === 'cell') {
  const id = Number(a1 ?? 0), years = Number(a2 ?? 30), seed = Number(process.argv[5] ?? 1);
  const days = new Map<number, number>();
  console.log(`Cell ${id} of realm ${seed}`);
  watch(years, seed, s => {
    for (const r of s.log) if ((r.k === 'make' || r.k === 'take') && r.cell === id && r.kind2 >= 0) days.set(r.a, (days.get(r.a) ?? 0) + r.q2);
    if (s.t % 52 !== 26) return;
    const c = s.cells[id]!;
    console.log(`year ${Math.ceil(s.t / 52)}, midsummer: soil ${c.soil.toFixed(2)}; ${STOCKS.map((k, i) => `${k.id} ${Math.round(c.stock[i]!)}`).join(', ')}; held by ${s.bonds.filter(x => x.about === 'land' && x.cell === id).map(x => `house ${x.a}(${x.strength.toFixed(1)})`).join(' ') || 'no one'}; worked this year by ${[...days].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([b, d]) => `house ${b} ${Math.round(d)}d`).join(', ') || 'no one'}; homes here ${s.bodies.filter(b => b.alive && b.home === id).length}`);
    days.clear();
  });
}
