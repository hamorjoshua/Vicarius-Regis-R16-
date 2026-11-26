// The harness. Machines test the realm before any player does.
//   node harness/run.ts courts [reigns] [seed]     scripted courts
//   node harness/run.ts emergence [reigns] [seed]  emergence checks
//   node harness/run.ts chronicle [years] [seed]   what happened, in plain sentences
//   node harness/run.ts petitions [seed]           the petitions of a reign, composed
//   node harness/run.ts sweep [reigns] [all]       sensitivity: each parameter 20% up and down
//   node harness/run.ts stable [years]             fifty years with no shocks

import { found, refound } from '../sim/found.ts';
import { advance } from '../sim/step.ts';
import { petitions } from '../sim/court/petitions.ts';
import { EXPECTED } from '../sim/rng.ts';
import { P, P0 } from '../sim/params.ts';
import { REGIONS, souls, weekOf, type State } from '../sim/types.ts';
import { COURTS, play } from './courts.ts';
import { CHECKS, learning, recovered } from './emergence.ts';
import { eventLine, eventWeight, optionLabel, payerLabel, plea, title } from '../flavour/compose.ts';

const [cmd = 'courts', a1, a2] = process.argv.slice(2);
const pop = (s: State): number => s.holders.reduce((a, h) => a + souls(h), 0);
const pad = (x: string | number, n: number): string => String(x).padEnd(n);
const pct = (x: number, n: number): string => `${Math.round((100 * x) / Math.max(1, n))}%`;

function courts(reigns: number, seed0: number, names: string[]): Record<string, { kept: number; weeks: number; breaches: number; lost: number; standing: number }> {
  const out: Record<string, { kept: number; weeks: number; breaches: number; lost: number; standing: number }> = {};
  for (const name of names) {
    const slow = name === 'careful' || name === 'greedy';
    const n = slow ? Math.max(4, Math.round(reigns / 5)) : reigns;
    const r = { kept: 0, weeks: 0, breaches: 0, lost: 0, standing: 0 };
    for (let i = 0; i < n; i++) {
      const s0 = found(seed0 + i), res = play(s0, COURTS[name]!(seed0 + i));
      r.kept += res.kept ? 1 : 0; r.weeks += res.weeks; r.breaches += res.final.breaches; r.standing += res.final.standing;
      r.lost += 1 - pop(res.final) / pop(s0);
    }
    out[name] = { kept: r.kept / n, weeks: r.weeks / n, breaches: r.breaches / n, lost: r.lost / n, standing: r.standing / n };
    console.log(`${pad(name, 8)} reigns ${pad(n, 4)} kept ${pad(pct(r.kept, n), 5)} mean weeks ${pad((r.weeks / n).toFixed(1), 5)} breaches ${pad((r.breaches / n).toFixed(2), 5)} souls lost ${pad(pct(r.lost, n), 4)} standing at close ${(r.standing / n).toFixed(1)}`);
  }
  return out;
}

if (cmd === 'courts') {
  const t0 = Date.now();
  console.log('Scripted courts. The careful court must keep the realm clearly more often than the null court.\n');
  const res = courts(+(a1 ?? 100), +(a2 ?? 1), ['null', 'naive', 'random', 'greedy', 'careful']);
  const gap = res.careful!.kept - res.null!.kept;
  console.log(`\ncareful - null = ${Math.round(gap * 100)} points ${gap > 0.15 ? '(the player\'s choices matter)' : '(TOO CLOSE: choices do not matter enough)'}   [${((Date.now() - t0) / 1000).toFixed(0)}s]`);
} else if (cmd === 'emergence') {
  const reigns = +(a1 ?? 200), seed0 = +(a2 ?? 1);
  const hits = CHECKS.map(() => 0);
  let crisis = 0, rec = 0, early = 0, late = 0;
  for (let i = 0; i < reigns; i++) {
    const res = play(found(seed0 + i), COURTS.null!(0));
    CHECKS.forEach((c, j) => { if (c.test(res.final.record, res.final)) hits[j] = hits[j]! + 1; });
    const r = recovered(res.final.record); crisis += r.crisis ? 1 : 0; rec += r.recovered ? 1 : 0;
  }
  const L = Math.max(10, Math.round(reigns / 4));
  let other = 0;
  for (let i = 0; i < L; i++) { const l = learning(play(found(seed0 + i), COURTS.steady!(0)).asks); early += l.early; late += l.late; other += learning(play(found(seed0 + i), COURTS.stingy!(0)).asks).late; }
  console.log(`Emergence over ${reigns} reigns under the null court (targets are starting points):\n`);
  CHECKS.forEach((c, j) => {
    const p = (100 * hits[j]!) / reigns;
    console.log(`${p === 0 ? 'NEVER ' : p >= 100 ? 'ALWAYS' : p < c.lo ? 'low   ' : p > c.hi ? 'high  ' : 'ok    '} ${pad(c.name, 24)} ${pad(p.toFixed(0) + '%', 5)} target ${pad(`${c.lo}-${c.hi}%`, 8)} ${c.chain}`);
  });
  console.log(`\nRecovery: of ${crisis} reigns with a crisis, ${pct(rec, crisis)} saw ten quiet weeks before the close.`);
  console.log(`Learning: after week 20, ${Math.round((100 * late) / L)}% of asks name the Crown as payer under a court that grants only what the Crown pays for, against ${Math.round((100 * other) / L)}% under a court that never spends the Crown's own. ${late > other * 1.1 ? 'Petitions follow what the court grants.' : 'NO CLEAR LEARNING.'}`);
} else if (cmd === 'chronicle') {
  const years = +(a1 ?? 10);
  let s = found(+(a2 ?? 1));
  console.log(`A chronicle of ${years} years with no court, seed ${s.seed}.\n`);
  for (let i = 0; i < 52 * years; i++) {
    const before = s.record.length;
    s = advance(s, [], { court: false, endless: true });
    const fresh = s.record.slice(before).filter(e => eventWeight(e) >= 4);
    for (const e of fresh) console.log(`Year ${Math.floor(e.t / 52) + 1}, week ${pad(weekOf(e.t), 2)}  ${eventLine(s, e)}`);
    if (i % 52 === 51) console.log(`  -- close of year ${i / 52 + 0.02 | 0 + 1}: ${[0, 1, 2].map(r => `${REGIONS[r]} ${Math.round(s.holders.reduce((a, h) => a + (h.region === r ? souls(h) : 0), 0))}`).join(', ')} souls; corn ${s.regions.map(R => (R.price * 6).toFixed(0) + 'd').join('/')} a bushel\n`);
  }
} else if (cmd === 'petitions') {
  let s = found(+(a1 ?? 1));
  const court = COURTS.naive!(0);
  let shown = 0;
  while (!s.over && shown < 40) {
    const a = petitions(s);
    for (const p of a.slice(0, 3)) {
      console.log(`\n[week ${weekOf(s.t)}] ${title(s, p)}   (${p.motive}; pressure ${p.pressure.toFixed(1)}${p.waited ? `; waited ${p.waited}` : ''})`);
      console.log(`  "${plea(s, p)}"`);
      p.options.forEach((o, i) => console.log(`   ${i === 0 ? 'ASK' : i < p.options.length - 1 ? 'ALT' : 'DENY'} ${optionLabel(s, p, o)}  [${o.means}/${o.payer}: ${payerLabel(s, o)}]`));
      shown++;
    }
    s = advance(s, court(s, a));
  }
} else if (cmd === 'stable') {
  const years = +(a1 ?? 50);
  let s = found(1);
  const p0 = pop(s);
  for (let i = 0; i < 52 * years; i++) s = advance(s, [], { chance: EXPECTED, court: false, endless: true });
  const p1 = pop(s);
  console.log(`With no shocks, ${years} years: souls ${Math.round(p0)} -> ${Math.round(p1)} (${((p1 / p0 - 1) * 100).toFixed(1)}%). ${Math.abs(p1 / p0 - 1) < 0.2 ? 'Stable.' : 'NOT STABLE.'}`);
} else if (cmd === 'sweep') {
  const reigns = +(a1 ?? 6);
  const KEY = ['yield0', 'priceElastic', 'priceLocal', 'reserveExtra', 'cartCost', 'cartSlope', 'spoil', 'deathHunger', 'hungerLine', 'sigmaT', 'sigmaR', 'skyPersist', 'frostScale', 'blightRate', 'leveeCap', 'workDecay', 'workRepair',
    'grievanceHard', 'grievanceHunger', 'grievanceKeep', 'unheardGrievance', 'breachLine', 'uHunger', 'uBread', 'unrestKeep', 'raidOdds', 'pestOdds', 'beta', 'paySoldier', 'duesLand', 'duesHearth', 'toll', 'wage0', 'clothExport', 'spendRate', 'leak',
    'hoardHide', 'rumourTrend', 'migrateRate', 'acresPerSoul', 'rentShare', 'titheShare', 'pantry', 'askWeeks', 'coverHorizon'];
  const names = a2 === 'all' ? Object.keys(P0).filter(k => typeof (P0 as unknown as Record<string, unknown>)[k] !== 'object' || Array.isArray((P0 as unknown as Record<string, unknown>)[k])) : KEY;
  const scale = (v: unknown, k: number): unknown => (typeof v === 'number' ? v * k : Array.isArray(v) ? v.map(x => scale(x, k)) : v);
  const table = P as unknown as Record<string, unknown>, orig = P0 as unknown as Record<string, unknown>;
  const measure = (): { kept: number; lost: number } => {
    refound();
    let kept = 0, lost = 0;
    for (let i = 0; i < reigns; i++) { const s0 = found(100 + i), r = play(s0, COURTS.null!(0)); kept += r.kept ? 1 : 0; lost += 1 - pop(r.final) / pop(s0); }
    return { kept: kept / reigns, lost: lost / reigns };
  };
  const base = measure();
  console.log(`Sensitivity: each parameter moved 20% down and up; ${reigns} reigns under the null court. Baseline kept ${Math.round(base.kept * 100)}%, souls lost ${Math.round(base.lost * 100)}%.\n`);
  const rows: { name: string; lo: { kept: number; lost: number }; hi: { kept: number; lost: number }; swing: number }[] = [];
  for (const name of names) {
    if (['reignWeeks', 'warmupWeeks', 'historyWeeks', 'hearings', 'seats', 'ensemble', 'souls', 'cropMix', 'ladyDay', 'midsummer', 'michaelmas', 'christmas', 'standingMax'].includes(name) || /Start$|End$|Week$|Mid$|martinmas|winterEnd/.test(name)) continue;
    table[name] = scale(structuredClone(orig[name]), 0.8); const lo = measure();
    table[name] = scale(structuredClone(orig[name]), 1.2); const hi = measure();
    table[name] = structuredClone(orig[name]);
    rows.push({ name, lo, hi, swing: Math.max(Math.abs(lo.kept - base.kept), Math.abs(hi.kept - base.kept)) + Math.max(Math.abs(lo.lost - base.lost), Math.abs(hi.lost - base.lost)) });
  }
  refound();
  rows.sort((x, y) => y.swing - x.swing);
  for (const r of rows.slice(0, 20)) console.log(`${pad(r.name, 18)} -20%: kept ${pad(Math.round(r.lo.kept * 100) + '%', 5)} lost ${pad(Math.round(r.lo.lost * 100) + '%', 5)} +20%: kept ${pad(Math.round(r.hi.kept * 100) + '%', 5)} lost ${pad(Math.round(r.hi.lost * 100) + '%', 5)}${r.lo.lost > 0.5 || r.hi.lost > 0.5 ? '  COLLAPSE' : ''}`);
} else console.log('unknown command');
