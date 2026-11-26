'use strict';
// Runs reigns of the primitives-only core with an automatic court, and counts which situations
// emerge. None of the situations counted here is coded anywhere; they are patterns in the record.
//   node core/sim.js [reigns=200] [seed=1]

const K = require('./core.js');
const G = require('./generator.js');
const { C } = K;

// A plain court: hears whoever holds its word first, then the most pressed; grants, takes the
// alternative or denies in rough proportion, and won't spend its last standing.
function court(w, pets) {
  const order = [...pets].sort((a, b) => b.urgency - a.urgency || w.rng() - 0.5);
  const heard = order.slice(0, C.hearings);
  return heard.map((p) => {
    if (K.holdsWord(w, p.petitioner)) return [p, 0];
    const roll = w.rng();
    let choice = roll < 0.5 ? 0 : roll < 0.85 ? 1 : 'deny';
    if (choice !== 'deny' && !p.options[choice]) choice = 0;
    if (choice !== 'deny' && p.options[choice].cost && w.standing <= 1) choice = p.options.findIndex((o) => !o.cost);
    if (choice === -1) choice = 'deny';
    return [p, choice];
  });
}

function runReign(seed) {
  const w = K.newWorld(seed);
  while (!w.over) {
    const pets = G.generate(w);
    const rulings = court(w, pets);
    const heard = rulings.map(([p]) => p.petitioner);
    for (const p of pets) K.note(w, 'raised', '', { sig: { motive: p.motive, raised: p.raised }, petitioner: p.petitioner });
    for (const [p, choice] of rulings) G.rule(w, p, choice);
    K.testBindings(w, 'hearings', { heard, audience: pets.map((p) => p.petitioner) });
    K.close(w, { heard, unheard: pets.map((p) => p.petitioner).filter((id) => !heard.includes(id)), audience: pets.map((p) => p.petitioner) });
    // the record of what households hold at the week's end
    w.log.push({ week: w.week, tag: 'state', pariahs: K.alive(w).filter(K.isPariah).length, leaders: K.alive(w).filter((h) => h.esteem >= 2).length,
      hardRivals: Object.values(w.rivalry).filter((v) => v <= -2).length, allies: Object.values(w.rivalry).filter((v) => v >= 1).length,
      urgent: K.alive(w).filter(K.isUrgent).length, laws: w.bindings.filter((b) => b.kind === 'law').length });
    if (w.standing <= 0) w.over = 'fallen';
    else if (w.week >= C.weeks) w.over = 'kept';
    w.week++;
  }
  return w;
}

// Each check is a pattern over the record: granted rulings by tag, binding outcomes, or state.
const granted = (tag) => (w) => w.log.filter((e) => e.tag === 'ruling' && e.sig.choice !== 'deny' && e.sig.tags.includes(tag)).length;
const raised = (tag) => (w) => w.log.filter((e) => e.tag === 'raised' && e.sig.raised.includes(tag)).length;
const logged = (tag) => (w) => w.log.filter((e) => e.tag === tag).length;
const state = (field) => (w) => (w.log.some((e) => e.tag === 'state' && e[field] > 0) ? 1 : 0);
const CHECKS = [
  ['Surety (a household stands surety for another)', granted('surety')],
  ['  …by kin', granted('kinSurety')],
  ['  …surety kept', logged('binding:pledge:kept')],
  ['Debt deferred under bond', granted('debtTime')],
  ['  …then default', logged('default')],
  ['Debt called in', granted('call')],
  ['Pooling (peers share their load)', granted('pool')],
  ['  …compact pays its dividend', logged('dividend')],
  ['The court gives its word', granted('word')],
  ['  …and breaks it', logged('wordBroken')],
  ['A broken promise remembered (amends sought)', raised('amends')],
  ['Peace made with an adversary', granted('peace')],
  ['A charge brought', granted('charge')],
  ['Kin intercedes for the accused', raised('kinIntercede')],
  ['A region rallies before disaster', granted('rally')],
  ['A sign seized', granted('signSeized')],
  ['A sign decried', granted('decry')],
  ['A law laid on another estate', granted('law')],
  ['  …and repealed', logged('lawRepealed')],
  ['Precedent followed', logged('ruleFollowed')],
  ['Precedent broken', logged('ruleBroken')],
  ['A marriage across estates', granted('marriage')],
  ['A vow before the church', granted('vow')],
  ['The lax brought to the church', granted('exhort')],
  ['A pariah emerges (esteem −2)', state('pariahs')],
  ['A leader emerges (esteem +2)', state('leaders')],
  ['A rivalry hardens (−2)', state('hardRivals')],
  ['An alliance forms (+1)', state('allies')],
  ['Disaster', logged('disaster')],
];

function main() {
  const n = Number(process.argv[2] || 200), seed0 = Number(process.argv[3] || 1);
  const reigns = [];
  for (let i = 0; i < n; i++) reigns.push(runReign(seed0 + i * 7919));
  const kept = reigns.filter((w) => w.over === 'kept').length;
  const weeks = reigns.reduce((a, w) => a + w.week - 1, 0) / n;
  console.log(`${n} reigns · kept to week ${C.weeks}: ${kept} (${Math.round((100 * kept) / n)}%) · mean length ${weeks.toFixed(1)} weeks`);
  const st = reigns.flatMap((w) => w.log.filter((e) => e.tag === 'state'));
  console.log(`mean urgent households per week ${(st.reduce((a, e) => a + e.urgent, 0) / st.length).toFixed(1)} of ${reigns[0].households.length}`);
  console.log(`mean breaches ${(reigns.reduce((a, w) => a + w.breaches, 0) / n).toFixed(1)} · mean disasters ${(reigns.reduce((a, w) => a + w.disasters, 0) / n).toFixed(1)}`);
  console.log('');
  console.log('situation'.padEnd(52), 'reigns seen', '  per reign');
  for (const [name, f] of CHECKS) {
    const counts = reigns.map(f), seen = counts.filter((c) => c > 0).length;
    console.log(name.padEnd(52), `${String(Math.round((100 * seen) / n)).padStart(4)}%     `, (counts.reduce((a, c) => a + c, 0) / n).toFixed(2).padStart(7));
  }
}

if (require.main === module) main();
module.exports = { runReign, court, CHECKS };
