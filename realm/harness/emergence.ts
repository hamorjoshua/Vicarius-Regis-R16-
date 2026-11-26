// Emergence checks: patterns read from the record of many simulated reigns.
// Each should happen sometimes, never always; a pattern that never appears points to a missing link.

import type { Event, State } from '../sim/types.ts';

export interface Check { name: string; chain: string; lo: number; hi: number; test: (ev: Event[], s: State) => boolean }

const has = (ev: Event[], f: (e: Event) => boolean): boolean => ev.some(f);
const reign = (ev: Event[]): Event[] => ev.filter(e => e.t >= 0);

export const CHECKS: Check[] = [
  { name: 'Bread riot', chain: 'a short harvest, a price spike, a riot in the Capital', lo: 10, hi: 25,
    test: ev => has(reign(ev), e => e.k === 'riot' && e.r === 0 && ['dear bread', 'hunger', 'rumour'].includes(String(e.d.why))) },
  { name: 'Blight year', chain: 'a warm wet summer, blight, a short harvest', lo: 15, hi: 30,
    test: ev => has(reign(ev), e => e.k === 'harvest' && (e.d.main === 'blight' || e.d.second === 'blight') && +e.d.pct! < 92) },
  { name: 'Levee breach', chain: 'a Highland storm, the river rising, a neglected levee failing', lo: 10, hi: 20,
    test: ev => has(reign(ev), e => e.k === 'flood') },
  { name: 'Winter cough', chain: 'a hungry or crowded Capital winter, an outbreak', lo: 20, hi: 40,
    test: ev => has(reign(ev), e => e.k === 'outbreak' && e.d.disease === 'cough') },
  { name: 'Summer fever', chain: 'fouled water or ruined conduits, an outbreak', lo: 15, hi: 40,
    test: ev => has(reign(ev), e => e.k === 'outbreak' && e.d.disease === 'fever') },
  { name: 'Famine migration', chain: 'hunger, people moving, a region swelling', lo: 10, hi: 20,
    test: ev => has(reign(ev), e => e.k === 'migration' && e.d.why === 'hunger') },
  { name: 'Hoarding', chain: 'rumour of shortage; reserves rise before prices do', lo: 30, hi: 80,
    test: ev => has(reign(ev), e => e.k === 'hoarding') },
  { name: 'Debt cascade', chain: 'defaults spreading from debtors to their creditors', lo: 5, hi: 15,
    test: ev => has(reign(ev), e => e.k === 'cascade') },
  { name: 'Bandits', chain: 'a famine or unpaid garrison, then men on the roads', lo: 10, hi: 25,
    test: ev => has(reign(ev), e => e.k === 'bandits') },
  { name: 'Scapegoating', chain: 'unexpected deaths, superstition, a grudge against a blamed estate', lo: 5, hi: 15,
    test: ev => has(reign(ev), e => e.k === 'scapegoat') },
  { name: 'Raid', chain: 'a poor wall or a hungry garrison, raiders crossing', lo: 10, hi: 35,
    test: ev => has(reign(ev), e => e.k === 'draw' && e.d.what === 'raid') },
  { name: 'Pestilence', chain: 'sickness abroad, ships in port, a carrier ashore', lo: 2, hi: 10,
    test: ev => has(reign(ev), e => e.k === 'draw' && e.d.what === 'pestilence') },
  { name: 'Seed corn eaten', chain: 'hunger before sowing, seed eaten, land left unsown', lo: 5, hi: 30,
    test: ev => has(reign(ev), e => e.k === 'seedcorn') },
];

/** Of the reigns that had a crisis, how many saw quiet return before the close? */
export function recovered(ev: Event[]): { crisis: boolean; recovered: boolean } {
  const bad = reign(ev).filter(e => ['famine', 'riot', 'revolt', 'flood'].includes(e.k) || (e.k === 'outbreak'));
  if (bad.length === 0) return { crisis: false, recovered: false };
  const last = Math.max(...bad.map(e => e.t)), end = Math.max(...ev.map(e => e.t));
  return { crisis: true, recovered: end - last >= 10 };
}

/** Learning: do petitions shift toward what the court grants? Share of asks whose payer is the court, early against late. */
export function learning(asks: { t: number; key: string }[]): { early: number; late: number } {
  const share = (xs: typeof asks): number => (xs.length ? xs.filter(a => a.key.endsWith('|court')).length / xs.length : 0);
  return { early: share(asks.filter(a => a.t < 14)), late: share(asks.filter(a => a.t >= 20)) };
}
