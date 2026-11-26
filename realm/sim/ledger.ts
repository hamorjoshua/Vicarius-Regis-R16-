// The causal ledger. Every derived number keeps its largest causes of change; `explain` reads them back.

import type { Cause, Event, Holder, State } from './types.ts';

const KEEP = 5;

/** Record that `amount` of change at `path` came from `kind`. Like causes merge; small old ones fold away. */
export function cause(s: State, path: string, kind: string, amount: number, note = ''): void {
  if (!(amount > 1e-9 || amount < -1e-9)) return;
  let list = s.ledger[path];
  if (!list) list = s.ledger[path] = [];
  for (const c of list) {
    if (c.k === kind) { c.a += amount; c.t = s.t; if (note) c.x = note; return; }
  }
  list.push({ k: kind, a: amount, t: s.t, x: note });
  if (list.length > KEEP + 3) {
    list.sort((p, q) => Math.abs(q.a) - Math.abs(p.a));
    list.length = KEEP;
  }
}

/** Causes fade, so the ledger speaks of what is moving a number now. */
export function fadeLedger(s: State, keep: number): void {
  for (const path in s.ledger) {
    const list = s.ledger[path]!;
    let n = 0;
    for (const c of list) {
      c.a *= keep;
      if (Math.abs(c.a) > 0.004 || s.t - c.t < 3) list[n++] = c;
    }
    list.length = n;
    if (n === 0) delete s.ledger[path];
  }
}

/** The ledger behind any number: its causes, largest first. */
export function explain(s: State, path: string): Cause[] {
  const list = s.ledger[path];
  if (!list) return [];
  return list.slice().sort((p, q) => Math.abs(q.a) - Math.abs(p.a)).slice(0, KEEP);
}

/** The largest cause at a path, as a short label for another cause's note. */
export function topCause(s: State, path: string): Cause | null {
  const list = s.ledger[path];
  if (!list || list.length === 0) return null;
  let best = list[0]!;
  for (const c of list) if (Math.abs(c.a) > Math.abs(best.a)) best = c;
  return best;
}

export function event(s: State, k: string, r: number, d: Record<string, string | number> = {}): void {
  const e: Event = { t: s.t, k, r, d };
  s.record.push(e);
}

/** Something hurt this holder: remember what, how much (in rations' worth) and when. */
export function woe(s: State, h: Holder, kind: string, amt: number, note = ''): void {
  if (!(amt > 0)) return;
  const w = h.woes[kind];
  if (w) { w.amt += amt; w.t = s.t; if (note) w.note = note; }
  else h.woes[kind] = { amt, t: s.t, note };
}

export function fadeWoes(h: Holder, keep: number): void {
  for (const k in h.woes) {
    const w = h.woes[k]!;
    w.amt *= keep;
    if (w.amt < 0.02 * (h.workers + h.deps)) delete h.woes[k];
  }
}

/** The holder's worst woes, largest first. */
export function worst(h: Holder, n = 2): { kind: string; amt: number; t: number; note: string }[] {
  const out = Object.keys(h.woes).map(kind => ({ kind, ...h.woes[kind]! }));
  out.sort((a, b) => b.amt - a.amt || (a.kind < b.kind ? -1 : 1));
  return out.slice(0, n);
}
