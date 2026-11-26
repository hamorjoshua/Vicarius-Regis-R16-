// Scripted courts. Five ways of sitting in judgment play the same realms for a reign each:
// `node harness/courts.ts [seeds, e.g. 1,2,3] [weeks]`. A reader, like the rest of the harness.

import { inherit } from '../sim/found.ts';
import { advance } from '../sim/step.ts';
import { SIDES, audience, cuts, hear, openCourt, type Ruling, type Width } from '../sim/court/court.ts';
import { askAhead, cover } from '../sim/value.ts';
import { NEEDS, P } from '../sim/tables.ts';
import type { Petition, State } from '../sim/types.ts';

type Script = (s: State, seated: Petition[]) => Ruling[];

/** What a careful court would cut, case by case: it looks at who is in want. */
function judge(s: State, p: Petition): string {
  const c = cuts(s, p);
  if (p.reason === 'challenge') { const r = s.court!.rules.find(x => x.id === p.bond); return r && r.uses > 5 ? 'uphold' : 'strike'; }
  if (c.includes('inquire')) return 'inquire';
  // Relief out of the store only for the dire, and only while the store is not run low; otherwise it is laid on neighbours.
  if (c.includes('levy')) { const b = s.bodies[p.by]!, left = s.court!.store.reduce((x, y) => x + y, 0); return cover(b.store, askAhead(s, b))[p.need]! < P.dire && left > 200 ? 'give' : 'levy'; }
  const pressed = (id: number): boolean => { const b = s.bodies[id]; if (!b || !b.alive) return false; const cov = cover(b.store, askAhead(s, b)); return cov.some((x, n) => NEEDS[n]!.harm >= 0.5 && x < P.short); };
  if (p.side === 'owed') return pressed(p.against) ? 'part' : 'enforce';
  if (p.side === 'owes') return pressed(p.against) ? 'part' : 'stay';
  return 'part';
}
/** What favours whoever asks. */
const grant = (s: State, p: Petition): string => {
  if (p.reason === 'challenge') return 'strike';
  const left = s.court!.store.reduce((x, y) => x + y, 0);
  if (p.bond < 0) return left > 20 ? 'give' : 'promise';
  if (p.side === 'owed') return 'enforce';
  if (p.side === 'owes') return cuts(s, p).includes('redeem') && left > 20 ? 'redeem' : 'strike';
  return 'turn';
};

const COURTS: Record<string, () => Script> = {
  'hears nobody': () => () => [],
  'grants everything': () => (s, seated) => seated.slice(0, P.hearings).map(p => ({ petition: p.id, cut: grant(s, p), width: 'case' as Width })),
  'rules at random': () => (s, seated) => seated.slice(0, P.hearings).map(p => { const c = cuts(s, p); return { petition: p.id, cut: c[(p.id * 7 + s.t) % c.length]!, width: (['case', 'body', 'realm'] as Width[])[(p.id + s.t) % 3]! }; }),
  'this case only': () => (s, seated) => seated.slice(0, P.hearings).map(p => ({ petition: p.id, cut: judge(s, p), width: 'case' as Width })),
  'a rule for the realm each time': () => (s, seated) => seated.slice(0, P.hearings).map(p => { const cut = judge(s, p); return { petition: p.id, cut, width: (cut === 'inquire' ? 'case' : 'realm') as Width }; }),
};

const seeds = (process.argv[2] ?? '1,2,3').split(',').map(Number), weeks = Number(process.argv[3] ?? P.reign);
const rows: Record<string, { kept: number; standing: number; heard: number; arose: number; below: number; repeats: number; top5: number; shapes: number; rules: number; souls: number; sore: number; declined: number; chilled: number; store: number; wordKept: number; wordBroke: number; plea: number[] }> = {};
for (const seed of seeds) {
  const past = process.argv[4] === 'toy' ? inherit(seed, 6, 10, 200) : inherit(seed);
  const t0 = Date.now();
  for (const [name, make] of Object.entries(COURTS)) {
    const s = structuredClone(past), script = make();
    openCourt(s);
    const store0 = s.court!.store.reduce((x, y) => x + y, 0);
    const heardShapes: { t: number; shape: string }[] = [], count = new Map<string, number>();
    let arose = 0, below = 0, repeats = 0, heard = 0, lastId = 0;
    for (let w = 0; w < weeks && s.court!.standing > 0; w++) {
      s.log = [];
      const seated = audience(s);
      arose += s.court!.next - lastId; lastId = s.court!.next;
      const rulings = script(s, seated);
      for (const r of rulings) {
        const p = seated.find(x => x.id === r.petition);
        // An inquest is a step in a hearing, not a hearing of its own.
        if (!p || r.cut === 'inquire') continue;
        heard++;
        if (heardShapes.some(h => h.shape === p.shape && s.t - h.t <= 26)) repeats++;
        heardShapes.push({ t: s.t, shape: p.shape });
        count.set(p.shape, (count.get(p.shape) ?? 0) + 1);
      }
      hear(s, rulings);
      for (const r of s.log) if (r.k === 'rule' && r.kind2 === 1) below++;
      advance(s, true);
    }
    const top5 = [...count.values()].sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
    const row = (rows[name] ??= { kept: 0, standing: 0, heard: 0, arose: 0, below: 0, repeats: 0, top5: 0, shapes: 0, rules: 0, souls: 0, sore: 0, declined: 0, chilled: 0, store: 0, wordKept: 0, wordBroke: 0, plea: [0, 0, 0, 0] });
    const c = s.court!;
    row.kept += c.standing > 0 ? 1 : 0; row.standing += Math.max(0, c.standing); row.heard += heard; row.arose += arose; row.below += below;
    row.repeats += repeats; row.top5 += top5; row.shapes += count.size; row.rules += c.rules.length;
    row.souls += s.people.filter(p => p.alive).length / past.people.filter(p => p.alive).length;
    row.sore += Object.values(c.grief).filter(g => g >= P.aggrieved).length;
    row.declined += c.declined;
    row.chilled += c.chilled;
    row.store += c.store.reduce((x, y) => x + y, 0) / Math.max(1, store0);
    row.wordKept += c.wordsKept; row.wordBroke += c.wordsBroken;
    const hs = s.bodies.filter(b => b.alive && !b.parts.length && b.plea.length);
    SIDES.forEach((_x, k) => { row.plea[k] = row.plea[k]! + hs.reduce((x, b) => x + b.plea[k]!, 0) / Math.max(1, hs.length); });
  }
  console.error(`seed ${seed} done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
const n = seeds.length;
console.log(`Scripted courts over ${n} realms, ${weeks} weeks each\n`);
console.log('| Court | Reigns kept | Standing at end | Matters arising | Heard | Settled below by a rule | Rules at end | Heard matters repeating a shape of the last half year | Five commonest shapes | Shapes heard | People at end, of those at start |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const [name, r] of Object.entries(rows)) console.log(`| ${name} | ${r.kept} of ${n} | ${(r.standing / n).toFixed(1)} | ${Math.round(r.arose / n)} | ${Math.round(r.heard / n)} | ${Math.round(r.below / n)} | ${(r.rules / n).toFixed(1)} | ${r.heard ? Math.round((100 * r.repeats) / r.heard) + '%' : '-'} | ${r.heard ? Math.round((100 * r.top5) / r.heard) + '%' : '-'} | ${(r.shapes / n).toFixed(1)} | ${Math.round((100 * r.souls) / n)}% |`);

console.log('\nWho came, and what houses had come to expect of the court by the end (how likely it is to find for the one who asks):\n');
console.log(`| Court | Crown's store left | The regent's word kept / broken | Dealings the law stood in the way of | Kept their own counsel | ${SIDES.map(x => ({ owed: 'Owed on a bond', owes: 'Bound by a bond', outside: 'Shut out by a bond', bare: 'In bare want' })[x]).join(' | ')} |`);
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const [name, r] of Object.entries(rows)) console.log(`| ${name} | ${Math.round((100 * r.store) / n)}% | ${(r.wordKept / n).toFixed(1)} / ${(r.wordBroke / n).toFixed(1)} | ${Math.round(r.chilled / n)} | ${Math.round(r.declined / n)} | ${r.plea.map(v => (v / n).toFixed(2)).join(' | ')} |`);
