// The realm's state. Plain serializable JSON: a save, a replay and a test fixture are the same thing.

export const REGIONS = ['Capital', 'Highlands', 'Riverlands'] as const;
export const ESTATES = ['Noble', 'Cleric', 'Official', 'Merchant', 'Soldier', 'Commoner'] as const;
export const CROPS = ['wheat', 'barley', 'oats'] as const;
export const DISEASES = ['fever', 'cough', 'pestilence', 'murrain'] as const;
export const CAP = 0, HIGH = 1, RIV = 2, ABROAD = 3;
export const NOBLE = 0, CLERIC = 1, OFFICIAL = 2, MERCHANT = 3, SOLDIER = 4, COMMONER = 5;
export const WHEAT = 0, BARLEY = 1, OATS = 2;
export const FEVER = 0, COUGH = 1, PEST = 2, MURRAIN = 3;

/** Something that hurt a holder, in rations' worth, fading with time. The composer speaks from these. */
export interface Woe { amt: number; t: number; note: string }

export interface Memory { t: number; k: 'granted' | 'eased' | 'denied' | 'paid' | 'unheard' | 'kept' | 'broken'; amt: number }

/** What only a named household has. */
export interface House {
  head: string; line: string[]; gen: number; role: string; style: string;
  thrift: number; piety: number; temper: number; ambition: number;
  constitution: number; hazard: number; sick: boolean;
  office: string | null; regard: number; esteem: number;
  memory: Memory[]; kin: string[];
  gaveUp: number; charge: number; lastRemedy: string; lastHeard: number;
}

/** A cohort or a named household: anything that holds goods, eats and owes. */
export interface Holder {
  id: string; name: string; region: number; estate: number;
  workers: number; deps: number; n: number; h: number;
  grain: number; seed: number; coin: number; beasts: number; hay: number; wool: number;
  acres: number[]; sown: number[]; herd0: number;
  rents: number; livings: number; trade: number;
  income: number; got: number; short: number; arrears: number; duesOwed: number; remit: number;
  cover: number; pressure: number; threats: number;
  woes: Record<string, Woe>;
  remT: number; petT: number;
  lab: { avail: number; field: number; duty: number; craft: number; fr: number };
  hs: House | null;
}

export interface Sky {
  aT: number; aR: number; temp: number; rain: number; moist: number; snow: number;
  runoff: number; tmin: number; tBar: number; rBar: number;
}

export interface Crop {
  sown: number; g: number; gbar: number; frost: number; blight: number; flood: number;
  frostWeek: number; harv: number; lostLabour: number; fert: number; last: number; outlook: number;
}

export interface Sickness { I: number; R: number; out: boolean; dead: number }

export interface Region {
  sky: Sky; crops: Crop[];
  barn: number; larder: number; scarce: number; demand: number; price: number; priceRef: number; trend: number; wage: number; wageRef: number; stock: number; custom: number;
  hoard: number; unrest: number; stage: number; watch: number;
  devotion: number; superstition: number;
  rumour: { scarcity: number; sickness: number; raid: number };
  disease: Sickness[]; sick: number; deaths: number; deathsExp: number; hungry: number;
  readiness: number; bandits: number; patrol: number; foul: number; blame: number;
  souls0: number; craftIdx: number; almsSeen: number; riotT: number; inquestT: number; hospital: number; signT: number; sign: string; moved: number;
}

export interface Work { id: string; kind: 'levee' | 'road' | 'wall' | 'granary' | 'wells'; region: number; cond: number; funded: number; levy: number; name: string }
export interface Route { id: string; a: number; b: number; work: string; cap: number; flow: number; risk: number }

export type DutyKind = 'provisioning' | 'relief' | 'works' | 'watch' | 'tithe' | 'dues';
export interface Duty {
  id: string; kind: DutyKind; region: number; required: number; delivered: number; provision: number;
  /** A ruling's change to a holder's weight in this duty. */
  mod: Record<string, number>;
  /** Holders excused until a week; `onto` says who carries the share meanwhile. */
  excuse: Record<string, { until: number; onto: string }>;
}

export interface Debt { id: string; debtor: string; creditor: string; principal: number; rate: number; due: number; security: 'beasts' | 'land' | 'none'; rolled: number }

export type Test =
  | { t: 'dutyMet'; duty: string; level: number }
  | { t: 'priceBelow'; region: number; level: number }
  | { t: 'stocksAbove'; holder: string; level: number }
  | { t: 'noRiot'; region: number }
  | { t: 'workAbove'; work: string; level: number }
  | { t: 'notUrgent'; holder: string }
  | { t: 'debtPaid'; debt: string }
  | { t: 'repaid'; holder: string; amt: number }
  | { t: 'heard'; holder: string };

export type BindingKind = 'word' | 'ordinance' | 'compact' | 'pledge' | 'bond' | 'rule' | 'law';
export interface Binding {
  id: string; kind: BindingKind; by: string; to: string; test: Test;
  start: number; end: number;
  /** `weekly`: tested at every dusk and broken the first time it fails. `end`: tested once, at its end. */
  phase: 'weekly' | 'end';
  state: 'open' | 'kept' | 'broken';
  onKept: Effect[]; onBroken: Effect[]; label: string;
}

export type TieKind = 'kin' | 'owes' | 'charge' | 'grudge' | 'esteem' | 'rivalry' | 'alliance';
export interface Tie { kind: TieKind; a: string; b: string; w: number; t: number }

export interface Office { id: string; title: string; region: number; holder: string | null; skim: number; power: string }

export type LawKind = 'assize' | 'exportBan' | 'usuryCap' | 'wageCap' | 'quarantine' | 'toll';
export interface Law { kind: LawKind; region: number; value: number; until: number; since: number }

export type Side = 'letter' | 'mercy' | 'crown' | 'hearth' | 'old' | 'fresh' | 'kin' | 'oath';
export interface Rule { side: Side; count: number; since: number; relied: number[] }

export type Motive = 'relief' | 'protection' | 'redress' | 'need' | 'ambition' | 'faith' | 'sign';
export type Means = 'direct' | 'shift' | 'defer' | 'relate';
export type Payer = 'court' | 'duty' | 'household' | 'peers' | 'estate' | 'nobody';

/** The primitive effects a ruling is a bundle of. */
export type Effect =
  | { op: 'grain'; from: string; to: string; amt: number }
  | { op: 'coin'; from: string; to: string; amt: number }
  | { op: 'sellGranary'; region: number; amt: number }
  | { op: 'remit'; holder: string; frac: number }
  | { op: 'deferDebt'; debt: string; until: number }
  | { op: 'forgiveDebt'; debt: string; frac: number }
  | { op: 'shareDebt'; debt: string; frac: number; peers: string }
  | { op: 'excuse'; duty: string; holder: string; weeks: number; onto: string }
  | { op: 'weight'; duty: string; holder: string; mult: number }
  | { op: 'repair'; work: string; amt: number; cost: number }
  | { op: 'levy'; work: string; region: number; weeks: number }
  | { op: 'law'; kind: LawKind; region: number; value: number; weeks: number }
  | { op: 'repeal'; kind: LawKind; region: number }
  | { op: 'bind'; binding: Omit<Binding, 'id' | 'start' | 'state' | 'end'> & { span: number } }
  | { op: 'tie'; kind: TieKind; a: string; b: string; w: number }
  | { op: 'untie'; kind: TieKind; a: string; b: string }
  | { op: 'appoint'; office: string; to: string }
  | { op: 'inquest'; region: number }
  | { op: 'patrol'; region: number; weeks: number }
  | { op: 'pardon'; region: number }
  | { op: 'procession'; region: number }
  | { op: 'hospital'; region: number; cost: number }
  | { op: 'arrears'; region: number; frac: number }
  | { op: 'grieve'; who: number; amt: number; why: string }
  | { op: 'regard'; holder: string; amt: number }
  | { op: 'standing'; amt: number; why: string };

export interface Option {
  kind: string; means: Means; payer: Payer; payerRef: string;
  effects: Effect[]; holds?: Side; deny?: boolean;
  /** Exact terms for the composer: amounts, dates, names. */
  terms: Record<string, string | number>;
}

export interface CauseRef { kind: string; note: string; amt: number; t: number }

export interface Petition {
  id: string; t0: number; by: string; for: string; region: number; estate: number;
  collective: boolean; keeper: boolean; souls: number;
  motive: Motive; cause: CauseRef; cause2: CauseRef | null;
  options: Option[]; waited: number; urgency: number; word: boolean; pressure: number;
  /** What gave rise to it, so it can be rebuilt each week it waits. */
  src: string;
}

export interface Ruling { petition: string; option: number }

/** One line of the record. The words are composed from `k` and `d`, never stored. */
export interface Event { t: number; k: string; r: number; d: Record<string, string | number> }

/** One of a number's causes of change. */
export interface Cause { k: string; a: number; t: number; x: string }

export interface State {
  v: number; seed: number; t: number; over: '' | 'kept' | 'fallen';
  standing: number; purse: number; granary: number; breaches: number;
  abroad: { grain: number; cloth: number; sickness: number };
  regions: Region[]; holders: Holder[]; works: Work[]; routes: Route[]; duties: Duty[];
  debts: Debt[]; bindings: Binding[]; ties: Tie[]; offices: Office[]; laws: Law[];
  rules: Record<string, Rule>;
  grievance: number[]; regard: number[]; unheard: number[];
  accord: number[][];
  expect: Record<string, { asked: number; granted: number }>[];
  docket: Petition[];
  river: { level: number; flood: number };
  ledger: Record<string, Cause[]>;
  record: Event[];
  nextId: number;
  /** Sources that have lately spoken: key -> the week they may speak again. */
  cool: Record<string, number>;
  /** Money and grain that crossed the border this week, for the conservation check. */
  flows: { coinIn: number; coinOut: number };
}

// ---- small helpers over the state ----

export const weekOf = (t: number): number => (((t % 52) + 52) % 52) + 1;
export const yearOf = (t: number): number => Math.floor(t / 52);
export const souls = (h: Holder): number => h.workers + h.deps;
export const cid = (region: number, estate: number): number => region * 6 + estate;
export const cohortId = (region: number, estate: number): string => `c${region}${estate}`;
export const isCohort = (h: Holder): boolean => h.hs === null;

export function byId(s: State, id: string): Holder | undefined {
  for (let i = 0; i < s.holders.length; i++) if (s.holders[i]!.id === id) return s.holders[i];
  return undefined;
}
export const cohort = (s: State, region: number, estate: number): Holder => s.holders[region * 6 + estate]!;
export const work = (s: State, id: string): Work => s.works.find(w => w.id === id)!;
export const duty = (s: State, id: string): Duty => s.duties.find(d => d.id === id)!;
export const dutyId = (kind: DutyKind, region: number): string => `${kind}.${region}`;
export const inWeeks = (w: number, a: number, b: number): boolean => w >= a && w <= b;

export function lawOf(s: State, kind: LawKind, region: number): Law | undefined {
  for (const l of s.laws) if (l.kind === kind && (l.region === region || l.region < 0) && l.until > s.t) return l;
  return undefined;
}
export function tieOf(s: State, kind: TieKind, a: string, b: string): Tie | undefined {
  for (const x of s.ties) if (x.kind === kind && x.a === a && x.b === b) return x;
  return undefined;
}
