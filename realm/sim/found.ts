// The founding: the one draw that makes the starting realm from a seed.
// Households, holdings, kin, traits and the opening weather are drawn here and nowhere else.

import { P } from './params.ts';
import { draw, normal, EXPECTED } from './rng.ts';
import { CAP, CLERIC, COMMONER, HIGH, MERCHANT, NOBLE, OFFICIAL, RIV, SOLDIER, ABROAD, type Crop, type Holder, type House, type Region, type State } from './types.ts';
import { need } from './util.ts';
import { advance } from './step.ts';

const GIVEN = ['Hob', 'Aldous', 'Maud', 'Ysolde', 'Wat', 'Agnes', 'Piers', 'Cecily', 'Gilbert', 'Alys', 'Osric', 'Emma', 'Hugh', 'Joan', 'Rolf', 'Mabel', 'Tobias', 'Edith', 'Simon', 'Beatrix', 'Godric', 'Isolde', 'Ranulf', 'Matilda', 'Jocelin', 'Avice', 'Thurstan', 'Petronilla', 'Walter', 'Sybil', 'Adam', 'Rohese'];
const FAMILY = ['Reeve', 'Crane', 'Ashdown', 'Marsh', 'Thorne', 'Fenwick', 'Holt', 'Blackmere', 'Wray', 'Garth', 'Pell', 'Sedge', 'Corbet', 'Dunmere', 'Harrow', 'Kestrel', 'Lorne', 'Mallory', 'Nettle', 'Orme', 'Penhale', 'Quarry', 'Rook', 'Stane', 'Tolland', 'Underhill', 'Vane', 'Wyke', 'Yarrow', 'Aske', 'Brome', 'Cotter', 'Dray', 'Eldric', 'Farrow', 'Gorse'];

interface Seat { r: number; e: number; role: string; style: string; office?: string; farm?: boolean }
const SEATS: Seat[] = [
  { r: CAP, e: NOBLE, role: 'lord of the council', style: 'Lord' },
  { r: CAP, e: CLERIC, role: 'cathedral almoner', style: 'Almoner', office: 'alms' },
  { r: CAP, e: CLERIC, role: 'canon of the cathedral', style: 'Canon' },
  { r: CAP, e: OFFICIAL, role: 'magistrate', style: 'Magistrate', office: 'collect.0' },
  { r: CAP, e: OFFICIAL, role: 'keeper of the granary', style: 'Keeper', office: 'granary' },
  { r: CAP, e: OFFICIAL, role: 'conduit-master', style: 'Master', office: 'wells' },
  { r: CAP, e: MERCHANT, role: 'corn merchant', style: 'Master' },
  { r: CAP, e: MERCHANT, role: 'clothier', style: 'Master' },
  { r: CAP, e: MERCHANT, role: 'moneylender', style: 'Master' },
  { r: CAP, e: SOLDIER, role: 'captain of the city watch', style: 'Captain', office: 'garrison.0' },
  { r: CAP, e: COMMONER, role: 'weaver', style: '' },
  { r: CAP, e: COMMONER, role: 'baker', style: '' },
  { r: CAP, e: COMMONER, role: 'carter', style: '' },
  { r: HIGH, e: NOBLE, role: 'marcher lord', style: 'Lord' },
  { r: HIGH, e: NOBLE, role: 'laird', style: 'Laird' },
  { r: HIGH, e: CLERIC, role: 'prior', style: 'Prior' },
  { r: HIGH, e: OFFICIAL, role: 'steward of the march', style: 'Steward', office: 'collect.1' },
  { r: HIGH, e: MERCHANT, role: 'wool merchant', style: 'Master' },
  { r: HIGH, e: SOLDIER, role: 'captain of the border', style: 'Captain', office: 'garrison.1' },
  { r: HIGH, e: SOLDIER, role: 'serjeant', style: 'Serjeant' },
  { r: HIGH, e: COMMONER, role: 'shepherd', style: '', farm: true },
  { r: HIGH, e: COMMONER, role: 'crofter', style: '', farm: true },
  { r: HIGH, e: COMMONER, role: 'drover', style: '', farm: true },
  { r: RIV, e: NOBLE, role: 'lord of the manor', style: 'Lord' },
  { r: RIV, e: NOBLE, role: 'knight', style: 'Sir' },
  { r: RIV, e: CLERIC, role: 'rector', style: 'Rector' },
  { r: RIV, e: OFFICIAL, role: 'dike-reeve', style: 'Reeve', office: 'levee' },
  { r: RIV, e: OFFICIAL, role: 'bailiff', style: 'Bailiff', office: 'collect.2' },
  { r: RIV, e: MERCHANT, role: 'corn factor', style: 'Master' },
  { r: RIV, e: MERCHANT, role: 'bargeman', style: 'Master' },
  { r: RIV, e: SOLDIER, role: 'captain of the river-watch', style: 'Captain', office: 'garrison.2' },
  { r: RIV, e: COMMONER, role: 'miller', style: '', farm: true },
  { r: RIV, e: COMMONER, role: 'ploughman', style: '', farm: true },
  { r: RIV, e: COMMONER, role: 'smallholder', style: 'Widow', farm: true },
];

const OFFICES: { id: string; title: string; region: number; power: string }[] = [
  { id: 'alms', title: 'Almoner of the cathedral', region: CAP, power: 'alms' },
  { id: 'collect.0', title: 'Magistrate of the Capital', region: CAP, power: 'collect' },
  { id: 'collect.1', title: 'Steward of the march', region: HIGH, power: 'collect' },
  { id: 'collect.2', title: 'Bailiff of the Riverlands', region: RIV, power: 'collect' },
  { id: 'granary', title: 'Keeper of the granary', region: CAP, power: 'work:granary' },
  { id: 'wells', title: 'Conduit-master', region: CAP, power: 'work:wells.0' },
  { id: 'levee', title: 'Dike-reeve', region: RIV, power: 'work:levee' },
  { id: 'garrison.0', title: 'Captain of the city watch', region: CAP, power: 'garrison' },
  { id: 'garrison.1', title: 'Captain of the border', region: HIGH, power: 'garrison' },
  { id: 'garrison.2', title: 'Captain of the river-watch', region: RIV, power: 'garrison' },
];

function blank(id: string, name: string, region: number, estate: number, people: number): Holder {
  return {
    id, name, region, estate, workers: people * P.workerShare, deps: people * (1 - P.workerShare), n: 1, h: 0.95,
    grain: 0, seed: 0, coin: 0, beasts: 0, hay: 0, wool: 0, acres: [0, 0, 0], sown: [0, 0, 0], herd0: 0,
    rents: 0, livings: 0, trade: 0, income: 0, got: 0, short: 0, arrears: 0, duesOwed: 0, remit: 0,
    cover: 20, pressure: 0, threats: 0, woes: {}, remT: -99, petT: -99,
    lab: { avail: 0, field: 0, duty: 0, craft: 0, fr: 1 }, hs: null,
  };
}

/** Give a holder what its estate lives on, scaled by its people. */
function endow(h: Holder, r: number, e: number, people: number, farm: boolean): void {
  if (e === COMMONER && (farm || h.hs === null)) {
    const per = P.acresPerSoul[r]!;
    h.acres = [people * per * P.cropMix[r]![0]!, people * per * P.cropMix[r]![1]!, people * per * P.cropMix[r]![2]!];
    h.beasts = people * P.beastsPerSoul[r]!;
    h.herd0 = h.beasts;
    h.sown = [h.acres[0]!, 0, 0];
    h.seed = (h.acres[1]! * P.yield0[1]! + h.acres[2]! * P.yield0[2]!) * P.seedShare;
    h.hay = (h.beasts * P.hayPerBeast * 8) / 21;
  }
  if (e === NOBLE) { h.rents = people; h.beasts = people * P.beastsPerSoul[r]! * 2; h.herd0 = h.beasts; h.hay = (h.beasts * P.hayPerBeast * 8) / 21; }
  if (e === CLERIC) h.livings = people;
  if (e === MERCHANT) h.trade = people;
  const nd = need(h);
  const weeks = e === COMMONER ? (r === CAP ? 3 : 32) : e === NOBLE || e === CLERIC ? 60 : e === MERCHANT ? (r === CAP ? 70 : 20) : 6;
  h.grain = nd * weeks;
  h.coin = nd * P.grainPrice * (e === COMMONER ? 9 : e === MERCHANT ? 80 : e === NOBLE ? 80 : e === CLERIC ? 40 : 14);
  h.income = nd * P.grainPrice * 1.4;
}

function crop(): Crop { return { sown: 0, g: 0, gbar: 0, frost: 0, blight: 0, flood: 0, frostWeek: 0, harv: 0, lostLabour: 0, fert: 1, last: 1, outlook: 1 }; }

function region(r: number): Region {
  return {
    sky: { aT: 0, aR: 0, temp: 5, rain: P.rainMean[r]!, moist: 1, snow: 0, runoff: P.rainMean[r]!, tmin: 0, tBar: 5, rBar: P.rainMean[r]! },
    crops: [crop(), crop(), crop()],
    barn: 0, larder: 0, scarce: 1, demand: 0, price: P.grainPrice, priceRef: P.grainPrice, trend: 0, wage: P.wage0, wageRef: P.wage0, stock: 0, custom: 0,
    hoard: 0, unrest: 0, stage: 0, watch: 1, devotion: 0.55, superstition: 0.15,
    rumour: { scarcity: 0, sickness: 0, raid: 0 },
    disease: [0, 1, 2, 3].map(() => ({ I: 0, R: 0, out: false, dead: 0 })), sick: 0, deaths: 0, deathsExp: 0, hungry: 0,
    readiness: 0.9, bandits: 2, patrol: -1, foul: 0, blame: -1,
    souls0: P.souls[r]!.reduce((a, b) => a + b, 0), craftIdx: 1, almsSeen: 0, riotT: -99, inquestT: -99, hospital: -1, signT: -99, sign: '', moved: 0,
  };
}

/** Wipe what a reign begins without: grievance, memory of the court, the record. */
function reset(s: State): void {
  s.standing = P.standingMax; s.breaches = 0; s.over = '';
  s.grievance = s.grievance.map(() => 0); s.regard = s.regard.map(() => 0); s.unheard = s.unheard.map(() => 0);
  s.accord = s.accord.map(row => row.map(() => 0));
  s.expect = s.expect.map(() => ({}));
  s.docket = []; s.bindings = []; s.laws = []; s.rules = {}; s.ledger = {}; s.record = []; s.cool = {};
  for (const R of s.regions) { R.unrest = 0; R.stage = 0; R.riotT = -99; R.blame = -1; R.moved = 0; R.signT = -99; R.sign = ''; R.superstition = 0.15; R.hoard = 0; R.rumour = { scarcity: 0, sickness: 0, raid: 0 }; R.bandits = Math.min(R.bandits, 3); for (const d of R.disease) { d.out = false; d.dead = 0; } }
  for (const h of s.holders) { h.woes = {}; h.remT = -99; h.petT = -99; h.arrears = 0; h.duesOwed = 0; if (h.hs) { h.hs.regard = 0; h.hs.memory = []; h.hs.hazard = 0; h.hs.sick = false; h.hs.charge = 0; } }
}

let BASE: State | null = null;
let BASE_REF: { p: number[]; w: number[] } = { p: [], w: [] };

/** The realm before any seed touches it: cohorts and seats, settled under expected weather. Built once. */
function base(): State {
  if (BASE) return BASE;
  const holders: Holder[] = [];
  for (let r = 0; r < 3; r++) for (let e = 0; e < 6; e++) {
    const names = ['nobles', 'clergy', 'officials', 'merchants', 'garrison', 'commons'];
    const h = blank(`c${r}${e}`, `the ${names[e]} of the ${['Capital', 'Highlands', 'Riverlands'][r]}`, r, e, P.souls[r]![e]!);
    endow(h, r, e, P.souls[r]![e]!, true);
    holders.push(h);
  }
  // The barns as they stand in late winter: last harvest's surplus, still mostly in the country.
  const lay = (r: number, e: number, amt: number): void => { holders[r * 6 + e]!.grain += amt; };
  lay(RIV, NOBLE, 70000); lay(RIV, CLERIC, 28000); lay(RIV, COMMONER, 60000); lay(CAP, NOBLE, 12000); lay(CAP, CLERIC, 12000); lay(HIGH, NOBLE, 8000);
  SEATS.forEach((seat, i) => {
    const people = seat.e === NOBLE ? 30 : seat.e === MERCHANT ? 8 : seat.e === CLERIC ? 5 : 6;
    const h = blank(`h${i}`, '', seat.r, seat.e, people);
    endow(h, seat.r, seat.e, people * (seat.e === NOBLE ? 1 : seat.e === MERCHANT ? 3 : 1.4), !!seat.farm);
    h.hs = { head: '', line: [''], gen: 0, role: seat.role, style: seat.style, thrift: 0.5, piety: 0.5, temper: 0.5, ambition: 0.5,
      constitution: 9, hazard: 0, sick: false, office: seat.office ?? null, regard: 0, esteem: 0, memory: [], kin: [], gaveUp: -99, charge: 0, lastRemedy: '', lastHeard: -99 };
    holders.push(h);
  });

  const regions = [0, 1, 2].map(region);
  for (let r = 0; r < 3; r++) {
    const R = regions[r]!;
    R.crops[0]!.sown = holders.reduce((a, h) => a + (h.region === r ? h.sown[0]! : 0), 0);
    R.disease.forEach((d, i) => { d.I = i === 2 ? 0 : P.reservoir * R.souls0; });
    R.larder = holders.reduce((a, h) => a + (h.region === r ? h.herd0 * 0.27 * P.meatPerBeast : 0), 0);
  }
  // The customary barn: a normal year's grain as it comes to rest in each region.
  const net = [0, 1, 2].map(r => holders.reduce((a, h) => a + (h.region === r ? (h.acres[0]! * P.yield0[0]! + h.acres[1]! * P.yield0[1]! + h.acres[2]! * P.yield0[2]!) * (1 - P.seedShare) : 0), 0));
  regions[CAP]!.barn = net[CAP]!;
  for (const r of [HIGH, RIV]) {
    const w = (f: 'rents' | 'livings', reg: number): number => holders.reduce((a, h) => a + (h.region === reg ? h[f] : 0), 0);
    const awayRent = (w('rents', CAP) * P.absentee) / (w('rents', CAP) * P.absentee + w('rents', r));
    const awayTithe = (w('livings', CAP) * P.absentee * 0.5) / (w('livings', CAP) * P.absentee * 0.5 + w('livings', r));
    const away = net[r]! * (P.rentShare * awayRent + P.titheShare * awayTithe);
    regions[CAP]!.barn += away * 0.75;
    regions[r]!.barn = net[r]! * (1 - P.crownShare) - away;
  }

  const s: State = {
    v: 1, seed: 0, t: -P.warmupWeeks - P.historyWeeks, over: '', standing: P.standingMax, purse: P.purse0, granary: P.granary0, breaches: 0,
    abroad: { grain: P.abroadGrain, cloth: 1, sickness: 1 },
    regions, holders,
    works: [
      { id: 'levee', kind: 'levee', region: RIV, cond: 0.85, funded: 0, levy: -999, name: 'the river levee' },
      { id: 'wall.0', kind: 'wall', region: CAP, cond: 0.85, funded: 0, levy: -999, name: 'the city wall' },
      { id: 'wall.1', kind: 'wall', region: HIGH, cond: 0.85, funded: 0, levy: -999, name: 'the border wall' },
      { id: 'granary', kind: 'granary', region: CAP, cond: 0.85, funded: 0, levy: -999, name: "the Crown's granary" },
      { id: 'wells.0', kind: 'wells', region: CAP, cond: 0.85, funded: 0, levy: -999, name: 'the city conduits' },
      { id: 'wells.1', kind: 'wells', region: HIGH, cond: 0.85, funded: 0, levy: -999, name: 'the upland wells' },
      { id: 'wells.2', kind: 'wells', region: RIV, cond: 0.85, funded: 0, levy: -999, name: 'the river wells' },
      { id: 'road.cr', kind: 'road', region: RIV, cond: 0.85, funded: 0, levy: -999, name: 'the river road' },
      { id: 'road.ch', kind: 'road', region: HIGH, cond: 0.85, funded: 0, levy: -999, name: 'the north road' },
      { id: 'road.hr', kind: 'road', region: HIGH, cond: 0.85, funded: 0, levy: -999, name: 'the drove road' },
      { id: 'port', kind: 'road', region: CAP, cond: 0.9, funded: 0, levy: -999, name: 'the quays' },
    ],
    routes: [
      { id: 'cr', a: RIV, b: CAP, work: 'road.cr', cap: P.routeCap[0]!, flow: 0, risk: 0 },
      { id: 'ch', a: HIGH, b: CAP, work: 'road.ch', cap: P.routeCap[1]!, flow: 0, risk: 0 },
      { id: 'hr', a: RIV, b: HIGH, work: 'road.hr', cap: P.routeCap[2]!, flow: 0, risk: 0 },
      { id: 'sea', a: CAP, b: ABROAD, work: 'port', cap: P.routeCap[3]!, flow: 0, risk: 0 },
    ],
    duties: [0, 1, 2].flatMap(r => (['provisioning', 'relief', 'works', 'watch', 'tithe', 'dues'] as const).map(kind => ({ id: `${kind}.${r}`, kind, region: r, required: 0, delivered: 0, provision: 1, mod: {}, excuse: {} }))),
    debts: [], bindings: [], ties: [],
    offices: OFFICES.map(o => ({ ...o, holder: holders.find(h => h.hs && h.hs.office === o.id)?.id ?? null, skim: 0 })),
    laws: [], rules: {},
    grievance: new Array(18).fill(0), regard: new Array(18).fill(0), unheard: new Array(18).fill(0),
    accord: [0, 1, 2, 3, 4, 5].map(() => new Array(6).fill(0)),
    expect: [0, 1, 2, 3, 4, 5].map(() => ({})),
    docket: [], river: { level: 1, flood: 0 }, ledger: {}, record: [], nextId: 1, cool: {},
    flows: { coinIn: 0, coinOut: 0 },
  };
  let cur = s;
  const pSum = [0, 0, 0], wSum = [0, 0, 0];
  for (let i = 0; i < P.warmupWeeks; i++) {
    cur = advance(cur, [], { chance: EXPECTED, court: false, endless: true });
    for (const x of cur.works) x.cond = 0.85;
    if (i >= P.warmupWeeks - 52) for (let r = 0; r < 3; r++) { pSum[r] = pSum[r]! + cur.regions[r]!.price; wSum[r] = wSum[r]! + cur.regions[r]!.wage; }
  }
  BASE_REF = { p: pSum.map(x => x / 52), w: wSum.map(x => x / 52) };
  // Settling moves people about; the reign begins with each cohort at its founding strength, as well found as it settled.
  for (let r = 0; r < 3; r++) for (let e = 0; e < 6; e++) {
    const h = cur.holders[r * 6 + e]!, k = P.souls[r]![e]! / (h.workers + h.deps);
    h.workers = P.souls[r]![e]! * P.workerShare; h.deps = P.souls[r]![e]! * (1 - P.workerShare);
    h.grain *= k; h.coin *= k; h.seed *= k; h.n = 1; h.h = 0.95; h.arrears = 0;
    for (let c = 0; c < 3; c++) { h.acres[c] = h.acres[c]! * (e === 5 ? k : 1); h.sown[c] = h.sown[c]! * (e === 5 ? k : 1); }
  }
  for (let r = 0; r < 3; r++) {
    const R = cur.regions[r]!;
    R.souls0 = cur.holders.reduce((a, h) => a + (h.region === r ? h.workers + h.deps : 0), 0);
    R.bandits = 2; R.readiness = 0.9; R.unrest = 0; R.stage = 0;
    for (let c = 0; c < 3; c++) R.crops[c]!.sown = cur.holders.reduce((a, h) => a + (h.region === r ? h.sown[c]! : 0), 0);
    R.disease.forEach((d, i) => { d.I = i === 2 ? 0 : P.reservoir * R.souls0; d.R = 0; d.out = false; });
  }
  cur.grievance = cur.grievance.map(() => 0);
  for (let r = 0; r < 3; r++) { cur.regions[r]!.priceRef = BASE_REF.p[r]!; cur.regions[r]!.wageRef = BASE_REF.w[r]!; }
  cur.record = []; cur.ledger = {};
  BASE = cur;
  return cur;
}

/** Forget the settled base, so a sweep that changes the parameter table founds afresh. */
export function refound(): void { BASE = null; }

export function found(seed: number): State {
  let k = 0;
  const u = (): number => draw(seed, 'founding', 0, 0, k++);
  let cur = structuredClone(base());
  cur.seed = seed;
  cur.purse = P.purse0; cur.granary = P.granary0;

  // The households: names, traits, kin and fortune.
  const houses = cur.holders.filter(h => h.hs);
  const usedF = new Set<number>();
  houses.forEach((h, i) => {
    const hs = h.hs!;
    let f = Math.floor(u() * FAMILY.length);
    while (usedF.has(f)) f = (f + 1) % FAMILY.length;
    usedF.add(f);
    h.name = FAMILY[f]!;
    hs.line = [0, 1, 2, 3].map(() => GIVEN[Math.floor(u() * GIVEN.length)]!);
    hs.head = hs.line[0]!;
    hs.thrift = u(); hs.piety = u(); hs.temper = u(); hs.ambition = u();
    hs.constitution = 0.5 + draw(seed, 'constitution', 18 + i, 0);
    hs.esteem = u() * 1.5 + (hs.office ? 0.5 : 0);
    // Fortune at the founding: some houses begin well found, some thin; some have many mouths.
    const luck = 0.35 + 0.95 * u(), purse = 0.15 + 1.1 * u(), mouths = u();
    h.grain *= luck; h.seed *= Math.min(1, luck + 0.2); h.coin *= purse;
    for (let c = 0; c < 3; c++) { h.acres[c] = h.acres[c]! * luck; h.sown[c] = h.sown[c]! * luck; }
    h.beasts *= luck; h.herd0 *= luck; h.hay *= luck; h.trade *= 0.6 + 0.8 * u(); h.rents *= luck; h.livings *= luck;
    if (h.estate !== NOBLE) h.deps += Math.floor(mouths * 6);
  });
  for (let i = 0; i < 7; i++) {
    const a = houses[Math.floor(u() * houses.length)]!, b = houses[Math.floor(u() * houses.length)]!;
    if (a.id !== b.id && !a.hs!.kin.includes(b.id) && a.hs!.kin.length < 2 && b.hs!.kin.length < 2) { a.hs!.kin.push(b.id); b.hs!.kin.push(a.id); }
  }
  // The works as the last regent left them.
  for (const x of cur.works) x.cond = 0.5 + 0.45 * u();
  // The opening weather of the year before the reign.
  for (let r = 0; r < 3; r++) { cur.regions[r]!.sky.aT = 1.2 * normal(u()); cur.regions[r]!.sky.aR = 1.2 * normal(u()); }

  // The year before the reign, lived under its real weather: the realm the regent inherits has a history.
  const pSum = [0, 0, 0], wSum = [0, 0, 0];
  for (let i = 0; i < P.historyWeeks; i++) {
    cur = advance(cur, [], { court: false, endless: true });
    for (let r = 0; r < 3; r++) { pSum[r] = pSum[r]! + cur.regions[r]!.price; wSum[r] = wSum[r]! + cur.regions[r]!.wage; }
  }
  const history = cur.record.filter(e => ['harvest', 'flood', 'outbreak', 'draw', 'famine', 'riot'].includes(e.k));
  reset(cur);
  cur.record = history;
  for (let r = 0; r < 3; r++) {
    const R = cur.regions[r]!;
    // What people take for usual: mostly the custom of calm years, coloured by the year just lived.
    if (P.historyWeeks > 0) {
      R.priceRef = 0.7 * BASE_REF.p[r]! + 0.3 * (pSum[r]! / P.historyWeeks);
      R.wageRef = 0.7 * BASE_REF.w[r]! + 0.3 * (wSum[r]! / P.historyWeeks);
    }
    R.deathsExp = Math.max(R.deathsExp, 0.5);
  }
  cur.purse = P.purse0; cur.granary = Math.min(cur.granary, P.granary0 * 1.5);
  for (const o of cur.offices) if (!o.holder) {
    const seat = cur.holders.find(h => h.hs && h.hs.role === SEATS.find(x => x.office === o.id)!.role);
    if (seat && seat.hs) { o.holder = seat.id; seat.hs.office = o.id; }
  }
  // Old debts.
  const hs2 = cur.holders.filter(h => h.hs);
  for (let i = 0; i < 12; i++) {
    const d = hs2[Math.floor(u() * hs2.length)]!;
    const lenders = hs2.filter(h => h.id !== d.id && (h.estate === MERCHANT || h.estate === CLERIC || h.estate === NOBLE));
    const c = lenders[Math.floor(u() * lenders.length)]!;
    const amt = Math.round(need(d) * P.grainPrice * (6 + 10 * u())), q = Math.floor(u() * 3);
    if (cur.debts.some(x => x.debtor === d.id) || d.estate === NOBLE) continue;
    cur.debts.push({ id: `d${cur.nextId++}`, debtor: d.id, creditor: c.id, principal: amt, rate: P.loanRate, due: [P.ladyDay, P.midsummer, P.michaelmas][q]! - 1, security: d.beasts > 3 ? 'beasts' : d.acres[0]! + d.acres[1]! + d.acres[2]! > 5 ? 'land' : 'none', rolled: 0 });
  }
  return cur;
}
