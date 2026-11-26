// The state: flat tables of what exists. Stage 1 has land, matter (held in bodies' stores), people,
// bonds and bodies. Beliefs and practices arrive with minds.

export interface Cell {
  high: number;
  soil: number; soil0: number;
  wet: number;
  water: number;
  /** How well this cell can bear each living or lying thing. */
  pot: number[];
  stock: number[];
}

export interface Person {
  id: number;
  born: number;
  sex: number;
  body: number;
  mother: number; father: number; spouse: number;
  alive: boolean;
  wear: number;
  /** Thresholds, fixed at birth. */
  sound: number; scruple: number; temper: number; spacing: number;
  bore: number;
  /** The record of the last blow taken, and when. */
  blow: number; blowAt: number;
  /** How far each need was met last week. */
  fed: number[];
}

export interface Work { r: number; cell: number; days: number }

export interface Body {
  id: number;
  home: number;
  store: number[];
  members: number[];
  alive: boolean;
  since: number;
  /** What its members will do next week, and where it means to go. */
  plan: Work[];
  spent: number;
  goto: number;
  /** For each need, the record that last cut its cover. */
  why: number[];
}

export type Basis = 'birth' | 'word' | 'use' | 'grant' | 'wrong';

/** Something that holds between parties about an object: a person, land, an act still owed, or another bond. */
export interface Bond {
  id: number;
  about: 'person' | 'land' | 'act' | 'bond';
  /** person: a and b are people. land: a is the body that holds. act: a owes b.
   *  bond: a has a right in the bond `on`: its use for a share (a lease), or the bond itself should the debt `secures` be broken (a pledge). */
  a: number; b: number;
  cell: number;
  kind: number; q: number; due: number;
  /** What is owed is days of work, not matter. */
  labour: boolean;
  on: number; share: number; secures: number;
  /** When the right was last used. */
  used: number;
  basis: Basis;
  strength: number;
  since: number;
  broken: boolean;
  /** The record that made or last touched it. */
  rec: number;
}

/** One elementary happening. `k` is always the name of an act or a process, never of a situation. */
export interface Rec {
  id: number; t: number; k: string;
  a: number; b: number;
  cell: number;
  kind: number; q: number;
  kind2: number; q2: number;
  need: number;
  /** The record that led to this one, or -1. */
  cause: number;
}

export interface Wrong { by: number; to: number; kind: number; q: number; rec: number }
export interface Use { body: number; cell: number; days: number }

export interface State {
  seed: number;
  t: number;
  side: number;
  cells: Cell[];
  people: Person[];
  bodies: Body[];
  bonds: Bond[];
  /** Regard: `ties["a:b"]` is how body a holds body b. */
  ties: Record<string, number>;
  sky: { aT: number[]; aR: number[]; temp: number[]; rain: number[] };
  wrongs: Wrong[];
  uses: Use[];
  /** This week's records only. */
  log: Rec[];
  nrec: number;
  nbond: number;
}

export const weekOf = (t: number): number => ((t % 52) + 52) % 52;
export const ageOf = (s: State, born: number): number => (s.t - born) / 52;
