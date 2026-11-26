'use strict';
// The generator: each household derives one motive from its state, and asks for it to be met by a
// means (direct · shift · defer · relate) with a payer (court · duty · household · peers · estate · nobody).
// Nothing here names a situation; situations are combinations that become possible.

const K = require('./core.js');
const { C } = K;

// ---------------------------------------------------------------- motives
function motiveOf(w, h) {
  const r = w.rng;
  const kin = K.kinOf(w, h.id);
  if (K.chargesAgainst(w, h.id).length) return { motive: 'redress', why: 'charged' };
  const kinCharged = kin.find((k) => K.chargesAgainst(w, k).length);
  if (kinCharged != null) return { motive: 'redress', why: 'kinCharged', kin: kinCharged };
  if (K.isUrgent(h)) return { motive: 'relief' };
  if (K.grudgesOf(w, h.id).some((g) => g.toCourt)) return { motive: 'redress', why: 'court' };
  if (K.isPressing(h)) return { motive: 'relief' };
  if (K.creditsOf(w, h.id).length && r() < 0.25) return { motive: 'redress', why: 'owed' };
  if (K.grudgesOf(w, h.id).length && r() < 0.4) return { motive: 'redress', why: 'grudge' };
  const sign = w.signs[h.region];
  if (h.superstition >= 2 && sign != null && w.week - sign <= 2 && r() < 0.25 * h.superstition) return { motive: 'sign' };
  const worst = needsOf(w, h.region).find((n) => w.needs[n] <= C.needWorsening);
  if (worst && r() < 0.35) return { motive: 'need', key: worst };
  if (h.devotion >= 2 && churchLax(w, h).length && r() < 0.25) return { motive: 'faith' };
  if (h.regard >= 1 && r() < 0.2) return { motive: 'ambition' };
  return null;
}
const needsOf = (w, region) => K.NEEDS.map((n) => K.needKey(region, n)).sort((a, b) => w.needs[a] - w.needs[b]);
const heaviestDuty = (w, h) => K.dutiesOf(w, h).sort((a, b) => (K.shares(w, b)[h.id] || 0) - (K.shares(w, a)[h.id] || 0))[0];
const churchDuty = (w, region) => w.duties.find((d) => d.region === region && d.church);
function churchLax(w, h) {
  const d = churchDuty(w, h.region);
  return d ? K.inRegion(w, h.region).filter((x) => x.id !== h.id && x.devotion === 0) : [];
}

// ---------------------------------------------------------------- options
// An option is one means and payer: its effects, who it harms, who benefits, and tags for the record.
const opt = (o) => ({ effects: [], harmed: [], tags: [], cost: 0, ...o });
const restoreWeight = (d, id) => [{ type: 'weight', duty: d.id, id, set: d.roll[id] || 0 }];

function reliefOptions(w, h) {
  const out = [], r = w.rng, d = heaviestDuty(w, h), kin = K.kinOf(w, h.id);
  const peers = K.inRegion(w, h.region).filter((x) => x.id !== h.id && x.estate === h.estate && !K.isUrgent(x) && !K.isPariah(x));
  // defer · bond: a debtor asks its creditor for time
  for (const debt of K.debtsOf(w, h.id)) {
    const cr = K.H(w, debt.to);
    if (cr.gone) continue;
    out.push(opt({ means: 'defer', payer: { kind: 'household', id: cr.id }, score: 5, tags: ['debtTime'], label: `${h.name} asks ${cr.name} for time on the debt`,
      effects: [{ type: 'pressure', id: h.id, n: -1 }, { type: 'bind', binding: { kind: 'bond', bound: h.id, benefits: cr.id, region: h.region, until: w.week + C.timeWeeks, label: 'time on a debt', sig: 'debtTime',
        test: [{ test: 'notUrgent', ids: [h.id] }],
        kept: [{ type: 'unrelate', match: { id: debt.id } }, { type: 'regard', id: cr.id, n: 1 }],
        broken: [{ type: 'unrelate', match: { id: debt.id } }, { type: 'relate', rel: { kind: 'grudge', from: cr.id, toH: h.id, until: w.week + C.grudgeWeeks } },
          { type: 'esteem', id: h.id, n: -1 }, { type: 'grievance', key: K.constituencyOf(cr), n: 0.5, tag: 'default', text: `${h.name} defaults on the debt to ${cr.name}.` }] } }] }));
    break;
  }
  // defer · pledge: another household stands surety, sharing the load while the petitioner holds
  const sureties = K.inRegion(w, h.region).filter((x) => x.id !== h.id && !K.isPressing(x) && !K.isPariah(x) && (kin.includes(x.id) || x.regard >= 1 || (x.estate === h.estate && x.esteem >= 1) || K.rivalry(w, x.estate, h.estate) >= 1));
  const s = sureties.sort((a, b) => Number(kin.includes(b.id)) - Number(kin.includes(a.id)) || b.regard - a.regard)[0];
  if (s) out.push(opt({ means: 'defer', payer: { kind: 'household', id: s.id }, score: kin.includes(s.id) ? 5 : 3, tags: ['surety', ...(kin.includes(s.id) ? ['kinSurety'] : [])], label: `${s.name} stands surety for ${h.name}`,
    effects: [{ type: 'pressure', id: h.id, n: -1 }, { type: 'pressure', id: s.id, n: 0.5 }, { type: 'bind', binding: { kind: 'pledge', bound: s.id, benefits: h.id, region: h.region, until: w.week + C.wordWeeks, label: 'a surety', sig: 'surety',
      test: [{ test: 'notUrgent', ids: [h.id] }],
      kept: [{ type: 'esteem', id: s.id, n: 1 }, { type: 'regard', id: s.id, n: 1 }],
      broken: [{ type: 'pressure', id: s.id, n: 1 }, { type: 'regard', id: s.id, n: -1 }, { type: 'esteem', id: s.id, n: -0.5 }] } }] }));
  // shift · household: a unit of the heaviest duty to a lighter neighbour on its roll
  if (d) {
    const onRoll = Object.keys(d.roll).map(Number).filter((id) => id !== h.id && d.roll[id] > 0 && !K.H(w, id).gone && !K.isPressing(K.H(w, id)));
    const debtors = K.creditsOf(w, h.id).map((x) => x.from);
    const p = onRoll.map((id) => K.H(w, id)).sort((a, b) => Number(debtors.includes(b.id)) - Number(debtors.includes(a.id)) || Number(kin.includes(b.id)) - Number(kin.includes(a.id)) || a.pressure - b.pressure)[0];
    if (p && d.roll[h.id] >= 1) {
      const owedBy = K.creditsOf(w, h.id).find((x) => x.from === p.id);
      out.push(opt({ means: 'shift', payer: { kind: 'household', id: p.id }, score: owedBy ? 5 : 3, harmed: [p.id], question: 'shift a burden to a neighbour', label: `${h.name} asks that ${p.name} carry a unit of ${d.name}`,
        effects: [{ type: 'weight', duty: d.id, id: h.id, n: -1 }, { type: 'weight', duty: d.id, id: p.id, n: 1 },
          owedBy ? { type: 'unrelate', match: { id: owedBy.id } } : { type: 'relate', rel: { kind: 'owes', from: h.id, to: p.id, size: 1 } }] }));
    }
  }
  // defer · compact: peers pool their pressure for a span; kept to the mark, a dividend
  if (peers.length >= 2) {
    const ids = [h.id, ...peers.slice(0, 3).map((x) => x.id)];
    out.push(opt({ means: 'defer', payer: { kind: 'peers' }, score: 3, tags: ['pool'], label: `the ${h.estate.toLowerCase()}s of the ${h.region} would share their load`,
      effects: [{ type: 'bind', binding: { kind: 'compact', bound: ids, region: h.region, until: w.week + C.compactWeeks, label: 'a compact', sig: 'pool',
        each: [{ type: 'pool', ids }], test: [{ test: 'notUrgent', ids }],
        counter: { n: 0, mark: C.compactWeeks, onMark: [...ids.map((id) => ({ type: 'pressure', id, n: -1 })), ...ids.map((id) => ({ type: 'esteem', id, n: 0.5 })), ...(d ? [{ type: 'requirement', duty: d.id, n: -0.5 }] : []), { type: 'note', tag: 'dividend', text: 'A compact pays its dividend.' }] },
        broken: ids.map((id) => ({ type: 'esteem', id, n: -0.5 })) } }] }));
  }
  // defer · word: the court binds itself to hear the household within a span
  out.push(opt({ means: 'defer', payer: { kind: 'court' }, score: 2.5, tags: ['word'], label: `${h.name} asks for the court's word`,
    effects: [{ type: 'bind', binding: { kind: 'word', bound: 'court', from: w.week + 1, benefits: h.id, region: h.region, phase: 'hearings', mode: 'await', until: w.week + C.wordWeeks, label: "the court's word", sig: 'word',
      test: [{ test: 'heard', id: h.id }], kept: [{ type: 'pressure', id: h.id, n: -1 }],
      broken: [{ type: 'standing', n: -1 }, { type: 'regard', id: h.id, n: -2 }, { type: 'relate', rel: { kind: 'grudge', from: h.id, toCourt: true, until: w.week + C.grudgeWeeks } }, { type: 'note', tag: 'wordBroken', text: `The court breaks its word to ${h.name}.` }] } }] }));
  // shift · estate: a law that another estate of the region carries a share
  if (d) {
    const others = [...new Set(K.inRegion(w, h.region).map((x) => x.estate))].filter((e) => e !== h.estate);
    const target = others.map((e) => ({ e, xs: K.inRegion(w, h.region).filter((x) => x.estate === e) }))
      .sort((a, b) => K.rivalry(w, h.estate, a.e) - K.rivalry(w, h.estate, b.e) || avgP(a.xs) - avgP(b.xs))[0];
    if (target && d.roll[h.id] >= 1) {
      const enrol = target.xs.filter((x) => (d.roll[x.id] || 0) < 2).slice(0, 2);
      if (enrol.length) out.push(opt({ means: 'shift', payer: { kind: 'estate', key: `${h.region}|${target.e}` }, score: 2 + (K.rivalry(w, h.estate, target.e) < 0 ? 1 : 0), harmed: enrol.map((x) => x.id), question: `lay a burden on another estate`, tags: ['law'],
        label: `${h.name} asks that the ${target.e.toLowerCase()}s of the ${h.region} take up ${d.name}`,
        effects: [{ type: 'weight', duty: d.id, id: h.id, n: -1 }, ...enrol.map((x) => ({ type: 'weight', duty: d.id, id: x.id, n: 1 })),
          { type: 'rivalry', a: h.estate, b: target.e, n: -0.5 },
          { type: 'bind', binding: { kind: 'law', region: h.region, favours: K.constituencyOf(h), burdens: `${h.region}|${target.e}`, duty: d.id, ids: enrol.map((x) => x.id), petitioner: h.id, label: 'a law', sig: 'law' } }] }));
    }
  }
  // shift · duty: excused for a week; the duty runs that much short, and the need pays
  if (d) out.push(opt({ means: 'shift', payer: { kind: 'duty', id: d.id }, score: 2, tags: ['respite'], label: `${h.name} asks to be excused ${d.name} for a week`,
    effects: [{ type: 'weight', duty: d.id, id: h.id, set: 0 }, { type: 'bind', binding: { kind: 'ordinance', region: h.region, at: w.week, label: 'a respite', sig: 'respite', kept: restoreWeight(d, h.id), broken: restoreWeight(d, h.id) } }] }));
  // direct · court: relief on the Crown's account
  out.push(opt({ means: 'direct', payer: { kind: 'court' }, score: 1.5 + (h.regard >= 1 ? 1 : 0), cost: 1, label: `${h.name} asks for relief on the Crown's account`,
    effects: [{ type: 'pressure', id: h.id, n: -2 }, { type: 'standing', n: -1 }] }));
  return out.map((o) => ({ ...o, score: o.score + r() * 1.5 }));
}
const avgP = (xs) => xs.reduce((a, x) => a + x.pressure, 0) / Math.max(1, xs.length);

function redressOptions(w, h, m) {
  const out = [];
  if (m.why === 'charged' || m.why === 'kinCharged') {
    const accused = m.why === 'charged' ? h : K.H(w, m.kin), ch = K.chargesAgainst(w, accused.id)[0], acc = K.H(w, ch.from);
    const tags = ['defend', ...(m.why === 'kinCharged' ? ['kinIntercede'] : [])];
    out.push(opt({ means: 'relate', payer: { kind: 'household', id: acc.id }, score: 4, harmed: [acc.id], tags, question: `drop a charge against a ${accused.estate.toLowerCase()}`, label: `${h.name} asks that the charge against ${accused.name} be dropped`,
      effects: [{ type: 'unrelate', match: { id: ch.id } }, { type: 'pressure', id: accused.id, n: -1 }] }));
    out.push(opt({ means: 'defer', payer: { kind: 'court' }, score: 3, tags: [...tags, 'word'], label: `${h.name} asks the court to hear ${accused.name}'s defence`,
      effects: [{ type: 'bind', binding: { kind: 'word', bound: 'court', from: w.week + 1, benefits: accused.id, region: h.region, phase: 'hearings', mode: 'await', until: w.week + C.wordWeeks, label: "the court's word", sig: 'word',
        test: [{ test: 'heard', id: accused.id }], kept: [{ type: 'unrelate', match: { id: ch.id } }],
        broken: [{ type: 'standing', n: -1 }, { type: 'relate', rel: { kind: 'grudge', from: accused.id, toCourt: true, until: w.week + C.grudgeWeeks } }, { type: 'note', tag: 'wordBroken', text: `The court breaks its word to ${accused.name}.` }] } }] }));
    return out;
  }
  if (m.why === 'court') {
    const g = K.grudgesOf(w, h.id).find((x) => x.toCourt);
    out.push(opt({ means: 'direct', payer: { kind: 'court' }, score: 3, cost: 1, tags: ['amends'], label: `${h.name} asks the court to make amends`,
      effects: [{ type: 'standing', n: -1 }, { type: 'regard', id: h.id, n: 2 }, { type: 'unrelate', match: { id: g.id } }] }));
    out.push(opt({ means: 'defer', payer: { kind: 'court' }, score: 3, tags: ['amends', 'word'], label: `${h.name} asks for the court's word again`,
      effects: [{ type: 'bind', binding: { kind: 'word', bound: 'court', from: w.week + 1, benefits: h.id, region: h.region, phase: 'hearings', mode: 'await', until: w.week + 1, label: "the court's word, again", sig: 'wordAgain',
        test: [{ test: 'heard', id: h.id }], kept: [{ type: 'regard', id: h.id, n: 2 }, { type: 'unrelate', match: { id: g.id } }],
        broken: [{ type: 'standing', n: -1 }, { type: 'grievance', key: K.constituencyOf(h), n: 1 }, { type: 'note', tag: 'wordBroken', text: `The court breaks its word to ${h.name} again.` }] } }] }));
    return out;
  }
  if (m.why === 'owed') {
    const debt = K.creditsOf(w, h.id)[0], dr = K.H(w, debt.from);
    out.push(opt({ means: 'shift', payer: { kind: 'household', id: dr.id }, score: 4, harmed: [dr.id], tags: ['call'], question: 'call in a debt', label: `${h.name} asks that ${dr.name} repay the debt`,
      effects: [{ type: 'pressure', id: dr.id, n: debt.size }, { type: 'pressure', id: h.id, n: -debt.size }, { type: 'unrelate', match: { id: debt.id } }] }));
    out.push(opt({ means: 'defer', payer: { kind: 'household', id: dr.id }, score: 3, tags: ['debtTime'], label: `${h.name} gives ${dr.name} time, under bond`,
      effects: [{ type: 'bind', binding: { kind: 'bond', bound: dr.id, benefits: h.id, region: h.region, until: w.week + C.timeWeeks, label: 'time on a debt', sig: 'debtTime',
        test: [{ test: 'notUrgent', ids: [dr.id] }],
        kept: [{ type: 'unrelate', match: { id: debt.id } }, { type: 'pressure', id: h.id, n: -debt.size }],
        broken: [{ type: 'unrelate', match: { id: debt.id } }, { type: 'relate', rel: { kind: 'grudge', from: h.id, toH: dr.id, until: w.week + C.grudgeWeeks } },
          { type: 'esteem', id: dr.id, n: -1 }, { type: 'grievance', key: K.constituencyOf(h), n: 0.5, tag: 'default', text: `${dr.name} defaults on the debt to ${h.name}.` }] } }] }));
    return out;
  }
  // a grudge: against a household, or an estate. A law that burdens its estate may be repealed; a
  // pressed adversary may be helped and the grudge laid down; or a charge brought.
  const g = K.grudgesOf(w, h.id).find((x) => !x.toCourt);
  const law = w.bindings.find((b) => b.kind === 'law' && b.burdens === K.constituencyOf(h));
  if (law) {
    out.push(opt({ means: 'relate', payer: { kind: 'estate', key: law.favours }, score: 5, tags: ['repeal'], question: 'lay a burden on another estate', ruleSide: 'deny', label: `${h.name} asks that the law burdening the ${h.estate.toLowerCase()}s be repealed`,
      effects: [...law.ids.map((id) => ({ type: 'weight', duty: law.duty, id, n: -1 })), { type: 'weight', duty: law.duty, id: law.petitioner, n: 1 },
        { type: 'unbind', binding: law.id }, { type: 'grievance', key: law.favours, n: 0.5 }, { type: 'note', tag: 'lawRepealed', text: 'A law is repealed.' }] }));
  }
  const targets = g.toH != null ? [K.H(w, g.toH)] : K.alive(w).filter((x) => K.constituencyOf(x) === g.toC);
  const t = targets.filter((x) => !x.gone).sort((a, b) => b.pressure - a.pressure)[0];
  if (t && K.isPressing(t) && !K.isPressing(h)) {
    out.push(opt({ means: 'relate', payer: { kind: 'nobody' }, score: 4, tags: ['peace'], label: `${h.name} would make peace with ${t.name}, and help`,
      effects: [{ type: 'unrelate', match: { id: g.id } }, { type: 'pressure', id: t.id, n: -1 }, { type: 'pressure', id: h.id, n: 0.5 }, { type: 'regard', id: t.id, n: 1 }, { type: 'regard', id: h.id, n: 1 }, { type: 'rivalry', a: h.estate, b: t.estate, n: 0.5 }] }));
  }
  if (t) {
    out.push(opt({ means: 'relate', payer: { kind: 'household', id: t.id }, score: 3, harmed: [t.id], tags: ['charge'], question: `charge a ${t.estate.toLowerCase()}`, label: `${h.name} brings a charge against ${t.name}`,
      effects: [{ type: 'relate', rel: { kind: 'charge', from: h.id, to: t.id } }, { type: 'pressure', id: t.id, n: 1 }, { type: 'esteem', id: t.id, n: -0.5 }] }));
  }
  return out;
}

function needOptions(w, h, m) {
  const out = [], [region, need] = m.key.split('|');
  const d = w.duties.find((x) => x.region === region && x.need === need);
  if (!d) return out;
  const able = K.inRegion(w, region).filter((x) => !K.isUrgent(x));
  if (able.length >= 3) {
    const ids = able.map((x) => x.id);
    out.push(opt({ means: 'defer', payer: { kind: 'peers' }, score: w.needs[m.key] <= C.needDire ? 5 : 2.5, tags: ['rally'], label: `${h.name} calls the ${region} to keep ${d.name} together`,
      effects: [...ids.map((id) => ({ type: 'weight', duty: d.id, id, n: 1 })), { type: 'bind', binding: { kind: 'compact', bound: ids, region, until: w.week + 1, label: 'a rally', sig: 'rally',
        test: [{ test: 'dutyMet', duty: d.id }],
        kept: [{ type: 'need', key: m.key, n: 2 }, ...ids.map((id) => ({ type: 'weight', duty: d.id, id, n: -1 }))],
        broken: ids.map((id) => ({ type: 'weight', duty: d.id, id, n: -1 })) } }] }));
  }
  out.push(opt({ means: 'shift', payer: { kind: 'nobody' }, score: 3, tags: ['join'], label: `${h.name} offers to join ${d.name}`,
    effects: [{ type: 'weight', duty: d.id, id: h.id, n: 1 }, { type: 'esteem', id: h.id, n: 0.5 }] }));
  out.push(opt({ means: 'direct', payer: { kind: 'court' }, score: 2, cost: 1, label: `${h.name} asks the Crown to meet the ${need} need`,
    effects: [{ type: 'standing', n: -1 }, { type: 'need', key: m.key, n: 2 }] }));
  return out;
}

function faithOptions(w, h) {
  const out = [], d = churchDuty(w, h.region), lax = churchLax(w, h).sort((a, b) => a.pressure - b.pressure)[0];
  if (!d || !lax) return out;
  out.push(opt({ means: 'shift', payer: { kind: 'household', id: lax.id }, score: 3, harmed: [lax.id], question: 'lay the church on the lax', tags: ['exhort'], label: `${h.name} asks that ${lax.name} be brought to ${d.name}`,
    effects: [{ type: 'weight', duty: d.id, id: lax.id, n: 1 }, ...((d.roll[h.id] || 0) >= 1 ? [{ type: 'weight', duty: d.id, id: h.id, n: -1 }] : []), { type: 'devotion', id: lax.id, n: 1 }] }));
  out.push(opt({ means: 'defer', payer: { kind: 'nobody' }, score: 2.5, tags: ['vow'], label: `${h.name} vows to carry more of ${d.name} itself`,
    effects: [{ type: 'weight', duty: d.id, id: h.id, n: 1 }, { type: 'bind', binding: { kind: 'pledge', bound: h.id, before: 'church', region: h.region, until: w.week + C.vowWeeks, label: 'a vow', sig: 'vow',
      test: [{ test: 'notUrgent', ids: [h.id] }],
      kept: [{ type: 'weight', duty: d.id, id: h.id, n: -1 }, { type: 'devotionRegion', region: h.region, n: 1, max: 0 }, { type: 'esteem', id: h.id, n: 1 }],
      broken: [{ type: 'weight', duty: d.id, id: h.id, n: -1 }, { type: 'devotion', id: h.id, n: -1 }, { type: 'regard', id: h.id, n: -h.devotion }] } }] }));
  return out;
}

function signOptions(w, h) {
  return [
    opt({ means: 'direct', payer: { kind: 'nobody' }, score: 3, tags: ['signSeized'], label: `${h.name} asks the court to proclaim the sign`,
      effects: [{ type: 'pressure', id: h.id, n: -2 }, { type: 'signRegion', region: h.region, n: 1 }] }),
    opt({ means: 'relate', payer: { kind: 'nobody' }, score: 2, tags: ['decry'], label: `the sign is declared to be nothing`,
      effects: [{ type: 'superstition', id: h.id, n: -1 }, { type: 'regard', id: h.id, n: -1 }, { type: 'signRegion', region: h.region, n: -1 }] }),
  ];
}

function ambitionOptions(w, h) {
  const out = [], kin = K.kinOf(w, h.id);
  const match = K.inRegion(w, h.region).filter((x) => x.id !== h.id && x.estate !== h.estate && !K.kinOf(w, x.id).length && !K.isPressing(x)).sort((a, b) => b.regard - a.regard)[0];
  if (match && !kin.length) {
    const hi = K.RANK[h.estate] >= K.RANK[match.estate] ? h : match, lo = hi === h ? match : h;
    out.push(opt({ means: 'relate', payer: { kind: 'estate', key: K.constituencyOf(hi) }, score: 3, tags: ['marriage'], label: `${h.name} asks leave to marry into ${match.name}`,
      effects: [{ type: 'relate', rel: { kind: 'kin', a: h.id, b: match.id } }, { type: 'regard', id: h.id, n: 1 }, { type: 'regard', id: match.id, n: 1 },
        ...(K.RANK[hi.estate] - K.RANK[lo.estate] >= 2 ? [{ type: 'grievance', key: K.constituencyOf(hi), n: 0.5 }] : []), { type: 'rivalry', a: h.estate, b: match.estate, n: 0.5 }] }));
  }
  const peer = K.inRegion(w, h.region).filter((x) => x.id !== h.id && x.estate === h.estate)[0];
  out.push(opt({ means: 'direct', payer: peer ? { kind: 'household', id: peer.id } : { kind: 'nobody' }, score: 2, harmed: peer ? [peer.id] : [], tags: ['place'], label: `${h.name} asks for a place at court`,
    effects: [{ type: 'regard', id: h.id, n: 1 }, { type: 'esteem', id: h.id, n: 0.5 }, ...(peer ? [{ type: 'regard', id: peer.id, n: -1 }] : [])] }));
  return out;
}

// ---------------------------------------------------------------- petitions
// The ask is the most plausible option; the alternative is the best with a different means, else a different payer.
function petitionFor(w, h) {
  const m = motiveOf(w, h);
  if (!m) return null;
  const opts = (m.motive === 'relief' ? reliefOptions(w, h) : m.motive === 'redress' ? redressOptions(w, h, m) : m.motive === 'need' ? needOptions(w, h, m)
    : m.motive === 'faith' ? faithOptions(w, h) : m.motive === 'sign' ? signOptions(w, h) : ambitionOptions(w, h)).sort((a, b) => b.score - a.score);
  if (!opts.length) return null;
  const ask = opts[0];
  const alt = opts.find((o) => o.means !== ask.means) || opts.find((o) => o.payer.kind !== ask.payer.kind) || null;
  const raised = new Set([...ask.tags, ...(alt ? alt.tags : [])]);
  return {
    id: `${w.week}:${h.id}`, petitioner: h.id, motive: m.motive, why: m.why, options: [ask, alt].filter(Boolean),
    urgency: h.pressure + (K.speaksForEstate(h) ? 1 : 0) + (K.holdsWord(w, h.id) ? 2 : 0) + (K.chargesAgainst(w, h.id).length ? 1 : 0),
    raised: [...raised],
  };
}
const generate = (w) => K.alive(w).map((h) => petitionFor(w, h)).filter(Boolean);

// ---------------------------------------------------------------- rulings and their reactions
function rule(w, pet, choice) {
  const h = K.H(w, pet.petitioner);
  const o = choice === 'deny' ? null : pet.options[choice];
  const sig = { motive: pet.motive, choice, means: o?.means, payer: o?.payer?.kind, tags: o ? o.tags : [], raised: pet.raised };
  // a rule the court has held on the same question
  const q = (o || pet.options.find((x) => x.question))?.question;
  let followed = false;
  if (q) {
    const side = !o ? 'deny' : o.ruleSide || 'grant';
    const prior = w.rules[q];
    if (prior && prior.side === side) { followed = true; K.note(w, 'ruleFollowed', `The court follows its rule on: ${q}.`, { q }); }
    else if (prior) { K.addGrievance(w, prior.relied, 0.5); K.note(w, 'ruleBroken', `The court breaks its rule on: ${q}.`, { q }); }
    w.rules[q] = { side, week: w.week, relied: side === 'grant' ? K.constituencyOf(h) : (o?.harmed?.[0] != null ? K.constituencyOf(K.H(w, o.harmed[0])) : K.constituencyOf(h)) };
  }
  if (!o) {
    K.addRegard(w, h, -1);
    K.note(w, 'ruling', `Denied: ${pet.options[0].label}.`, { sig, petitioner: h.id });
    return;
  }
  K.apply(w, o.effects);
  K.addRegard(w, h, 1);
  for (const id of o.harmed) {
    const x = K.H(w, id);
    K.addRegard(w, x, -1);
    if (!followed && x.regard < 1) K.relate(w, x.estate === h.estate ? { kind: 'grudge', from: id, toH: h.id, until: w.week + C.grudgeWeeks } : { kind: 'grudge', from: id, toC: K.constituencyOf(h), until: w.week + C.grudgeWeeks });
    if (x.estate === h.estate) K.addEsteem(w, h, -1);
    else K.addRivalry(w, h.estate, x.estate, -0.25);
  }
  if (o.payer.kind === 'estate' && o.tags.includes('law')) K.addEsteem(w, h, 0.5);
  // rivals of an estate that gains take it as a slight
  for (const e of K.ESTATES) if (e !== h.estate && K.rivalry(w, h.estate, e) <= -1) K.addGrievance(w, `${h.region}|${e}`, 0.15);
  K.note(w, 'ruling', `Granted: ${o.label}.`, { sig, petitioner: h.id });
}

module.exports = { motiveOf, generate, petitionFor, rule };
