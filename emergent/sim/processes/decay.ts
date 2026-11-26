// Decay. What is used or neglected wears, and fails when wear passes its soundness.
// Stores spoil, what is used is used up or worn, a body unfed wears, a bond unused weakens.

import { exp } from '../math.ts';
import { BY_HARM, Kn, NEEDS, NK, NN, P, SERVING } from '../tables.ts';
import { ask } from '../value.ts';
import { living, rec } from '../util.ts';
import type { State } from '../types.ts';

export function decay(s: State): void {
  for (const b of s.bodies) {
    if (!b.alive) continue;
    for (let k = 0; k < NK; k++) if (b.store[k]! > 0) b.store[k] = b.store[k]! * (1 - Kn[k]!.keep);

    // Use: the most harmful need is served first, from what would spoil soonest.
    const R = ask(s, b), got = new Array<number>(NN).fill(0), used = new Array<number>(NK).fill(0);
    for (const n of BY_HARM) {
      let lack = R[n]! - got[n]!;
      for (const k of SERVING[n]!) {
        if (lack <= 1e-9) break;
        const kn = Kn[k]!, free = b.store[k]! - used[k]!;
        if (free <= 0) continue;
        const u = Math.min(free, lack / kn.serves[n]!);
        used[k] = used[k]! + u;
        for (let m = 0; m < NN; m++) got[m] = got[m]! + u * kn.serves[m]!;
        lack -= u * kn.serves[n]!;
      }
    }
    for (let k = 0; k < NK; k++) if (used[k]! > 0) b.store[k] = Math.max(0, b.store[k]! - used[k]! * Kn[k]!.use);
    const met = R.map((r, n) => (r > 0 ? Math.min(1, got[n]! / r) : 1));

    // A person wears by what they lack and by their years, and mends when the wearing stops.
    for (const p of living(s, b)) {
      const age = (s.t - p.born) / 52;
      let lackHarm = 0, worst = -1, worstBy = 0;
      for (let n = 0; n < NN; n++) {
        const h = NEEDS[n]!.harm * (1 - met[n]!);
        lackHarm += h;
        if (h > worstBy) { worstBy = h; worst = n; }
      }
      const years = P.age0 * exp((age - P.ageFrom) / P.ageRate) + P.infant * exp((-age * 52) / P.infantSpan);
      p.fed = met;
      p.wear = Math.max(0, p.wear + P.hurt * lackHarm + years - P.heal * p.wear);
      if (p.wear <= p.sound) continue;
      p.alive = false;
      const struck = s.t - p.blowAt <= 3;
      const need = !struck && P.hurt * lackHarm > years ? worst : -1;
      rec(s, 'die', { a: p.id, b: b.id, cell: b.home, need, q: age, cause: struck ? p.blow : need >= 0 ? b.why[need]! : -1 });
      if (p.spouse >= 0) s.people[p.spouse]!.spouse = -1;
    }
  }

  // Bonds weaken with disuse and lapse; regard fades.
  for (const bd of s.bonds) {
    if (bd.about === 'person') continue;
    bd.strength *= 1 - (bd.about === 'land' ? P.lapse : P.lapse / 2);
  }
  for (const key of Object.keys(s.ties)) {
    const v = s.ties[key]! * P.fade;
    if (v > -0.01 && v < 0.01) delete s.ties[key]; else s.ties[key] = v;
  }
}
