// Everything that exists is data. These tables are the only place where a particular need,
// kind of matter, living thing or way of making is named. No process may refer to a row by name.

export const YEAR = 52;

// --- Needs: what a person must have, and how much its lack harms ---
// The design's list also has health, safety, company, standing, security in what one holds and the
// hope of salvation. Nothing made can serve those; they wait for bonds on bonds, bodies and beliefs.

export interface NeedRow {
  id: string;
  /** Person-weeks wanted each week, before cold. */
  per: number;
  /** More wanted for each degree the week is colder than `P.chillFrom`. */
  cold: number;
  /** Wear a week of going wholly without adds, as a share of `P.hurt`. */
  harm: number;
  /** Weeks of cover a person would like to hold. */
  horizon: number;
}

export const NEEDS: NeedRow[] = [
  { id: 'food', per: 1, cold: 0, harm: 1, horizon: 60 },
  { id: 'flesh', per: 0.12, cold: 0, harm: 0.1, horizon: 8 },
  { id: 'warmth', per: 0, cold: 0.07, harm: 0.5, horizon: 30 },
  { id: 'dress', per: 1, cold: 0, harm: 0.15, horizon: 60 },
  { id: 'roof', per: 1, cold: 0, harm: 0.25, horizon: 300 },
  { id: 'savour', per: 0.04, cold: 0, harm: 0.08, horizon: 20 },
  { id: 'drink', per: 0.5, cold: 0, harm: 0.1, horizon: 10 },
  { id: 'repose', per: 1, cold: 0, harm: 0.2, horizon: 2 },
];

// --- Matter: every kind is a row of the same shape ---

export interface KindRow {
  id: string;
  /** Person-weeks of each need one unit meets in a week of use. */
  serves?: Record<string, number>;
  /** Share of a unit lost by a week of use (1: used up; small: worn a little). */
  use: number;
  /** Share lost each week just by keeping it. */
  keep: number;
  /** Effort to carry one unit one cell. */
  weight: number;
  /** Cannot be carried at all. */
  fixed?: boolean;
  /** Work it helps, and by how much it multiplies a day of it. */
  aids?: Record<string, number>;
}

export const KINDS: KindRow[] = [
  { id: 'grain', serves: { food: 1 }, use: 1, keep: 0.004, weight: 1 },
  { id: 'meat', serves: { food: 1, flesh: 1 }, use: 1, keep: 0.25, weight: 1 },
  { id: 'haul', serves: { food: 0.8, flesh: 1 }, use: 1, keep: 0.35, weight: 1 },
  { id: 'cured', serves: { food: 1, flesh: 1 }, use: 1, keep: 0.01, weight: 1 },
  { id: 'timber', serves: { warmth: 1 }, use: 1, keep: 0.002, weight: 2 },
  { id: 'fleece', use: 1, keep: 0.004, weight: 0.5 },
  { id: 'cloth', serves: { dress: 1 }, use: 0.02, keep: 0.002, weight: 0.5 },
  { id: 'ore', use: 1, keep: 0, weight: 3 },
  { id: 'blade', use: 0.012, keep: 0.001, weight: 1, aids: { cut: 1.6 } },
  { id: 'coulter', use: 0.012, keep: 0.001, weight: 4, aids: { till: 1.8 } },
  { id: 'brine', serves: { savour: 1 }, use: 1, keep: 0.002, weight: 1 },
  { id: 'ale', serves: { drink: 1 }, use: 1, keep: 0.05, weight: 1.5 },
  { id: 'leisure', serves: { repose: 1 }, use: 1, keep: 1, weight: 999, fixed: true },
  { id: 'hall', serves: { roof: 6 }, use: 0.004, keep: 0.002, weight: 999, fixed: true },
];

// --- What lives or lies on the land ---

export interface StockRow {
  id: string;
  /** The most a cell of full potential can bear. */
  cap: number;
  /** Weekly growth at low density, while the week is warm enough. */
  r: number;
  /** Grows at or above `lo`; below `kill`, withers by `frost` a week; in between, it waits. */
  lo: number;
  kill: number;
  frost: number;
  /** Comes back by itself from nothing, this much a week. */
  self: number;
  /** Capacity rises with soil to this power (0: indifferent to soil). */
  soil: number;
  /** Capacity follows the cell's moisture. */
  wet?: boolean;
  /** Soil it takes for each unit grown. */
  drain: number;
  /** What it feeds on, units a week for each unit of itself, and how fast it dies unfed. */
  eats?: Record<string, number>;
  starve?: number;
  /** The level at which a day's taking yields half its full rate. */
  thin: number;
  /** Where it is found at the founding: weights on low ground, high ground and open water; `rare` cells only. */
  lies: { base: number; low: number; high: number; water: number; rare?: number };
  /** How full the founding leaves it. */
  start: number;
}

export const STOCKS: StockRow[] = [
  { id: 'sward', cap: 320, r: 0.25, lo: 5, kill: 1, frost: 0.03, self: 2, soil: 0.5, wet: true, drain: 0, thin: 60, lies: { base: 1, low: 0, high: 0, water: 0 }, start: 0.6 },
  { id: 'grove', cap: 1600, r: 0.02, lo: 5, kill: -99, frost: 0, self: 0.6, soil: 0.3, drain: 0, thin: 300, lies: { base: 0.1, low: 0, high: 1.1, water: 0 }, start: 0.7 },
  { id: 'corn', cap: 1000, r: 0.2, lo: 6, kill: 1.5, frost: 0.3, self: 0, soil: 1.5, wet: true, drain: 0.00012, thin: 250, lies: { base: 0.15, low: 1, high: 0, water: 0 }, start: 0 },
  { id: 'herd', cap: 0, r: 0.012, lo: -99, kill: -99, frost: 0, self: 0.05, soil: 0, drain: 0, eats: { sward: 0.5 }, starve: 0.06, thin: 6, lies: { base: 1, low: 0, high: 0, water: 0 }, start: 12 },
  { id: 'shoal', cap: 260, r: 0.08, lo: -99, kill: -99, frost: 0, self: 1, soil: 0, drain: 0, thin: 70, lies: { base: 0, low: 0, high: 0, water: 1 }, start: 0.7 },
  { id: 'vein', cap: 4000, r: 0, lo: -99, kill: -99, frost: 0, self: 0, soil: 0, drain: 0, thin: 200, lies: { base: 0, low: 0, high: 1, water: 0, rare: 3 }, start: 1 },
  { id: 'seep', cap: 40, r: 0, lo: -99, kill: -99, frost: 0, self: 2, soil: 0, drain: 0, thin: 10, lies: { base: 1, low: 0, high: 0, water: 0, rare: 2 }, start: 1 },
];

// --- Ways of making: what a day of work turns into what ---

export interface RecipeRow {
  id: string;
  /** Taken from the land, units a day at full richness. */
  from?: Record<string, number>;
  /** Taken from the store, units a day. */
  in?: Record<string, number>;
  /** Put into the store, units a day. */
  out?: Record<string, number>;
  /** Put onto the land, units a day. */
  to?: Record<string, number>;
  /** The help that multiplies it. */
  aid?: string;
}

export const RECIPES: RecipeRow[] = [
  { id: 'sowing', in: { grain: 3 }, to: { corn: 3 }, aid: 'till' },
  { id: 'reaping', from: { corn: 12 }, out: { grain: 12 }, aid: 'cut' },
  { id: 'culling', from: { herd: 1 }, out: { meat: 3, fleece: 1 }, aid: 'cut' },
  { id: 'netting', from: { shoal: 5 }, out: { haul: 5 } },
  { id: 'felling', from: { grove: 6 }, out: { timber: 6 }, aid: 'cut' },
  { id: 'digging', from: { vein: 2 }, out: { ore: 2 } },
  { id: 'panning', from: { seep: 2 }, out: { brine: 2 } },
  { id: 'forging', in: { ore: 1, timber: 2 }, out: { blade: 0.34 } },
  { id: 'wrighting', in: { ore: 1, timber: 3 }, out: { coulter: 0.25 } },
  { id: 'weaving', in: { fleece: 1 }, out: { cloth: 1 } },
  { id: 'salting', in: { meat: 3, brine: 0.3 }, out: { cured: 3 } },
  { id: 'smoking', in: { haul: 4, brine: 0.3 }, out: { cured: 3 } },
  { id: 'brewing', in: { grain: 2 }, out: { ale: 3 } },
  { id: 'resting', out: { leisure: 1 } },
  { id: 'raising', in: { timber: 3 }, out: { hall: 0.06 } },
];

// --- Constants ---

export const P = {
  side: 10,
  souls: 200,

  // The sky
  tMean: 9.5, tAmp: 8, hotWeek: 28, upland: 3,
  rainMean: 14, rainSeason: 0.2, wetWeek: 46,
  skyPersist: 0.8, skyRealm: 0.6, skyQuarter: 0.4, skyCell: 0.2, sigmaT: 2, sigmaR: 0.42,
  wetKeep: 0.8, downhill: 0.15, soilMend: 0.012,

  // A body's week
  days: 6, block: 2, reach: 2, travel: 0.15, dealReach: 4, carry: 0.004,
  chillFrom: 12,
  /** Take at most this share of what stands on a cell in a week. */
  glean: 0.9,

  // A person
  hurt: 0.1, heal: 0.1,
  age0: 0.01, ageFrom: 60, ageRate: 8, infant: 0.05, infantSpan: 26,
  workFrom: 7, workFull: 16, workWane: 55, workEnd: 80,
  eatLeast: 0.4, eatFull: 14,
  wedHe: 18, wedShe: 16, bearTo: 42, fertile: 6, spacing: 130, hearth: 7,
  sound: 1, soundSpread: 0.18,

  // Choosing
  /** Worth today of something that will only be had later. */
  later: 0.7,
  /** Growing weeks at the end of the season that nobody counts on. */
  prudence: 4,
  /** How strongly a holder waits for what is still growing. */
  wait: 20,
  /** A day's work must be worth at least this, or the day is rested. */
  rest: 0.002,
  /** Weeks of cover under which a body asks, and under which it will take. */
  short: 6, dire: 1.5,
  inputShare: 0.5, aidDays: 40, pile: 12,
  /** A swap must better both rates of exchange by this much. */
  edge: 1.15, part: 0.3,

  // Bonds
  kin: 0.5,
  claim: 0.05, lapse: 0.012, held: 0.05,
  premium: 0.25, term: 40, trust: 0.85,
  warm: 0.04, fade: 0.995, barAt: -0.6,
  blow: 0.12,
  /** The regard at which those who deal together become a body, how many it takes, and the share of plenty each puts in common. */
  band: 0.15, bandOf: 3, common: 0.03,
  /** A lease: the share of what is gathered that goes to whoever let the ground, how long it runs, and how long ground lies unused before it is let. */
  rent: 0.33, lease: 104, idle: 40, plots: 2,
  /** Days owed for goods, as a multiple of the days it takes to make them. */
  hire: 1.5,
  stay: 1.6, scout: 4,
};

// --- The tables compiled to indices, so that processes can loop without knowing a name ---

export interface Kind { id: string; serves: number[]; use: number; keep: number; weight: number; fixed: boolean; aids: Record<string, number> }
export interface Stock extends Omit<StockRow, 'eats'> { eats: [number, number][]; sown: boolean; reap: number; needs: number[] }
export interface Recipe { id: string; from: [number, number][]; inp: [number, number][]; out: [number, number][]; to: [number, number][]; aid: string | null }

const index = (rows: { id: string }[], what: string) => (id: string): number => {
  const i = rows.findIndex(r => r.id === id);
  if (i < 0) throw new Error(`no ${what} called "${id}"`);
  return i;
};
const need = index(NEEDS, 'need'), kind = index(KINDS, 'kind'), stock = index(STOCKS, 'stock');
const pairs = (o: Record<string, number> | undefined, f: (id: string) => number): [number, number][] => Object.entries(o ?? {}).map(([k, v]) => [f(k), v]);

export const NN = NEEDS.length, NK = KINDS.length, NS = STOCKS.length;

export const Kn: Kind[] = KINDS.map(k => {
  const serves = NEEDS.map(() => 0);
  for (const [n, v] of pairs(k.serves, need)) serves[n] = v;
  return { id: k.id, serves, use: k.use, keep: k.keep, weight: k.weight, fixed: !!k.fixed, aids: k.aids ?? {} };
});

export const Rc: Recipe[] = RECIPES.map(r => ({ id: r.id, from: pairs(r.from, stock), inp: pairs(r.in, kind), out: pairs(r.out, kind), to: pairs(r.to, stock), aid: r.aid ?? null }));

export const St: Stock[] = STOCKS.map((s, i) => {
  const reap = Rc.findIndex(r => r.from.some(([k]) => k === i));
  const needs = NEEDS.map((_, n) => n).filter(n => reap >= 0 && Rc[reap]!.out.some(([k]) => Kn[k]!.serves[n]! > 0));
  return { ...s, eats: pairs(s.eats, stock), sown: Rc.some(r => r.to.some(([k]) => k === i)), reap, needs };
});
/** The kinds that give each help. */
export const AIDERS: Record<string, number[]> = {};
Kn.forEach((k, i) => { for (const a of Object.keys(k.aids)) (AIDERS[a] ??= []).push(i); });

/** For each need, the kinds that serve it, the quickest to spoil first. */
export const SERVING: number[][] = NEEDS.map((_, n) => Kn.map((_k, i) => i).filter(i => Kn[i]!.serves[n]! > 0).sort((a, b) => Kn[b]!.keep - Kn[a]!.keep));
/** Needs, the most harmful first. */
export const BY_HARM: number[] = NEEDS.map((_, n) => n).sort((a, b) => NEEDS[b]!.harm - NEEDS[a]!.harm);

/** The days of work one unit of each kind takes to make, at the full rate. */
export const TOIL: number[] = Kn.map((_k, i) => {
  let best = Infinity;
  for (const r of Rc) for (const [k, q] of r.out) if (k === i && q > 0) best = Math.min(best, 1 / q);
  return best === Infinity ? 1 : best;
});
