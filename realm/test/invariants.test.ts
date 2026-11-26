// Invariants: determinism, conservation, designated chance and bounds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { found } from '../sim/found.ts';
import { advance, checkPipeline } from '../sim/step.ts';
import { petitions } from '../sim/court/petitions.ts';
import { forecast } from '../sim/forecast.ts';
import { explain } from '../sim/ledger.ts';
import { CHANNELS, draw, EXPECTED } from '../sim/rng.ts';
import { cos, exp, ln, pow } from '../sim/math.ts';
import type { Ruling, State } from '../sim/types.ts';
import { COURTS } from '../harness/courts.ts';
import { eventLine, optionLabel, plea, title } from '../flavour/compose.ts';

const hash = (s: State): string => JSON.stringify(s);

function reign(seed: number, court: string, each?: (prev: State, next: State, rulings: Ruling[]) => void): State {
  let s = found(seed);
  const c = COURTS[court]!(seed);
  while (!s.over) { const r = c(s, petitions(s)); const n = advance(s, r); each?.(s, n, r); s = n; }
  return s;
}

test('the project\'s own maths agree with the platform\'s', () => {
  for (const x of [-5, -0.3, 0, 0.7, 1, 2.5, 9]) assert.ok(Math.abs(exp(x) - Math.exp(x)) < 1e-9 * Math.exp(x) + 1e-12);
  for (const x of [0.01, 0.5, 1, 1.7, 40, 9000]) assert.ok(Math.abs(ln(x) - Math.log(x)) < 1e-10);
  for (const x of [-7, -1, 0, 0.4, 3.1, 12]) assert.ok(Math.abs(cos(x) - Math.cos(x)) < 1e-9);
  assert.ok(Math.abs(pow(1.3, 2.2) - Math.pow(1.3, 2.2)) < 1e-9);
});

test('the pipeline declares every read before it is written, or as a lag', () => { checkPipeline(); });

test('determinism: the same seed and rulings give the same state every week', () => {
  const a: string[] = [], b: string[] = [];
  reign(11, 'naive', (_p, n) => a.push(hash(n)));
  reign(11, 'naive', (_p, n) => b.push(hash(n)));
  assert.equal(a.length, b.length);
  a.forEach((x, i) => assert.equal(x, b[i], `week ${i} differs`));
});

test('the step is pure: the previous state is never touched', () => {
  const s = found(5), before = hash(s);
  const r = COURTS.naive!(5)(s, petitions(s));
  advance(s, r); forecast(s, r[0] ?? { petition: 'none', option: 0 }, 3); explain(s, 'price.0');
  assert.equal(hash(s), before);
});

test('a replay from a seed and its rulings is exact', () => {
  const given: Ruling[][] = [];
  const end = reign(23, 'random', (_p, _n, r) => given.push(r));
  let s = found(23);
  for (const r of given) s = advance(s, r);
  assert.equal(hash(s), hash(end));
});

test('the sky is the same in every future of a seed, whatever the court rules', () => {
  const skies = (court: string): string[] => { const out: string[] = []; reign(31, court, (_p, n) => out.push(JSON.stringify(n.regions.map(R => [R.sky.temp, R.sky.rain])))); return out; };
  const a = skies('null'), b = skies('naive');
  for (let i = 0; i < Math.min(a.length, b.length); i++) assert.equal(a[i], b[i], `the weather of week ${i} depended on the court`);
});

test('conservation: coin appears or vanishes only through trade abroad', () => {
  const coin = (s: State): number => s.holders.reduce((a, h) => a + h.coin, 0) + s.purse;
  for (const court of ['null', 'naive', 'random']) {
    reign(7, court, (p, n) => {
      const d = coin(n) - coin(p), flow = n.flows.coinIn - n.flows.coinOut;
      assert.ok(Math.abs(d - flow) < 1e-6 * Math.max(1, coin(p)), `week ${p.t} under the ${court} court: coin changed by ${d.toFixed(3)} but ${flow.toFixed(3)} crossed the border`);
    });
  }
});

test('bounds: no negative stocks, every ratio in range, no number lost', () => {
  const walk = (o: unknown, path: string): void => {
    if (typeof o === 'number') { assert.ok(Number.isFinite(o), `${path} is not a number`); return; }
    if (o && typeof o === 'object') for (const k of Object.keys(o)) if (k !== 'record') walk((o as Record<string, unknown>)[k], `${path}.${k}`);
  };
  for (const seed of [3, 8]) for (const court of ['null', 'naive']) {
    reign(seed, court, (_p, s) => {
      walk(s, 's');
      const unit = (v: number, what: string): void => assert.ok(v >= -1e-9 && v <= 1 + 1e-9, `${what} = ${v} in week ${s.t}`);
      for (const h of s.holders) {
        assert.ok(h.grain >= -1e-6, `${h.id} holds ${h.grain} grain`);
        assert.ok(h.seed >= -1e-6 && h.beasts >= -1e-6 && h.hay >= -1e-6 && h.workers >= 0 && h.deps >= -1e-6, `${h.id} has a negative stock`);
        unit(h.n, `${h.id} nourishment`); unit(h.h, `${h.id} health`);
        assert.ok(h.pressure >= 0 && h.pressure <= 8, `${h.id} pressure ${h.pressure}`);
      }
      for (const w of s.works) unit(w.cond, w.id);
      for (const d of s.duties) unit(d.provision, d.id);
      for (const R of s.regions) { unit(R.devotion, 'devotion'); unit(R.superstition, 'superstition'); unit(R.readiness, 'readiness'); unit(R.hoard, 'hoard'); assert.ok(R.price > 0 && R.bandits >= 0 && R.unrest >= 0); }
      for (const g of s.grievance) assert.ok(g >= 0 && g <= 4);
      assert.ok(s.granary >= -1e-6 && s.standing >= 0 && s.standing <= 10);
    });
  }
});

test('designated chance: only the designated draws exist, and nothing else in the realm rolls dice', () => {
  assert.throws(() => draw(1, 'mood' as never, 0, 0));
  const files: string[] = [];
  const scan = (dir: string): void => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) scan(p); else if (p.endsWith('.ts')) files.push(p); } };
  const root = new URL('..', import.meta.url).pathname;
  scan(join(root, 'sim')); scan(join(root, 'flavour'));
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!/Math\.random|Date\.now|new Date/.test(src), `${f} reaches for chance or the clock`);
    for (const m of src.matchAll(/(?:draw|u01|z01)\([^)]*?'(\w+)'/g)) assert.ok((CHANNELS as readonly string[]).includes(m[1]!), `${f} draws on "${m[1]}"`);
  }
});

test('forecasts never show the drawn future', () => {
  let s = found(13);
  for (let i = 0; i < 30; i++) {
    const n = advance(s, [], { chance: EXPECTED });
    assert.ok(!n.record.slice(s.record.length).some(e => e.k === 'draw'), 'a boundary event happened in the expected world');
    s = n;
  }
});

test('every petition and every event can be put into words, and the same state gives the same words', () => {
  reign(17, 'naive', (p) => {
    for (const x of petitions(p)) {
      const a = plea(p, x), t = title(p, x);
      assert.ok(a.length > 20 && t.length > 5 && !/undefined|NaN/.test(a + t), `a plea came out wrong: ${t}: ${a}`);
      assert.equal(a, plea(p, x));
      for (const o of x.options) assert.ok(!/undefined|NaN/.test(optionLabel(p, x, o)), optionLabel(p, x, o));
    }
  });
  const end = reign(19, 'null');
  for (const e of end.record) assert.ok(!/undefined|NaN/.test(eventLine(end, e)), `${e.k}: ${eventLine(end, e)}`);
});
