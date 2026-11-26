// Invariants of the toy: determinism, purity, designated chance, conservation of people,
// and the two rules about the rules: no event and no particular row may be named in a process.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { found } from '../sim/found.ts';
import { step } from '../sim/step.ts';
import { choose } from '../sim/processes/choose.ts';
import { CHANNELS, draw } from '../sim/rng.ts';
import { KINDS, NEEDS, RECIPES, STOCKS } from '../sim/tables.ts';
import type { State } from '../sim/types.ts';

const here = new URL('..', import.meta.url).pathname;
const rules = [...readdirSync(join(here, 'sim/processes')).map(f => join(here, 'sim/processes', f)), join(here, 'sim/value.ts'), join(here, 'sim/util.ts'), join(here, 'sim/step.ts')];
const read = (f: string): string => readFileSync(f, 'utf8');

function run(seed: number, weeks: number, each?: (prev: State, next: State) => void): State {
  let s = found(seed);
  for (let w = 0; w < weeks; w++) { const n = step(s); each?.(s, n); s = n; }
  return s;
}

test('determinism: the same seed gives the same state every week', () => {
  const a: string[] = [], b: string[] = [];
  run(7, 120, (_p, n) => a.push(JSON.stringify(n)));
  run(7, 120, (_p, n) => b.push(JSON.stringify(n)));
  a.forEach((x, i) => assert.equal(x, b[i], `week ${i} differs`));
});

test('two seeds give different realms', () => {
  assert.notEqual(JSON.stringify(found(1).cells), JSON.stringify(found(2).cells));
});

test('the step is pure: the state it is given is never touched', () => {
  const s = run(3, 30), before = JSON.stringify(s);
  step(s);
  assert.equal(JSON.stringify(s), before);
});

test('designated chance: nothing draws outside its channel', () => {
  assert.throws(() => draw(1, 'dice' as never, 0, 0));
  assert.deepEqual([...CHANNELS], ['founding', 'weather', 'thresholds', 'abroad']);
  for (const f of [...rules, join(here, 'sim/found.ts')]) {
    const src = read(f);
    assert.ok(!/Math\.random|Date\.now|new Date/.test(src), `${f} reaches for chance or the clock`);
    for (const m of src.matchAll(/draw\(\s*[\w.]+,\s*'(\w+)'/g)) {
      const allowed = f.endsWith('found.ts') ? ['founding'] : f.endsWith('sky.ts') ? ['weather'] : f.endsWith('grow.ts') ? ['thresholds'] : [];
      assert.ok(allowed.includes(m[1]!), `${f} draws from "${m[1]}"`);
    }
  }
});

test('no event in the rules: the processes never name a situation', () => {
  const words = /\b(famine|riot|feud|price|market|custom|crime|faction|law|theft|thief|war|hoard|harvest|household|parish|village|guild)s?\b/i;
  for (const f of rules) {
    const hit = read(f).match(words);
    assert.ok(!hit, `${f} names "${hit?.[0]}"`);
  }
});

test('no kind in the rules: no process refers to a particular row of any table', () => {
  const names = [...NEEDS, ...KINDS, ...STOCKS, ...RECIPES].map(r => r.id);
  for (const f of rules) {
    const src = read(f);
    for (const n of names) assert.ok(!new RegExp(`\\b${n}\\b`).test(src), `${f} names the row "${n}"`);
  }
});

test('people are conserved, and nothing held is negative or not a number', () => {
  run(11, 260, (p, n) => {
    const alive = (s: State): number => s.people.filter(x => x.alive).length;
    const born = n.log.filter(r => r.k === 'born').length, died = n.log.filter(r => r.k === 'die').length;
    assert.equal(alive(n), alive(p) + born - died, `week ${n.t}`);
    for (const b of n.bodies) for (const q of b.store) assert.ok(Number.isFinite(q) && q >= 0, `store in week ${n.t}`);
    for (const c of n.cells) for (const q of c.stock) assert.ok(Number.isFinite(q) && q >= 0, `land in week ${n.t}`);
    for (const x of n.people) if (x.alive) assert.ok(n.bodies[x.body]!.alive && n.bodies[x.body]!.members.includes(x.id), `person ${x.id} has no hearth in week ${n.t}`);
  });
});

test('dealings move matter and never make or lose it', () => {
  // Trade, gift, loan and taking all happen inside choose, and choose does nothing else to a store.
  const total = (s: State): number => s.bodies.reduce((x, b) => x + b.store.reduce((y, q) => y + q, 0), 0);
  let s = found(13), dealt = 0;
  for (let w = 0; w < 150; w++) {
    s = step(s);
    const c = structuredClone(s);
    c.log = [];
    const before = total(c);
    choose(c);
    dealt += c.log.filter(r => ['trade', 'give', 'promise', 'take'].includes(r.k)).length;
    assert.ok(Math.abs(total(c) - before) < 1e-6 * before, `week ${s.t}`);
  }
  assert.ok(dealt > 0);
});

test('the sky is the same whatever the people do', () => {
  const a = run(5, 60), b = found(5);
  b.people.forEach(p => { p.scruple = 0.2; });
  let s = b;
  for (let w = 0; w < 60; w++) s = step(s);
  assert.deepEqual(a.sky.temp, s.sky.temp);
});
