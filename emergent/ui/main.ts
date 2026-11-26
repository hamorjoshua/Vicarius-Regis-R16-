// The screen. A reader and a player's hands: it shows what the court knows and passes rulings to it.
// It changes the realm only through `hear` and `advance`.

import { found } from '../sim/found.ts';
import { advance } from '../sim/step.ts';
import { audience, cuts, hear, openCourt, type Ruling, type Width } from '../sim/court/court.ts';
import { askAhead, cover } from '../sim/value.ts';
import { KINDS, NEEDS, P } from '../sim/tables.ts';
import { grown, top } from '../sim/util.ts';
import { Readers, wayWords } from '../readers/readers.ts';
import { placeName } from '../readers/names.ts';
import type { Bond, Petition, State } from '../sim/types.ts';

const app = document.getElementById('app')!;
const esc = (x: string): string => x.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** A shape or rule in plain words: the short codes for ways of dealing are spelled out. */
const plain = (x: string): string => x.replace(/\(([A-Z]+>[A-Z]+)\)/g, (_m, w: string) => `(${wayWords(w)})`);
const cap = (x: string): string => x.charAt(0).toUpperCase() + x.slice(1);
const SEASONS = ['Winter', 'Spring', 'Summer', 'Autumn'];
const seasonOf = (t: number): string => SEASONS[Math.floor((((t % 52) + 52 + 4) % 52) / 13)]!;

let s: State, R: Readers;
let seated: Petition[] = [];
const chosen = new Map<number, { cut: string; width: Width }>();
let tab: 'week' | 'rolls' | 'realm' | 'record' = 'week';
let lastWeek: string[] = [];
let over = '';

// --- Words ---

const HE = ['Aldred', 'Osric', 'Godwin', 'Leofric', 'Wulfstan', 'Edric', 'Thurstan', 'Hereward', 'Alwin', 'Sigeric', 'Oswin', 'Eadmer', 'Brihtric', 'Cuthbert', 'Dunstan', 'Ordgar', 'Ulf', 'Wigmund', 'Tostig', 'Hugh', 'Ralph', 'Gilbert', 'Walter', 'Simon'];
const SHE = ['Aldith', 'Edith', 'Godgifu', 'Leofrun', 'Wulfhild', 'Mildred', 'Hilda', 'Eadgyth', 'Sunniva', 'Aelfwen', 'Osburh', 'Cwen', 'Beatrix', 'Maud', 'Agnes', 'Emma', 'Avice', 'Juliana', 'Isolde', 'Cecily', 'Golda', 'Ragnhild', 'Thora', 'Estrild'];
const nameOf = (id: number): string => { const p = s.people[id]!; const l = p.sex ? SHE : HE; return l[(id * 7 + (p.born & 1023)) % l.length]!; };
const ageOf = (id: number): number => Math.floor((s.t - s.people[id]!.born) / 52);
const cellWords = (c: number): string => placeName(s, c);
/** The one who speaks for a house: the eldest of its grown people. */
function speaker(id: number): number {
  const b = s.bodies[id]!, g = grown(s, b);
  let h = -1;
  for (const p of g.length ? g : b.members.map(i => s.people[i]!).filter(x => x.alive)) if (h < 0 || p.born < s.people[h]!.born) h = p.id;
  return h;
}
/** A house as the court would call it. */
function house(id: number): string {
  if (id < 0) return 'nobody';
  const b = s.bodies[id]!;
  const h = speaker(id);
  if (h >= 0 && b.rank === 'lord') return `Lord ${nameOf(h)} of ${cellWords(b.home)}`;
  if (h >= 0 && b.rank === 'priest') return `Father ${nameOf(h)} of ${cellWords(b.home)}`;
  if (h >= 0 && b.rank === 'bailiff') return `${nameOf(h)}, the king’s bailiff at ${cellWords(b.home)}`;
  return h < 0 ? `house ${id}` : `${nameOf(h)}’s house`;
}
/** Who they are: the speaker, and who is in the house. */
function who(id: number): string {
  const b = s.bodies[id]!, h = speaker(id);
  if (h < 0) return '';
  const p = s.people[h]!, alive = b.members.map(i => s.people[i]!).filter(x => x.alive), young = alive.filter(x => (s.t - x.born) / 52 < 14).length;
  const lone = p.spouse < 0 && young > 0 ? (p.sex ? 'a widow' : 'a widower') : p.spouse < 0 && alive.length === 1 ? 'alone' : '';
  return `${nameOf(h)} of ${cellWords(b.home)}, ${ageOf(h)}${lone ? ', ' + lone : ''}, with ${alive.length} in the house${young ? ` (${young} of them children)` : ''}`;
}
const owedWords = (bd: Bond): string => (bd.labour ? `${Math.round(bd.q)} days of work` : `${bd.q < 10 ? bd.q.toFixed(1) : Math.round(bd.q)} of ${KINDS[bd.kind]?.id ?? 'goods'}`);
const Cap = (x: string): string => x.charAt(0).toUpperCase() + x.slice(1);

/** A line from the record, with houses called by name. */
const named = (x: string): string => x.replace(/house (\d+)/g, (_m, n: string) => house(Number(n))).replace(/\((\d+), ?(\d+)\)/g, (_m, cx: string, cy: string) => placeName(s, Number(cy) * s.side + Number(cx)));

/** One thing that weighs on a house, as a clause. */
function burdenWords(bd: Bond, by: number): string {
  const B = house(bd.a === by ? bd.b : bd.a);
  if (bd.about === 'yield') return bd.way === 'tithe' ? `it owes ${B} a tenth of all it gathers` : `it owes ${B} the Crown’s twentieth of all it gathers`;
  if (bd.about === 'bond') return bd.secures >= 0 ? `it has pledged its ground to ${B} against a debt` : bd.way === 'manor' ? `it holds its ground of ${B} by birth, for ${Math.round(bd.share * 100)} parts in a hundred of the yield` : `it has ground from ${B} for ${Math.round(bd.share * 100)} parts in a hundred of the yield`;
  return `it owes ${B} ${owedWords(bd)}${bd.way === 'blood' ? ' as the price of blood' : ''}`;
}

function matterWords(p: Petition): string {
  const A = Cap(house(p.by)), B = house(p.against);
  if (p.burdens.length) {
    const bs = p.burdens.map(id => s.bonds.find(b => b.id === id)).filter((b): b is Bond => !!b);
    return `${A} is in want of ${NEEDS[p.need]!.id}. ${bs.length > 1 ? `${['', 'One thing weighs', 'Two things weigh', 'Three things weigh'][bs.length]} on it` : 'One thing weighs on it'}: ${bs.map(b => burdenWords(b, p.by)).join('; ')}.`;
  }
  if (p.reason === 'challenge') { const r = s.court!.rules.find(x => x.id === p.bond); return `${A} has been hurt by a rule of yours and asks that it be struck. The rule: ${r ? esc(plain(r.cut + ' when ' + r.shape)) : 'one now gone'}.`; }
  const bd = s.bonds.find(b => b.id === p.bond);
  if (!bd) return p.shape.includes('shunned') ? `${A} came here within the year and is in want of ${NEEDS[p.need]!.id}. Its neighbours hold that newcomers bring harm, and will not deal with it.` : `${A} is in dire want of ${NEEDS[p.need]!.id}, and nobody stands between it and what it needs.`;
  if (bd.about === 'act' && bd.way === 'blood') {
    const d = R.index.get(bd.rec), dead = d && d.k === 'die' ? `${nameOf(d.a)}, ${Math.floor(d.q)},` : 'One';
    return p.side === 'owed' ? `${A} asks the price of blood. ${dead} of that house died of wounds after a struggle with ${B}. The custom is ${P.bloodPrice} days of work.` : `${A} is held to owe ${B} the price of blood for ${dead.replace(/,$/, '')}, who died of wounds after they struggled, and says it should not be.`;
  }
  if (bd.about === 'act' && bd.basis === 'wrong') {
    const king = s.bodies[bd.a]!.rank === 'bailiff';
    if (p.side === 'owed') return king ? `${A} says ${B} took ${owedWords(bd)} for the Crown and paid nothing.` : `${A} says ${B} took ${owedWords(bd)} from it, and asks to be made whole.`;
    return `${A} is held to owe ${B} ${owedWords(bd)} for a taking, and says it never did it.`;
  }
  if (bd.about === 'act') {
    const how = bd.basis === 'grant' ? 'by an order of this court' : bd.way ? `having agreed to give ${wayWords(bd.way)}` : 'by its word';
    return p.side === 'owed' ? `${A} says ${B} owes it ${owedWords(bd)}, ${how}, and will not pay.` : `${A} owes ${B} ${owedWords(bd)}, ${how}, and says it cannot bear it.`;
  }
  if (bd.about === 'yield') return bd.way === 'tithe' ? `${A} owes ${B} a tenth of all it gathers, as everyone in the parish does, and says it cannot bear it this year.` : `${A} owes ${B} the Crown’s share of all it gathers, and says it cannot bear it this year.`;
  if (bd.about === 'land') return `${A} has too little ground. ${Cap(B)} holds ground at ${cellWords(bd.cell)} and has left it idle for more than a year.`;
  if (bd.secures >= 0) return `${A} pledged its ground to ${B} against a debt, and in its want fears to lose it.`;
  if (bd.way === 'manor') return `${A} holds its ground of ${B} by birth, as its forebears did, for ${Math.round(bd.share * 100)} parts in a hundred of what it yields, and says that is more than it can bear.`;
  return p.side === 'owed' ? `${A} let ground to ${B}, is now short of ground itself, and asks for it back.` : `${A} has the use of ground from ${B} for ${Math.round(bd.share * 100)} parts in a hundred of what it yields, and says the share is more than it can bear.`;
}

/** What each side says. Each speaks from what it holds true, or wants believed. */
/** What the one on the other side of a burden says of it. */
function holderSays(bd: Bond): string {
  if (bd.about === 'yield') return bd.way === 'tithe' ? '“The tenth is God’s, and was granted before any of us was born.”' : '“It is the king’s due, and I must answer for it.”';
  if (bd.about === 'bond') return bd.way === 'manor' ? '“They hold of me by birth, as their fathers held of mine.”' : bd.secures >= 0 ? '“We lent on that ground. Without it we lent on nothing.”' : '“We agreed the share between us.”';
  return bd.way === 'blood' ? '“A life was taken. Let them pay for it.”' : '“A debt is a debt.”';
}

function pleas(p: Petition): [string, string] {
  if (p.reason === 'challenge') return ['“Your rule has ruined us.”', ''];
  const weeks = (id: number, n: number): number => cover(s.bodies[id]!.store, askAhead(s, s.bodies[id]!))[n]!;
  const pressed = (id: number): boolean => { const c = cover(s.bodies[id]!.store, askAhead(s, s.bodies[id]!)); return c.some((x, n) => NEEDS[n]!.harm >= 0.5 && x < P.short); };
  const mouths = (id: number): number => s.bodies[id]!.members.filter(i => s.people[i]!.alive).length;
  const ask = p.need >= 0 ? `“We are ${mouths(p.by)} mouths with ${weeks(p.by, p.need) < 10 ? weeks(p.by, p.need).toFixed(1) : Math.round(weeks(p.by, p.need))} weeks of ${NEEDS[p.need]!.id}.”` : '“We ask only what is ours.”';
  if (p.against < 0) return [ask, ''];
  const bd = s.bonds.find(b => b.id === p.bond), B = s.bodies[p.against]!;
  let ans = '';
  if (!bd) ans = '';
  else if (bd.about === 'act' && bd.way === 'blood') ans = p.side === 'owed' ? '“They came at us first.”' : '“A life was taken. Let them pay for it.”';
  else if (bd.about === 'act' && bd.basis === 'wrong') {
    if (p.side === 'owes') ans = '“Our ground was stripped, and we know that house.”';
    else if (B.rank === 'bailiff') ans = '“The king’s store was empty. I took what was needed, as my office allows.”';
    else if (bd.doer === -1) ans = '“The inquest has spoken.”';
    else { const h = speaker(p.against), frank = bd.doer === bd.a && h >= 0 && s.people[h]!.scruple >= 0.4 && pressed(p.against); ans = frank ? '“We took it. Our children were starving.”' : '“It was not us. Ask who was seen there.”'; }
  } else if (bd.about === 'act') ans = p.side === 'owed' ? (pressed(p.against) ? `“We have ${mouths(p.against)} mouths and little laid by. Take it and we starve.”` : '“We will pay when the corn is in.”') : pressed(p.against) ? '“We need it ourselves.”' : '“A debt is a debt.”';
  else if (bd.about === 'yield') ans = bd.way === 'tithe' ? '“The tenth is God’s, and was granted before any of us was born.”' : '“It is the king’s due, and I must answer for it.”';
  else if (bd.about === 'land') ans = `“It is ours by ${bd.basis === 'use' ? 'long use' : bd.basis === 'grant' ? 'grant' : 'right'}, these ${Math.max(1, Math.floor((s.t - bd.since) / 52))} years.”`;
  else if (bd.way === 'manor') ans = '“They hold of me by birth, as their fathers held of mine.”';
  else ans = bd.secures >= 0 ? '“We lent on that ground. Without it we lent on nothing.”' : '“We agreed the share between us.”';
  if ((B.lore[`house:${p.by}`] ?? 0) > P.heed) ans += ' “And everyone knows that house brings harm.”';
  return [ask, ans];
}

function cutWords(p: Petition, cut: string): [string, string] {
  const bd = s.bonds.find(b => b.id === p.bond), B = house(p.against), A = house(p.by);
  const storeOf = (k: number): number => Math.round(s.court!.store[k] ?? 0);
  if (p.reason === 'challenge') return cut === 'uphold' ? ['Uphold the rule', 'It stands, and cannot be challenged again.'] : ['Strike the rule', 'Like cases will come to you again.'];
  if (cut.startsWith('ease:')) {
    const eb = s.bonds.find(b => b.id === Number(cut.slice(5)))!, E = house(eb.a === p.by ? eb.b : eb.a);
    const what = eb.about === 'yield' ? (eb.way === 'tithe' ? 'the tithe' : 'the Crown’s share') : eb.about === 'bond' ? (eb.secures >= 0 ? 'the pledge' : `${E}’s share`) : `what it owes ${E}`;
    return [`Lift ${what} for a year`, eb.way === 'crown' ? 'Your own store goes without it.' : `${Cap(E)} goes without it, and will hold it against you.`];
  }
  if (!bd || cut === 'give' || cut === 'dismiss' || cut === 'vouch') return ({
    vouch: ['Vouch for them', 'Their neighbours must deal with them, and will hold it against you.'],
    give: ['Relief from the Crown’s store', `Three weeks of ${NEEDS[p.need]!.id}, now.`],
    levy: ['Lay it on the neighbours', 'Whoever nearby has most must give, and is owed it back.'],
    promise: ['Give your word', `Relief within ${P.wordWeeks} weeks. A broken word is the worst harm there is.`],
    dismiss: ['Send them away', 'They will hold it against the court.'],
  } as Record<string, [string, string]>)[cut]!;
  const debtor = house(bd.a);
  if (bd.about === 'act') return ({
    enforce: [`Hold ${debtor} to it`, 'Paid now as far as it can be; the rest is worked off. The court keeps a tenth.'],
    part: ['Part it', 'Half is paid, half is let go.'],
    strike: ['Let the debt go', `${house(bd.b)} loses what it was owed.`],
    stay: ['Stay it a year', 'Nothing is due until then.'],
    redeem: ['The Crown pays it', `Out of the store, which holds ${storeOf(bd.kind)} of ${KINDS[bd.kind]?.id ?? 'it'}.`],
    inquire: ['Hold an inquest', 'Find who truly did it. The matter stays before you.'],
  } as Record<string, [string, string]>)[cut]!;
  if (bd.about === 'land') return ({
    enforce: [`Confirm ${B} in its ground`, `${A} gets nothing.`],
    part: ['Share the ground', 'Each holds half.'],
    strike: [`Take the ground from ${B}`, 'It lies open to whoever works it.'],
    turn: [`Give the ground to ${A}`, `${B} loses it.`],
  } as Record<string, [string, string]>)[cut]!;
  if (bd.about === 'yield') return ({
    enforce: ['Hold them to it', 'The share stands as it always has.'],
    part: ['Halve the share', `${Cap(B)} takes half as much from now on.`],
    strike: ['Free them of it', `${Cap(B)} loses the share for good.`],
    stay: ['Lift it for a year', 'Nothing is owed until then.'],
  } as Record<string, [string, string]>)[cut]!;
  const pledge = bd.secures >= 0;
  return ({
    enforce: pledge ? ['Let the ground pass', 'The creditor takes it now and the debt is done.'] : ['Hold them to the letting', 'It runs its full term again.'],
    part: pledge ? ['Shorten it', 'Half a year more, no longer.'] : ['Halve it', 'The share is halved, or the term cut to half a year.'],
    strike: pledge ? ['Free the ground', 'The surety is void; the debt stands bare.'] : ['End the letting', 'The ground goes back.'],
    stay: ['Stay it a year', 'Nothing changes until then.'],
  } as Record<string, [string, string]>)[cut]!;
}

// --- The pieces of the page ---

function tally(): string {
  const c = s.court!, seals = [0, 1, 2, 3, 4].map(i => `<span class="seal${c.standing >= i + 1 ? '' : c.standing >= i + 0.5 ? ' half' : ' gone'}"></span>`).join('');
  const alive = s.people.filter(p => p.alive).length, store = c.store.map((q, k) => [q, k] as const).filter(([q]) => q >= 1).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([q, k]) => `${Math.round(q)} ${KINDS[k]!.id}`).join(', ') || 'empty';
  return `<div class="tally"><div class="in">
    <span class="when">${seasonOf(s.t)}, year ${Math.floor(s.t / 52) + 1}, week ${(s.t % 52) + 1}</span>
    <span class="stat"><span class="label">Standing</span><span class="seals" title="${c.standing.toFixed(1)} of 5">${seals}</span></span>
    <span class="stat" title="What you can give in relief. A tenth of what you enforce and the Crown’s share of every harvest come into it."><span class="label">Crown’s store</span><span class="gilt">${store}</span></span>
    <span class="stat"><span class="label">Souls</span><span>${alive}</span></span>
    <span class="stat"><span class="label">Weeks left</span><span>${Math.max(0, P.reign - s.t)}</span></span>
  </div></div>`;
}

function matterCard(p: Petition): string {
  const b = s.bodies[p.by]!, cov = cover(b.store, askAhead(s, b)), pick = chosen.get(p.id);
  const want = p.need >= 0 ? `It has ${cov[p.need]! < 10 ? cov[p.need]!.toFixed(1) : Math.round(cov[p.need]!)} weeks of ${NEEDS[p.need]!.id} laid by.` : 'It is not in want.';
  const chain = (p.rec >= 0 ? R.chain(p.rec, 4) : []).map(named);
  const inBody = top(s, b).id !== b.id;
  const widths: [Width, string][] = [['case', 'This case only'], ...(inBody && p.reason !== 'challenge' ? [['body', 'A rule for their body'] as [Width, string]] : []), ...(p.reason !== 'challenge' ? [['realm', 'A rule for the realm'] as [Width, string]] : [])];
  return `<article class="matter${pick ? ' chosen' : ''}">
    <header><h3>${esc(cap(house(p.by)))}${p.reason === 'challenge' ? ' against a rule' : p.burdens.length ? ', in want' : p.against >= 0 ? ' against ' + esc(house(p.against)) : ''}</h3>
      <span class="small soft">${p.speaksFor > 1 ? `one of a body of ${p.speaksFor} houses · ` : ''}${p.waited ? `waited ${p.waited} week${p.waited > 1 ? 's' : ''}` : 'new this week'}${p.reason === 'clash' ? ' · two bodies’ rules disagree' : ''}</span></header>
    <p>${matterWords(p)}</p>
    <p class="small soft">${esc(who(p.by))}${!p.burdens.length && p.against >= 0 && !s.bodies[p.against]!.rank ? ' — against ' + esc(who(p.against)) : ''}</p>
    ${(() => { const [a, b] = pleas(p); if (!p.burdens.length) return `<p>${esc(Cap(house(p.by)))}: ${a}</p>${b ? `<p>${esc(Cap(house(p.against)))}: ${b}</p>` : ''}`; return `<p>${esc(Cap(house(p.by)))}: ${a}</p>` + p.burdens.map(id => s.bonds.find(x => x.id === id)).filter((x): x is Bond => !!x).map(x => `<p>${esc(Cap(house(x.a === p.by ? x.b : x.a)))}: ${holderSays(x)}</p>`).join(''); })()}
    ${chain.length ? `<div><span class="label">How it came about</span><ol class="chain">${chain.map(c => `<li>${esc(c)}</li>`).join('')}</ol></div>` : ''}
    <div class="cuts">${cuts(s, p).map(c => { const [t, d] = cutWords(p, c); return `<button data-cut="${p.id}:${c}" aria-pressed="${pick?.cut === c}">${esc(t)}<span>${esc(d)}</span></button>`; }).join('')}</div>
    ${pick && pick.cut !== 'inquire' && !(p.burdens.length && !pick.cut.startsWith('ease:')) && widths.length > 1 ? `<div><span class="label">How far it reaches</span><div class="widths">${widths.map(([w, t]) => `<button data-width="${p.id}:${w}" aria-pressed="${pick.width === w}">${t}</button>`).join('')}</div></div>` : ''}
    ${p.reason === 'challenge' || p.burdens.length ? '' : `<p class="shape">A rule here would cover: ${esc(plain(p.shape))}</p>`}
  </article>`;
}

function weekPanel(): string {
  const n = chosen.size, c = s.court!;
  const waiting = c.docket.length - seated.length;
  return `<section><div class="bar"><div><h2>The audience</h2><p class="soft small">${seated.length ? `${seated.length} seated${waiting > 0 ? `, ${waiting} more waiting` : ''}. You may hear ${P.hearings}; a fourth costs half a seal.` : 'Nobody waits on you this week.'}</p></div>
    <button class="go" id="pass">${n ? `Give ${n} ruling${n > 1 ? 's' : ''} and let the week pass` : 'Let the week pass'}</button></div>
    <div class="matters">${seated.map(matterCard).join('')}</div></section>
    ${lastWeek.length ? `<section><h2>Last week</h2><ul class="list">${lastWeek.map(x => `<li>${x}</li>`).join('')}</ul></section>` : ''}`;
}

function rollsPanel(): string {
  const c = s.court!;
  if (!c.rules.length) return '<section><h2>The rolls</h2><p class="soft">You have made no rule yet. Until you do, every like case comes back to you.</p></section>';
  return `<section><h2>The rolls</h2><div class="tbl"><table><thead><tr><th>Rule</th><th>Binds</th><th>Made</th><th>Settled below</th></tr></thead><tbody>${c.rules.slice().sort((a, b) => b.uses - a.uses).map(r => `<tr><td><strong>${esc(cap(r.cut))}</strong> when ${esc(plain(r.shape))}</td><td>${r.scope === -1 ? 'the realm' : 'body ' + r.scope}</td><td>week ${r.since + 1}</td><td>${r.uses}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function realmPanel(): string {
  const c = s.court!, hs = s.bodies.filter(b => b.alive && !b.parts.length && b.members.length), bodies = s.bodies.filter(b => b.alive && b.parts.length).length;
  const sum = (k: number): number => Math.round(hs.reduce((x, b) => x + b.store[k]!, 0));
  const sore = Object.values(c.grief).filter(g => g >= P.aggrieved).length;
  const ways = new Set(hs.flatMap(b => Object.keys(b.ways)));
  const expect = ['Owed on a bond', 'Bound by a bond', 'Shut out by a bond', 'In bare want'].map((t, k) => `<tr><td>${t}</td><td>${Math.round((100 * hs.reduce((x, b) => x + (b.plea[k] ?? 0.5), 0)) / Math.max(1, hs.length))} in 100</td></tr>`).join('');
  const cell = (t: string, v: string, cls = ''): string => `<div><div class="label">${t}</div><div class="num ${cls}">${v}</div></div>`;
  return `<section><h2>The realm</h2><div class="grid">
    ${cell('Souls', String(s.people.filter(p => p.alive).length))}${cell('Houses', String(hs.length))}${cell('Bodies of houses', String(bodies))}
    ${cell('Aggrieved houses', String(sore), sore >= P.faction * hs.length * 0.7 ? 'bad' : '')}${cell('Needed to withdraw confidence', String(Math.ceil(P.faction * hs.length)))}
    ${cell('Grain laid by', String(sum(0)))}${cell('Word given, not yet made good', String(c.words.length))}${cell('Word kept / broken', `${c.wordsKept} / ${c.wordsBroken}`, c.wordsBroken ? 'bad' : '')}
  </div></section>
  <section><h3>Places</h3><div class="tbl"><table><thead><tr><th>Place</th><th>Houses</th><th>Souls</th><th>Who is there</th></tr></thead><tbody>${(() => {
    const at = new Map<number, typeof hs>();
    for (const b of hs) { const l = at.get(b.home); if (l) l.push(b); else at.set(b.home, [b]); }
    return [...at].sort((x, y) => y[1].length - x[1].length).slice(0, 30).map(([cell, l]) => `<tr><td>${esc(cellWords(cell))}</td><td>${l.length}</td><td>${l.reduce((x, b) => x + b.members.filter(i => s.people[i]!.alive).length, 0)}</td><td>${esc(l.filter(b => b.rank).map(b => Cap(house(b.id)).replace(/ (of|at) [A-Z][a-z]+$/, '')).join('; '))}</td></tr>`).join('');
  })()}</tbody></table></div></section>
  <section><h3>What houses expect of your court</h3><p class="soft small">How likely they think you are to find for the one who asks. It decides who comes.</p><div class="tbl"><table><tbody>${expect}</tbody></table></div></section>
  <section><h3>Ways of dealing known in the realm</h3><ul class="list">${[...ways].sort().map(w => `<li>${esc(wayWords(w))}</li>`).join('') || '<li class="soft">Only goods for goods.</li>'}</ul></section>`;
}

function recordPanel(): string {
  const ev = R.events.slice(-40).reverse();
  return `<section><h2>The record</h2><ul class="list">${ev.map(e => `<li>${esc(named(e.text))}${e.chain[0] ? `<div class="small soft">because ${esc(named(e.chain[0]))}</div>` : ''}</li>`).join('') || '<li class="soft">Nothing the chroniclers thought worth writing yet.</li>'}</ul></section>`;
}

function render(): void {
  if (over) { app.innerHTML = `${tally()}<div class="wrap"><section class="start"><h1>${over}</h1><p>${s.court!.standing > 0 ? `You kept the realm for ${Math.floor(s.t / 52)} years, with ${s.court!.standing.toFixed(1)} of 5 in standing. You made ${s.court!.rules.length} rules, and they settled ${s.court!.rules.reduce((x, r) => x + r.uses, 0)} matters without you.` : `Too many houses had had enough. It took ${s.t} weeks.`}</p><div class="choices"><button class="go" id="again">Begin another reign</button></div></section>${rollsPanel()}${recordPanel()}</div>`; return; }
  const tabs: [typeof tab, string][] = [['week', 'The audience'], ['rolls', `The rolls (${s.court!.rules.length})`], ['realm', 'The realm'], ['record', 'The record']];
  app.innerHTML = `${tally()}<div class="wrap"><nav class="tabs">${tabs.map(([k, t]) => `<button data-tab="${k}" aria-pressed="${tab === k}">${t}</button>`).join('')}</nav>${tab === 'week' ? weekPanel() : tab === 'rolls' ? rollsPanel() : tab === 'realm' ? realmPanel() : recordPanel()}</div>`;
}

// --- The week ---

function openWeek(): void {
  s.log = [];
  seated = audience(s);
  chosen.clear();
}

function passWeek(): void {
  const c = s.court!, before = c.standing;
  const rulings: Ruling[] = [...chosen].map(([petition, v]) => ({ petition, cut: v.cut, width: v.width }));
  const said = rulings.map(r => { const p = seated.find(x => x.id === r.petition)!; return `You ruled: <strong>${esc(cutWords(p, r.cut)[0])}</strong>, ${esc(house(p.by))}${p.against >= 0 ? ' against ' + esc(house(p.against)) : ''}${r.width !== 'case' && r.cut !== 'inquire' ? `, as a rule for ${r.width === 'realm' ? 'the realm' : 'their body'}` : ''}.`; });
  hear(s, rulings);
  const below = s.log.filter(r => r.k === 'rule' && r.kind2 === 1).length, withdrew = s.log.some(r => r.k === 'withdraw');
  const words = s.log.filter(r => r.q2 === 9 && (r.k === 'keep' || r.k === 'break')).map(r => (r.k === 'keep' ? `Your word to house ${r.b} was kept out of the store.` : `<span class="bad">Your word to house ${r.b} was broken: the store had nothing to give.</span>`));
  const seen = R.events.length;
  advance(s, true);
  R.read(s);
  lastWeek = [...said, ...words];
  if (below) lastWeek.push(`${below} matter${below > 1 ? 's were' : ' was'} settled below by your rules.`);
  if (withdrew) lastWeek.push(`<span class="bad">Enough houses had had enough: they withdrew their confidence. Standing fell from ${before.toFixed(1)} to ${c.standing.toFixed(1)}.</span>`);
  else if (c.standing < before) lastWeek.push(`A fourth hearing cost you half a seal.`);
  for (const e of R.events.slice(seen)) lastWeek.push(esc(named(e.text)));
  if (c.standing <= 0) over = 'The regency has fallen';
  else if (s.t >= P.reign) over = 'The king returns';
  else openWeek();
}

// --- Beginning ---

function start(seed: number, side: number, souls: number, years: number): void {
  s = found(seed, -years * 52, side, souls);
  R = new Readers();
  over = ''; lastWeek = []; tab = 'week';
  const total = years * 52;
  const tick = (): void => {
    const t0 = performance.now();
    while (s.t < 0 && performance.now() - t0 < 60) { advance(s); for (const r of s.log) if (r.k !== 'make') R.index.set(r.id, r); }
    if (s.t < 0) {
      app.innerHTML = `<div class="wrap"><section class="start"><h1>The realm before you</h1><p>The realm is living through the ${years} years before your coming: ${s.people.filter(p => p.alive).length} souls, year ${Math.floor((total + s.t) / 52) + 1} of ${years}.</p><progress id="past" max="${total}" value="${total + s.t}"></progress></section></div>`;
      setTimeout(tick, 0);
      return;
    }
    openCourt(s);
    openWeek();
    render();
  };
  tick();
}

function welcome(): void {
  app.innerHTML = `<div class="wrap"><section class="start">
    <h1>Vicarius Regis</h1>
    <p>The king is away for three years and you hold his court. Each week those whom nothing below could settle come before you. Rule on up to three. A ruling for one case settles one case, and the question will come back. A rule for the realm settles every like case without you, and every arrangement built on the old understanding is disturbed.</p>
    <p class="soft">Nothing in this realm is scripted. Its people farm, deal, quarrel and believe by their own lights, and they will learn what to expect of you.</p>
    <div><label class="label" for="seed">Seed of the realm</label><br><input id="seed" type="number" min="1" value="${1 + Math.floor(Math.random() * 999)}"></div>
    <div class="choices"><button class="go" id="small">A small realm: about 200 souls, ready in seconds</button><button id="full">The realm: about 900 souls, takes a minute to found</button></div>
  </section></div>`;
}

app.addEventListener('click', ev => {
  const b = (ev.target as HTMLElement).closest('button');
  if (!b) return;
  const seedOf = (): number => Math.max(1, Number((document.getElementById('seed') as HTMLInputElement | null)?.value) || 1);
  if (b.id === 'small') return start(seedOf(), P.side, P.souls, 12);
  if (b.id === 'full') return start(seedOf(), P.realmSide, P.realmSouls, 10);
  if (b.id === 'again') return welcome();
  if (b.id === 'pass') { passWeek(); render(); window.scrollTo(0, 0); return; }
  if (b.dataset.tab) { tab = b.dataset.tab as typeof tab; render(); return; }
  if (b.dataset.cut) {
    const at = b.dataset.cut.indexOf(':'), id = b.dataset.cut.slice(0, at), cut = b.dataset.cut.slice(at + 1), pid = Number(id), had = chosen.get(pid);
    if (had?.cut === cut) chosen.delete(pid);
    else if (had || chosen.size <= P.hearings) chosen.set(pid, { cut: cut!, width: had?.width ?? 'case' });
    render();
    return;
  }
  if (b.dataset.width) { const [id, w] = b.dataset.width.split(':'), had = chosen.get(Number(id)); if (had) { had.width = w as Width; render(); } }
});

welcome();
