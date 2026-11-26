// Step 12. Markets: prices from what the barns hold against the custom of the season,
// carting while the gap pays, crafts and wages, and debts falling due.

import { clamp, clamp01, lerp, pow } from '../math.ts';
import { P } from '../params.ts';
import { z01, type Chance } from '../rng.ts';
import { cause, event, topCause, woe } from '../ledger.ts';
import { ABROAD, CAP, CLERIC, COMMONER, MERCHANT, NOBLE, HIGH, inWeeks, lawOf, souls, tieOf, weekOf, type Holder, type State } from '../types.ts';
import { barnShare, inRegion, need, shares, weeksToHarvest } from '../util.ts';

/** The share of the Martinmas salt meat customarily still in the larder. */
const larderShare = (w: number): number => { const since = w >= P.martinmas ? w - P.martinmas : w + 52 - P.martinmas; return Math.max(0, 1 - since / 34); };

const producer = (h: Holder): boolean => h.acres[0]! + h.acres[1]! + h.acres[2]! > 0 || h.rents > 0 || h.livings > 0;

/** What a holder keeps back before it will sell. The reserve grows when scarcity is expected. */
export function reserve(s: State, h: Holder, w: number): number {
  const hoard = s.regions[h.region]!.hoard;
  if (h.estate === MERCHANT) return need(h) * 4 * (1 + P.hoardMerchant * hoard);
  if (!producer(h)) return need(h) * P.pantryWeeks;
  // A high price tempts a grower to sell corn he may want later.
  const R = s.regions[h.region]!;
  const tempt = clamp(pow(R.priceRef / R.price, P.reserveGreed), 0.8, 1.05);
  return need(h) * Math.min(56, weeksToHarvest(w) + P.reserveExtra) * (1 + P.hoardReserve * hoard) * tempt;
}

/** The price actually paid: the market's, unless an assize caps it. */
export function tradePrice(s: State, r: number): number {
  const cap = lawOf(s, 'assize', r);
  return cap ? Math.min(cap.value, s.regions[r]!.price) : s.regions[r]!.price;
}

function sell(sellers: Holder[], offers: number[], total: number, qty: number, price: number): void {
  if (total <= 0 || qty <= 0) return;
  for (let i = 0; i < sellers.length; i++) {
    const q = (qty * offers[i]!) / total;
    sellers[i]!.grain -= q; sellers[i]!.coin += q * price; sellers[i]!.got += q * price;
    offers[i] = offers[i]! - q;
  }
}

export function markets(prev: State, s: State, ch: Chance): void {
  const w = weekOf(s.t);

  // The world abroad drifts on its own, once a month.
  if (s.t % 4 === 0) {
    s.abroad.grain = clamp(s.abroad.grain + P.abroadRevert * (P.abroadGrain - s.abroad.grain) + P.abroadSigma * z01(ch, s.seed, 'abroad', 0, s.t, 0), 0.7, 1.9);
    s.abroad.cloth = clamp(s.abroad.cloth + P.abroadRevert * (1 - s.abroad.cloth) + P.abroadSigma * z01(ch, s.seed, 'abroad', 0, s.t, 1), 0.6, 1.5);
    s.abroad.sickness = clamp(s.abroad.sickness + 0.2 * (1 - s.abroad.sickness) + 0.35 * z01(ch, s.seed, 'abroad', 0, s.t, 2), 0.3, 3);
  }

  // 1. Prices.
  const offers: number[][] = [], sellers: Holder[][] = [];
  let allSeen = 0, allCustom = 0;
  for (let r = 0; r < 3; r++) {
    const R = s.regions[r]!, hs = inRegion(s, r);
    R.stock = hs.reduce((a, h) => a + h.grain, 0);
    R.custom = hs.reduce((a, h) => a + need(h), 0) * P.pantry[r]! + R.barn * barnShare(w) + R.larder * larderShare(w);
    allSeen += R.stock * (1 - P.hoardHide * R.hoard); allCustom += R.custom;
  }
  const realm = allCustom / Math.max(1, allSeen);
  for (let r = 0; r < 3; r++) {
    const R = s.regions[r]!, hs = inRegion(s, r), was = prev.regions[r]!.price;
    const stock = R.stock;
    const seen = stock * (1 - P.hoardHide * R.hoard);
    // The price answers to the whole realm's barns, and to how the local stalls stand against that.
    const local = (R.custom / Math.max(1, seen)) / realm;
    // Empty stalls last week push the price at once, whatever the barns are said to hold.
    const target = P.grainPrice * clamp(pow(realm, P.priceElastic) * pow(local, P.priceLocal) * R.scarce, P.priceFloor, P.priceCeil);
    R.price = lerp(was, target, P.priceAdjust);
    R.trend = 0.6 * R.trend + 0.4 * (R.price / was - 1);
    const d = R.price - was;
    if (Math.abs(d) > 0.004) {
      const hid = stock * P.hoardHide * R.hoard / Math.max(1, stock);
      const hv = topCause(s, `harvest.${r === CAP ? 2 : r}`);
      const kind = d > 0 ? (hid > 0.08 ? 'hoarding' : prev.routes.some(x => (x.a === r && x.flow > 0) || (x.b === r && x.flow < 0)) && r !== CAP ? 'carted away' : 'barns low') : 'barns filling';
      cause(s, `price.${r}`, kind, d, kind === 'barns low' && hv ? hv.k : '');
    }
    const cap = lawOf(s, 'assize', r);
    sellers[r] = hs.filter(h => h.grain > 0);
    // Under an assize set below the market, holders bring less to sell.
    const flight = cap && cap.value < R.price ? pow(cap.value / R.price, P.assizeFlight) : 1;
    offers[r] = sellers[r]!.map(h => Math.max(0, h.grain - reserve(s, h, w)) * flight);
    if (flight < 0.97) cause(s, `price.${r}`, 'assize', 0.001, 'withheld');
  }

  // 2. Carting between regions, and across the sea.
  for (const route of s.routes) {
    route.flow = 0;
    const road = s.works.find(x => x.id === route.work)!;
    const sea = route.b === ABROAD;
    const pa = s.regions[route.a]!.price, pb = sea ? P.grainPrice * s.abroad.grain : s.regions[route.b]!.price;
    const from = pb > pa ? route.a : route.b, to = pb > pa ? route.b : route.a;
    const ends = sea ? [route.a] : [route.a, route.b];
    if (ends.some(r => lawOf(s, 'quarantine', r))) continue;
    if (from !== ABROAD && lawOf(s, 'exportBan', from)) continue;
    const snow = !sea && ends.includes(HIGH) && s.regions[HIGH]!.sky.snow > P.snowBlock ? 3 : 1;
    const disorder = ends.some(r => s.regions[r]!.stage >= 2) ? 1.6 : 1;
    const bandits = sea ? 0 : ends.reduce((a, r) => a + s.regions[r]!.bandits, 0) * P.banditRisk;
    const tollRate = lawOf(s, 'toll', -1)?.value ?? P.toll;
    const pFrom = Math.min(pa, pb);
    const cost = P.cartCost * P.grainPrice * (sea ? P.seaCost : 1) * (1 + P.roadDrag * (1 - road.cond)) * snow * disorder + bandits * P.grainPrice + tollRate * pFrom;
    route.risk = bandits;
    const gap = Math.abs(pb - pa) - cost;
    if (gap <= 0) continue;
    let vol = route.cap * road.cond * clamp01(gap / (P.cartSlope * P.grainPrice)) / (snow * disorder);
    const buyers = to === ABROAD ? [] : inRegion(s, to).filter(h => h.estate === MERCHANT);
    // Merchants buy with their coin and on the credit of the corn they already hold.
    const means = (h: Holder): number => Math.max(0, h.coin + P.tradeCredit * h.grain * Math.max(pa, pb));
    // Factors at the far end will always trust a town's merchants with a week or two of its bread.
    const trust = to === ABROAD ? 0 : inRegion(s, to).reduce((a, h) => a + need(h), 0) * P.merchantTrust * Math.max(pa, pb);
    if (to !== ABROAD) vol = Math.min(vol, Math.max(trust, buyers.reduce((a, h) => a + means(h), 0) * P.cartCoin) / (pFrom + cost));
    // No merchant lays in more than his market will take.
    if (to !== ABROAD) { const D = s.regions[to]!.demand; vol = Math.min(vol, Math.max(0, D * P.merchantStockWeeks - buyers.reduce((a, h) => a + h.grain, 0)) + D); }
    let avail = 0;
    if (from !== ABROAD) { avail = offers[from]!.reduce((a, b) => a + b, 0); vol = Math.min(vol, avail * P.cartTake); }
    if (vol <= 1) continue;
    const toll = tollRate * pFrom * vol, cartage = (cost - tollRate * pFrom) * vol;
    if (from !== ABROAD) sell(sellers[from]!, offers[from]!, avail, vol, pFrom);
    else s.flows.coinOut += vol * pFrom;
    if (to !== ABROAD) {
      const bs = shares(buyers, h => means(h) + h.trade, 1);
      buyers.forEach((h, i) => { h.grain += vol * bs[i]!; h.coin -= (vol * pFrom + toll + cartage) * bs[i]!; });
    } else {
      // Sold abroad: the sellers' merchants keep the margin, less toll and cartage.
      s.flows.coinIn += vol * pb;
      const ms = inRegion(s, from).filter(h => h.estate === MERCHANT);
      const sh = shares(ms, h => h.trade, vol * (pb - pFrom) - toll - cartage);
      ms.forEach((h, i) => { h.coin += sh[i]!; h.got += sh[i]!; });
    }
    s.purse += toll;
    cause(s, 'purse', 'tolls', toll);
    // Cartage is wages for carters at the near end.
    const carters = inRegion(s, from === ABROAD ? to : from).filter(h => h.estate === COMMONER);
    const cs = shares(carters, h => h.workers, cartage);
    carters.forEach((h, i) => { h.coin += cs[i]!; h.got += cs[i]!; });
    route.flow = from === route.a ? vol : -vol;
    if (from !== ABROAD && to !== ABROAD) cause(s, `price.${from}`, 'carted away', 0.0005 * vol / Math.max(1, route.cap));
  }

  // 3. The local market: those short of bread buy what coin and the offers allow.
  for (let r = 0; r < 3; r++) {
    const R = s.regions[r]!, hs = inRegion(s, r), pT = tradePrice(s, r);
    for (let i = 0; i < sellers[r]!.length; i++) offers[r]![i] = Math.min(offers[r]![i]!, Math.max(0, sellers[r]![i]!.grain));
    const total = offers[r]!.reduce((a, b) => a + b, 0);
    const buyers = hs.filter(h => h.grain < need(h) * P.pantryWeeks && h.coin > 0);
    const wants = buyers.map(h => Math.min(need(h) * P.pantryWeeks - h.grain, (h.coin * P.foodPurse) / pT));
    const want = wants.reduce((a, b) => a + b, 0);
    const q = Math.min(want, total);
    R.demand = 0.6 * R.demand + 0.4 * want;
    R.scarce = clamp(0.5 * R.scarce + 0.5 * clamp(pow(want / Math.max(1, total), 0.5), 1, 2), 1, 2);
    if (q > 0) {
      const top = topCause(s, `price.${r}`);
      buyers.forEach((h, i) => {
        const got = (q * wants[i]!) / want;
        h.grain += got; h.coin -= got * pT;
        if (pT > P.dearLine * R.priceRef) woe(s, h, 'price', got * (pT / R.priceRef - 1), top ? top.k : 'dear');
      });
      const tollRate = P.marketToll;
      sell(sellers[r]!, offers[r]!, total, q, pT * (1 - tollRate));
      s.purse += q * pT * tollRate;
      cause(s, 'purse', 'market tolls', q * pT * tollRate);
    }
    if (want > total * 1.15 && want > 0.02 * hs.reduce((a, h) => a + need(h), 0)) {
      if (!prev.record.some(e => e.k === 'shortage' && e.r === r && e.t > s.t - 6)) event(s, 'shortage', r, { want: Math.round(want), offered: Math.round(total), assize: lawOf(s, 'assize', r) ? 1 : 0 });
    }
  }

  // 4. Goods and crafts: everyone with coin to spare buys, and the buying is the craftsman's wage.
  const pot = [0, 0, 0];
  const country = [1, 2].map(r => inRegion(s, r).reduce((a, h) => a + (h.estate === COMMONER ? h.workers : 0), 0));
  // Trade with the world abroad anchors the realm's wages: dear labour buys abroad and sells little there.
  const rel = clamp(s.regions[CAP]!.wage / P.wage0, 0.4, 2.5);
  for (const h of s.holders) {
    const pT = tradePrice(s, h.region);
    const comfort = need(h) * pT * P.comfortWeeks;
    const base = Math.min(Math.max(0, h.coin - need(h) * pT), P.goodsBase * souls(h) * (1 - h.pressure / 8));
    const spend = base + P.spendRate * Math.max(0, h.coin - base - comfort);
    if (spend <= 0) continue;
    h.coin -= spend;
    const rich = h.estate === NOBLE || h.estate === CLERIC || h.estate === MERCHANT;
    const out = spend * Math.min(0.8, (rich ? P.luxury : P.leak) * clamp(rel, 0.5, 2));
    s.flows.coinOut += out;
    const rest = spend - out;
    if (h.region === CAP) {
      // The city buys the country's produce as well as its own crafts.
      const toCountry = rest * P.capitalCountry;
      pot[1] = pot[1]! + (toCountry * country[0]!) / (country[0]! + country[1]!);
      pot[2] = pot[2]! + (toCountry * country[1]!) / (country[0]! + country[1]!);
      pot[CAP] = pot[CAP]! + rest - toCountry;
    } else {
      pot[CAP] = pot[CAP]! + rest * P.capitalCrafts;
      pot[h.region] = pot[h.region]! + rest * (1 - P.capitalCrafts);
    }
  }
  const exportsIn = P.clothExport * s.abroad.cloth * s.regions[CAP]!.craftIdx * clamp(pow(1 / rel, P.exportElastic), 0.2, 5);
  pot[CAP] = pot[CAP]! + exportsIn;
  s.flows.coinIn += exportsIn;
  for (let r = 0; r < 3; r++) {
    const R = s.regions[r]!, hs = inRegion(s, r);
    // Hands free for craft and wage work; the commons always find some hours for it.
    for (const h of hs) h.lab.craft = Math.max(0, h.lab.avail - h.lab.field - h.lab.duty) * (h.estate === COMMONER ? 1 : P.craftOthers) + (h.estate === COMMONER ? P.craftFloor * h.workers * h.h : 0);
    const hands = hs.reduce((a, h) => a + h.lab.craft, 0);
    if (hands <= 0) continue;
    const ms = hs.filter(h => h.estate === MERCHANT);
    const cut = ms.length ? pot[r]! * P.merchantCut : 0;
    let wage = (pot[r]! - cut) / hands;
    const cap = lawOf(s, 'wageCap', r);
    let over = 0;
    if (cap && wage > cap.value) { over = (wage - cap.value) * hands; wage = cap.value; }
    const mshare = shares(ms, h => h.trade, cut);
    ms.forEach((h, i) => { h.coin += mshare[i]!; h.got += mshare[i]!; });
    // Under a wage cap, the saving stays with those who hire: the landed and the masters.
    const hirers = hs.filter(h => h.estate === NOBLE || h.estate === MERCHANT || h.estate === CLERIC);
    const os = shares(hirers, h => souls(h), over);
    hirers.forEach((h, i) => { h.coin += os[i]!; h.got += os[i]!; });
    if (hirers.length === 0) s.purse += over;
    for (const h of hs) { h.coin += wage * h.lab.craft; h.got += wage * h.lab.craft; }
    const was = R.wage;
    R.wage = lerp(R.wage, wage, P.wageAdjust);
    if (Math.abs(R.wage - was) > 0.01) cause(s, `wage.${r}`, cap && over > 0 ? 'wage cap' : R.wage > was ? (R.sick > 0.03 || R.deaths > 2 * R.deathsExp ? 'few hands' : 'brisk trade') : 'slack trade', R.wage - was);
  }

  // The wool clip is sold to the cloth trade, half at home and half abroad.
  if (inWeeks(w, P.shearStart, P.shearEnd + 4)) {
    const pw = P.woolPrice * s.abroad.cloth;
    const buyers = inRegion(s, CAP).filter(h => h.estate === MERCHANT);
    let sold = 0;
    for (const h of s.holders) {
      if (h.wool <= 0 || h.estate === MERCHANT) continue;
      const q = h.wool * 0.4;
      const home = Math.max(0, Math.min(q * 0.5 * pw, buyers.reduce((a, b) => a + Math.max(0, b.coin), 0) * 0.2));
      const bs = shares(buyers, b => Math.max(0, b.coin), home);
      buyers.forEach((b, i) => { b.coin -= bs[i]!; b.wool += (q * 0.5 * bs[i]!) / Math.max(1e-9, home); });
      // The wool merchants of the country take their margin on the clip.
      const ms = inRegion(s, h.region).filter(x => x.estate === MERCHANT), margin = ms.length ? (home + q * 0.5 * pw) * P.woolMargin : 0;
      const mshare = shares(ms, x => x.trade, margin);
      ms.forEach((x, i) => { x.coin += mshare[i]!; x.got += mshare[i]!; });
      h.wool -= q; h.coin += home + q * 0.5 * pw - margin; h.got += home + q * 0.5 * pw - margin;
      s.flows.coinIn += q * 0.5 * pw;
      sold += q;
    }
    void sold;
  }
  if (w === P.shearEnd + 4) {
    const clip = s.holders.reduce((a, h) => a + (h.estate === MERCHANT ? h.wool : 0), 0);
    const C = s.regions[CAP]!;
    C.craftIdx = clamp(0.5 * C.craftIdx + 0.5 * (0.7 + 0.3 * clamp(clip / P.woolNormal, 0, 1.5)), 0.6, 1.2);
    for (const h of s.holders) if (h.estate === MERCHANT) h.wool = 0;
  }

  // 5. Debts fall due.
  for (const d of s.debts.slice()) {
    if (d.due > s.t) continue;
    const debtor = s.holders.find(h => h.id === d.debtor), creditor = s.holders.find(h => h.id === d.creditor);
    if (!debtor || !creditor) { s.debts.splice(s.debts.indexOf(d), 1); continue; }
    const pT = tradePrice(s, debtor.region);
    const owe = d.principal * (1 + d.rate);
    const can = Math.max(0, debtor.coin - need(debtor) * pT * 2);
    const pay = Math.min(owe, can);
    debtor.coin -= pay; creditor.coin += pay; creditor.got += pay;
    let left = owe - pay;
    if (left < 1) { s.debts.splice(s.debts.indexOf(d), 1); event(s, 'repaid', debtor.region, { debtor: d.debtor, creditor: d.creditor, amt: Math.round(owe) }); continue; }
    // Default: the creditor takes the security, and rolls what is left at a worse rate.
    let seized = '';
    if (d.security === 'beasts' && debtor.beasts > 1) {
      const worth = P.meatPerBeast * pT * P.beastWorth;
      const take = Math.min(debtor.beasts * 0.6, left / worth);
      debtor.beasts -= take; creditor.beasts += take; debtor.herd0 = Math.max(0, debtor.herd0 - take); creditor.herd0 += take;
      left -= take * worth; seized = 'beasts';
      woe(s, debtor, 'seizure', take * P.meatPerBeast * 1.5, d.creditor);
    } else if (d.security === 'land') {
      const total = debtor.acres[0]! + debtor.acres[1]! + debtor.acres[2]!;
      const take = Math.min(total * 0.5, left / P.acreWorth);
      if (take > 0.1) {
        for (let c = 0; c < 3; c++) { const a = (take * debtor.acres[c]!) / total; debtor.acres[c] = debtor.acres[c]! - a; creditor.acres[c] = creditor.acres[c]! + a; }
        left -= take * P.acreWorth; seized = 'land';
        woe(s, debtor, 'seizure', take * 20, d.creditor);
      }
    }
    const cascade = creditor.woes['default'] !== undefined || debtor.woes['default'] !== undefined;
    woe(s, creditor, 'default', Math.max(0, left) / pT, d.debtor);
    event(s, debtor.woes['default'] ? 'cascade' : 'default', debtor.region, { debtor: d.debtor, creditor: d.creditor, amt: Math.round(owe - pay), seized, chain: cascade ? 1 : 0 });
    const g = tieOf(s, 'grudge', d.debtor, d.creditor);
    if (seized) { if (g) g.w += 1; else s.ties.push({ kind: 'grudge', a: d.debtor, b: d.creditor, w: 1, t: s.t }); }
    if (left < 1 || d.rolled >= 2) { s.debts.splice(s.debts.indexOf(d), 1); continue; }
    const usury = lawOf(s, 'usuryCap', -1);
    d.principal = left; d.rate = Math.min(d.rate * 1.5, usury ? usury.value : 1); d.due = s.t + 13; d.rolled++;
    woe(s, debtor, 'debt', left / pT, d.creditor);
  }
}
