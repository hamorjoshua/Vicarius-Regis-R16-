// Steps 5, 6 and 18. A ruling is a bundle of primitive effects applied to the state,
// followed by the general reactions of those it helped and those who pay.

import { clamp, clamp01 } from '../math.ts';
import { P } from '../params.ts';
import { cause, event, woe } from '../ledger.ts';
import { COMMONER, ESTATES, SOLDIER, cid, cohort, duty, souls, work, type Binding, type Effect, type Holder, type Option, type Petition, type Side, type State, type Test } from '../types.ts';
import { inRegion, need, shares } from '../util.ts';
import { tradePrice } from '../systems/markets.ts';

/** Who a reference names: a holder id, or `estate:E@R` for everyone of an estate in a region. */
export function resolve(s: State, ref: string): Holder[] {
  if (ref.startsWith('estate:')) {
    const [e, r] = ref.slice(7).split('@');
    return s.holders.filter(h => h.estate === +e! && (r === undefined || h.region === +r));
  }
  const h = s.holders.find(x => x.id === ref);
  return h ? [h] : [];
}

function take(s: State, ref: string, what: 'grain' | 'coin', amt: number): number {
  if (ref === 'granary') { const q = Math.min(s.granary, amt); s.granary -= q; cause(s, 'granary', 'granted', -q); return q; }
  if (ref === 'purse') { const q = Math.min(Math.max(0, s.purse), amt); s.purse -= q; cause(s, 'purse', 'granted', -q); return q; }
  const hs = resolve(s, ref);
  const spare = hs.map(h => Math.max(0, what === 'grain' ? h.grain - need(h) * 2 : h.coin * 0.8));
  const q = Math.min(amt, spare.reduce((a, b) => a + b, 0));
  const sh = shares(hs, (_h) => spare[hs.indexOf(_h)]!, q);
  hs.forEach((h, i) => { h[what] -= sh[i]!; });
  return q;
}

function give(s: State, ref: string, what: 'grain' | 'coin', amt: number): void {
  if (ref === 'granary') { s.granary += amt; cause(s, 'granary', 'repaid', amt); return; }
  if (ref === 'purse') { s.purse += amt; cause(s, 'purse', 'received', amt); return; }
  const hs = resolve(s, ref);
  const sh = shares(hs, h => Math.max(0.01, need(h)), amt);
  hs.forEach((h, i) => { h[what] += sh[i]!; });
}

export function grieve(s: State, who: number, amt: number, why: string): void {
  s.grievance[who] = clamp(s.grievance[who]! + amt, 0, 4);
  cause(s, `grievance.${who}`, why, amt);
}

export function applyEffect(s: State, e: Effect): void {
  switch (e.op) {
    case 'grain': give(s, e.to, 'grain', take(s, e.from, 'grain', e.amt)); break;
    case 'coin': give(s, e.to, 'coin', take(s, e.from, 'coin', e.amt)); break;
    case 'sellGranary': {
      // Crown grain sold cheap to those who buy their bread.
      const q = Math.min(s.granary, e.amt), price = tradePrice(s, e.region) * P.granaryDiscount;
      const buyers = inRegion(s, e.region).filter(h => h.estate === COMMONER);
      const sh = shares(buyers, need, q);
      let got = 0;
      buyers.forEach((h, i) => { const pay = Math.min(h.coin * 0.5, sh[i]! * price); h.coin -= pay; h.grain += sh[i]!; got += pay; });
      s.granary -= q; s.purse += got;
      cause(s, 'granary', 'sold', -q); cause(s, 'purse', 'granary sales', got);
      cause(s, `price.${e.region}`, 'granary opened', -0.02);
      break;
    }
    case 'remit': for (const h of resolve(s, e.holder)) { h.remit = Math.max(h.remit, e.frac); h.duesOwed *= 1 - e.frac; } break;
    case 'deferDebt': { const d = s.debts.find(x => x.id === e.debt); if (d) d.due = Math.max(d.due, e.until); break; }
    case 'forgiveDebt': {
      const d = s.debts.find(x => x.id === e.debt);
      if (d) {
        const c = s.holders.find(h => h.id === d.creditor);
        if (c) woe(s, c, 'default', (d.principal * e.frac) / tradePrice(s, c.region), d.debtor);
        d.principal *= 1 - e.frac;
        if (d.principal < 1) s.debts.splice(s.debts.indexOf(d), 1);
      }
      break;
    }
    case 'shareDebt': {
      const d = s.debts.find(x => x.id === e.debt);
      if (d) {
        const paid = take(s, e.peers, 'coin', d.principal * (1 + d.rate) * e.frac);
        give(s, d.creditor, 'coin', paid);
        d.principal = Math.max(0, d.principal - paid / (1 + d.rate));
        if (d.principal < 1) s.debts.splice(s.debts.indexOf(d), 1);
      }
      break;
    }
    case 'excuse': for (const h of resolve(s, e.holder)) duty(s, e.duty).excuse[h.id] = { until: s.t + e.weeks, onto: e.onto }; break;
    case 'weight': { const d = duty(s, e.duty); for (const h of resolve(s, e.holder)) d.mod[h.id] = clamp((d.mod[h.id] ?? 1) * e.mult, 0.2, 4); break; }
    case 'repair': {
      // The purse's coin is wages for those who do the mending.
      const w = work(s, e.work), paid = take(s, 'purse', 'coin', e.cost);
      give(s, `c${w.region}${COMMONER}`, 'coin', paid);
      w.funded += e.cost > 0 ? (e.amt * paid) / e.cost : e.amt;
      break;
    }
    case 'levy': work(s, e.work).levy = s.t + e.weeks; break;
    case 'law':
      s.laws = s.laws.filter(l => !(l.kind === e.kind && l.region === e.region));
      s.laws.push({ kind: e.kind, region: e.region, value: e.value, until: s.t + e.weeks, since: s.t });
      event(s, 'law', e.region, { kind: e.kind, value: Math.round(e.value * 100) / 100, weeks: e.weeks });
      break;
    case 'repeal': s.laws = s.laws.filter(l => !(l.kind === e.kind && l.region === e.region)); break;
    case 'bind': {
      const { span, ...rest } = e.binding;
      // A binding starts next week: a word given at the hearings is not tested the same day.
      const b: Binding = { ...rest, id: `b${s.nextId++}`, start: s.t + 1, end: s.t + span, state: 'open' };
      s.bindings.push(b);
      break;
    }
    case 'tie': {
      const x = s.ties.find(k => k.kind === e.kind && k.a === e.a && k.b === e.b);
      if (x) x.w += e.w; else s.ties.push({ kind: e.kind, a: e.a, b: e.b, w: e.w, t: s.t });
      if (e.kind === 'charge') for (const h of resolve(s, e.b)) if (h.hs) {
        h.hs.charge = s.t;
        if (h.hs.office) { const o = s.offices.find(k => k.id === h.hs!.office); if (o) { o.holder = null; o.skim = 0; event(s, 'vacancy', h.region, { office: o.id, dead: '' }); } h.hs.office = null; }
      }
      if (e.kind === 'kin') for (const h of resolve(s, e.a)) if (h.hs && !h.hs.kin.includes(e.b)) { h.hs.kin.push(e.b); for (const k of resolve(s, e.b)) if (k.hs && !k.hs.kin.includes(e.a)) k.hs.kin.push(e.a); }
      break;
    }
    case 'untie': s.ties = s.ties.filter(k => !(k.kind === e.kind && k.a === e.a && k.b === e.b)); break;
    case 'appoint': {
      const o = s.offices.find(k => k.id === e.office);
      if (o) {
        for (const h of s.holders) if (h.hs && h.hs.office === o.id) h.hs.office = null;
        o.holder = e.to; o.skim = 0;
        const h = s.holders.find(k => k.id === e.to);
        if (h && h.hs) { h.hs.office = o.id; h.hs.esteem += 0.5; }
      }
      break;
    }
    case 'inquest': {
      const R = s.regions[e.region]!;
      give(s, `c${e.region}2`, 'coin', take(s, 'purse', 'coin', P.inquestCost));
      R.inquestT = s.t; R.blame = -1;
      cause(s, `superstition.${e.region}`, 'inquest', -R.superstition * P.inquestCalm);
      break;
    }
    case 'patrol': { const R = s.regions[e.region]!; R.patrol = s.t + e.weeks; R.readiness = clamp01(R.readiness - P.patrolCost); cause(s, `readiness.${e.region}`, 'patrols', -P.patrolCost); break; }
    case 'pardon': {
      const R = s.regions[e.region]!, home = R.bandits * P.pardonShare;
      R.bandits -= home; cohort(s, e.region, COMMONER).workers += home;
      cause(s, `bandits.${e.region}`, 'pardon', -home);
      break;
    }
    case 'procession': {
      const R = s.regions[e.region]!;
      R.devotion = clamp01(R.devotion + P.processionDevotion); R.unrest = Math.max(0, R.unrest - P.processionCalm);
      cause(s, `devotion.${e.region}`, 'procession', P.processionDevotion);
      // A crowd comforts the faithful and spreads the sickness.
      for (let d = 0; d < 3; d++) if (R.disease[d]!.out) { R.disease[d]!.I *= P.processionSpread; cause(s, `sick.${e.region}`, 'procession', 0.01); }
      break;
    }
    case 'hospital': { const R = s.regions[e.region]!; give(s, `c${e.region}1`, 'coin', take(s, 'purse', 'coin', e.cost)); R.hospital = s.t + 12; R.devotion = clamp01(R.devotion + 0.04); break; }
    case 'arrears': {
      const men = inRegion(s, e.region).filter(h => h.estate === SOLDIER && h.arrears > 0);
      const owed = men.reduce((a, h) => a + h.arrears, 0) * e.frac;
      const paid = take(s, 'purse', 'coin', owed);
      if (owed > 0) for (const h of men) { const p = (paid * h.arrears * e.frac) / owed; h.coin += p; h.arrears -= p; }
      break;
    }
    case 'grieve': grieve(s, e.who, e.amt, e.why); break;
    case 'regard': for (const h of resolve(s, e.holder)) if (h.hs) h.hs.regard = clamp(h.hs.regard + e.amt, -3, 3); break;
    case 'standing': s.standing = clamp(s.standing + e.amt, 0, P.standingMax); cause(s, 'standing', e.why, e.amt); break;
  }
}

const QUESTION: Record<Side, string> = { letter: 'bond', mercy: 'bond', crown: 'realm', hearth: 'realm', old: 'custom', fresh: 'custom', kin: 'kinship', oath: 'kinship' };

/** What the court last held on a question is expected next time; reversing it costs the court with those who relied on it. */
function hold(s: State, side: Side, estate: number): void {
  const q = QUESTION[side], r = s.rules[q];
  if (!r) { s.rules[q] = { side, count: 1, since: s.t, relied: [estate] }; return; }
  if (r.side === side) { r.count++; if (!r.relied.includes(estate)) r.relied.push(estate); return; }
  if (r.count >= 2) {
    for (const e of r.relied) for (let reg = 0; reg < 3; reg++) grieve(s, cid(reg, e), P.reversalGrievance, 'rule reversed');
    for (const ex of s.expect) for (const key in ex) { ex[key]!.asked *= P.reversalBlur; ex[key]!.granted *= P.reversalBlur; }
    event(s, 'reversal', -1, { from: r.side, to: side, relied: r.relied.map(e => ESTATES[e]).join(', ') });
  }
  s.rules[q] = { side, count: 1, since: s.t, relied: [estate] };
}

const bump = (s: State, estate: number, key: string, asked: number, granted: number): void => {
  const e = s.expect[estate]!;
  if (!e[key]) e[key] = { asked: 0, granted: 0 };
  e[key]!.asked += asked; e[key]!.granted += granted;
};

/** Apply one ruling: its effects, then how the realm takes it. */
export function rule(s: State, p: Petition, idx: number): void {
  const o: Option = p.options[idx]!, ask = p.options[0]!;
  for (const e of o.effects) applyEffect(s, e);

  const pc = cid(p.region, p.estate), deny = !!o.deny, asked = idx === 0;
  const weight = p.collective ? P.collectiveWeight : p.keeper ? 0.7 : 0.6;
  const speaker = s.holders.find(h => h.id === p.by);
  bump(s, p.estate, `${ask.means}|${ask.payer}`, 1, asked ? 1 : 0);
  if (!asked && !deny) bump(s, p.estate, `${o.means}|${o.payer}`, 1, 1);

  if (deny) {
    grieve(s, pc, P.denyGrievance * weight * (p.pressure >= 4 ? 1.5 : 1), 'petition denied');
    s.regard[pc] = clamp(s.regard[pc]! - 0.4 * weight, -3, 3);
    if (speaker && speaker.hs) { speaker.hs.regard = clamp(speaker.hs.regard - 1, -3, 3); speaker.hs.memory.push({ t: s.t, k: 'denied', amt: p.pressure }); speaker.hs.esteem -= 0.1; }
  } else {
    const ease = (asked ? P.grantEase : P.altEase) * weight;
    s.grievance[pc] = Math.max(0, s.grievance[pc]! - ease);
    cause(s, `grievance.${pc}`, asked ? 'petition granted' : 'petition eased', -ease);
    s.regard[pc] = clamp(s.regard[pc]! + (asked ? 0.5 : 0.25) * weight, -3, 3);
    if (speaker && speaker.hs) {
      speaker.hs.regard = clamp(speaker.hs.regard + (asked ? 1 : 0.5), -3, 3);
      speaker.hs.memory.push({ t: s.t, k: asked ? 'granted' : 'eased', amt: p.pressure });
      speaker.hs.esteem += o.payer === 'peers' ? -0.3 : o.payer === 'estate' || o.payer === 'court' ? 0.3 : 0.1;
    }
    // Those who pay remember it.
    if (o.payer === 'household') {
      for (const h of resolve(s, o.payerRef)) {
        if (h.hs) { h.hs.regard = clamp(h.hs.regard - 1, -3, 3); h.hs.memory.push({ t: s.t, k: 'paid', amt: 1 }); }
        grieve(s, cid(h.region, h.estate), P.payerGrievance * (h.hs ? 0.5 : 1), 'made to pay');
        if (h.estate !== p.estate) { s.accord[p.estate]![h.estate] = clamp(s.accord[p.estate]![h.estate]! - 0.1, -1, 1); s.accord[h.estate]![p.estate] = s.accord[p.estate]![h.estate]!; }
      }
    } else if (o.payer === 'estate' && o.payerRef.startsWith('estate:')) {
      const e = +o.payerRef.slice(7).split('@')[0]!;
      grieve(s, cid(p.region, e), P.payerGrievance, 'made to pay');
      s.accord[p.estate]![e] = clamp(s.accord[p.estate]![e]! - 0.15, -1, 1); s.accord[e]![p.estate] = s.accord[p.estate]![e]!;
    } else if (o.payer === 'peers') grieve(s, pc, P.peerGrievance, 'burden shared among peers');
  }
  if (o.holds) hold(s, o.holds, p.estate);
  if (speaker && speaker.hs) speaker.hs.lastHeard = s.t;
  const h = s.holders.find(x => x.id === p.for);
  if (h) h.petT = s.t;
  event(s, 'ruling', p.region, { pet: p.id, by: p.by, kind: o.kind, means: o.means, payer: o.payer, opt: idx, deny: deny ? 1 : 0, motive: p.motive, collective: p.collective ? 1 : 0, ask: `${ask.means}|${ask.payer}`, estate: p.estate });
}

// ---- bindings ----

export function passes(s: State, b: Binding, t: Test): boolean {
  switch (t.t) {
    case 'dutyMet': return duty(s, t.duty).provision >= t.level;
    case 'priceBelow': return s.regions[t.region]!.price <= t.level;
    case 'stocksAbove': { const h = s.holders.find(x => x.id === t.holder); return !!h && h.grain >= t.level; }
    case 'noRiot': return s.regions[t.region]!.stage < 3;
    case 'workAbove': return work(s, t.work).cond >= t.level;
    case 'notUrgent': { const h = s.holders.find(x => x.id === t.holder); return !h || h.pressure < 4; }
    case 'debtPaid': return !s.debts.some(d => d.id === t.debt);
    case 'heard': { const h = s.holders.find(x => x.id === t.holder); return !!h && !!h.hs && h.hs.lastHeard >= b.start; }
    case 'repaid': {
      // A pledge to repay the granary after harvest: it is kept if the corn can be spared, and the corn moves.
      const hs = resolve(s, t.holder);
      const spare = hs.reduce((a, h) => a + Math.max(0, h.grain - need(h) * 6), 0);
      const pay = Math.min(t.amt, spare);
      if (pay > 0) give(s, 'granary', 'grain', take(s, t.holder, 'grain', pay));
      return pay >= t.amt * 0.9;
    }
  }
}

/** Step 18. Bindings tested at the close are kept, broken or expire. */
export function bindings(s: State): void {
  for (const b of s.bindings) {
    if (b.state !== 'open' || b.start > s.t) continue;
    let done: 'kept' | 'broken' | '' = '';
    if (b.phase === 'weekly') { if (!passes(s, b, b.test)) done = 'broken'; else if (s.t >= b.end) done = 'kept'; }
    else if (s.t >= b.end) done = passes(s, b, b.test) ? 'kept' : 'broken';
    if (!done) continue;
    b.state = done;
    for (const e of done === 'kept' ? b.onKept : b.onBroken) applyEffect(s, e);
    const to = s.holders.find(h => h.id === b.to);
    if (b.by === 'court' && to) {
      if (to.hs) { to.hs.regard = clamp(to.hs.regard + (done === 'kept' ? 0.5 : -1.5), -3, 3); to.hs.memory.push({ t: s.t, k: done, amt: 1 }); }
      if (done === 'broken') { grieve(s, cid(to.region, to.estate), P.wordBroken, "the court's word broken"); s.regard[cid(to.region, to.estate)] = clamp(s.regard[cid(to.region, to.estate)]! - 0.5, -3, 3); }
    }
    event(s, done, to ? to.region : -1, { kind: b.kind, by: b.by, to: b.to, test: b.test.t, label: b.label });
  }
  s.bindings = s.bindings.filter(b => b.state === 'open' || s.t - b.end < 6);
  s.laws = s.laws.filter(l => l.until > s.t);
  void souls;
}
