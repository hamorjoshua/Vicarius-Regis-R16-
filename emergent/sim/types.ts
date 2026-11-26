// The state: flat tables of what exists. Stage 1 has land, matter (held in bodies' stores), people,
// bonds and bodies. Beliefs and practices arrive with minds.

export interface Cell {
  high: number;
  soil: number; soil0: number;
  wet: number;
  water: number;
  /** The water that ran through this week, what the channel carries before it floods, and how far over it ran. */
  flow: number; bank: number; flood: number;
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
  sound: number; scruple: number; temper: number; spacing: number; credulous: number;
  /** How the house stood when this person was born. */
  omen: number;
  bore: number;
  /** The record of the last blow taken, and when. */
  blow: number; blowAt: number;
  /** How far each need was met last week. */
  fed: number[];
  /** A mind: what this person believes brings harm, the ways of dealing they know, and how good they are at each kind of work. */
  lore: Record<string, number>;
  ways: Record<string, { w: number; p: number }>;
  skill: number[];
  /** How much they believe a unit put onto the land returns, for each thing that can be sown. */
  hope: number[];
}

export interface Work { r: number; cell: number; days: number }

export interface Body {
  id: number;
  home: number;
  store: number[];
  members: number[];
  /** A body may be made of bodies, and may belong to one. */
  parts: number[];
  of: number;
  alive: boolean;
  since: number;
  /** What its members will do next week, and where it means to go. */
  plan: Work[];
  spent: number;
  goto: number;
  /** For each need, the record that last cut its cover. */
  why: number[];
  /** The ways of dealing it knows: for each, how well it has served and the share it is used to conceding. */
  ways: Record<string, { w: number; p: number }>;
  /** Weeks it has wanted something and found no way to get it. */
  stuck: number;
  /** It has more to gather than hands to gather it: work owed to it is called in. */
  pressed: boolean;
  /** What it believes brings harm, and how strongly; and what it has lately met with. */
  lore: Record<string, number>;
  recent: [string, number][];
  /** How good its grown members are, together, at each kind of work. */
  skill: number[];
  /** A plan held over weeks: to make enough of a thing another wants, so as to get from them what it lacks. */
  /** What its speaker believes the land returns; and what it has put on and brought in since midwinter. */
  hope: number[]; put: number[]; got: number[];
  aim: { kind: number; q: number; for: number; worth: number; since: number; want: string } | null;
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
  /** The way of dealing it came from. */
  way: string;
  /** For a debt that came of a taking: the body that truly did it, whoever it was laid to. */
  doer: number;
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
  /** For a dealing: what was given for what. */
  way?: string;
}

export interface Wrong { by: number; to: number; kind: number; q: number; rec: number; doer: number }

/** A matter before the court: who brings it, against whom, about which bond or want, and why it climbed this far. */
export interface Petition { id: number; t: number; by: number; against: number; bond: number; need: number; rec: number; shape: string; side: 'owed' | 'owes' | 'outside' | 'bare'; reason: 'none' | 'clash' | 'challenge'; speaksFor: number; waited: number; urgency: number }
/** A rule: a bond that binds every member of a body, or the whole realm (scope -1). */
export interface Rule { id: number; scope: number; shape: string; cut: string; since: number; uses: number }
export interface Court { standing: number; docket: Petition[]; rules: Rule[]; grief: Record<number, number>; seen: Record<string, number>; next: number; quiet: number }
export interface Use { body: number; cell: number; days: number }

export interface State {
  seed: number;
  t: number;
  side: number;
  cells: Cell[];
  people: Person[];
  bodies: Body[];
  bonds: Bond[];
  /** Regard: `ties[a][b]` is how body a holds body b. */
  ties: Record<number, Record<number, number>>;
  sky: { aT: number[]; aR: number[]; temp: number[]; rain: number[] };
  wrongs: Wrong[];
  /** The court, when there is one. */
  court?: Court;
  uses: Use[];
  /** This week's records only. */
  log: Rec[];
  nrec: number;
  nbond: number;
}

export const weekOf = (t: number): number => ((t % 52) + 52) % 52;
export const ageOf = (s: State, born: number): number => (s.t - born) / 52;
