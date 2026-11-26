// Steps 9 and 10. Labour is shared out, then crops and herds grow or are gathered.
// The farming calendar is fixed; its outcome is not.

import { clamp, clamp01 } from '../math.ts';
import { P } from '../params.ts';
import { cause, event, woe } from '../ledger.ts';
import { CAP, COMMONER, CROPS, dutyId, duty, inWeeks, weekOf, type Crop, type Holder, type State } from '../types.ts';
import { inRegion, need, shares } from '../util.ts';

const band = (x: number, lo: number, a: number, b: number, hi: number): number =>
  x <= lo || x >= hi ? 0 : x < a ? (x - lo) / (a - lo) : x > b ? (hi - x) / (hi - b) : 1;
export const growT = (t: number): number => 0.2 + 0.8 * band(t, -3, 6.5, 21, 31);
export const growM = (m: number): number => 0.3 + 0.7 * band(m, 0.1, 0.6, 1.55, 2.7);

/** Field work an acre of this crop wants this week, in worker-weeks. */
function fieldWork(c: number, w: number): number {
  const spring = c !== 0;
  if (inWeeks(w, P.harvestStart, P.harvestEnd)) return P.labHarvest;
  if (spring && inWeeks(w, P.sowStart, P.sowEnd)) return P.labSow;
  if (!spring && inWeeks(w, P.wheatSowStart, P.wheatSowEnd)) return P.labSow * 1.6;
  return P.labTend;
}

/** Step 9. Each holder's hands go first to its own fields in season. */
export function labour(prev: State, s: State): void {
  const w = weekOf(s.t);
  for (const h of s.holders) {
    const sick = prev.regions[h.region]!.sick;
    const houseSick = h.hs && h.hs.sick ? 0.5 : 1;
    h.lab.avail = h.workers * h.h * (0.5 + 0.5 * h.n) * (1 - sick) * houseSick;
    let want = 0;
    for (let c = 0; c < 3; c++) {
      const sowing = c === 0 ? inWeeks(w, P.wheatSowStart, P.wheatSowEnd) : inWeeks(w, P.sowStart, P.sowEnd);
      want += (sowing ? h.acres[c]! : h.sown[c]!) * fieldWork(c, w);
    }
    if (inWeeks(w, P.hayStart, P.hayEnd)) want += h.beasts * P.labHay;
    h.lab.field = Math.min(h.lab.avail, want);
    h.lab.fr = want > 0 ? h.lab.field / want : 1;
    h.lab.duty = 0;
    h.lab.craft = 0;
  }
}

function resetCrop(c: Crop): void {
  c.sown = 0; c.g = 0; c.gbar = 0; c.frost = 0; c.blight = 0; c.flood = 0; c.frostWeek = 0; c.harv = 0; c.lostLabour = 0;
}

export const growthIndex = (c: Crop): number => (c.gbar > 0 ? clamp(c.g / c.gbar, 0.35, 1.3) : 1);

/** Step 10. */
export function production(prev: State, s: State): void {
  const w = weekOf(s.t);
  for (let r = 0; r < 3; r++) {
    const R = s.regions[r]!, k = R.sky, hs = inRegion(s, r);
    const farmers = hs.filter(h => h.acres[0]! + h.acres[1]! + h.acres[2]! > 0);

    for (let c = 0; c < 3; c++) {
      const crop = R.crops[c]!, spring = c !== 0;
      const acres = farmers.reduce((a, h) => a + h.acres[c]!, 0);
      if (acres <= 0) continue;

      // Sowing, from the seed and the hands actually there.
      const sowing = spring ? inWeeks(w, P.sowStart, P.sowEnd) : inWeeks(w, P.wheatSowStart, P.wheatSowEnd);
      if (sowing) {
        const weeks = spring ? P.sowEnd - P.sowStart + 1 : P.wheatSowEnd - P.wheatSowStart + 1;
        for (const h of farmers) {
          if (h.acres[c]! <= 0) continue;
          const total = h.acres[0]! + h.acres[1]! + h.acres[2]!;
          const ox = clamp01((h.beasts * P.acresPerBeast) / total);
          let a = Math.min((h.acres[c]! / weeks) * h.lab.fr * (0.6 + 0.4 * ox), h.acres[c]! - h.sown[c]!);
          const per = P.yield0[c]! * P.seedShare;
          if (h.seed < a * per) {
            // A household short of seed sows from the corn it can spare.
            const spare = Math.max(0, h.grain - need(h) * P.seedSpareWeeks);
            const take = Math.min(spare, a * per - h.seed);
            h.grain -= take; h.seed += take;
          }
          if (h.seed < a * per) a = h.seed / per;
          if (a <= 0) continue;
          h.seed -= a * per; h.sown[c] = h.sown[c]! + a; crop.sown += a;
        }
        const last = spring ? P.sowEnd : P.wheatSowEnd;
        if (w === last && crop.sown < 0.9 * acres) {
          event(s, 'unsown', r, { crop: CROPS[c]!, share: Math.round((100 * crop.sown) / acres) });
          cause(s, `crop.${r}.${c}`, 'unsown', crop.sown / acres - 1);
        }
      }

      // Growth, frost and blight.
      const growing = spring ? inWeeks(w, P.sowStart + 4, P.harvestStart - 1) : inWeeks(w, 4, P.harvestStart - 1);
      if (growing && crop.sown > 0) {
        crop.g += growT(k.temp) * growM(k.moist);
        crop.gbar += growT(k.tBar) * growM(1);
        const tender = (spring ? (inWeeks(w, P.sowStart + 5, 19) ? 0.4 + 0.6 * clamp01((w - P.sowStart - 5) / 6) : 0) : inWeeks(w, 13, 19) ? 0.6 : 0) * (c === 2 ? 0.6 : 1);
        if (k.tmin < 0 && tender > 0) {
          const kill = clamp(-k.tmin / P.frostScale, 0, 0.5) * tender;
          if (kill > 0.02) {
            crop.frost = 1 - (1 - crop.frost) * (1 - kill);
            crop.frostWeek = w;
            event(s, 'frost', r, { crop: CROPS[c]!, kill: Math.round(kill * 100), w });
            cause(s, `crop.${r}.${c}`, 'frost', -kill, `w${w}`);
          }
        }
        if (inWeeks(w, 15, P.harvestStart + 1) && k.temp > P.blightTemp && k.moist > P.blightMoist) {
          const add = P.blightRate * (k.moist - P.blightMoist) * clamp((k.temp - P.blightTemp) / 4, 0.25, 1.5);
          const was = crop.blight;
          crop.blight = Math.min(0.55, crop.blight + add);
          cause(s, `crop.${r}.${c}`, 'blight', -add);
          if (was < 0.1 && crop.blight >= 0.1) event(s, 'blight', r, { crop: CROPS[c]! });
        }
      }
      if (crop.sown > 0) crop.outlook = (crop.sown / acres) * growthIndex(crop) * (1 - crop.frost) * (1 - crop.blight) * (1 - crop.flood) * crop.fert;

      // The harvest: a share falls due each week, and what hands cannot reach is lost.
      if (inWeeks(w, P.harvestStart, P.harvestEnd) && crop.sown > 0) {
        const left = P.harvestEnd - w + 1;
        const perAcre = P.yield0[c]! * crop.fert * growthIndex(crop) * (1 - crop.frost) * (1 - crop.blight) * (1 - crop.flood);
        // Absentee lords and the cathedral chapter in the Capital draw a share of country rents and tithes.
        const nobles = s.holders.filter(h => h.rents > 0 && (h.region === r || h.region === CAP));
        const clergy = s.holders.filter(h => h.livings > 0 && (h.region === r || h.region === CAP));
        const away = (h: Holder): number => (h.region === r ? 1 : P.absentee);
        const tithe = duty(s, dutyId('tithe', r));
        let rent = 0, tenth = 0, crown = 0;
        for (const h of farmers) {
          if (h.sown[c]! <= 0) continue;
          const due = h.sown[c]! / left;
          const cut = due * h.lab.fr, lost = due * (1 - h.lab.fr) * P.harvestWaste;
          h.sown[c] = h.sown[c]! - cut - lost;
          crop.lostLabour += lost * perAcre;
          const gross = cut * perAcre;
          crop.harv += gross;
          // Seed for next year is the first claim on the harvest.
          const target = (h.acres[0]! * P.yield0[0]! + h.acres[1]! * P.yield0[1]! + h.acres[2]! * P.yield0[2]!) * P.seedShare;
          const seed = Math.min(gross * P.seedFirst, Math.max(0, target - h.seed)), net = gross - seed;
          const giveTithe = net * P.titheShare * (R.devotion < P.titheGrudge ? 0.75 : 1);
          const giveRent = h.estate === COMMONER ? net * P.rentShare : 0;
          const giveCrown = net * P.crownShare;
          h.seed += seed;
          h.grain += net - giveTithe - giveRent - giveCrown;
          rent += giveRent; tenth += giveTithe; crown += giveCrown;
          tithe.required += net * P.titheShare; tithe.delivered += giveTithe;
        }
        const rs = shares(nobles, h => h.rents * away(h), rent), ts = shares(clergy, h => h.livings * (h.region === r ? 1 : P.absentee * 0.5), tenth);
        nobles.forEach((h, i) => { h.grain += rs[i]!; });
        clergy.forEach((h, i) => { h.grain += ts[i]!; });
        if (nobles.length === 0) crown += rent;
        if (clergy.length === 0) crown += tenth;
        s.granary += crown;
        cause(s, 'granary', 'dues in kind', crown);

        if (w === P.harvestEnd) {
          const normal = acres * P.yield0[c]!;
          const ratio = crop.harv / normal;
          const gi = growthIndex(crop);
          const losses: [string, number][] = [
            ['unsown', 1 - crop.sown / acres], ['frost', crop.frost], ['blight', crop.blight], ['flood', crop.flood],
            [k.moist < 0.8 ? 'drought' : gi < 1 ? 'cold' : 'growth', 1 - gi], ['hands', crop.lostLabour / normal], ['soil', 1 - crop.fert],
          ];
          losses.sort((a, b) => b[1] - a[1]);
          const main = losses[0]![1] > 0.04 ? losses[0]![0] : 'none';
          event(s, 'harvest', r, { crop: CROPS[c]!, pct: Math.round(ratio * 100), main, mainPct: Math.round(losses[0]![1] * 100), second: losses[1]![1] > 0.04 ? losses[1]![0] : 'none', frostWeek: crop.frostWeek, rations: Math.round(crop.harv) });
          if (ratio < 0.92) {
            for (const h of farmers) {
              if (h.acres[c]! <= 0) continue;
              woe(s, h, main === 'none' ? 'harvest' : main, (1 - ratio) * h.acres[c]! * P.yield0[c]! * 0.5, main === 'frost' ? `w${crop.frostWeek}` : CROPS[c]!);
            }
            for (const h of nobles) woe(s, h, 'rents', (1 - ratio) * normal * P.rentShare * 0.5 * ((h.rents * away(h)) / Math.max(1, nobles.reduce((a, x) => a + x.rents * away(x), 0))), main);
          }
          for (const l of losses) if (l[1] > 0.01) cause(s, `harvest.${r}`, l[0], -l[1] * normal);
          crop.last = ratio;
          // Fertility is settled once a year: land sown short rests, land sown full tires.
          crop.fert = clamp(crop.fert + P.fertRest * (1 - crop.sown / acres) + P.fertDrift * (1 - crop.fert), 0.7, 1.1);
          for (const h of farmers) h.sown[c] = 0;
          resetCrop(crop);
        }
      }
    }

    herds(s, r, hs, w);
  }
}

function herds(s: State, r: number, hs: Holder[], w: number): void {
  const R = s.regions[r]!, k = R.sky;
  const grass = clamp((growT(k.temp) * growM(k.moist)) / Math.max(0.2, growT(k.tBar) * growM(1)), 0.3, 1.4);
  const winter = w >= P.martinmas || w <= P.winterEnd;
  const weeks = 52 - P.martinmas + 1 + P.winterEnd;
  for (const h of hs) {
    if (h.beasts <= 0.01) { h.beasts = 0; continue; }
    // Milk, cheese and the odd beast for the pot.
    h.grain += h.beasts * P.dairy * (winter ? 0.5 : 1.5) * clamp01(grass);
    if (inWeeks(w, P.lambStart, P.lambEnd)) h.beasts *= 1 + P.lambRate * (0.5 + 0.5 * h.n);
    if (inWeeks(w, P.shearStart, P.shearEnd)) h.wool += (h.beasts * P.fleece) / (P.shearEnd - P.shearStart + 1);
    if (inWeeks(w, P.hayStart, P.hayEnd)) h.hay += ((h.beasts * P.hayPerBeast * P.hayMargin) / (P.hayEnd - P.hayStart + 1)) * grass * h.lab.fr;
    if (w === P.martinmas) {
      // Martinmas: beasts that cannot be fed through the winter are killed and salted.
      const keep = Math.min(h.herd0, h.hay / P.hayPerBeast);
      const kill = Math.max(0, h.beasts - keep);
      const usual = Math.max(0, h.beasts - h.herd0);
      h.beasts -= kill; h.grain += kill * P.meatPerBeast;
      if (kill > usual * 1.3 + 1 && h.hs === null) {
        event(s, 'slaughter', r, { extra: Math.round(kill - usual), who: h.id });
        woe(s, h, 'fodder', (kill - usual) * P.meatPerBeast, 'hay');
      }
    }
    if (winter) {
      const hard = k.temp < k.tBar - 3 || k.snow > P.snowBlock ? 1.35 : 1;
      const eat = (h.beasts * P.hayPerBeast * hard) / weeks;
      if (h.hay >= eat) h.hay -= eat;
      else {
        const starved = h.beasts * P.starveBeasts * (1 - h.hay / eat);
        h.hay = 0; h.beasts -= starved; h.grain += starved * P.meatPerBeast * 0.4;
        woe(s, h, 'fodder', starved * P.meatPerBeast, 'winter');
      }
    } else if (w === P.winterEnd + 1) h.hay *= 0.3;
  }
}
