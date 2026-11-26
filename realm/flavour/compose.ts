// Flavour from the machinery. Every word is composed from the causes that produced a petition or an event.
// Clauses are keyed to kinds of cause (frost, price, debt, a duty share), never to a situation.
// The same state always gives the same words.

import { ESTATES, REGIONS, weekOf, type CauseRef, type Effect, type Event, type Holder, type Option, type Petition, type State } from '../sim/types.ts';

const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth'];
const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const ESTATE_PLURAL = ['nobles', 'clergy', 'officials', 'merchants', 'garrison', 'commons'];
const cap = (x: string): string => (x ? x[0]!.toUpperCase() + x.slice(1) : x);

export const ordinal = (n: number): string => ORD[n] ?? (n % 10 === 1 && n !== 11 ? `${n}st` : n % 10 === 2 && n !== 12 ? `${n}nd` : n % 10 === 3 && n !== 13 ? `${n}rd` : `${n}th`);
export const num = (n: number): string => NUM[n] ?? String(n);
const commas = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Grain in the measures people use: a bushel is six rations, a quarter eight bushels. */
export function grain(rations: number): string {
  const bu = rations / 6;
  if (bu < 1.5) return 'a bushel';
  if (bu < 80) return `${commas(bu)} bushels`;
  return `${commas(bu / 8)} quarters`;
}
/** Coin: twelve pence to the shilling, twenty shillings to the pound. */
export function coin(pence: number): string {
  const p = Math.round(pence);
  if (p < 24) return `${p}d`;
  if (p < 480) return `${Math.round(p / 12)} shillings`;
  return `£${commas(p / 240)}`;
}
export const price = (penceRation: number): string => `${Math.round(penceRation * 6)}d a bushel`;
export const weekName = (t: number): string => `the ${ordinal(weekOf(t))} week`;
export const seasonOf = (w: number): string => (w <= 3 ? 'late winter' : w <= 12 ? 'spring' : w <= 24 ? 'summer' : w <= 31 ? 'harvest' : w <= 39 ? 'autumn' : w <= 45 ? 'the fall of the year' : 'winter');

/** How anyone or anything is named. */
export function nameOf(s: State, ref: string, short = false): string {
  if (ref === 'court') return 'the court';
  if (ref === 'purse') return "the Crown's purse";
  if (ref === 'granary') return "the Crown's granary";
  if (ref.startsWith('estate:')) {
    const [e, r] = ref.slice(7).split('@');
    return r === undefined ? `the ${ESTATE_PLURAL[+e!]}` : `the ${ESTATE_PLURAL[+e!]} of the ${REGIONS[+r]}`;
  }
  const h = s.holders.find(x => x.id === ref);
  if (!h) return ref;
  if (!h.hs) return h.name;
  if (short) return h.hs.style ? `${h.hs.style} ${h.name}` : `${h.hs.head} ${h.name}`;
  return h.hs.style ? `${h.hs.style} ${h.hs.head} ${h.name}` : `${h.hs.head} ${h.name} the ${h.hs.role}`;
}
export const roleOf = (h: Holder): string => (h.hs ? h.hs.role : `${ESTATES[h.estate]!.toLowerCase()}s`);

const WORK: Record<string, string> = { levee: 'the river levee', 'wall.0': 'the city wall', 'wall.1': 'the border wall', granary: "the Crown's granary", 'wells.0': 'the city conduits', 'wells.1': 'the upland wells', 'wells.2': 'the river wells', 'road.cr': 'the river road', 'road.ch': 'the north road', 'road.hr': 'the drove road', port: 'the quays' };
export const workName = (id: string): string => WORK[id] ?? id;
const OFFICE: Record<string, string> = { alms: 'almoner of the cathedral', 'collect.0': 'magistrate of the Capital', 'collect.1': 'steward of the march', 'collect.2': 'bailiff of the Riverlands', granary: 'keeper of the granary', wells: 'conduit-master', levee: 'dike-reeve', 'garrison.0': 'captain of the city watch', 'garrison.1': 'captain of the border', 'garrison.2': 'captain of the river-watch' };
export const officeName = (id: string): string => OFFICE[id] ?? id;
const DUTY: Record<string, string> = { provisioning: 'the provisioning of the garrison', relief: 'the relief of the poor', works: 'labour on the works', watch: 'the watch', tithe: 'the tithe', dues: "the Crown's dues" };
export const dutyName = (kind: string): string => DUTY[kind] ?? kind;
export const lawName = (kind: string): string => ({ assize: 'an assize of bread', exportBan: 'a ban on carting grain away', usuryCap: 'a cap on usury', wageCap: 'a cap on wages', quarantine: 'a quarantine', toll: 'a toll' } as Record<string, string>)[kind] ?? kind;
export const MAXIM: Record<string, string> = { letter: 'The bond binds in full', mercy: 'Mercy tempers the bond', crown: 'The realm before the hearth', hearth: 'The hearth before the realm', old: 'The older right stands', fresh: 'Old rights yield to new', kin: 'Kin need not accuse kin', oath: 'The oath before kin' };
export const MAXIM_MEANING: Record<string, string> = {
  letter: 'What a house owes under a bond or a duty, it owes in full and on time, whatever its hardship.',
  mercy: 'A house in hardship may be given time or relief; a debt need not be pressed to the last.',
  crown: "When the realm's need and a household's good conflict, the realm's need prevails.",
  hearth: "When the realm's need and a household's good conflict, the household is protected.",
  old: 'A long-held right or custom keeps its place against newer claims.',
  fresh: 'A long-held right may give way to a newer or rising claim.',
  kin: 'No house is made to bear witness against a house it is married to.',
  oath: 'A witness must speak under oath, even against its own kin by marriage.',
};

// ---- clauses, keyed by kind of cause ----

/** What happened, told by someone it happened to. Region and trade colour the telling. */
function causeClause(s: State, f: Holder, c: CauseRef): string {
  const r = f.region, farm = f.acres[0]! + f.acres[1]! + f.acres[2]! > 0;
  const crop = r === 1 ? 'oats' : c.note === 'wheat' ? 'wheat' : c.note === 'barley' ? 'barley' : 'corn';
  const wk = c.note.startsWith('w') ? `in the ${ordinal(+c.note.slice(1) > 52 ? weekOf(+c.note.slice(1)) : +c.note.slice(1))} week` : 'this year';
  const R = s.regions[r]!;
  const other = c.note && s.holders.some(h => h.id === c.note) ? nameOf(s, c.note, true) : '';
  switch (c.kind) {
    case 'frost': return `The frost ${wk} took the young ${crop}`;
    case 'flood': return r === 2 ? 'The river came over the levee and lay on the fields' : 'The flood took what we had stored';
    case 'blight': return `The ${crop} stood wet and warm and the blight ran through it`;
    case 'drought': return r === 1 ? 'The hill pastures burned brown and the oats never filled' : 'No rain came when the corn was in ear';
    case 'cold': return `A cold spring held the ${crop} back and the ears came thin`;
    case 'hands': return 'There were not hands enough to bring the harvest in';
    case 'unsown': return 'Half our strips went unsown for want of seed';
    case 'soil': return 'The land is tired and gives less each year';
    case 'harvest': case 'growth': return 'The harvest came in short';
    case 'rents': return 'The tenants brought in a short harvest, and a short harvest pays a short rent';
    case 'price': return `Corn stands at ${price(R.price)}${c.note === 'hoarding' ? ', and those who have it will not sell' : c.note === 'carted away' ? ', and the carts take it all away' : ''}`;
    case 'debt': return other ? `I owe ${other}, and the day is near` : 'A debt falls due that I cannot meet';
    case 'duty': return `Our share of ${dutyName(c.note || 'provisioning')} takes what we cannot spare`;
    case 'dues': return "The Crown's dues fall on us when we can least bear them";
    case 'theft': return c.note === 'disorder' ? 'Thieves go about openly since the streets fell into disorder' : 'Bandits on the road have been at our stores';
    case 'raid': return `Raiders came over the border ${wk} and drove off what they could carry`;
    case 'fodder': return c.note === 'sold' ? 'We have sold beasts we needed to keep' : 'The hay failed and we killed beasts we meant to winter';
    case 'murrain': return 'The murrain is among the beasts';
    case 'sickness': return `There is ${c.note || 'sickness'} in my house`;
    case 'arrears': return 'Our pay has not come';
    case 'billet': return 'The soldiers billeted on us have taken our corn for themselves';
    case 'riot': return 'A crowd broke our doors and carried off our stores';
    case 'seizure': return other ? `${other} has seized what I pledged` : 'My pledge has been seized';
    case 'default': return other ? `${other} has not paid what is owed me` : 'Those who owe me have not paid';
    default: return farm ? 'The year has gone against us' : 'We cannot make the week meet the week';
  }
}

/** How each estate opens its mouth. */
function address(f: Holder, by: Holder, collective: boolean): string {
  if (collective) return ['My lord regent, I speak for the noble houses.', 'Lord regent, the clergy have asked me to speak.', 'My lord, I come for the officers.', 'Lord regent, the merchants have sent me.', 'Sir, I report for the garrison.', 'Lord, the people have sent me to speak for them.'][f.estate]!;
  const hs = by.hs;
  if (!hs) return 'Lord regent.';
  return ['My lord regent.', 'Lord regent, God keep you.', 'My lord.', 'Lord regent, to the matter.', 'Sir.', 'Lord, forgive my coming.'][by.estate]!;
}

function strain(p: number): string {
  if (p >= 7) return ' We have nothing left to try.';
  if (p >= 5) return ' I do not know how we will see the month out.';
  if (p >= 3.5) return ' We cannot go on long as we are.';
  return '';
}

function belief(s: State, f: Holder, by: Holder): string {
  const R = s.regions[f.region]!;
  if (R.superstition > 0.5 && R.sign) return ` People say ${R.sign} was a sign of it.`;
  if (by.hs && by.hs.piety > 0.7 && R.devotion > 0.5 && f.pressure >= 3) return ' God sends this for our sins, and we bear it; but we must eat.';
  return '';
}

function memory(by: Holder): string {
  const m = by.hs ? by.hs.memory[by.hs.memory.length - 1] : undefined;
  if (!m) return '';
  return { granted: ' You heard me before, and I have not forgotten it.', eased: ' You gave me part of what I asked before.', denied: ' You sent me away before. I come again because I must.', unheard: ' I waited at your door before and was not heard.', paid: ' I have paid for another house by your ruling, and I remember it.', kept: ' You kept your word to me.', broken: ' You gave me your word, and it was not kept.' }[m.k] ?? '';
}

// ---- what is asked, in the petitioner's own voice ----

function askClause(s: State, p: Petition, o: Option): string {
  const t = o.terms, who = typeof t.who === 'string' ? nameOf(s, t.who, true) : '';
  const est = typeof t.estate === 'number' ? `the ${ESTATE_PLURAL[t.estate]}` : '';
  switch (o.kind) {
    case 'grain': return `Give us ${grain(+t.amt!)} from the granary`;
    case 'grainLoan': return `Lend us ${grain(+t.amt!)} from the granary, and we will pay it back from the harvest`;
    case 'coin': return `Grant ${coin(+t.coin!)} from the purse`;
    case 'remit': return `Remit the dues that fall at ${t.until}`;
    case 'excuse': return o.payer === 'duty' ? `Excuse us from ${dutyName(String(t.duty))} for ${num(+t.weeks!)} weeks` : o.payer === 'peers' ? `Let our neighbours carry our share of ${dutyName(String(t.duty))} for ${num(+t.weeks!)} weeks` : `Let ${est} carry our share of ${dutyName(String(t.duty))} for ${num(+t.weeks!)} weeks`;
    case 'assize': return `Set the price of corn at ${price(+t.cap!)} for ${num(+t.weeks!)} weeks`;
    case 'openGranary': return `Open the granary and sell ${grain(+t.amt!)} at a fair price`;
    case 'exportBan': return `Forbid the carting of corn out of the ${REGIONS[p.region]} for ${num(+t.weeks!)} weeks`;
    case 'patrol': return `Send the garrison out on the roads for ${num(+t.weeks!)} weeks`;
    case 'pardon': return 'Offer a pardon to those who come in off the roads';
    case 'fine': return o.payer === 'household' ? `Make ${who} pay ${coin(+t.coin!)}` : `Make ${est} pay ${coin(+t.coin!)}`;
    case 'arrears': return `Pay the garrison the ${coin(+t.coin!)} it is owed`;
    case 'word': return `Give me your word that you will see us out of this within ${num(+t.weeks!)} weeks`;
    case 'deferDebt': return `Give me until ${t.until} to pay ${who}`;
    case 'shareDebt': return `Let my neighbours bear half of what I owe ${who}`;
    case 'forgiveDebt': return `Strike off half of what I owe ${who}`;
    case 'charge': return o.payer === 'estate' ? `Lay a charge on ${est}` : `Lay a charge on ${who}`;
    case 'enforce': return `Make ${who} pay me the ${coin(+t.coin!)} owed`;
    case 'repair': return `Pay ${coin(+t.coin!)} from the purse to mend ${workName(String(t.work))}`;
    case 'levy': return `Levy the commons to labour on ${workName(String(t.work))} for ${num(+t.weeks!)} weeks`;
    case 'materials': return `Make the nobles pay ${coin(+t.coin!)} to mend ${workName(String(t.work))}`;
    case 'billet': return t.amt ? `Lay the feeding of the garrison more heavily on ${est}, with ${grain(+t.amt)} at once` : `Lay the feeding of the garrison more heavily on ${est}`;
    case 'alms': return `Bind ${est} to feed the poor, with ${grain(+t.amt!)} at once`;
    case 'wageCap': return `Cap wages at ${(+t.cap!).toFixed(1)}d a week for ${num(+t.weeks!)} weeks`;
    case 'procession': return 'Give leave for a procession';
    case 'hospital': return `Grant ${coin(+t.coin!)} to the hospital`;
    case 'tithe': return `Order the commons to pay the ${grain(+t.amt!)} of tithe they have kept back`;
    case 'inquest': return 'Hold an inquest and tell the people the cause';
    case 'appoint': return o.payer === 'household' ? `Give the office to ${who} instead` : `Appoint me ${officeName(String(t.office))}`;
    case 'marriage': return `Give leave for my house to marry into the house of ${who}, with ${coin(+t.coin!)} in dowry`;
    default: return 'Hear us';
  }
}

/** The same option, as the court would put it. */
export function optionLabel(s: State, p: Petition, o: Option): string {
  if (o.deny) return 'Deny the petition';
  const who = typeof o.terms.who === 'string' ? nameOf(s, o.terms.who, true) : '';
  const text = askClause(s, p, o)
    .replace(/^Give us /, 'Grant ').replace(/^Lend us (.*), and we will pay it back from the harvest$/, 'Lend $1, to be repaid after harvest')
    .replace(/^Give me until /, 'Defer the debt until ').replace(new RegExp(` to pay ${who}$`), '').replace(/^Give me your word that you will see us out of this within /, "Give the court's word: out of need within ")
    .replace(/^Appoint me /, `Appoint ${nameOf(s, p.by, true)} `).replace(/^Let our neighbours carry our share/, 'Pass their share to their neighbours:').replace(/^Let (the \w+) carry our share of/, 'Pass their share to $1:')
    .replace(/^Excuse us from/, 'Excuse them from').replace(/^Let my neighbours bear half of what I owe/, 'Let their neighbours bear half of the debt to').replace(/^Strike off half of what I owe/, 'Strike off half of the debt to')
    .replace(/ pay me the /, ' pay the ').replace(/^Give leave for my house to marry/, 'Give leave to marry').replace(/ us /g, ' them ');
  return text;
}

const MOTIVE_VERB: Record<string, string> = { relief: 'asks relief', protection: 'asks protection', redress: 'asks redress', need: 'reports a need', ambition: 'seeks advancement', faith: 'speaks for the faith', sign: 'brings a sign' };

/** A petition's heading: who comes, and for what kind of thing. */
export function title(s: State, p: Petition): string {
  const by = s.holders.find(h => h.id === p.by), f = s.holders.find(h => h.id === p.for);
  const who = by ? nameOf(s, p.by, true) : 'A petitioner';
  if (p.collective && f) return `${cap(who)}, for ${f.name}`;
  return `${cap(who)} ${MOTIVE_VERB[p.motive]}`;
}

/** The plea: at most the two largest causes, then the ask in exact terms. */
export function plea(s: State, p: Petition): string {
  const by = s.holders.find(h => h.id === p.by), f = s.holders.find(h => h.id === p.for) ?? by;
  if (!by || !f) return '';
  const o = p.options[0]!;
  const R = s.regions[p.region]!;
  let cause = '';
  if (p.keeper) {
    const c = p.cause;
    cause = c.kind === 'arrears' ? `The garrison has had no pay for ${num(+c.note)} weeks, and men are slipping away.`
      : c.kind === 'provision' ? `The garrison is fed at ${c.note} parts in a hundred of what it needs. Hungry men do not hold a wall.`
      : c.kind === 'work' ? `${cap(workName(c.note))} ${/s$/.test(workName(c.note)) ? 'stand' : 'stands'} at ${Math.round((1 - c.amt) * 100)} parts in a hundred of sound${c.note === 'levee' ? ', and the river does not wait' : c.note.startsWith('wall') ? ', and the raiding season will come' : c.note.startsWith('wells') ? ', and foul water breeds fever' : ''}.`
      : `There are ${c.note} going hungry in the ${REGIONS[p.region]}, and the alms do not reach them.`;
  } else if (p.motive === 'ambition') {
    const c = p.cause;
    cause = c.kind === 'vacancy' ? `The office of ${officeName(c.note)} stands empty, and its work goes undone.`
      : c.kind === 'wages' ? `Labourers ask ${(+c.note / 100).toFixed(1)}d a week and will not work for less. No estate can be run at such wages.`
      : `The house of ${nameOf(s, c.note, true)} is hard pressed, and mine is not. A match would serve us both.`;
  } else if (p.motive === 'faith') {
    cause = p.cause.kind === 'tithe' ? 'The tithe has come in short. What is owed to God is owed.' : p.cause.kind === 'sickness' ? `One in ${Math.max(2, Math.round(1 / Math.max(0.005, R.sick)))} lies sick in the ${REGIONS[p.region]}, and the people are afraid.` : 'The dead are more than the living can bury with decency.';
  } else if (p.motive === 'sign') {
    cause = `${cap(p.cause.note)}: the people take it for a sign${R.blame >= 0 ? `, and they are looking at the ${ESTATE_PLURAL[R.blame]}` : ''}.`;
  } else if (p.cause.kind === 'skim') {
    cause = `${nameOf(s, p.cause.note, true)} has kept back ${coin(p.cause.amt)} of the dues he gathered.`;
  } else {
    cause = causeClause(s, f, p.cause);
    if (p.cause2 && p.cause2.kind !== p.cause.kind) { const c2 = causeClause(s, f, p.cause2); cause += `, and ${c2[0]!.toLowerCase()}${c2.slice(1)}`; }
    cause += '.';
  }
  const ask = askClause(s, p, o);
  return `${address(f, by, p.collective)} ${cause}${p.keeper ? '' : memory(by)}${belief(s, f, by)}${strain(p.pressure)} ${ask}.`;
}

// ---- what an option does, in plain words ----

export function effectLine(s: State, e: Effect): string {
  switch (e.op) {
    case 'grain': return `${cap(grain(e.amt))} from ${nameOf(s, e.from)} to ${nameOf(s, e.to)}`;
    case 'coin': return `${coin(e.amt)} from ${nameOf(s, e.from)} to ${nameOf(s, e.to)}`;
    case 'sellGranary': return `${cap(grain(e.amt))} of Crown grain sold cheap in the ${REGIONS[e.region]}`;
    case 'remit': return `${cap(nameOf(s, e.holder))} pays no dues next quarter day`;
    case 'deferDebt': return `The debt waits until ${weekName(e.until)}`;
    case 'forgiveDebt': return `${Math.round(e.frac * 100)} parts in a hundred of the debt struck off`;
    case 'shareDebt': return `${cap(nameOf(s, e.peers))} pay half the debt`;
    case 'excuse': return `${cap(nameOf(s, e.holder))} excused for ${e.weeks} weeks; ${e.onto === 'duty' ? 'the duty goes short' : e.onto === 'peers' ? 'their neighbours carry it' : `${nameOf(s, e.onto)} carry it`}`;
    case 'weight': return `${cap(nameOf(s, e.holder))} carry ${e.mult > 1 ? 'more' : 'less'} of ${dutyName(e.duty.split('.')[0]!)}`;
    case 'repair': return `${cap(workName(e.work))} mended by ${Math.round(e.amt * 100)} parts in a hundred, for ${coin(e.cost)}`;
    case 'levy': return `The commons labour on ${workName(e.work)} for ${e.weeks} weeks`;
    case 'law': return `${cap(lawName(e.kind))} in the ${e.region < 0 ? 'realm' : REGIONS[e.region]} for ${e.weeks} weeks`;
    case 'repeal': return `${cap(lawName(e.kind))} ends`;
    case 'bind': return e.binding.kind === 'word' ? `The court's word: ${e.binding.label}, tested in ${e.binding.span} weeks` : `A ${e.binding.kind}: ${e.binding.label}`;
    case 'tie': return e.kind === 'charge' ? `A charge laid on ${nameOf(s, e.b)}` : e.kind === 'kin' ? `${cap(nameOf(s, e.a, true))} and ${nameOf(s, e.b, true)} are joined by marriage` : `A ${e.kind} between ${nameOf(s, e.a)} and ${nameOf(s, e.b)}`;
    case 'untie': return `The ${e.kind} is lifted`;
    case 'appoint': return `${cap(nameOf(s, e.to, true))} made ${officeName(e.office)}`;
    case 'inquest': return `An inquest explains the matter in the ${REGIONS[e.region]}`;
    case 'patrol': return `Patrols on the roads of the ${REGIONS[e.region]} for ${e.weeks} weeks; readiness spent`;
    case 'pardon': return `Pardon for those on the roads of the ${REGIONS[e.region]}`;
    case 'procession': return `A procession in the ${REGIONS[e.region]}: comfort, and a crowd`;
    case 'hospital': return `The hospital funded for twelve weeks, for ${coin(e.cost)}`;
    case 'arrears': return `The garrison of the ${REGIONS[e.region]} paid what it is owed`;
    case 'grieve': return `${cap(constituency(e.who))} aggrieved`;
    case 'regard': return `${cap(nameOf(s, e.holder, true))} thinks ${e.amt > 0 ? 'better' : 'worse'} of the court`;
    case 'standing': return `Standing ${e.amt > 0 ? '+' : ''}${e.amt}`;
  }
}

export const constituency = (i: number): string => `the ${ESTATE_PLURAL[i % 6]} of the ${REGIONS[Math.floor(i / 6)]}`;

/** Who bears an option, in three words. */
export function payerLabel(s: State, o: Option): string {
  if (o.deny) return 'No one pays; the petitioner goes without';
  switch (o.payer) {
    case 'court': return o.payerRef === 'granary' ? 'The Crown pays in grain' : o.payerRef === 'purse' ? 'The Crown pays in coin' : "The court's own word is staked";
    case 'duty': return 'A purpose of the realm pays';
    case 'household': return `${cap(nameOf(s, o.payerRef, true))} pays`;
    case 'peers': return "The petitioner's own estate pays";
    case 'estate': return `${cap(nameOf(s, o.payerRef))} pay`;
    case 'nobody': return 'No one pays';
  }
}

// ---- the record ----

const KIND_LABEL: Record<string, string> = {
  frost: 'frost', blight: 'blight', flood: 'flood', drought: 'drought', cold: 'a cold spring', hands: 'want of hands', unsown: 'land left unsown', soil: 'tired soil', growth: 'a poor season', none: 'nothing',
  'barns low': 'barns below the custom of the season', 'barns filling': 'barns filling', hoarding: 'hoarding', 'carted away': 'grain carted away', assize: 'corn withheld under the assize', 'granary opened': 'the granary opened',
  hunger: 'hunger', 'dear bread': 'bread dear against wages', grievance: 'grievance', deaths: 'unexpected deaths', 'idle hands': 'idle hands', rumour: 'rumour',
  price: 'the price of corn', debt: 'debt', duty: 'duty shares', dues: "the Crown's dues", theft: 'theft', raid: 'the raid', fodder: 'want of fodder', murrain: 'murrain', sickness: 'sickness', arrears: 'unpaid wages', billet: 'plunder by the billeted', riot: 'riot', seizure: 'seizure', default: 'unpaid debts', rents: 'short rents', harvest: 'a short harvest',
  'petition denied': 'a petition denied', 'petition granted': 'a petition granted', 'petition eased': 'a petition eased', 'petition unheard': 'a petition left unheard', 'made to pay': 'being made to pay', 'burden shared among peers': 'a burden shared among peers', 'rule reversed': 'a rule reversed', "the court's word broken": "the court's word broken", 'riot unchecked': 'a riot unchecked', 'raid unanswered': 'a raid unanswered',
  decay: 'time and weather', 'works duty': 'the works duty', levy: 'the levy', purse: 'repairs paid from the purse',
  pay: 'pay for garrison and officials', tolls: 'tolls on carted grain', 'market tolls': 'market tolls', skimmed: 'skimmed by a collector', granted: 'granted by ruling', 'granary sales': 'sales of Crown grain', 'arrears paid': 'arrears paid', received: 'received by ruling',
  'dues in kind': 'dues paid in corn', spoilage: 'spoilage', sold: 'sold', repaid: 'repaid',
  'hungry garrison': 'a hungry garrison', 'unpaid garrison': 'an unpaid garrison', 'thin ranks': 'thin ranks', patrols: 'patrols',
  'the desperate': 'the desperate taking to the roads', 'the watch': 'the watch', pardon: 'the pardon',
  'few hands': 'few hands', 'brisk trade': 'brisk trade', 'slack trade': 'slack trade', 'wage cap': 'the wage cap',
  'unexpected deaths': 'unexpected deaths', inquest: 'the inquest', 'alms seen': 'alms seen given', 'priests present': 'priests among the people', 'unrelieved suffering': 'suffering unrelieved', procession: 'the procession',
  fever: 'summer fever', cough: 'winter cough', pestilence: 'pestilence', 'fouled wells': 'fouled wells', 'bad drains': 'ruined conduits', crowding: 'crowding', heat: 'a hot summer', travellers: 'travellers from abroad',
  'breach of confidence': 'a breach of confidence', 'a quiet week': 'quiet weeks', 'a fourth hearing': 'a fourth hearing',
  'sickness abroad': 'sickness abroad', 'trade by sea': 'trade by sea', quarantine: 'quarantine', odds: 'the odds this week', season: 'the season', 'the wall': 'the state of the wall', 'the garrison': 'the state of the garrison', disorder: 'disorder in the march',
};
export const causeLabel = (k: string): string => KIND_LABEL[k] ?? k;

const PATH: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^price\.(\d)$/, m => `The price of corn in the ${REGIONS[+m[1]!]}`],
  [/^unrest\.(\d)$/, m => `Unrest in the ${REGIONS[+m[1]!]}`],
  [/^grievance\.(\d+)$/, m => `The grievance of ${constituency(+m[1]!)}`],
  [/^works\.(.+)$/, m => cap(workName(m[1]!))],
  [/^readiness\.(\d)$/, m => `Readiness of the garrison of the ${REGIONS[+m[1]!]}`],
  [/^harvest\.(\d)$/, m => `The harvest of the ${REGIONS[+m[1]!]}`],
  [/^deaths\.(\d)$/, m => `Deaths in the ${REGIONS[+m[1]!]}`],
  [/^sick\.(\d)$/, m => `Sickness in the ${REGIONS[+m[1]!]}`],
  [/^superstition\.(\d)$/, m => `Superstition in the ${REGIONS[+m[1]!]}`],
  [/^devotion\.(\d)$/, m => `Devotion in the ${REGIONS[+m[1]!]}`],
  [/^bandits\.(\d)$/, m => `Bandits in the ${REGIONS[+m[1]!]}`],
  [/^wage\.(\d)$/, m => `Wages in the ${REGIONS[+m[1]!]}`],
  [/^hungry\.(\d)$/, m => `The hungry in the ${REGIONS[+m[1]!]}`],
  [/^duty\.(\w+)\.(\d)$/, m => `${cap(dutyName(m[1]!))} in the ${REGIONS[+m[2]!]}`],
  [/^odds\.raid$/, () => 'The odds of a raid'], [/^odds\.pestilence$/, () => 'The odds that pestilence arrives'],
  [/^standing$/, () => "The court's standing"], [/^purse$/, () => "The Crown's purse"], [/^granary$/, () => "The Crown's granary"],
];
export function pathLabel(s: State, path: string): string {
  for (const [re, f] of PATH) { const m = path.match(re); if (m) return f(m); }
  if (path.startsWith('pressure.')) return `The pressure on ${nameOf(s, path.slice(9), true)}`;
  return path;
}

/** One line of the record, with its cause. */
export function eventLine(s: State, e: Event): string {
  const d = e.d, R = e.r >= 0 ? `the ${REGIONS[e.r]}` : 'the realm';
  const n = (k: string): number => +(d[k] ?? 0);
  const str = (k: string): string => String(d[k] ?? '');
  switch (e.k) {
    case 'frost': return `Frost in ${R} killed ${n('kill')} parts in a hundred of the young ${str('crop')}.`;
    case 'blight': return `Blight took hold in the ${str('crop')} of ${R} after warm wet weeks.`;
    case 'flood': return `The river rose over the levee${str('storm') === 'highland' ? ' after storms in the Highlands the week before' : ' after heavy rain'}. The levee stood at ${n('levee')} parts in a hundred of sound; ${grain(n('lost'))} of stored corn were lost.`;
    case 'storm': return `A great storm broke over ${R}: ${n('rain')} where ${n('usual')} is usual.`;
    case 'snow': return `Snow has closed the upland roads.`;
    case 'unsown': return `Only ${n('share')} parts in a hundred of the ${str('crop')} land in ${R} was sown.`;
    case 'harvest': return `The ${str('crop')} harvest of ${R} came in at ${n('pct')} parts in a hundred of a common year${str('main') !== 'none' ? `: ${causeLabel(str('main'))} took ${n('mainPct')}${str('second') !== 'none' ? `, with ${causeLabel(str('second'))}` : ''}` : ''}.`;
    case 'slaughter': return `In ${R}, ${commas(n('extra'))} more beasts than usual were killed at Martinmas for want of hay.`;
    case 'shortage': return `The stalls of ${R} could not meet the buyers: ${grain(n('want'))} wanted, ${grain(n('offered'))} offered${n('assize') ? ', under the assize' : ''}.`;
    case 'hoarding': return `Holders of corn in ${R} are keeping it back, on ${str('why')}.`;
    case 'famine': return `Famine in ${R}: some ${commas(n('hungry'))} are going hungry.`;
    case 'outbreak': return `${cap(causeLabel(str('disease')))} has broken out in ${R}, from ${causeLabel(str('why'))}.`;
    case 'abated': return `The ${str('disease')} in ${R} has abated; ${commas(n('dead'))} died of it.`;
    case 'draw': return str('what') === 'raid'
      ? `Raiders crossed the Highland border, at odds of 1 in ${n('oneIn')} this week${str('main') === 'wall' ? `, raised by the border wall at ${n('wall')} parts in a hundred` : str('main') === 'garrison' ? `, raised by a garrison at ${n('ready')} parts in a hundred of readiness` : ', in the raiding season'}. They took ${grain(n('grain'))} and ${commas(n('beasts'))} beasts.`
      : `Pestilence came ashore at the quays, at odds of 1 in ${commas(n('oneIn'))} this week, with sickness abroad and ships in port.`;
    case 'desertion': return `Soldiers are deserting in ${R}, ${str('why') === 'unpaid' ? `${n('weeks')} weeks unpaid` : 'for hunger'}, and taking from their billets.`;
    case 'bandits': return `A band of ${n('n')} is on the roads of ${R}, after ${str('after')}.`;
    case 'arrears': return `The purse could not meet the pay: ${coin(n('short'))} left owing.`;
    case 'murmur': case 'disorder': case 'revolt': return `${cap(R)} has come to ${e.k}, from ${causeLabel(str('why'))}${str('also') ? ` and ${causeLabel(str('also'))}` : ''}.`;
    case 'riot': return `Riot in ${R}, from ${causeLabel(str('why'))}. The crowd went for ${str('target') === 'the granary' ? 'the granary' : `the ${str('target').toLowerCase()}s`}${n('blamed') ? ', whom it already blamed' : ''}, and carried off ${grain(n('took'))}.`;
    case 'migration': return `Some ${commas(n('n'))} have come into ${R} from the ${REGIONS[n('from')]}, driven by ${str('why')}.`;
    case 'sign': return `In ${R}, people are calling ${str('sign')} a sign.`;
    case 'scapegoat': return `In ${R}, the ${str('blamed').toLowerCase()}s are being blamed for ${str('over')}.`;
    case 'default': case 'cascade': return `${cap(nameOf(s, str('debtor'), true))} could not pay ${nameOf(s, str('creditor'), true)} ${coin(n('amt'))}${str('seized') ? `; the ${str('seized')} pledged were seized` : ''}${e.k === 'cascade' ? ', having been left unpaid in turn' : ''}.`;
    case 'repaid': return `${cap(nameOf(s, str('debtor'), true))} paid ${nameOf(s, str('creditor'), true)} in full.`;
    case 'loan': return `${cap(nameOf(s, str('debtor'), true))} borrowed ${coin(n('amt'))} from ${nameOf(s, str('creditor'), true)}${str('security') !== 'none' ? `, against ${str('security')}` : ''}.`;
    case 'seedcorn': return `${cap(nameOf(s, str('who'), true))} ate ${grain(n('amt'))} of seed corn.`;
    case 'kinshare': return `${cap(nameOf(s, str('who'), true))} was fed by kin, ${nameOf(s, str('kin'), true)}.`;
    case 'patron': return `${cap(nameOf(s, str('who'), true))} took ${nameOf(s, str('patron'), true)} for a patron, and owes service.`;
    case 'death': return `${str('dead')} of the house of ${nameOf(s, str('house'), true).split(' ').pop()} died of ${str('why')}; ${str('heir')} succeeds.`;
    case 'vacancy': return `The office of ${officeName(str('office'))} stands empty.`;
    case 'law': return `${cap(lawName(str('kind')))} was proclaimed in ${R} for ${n('weeks')} weeks.`;
    case 'reversal': return `The court reversed itself: "${MAXIM[str('from')]}" gave way to "${MAXIM[str('to')]}". The ${str('relied').toLowerCase()} had relied on it.`;
    case 'kept': return `${str('kind') === 'word' ? "The court's word" : `The ${str('kind')}`} was kept: ${str('label')}.`;
    case 'broken': return `${str('kind') === 'word' ? "The court's word" : `The ${str('kind')}`} was broken: ${str('label')}.`;
    case 'breach': return `${cap(constituency(n('c')))} breached confidence, over ${causeLabel(str('why'))}. Four seals lost.`;
    case 'gaveup': return `${cap(nameOf(s, str('by'), true))} gave up waiting on the court.`;
    case 'ruling': return `The court ${n('deny') ? 'denied' : n('opt') === 0 ? 'granted' : 'eased'} ${nameOf(s, str('by'), true)}.`;
    case 'kingreturns': return `The king has returned, and the court stands with ${n('standing')} seals.`;
    case 'fallen': return "The court's standing is spent. The reign has fallen.";
    default: return e.k;
  }
}

/** How weighty an event is, for sorting the week's record. */
export function eventWeight(e: Event): number {
  return ({ fallen: 10, kingreturns: 10, breach: 9, riot: 8, revolt: 8, flood: 8, famine: 8, draw: 8, outbreak: 7, harvest: 6, broken: 6, desertion: 6, bandits: 6, scapegoat: 6, sign: 5, reversal: 5, frost: 5, blight: 5, death: 4, default: 4, cascade: 5, migration: 4, shortage: 4, hoarding: 4, disorder: 5, murmur: 3, kept: 3, law: 3, abated: 3, vacancy: 3, slaughter: 3, arrears: 4, unsown: 4, snow: 2, storm: 2, loan: 1, seedcorn: 3, kinshare: 1, patron: 1, repaid: 1, gaveup: 2, ruling: 0 } as Record<string, number>)[e.k] ?? 1;
}
