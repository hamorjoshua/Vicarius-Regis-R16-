// The readers. They watch the realm week by week, recognise what a person would call an event, and
// write it down. They cannot change the state, and the processes never call them. This is the only
// place where words for a situation are allowed.

import { BY_HARM, KINDS, NEEDS, STOCKS, Rc, St } from '../sim/tables.ts';
import { bear } from '../sim/processes/grow.ts';
import type { Rec, State } from '../sim/types.ts';

export interface Event {
  t0: number; t1: number;
  /** What a chronicler would call it. */
  name: string;
  /** Its shape, without particulars: used to count kinds of thing. */
  shape: string;
  size: number;
  cell: number;
  who: number[];
  text: string;
  /** How it came about, link by link, where the record shows it. */
  chain: string[];
}

const SIDE: Record<string, string> = { G: 'goods', L: 'goods later', D: 'days of work', U: 'the use of ground', Y: 'a share of what the ground yields', LS: 'goods later, with its ground as surety', DS: 'days of work, with its ground as surety' };
/** A way of dealing, in words: what was given for what. */
/** A belief, in words. */
export function beliefWords(sign: string): string {
  if (sign === 'new') return 'that newcomers bring harm';
  if (sign.startsWith('house:')) return `that house ${sign.slice(6)} brings harm`;
  if (sign.startsWith('way:')) return `that to give ${wayWords(sign.slice(4))} brings harm`;
  if (sign.startsWith('born:')) return `that a child born to a house with ${['under a season', 'under half a year', 'under a year', 'a year or more'][Number(sign.slice(5))]} of bread in store comes to harm`;
  return sign;
}
export const wayWords = (way: string): string => { const [give, get] = way.split('>'); return `${SIDE[give!] ?? give} for ${SIDE[get!] ?? get}`; };

interface Cluster { need: number; t0: number; last: number; deaths: number; pop: number; cells: Map<number, number>; causes: number[] }
interface Strife { a: number; b: number; t0: number; last: number; fights: number; takings: number; deaths: number; first: number }

const year = (t: number): number => Math.floor(t / 52) + 1;
const season = (t: number): string => ['winter', 'spring', 'summer', 'autumn'][Math.floor((((t % 52) + 52 + 4) % 52) / 13)]!;
const when = (t: number): string => `${season(t)} of year ${year(t)}`;
const place = (s: { side: number }, cell: number): string => (cell < 0 ? 'the realm' : `(${cell % s.side},${Math.floor(cell / s.side)})`);

export class Readers {
  events: Event[] = [];
  /** Every record that is not plain work, kept so that causes can be followed back. */
  index = new Map<number, Rec>();
  pop: number[] = [];
  private clusters = new Map<number, Cluster>();
  private strife = new Map<string, Strife>();
  private moves: { t: number; body: number; to: number }[] = [];
  private stripped = new Map<number, { full: boolean; bare: boolean }>();
  private gathered: number[] = [];
  private withered: number[] = [];
  private words = { promise: [] as number[], keep: [] as number[], break: [] as number[] };
  side = 10;
  /** Each way of dealing: when it was first used, and how often. */
  ways = new Map<string, { first: number; uses: number }>();
  /** Each belief: when it first took hold, how many houses came to it themselves and how many were told. */
  beliefs = new Map<string, { first: number; own: number; told: number }>();

  /** One link of a chain, in words. */
  describe(r: Rec): string {
    const kind = r.kind >= 0 ? KINDS[r.kind]!.id : 'goods', need = r.need >= 0 ? NEEDS[r.need]!.id : '';
    switch (r.k) {
      case 'take':
        if (r.kind2 === -2) return `house ${r.a} took the ground at ${place(this, r.cell)} that house ${r.b} had pledged`;
        if (r.b < 0) return `house ${r.a} gathered ${kind} from ground others hold at ${place(this, r.cell)}`;
        if (r.need >= 0) return `house ${r.a}, in want of ${need}, took ${kind} from house ${r.b}`;
        return `house ${r.a} ${r.q2 ? 'fought house ' + r.b + ' for' : 'seized from house ' + r.b} the ${kind} it was owed`;
      case 'decay': return `cold withered the ${STOCKS[r.kind2]!.id} at ${place(this, r.cell)}`;
      case 'break':
        if (r.q2) return `house ${r.a} went away still owing work to house ${r.b}`;
        return `house ${r.a} broke its word to repay ${kind} to house ${r.b}`;
      case 'promise':
        if (r.way) return `house ${r.a}${r.need >= 0 ? ', in want of ' + need + ',' : ''} gave house ${r.b} ${wayWords(r.way)}`;
        if (r.kind2 === 1) return r.need >= 0 ? `house ${r.a}, in want of ${need}, promised ${Math.round(r.q2)} days of work to house ${r.b} for ${kind}` : `house ${r.a} agreed to work off what it owed house ${r.b}`;
        if (r.kind2 >= 3) return `house ${r.a} took ground at ${place(this, r.cell)} from house ${r.b} for a share of its yield${r.kind2 > 3 ? ', ground that house ' + r.b + ' itself holds of another' : ''}`;
        if (r.kind2 === 2) return `house ${r.a}, in want of ${need}, borrowed ${kind} from house ${r.b} against its ground at ${place(this, r.cell)}`;
        return `house ${r.a}, in want of ${need}, borrowed ${kind} from house ${r.b}`;
      case 'give':
        if (r.kind2 === 1) return r.need >= 0 ? `house ${r.b} drew ${kind} from the store its body holds in common` : `house ${r.a} put ${kind} into the common store`;
        return `house ${r.a} gave ${kind} to its kin, house ${r.b}`;
      case 'learn':
        if (r.way?.startsWith('belief:')) return `house ${r.a} came to believe ${beliefWords(r.way.slice(7))}${r.b >= 0 ? ', as house ' + r.b + ' told it' : ''}`;
        return `house ${r.a} came to know a way of dealing from house ${r.b}: ${wayWords(r.way ?? '')}`;
      case 'bar': return `house ${r.a} shut its door to house ${r.b}`;
      case 'move': return `house ${r.a} left for ${place(this, r.cell)}`;
      default: return `${r.k} (${r.a}, ${r.b})`;
    }
  }

  /** Follow a record back through what led to it. */
  chain(id: number, depth = 5): string[] {
    const out: string[] = [];
    for (let r = this.index.get(id); r && depth-- > 0; r = this.index.get(r.cause)) out.push(this.describe(r));
    return out;
  }

  private emit(e: Omit<Event, 'chain'> & { chain?: string[] }): void { this.events.push({ chain: [], ...e }); }

  private closeCluster(c: Cluster): void {
    const need = NEEDS[c.need]!.id, share = c.deaths / Math.max(1, c.pop), first = c.need === BY_HARM[0];
    const name = first ? (share > 0.1 ? 'famine' : share > 0.02 ? 'dearth' : 'hungry season') : share > 0.05 ? `great dying for want of ${need}` : `deaths for want of ${need}`;
    let cell = -1, most = 0;
    for (const [k, v] of c.cells) if (v > most) { most = v; cell = k; }
    const seen = new Set<string>(), chain: string[] = [];
    for (const id of c.causes) { const ch = this.chain(id).join(' ← '); if (ch && !seen.has(ch) && seen.size < 3) { seen.add(ch); chain.push(ch); } }
    const weeks = c.last - c.t0 + 1;
    this.emit({ t0: c.t0, t1: c.last, name, shape: `${name}`, size: c.deaths, cell, who: [], chain,
      text: `A ${name}: ${c.deaths} died for want of ${need} over ${weeks} week${weeks > 1 ? 's' : ''} from the ${when(c.t0)}, most of them around ${place(this, cell)}.` });
  }

  private closeStrife(f: Strife): void {
    const weeks = f.last - f.t0 + 1;
    if (f.fights < 3 || weeks < 13) return;
    const name = f.deaths > 0 ? 'blood feud' : 'feud';
    this.emit({ t0: f.t0, t1: f.last, name, shape: name, size: f.fights, cell: -1, who: [f.a, f.b], chain: [this.chain(f.first).join(' ← ')].filter(Boolean),
      text: `A ${name} between houses ${f.a} and ${f.b}: ${f.fights} fights over ${(weeks / 52).toFixed(1)} years from the ${when(f.t0)}${f.deaths ? `, and ${f.deaths} dead of their wounds` : ''}.` });
  }

  /** Read one week: the state it left and the records it wrote. */
  read(s: State): void {
    this.side = s.side;
    const t = s.t - 1, y = year(t) - 1;
    const alive = s.people.filter(p => p.alive).length;
    this.pop.push(alive);
    const add = (arr: number[], q: number): void => { arr[y] = (arr[y] ?? 0) + q; };
    for (const r of s.log) {
      if (r.k === 'make') {
        const rc = Rc[r.kind2]!;
        if (rc.from.length && St[rc.from[0]![0]]!.sown) add(this.gathered, r.q);
        continue;
      }
      this.index.set(r.id, r);
      if (r.k === 'die' && r.need >= 0) {
        let c = this.clusters.get(r.need);
        if (c && t - c.last > 8) { this.closeCluster(c); c = undefined; }
        if (!c) { c = { need: r.need, t0: t, last: t, deaths: 0, pop: alive + 1, cells: new Map(), causes: [] }; this.clusters.set(r.need, c); }
        c.last = t; c.deaths++;
        c.cells.set(r.cell, (c.cells.get(r.cell) ?? 0) + 1);
        if (r.cause >= 0) c.causes.push(r.cause);
      } else if (r.k === 'die' && r.cause >= 0) {
        const blow = this.index.get(r.cause);
        const f = blow && this.strife.get(`${Math.min(blow.a, blow.b)}:${Math.max(blow.a, blow.b)}`);
        if (f) f.deaths++;
      } else if (r.k === 'take' && r.b >= 0) {
        const key = `${Math.min(r.a, r.b)}:${Math.max(r.a, r.b)}`;
        let f = this.strife.get(key);
        if (f && t - f.last > 52) { this.closeStrife(f); f = undefined; }
        if (!f) { f = { a: Math.min(r.a, r.b), b: Math.max(r.a, r.b), t0: t, last: t, fights: 0, takings: 0, deaths: 0, first: r.id }; this.strife.set(key, f); }
        f.last = t; f.takings++;
        if (r.q2) f.fights++;
      } else if (r.k === 'move') this.moves.push({ t, body: r.a, to: r.cell });
      else if (r.k === 'gather') this.emit({ t0: t, t1: t, name: r.q2 > 1 ? 'league of bands' : 'band', shape: `body of depth ${r.q2}`, size: r.q, cell: r.cell, who: [r.a], text: r.q2 > 1 ? `Bands around ${place(s, r.cell)} joined into one body of ${r.q} houses, ${r.q2} deep, in the ${when(t)}.` : `${r.q} houses around ${place(s, r.cell)} that had long dealt well together became one body in the ${when(t)}.` });
      else if (r.k === 'leave' && r.kind2 === -4) this.emit({ t0: t, t1: t, name: 'band broken', shape: 'band broken', size: 1, cell: r.cell, who: [r.b], text: `The body at ${place(s, r.cell)} came apart in the ${when(t)}.` });
      else if (r.k === 'learn' && r.way?.startsWith('belief:')) {
        const sign = r.way.slice(7), kind = sign.startsWith('house:') ? 'house:' : sign;
        const bl = this.beliefs.get(kind) ?? { first: t, own: 0, told: 0 };
        if (r.b >= 0) bl.told++; else bl.own++;
        this.beliefs.set(kind, bl);
      }
      else if (r.k === 'promise' && r.way) {
        const w = this.ways.get(r.way);
        if (w) w.uses++;
        else {
          this.ways.set(r.way, { first: t, uses: 1 });
          this.emit({ t0: t, t1: t, name: 'new arrangement', shape: `way ${r.way}`, size: 1, cell: r.cell, who: [r.a, r.b], chain: [this.chain(r.cause).join(' ← ')].filter(Boolean), text: `Something new in the ${when(t)}: house ${r.a} gave house ${r.b} ${wayWords(r.way)}. Nobody in the realm had dealt so before.` });
        }
      }
      else if (r.k === 'decay') add(this.withered, r.q);
      else if (r.k === 'promise' || r.k === 'keep' || r.k === 'break') add(this.words[r.k], 1);
      else if (r.k === 'leave' && r.a < 0 && r.kind2 !== -4) this.emit({ t0: t, t1: t, name: 'house died out', shape: 'house died out', size: 1, cell: r.cell, who: [r.b], text: `House ${r.b} at ${place(s, r.cell)} died out in the ${when(t)} with no kin to take what it left.` });
    }

    // Ground stripped of what lived on it, and ground where it came back.
    if (t % 4 === 0) {
      for (let i = 0; i < s.cells.length; i++) for (let k = 0; k < St.length; k++) {
        const row = St[k]!;
        if (row.sown || row.eats.length || (row.r <= 0 && row.self <= 0)) continue;
        const K = bear(s.cells[i]!, k);
        if (K < 30) continue;
        const key = i * St.length + k, f = s.cells[i]!.stock[k]! / K;
        const st = this.stripped.get(key) ?? { full: false, bare: false };
        if (f > 0.5) {
          if (st.bare) this.emit({ t0: t, t1: t, name: 'recovery', shape: `recovery of ${row.id}`, size: 1, cell: i, who: [], text: `The ${row.id} at ${place(s, i)} came back by the ${when(t)}.` });
          st.full = true; st.bare = false;
        } else if (f < 0.08 && st.full && !st.bare) {
          st.bare = true;
          this.emit({ t0: t, t1: t, name: 'exhaustion', shape: `exhaustion of ${row.id}`, size: 1, cell: i, who: [], text: `The ${row.id} at ${place(s, i)} was stripped nearly bare by the ${when(t)}.` });
        }
        this.stripped.set(key, st);
      }
    }

    // Flight: several houses leaving within a few weeks.
    const lastMove = this.moves[this.moves.length - 1];
    if (lastMove && t - lastMove.t > 8) {
      if (this.moves.length >= 3) this.emit({ t0: this.moves[0]!.t, t1: lastMove.t, name: 'flight', shape: 'flight', size: this.moves.length, cell: this.moves[0]!.to, who: this.moves.map(m => m.body), text: `A flight: ${this.moves.length} houses left their homes in the ${when(this.moves[0]!.t)}.` });
      this.moves = [];
    }

    // The year's crop and the year's word, judged when the year closes.
    if (s.t % 52 === 0) {
      const g = this.gathered[y] ?? 0, past = this.gathered.slice(Math.max(0, y - 3), y).filter(x => x > 0);
      const usual = past.length ? past.reduce((a, b) => a + b, 0) / past.length : 0;
      const perHead = g / Math.max(1, alive);
      if (usual > 0 && g < 0.6 * usual) this.emit({ t0: t - 51, t1: t, name: 'failed crop', shape: 'failed crop', size: Math.round(usual - g), cell: -1, who: [], text: `The crop of year ${y + 1} failed: ${Math.round(g)} gathered against ${Math.round(usual)} in the years before (${perHead.toFixed(0)} a head).` });
      else if (usual > 0 && g > 1.4 * usual) this.emit({ t0: t - 51, t1: t, name: 'great crop', shape: 'great crop', size: Math.round(g - usual), cell: -1, who: [], text: `Year ${y + 1} brought a great crop: ${Math.round(g)} gathered against ${Math.round(usual)} before.` });
      const w = this.withered[y] ?? 0;
      if (w > 0.1 * g && w > 100) this.emit({ t0: t - 51, t1: t, name: 'crop lost to cold', shape: 'crop lost to cold', size: Math.round(w), cell: -1, who: [], text: `In year ${y + 1} the cold took ${Math.round(w)} of what stood in the fields, against ${Math.round(g)} brought in.` });
      const br = this.words.break[y] ?? 0, kp = this.words.keep[y] ?? 0;
      if (br >= 5 && br > kp) this.emit({ t0: t - 51, t1: t, name: 'year of broken promises', shape: 'year of broken promises', size: br, cell: -1, who: [], text: `Year ${y + 1} was a year of broken promises: ${br} debts broken and ${kp} kept.` });
    }
  }

  /** Close whatever is still open at the end of a run. */
  close(): void {
    for (const c of this.clusters.values()) this.closeCluster(c);
    for (const f of this.strife.values()) this.closeStrife(f);
    this.clusters.clear(); this.strife.clear();
    this.events.sort((a, b) => a.t0 - b.t0 || b.size - a.size);
  }

  /** The deepest fall in numbers: from which peak, to which trough, over how long. */
  crash(): { peak: number; trough: number; from: number; to: number; depth: number } {
    let peak = 0, peakAt = 0, best = { peak: 0, trough: 0, from: 0, to: 0, depth: 0 };
    this.pop.forEach((p, t) => {
      if (p > peak) { peak = p; peakAt = t; }
      const depth = peak > 0 ? 1 - p / peak : 0;
      if (depth > best.depth) best = { peak, trough: p, from: peakAt, to: t, depth };
    });
    return best;
  }
}

export { year, when };

/** The form of a bond, without its parties: what it is about, all the way down, and on what basis. */
export function form(s: State, id: number, depth = 0): string {
  const b = s.bonds.find(x => x.id === id);
  if (!b || depth > 20) return 'a bond that is gone';
  if (b.about === 'bond') return `${b.secures >= 0 ? 'a pledge of' : 'a lease of'} ${form(s, b.on, depth + 1)}`;
  if (b.about === 'land') return `a holding by ${b.basis}`;
  if (b.about === 'act') return `${b.labour ? 'work' : 'goods'} owed by ${b.basis}`;
  return `a tie of ${b.basis}`;
}
