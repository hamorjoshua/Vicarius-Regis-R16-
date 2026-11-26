// The week. Every week runs the same phases in the same order: causes always come before their effects,
// and the same seed with the same rulings always gives the same realm.

import { clamp } from './math.ts';
import { P } from './params.ts';
import { REAL, type Chance } from './rng.ts';
import { cause, event, fadeLedger, topCause } from './ledger.ts';
import type { Ruling, State } from './types.ts';
import { sky } from './systems/sky.ts';
import { land } from './systems/land.ts';
import { labour, production } from './systems/crops.ts';
import { duties } from './systems/duties.ts';
import { markets } from './systems/markets.ts';
import { people } from './systems/people.ts';
import { health } from './systems/health.ts';
import { security } from './systems/security.ts';
import { readouts, society } from './systems/society.ts';
import { mind } from './systems/mind.ts';
import { bindings, rule } from './court/rulings.ts';
import { formPetitions } from './court/petitions.ts';

export interface StepOpts { chance?: Chance; court?: boolean; endless?: boolean }

interface System { step: number; name: string; reads: string[]; writes: string[]; lag?: string[] }

/** What each system reads and writes, in the week's fixed order. */
export const PIPELINE: System[] = [
  { step: 5, name: 'hearings', reads: ['docket'], writes: ['stocks', 'bindings', 'laws', 'ties', 'grievance'], lag: ['docket'] },
  { step: 7, name: 'sky', reads: [], writes: ['sky'] },
  { step: 8, name: 'land', reads: ['sky'], writes: ['river', 'works', 'stocks'] },
  { step: 9, name: 'labour', reads: ['sickness', 'stocks'], writes: ['labour'], lag: ['sickness'] },
  { step: 10, name: 'production', reads: ['sky', 'labour', 'river'], writes: ['crops', 'herds', 'stocks'] },
  { step: 11, name: 'obligations', reads: ['labour', 'stocks', 'grievance', 'pressure', 'prices'], writes: ['duties', 'works', 'purse', 'stocks'], lag: ['pressure', 'prices'] },
  { step: 12, name: 'markets', reads: ['stocks', 'works', 'laws', 'hoard', 'unrest', 'bandits'], writes: ['prices', 'stocks', 'wages', 'debts'], lag: ['hoard', 'unrest', 'bandits'] },
  { step: 13, name: 'consumption', reads: ['stocks'], writes: ['nourishment', 'people', 'stocks'] },
  { step: 14, name: 'health', reads: ['nourishment', 'works', 'sky', 'people'], writes: ['sickness', 'people'] },
  { step: 15, name: 'security', reads: ['nourishment', 'duties', 'works', 'pressure'], writes: ['readiness', 'bandits', 'stocks'], lag: ['pressure'] },
  { step: 16, name: 'society', reads: ['stocks', 'prices', 'wages', 'nourishment', 'duties', 'sickness'], writes: ['pressure', 'grievance', 'unrest', 'people', 'docket'] },
  { step: 17, name: 'mind', reads: ['sky', 'prices', 'people', 'unrest', 'crops'], writes: ['devotion', 'superstition', 'rumour', 'hoard', 'memory'] },
  { step: 18, name: 'dusk', reads: ['bindings', 'grievance', 'pressure'], writes: ['bindings', 'standing', 'ledger'] },
];

/** At start-up: a system may read something written later in the week only through a declared lag. */
export function checkPipeline(): void {
  const written = new Set<string>(['docket']);
  for (const sys of PIPELINE) {
    for (const r of sys.reads) if (!written.has(r) && !(sys.lag ?? []).includes(r)) throw new Error(`${sys.name} reads "${r}" before it is written, with no declared lag`);
    for (const w of sys.writes) written.add(w);
  }
}
checkPipeline();

function clone(prev: State): State {
  const { record, ...rest } = prev;
  const s = structuredClone(rest) as State;
  s.record = record.length > 8000 ? record.slice(3000) : record.slice();
  return s;
}

/** One week. Pure and deterministic: the previous state is never touched. */
export function advance(prev: State, rulings: Ruling[], opts: StepOpts = {}): State {
  if (prev.over) return prev;
  const ch = opts.chance ?? REAL, court = opts.court !== false;
  const s = clone(prev);
  for (const h of s.holders) h.got = 0;
  s.flows = { coinIn: 0, coinOut: 0 };

  // B. The hearings: up to three, or a fourth at a cost in standing.
  const ruled: string[] = [];
  if (court) {
    const heard = rulings.slice(0, P.hearings + 1);
    if (heard.length > P.hearings) { s.standing -= P.extraHearingCost; cause(s, 'standing', 'a fourth hearing', -P.extraHearingCost); }
    for (const r of heard) {
      const p = s.docket.find(x => x.id === r.petition);
      if (!p || ruled.includes(p.id) || !p.options[r.option]) continue;
      rule(s, p, r.option);
      ruled.push(p.id);
    }
  }

  // C. The week passes.
  sky(prev, s, ch);
  land(prev, s);
  labour(prev, s);
  production(prev, s);
  duties(prev, s);
  markets(prev, s, ch);
  people(prev, s);
  health(prev, s, ch);
  security(prev, s, ch);
  society(prev, s, court);
  if (court) formPetitions(s, ruled);
  mind(prev, s);

  // D. Dusk.
  bindings(s);
  readouts(s);
  if (court) {
    let breached = false, worstG = 0;
    for (let i = 0; i < 18; i++) {
      worstG = Math.max(worstG, s.grievance[i]!);
      if (s.grievance[i]! >= P.breachLine) {
        const why = topCause(s, `grievance.${i}`);
        s.standing -= P.breachCost; s.breaches++; breached = true;
        s.grievance[i] = P.breachReset;
        cause(s, 'standing', 'breach of confidence', -P.breachCost);
        event(s, 'breach', Math.floor(i / 6), { c: i, why: why ? why.k : 'hardship' });
      }
    }
    if (!breached && worstG < P.calmLine && s.standing < P.standingMax) { s.standing = Math.min(P.standingMax, s.standing + P.standingRecover); cause(s, 'standing', 'a quiet week', P.standingRecover); }
    s.standing = clamp(s.standing, 0, P.standingMax);
    if (s.standing < 0.25) s.standing = 0;
  }
  fadeLedger(s, P.ledgerKeep);
  s.t = prev.t + 1;
  if (court && !opts.endless) {
    if (s.standing <= 0) { s.over = 'fallen'; s.record.push({ t: prev.t, k: 'fallen', r: -1, d: {} }); }
    else if (s.t >= P.reignWeeks) { s.over = 'kept'; s.record.push({ t: prev.t, k: 'kingreturns', r: -1, d: { standing: s.standing } }); }
  }
  return s;
}
