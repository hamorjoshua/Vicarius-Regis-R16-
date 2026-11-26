'use strict';
(function () {
// Flavour composed from the primitives. No text here belongs to a situation: every phrase belongs to a
// primitive (a motive, a means, a payer and its relationship, an estate, a region, a season, a
// measure, a memory), and a petition's words are assembled from the primitives that make it up.

const K = typeof require !== 'undefined' ? require('./core.js') : window.VRCore;

// A stable choice: the same petition always reads the same, different petitions differ.
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const choose = (key, xs) => xs[hash(key) % xs.length];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const ordinal = (n) => (n <= 10 ? ORD[n] : `${n}th`);

// ---------------------------------------------------------------- what each primitive contributes
const ESTATE = {
  Noble: { we: 'my house', our: 'my house’s', stake: ['our name', 'the land', 'our honour'], plain: false },
  Cleric: { we: 'the house of God here', our: 'the church’s', stake: ['the poor', 'the altar', 'the souls in our care'], plain: false },
  Official: { we: 'my office', our: 'my office’s', stake: ['the rolls', 'the records', 'good order'], plain: false },
  Merchant: { we: 'my house', our: 'my house’s', stake: ['our credit', 'the ledger', 'our good name at market'], plain: true },
  Soldier: { we: 'my company', our: 'the men’s', stake: ['the watch', 'the men', 'the wall'], plain: true },
  Commoner: { we: 'we', our: 'our', stake: ['the children', 'the field', 'the roof'], plain: true },
};
const REGION = {
  Capital: { scene: ['the market', 'the paving', 'the walls'], omen: ['the bell rang with no hand on it', 'a raven sat three days on the gate'], hardship: ['the stalls are bare', 'the gutters run over'] },
  Highlands: { scene: ['the pass', 'the high pasture', 'the cairns'], omen: ['the snow fell red at dawn', 'the ewes lambed twins all at once'], hardship: ['the snow is in the pass', 'the flock is thin'] },
  Riverlands: { scene: ['the levee', 'the ferry', 'the water meadows'], omen: ['the heron came twice to our roof', 'the river ran backward an hour'], hardship: ['the water is over the second step', 'the eel traps come up empty'] },
};
const SEASON = {
  spring: ['with the planting not yet done', 'before the fields are sown'],
  summer: ['with the harvest still standing', 'before the harvest is in'],
  autumn: ['with the stores still to fill', 'as the days draw in'],
  winter: ['in the dead of winter', 'with the frost on everything', 'with the hearth half cold'],
};
function strain(h) {
  if (h.pressure >= K.C.urgent) return ['we are at the end of what we can bear', 'one more weight and we break', 'we cannot go on as we are'];
  if (h.pressure >= K.C.pressing) return ['we are hard pressed', 'it is more than we can carry for long', 'we are stretched thin'];
  return ['we manage, for now', 'we are not yet in trouble', 'we have some room'];
}
function mood(h) {
  if (h.regard <= -1) return ['I come because there is nowhere else to go.', 'I had not thought to come back here.', 'You will forgive me if I speak plainly.'];
  if (h.regard >= 1) return ['I come to you as a friend of the court.', 'The court has been good to us.', 'I know the court will hear me fairly.'];
  return ['', '', ''];
}
const faithClause = (w, h, key, motive) => (!['relief', 'need', 'faith', 'sign'].includes(motive) ? '' : h.superstition >= 2 && w.signs[h.region] != null && w.week - w.signs[h.region] <= 3
  ? cap(choose(key + 'om', REGION[h.region].omen)) + '.'
  : h.devotion >= 3 ? choose(key + 'dv', ['We have prayed on it.', 'God knows we have tried.', 'I have asked the saints, and now I ask you.']) : '');
// the relationship that ties the petitioner to another party, in words
function tie(w, h, other) {
  if (!other) return '';
  if (K.kinOf(w, h.id).includes(other.id)) return choose(h.id + 'k' + other.id, ['my daughter’s husband’s house', 'my kin by marriage', 'my son’s wife’s people']);
  if (K.debtsOf(w, h.id).some((r) => r.to === other.id)) return 'who holds our note';
  if (K.creditsOf(w, h.id).some((r) => r.from === other.id)) return 'who owes us';
  if (K.grudgesOf(w, h.id).some((g) => g.toH === other.id || g.toC === K.constituencyOf(other))) return 'who wronged us';
  if (other.estate === h.estate) return `one of our own`;
  return '';
}
const named = (w, h, other) => { const t = tie(w, h, other); return t ? `${other.name}, ${t},` : other.name; };
const namedEnd = (w, h, other) => { const t = tie(w, h, other); return t ? `${other.name}, ${t}` : other.name; };
function memory(w, h, key) {
  const broken = w.log.filter((e) => e.tag === 'wordBroken' && e.text.includes(h.name)).at(-1);
  if (broken) return `You gave us your word once, and broke it in the ${ordinal(broken.week)} week.`;
  const g = K.grudgesOf(w, h.id)[0];
  if (g && g.toC) return choose(key + 'gm', [`We have not forgotten how the ${g.toC.split('|')[1].toLowerCase()}s were favoured over us.`, `Since the court ruled for the ${g.toC.split('|')[1].toLowerCase()}s, we have had no rest.`]);
  return '';
}

// ---------------------------------------------------------------- the shape of an option, read from its effects
function shape(w, o) {
  const fx = o.effects, bind = fx.find((e) => e.type === 'bind')?.binding, rel = fx.find((e) => e.type === 'relate')?.rel;
  const unrel = fx.find((e) => e.type === 'unrelate'), weights = fx.filter((e) => e.type === 'weight');
  const payer = o.payer.id != null ? K.H(w, o.payer.id) : null;
  const duty = (weights[0] && K.dutyById(w, weights[0].duty)) || (bind?.duty != null && K.dutyById(w, bind.duty));
  return { bind, rel, unrel, weights, payer, duty };
}

// ---------------------------------------------------------------- composition
function compose(w, pet) {
  const h = K.H(w, pet.petitioner), o = pet.options[0], key = pet.id;
  const s = shape(w, o), E = ESTATE[h.estate], R = REGION[h.region], season = K.seasonOf(w.week);
  const duty = s.duty ? s.duty.name.toLowerCase() : 'what is laid on us';
  const until = s.bind?.until != null ? `until the ${ordinal(s.bind.until)} week` : '';
  const scene = `${cap(choose(key + 'hs', R.hardship))}, ${choose(key + 'se', SEASON[season])}, and ${choose(key + 'st', strain(h))}.`;
  let ask = '', title = '';
  const P = s.payer, pn = P ? named(w, h, P) : '';
  // means × payer, read from the option's own effects
  if (pet.motive === 'faith' && o.payer.kind === 'household') { title = `${h.name} asks that ${P.name} be brought to ${duty}`; ask = `${cap(pn)} keeps away from ${duty} while the faithful carry it. Bring them to it, and to God.`; }
  else if (s.bind?.kind === 'bond') { title = `${h.name} asks ${P.name} for time`; ask = `${cap(pn)} has been patient. Give ${E.we} ${until}, and the debt will be paid in full.`; }
  else if (s.bind?.kind === 'pledge' && s.bind.before === 'church') { title = `${h.name} makes a vow`; ask = `I will carry more of ${duty} myself, ${until}, and pray the lax will follow.`; }
  else if (s.bind?.kind === 'pledge') { title = `${P.name} would answer for ${h.name}`; ask = `${cap(pn)} will stand for ${E.we} ${until}, if the court will accept it.`; }
  else if (s.bind?.kind === 'compact' && o.payer.kind === 'peers' && s.bind.test?.[0]?.test === 'dutyMet') { title = `${h.name} calls the ${h.region} together`; ask = `If every house in the ${h.region} puts a hand to ${duty} this week, we may yet keep it.`; }
  else if (s.bind?.kind === 'compact') { title = `The ${h.estate.toLowerCase()}s of the ${h.region} would carry it together`; ask = `Let us share the load among ourselves ${until}. Alone we break; together we might not notice it.`; }
  else if (s.bind?.kind === 'word') { title = pet.motive === 'redress' ? `${h.name} asks again for the court’s word` : `${h.name} asks for the court’s word`; ask = `Only say you will hear us ${until}, and we will wait without complaint.`; }
  else if (s.bind?.kind === 'law') { title = `${h.name} asks that another estate carry ${duty}`; ask = `Why should ${E.we} carry ${duty} while the ${s.bind.burdens.split('|')[1].toLowerCase()}s of the ${h.region} carry nothing?`; }
  else if (s.bind?.kind === 'ordinance') { title = `${h.name} asks to be excused ${duty}`; ask = `Excuse ${E.we} ${duty} for one week. Let it go short if it must.`; }
  else if (s.rel?.kind === 'kin') { const m = K.H(w, s.rel.b === h.id ? s.rel.a : s.rel.b); title = `${h.name} asks leave to marry into ${m.name}`; ask = `${m.name} and ${E.we} would be joined. We ask the court’s blessing.`; }
  else if (s.rel?.kind === 'charge') { title = `${h.name} brings a charge against ${P.name}`; ask = `I accuse ${namedEnd(w, h, P)}. Let the court hear it.`; }
  else if (s.unrel && pet.why === 'kinCharged') { const acc = K.H(w, pet.options[0].effects.find((e) => e.type === 'pressure')?.id); title = `${h.name} speaks for ${acc?.name}`; ask = `${acc?.name} is ${tie(w, h, acc) || 'dear to us'}. The charge against them is spite. Let it be dropped.`; }
  else if (s.unrel && pet.why === 'charged') { title = `${h.name} asks that the charge be dropped`; ask = `The charge ${P ? `${pn} brought` : 'against us'} is spite. Let it be dropped.`; }
  else if (s.unrel && pet.why === 'grudge' && o.payer.kind === 'nobody') { const t = K.H(w, o.effects.find((e) => e.type === 'pressure').id); title = `${h.name} would make peace with ${t.name}`; ask = `${t.name} is in trouble now. Whatever lies between us, we would help, and let it rest.`; }
  else if (o.effects.some((e) => e.type === 'unbind')) { title = `${h.name} asks that a law be repealed`; ask = `The law laid on the ${h.estate.toLowerCase()}s of the ${h.region} is unjust. Lift it.`; }
  else if (s.weights.length && o.payer.kind === 'household') { title = `${h.name} asks that ${P.name} carry part of ${duty}`; ask = `${cap(pn)} has room to spare. Let them carry a unit of ${duty}.`; }
  else if (s.weights.length && o.payer.kind === 'nobody') { title = `${h.name} offers to join ${duty}`; ask = `${cap(E.we)} will put a hand to ${duty}, if it will help.`; }
  else if (pet.motive === 'sign') { title = `${h.name} brings word of a sign`; ask = `${cap(choose(key + 'sg', R.omen))}. Proclaim it, and let the ${h.region} take heart.`; }
  else if (pet.why === 'owed' && o.payer.kind === 'household') { title = `${h.name} calls in a debt`; ask = `${P.name} owes ${E.we === 'we' ? 'us' : E.we}, and I need it paid.`; }
  else if (pet.why === 'court') { title = `${h.name} asks the court to make amends`; ask = `The Crown owes ${E.we} for its broken word. Make it right.`; }
  else if (o.payer.kind === 'court' && pet.motive === 'need') { title = `${h.name} asks the Crown to meet the need`; ask = `${cap(choose(key + 'sc', R.scene))} will not hold without help from the Crown.`; }
  else if (o.payer.kind === 'court') { title = `${h.name} asks relief of the Crown`; ask = `Ease ${E.we}, on the Crown’s account.`; }
  else if (pet.motive === 'ambition') { title = `${h.name} asks for a place at court`; ask = `${cap(E.we)} would serve the court more nearly.`; }
  else { title = `${h.name} petitions the court`; ask = `We ask the court’s help with ${duty}.`; }
  const stake = `Think of ${choose(key + 'sk', E.stake)}.`;
  const plea = [mood(h)[hash(key + 'md') % 3], pet.motive === 'relief' || pet.motive === 'need' ? scene : '', faithClause(w, h, key, pet.motive), memory(w, h, key), ask, pet.motive === 'relief' ? stake : '']
    .filter(Boolean).join(' ');
  return { title, plea };
}

// ---------------------------------------------------------------- what an option does, in plain words
function summarize(w, o) {
  const out = [], name = (id) => K.H(w, id).name;
  for (const e of o.effects) {
    switch (e.type) {
      case 'pressure': out.push(`${name(e.id)} ${e.n < 0 ? 'eased' : 'pressed'} ${Math.abs(e.n)}`); break;
      case 'regard': out.push(`${name(e.id)} regard ${e.n > 0 ? '+' : ''}${e.n}`); break;
      case 'esteem': out.push(`${name(e.id)} esteem with own estate ${e.n > 0 ? '+' : ''}${e.n}`); break;
      case 'standing': out.push(`standing ${e.n > 0 ? '+' : ''}${e.n}`); break;
      case 'need': out.push(`${e.key.replace('|', ' ')} need ${e.n > 0 ? '+' : ''}${e.n}`); break;
      case 'grievance': out.push(`${e.key.split('|').reverse().join('s of the ').toLowerCase()} grievance +${e.n}`); break;
      case 'weight': { const d = K.dutyById(w, e.duty); if (e.set === 0) out.push(`${name(e.id)} excused ${d.name} this week`); else if (e.set == null) out.push(`${name(e.id)} ${e.n > 0 ? 'takes up more' : 'carries less'} of ${d.name}`); break; }
      case 'relate': out.push(e.rel.kind === 'kin' ? `${name(e.rel.a)} and ${name(e.rel.b)} marry` : e.rel.kind === 'charge' ? `${name(e.rel.from)} charges ${name(e.rel.to)}` : e.rel.kind === 'owes' ? `${name(e.rel.from)} owes ${name(e.rel.to)}` : ''); break;
      case 'unrelate': out.push('an old tie ends'); break;
      case 'rivalry': out.push(`${e.a}s and ${e.b}s ${e.n > 0 ? 'warm' : 'sour'} toward each other`); break;
      case 'devotion': out.push(`${name(e.id)} more devout`); break;
      case 'signRegion': out.push(`the ${e.region} ${e.n > 0 ? 'more' : 'less'} superstitious`); break;
      case 'superstition': out.push(`${name(e.id)} less superstitious`); break;
      case 'unbind': out.push('a law is lifted'); break;
      case 'bind': {
        const b = e.binding, until = b.until != null ? ` until week ${b.until}` : b.at != null ? ' this week' : '';
        const test = (b.test || []).map((t) => (t.test === 'notUrgent' ? `${t.ids.map(name).join(', ')} not urgent` : t.test === 'heard' ? `${name(t.id)} heard` : t.test === 'dutyMet' ? `${K.dutyById(w, t.duty).name} kept` : t.test)).join('; ');
        out.push(`${b.kind}${until}${test ? `, kept if ${test}` : ''}`);
        break;
      }
    }
  }
  return out.filter(Boolean);
}

const api = { compose, summarize };
if (typeof module !== 'undefined') module.exports = api; else window.VRFlavour = api;
})();
