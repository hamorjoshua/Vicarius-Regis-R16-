'use strict';
(function () {
// The core: things, measures, relationships, bindings, tests, effects, and the week's close.
// Nothing here knows about any particular situation. See ../core/README.md.

const C = {
  max: 8, pressing: 2, urgent: 4,
  regardMin: -2, regardMax: 2, esteemMin: -2, esteemMax: 2, rivalryMin: -2, rivalryMax: 2,
  devotionMax: 3, superstitionMax: 3,
  grievanceLine: 3,
  standingMax: 5,
  needMin: -8, needMax: 6, needWorsening: -3, needDire: -6,
  capacity: 2.2, pressureRate: 0.4, dutyBase: 5, dutySpread: 2, ease: 0.25, urgentDelivers: 0.5,
  unmetNeedPressure: 0.25,
  hearings: 3, weeks: 52, quarter: 13,
  wordWeeks: 2, compactWeeks: 3, timeWeeks: 3, vowWeeks: 3,
  unheardGrievance: 0.25, urgentGrievance: 0.5,
  chargeWeekly: 0.25, grudgeWeeks: 8,
  // seasons: what a household can carry, and how hard unmet needs bite, by season
  seasons: { spring: { capacity: 0, needFall: 1 }, summer: { capacity: 0.3, needFall: 1 }, autumn: { capacity: 0, needFall: 1 }, winter: { capacity: -0.5, needFall: 2, drift: { commoners: -1, works: -1 } } },
  // stores: each household's reserve absorbs excess load before pressure rises; harvest refills it
  storesMax: 4, harvestYield: { Noble: 4, Merchant: 4, Cleric: 3, Official: 3, Soldier: 2, Commoner: 2 },
};
// The year begins in spring; each quarter is a season, and harvest falls at the end of summer.
const seasonOf = (week) => ['spring', 'summer', 'autumn', 'winter'][Math.floor(((week - 1) % 52) / 13)];
const isHarvest = (week) => (week - 1) % 52 === 25;

const REGIONS = ['Capital', 'Highlands', 'Riverlands'];
const ESTATES = ['Noble', 'Cleric', 'Official', 'Merchant', 'Soldier', 'Commoner'];
const RANK = { Commoner: 0, Soldier: 1, Merchant: 1, Official: 2, Cleric: 2, Noble: 3 };
const NEEDS = ['soldiers', 'commoners', 'works'];

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const round2 = (x) => Math.round(x * 100) / 100;
function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, xs) => xs[Math.floor(rng() * xs.length)];

// ---------------------------------------------------------------- things
const constituencyOf = (h) => `${h.region}|${h.estate}`;
const needKey = (region, need) => `${region}|${need}`;
const alive = (w) => w.households.filter((h) => !h.gone);
const H = (w, id) => w.households[id];
const dutyById = (w, id) => w.duties.find((d) => d.id === id);
const dutiesOf = (w, h) => w.duties.filter((d) => (d.roll[h.id] || 0) > 0);
const inRegion = (w, region) => alive(w).filter((h) => h.region === region);

// ---------------------------------------------------------------- measures
function addPressure(w, h, n) { if (h) h.pressure = round2(clamp(h.pressure + n, 0, C.max)); }
function addRegard(w, h, n) {
  if (!h) return;
  const raw = h.regard + n, r = clamp(raw, C.regardMin, C.regardMax);
  h.regard = r;
  // beyond a cap, the excess spills into pressure: gratitude eases, bitterness weighs
  if (raw !== r) addPressure(w, h, -(raw - r));
}
function addGrievance(w, key, n) {
  w.grievance[key] = round2(Math.max(0, (w.grievance[key] || 0) + n));
  if (w.grievance[key] >= C.grievanceLine) {
    w.grievance[key] = 0;
    w.standing -= 1;
    w.breaches += 1;
    note(w, 'breach', `The ${key} break into a breach of confidence.`, { key });
  }
}
function addEsteem(w, h, n) { if (h) h.esteem = round2(clamp(h.esteem + n, C.esteemMin, C.esteemMax)); }
// estate <-> estate: negative is rivalry, positive alliance
const pairKey = (a, b) => [a, b].sort().join('~');
const rivalry = (w, a, b) => (a === b ? 2 : w.rivalry[pairKey(a, b)] || 0);
function addRivalry(w, a, b, n) { if (a !== b) w.rivalry[pairKey(a, b)] = round2(clamp(rivalry(w, a, b) + n, C.rivalryMin, C.rivalryMax)); }
const isPariah = (h) => h.esteem <= C.esteemMin;
const speaksForEstate = (h) => h.esteem >= 1;
const isUrgent = (h) => h.pressure >= C.urgent;
const isPressing = (h) => h.pressure >= C.pressing;

// ---------------------------------------------------------------- relationships
// kin (a <-> b), owes (from debtor -> to creditor), charge (from accuser -> to accused),
// grudge (from household -> toH household | toC constituency | toCourt)
// esteem lives on each household (its estate's view of it); rivalry between estates on the world
function relate(w, rel) {
  w.relSeq = (w.relSeq || 0) + 1;
  const r = { id: w.relSeq, since: w.week, ...rel };
  w.relationships.push(r);
  return r;
}
function unrelate(w, pred) { w.relationships = w.relationships.filter((r) => !pred(r)); }
const rels = (w, pred) => w.relationships.filter(pred);
const kinOf = (w, id) => rels(w, (r) => r.kind === 'kin' && (r.a === id || r.b === id)).map((r) => (r.a === id ? r.b : r.a)).filter((k) => !H(w, k).gone);
const grudgesOf = (w, id) => rels(w, (r) => r.kind === 'grudge' && r.from === id);
const chargesAgainst = (w, id) => rels(w, (r) => r.kind === 'charge' && r.to === id);
const debtsOf = (w, id) => rels(w, (r) => r.kind === 'owes' && r.from === id);
const creditsOf = (w, id) => rels(w, (r) => r.kind === 'owes' && r.to === id);

// ---------------------------------------------------------------- duties
// Shares are the requirement split by weight. An urgent household delivers only part of its share.
function shares(w, d) {
  const ids = Object.keys(d.roll).map(Number).filter((id) => d.roll[id] > 0 && !H(w, id).gone);
  const total = ids.reduce((a, id) => a + d.roll[id], 0);
  const out = {};
  for (const id of ids) out[id] = total ? (d.requirement * d.roll[id]) / total : 0;
  return out;
}
function delivered(w, d) {
  const s = shares(w, d);
  return Object.entries(s).reduce((a, [id, sh]) => a + (isUrgent(H(w, +id)) ? sh * C.urgentDelivers : sh), 0);
}
const dutyMet = (w, d) => d && Object.keys(shares(w, d)).length > 0 && delivered(w, d) >= d.requirement - 1e-9;
const needMet = (w, key) => { const [region, need] = key.split('|'); return w.duties.some((d) => d.region === region && d.need === need && dutyMet(w, d)); };

// ---------------------------------------------------------------- bindings
// kind · bound · benefits · terms · test · span · kept / broken / expired · counter
function addBinding(w, b) {
  w.bindSeq = (w.bindSeq || 0) + 1;
  const x = { id: w.bindSeq, from: w.week, phase: 'close', ...b };
  w.bindings.push(x);
  return x;
}
const TESTS = {
  notUrgent: (w, t) => (t.ids || []).every((id) => H(w, id).gone || !isUrgent(H(w, id))),
  dutyMet: (w, t) => dutyMet(w, dutyById(w, t.duty)),
  needMet: (w, t) => needMet(w, t.key),
  heard: (w, t, ctx) => !!ctx.heard?.includes(t.id),
  attends: (w, t, ctx) => !!ctx.audience?.includes(t.id),
  regardAtLeast: (w, t) => H(w, t.id).regard >= t.n,
  present: (w, t) => (t.ids || []).every((id) => !H(w, id).gone),
};
const holds = (w, tests, ctx) => (tests || []).every((t) => TESTS[t.test](w, t, ctx));

// ---------------------------------------------------------------- effects
function apply(w, effects, ctx = {}) {
  for (const e of effects || []) {
    const h = e.id != null ? H(w, e.id) : null;
    switch (e.type) {
      case 'pressure': addPressure(w, h, e.n); break;
      case 'regard': addRegard(w, h, e.n); break;
      case 'esteem': addEsteem(w, h, e.n); break;
      case 'stores': if (h) h.stores = round2(clamp(h.stores + e.n, 0, C.storesMax)); break;
      case 'rivalry': addRivalry(w, e.a, e.b, e.n); break;
      case 'unbind': w.bindings = w.bindings.filter((b) => b.id !== e.binding); break;
      case 'devotion': if (h) h.devotion = clamp(h.devotion + e.n, 0, C.devotionMax); break;
      case 'superstition': if (h) h.superstition = clamp(h.superstition + e.n, 0, C.superstitionMax); break;
      case 'grievance': addGrievance(w, e.key, e.n); break;
      case 'standing': w.standing = clamp(w.standing + e.n, -1, C.standingMax); break;
      case 'need': if (w.needs[e.key] != null) w.needs[e.key] = clamp(w.needs[e.key] + e.n, C.needMin, C.needMax); break;
      case 'weight': { const d = dutyById(w, e.duty); if (d) { d.roll[e.id] = Math.max(0, (e.set != null ? e.set : (d.roll[e.id] || 0) + e.n)); } break; }
      case 'requirement': { const d = dutyById(w, e.duty); if (d) d.requirement = Math.max(2, round2(d.requirement + e.n)); break; }
      case 'relate': relate(w, e.rel); break;
      case 'unrelate': unrelate(w, (r) => Object.entries(e.match).every(([k, v]) => r[k] === v)); break;
      case 'bind': addBinding(w, e.binding); break;
      case 'pool': {
        const hs = (e.ids || []).map((id) => H(w, id)).filter((x) => x && !x.gone);
        if (hs.length) { const m = round2(hs.reduce((a, x) => a + x.pressure, 0) / hs.length); for (const x of hs) x.pressure = m; }
        break;
      }
      case 'signRegion': for (const x of inRegion(w, e.region)) if (e.n > 0 ? x.superstition >= 1 : x.superstition <= 1) x.superstition = clamp(x.superstition + e.n, 0, C.superstitionMax); break;
      case 'devotionRegion': for (const x of inRegion(w, e.region)) if (x.devotion <= (e.max ?? 3)) x.devotion = clamp(x.devotion + e.n, 0, C.devotionMax); break;
    }
    if (e.tag) note(w, e.tag, e.text || e.tag, e.meta || {});
  }
}
function note(w, tag, text, meta = {}) { w.log.push({ week: w.week, tag, text, ...meta }); }
function markSign(w, region) { if (region) w.signs[region] = w.week; }

// Every binding due is tested, in the order made.
function testBindings(w, phase, ctx = {}) {
  const still = [];
  for (const b of w.bindings) {
    if (b.phase !== phase) { still.push(b); continue; }
    const last = b.at != null ? b.at : b.until;
    if (b.until == null && b.at == null) { still.push(b); continue; } // forever: tested only when invoked (rules)
    if (w.week < b.from) { still.push(b); continue; }
    if (b.at != null && w.week !== b.at) { if (w.week < b.at) still.push(b); continue; }
    if (!holds(w, b.requires, ctx)) continue;
    apply(w, b.each, ctx);
    const ok = holds(w, b.test, ctx);
    const end = (fx, how) => { apply(w, fx, ctx); note(w, `binding:${b.kind}:${how}`, `${b.label || b.kind} ${how}`, { binding: b.id, sig: b.sig, region: b.region }); if (how === 'broken') markSign(w, b.region); };
    if (b.at != null) { end(ok ? b.kept : b.broken, ok ? 'kept' : 'broken'); continue; }
    if (b.mode === 'await') { if (ok) end(b.kept, 'kept'); else if (w.week >= last) end(b.broken, 'broken'); else still.push(b); continue; }
    if (!ok) { end(b.broken, 'broken'); continue; }
    if (b.counter) { b.counter.n = (b.counter.n || 0) + 1; if (b.counter.n >= b.counter.mark) { end(b.counter.onMark, 'kept'); continue; } }
    if (w.week >= last) { end(b.expired || b.kept, 'kept'); continue; }
    still.push(b);
  }
  w.bindings = still;
}
const bindingsOf = (w, pred) => w.bindings.filter(pred);
const holdsWord = (w, id) => bindingsOf(w, (b) => b.kind === 'word' && b.benefits === id).length > 0;

// ---------------------------------------------------------------- the week's close
function close(w, ctx) {
  // the unheard: pressed households left waiting feed their estate's grievance, unless they hold the court's word
  for (const id of ctx.unheard || []) {
    const h = H(w, id);
    if (isPressing(h) && !holdsWord(w, id) && !isPariah(h)) addGrievance(w, constituencyOf(h), C.unheardGrievance);
  }
  // shares become pressure
  const load = {};
  for (const d of w.duties) for (const [id, sh] of Object.entries(shares(w, d))) load[id] = (load[id] || 0) + sh;
  const season = C.seasons[seasonOf(w.week)], cap = C.capacity + season.capacity;
  for (const h of alive(w)) {
    const l = load[h.id] || 0;
    if (l > cap) {
      // what stores can absorb, they absorb; the rest becomes pressure
      const excess = l - cap, drawn = Math.min(h.stores, excess);
      h.stores = round2(h.stores - drawn);
      if (excess - drawn > 1e-9) addPressure(w, h, C.pressureRate * (excess - drawn));
    } else {
      addPressure(w, h, -C.ease);
      h.stores = round2(Math.min(C.storesMax, h.stores + (cap - l) * 0.25));
    }
  }
  if (isHarvest(w.week)) {
    for (const h of alive(w)) h.stores = Math.min(C.storesMax, h.stores + C.harvestYield[h.estate]);
    note(w, 'harvest', 'The harvest is in; the stores are filled.');
  }
  // charges weigh on the accused while unheard
  for (const r of rels(w, (x) => x.kind === 'charge')) addPressure(w, H(w, r.to), C.chargeWeekly);
  // grudges fade
  unrelate(w, (r) => r.kind === 'grudge' && r.until != null && r.until <= w.week);
  // needs: met rise, unmet fall and press on those they would serve
  for (const key of Object.keys(w.needs)) {
    const [region, need] = key.split('|');
    // the season presses on some needs whether or not their duty is kept: winter hunger, winter damage
    w.needs[key] = Math.max(C.needMin, w.needs[key] + ((season.drift || {})[need] || 0));
    if (needMet(w, key)) w.needs[key] = Math.min(C.needMax, w.needs[key] + 1);
    else {
      w.needs[key] -= season.needFall;
      const served = inRegion(w, region).filter((h) => need === 'works' || (need === 'soldiers' ? h.estate === 'Soldier' : h.estate === 'Commoner'));
      for (const h of served) addPressure(w, h, need === 'works' ? C.unmetNeedPressure / 2 : C.unmetNeedPressure);
    }
    if (w.needs[key] <= C.needMin) {
      w.needs[key] = -4; w.standing -= 1; w.breaches += 1; w.disasters += 1;
      const d = w.duties.find((x) => x.region === region && x.need === need);
      if (d) d.requirement += 1;
      markSign(w, region);
      note(w, 'disaster', `Disaster strikes the ${region}: the ${need} need fails.`, { region, need });
    } else if (w.needs[key] <= C.needDire) markSign(w, region);
    if (w.needs[key] >= C.needMax) {
      w.needs[key] = 0;
      const d = w.duties.find((x) => x.region === region && x.need === need);
      if (d && d.requirement > 2) d.requirement -= 1;
      w.standing = Math.min(C.standingMax, w.standing + 1);
      note(w, 'needRetired', `The ${region}'s ${need} need is well kept; a unit retires.`, { region, need });
    }
  }
  // urgency feeds grievance
  // a pariah's troubles no longer move its estate; one that speaks for its estate moves it more
  for (const h of alive(w)) if (isUrgent(h) && !holdsWord(w, h.id) && !isPariah(h)) addGrievance(w, constituencyOf(h), C.urgentGrievance * (speaksForEstate(h) ? 1.5 : 1));
  // every binding due at the close
  testBindings(w, 'close', ctx);
  // the quarter day: the realm's demands grow
  if (w.week % C.quarter === 0) {
    const d = pick(w.rng, w.duties);
    d.requirement += 1;
    note(w, 'growth', `Quarter day: ${d.name} in the ${d.region} requires more.`, { duty: d.id });
  }
}

// ---------------------------------------------------------------- a new realm
const NAMES = ['Ashby', 'Bell', 'Brack', 'Carrow', 'Dunn', 'Edric', 'Elswyth', 'Fen', 'Garran', 'Grey', 'Hesta', 'Holt', 'Lowe', 'Marr', 'Pike', 'Quill', 'Reed', 'Rook', 'Sabine', 'Stone', 'Tanner', 'Vale', 'Voss', 'Weaver', 'Ysra', 'Cael', 'Anwen', 'Oswin'];
const DUTY_NAMES = { soldiers: 'Billeting', commoners: 'Charity', works: 'Repairs' };
const DUTY_ESTATES = { soldiers: ['Soldier', 'Noble', 'Commoner'], commoners: ['Cleric', 'Merchant', 'Noble'], works: ['Commoner', 'Merchant', 'Official'] };

function newWorld(seed, opts = {}) {
  const rng = rngOf(seed);
  const w = {
    seed, rng, week: 1, standing: opts.standing ?? 5, breaches: 0, disasters: 0,
    households: [], duties: [], needs: {}, grievance: {}, relationships: [], bindings: [],
    rules: {}, signs: {}, rivalry: {}, log: [], over: null,
  };
  const names = [...NAMES].sort(() => rng() - 0.5);
  for (const region of REGIONS) {
    const estates = ['Commoner', 'Commoner', 'Soldier', 'Merchant', 'Noble', 'Cleric', 'Official', pick(rng, ESTATES)];
    for (const estate of estates) {
      w.households.push({
        id: w.households.length, name: names.pop() || `House ${w.households.length}`, estate, region,
        pressure: Math.floor(rng() * 3), regard: 0, esteem: 0, stores: 1 + Math.floor(rng() * 3),
        devotion: Math.floor(rng() * 4), superstition: Math.floor(rng() * 4),
      });
    }
    for (const need of NEEDS) {
      w.needs[needKey(region, need)] = -Math.floor(rng() * 3);
      const pool = inRegion(w, region).filter((h) => DUTY_ESTATES[need].includes(h.estate));
      const roll = {};
      for (const h of [...pool].sort(() => rng() - 0.5).slice(0, 3)) roll[h.id] = rng() < 0.2 ? 1 : 2;
      w.duties.push({ id: w.duties.length, name: DUTY_NAMES[need], region, need, church: need === 'commoners', requirement: C.dutyBase + Math.floor(rng() * C.dutySpread), roll });
    }
  }
  // a few kinships and debts to begin with
  for (let i = 0; i < 3; i++) {
    const region = pick(rng, REGIONS), hs = inRegion(w, region), a = pick(rng, hs), b = pick(rng, hs.filter((x) => x.estate !== a.estate));
    if (b && !kinOf(w, a.id).includes(b.id)) relate(w, { kind: 'kin', a: a.id, b: b.id });
  }
  // the old rivalries of the realm
  for (const [a, b] of [['Noble', 'Merchant'], ['Cleric', 'Official'], ['Soldier', 'Commoner']]) addRivalry(w, a, b, -1);
  for (let i = 0; i < 3; i++) {
    const a = pick(rng, w.households), b = pick(rng, w.households.filter((x) => x.region === a.region && x.id !== a.id));
    relate(w, { kind: 'owes', from: a.id, to: b.id, size: 1 });
  }
  return w;
}

const API = {
  C, REGIONS, ESTATES, RANK, NEEDS, clamp, round2, rngOf, pick,
  constituencyOf, needKey, alive, H, dutyById, dutiesOf, inRegion,
  addPressure, addRegard, addGrievance, addEsteem, addRivalry, rivalry, isPariah, speaksForEstate, isUrgent, isPressing,
  relate, unrelate, rels, kinOf, grudgesOf, chargesAgainst, debtsOf, creditsOf,
  shares, delivered, dutyMet, needMet,
  addBinding, holds, apply, note, markSign, testBindings, bindingsOf, holdsWord,
  close, newWorld, seasonOf, isHarvest,
};
if (typeof module !== 'undefined') module.exports = API; else window.VRCore = API;
})();
