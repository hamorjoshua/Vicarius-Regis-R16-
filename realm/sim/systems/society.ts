// Steps 16 and 19. Society: pressure read from the material state, then grievance, unrest, migration and riots.
// Grievance is political and held by a constituency; unrest is physical and held by a region.

import { clamp, clamp01, log2 } from '../math.ts';
import { P } from '../params.ts';
import { cause, event, topCause, woe } from '../ledger.ts';
import { CAP, CLERIC, COMMONER, ESTATES, MERCHANT, OFFICIAL, cid, cohort, lawOf, souls, weekOf, type Holder, type State } from '../types.ts';
import { inRegion, isQuarterDay, need, weeksToHarvest } from '../util.ts';
import { tradePrice } from './markets.ts';

/** Weeks of cover: what a holder has and expects, against what it must eat and pay. */
export function coverOf(s: State, h: Holder): { cover: number; threats: number; debtGap: number; creditor: string } {
  const w = weekOf(s.t), pT = tradePrice(s, h.region), nd = Math.max(0.01, need(h)), H = P.coverHorizon;
  let harvest = 0;
  if (weeksToHarvest(w) <= H || (w >= P.harvestStart && w <= P.harvestEnd)) {
    const crops = s.regions[h.region]!.crops;
    for (let c = 0; c < 3; c++) harvest += h.sown[c]! * P.yield0[c]! * crops[c]!.fert * (1 - crops[c]!.frost) * (1 - crops[c]!.blight) * (1 - crops[c]!.flood) * P.keepShare;
  }
  let due = h.duesOwed, soon = 0, creditor = '';
  for (const d of s.debts) if (d.debtor === h.id) {
    const owe = d.principal * (1 + d.rate);
    if (d.due - s.t <= H) due += owe;
    if (d.due - s.t <= P.debtWarn) { soon += owe; creditor = d.creditor; }
  }
  const assets = h.grain + h.coin / pT + (Math.max(0, h.income) * H) / pT + harvest;
  const cover = assets / (nd + due / pT / H);
  const debtGap = Math.max(0, soon - Math.max(0, h.coin - nd * pT * 2));
  let threats = debtGap > 0 ? 1 : 0;
  if (h.hs) threats += (h.hs.charge > 0 ? 1 : 0) + (h.hs.sick ? 1 : 0);
  else if (s.regions[h.region]!.sick > P.sickThreat) threats += 1;
  return { cover, threats, debtGap, creditor };
}

/** Pressure is read, never set. Sixteen weeks of cover reads 0; one week or less reads 8. */
export function readouts(s: State): void {
  for (const h of s.holders) {
    const c = coverOf(s, h);
    h.cover = c.cover;
    h.threats = c.threats;
    h.pressure = clamp(Math.max(0, 2 * (4 - log2(Math.max(0.5, c.cover)))) + c.threats, 0, 8);
    if (c.debtGap > 0) h.woes['debt'] = { amt: Math.max(h.woes['debt']?.amt ?? 0, c.debtGap / tradePrice(s, h.region)), t: s.t, note: c.creditor };
  }
}

export const STAGES = ['quiet', 'murmur', 'disorder', 'riot', 'revolt'];

export function society(prev: State, s: State, migrate = true): void {
  const w = weekOf(s.t);
  readouts(s);

  for (let r = 0; r < 3; r++) {
    const R = s.regions[r]!, hs = inRegion(s, r);
    const N = hs.reduce((a, h) => a + souls(h), 0);

    // Grievance grows with the real hardship of a constituency's members.
    let gMax = 0, regard = 0;
    for (let e = 0; e < 6; e++) {
      const i = cid(r, e), c = cohort(s, r, e);
      let g = s.grievance[i]! * P.grievanceKeep;
      const hard = P.grievanceHard * Math.max(0, c.pressure - P.grievanceLine);
      const hunger = P.grievanceHunger * clamp01(c.short / Math.max(1, need(c)));
      const owedWeeks = c.arrears / Math.max(1, c.workers * P.paySoldier);
      const owed = owedWeeks > 2 ? P.grievanceArrears * clamp01(owedWeeks / P.arrearsWeeks) : 0;
      g += hard + hunger + owed;
      if (hard > 0) { const top = Object.keys(c.woes).sort((a, b) => c.woes[b]!.amt - c.woes[a]!.amt)[0]; cause(s, `grievance.${i}`, top ?? 'hardship', hard); }
      if (hunger > 0) cause(s, `grievance.${i}`, 'hunger', hunger);
      if (owed > 0) cause(s, `grievance.${i}`, 'arrears', owed);
      s.grievance[i] = clamp(g, 0, 4);
      s.regard[i] = s.regard[i]! * P.regardKeep;
      gMax = Math.max(gMax, s.grievance[i]! * (e === COMMONER ? 1 : 0.6));
      regard += s.regard[i]! * (e === COMMONER ? 0.5 : 0.1);
    }

    // Unrest.
    const commons = cohort(s, r, COMMONER);
    const H = R.hungry / N;
    // Those who eat from their own barns do not riot over the price of bread.
    const buys = clamp01(1 - commons.grain / (need(commons) * P.pantryWeeks * 3));
    const bread = Math.max(0, (R.price / Math.max(0.1, R.wage)) / (R.priceRef / R.wageRef) - 1) * buys;
    const D = clamp((R.deaths - R.deathsExp) / N * P.unrestDeathScale, 0, 2);
    const J = clamp01(1 - R.wage / R.wageRef) * buys;
    const up: [string, number][] = [
      ['hunger', P.uHunger * H], ['dear bread', P.uBread * bread], ['grievance', P.uGrievance * gMax],
      ['deaths', P.uDeaths * D], ['idle hands', P.uIdle * J], ['rumour', P.uRumour * R.rumour.scarcity],
    ];
    const down: [string, number][] = [
      ['the watch', P.uWatch * R.watch], ['consolation', P.uChurch * R.devotion], ['regard for the court', P.uRegard * Math.max(0, regard)], ['alms', P.uAlms * R.almsSeen],
    ];
    const rise = up.reduce((a, x) => a + x[1], 0), fall = down.reduce((a, x) => a + x[1], 0);
    const was = R.unrest;
    R.unrest = clamp(P.unrestKeep * R.unrest + Math.max(0, rise - fall * clamp01(rise * 2)), 0, 5);
    for (const x of up) if (x[1] > 0.01) cause(s, `unrest.${r}`, x[0], x[1]);
    const stage = R.unrest < 1 ? 0 : R.unrest < 2 ? 1 : R.unrest < 3 ? 2 : R.unrest < 4 ? 3 : 4;
    up.sort((a, b) => b[1] - a[1]);
    if (stage > R.stage && stage !== 3) event(s, STAGES[stage]!, r, { why: up[0]![0], also: up[1]![1] > 0.05 ? up[1]![0] : '' });
    R.stage = stage;
    void was;

    // Riot: a crowd attacks whoever the ledger blames.
    if (stage >= 3 && s.t - R.riotT >= P.riotGap) {
      R.riotT = s.t;
      const why = up[0]![0];
      const priceWhy = topCause(s, `price.${r}`);
      let target = R.blame >= 0 ? R.blame : why === 'dear bread' || why === 'rumour' || (priceWhy && priceWhy.k === 'hoarding') ? MERCHANT : why === 'grievance' ? OFFICIAL : R.devotion < 0.3 ? CLERIC : MERCHANT;
      if (why === 'hunger' && r === CAP && s.granary > 2000) target = -1;
      let took = 0, burned = 0;
      if (target < 0) { took = s.granary * P.riotTake; s.granary -= took; cause(s, 'granary', 'riot', -took); }
      else for (const h of hs) if (h.estate === target) {
        const g = h.grain * P.riotTake, c = h.coin * P.riotTake * 0.5;
        h.grain -= g; h.coin -= c; took += g; burned += c;
        commons.coin += c;
        woe(s, h, 'riot', g + c / R.price, 'crowd');
      }
      commons.grain += took * 0.7;
      const dead = commons.workers * P.riotDeaths;
      commons.workers -= dead; R.deaths += dead;
      R.unrest -= P.riotVent;
      if (target >= 0) { s.grievance[cid(r, target)] = clamp(s.grievance[cid(r, target)]! + P.riotGrievance, 0, 4); cause(s, `grievance.${cid(r, target)}`, 'riot unchecked', P.riotGrievance); }
      event(s, 'riot', r, { why, target: target < 0 ? 'the granary' : ESTATES[target]!, took: Math.round(took), dead: Math.round(dead), blamed: R.blame >= 0 ? 1 : 0 });
    }
  }

  // Migration: people move when prospects elsewhere beat home by more than the cost of moving.
  const prospect = (r: number): number => {
    const c = cohort(s, r, COMMONER), R = s.regions[r]!;
    const N = inRegion(s, r).reduce((a, h) => a + souls(h), 0);
    // Empty tenancies draw settlers back to land that famine or sickness has emptied.
    const room = r === CAP ? 0 : P.landDraw * clamp(R.souls0 / Math.max(1, N) - 1.15, 0, 2);
    return c.n * (0.8 + 0.2 * clamp(R.wage / R.price / (R.wageRef / R.priceRef), 0.3, 3)) - R.sick + (r === CAP ? P.capitalDraw : 0) + room;
  };
  if (!migrate) return;
  for (let r = 0; r < 3; r++) s.regions[r]!.moved *= 0.9;
  for (let r = 0; r < 3; r++) {
    if (lawOf(s, 'quarantine', r)) continue;
    const here = prospect(r), from = cohort(s, r, COMMONER);
    // Only the pinched think of leaving.
    const pinched = from.n <= 0.95 || from.pressure >= 1.5;
    let best = -1, bestV = here + P.migrateCost * (pinched ? 1 : 3);
    for (let q = 0; q < 3; q++) if (q !== r && !lawOf(s, 'quarantine', q) && prospect(q) > bestV) { best = q; bestV = prospect(q); }
    if (best < 0) continue;
    const frac = clamp(P.migrateRate * (bestV - here - P.migrateCost * (pinched ? 1 : 3)) * 10, 0, P.migrateMax * (from.n < 0.75 ? 4 : 1));
    if (frac <= 0) continue;
    const to = cohort(s, best, COMMONER);
    const mw = from.workers * frac, md = from.deps * frac;
    // The poor move with what they can carry.
    const coin = from.coin * frac * 0.5, grain = from.grain * frac * 0.3;
    to.n = (to.n * souls(to) + from.n * (mw + md)) / (souls(to) + mw + md);
    from.workers -= mw; from.deps -= md; from.coin -= coin; from.grain -= grain;
    to.workers += mw; to.deps += md; to.coin += coin; to.grain += grain;
    const A = s.regions[r]!, B = s.regions[best]!;
    B.moved += mw + md;
    // Sickness travels with them.
    for (let d = 0; d < 3; d++) { const k = A.disease[d]!.I * frac; A.disease[d]!.I -= k; B.disease[d]!.I += k; }
    if (B.moved > P.migrateNote * B.souls0 && !prev.record.some(e => e.k === 'migration' && e.r === best && e.t > s.t - 12))
      event(s, 'migration', best, { from: r, n: Math.round(B.moved), why: from.n < 0.85 ? 'hunger' : 'wages' });
  }
  void isQuarterDay; void w;
}
