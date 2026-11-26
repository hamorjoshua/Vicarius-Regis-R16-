// Step 14. Health: sickness spreads when conditions let it, not when a table says so.
// Pestilence alone arrives by a draw, with odds shaped by trade.

import { clamp, clamp01, pow } from '../math.ts';
import { P } from '../params.ts';
import { u01, type Chance } from '../rng.ts';
import { cause, event, woe } from '../ledger.ts';
import { ABROAD, CAP, COMMONER, COUGH, DISEASES, FEVER, MURRAIN, PEST, cohort, inWeeks, lawOf, souls, weekOf, work, type State } from '../types.ts';
import { inRegion, shares } from '../util.ts';

export function health(prev: State, s: State, ch: Chance): void {
  const w = weekOf(s.t);

  // The pestilence draw: does a carrier arrive along the sea road?
  {
    const sea = s.routes.find(x => x.b === ABROAD)!;
    const trade = 0.4 + Math.abs(sea.flow) / sea.cap;
    const shut = lawOf(s, 'quarantine', CAP) ? P.quarantineCut : 1;
    const odds = P.pestOdds * s.abroad.sickness * trade * shut;
    s.ledger['odds.pestilence'] = [
      { k: 'sickness abroad', a: s.abroad.sickness, t: s.t, x: '' }, { k: 'trade by sea', a: trade, t: s.t, x: '' },
      ...(shut < 1 ? [{ k: 'quarantine', a: shut, t: s.t, x: '' }] : []), { k: 'odds', a: odds, t: s.t, x: '' },
    ];
    const D = s.regions[CAP]!.disease[PEST]!;
    if (u01(ch, s.seed, 'pestilence', 0, s.t) < odds && D.I < 1 && D.R < 50) {
      D.I += P.pestSeed;
      event(s, 'draw', CAP, { what: 'pestilence', oneIn: Math.round(1 / odds), abroad: Math.round(s.abroad.sickness * 100), trade: Math.round(trade * 100) });
    }
  }

  for (let r = 0; r < 3; r++) {
    const R = s.regions[r]!, hs = inRegion(s, r);
    const N = hs.reduce((a, h) => a + souls(h), 0);
    const wells = work(s, `wells.${r}`).cond;
    const foul = clamp01(1 - wells + R.foul);
    const crowd = P.crowd[r]! * pow(N / R.souls0, P.crowdPower);
    const n = Math.max(0.45, cohort(s, r, COMMONER).n);
    const shut = lawOf(s, 'quarantine', r) ? 0.75 : 1;
    const temp = R.sky.temp;
    let sick = 0;
    for (let d = 0; d < 3; d++) {
      const D = R.disease[d]!;
      const season = d === FEVER ? clamp01((temp - P.feverTemp) / 6) : d === COUGH ? clamp01((P.coughTemp - temp) / 6) : 0.6 + 0.4 * clamp01((temp - 5) / 12);
      const beta = P.beta[d]! * crowd * season * shut * (d === FEVER ? 1 + P.feverFoul * foul : 1) * pow(1 / n, d === COUGH ? 1.6 : 1);
      const S = Math.max(0, N - D.I - D.R);
      const gamma = P.gamma[d]!, mu = P.mu[d]! * (d === COUGH ? 1 + 2 * (1 - n) : 1) * (R.hospital > s.t ? P.hospitalCare : 1);
      const fresh = (beta * S * D.I) / N, die = mu * D.I, rec = gamma * D.I;
      D.I = Math.max(0, D.I + fresh - rec - die);
      D.R = Math.max(0, D.R + rec - P.wane[d]! * D.R);
      if (d !== PEST) D.I = Math.max(D.I, P.reservoir * N);
      else if (D.I < 0.5) D.I = 0;
      D.dead += die;
      if (die > 0) {
        const sh = shares(hs, h => (h.hs ? 0 : souls(h) * (h.estate === COMMONER ? 1.15 : 0.7)), die);
        hs.forEach((h, i) => { const k = sh[i]! / Math.max(1, souls(h)); h.workers -= h.workers * k; h.deps -= h.deps * k; });
        R.deaths += die;
        cause(s, `deaths.${r}`, DISEASES[d]!, die);
      }
      const share = D.I / N;
      if (!D.out && share > P.outbreakLine) {
        D.out = true; D.dead = 0;
        const why = d === FEVER ? (R.foul > 0.2 ? 'fouled wells' : wells < 0.6 ? 'bad drains' : crowd > P.crowd[r]! * 1.1 ? 'crowding' : 'heat')
          : d === COUGH ? (n < 0.85 ? 'hunger' : crowd > P.crowd[r]! * 1.1 ? 'crowding' : 'cold') : 'travellers';
        event(s, 'outbreak', r, { disease: DISEASES[d]!, why, sick: Math.round(D.I) });
        cause(s, `sick.${r}`, why, share, DISEASES[d]!);
      } else if (D.out && share < P.outbreakLine / 3) {
        D.out = false;
        event(s, 'abated', r, { disease: DISEASES[d]!, dead: Math.round(D.dead) });
      }
      sick += D.I;
    }
    R.sick = clamp(sick / N, 0, 0.6);
    for (const h of hs) if (h.hs) {
      const was = h.hs.sick;
      h.hs.sick = R.sick > h.hs.constitution * P.houseSickLine;
      if (h.hs.sick && !was) woe(s, h, 'sickness', h.workers * 3, DISEASES[R.disease[0]!.I > R.disease[1]!.I ? 0 : 1]!);
    }

    // Murrain among the beasts.
    {
      const D = R.disease[MURRAIN]!;
      const B = hs.reduce((a, h) => a + h.beasts, 0);
      if (B > 10) {
        const beta = P.beta[MURRAIN]! * (R.sky.moist > 1.3 ? 1.4 : 1) * (inWeeks(w, 36, 42) ? 1.5 : 1);
        const S = Math.max(0, B - D.I - D.R);
        const fresh = (beta * S * D.I) / B, die = P.mu[MURRAIN]! * D.I, rec = P.gamma[MURRAIN]! * D.I;
        D.I = Math.max(P.reservoir * B, D.I + fresh - rec - die);
        D.R = Math.max(0, D.R + rec - P.wane[MURRAIN]! * D.R - die);
        if (die > 0) for (const h of hs) { const k = (die * h.beasts) / B; h.beasts -= k; if (die / B > 0.004) woe(s, h, 'murrain', k * P.meatPerBeast, 'murrain'); }
        if (!D.out && D.I / B > P.outbreakLine * 2) { D.out = true; event(s, 'outbreak', r, { disease: 'murrain', why: R.sky.moist > 1.3 ? 'wet pasture' : 'beasts driven to market', sick: Math.round(D.I) }); }
        else if (D.out && D.I / B < P.outbreakLine / 2) D.out = false;
      }
    }
  }

  // Pestilence travels with the carts.
  for (const route of s.routes) {
    if (route.b === ABROAD || Math.abs(route.flow) < 1) continue;
    const from = route.flow > 0 ? route.a : route.b, to = route.flow > 0 ? route.b : route.a;
    const A = s.regions[from]!.disease[PEST]!, B = s.regions[to]!.disease[PEST]!;
    if (A.I > 5 && B.I < 1 && B.R < 50) B.I += Math.min(5, P.pestCarry * A.I * (Math.abs(route.flow) / route.cap));
  }
  void prev;
}
