'use strict';
// Prints composed petitions from a simulated reign, to read the flavour.  node core/samples.js [seed]
const K = require('./core.js'), G = require('./generator.js'), F = require('./flavour.js'), S = require('./sim.js');
const seed = Number(process.argv[2] || 3);
const w = K.newWorld(seed), seen = new Set();
let shown = 0;
while (!w.over && shown < 14) {
  const pets = G.generate(w);
  for (const p of pets.sort((a, b) => b.urgency - a.urgency)) {
    const k = p.motive + (p.options[0].effects.find((e) => e.type === 'bind')?.binding.kind || p.options[0].means) + p.options[0].payer.kind;
    if (seen.has(k) || shown >= 14) continue;
    seen.add(k); shown++;
    const { title, plea } = F.compose(w, p), h = K.H(w, p.petitioner);
    console.log(`— week ${w.week}, ${K.seasonOf(w.week)} · ${h.name}, ${h.estate.toLowerCase()} of the ${h.region}`);
    console.log(`  ${title.toUpperCase()}`);
    console.log(`  “${plea}”`);
    p.options.forEach((o, i) => console.log(`   ${i ? 'or ' : '→ '}${F.summarize(w, o).join(' · ')}`));
    console.log('');
  }
  const rulings = S.court(w, pets), heard = rulings.map(([p]) => p.petitioner);
  for (const [p, c] of rulings) G.rule(w, p, c);
  K.testBindings(w, 'hearings', { heard }); K.close(w, { heard, unheard: pets.map((p) => p.petitioner).filter((i) => !heard.includes(i)) });
  if (w.standing <= 0 || w.week >= K.C.weeks) w.over = true;
  w.week++;
}
