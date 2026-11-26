// Names for places. A reader's work: nothing in the rules knows a place has a name.
// A name is a first part drawn from the seed and an ending that says what the ground is like,
// the way English villages were named: a ford, a hill, a clearing in a wood, a homestead on good soil.

import { STOCKS } from '../sim/tables.ts';
import type { State } from '../sim/types.ts';

const FIRST = ['Ash', 'Oak', 'Stan', 'Brad', 'Lang', 'Wul', 'Ed', 'Nor', 'Sut', 'West', 'Hart', 'Hazel', 'Elm', 'Thorn', 'Marsh', 'Swin', 'Ox', 'Shep', 'Wether', 'Gos', 'Crow', 'Raven', 'Fox', 'Bar', 'Whit', 'Black', 'Red', 'Green', 'Cold', 'Mer', 'Hol', 'Kirk', 'Bishop', 'King', 'Abbot', 'Mil', 'Salt', 'Iron', 'Alder', 'Birch', 'Bramble', 'Heath', 'Even', 'Winter', 'Summer', 'Dun', 'Wig', 'Offa', 'Cuth', 'Leof'];
const WATER = ['ford', 'mere', 'bourne', 'wick', 'bridge', 'well'];
const HIGH = ['don', 'hill', 'cliffe', 'ridge', 'low'];
const WOOD = ['ley', 'hurst', 'holt', 'wood', 'shaw'];
const GOOD = ['ham', 'ton', 'worth', 'bury', 'stoke'];
const PLAIN = ['field', 'stead', 'thorpe', 'by', 'combe', 'den'];

const cache = new Map<string, string[]>();

/** Every cell's name, worked out once for a realm. No two cells share one. */
function all(s: State): string[] {
  const key = `${s.seed}:${s.side}`;
  let names = cache.get(key);
  if (names) return names;
  names = [];
  const used = new Set<string>(), wood = STOCKS.findIndex(k => k.id === 'grove');
  const mix = (a: number, b: number): number => { let h = Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 7, 0x85ebca6b); h ^= h >>> 15; h = Math.imul(h, 0xc2b2ae35); return (h ^ (h >>> 13)) >>> 0; };
  for (let i = 0; i < s.cells.length; i++) {
    const c = s.cells[i]!;
    const ends = c.water > 0 ? WATER : c.high > 0.72 ? HIGH : (c.pot[wood] ?? 0) > 0.6 ? WOOD : c.soil0 > 0.8 ? GOOD : PLAIN;
    let name = '';
    for (let tries = 0; tries < 400; tries++) {
      const first = FIRST[mix(s.seed, i * 31 + tries) % FIRST.length]!, end = ends[(mix(i * 2654435761 + tries, s.seed) >>> 7) % ends.length]!;
      name = first.endsWith(end[0]!) ? first + end.slice(1) : first + end;
      if (!used.has(name)) break;
      name = '';
    }
    if (!name) name = `${FIRST[i % FIRST.length]}${PLAIN[i % PLAIN.length]} ${i}`;
    used.add(name);
    names.push(name);
  }
  cache.set(key, names);
  return names;
}

/** The name of a cell. */
export const placeName = (s: State, cell: number): string => all(s)[cell] ?? 'nowhere';
