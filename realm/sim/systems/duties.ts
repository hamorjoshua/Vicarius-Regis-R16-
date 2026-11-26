// Step 11. Obligations: what each purpose of the realm requires, split among those who owe it.
// A shortfall harms the purpose itself.

import { clamp01 } from '../math.ts';
import { P } from '../params.ts';
import { cause, event, woe } from '../ledger.ts';
import { CLERIC, COMMONER, MERCHANT, NOBLE, OFFICIAL, SOLDIER, cid, duty, dutyId, inWeeks, souls, weekOf, type Duty, type Holder, type State } from '../types.ts';
import { inRegion, isQuarterDay, need, shares } from '../util.ts';

/** How much of its share a holder will give: the aggrieved and the desperate hold back. */
export function willing(s: State, h: Holder): number {
  const g = s.grievance[cid(h.region, h.estate)]!;
  return (g >= P.withholdGrievance ? P.withholdShare : 1) * (h.pressure >= 5 ? 0.3 : h.pressure >= 3 ? 0.7 : 1);
}

/** Each holder's share of a requirement, after rulings: changed weights, and excused shares passed on. */
export function assess(s: State, d: Duty, payers: Holder[], weight: (h: Holder) => number, required: number): number[] {
  const sh = shares(payers, h => weight(h) * (d.mod[h.id] ?? 1), required);
  for (let i = 0; i < payers.length; i++) {
    const ex = d.excuse[payers[i]!.id];
    if (!ex || ex.until <= s.t) continue;
    const mine = sh[i]!;
    sh[i] = 0;
    if (ex.onto === 'duty') continue;
    const h = payers[i]!;
    const takers = payers.filter((x, j) => j !== i && !(d.excuse[x.id] && d.excuse[x.id]!.until > s.t) &&
      (ex.onto === 'peers' ? x.estate === h.estate : ex.onto.startsWith('estate:') ? x.estate === +ex.onto.slice(7) : x.id === ex.onto));
    const extra = shares(takers, weight, mine);
    takers.forEach((x, j) => { sh[payers.indexOf(x)] = sh[payers.indexOf(x)]! + extra[j]!; });
  }
  return sh;
}

function settle(d: Duty): void {
  if (d.required > 0) d.provision = clamp01(d.delivered / d.required);
}

export function duties(prev: State, s: State): void {
  const w = weekOf(s.t);
  for (const d of s.duties) if (d.kind !== 'tithe') { d.required = 0; d.delivered = 0; }

  for (let r = 0; r < 3; r++) {
    const R = s.regions[r]!, hs = inRegion(s, r), price = prev.regions[r]!.price;

    // Provisioning: feed and billet the garrison.
    {
      const d = duty(s, dutyId('provisioning', r));
      const soldiers = hs.filter(h => h.estate === SOLDIER), payers = hs.filter(h => h.estate !== SOLDIER);
      d.required = soldiers.reduce((a, h) => a + need(h), 0) * P.provShare;
      const sh = assess(s, d, payers, h => souls(h) * P.provWeight[h.estate]!, d.required);
      let grain = 0, coin = 0;
      payers.forEach((h, i) => {
        const will = willing(s, h);
        const g = Math.min(sh[i]!, Math.max(0, h.grain - need(h) * P.provKeepWeeks)) * will;
        // Those who buy their bread week by week pay their share in coin.
        const c = Math.min((sh[i]! - g) * price, Math.max(0, h.coin - need(h) * price)) * will;
        h.grain -= g; h.coin -= c; grain += g; coin += c;
        if (h.pressure >= 2) woe(s, h, 'duty', g + c / price, 'provisioning');
      });
      const ns = shares(soldiers, need, 1);
      soldiers.forEach((h, i) => { h.grain += grain * ns[i]!; h.coin += coin * ns[i]!; });
      d.delivered = grain + coin / price;
      settle(d);
    }

    // Relief: feed those who went short last week.
    {
      const d = duty(s, dutyId('relief', r));
      const hungry = hs.filter(h => h.short > 0);
      d.required = hungry.reduce((a, h) => a + h.short, 0);
      R.almsSeen *= 0.8;
      if (d.required > 0) {
        const payers = hs.filter(h => h.estate === CLERIC || h.estate === NOBLE || h.estate === MERCHANT);
        const sh = assess(s, d, payers, h => souls(h) * P.reliefWeight[h.estate]! * (h.estate === CLERIC ? 0.4 + 1.2 * R.devotion : 1), d.required);
        let given = 0;
        payers.forEach((h, i) => {
          const g = Math.min(sh[i]!, Math.max(0, h.grain - need(h) * P.reliefKeepWeeks) * P.reliefOpen) * willing(s, h);
          h.grain -= g; given += g;
        });
        const hsShare = shares(hungry, h => h.short, given);
        hungry.forEach((h, i) => { h.grain += hsShare[i]!; });
        d.delivered = given;
        R.almsSeen = clamp01(R.almsSeen + 0.2 * (given / d.required));
        settle(d);
      } else d.provision = 1;
    }

    // Works: build and repair, in the building season, with hands left over from the fields.
    {
      const d = duty(s, dutyId('works', r));
      const works = s.works.filter(x => x.region === r);
      const season = inWeeks(w, P.worksStart, P.worksEnd);
      const levied = works.filter(x => x.levy > s.t);
      d.required = (season ? works.reduce((a, x) => a + P.workNeed[x.kind]!, 0) : 0) + levied.length * P.levyLabour;
      if (d.required > 0) {
        const payers = hs.filter(h => h.estate === COMMONER);
        const sh = assess(s, d, payers, h => h.workers, d.required);
        let given = 0;
        payers.forEach((h, i) => {
          const g = Math.min(sh[i]!, Math.max(0, h.lab.avail - h.lab.field)) * (levied.length ? Math.max(0.8, willing(s, h)) : willing(s, h));
          h.lab.duty += g; given += g;
          if (h.pressure >= 2) woe(s, h, 'duty', g * P.wage0 / price, 'works');
        });
        d.delivered = given;
        settle(d);
        for (const x of works) {
          const gain = (season ? P.workRepair * d.provision : 0) + (x.levy > s.t ? P.levyRepair * d.provision : 0);
          x.cond = clamp01(x.cond + gain);
          cause(s, `works.${x.id}`, x.levy > s.t ? 'levy' : 'works duty', gain);
        }
      }
    }

    // Watch: keep order and guard the walls.
    {
      const d = duty(s, dutyId('watch', r));
      d.required = hs.reduce((a, h) => a + souls(h), 0) * P.watchPerSoul;
      let given = 0;
      for (const h of hs) if (h.estate === SOLDIER) { const g = h.lab.avail * P.watchSoldier; h.lab.duty += g; given += g; }
      const payers = hs.filter(h => h.estate === COMMONER);
      const sh = assess(s, d, payers, h => h.workers, Math.max(0, d.required - given));
      payers.forEach((h, i) => {
        const g = Math.min(sh[i]!, Math.max(0, h.lab.avail - h.lab.field - h.lab.duty)) * willing(s, h);
        h.lab.duty += g; given += g;
      });
      d.delivered = Math.min(given, d.required);
      settle(d);
      R.watch = 0.7 * R.watch + 0.3 * clamp01(d.provision * (R.patrol > s.t ? 1.3 : 1));
    }

    // Dues: the Crown's coin, owed on quarter days.
    {
      const d = duty(s, dutyId('dues', r));
      const quarter = isQuarterDay(w);
      let got = 0, inKind = 0;
      for (const h of hs) {
        let owed = h.duesOwed;
        if (quarter) {
          const fresh = (h.estate === NOBLE ? P.duesLand * h.rents : h.estate === CLERIC ? P.duesLand * 0.25 * h.livings :
            h.estate === MERCHANT ? P.duesTrade * h.trade : h.estate === COMMONER ? P.duesHearth * souls(h) : 0) * (1 - h.remit);
          h.remit = 0;
          owed += fresh;
          d.required += fresh;
        }
        if (owed <= 0) continue;
        const can = Math.max(0, h.coin - need(h) * price * P.duesKeepWeeks);
        const pay = Math.min(owed, can) * (quarter ? willing(s, h) : 0.25);
        h.coin -= pay; got += pay;
        let left = owed - pay;
        // Dues are owed in coin or kind: a lord rich in corn and poor in silver sends corn.
        if (quarter && left > 0) {
          const kind = Math.min(left / P.grainPrice, Math.max(0, h.grain - need(h) * P.duesKindKeep)) * willing(s, h);
          h.grain -= kind; s.granary += kind; left -= kind * P.grainPrice; inKind += kind * P.grainPrice;
          cause(s, 'granary', 'dues in kind', kind);
        }
        if (quarter && left > 0.2 * owed && h.pressure >= 2) woe(s, h, 'dues', left / price, 'dues');
        if (quarter && h.pressure >= 2) woe(s, h, 'dues', pay / price, 'dues');
        h.duesOwed = left;
      }
      if (got > 0) {
        // Officials take their fee; a strained collector takes more.
        const officials = hs.filter(h => h.estate === OFFICIAL);
        const fee = got * P.collectFee;
        const fs = shares(officials, h => h.workers, fee);
        officials.forEach((h, i) => { h.coin += fs[i]!; h.got += fs[i]!; });
        let net = got - (officials.length ? fee : 0);
        const off = s.offices.find(o => o.power === 'collect' && o.region === r);
        const holder = off && off.holder ? s.holders.find(h => h.id === off.holder) : undefined;
        if (off && holder && holder.pressure >= P.skimPressure) {
          const skim = net * P.skimRate;
          holder.coin += skim; holder.got += skim; off.skim += skim; net -= skim;
          cause(s, 'purse', 'skimmed', -skim, holder.id);
        }
        s.purse += net;
        cause(s, 'purse', 'dues', net);
      }
      if (quarter) { d.delivered = got + inKind; settle(d); }
    }
  }

  // The purse pays the garrison and the officials; what it cannot pay is owed.
  const paid = s.holders.filter(h => h.estate === SOLDIER || h.estate === OFFICIAL);
  const due = paid.map(h => h.workers * (h.estate === SOLDIER ? P.paySoldier : P.payOfficial));
  const total = due.reduce((a, b) => a + b, 0);
  const ratio = total > 0 ? clamp01(Math.max(0, s.purse) / total) : 1;
  paid.forEach((h, i) => {
    const pay = due[i]! * ratio;
    h.coin += pay; h.got += pay; h.arrears += due[i]! - pay;
    if (ratio < 0.999) woe(s, h, 'arrears', (due[i]! - pay) / prev.regions[h.region]!.price, 'pay');
  });
  s.purse -= total * ratio;
  cause(s, 'purse', 'pay', -total * ratio);
  if (ratio < 0.999 && !(prev.holders.some(h => h.arrears > 0))) event(s, 'arrears', -1, { short: Math.round(total * (1 - ratio)) });
  const spare = s.purse - total * P.arrearsBuffer;
  const owedAll = paid.reduce((a, h) => a + h.arrears, 0);
  if (spare > 0 && owedAll > 0) {
    const pay = Math.min(owedAll, spare * 0.25);
    for (const h of paid) { const p = (pay * h.arrears) / owedAll; h.coin += p; h.got += p; h.arrears -= p; }
    s.purse -= pay;
    cause(s, 'purse', 'arrears paid', -pay);
  }
}
