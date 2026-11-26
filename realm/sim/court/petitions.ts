// From simulation to petition. A petition is a household's decision that the court is its best remedy.
// Nothing here picks a situation: each strained holder is asked what it would do, and some choose to come.
// Every petition is a motive, a means, a payer and an object.

import { clamp } from '../math.ts';
import { P } from '../params.ts';
import { cause, event, woe, worst } from '../ledger.ts';
import { CAP, CLERIC, COMMONER, HIGH, MERCHANT, NOBLE, OFFICIAL, RIV, SOLDIER, cid, cohort, duty, dutyId, souls, weekOf, work, type CauseRef, type Effect, type Holder, type Means, type Motive, type Option, type Payer, type Petition, type Side, type State } from '../types.ts';
import { inRegion, need, nextQuarter, quarterName, weeksToHarvest } from '../util.ts';
import { tradePrice } from '../systems/markets.ts';
import { expects } from '../systems/mind.ts';
import { grieve } from './rulings.ts';

interface Cand { o: Option; relief: number; risk: number }

const opt = (kind: string, means: Means, payer: Payer, payerRef: string, effects: Effect[], terms: Record<string, string | number>, holds?: Side): Option =>
  holds ? { kind, means, payer, payerRef, effects, terms, holds } : { kind, means, payer, payerRef, effects, terms };
const denial = (holds?: Side): Option => ({ kind: 'deny', means: 'direct', payer: 'nobody', payerRef: '', effects: [], terms: {}, deny: true, ...(holds ? { holds } : {}) });
const acresOf = (h: Holder): number => h.acres[0]! + h.acres[1]! + h.acres[2]!;
const R0 = (x: number): number => Math.max(1, Math.round(x));
/** Round to a figure a clerk would write. */
const tidy = (x: number): number => { let m = 1; while (x / m >= 100) m *= 10; return Math.max(1, Math.round(x / m) * m); };

/** The house an estate speaks through in a region: its most esteemed member. */
export function spokesperson(s: State, r: number, e: number): Holder {
  let best: Holder | null = null;
  for (const h of s.holders) if (h.hs && h.region === r && h.estate === e && h.hs.charge === 0 && (!best || h.hs.esteem > best.hs!.esteem)) best = h;
  return best ?? cohort(s, r, e);
}

/** The estate best able to carry a burden in this region, other than the petitioner's own. */
function richest(s: State, r: number, not: number, among: number[] = [NOBLE, CLERIC, MERCHANT]): number {
  let best = among[0]!, bv = -1;
  for (const e of among) { if (e === not) continue; const c = cohort(s, r, e); const v = c.grain + c.coin / tradePrice(s, r); if (v > bv) { bv = v; best = e; } }
  return best;
}

/** A holder's weekly share of a duty, in rations' worth. */
function dutyLoad(s: State, h: Holder): { id: string; load: number; kind: string } | null {
  const r = h.region;
  if (h.estate === SOLDIER) return null;
  const pv = duty(s, dutyId('provisioning', r));
  const all = inRegion(s, r).filter(x => x.estate !== SOLDIER);
  const tot = all.reduce((a, x) => a + souls(x) * P.provWeight[x.estate]!, 0);
  let best = { id: pv.id, load: (pv.required * souls(h) * P.provWeight[h.estate]!) / Math.max(1, tot), kind: 'provisioning' };
  if (h.estate === COMMONER) {
    const wk = duty(s, dutyId('works', r));
    const hands = all.filter(x => x.estate === COMMONER).reduce((a, x) => a + x.workers, 0);
    const load = ((wk.required * h.workers) / Math.max(1, hands)) * (P.wage0 / tradePrice(s, r));
    if (load > best.load) best = { id: wk.id, load, kind: 'works' };
  }
  if (pv.excuse[h.id] && pv.excuse[h.id]!.until > s.t) return null;
  return best.load > 0.02 * need(h) ? best : null;
}

/** Everything the court could do for a holder in want. */
function reliefCands(s: State, h: Holder, top: string): Cand[] {
  const r = h.region, R = s.regions[r]!, pT = tradePrice(s, r), nd = need(h), w = weekOf(s.t), out: Cand[] = [];
  const gap = nd * P.askWeeks * clamp(h.pressure / 4, 0.5, 1.5);
  const to = h.id;

  const amt = tidy(Math.min(gap, s.granary * P.granaryAskShare));
  if (amt >= gap * 0.3) {
    out.push({ o: opt('grain', 'direct', 'court', 'granary', [{ op: 'grain', from: 'granary', to, amt }], { amt }), relief: amt, risk: 0 });
    if (acresOf(h) > 0 && weeksToHarvest(w) <= 44 && w < P.harvestStart) {
      const span = P.harvestEnd + 3 - w;
      out.push({ o: opt('grainLoan', 'defer', 'court', 'granary', [{ op: 'grain', from: 'granary', to, amt },
        { op: 'bind', binding: { kind: 'pledge', by: to, to: 'court', test: { t: 'repaid', holder: to, amt }, phase: 'end', span, onKept: [], onBroken: [{ op: 'grieve', who: cid(r, h.estate), amt: 0.2, why: 'pledge broken' }], label: 'repay the granary' } }],
        { amt, until: 'after harvest', span }), relief: amt * 0.75, risk: 0 });
    }
  }
  if (acresOf(h) === 0 && h.estate !== NOBLE) {
    const coin = tidy(Math.min(gap * pT, Math.max(0, s.purse) * P.purseAskShare));
    if (coin >= gap * pT * 0.3) out.push({ o: opt('coin', 'direct', 'court', 'purse', [{ op: 'coin', from: 'purse', to, amt: coin }], { coin }), relief: coin / pT, risk: 0 });
  }
  if (h.estate === NOBLE || h.estate === CLERIC || h.estate === MERCHANT || h.estate === COMMONER) {
    const dues = h.estate === NOBLE ? P.duesLand * h.rents : h.estate === CLERIC ? P.duesLand * 0.25 * h.livings : h.estate === MERCHANT ? P.duesTrade * h.trade : P.duesHearth * souls(h);
    const q = nextQuarter(s.t);
    if ((dues + h.duesOwed) / pT > 0.5 * nd && h.remit === 0) out.push({ o: opt('remit', 'defer', 'court', 'purse', [{ op: 'remit', holder: to, frac: 1 }], { coin: R0(dues + h.duesOwed), until: quarterName(q) }), relief: (dues + h.duesOwed) / pT, risk: 0 });
  }
  const dl = dutyLoad(s, h);
  if (dl) {
    const weeks = 8, rel = dl.load * weeks;
    const terms = { duty: dl.kind, weeks };
    const rich = richest(s, r, h.estate);
    out.push({ o: opt('excuse', 'shift', 'duty', dl.id, [{ op: 'excuse', duty: dl.id, holder: to, weeks, onto: 'duty' }], terms, 'hearth'), relief: rel, risk: 0 });
    out.push({ o: opt('excuse', 'shift', 'peers', `c${r}${h.estate}`, [{ op: 'excuse', duty: dl.id, holder: to, weeks, onto: 'peers' }], terms), relief: rel, risk: rel * 0.1 });
    if (dl.kind === 'provisioning') out.push({ o: opt('excuse', 'shift', 'estate', `estate:${rich}@${r}`, [{ op: 'excuse', duty: dl.id, holder: to, weeks, onto: `estate:${rich}` }], { ...terms, estate: rich }), relief: rel, risk: rel * 0.15 });
  }
  if (top === 'price' || R.price > P.dearLine * R.priceRef) {
    const cap = Math.round(R.priceRef * P.assizeCap * 100) / 100;
    if (!s.laws.some(l => l.kind === 'assize' && l.region === r) && pT > cap) out.push({ o: opt('assize', 'shift', 'estate', `estate:${MERCHANT}@${r}`, [{ op: 'law', kind: 'assize', region: r, value: cap, weeks: 8 }], { cap, weeks: 8, estate: MERCHANT }), relief: nd * 8 * (1 - cap / pT) * 0.7, risk: 0 });
    const use = inRegion(s, r).reduce((a, x) => a + need(x), 0);
    const sell = tidy(Math.min(s.granary * 0.35, use * 2));
    if (sell > use * 0.5 && h.hs === null) out.push({ o: opt('openGranary', 'direct', 'court', 'granary', [{ op: 'sellGranary', region: r, amt: sell }], { amt: sell }), relief: (sell * nd) / use, risk: 0 });
    const pc = s.ledger[`price.${r}`];
    if (r !== CAP && pc && pc.some(c => c.k === 'carted away' && c.a > 0.01) && !s.laws.some(l => l.kind === 'exportBan' && l.region === r))
      out.push({ o: opt('exportBan', 'shift', 'estate', `estate:${MERCHANT}@${r}`, [{ op: 'law', kind: 'exportBan', region: r, value: 1, weeks: 8 }], { weeks: 8, estate: MERCHANT }), relief: nd * 2, risk: 0 });
  }
  if (top === 'theft' && R.bandits > 5) {
    out.push({ o: opt('patrol', 'direct', 'duty', dutyId('watch', r), [{ op: 'patrol', region: r, weeks: 6 }], { weeks: 6 }), relief: (h.woes['theft']?.amt ?? 0) + nd, risk: 0 });
    out.push({ o: opt('pardon', 'relate', 'nobody', '', [{ op: 'pardon', region: r }], {}), relief: ((h.woes['theft']?.amt ?? 0) + nd) * 0.6, risk: 0 });
  }
  if (top === 'billet') {
    const fine = tidy((h.woes['billet']?.amt ?? 0) * pT);
    out.push({ o: opt('fine', 'direct', 'estate', `estate:${SOLDIER}@${r}`, [{ op: 'coin', from: `c${r}${SOLDIER}`, to, amt: fine }], { coin: fine, estate: SOLDIER }), relief: fine / pT, risk: fine / pT * 0.1 });
  }
  if (h.arrears > 0 && h.estate === SOLDIER) out.push({ o: opt('arrears', 'direct', 'court', 'purse', [{ op: 'arrears', region: r, frac: 1 }], { coin: R0(inRegion(s, r).reduce((a, x) => a + (x.estate === SOLDIER ? x.arrears : 0), 0)) }), relief: h.arrears / pT, risk: 0 });
  if (top === 'riot') {
    const loss = tidy((h.woes['riot']?.amt ?? 0) * pT * 0.5);
    out.push({ o: opt('fine', 'direct', 'estate', `estate:${COMMONER}@${r}`, [{ op: 'coin', from: `c${r}${COMMONER}`, to, amt: loss }], { coin: loss, estate: COMMONER }), relief: loss / pT, risk: 0 });
    if (s.purse > loss) out.push({ o: opt('coin', 'direct', 'court', 'purse', [{ op: 'coin', from: 'purse', to, amt: loss }], { coin: loss }), relief: loss / pT, risk: 0 });
  }
  if (h.pressure >= 3) out.push({ o: opt('word', 'defer', 'court', '', [{ op: 'bind', binding: { kind: 'word', by: 'court', to, test: { t: 'notUrgent', holder: to }, phase: 'end', span: 4, onKept: [], onBroken: [{ op: 'standing', amt: -1, why: "the court's word broken" }], label: 'see them out of need' } }], { weeks: 4 }), relief: gap * 0.25, risk: 0 });
  return out;
}

function debtCands(s: State, h: Holder): Cand[] {
  const out: Cand[] = [], pT = tradePrice(s, h.region);
  const d = s.debts.filter(x => x.debtor === h.id).sort((a, b) => a.due - b.due)[0];
  if (!d) return out;
  const owe = d.principal * (1 + d.rate), until = nextQuarter(Math.max(d.due, s.t + 6));
  const terms = { who: d.creditor, coin: R0(owe), until: quarterName(until), due: quarterName(d.due) };
  const big = s.holders.find(x => x.id === d.creditor);
  const risk = big && (big.estate === NOBLE || big.estate === MERCHANT) ? 0.08 : 0.03;
  out.push({ o: opt('deferDebt', 'defer', 'household', d.creditor, [{ op: 'deferDebt', debt: d.id, until }], terms, 'mercy'), relief: (owe / pT) * 0.6, risk: (owe / pT) * risk });
  out.push({ o: opt('shareDebt', 'shift', 'peers', `c${h.region}${h.estate}`, [{ op: 'shareDebt', debt: d.id, frac: 0.5, peers: `c${h.region}${h.estate}` }], { ...terms, coin: R0(owe / 2) }), relief: (owe / pT) * 0.5, risk: (owe / pT) * 0.1 });
  out.push({ o: opt('forgiveDebt', 'shift', 'household', d.creditor, [{ op: 'forgiveDebt', debt: d.id, frac: 0.5 }], { ...terms, coin: R0(owe / 2) }, 'mercy'), relief: (owe / pT) * 0.5, risk: (owe / pT) * risk * 2 });
  return out;
}

function redressCands(s: State, h: Holder, top: string): Cand[] {
  const out: Cand[] = [], pT = tradePrice(s, h.region), wv = h.woes[top];
  if (!wv) return out;
  const other = s.holders.find(x => x.id === wv.note);
  if (top === 'seizure' && other) {
    const coin = tidy(wv.amt * pT * 0.5);
    out.push({ o: opt('fine', 'direct', 'household', other.id, [{ op: 'coin', from: other.id, to: h.id, amt: coin }], { who: other.id, coin }, 'mercy'), relief: coin / pT, risk: coin / pT * 0.1 });
    out.push({ o: opt('charge', 'relate', 'household', other.id, [{ op: 'tie', kind: 'charge', a: 'court', b: other.id, w: 1 }], { who: other.id }), relief: wv.amt * 0.2, risk: wv.amt * 0.05 });
  }
  if (top === 'default' && other) {
    const coin = tidy(wv.amt * pT * 0.6);
    out.push({ o: opt('enforce', 'direct', 'household', other.id, [{ op: 'coin', from: other.id, to: h.id, amt: coin }], { who: other.id, coin }, 'letter'), relief: coin / pT, risk: 0 });
    if (s.purse > coin * 2) out.push({ o: opt('coin', 'direct', 'court', 'purse', [{ op: 'coin', from: 'purse', to: h.id, amt: tidy(coin / 2) }], { coin: tidy(coin / 2) }), relief: coin / pT / 2, risk: 0 });
  }
  return out;
}

const MOTIVE: Record<string, Motive> = { debt: 'protection', theft: 'protection', raid: 'protection', seizure: 'redress', billet: 'redress', riot: 'redress', default: 'redress' };

function ev(s: State, estate: number, c: Cand): number { return expects(s, estate, `${c.o.means}|${c.o.payer}`) * c.relief - c.risk; }

/** The ask is the best combination by expected value; alternatives are the next-best with a different means or payer. */
function pick(s: State, estate: number, cands: Cand[], denyHolds?: Side): { options: Option[]; best: number } | null {
  if (cands.length === 0) return null;
  const scored = cands.map(c => ({ c, v: ev(s, estate, c) })).sort((a, b) => b.v - a.v || (a.c.o.kind < b.c.o.kind ? -1 : 1));
  const options: Option[] = [], seen = new Set<string>();
  for (const x of scored) {
    const key = `${x.c.o.means}|${x.c.o.payer}`;
    if (seen.has(key) || options.some(o => o.kind === x.c.o.kind && o.payer === x.c.o.payer)) continue;
    seen.add(key); options.push(x.c.o);
    if (options.length === 3) break;
  }
  const ask = options[0]!;
  const opposite: Record<string, Side> = { mercy: 'letter', letter: 'mercy', hearth: 'crown', crown: 'hearth', old: 'fresh', fresh: 'old', kin: 'oath', oath: 'kin' };
  options.push(denial(denyHolds ?? (ask.holds ? opposite[ask.holds] : undefined)));
  return { options, best: scored[0]!.v };
}

// ---- what a holder can do for itself ----

interface Remedy { kind: string; ev: number; run: () => void }

function remedies(s: State, h: Holder): Remedy[] {
  const out: Remedy[] = [], r = h.region, pT = tradePrice(s, r), nd = need(h), w = weekOf(s.t);
  const gap = nd * P.askWeeks * clamp(h.pressure / 4, 0.5, 1.5);
  if (h.beasts > 2) {
    const n = Math.min(h.beasts * 0.3, gap / P.meatPerBeast), relief = n * P.meatPerBeast;
    out.push({ kind: 'beasts', ev: relief * (1 - P.beastRegret), run: () => { h.beasts -= n; h.grain += relief; woe(s, h, 'fodder', relief * 0.3, 'sold'); } });
  }
  const usury = s.laws.find(l => l.kind === 'usuryCap');
  const rate = Math.min(P.loanRate, usury ? usury.value : 1);
  const coin = gap * pT;
  const lenders = inRegion(s, r).filter(x => x.id !== h.id && (x.estate === MERCHANT || x.estate === CLERIC) && x.coin > coin * 4 && (x.estate === CLERIC || rate >= P.loanFloor))
    .sort((a, b) => b.coin - a.coin || (a.id < b.id ? -1 : 1));
  const lender = lenders[0];
  if (lender && !s.debts.some(d => d.debtor === h.id)) {
    const security = h.beasts * P.meatPerBeast * pT * P.beastWorth >= coin ? 'beasts' : acresOf(h) * P.acreWorth >= coin ? 'land' : 'none';
    const trusted = security !== 'none' || (h.hs !== null && (h.hs.kin.includes(lender.id) || h.hs.esteem > 1));
    if (trusted) out.push({ kind: 'borrow', ev: gap * (1 - rate - P.debtDread), run: () => {
      lender.coin -= coin; h.coin += coin;
      s.debts.push({ id: `d${s.nextId++}`, debtor: h.id, creditor: lender.id, principal: coin, rate, due: nextQuarter(s.t + 8), security, rolled: 0 });
      event(s, 'loan', r, { debtor: h.id, creditor: lender.id, amt: Math.round(coin), security });
    } });
  }
  const beforeSowing = w < P.sowEnd || (w > P.harvestEnd && w < P.wheatSowEnd);
  if (h.seed > nd && beforeSowing) {
    const relief = Math.min(h.seed * 0.5, gap);
    out.push({ kind: 'seed', ev: relief * (1 - P.seedRegret * (1.5 - h.pressure / 8)), run: () => { h.seed -= relief; h.grain += relief; event(s, 'seedcorn', r, { who: h.id, amt: Math.round(relief) }); } });
  }
  if (h.hs) {
    for (const k of h.hs.kin) {
      const kin = s.holders.find(x => x.id === k);
      if (!kin || kin.cover < 24) continue;
      const relief = Math.min(gap * 0.5, Math.max(0, kin.grain - need(kin) * 12) * 0.3);
      if (relief > nd) out.push({ kind: 'kin', ev: relief * 0.9, run: () => { kin.grain -= relief; h.grain += relief; event(s, 'kinshare', r, { who: h.id, kin: kin.id, amt: Math.round(relief) }); } });
    }
    const patron = inRegion(s, r).filter(x => x.hs && x.estate === NOBLE && x.id !== h.id && x.grain > need(x) * 30)[0];
    if (patron && h.estate !== NOBLE) {
      const relief = Math.min(gap * 0.5, patron.grain * 0.05);
      out.push({ kind: 'patron', ev: relief * 0.6, run: () => {
        patron.grain -= relief; h.grain += relief; patron.hs!.esteem += 0.1;
        if (!s.ties.some(x => x.kind === 'owes' && x.a === h.id && x.b === patron.id)) s.ties.push({ kind: 'owes', a: h.id, b: patron.id, w: 1, t: s.t });
        event(s, 'patron', r, { who: h.id, patron: patron.id });
      } });
    }
  }
  return out.sort((a, b) => b.ev - a.ev);
}

function refOf(h: Holder, top: { kind: string; amt: number; t: number; note: string } | undefined): CauseRef {
  return top ? { kind: top.kind, note: top.note, amt: top.amt, t: top.t } : { kind: 'want', note: '', amt: need(h), t: 0 };
}

function make(s: State, src: string, by: Holder, f: Holder, motive: Motive, c1: CauseRef, c2: CauseRef | null, options: Option[], pressure: number, extra: Partial<Petition> = {}): Petition {
  return { id: '', t0: s.t, by: by.id, for: f.id, region: f.region, estate: by.estate, collective: f.hs === null && by.id !== f.id || f.hs === null, keeper: false,
    souls: Math.round(souls(f)), motive, cause: c1, cause2: c2, options, waited: 0, urgency: 0, word: false, pressure, src, ...extra };
}

/** A strained holder's petition, and how good it thinks the court is against its own remedies. */
function strain(s: State, h: Holder): { p: Petition; court: number; own: Remedy | undefined } | null {
  const ws = worst(h, 2), top = ws[0]?.kind ?? 'want';
  let cands: Cand[];
  if (top === 'debt') cands = [...debtCands(s, h), ...reliefCands(s, h, top).filter(c => c.o.kind === 'coin' || c.o.kind === 'word')];
  else if (top === 'seizure' || top === 'default') cands = [...redressCands(s, h, top), ...reliefCands(s, h, top).filter(c => c.o.kind === 'grain' || c.o.kind === 'remit')];
  else cands = reliefCands(s, h, top);
  if (top !== 'debt' && h.woes['debt'] && h.woes['debt'].amt > need(h) * 2) cands.push(...debtCands(s, h).slice(0, 1));
  const picked = pick(s, h.estate, cands);
  if (!picked) return null;
  const by = h.hs ? h : spokesperson(s, h.region, h.estate);
  const p = make(s, `strain:${h.id}`, by, h, MOTIVE[top] ?? 'relief', refOf(h, ws[0]), ws[1] ? refOf(h, ws[1]) : null, picked.options, h.pressure);
  return { p, court: picked.best - P.petitionEffort * need(h), own: remedies(s, h)[0] };
}

// ---- keepers speak for purposes in shortfall ----

function workCands(s: State, id: string, r: number): Cand[] {
  const x = work(s, id), out: Cand[] = [];
  const lift = clamp(0.9 - x.cond, 0.05, 0.3), cost = tidy(lift * P.repairCost[x.kind]! * 100);
  const terms = { work: id, pct: Math.round(lift * 100) };
  if (s.purse > cost * 0.6) out.push({ o: opt('repair', 'direct', 'court', 'purse', [{ op: 'repair', work: id, amt: lift, cost }], { ...terms, coin: cost }), relief: 100, risk: 0 });
  out.push({ o: opt('levy', 'shift', 'estate', `estate:${COMMONER}@${r}`, [{ op: 'levy', work: id, region: r, weeks: 6 }], { ...terms, weeks: 6, estate: COMMONER }, 'crown'), relief: 100, risk: 10 });
  out.push({ o: opt('materials', 'shift', 'estate', `estate:${NOBLE}@${r}`, [{ op: 'coin', from: `estate:${NOBLE}@${r}`, to: 'purse', amt: cost }, { op: 'repair', work: id, amt: lift, cost }], { ...terms, coin: cost, estate: NOBLE }, 'crown'), relief: 100, risk: 20 });
  return out;
}

function keepers(s: State): Petition[] {
  const out: Petition[] = [];
  for (const o of s.offices) {
    const by = o.holder ? s.holders.find(h => h.id === o.holder) : undefined;
    if (!by || !by.hs) continue;
    const r = o.region;
    let cands: Cand[] = [], short = 0, kind = '', note = '';
    if (o.power === 'garrison') {
      const d = duty(s, dutyId('provisioning', r)), troop = cohort(s, r, SOLDIER);
      const owedWeeks = troop.arrears / Math.max(1, troop.workers * P.paySoldier);
      const wall = s.works.find(x => x.id === `wall.${r}`);
      if (owedWeeks > 2) {
        short = clamp(owedWeeks / 8, 0.3, 1); kind = 'arrears'; note = `${Math.round(owedWeeks)}`;
        const owed = inRegion(s, r).reduce((a, x) => a + (x.estate === SOLDIER ? x.arrears : 0), 0);
        if (s.purse > owed * 0.5) cands.push({ o: opt('arrears', 'direct', 'court', 'purse', [{ op: 'arrears', region: r, frac: 1 }], { coin: R0(owed) }), relief: 100, risk: 0 });
        const rich = richest(s, r, SOLDIER);
        cands.push({ o: opt('fine', 'shift', 'estate', `estate:${rich}@${r}`, [{ op: 'coin', from: `estate:${rich}@${r}`, to: `estate:${SOLDIER}@${r}`, amt: tidy(owed * 0.6) }], { coin: tidy(owed * 0.6), estate: rich }, 'crown'), relief: 80, risk: 10 });
      } else if (d.provision < P.keeperLine || troop.n < 0.8) {
        short = 1 - Math.min(d.provision, troop.n); kind = 'provision'; note = `${Math.round(d.provision * 100)}`;
        const amt = tidy(inRegion(s, r).reduce((a, x) => a + (x.estate === SOLDIER ? need(x) : 0), 0) * 6);
        if (s.granary > amt) cands.push({ o: opt('grain', 'direct', 'court', 'granary', [{ op: 'grain', from: 'granary', to: `estate:${SOLDIER}@${r}`, amt }], { amt }), relief: 100, risk: 0 });
        const rich = richest(s, r, SOLDIER);
        cands.push({ o: opt('billet', 'shift', 'estate', `estate:${rich}@${r}`, [{ op: 'weight', duty: d.id, holder: `estate:${rich}@${r}`, mult: 1.8 }, { op: 'grain', from: `estate:${rich}@${r}`, to: `estate:${SOLDIER}@${r}`, amt: tidy(amt / 2) }], { amt: tidy(amt / 2), estate: rich, duty: 'provisioning' }, 'crown'), relief: 90, risk: 10 });
        cands.push({ o: opt('billet', 'shift', 'estate', `estate:${COMMONER}@${r}`, [{ op: 'weight', duty: d.id, holder: `estate:${COMMONER}@${r}`, mult: 1.5 }], { estate: COMMONER, duty: 'provisioning' }, 'crown'), relief: 70, risk: 5 });
      } else if (wall && wall.cond < P.keeperLine) { short = 1 - wall.cond; kind = 'work'; note = wall.id; cands = workCands(s, wall.id, r); }
    } else if (o.power.startsWith('work:')) {
      const id = o.power.slice(5), x = work(s, id);
      const line = id === 'levee' && s.regions[RIV]!.sky.moist > 1.2 ? P.keeperLine + 0.1 : P.keeperLine;
      if (x.cond < line && x.funded < 0.02 && x.levy <= s.t) { short = 1 - x.cond; kind = 'work'; note = id; cands = workCands(s, id, r); }
    } else if (o.power === 'collect') {
      // The Crown's officer in a region answers for the works that have no keeper of their own.
      const kept = s.offices.filter(k => k.power.startsWith('work:')).map(k => k.power.slice(5));
      const x = s.works.filter(k => k.region === r && !kept.includes(k.id) && !k.id.startsWith('wall') && k.funded < 0.02 && k.levy <= s.t).sort((a, b) => a.cond - b.cond)[0];
      if (x && x.cond < P.keeperLine) { short = 1 - x.cond; kind = 'work'; note = x.id; cands = workCands(s, x.id, r); }
    } else if (o.power === 'alms') {
      const R = s.regions[r]!, d = duty(s, dutyId('relief', r)), N = inRegion(s, r).reduce((a, x) => a + souls(x), 0);
      if (R.hungry > P.almonerLine * N) {
        short = clamp(R.hungry / N * 4, 0.3, 1); kind = 'hunger'; note = `${Math.round(R.hungry)}`;
        const amt = tidy(R.hungry * 4);
        if (s.granary > amt * 0.5) cands.push({ o: opt('grain', 'direct', 'court', 'granary', [{ op: 'grain', from: 'granary', to: `c${r}${COMMONER}`, amt: Math.min(amt, tidy(s.granary * 0.5)) }], { amt: Math.min(amt, tidy(s.granary * 0.5)) }), relief: 100, risk: 0 });
        const rich = richest(s, r, CLERIC, [NOBLE, MERCHANT]);
        cands.push({ o: opt('alms', 'shift', 'estate', `estate:${rich}@${r}`, [{ op: 'weight', duty: d.id, holder: `estate:${rich}@${r}`, mult: 2.5 }, { op: 'grain', from: `estate:${rich}@${r}`, to: `c${r}${COMMONER}`, amt: tidy(amt / 2) }], { amt: tidy(amt / 2), estate: rich, duty: 'relief' }), relief: 80, risk: 10 });
      }
    }
    const picked = pick(s, by.estate, cands, kind === 'work' || kind === 'provision' ? 'hearth' : undefined);
    if (!picked) continue;
    const p = make(s, `keeper:${o.id}`, by, by, 'need', { kind, note, amt: short, t: s.t }, null, picked.options, 2 + 6 * short, { keeper: true, collective: false, region: r });
    out.push(p);
  }
  return out;
}

// ---- petitions that arise from position rather than want ----

function specials(s: State): Petition[] {
  const out: Petition[] = [];
  const w = weekOf(s.t);
  for (let r = 0; r < 3; r++) {
    const R = s.regions[r]!, N = inRegion(s, r).reduce((a, x) => a + souls(x), 0);

    // Ambition: a wage worth capping.
    if (R.wage > P.wageCapAsk * R.wageRef && !s.laws.some(l => l.kind === 'wageCap' && l.region === r)) {
      const by = spokesperson(s, r, NOBLE), cap = Math.round(R.wageRef * 1.05 * 100) / 100;
      const picked = pick(s, NOBLE, [{ o: opt('wageCap', 'shift', 'estate', `estate:${COMMONER}@${r}`, [{ op: 'law', kind: 'wageCap', region: r, value: cap, weeks: 16 }], { cap, weeks: 16, estate: COMMONER }, 'old'), relief: 50, risk: 5 }]);
      if (picked) out.push(make(s, `sp:wage:${r}`, by, cohort(s, r, NOBLE), 'ambition', { kind: 'wages', note: `${Math.round(R.wage * 100)}`, amt: R.wage / R.wageRef, t: s.t }, null, picked.options, 2));
    }
    // Relief: bread dear in the market brings those who buy it.
    const commons = cohort(s, r, COMMONER);
    if (R.price > P.dearLine * R.priceRef && commons.grain < need(commons) * P.pantryWeeks * 2 && commons.pressure < P.collectiveLine) {
      const by = spokesperson(s, r, COMMONER);
      const cands = reliefCands(s, commons, 'price').filter(c => ['assize', 'openGranary', 'exportBan'].includes(c.o.kind));
      const picked = pick(s, COMMONER, cands);
      if (picked) out.push(make(s, `sp:bread:${r}`, by, commons, 'relief', { kind: 'price', note: (s.ledger[`price.${r}`] ?? [])[0]?.k ?? '', amt: R.price / R.priceRef, t: s.t }, null, picked.options, 1.5 + 2 * (R.price / R.priceRef - 1)));
    }
    // Faith: sickness or the dying move the devout.
    if ((R.sick > P.faithSick || R.deaths > 2.5 * R.deathsExp + 2) && R.devotion > 0.35) {
      const by = spokesperson(s, r, CLERIC), cost = tidy(N * 0.12);
      const cands: Cand[] = [{ o: opt('procession', 'relate', 'nobody', '', [{ op: 'procession', region: r }], {}), relief: 60 * R.devotion, risk: 0 }];
      if (s.purse > cost && R.hospital <= s.t) cands.push({ o: opt('hospital', 'direct', 'court', 'purse', [{ op: 'hospital', region: r, cost }], { coin: cost }), relief: 50, risk: 0 });
      const picked = pick(s, CLERIC, cands);
      if (picked) out.push(make(s, `sp:faith:${r}`, by, cohort(s, r, CLERIC), 'faith', { kind: R.sick > P.faithSick ? 'sickness' : 'deaths', note: '', amt: R.sick, t: s.t }, null, picked.options, 2 + R.sick * 30));
    }
    // Faith: the tithe withheld.
    const tithe = duty(s, dutyId('tithe', r));
    if (w > P.harvestEnd && w < P.harvestEnd + 8 && tithe.required > 0 && tithe.provision < 0.85) {
      const by = spokesperson(s, r, CLERIC), amt = tidy(tithe.required - tithe.delivered);
      const picked = pick(s, CLERIC, [{ o: opt('tithe', 'shift', 'estate', `estate:${COMMONER}@${r}`, [{ op: 'grain', from: `c${r}${COMMONER}`, to: `c${r}${CLERIC}`, amt }], { amt, estate: COMMONER }, 'letter'), relief: 50, risk: 5 }]);
      if (picked) out.push(make(s, `sp:tithe:${r}`, by, cohort(s, r, CLERIC), 'faith', { kind: 'tithe', note: '', amt, t: s.t }, null, picked.options, 2));
    }
    // Sign: an anomaly read by frightened people.
    if (R.superstition > P.signLine && s.t - R.signT <= 4 && R.sign) {
      const by = spokesperson(s, r, COMMONER);
      const cands: Cand[] = [];
      if (s.purse > P.inquestCost) cands.push({ o: opt('inquest', 'direct', 'court', 'purse', [{ op: 'inquest', region: r }], { coin: P.inquestCost }), relief: 40, risk: 0 });
      cands.push({ o: opt('procession', 'relate', 'nobody', '', [{ op: 'procession', region: r }], {}), relief: 40 * (0.5 + R.devotion), risk: 0 });
      if (R.blame >= 0) cands.push({ o: opt('charge', 'relate', 'estate', `estate:${R.blame}@${r}`, [{ op: 'grieve', who: cid(r, R.blame), amt: 0.8, why: 'charged for a sign' }, { op: 'tie', kind: 'charge', a: 'court', b: `estate:${R.blame}@${r}`, w: 1 }], { estate: R.blame }), relief: 80 * R.superstition, risk: 5 });
      const picked = pick(s, COMMONER, cands);
      if (picked) out.push(make(s, `sp:sign:${r}`, by, cohort(s, r, COMMONER), 'sign', { kind: 'sign', note: R.sign, amt: R.superstition, t: R.signT }, null, picked.options, 2 + 3 * R.superstition));
    }
    // Protection: the roads.
    if (R.bandits > P.banditLine) {
      const by = spokesperson(s, r, MERCHANT);
      const picked = pick(s, MERCHANT, [
        { o: opt('patrol', 'direct', 'duty', dutyId('watch', r), [{ op: 'patrol', region: r, weeks: 6 }], { weeks: 6 }), relief: 60, risk: 0 },
        { o: opt('pardon', 'relate', 'nobody', '', [{ op: 'pardon', region: r }], {}), relief: 40, risk: 0 },
      ]);
      if (picked) out.push(make(s, `sp:roads:${r}`, by, cohort(s, r, MERCHANT), 'protection', { kind: 'theft', note: 'bandits', amt: R.bandits, t: s.t }, null, picked.options, 2 + clamp(R.bandits / P.banditLine, 0, 3)));
    }
  }
  // Redress: a collector who has skimmed too long.
  for (const o of s.offices) {
    if (o.power !== 'collect' || !o.holder || o.skim < P.skimLine) continue;
    const by = spokesperson(s, o.region, MERCHANT), coin = tidy(o.skim);
    const picked = pick(s, MERCHANT, [
      { o: opt('charge', 'relate', 'household', o.holder, [{ op: 'tie', kind: 'charge', a: 'court', b: o.holder, w: 1 }, { op: 'coin', from: o.holder, to: 'purse', amt: coin }], { who: o.holder, coin }, 'letter'), relief: 60, risk: 5 },
      { o: opt('fine', 'direct', 'household', o.holder, [{ op: 'coin', from: o.holder, to: 'purse', amt: tidy(coin / 2) }], { who: o.holder, coin: tidy(coin / 2) }), relief: 30, risk: 2 },
    ]);
    if (picked) out.push(make(s, `sp:skim:${o.id}`, by, cohort(s, o.region, MERCHANT), 'redress', { kind: 'skim', note: o.holder, amt: o.skim, t: s.t }, null, picked.options, 3));
  }
  // Ambition: a vacant office, and those who would fill it.
  for (const o of s.offices) {
    if (o.holder) continue;
    const estate = o.power === 'garrison' ? SOLDIER : o.power === 'alms' ? CLERIC : OFFICIAL;
    const claim = s.holders.filter(h => h.hs && h.estate === estate && !h.hs.office && h.hs.charge === 0)
      .sort((a, b) => (b.hs!.ambition + (b.region === o.region ? 0.3 : 0)) - (a.hs!.ambition + (a.region === o.region ? 0.3 : 0)) || (a.id < b.id ? -1 : 1));
    const first = claim[0], rival = claim.slice(1).sort((a, b) => b.hs!.esteem - a.hs!.esteem)[0];
    if (!first) continue;
    const senior = !rival || first.hs!.esteem >= rival.hs!.esteem;
    const cands: Cand[] = [{ o: opt('appoint', 'relate', 'nobody', '', [{ op: 'appoint', office: o.id, to: first.id }], { office: o.id, who: first.id }, senior ? 'old' : 'fresh'), relief: 60, risk: 0 }];
    if (rival) cands.push({ o: opt('appoint', 'relate', 'household', first.id, [{ op: 'appoint', office: o.id, to: rival.id }], { office: o.id, who: rival.id }, senior ? 'fresh' : 'old'), relief: 5, risk: 0 });
    const picked = pick(s, estate, cands);
    if (picked) { picked.options[picked.options.length - 1] = denial(); out.push(make(s, `sp:office:${o.id}`, first, first, 'ambition', { kind: 'vacancy', note: o.id, amt: 1, t: s.t }, null, picked.options, 2, { collective: false })); }
  }
  // Ambition: a marriage that mends one house and raises another.
  const suitors = s.holders.filter(h => h.hs && h.hs.ambition > 0.7 && h.cover > 30 && h.coin > 200);
  for (const a of suitors) {
    const b = s.holders.filter(h => h.hs && h.region === a.region && h.estate < a.estate && h.pressure >= 2 && !a.hs!.kin.includes(h.id)).sort((x, y) => y.pressure - x.pressure || (x.id < y.id ? -1 : 1))[0];
    if (!b) continue;
    const dowry = tidy(Math.min(a.coin * 0.3, need(b) * tradePrice(s, b.region) * 12));
    const picked = pick(s, a.estate, [{ o: opt('marriage', 'relate', 'nobody', b.id, [{ op: 'tie', kind: 'kin', a: a.id, b: b.id, w: 1 }, { op: 'coin', from: a.id, to: b.id, amt: dowry }], { who: b.id, coin: dowry }, 'fresh'), relief: 40, risk: 0 }]);
    if (picked) { out.push(make(s, `sp:match:${a.id}`, a, a, 'ambition', { kind: 'match', note: b.id, amt: 1, t: s.t }, null, picked.options, 1.5, { collective: false })); break; }
  }
  void HIGH;
  return out;
}

const urgencyOf = (p: Petition): number => p.pressure + P.waitUrgency * p.waited + (p.collective ? 1 : 0) + (p.keeper ? 0.5 : 0);

/** Step 16, last part: next week's petitions. Those unheard persist and grow more pressing; after a while they give up on the court. */
export function formPetitions(s: State, ruled: string[]): void {
  const pending = new Map<string, Petition>();
  for (const p of s.docket) {
    if (ruled.includes(p.id)) continue;
    p.waited++;
    const c = cid(p.region, p.estate);
    if (!p.keeper) { grieve(s, c, (p.pressure >= 4 ? P.unheardGrievance : P.unheardSlight) * (p.collective ? 1.5 : 1), 'petition unheard'); s.unheard[c] = s.unheard[c]! + 1; }
    if (p.waited > P.giveUpWeeks) {
      // They give up on the court, turn to their own remedies and think less of it.
      const ask = p.options[0]!, e = s.expect[p.estate]!, key = `${ask.means}|${ask.payer}`;
      if (!e[key]) e[key] = { asked: 0, granted: 0 };
      e[key]!.asked += 1;
      const by = s.holders.find(h => h.id === p.by), f = s.holders.find(h => h.id === p.for);
      if (by && by.hs) { by.hs.regard = clamp(by.hs.regard - 0.5, -3, 3); by.hs.memory.push({ t: s.t, k: 'unheard', amt: p.pressure }); }
      s.regard[c] = clamp(s.regard[c]! - 0.2, -3, 3);
      if (f) { f.petT = s.t; if (p.src.startsWith('strain:')) { const own = remedies(s, f)[0]; if (own && own.ev > 0) { own.run(); f.remT = s.t; } } }
      s.cool[p.src] = s.t + P.petitionGap;
      event(s, 'gaveup', p.region, { by: p.by, motive: p.motive, kind: ask.kind });
      continue;
    }
    pending.set(p.src, p);
  }

  const next: Petition[] = [];
  const admit = (np: Petition, come: boolean): void => {
    const old = pending.get(np.src);
    if (old) { old.options = np.options; old.pressure = Math.max(np.pressure, old.pressure * 0.9); old.cause = np.cause; old.cause2 = np.cause2; old.by = np.by; next.push(old); pending.delete(np.src); return; }
    if (!come || (s.cool[np.src] ?? 0) > s.t) return;
    np.id = `p${s.nextId++}`;
    next.push(np);
  };

  for (const h of s.holders) {
    const waiting = pending.has(`strain:${h.id}`);
    if (!waiting && h.pressure < (h.hs ? P.strainLine : P.collectiveLine)) continue;
    if (!waiting && s.t - h.petT < P.petitionGap) continue;
    const st = strain(s, h);
    if (waiting) { if (st) admit(st.p, true); continue; }
    if (s.t - h.remT < P.remedyGap) continue;
    const own = st ? st.own : remedies(s, h)[0];
    const speaking = h.hs !== null && (next.some(p => p.by === h.id) || [...pending.values()].some(p => p.by === h.id));
    if (st && st.court > 0 && (!own || st.court >= own.ev) && !speaking) admit(st.p, true);
    else if (own && own.ev > 0) { own.run(); h.remT = s.t; cause(s, `remedy.${h.id}`, own.kind, 1); if (h.hs) h.hs.lastRemedy = own.kind; }
  }
  for (const p of keepers(s)) admit(p, true);
  for (const p of specials(s)) admit(p, true);

  for (const p of next) {
    p.word = s.bindings.some(b => b.state === 'open' && b.kind === 'word' && b.by === 'court' && (b.to === p.for || b.to === p.by));
    p.urgency = urgencyOf(p);
  }
  next.sort((a, b) => (b.word ? 1 : 0) - (a.word ? 1 : 0) || b.urgency - a.urgency || (a.id < b.id ? -1 : 1));
  s.docket = next;
}

/** This dawn's audience: holders of the court's word are seated first, the rest by urgency. */
export function petitions(s: State): Petition[] {
  return s.docket.slice(0, P.seats);
}
