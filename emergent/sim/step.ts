// The week. The same processes in the same order, every week. The step is a pure function:
// the state it is given is never touched, and the same seed always gives the same realm.

import { sky } from './processes/sky.ts';
import { grow } from './processes/grow.ts';
import { make } from './processes/make.ts';
import { decay } from './processes/decay.ts';
import { move } from './processes/move.ts';
import { bind } from './processes/bind.ts';
import { choose } from './processes/choose.ts';
import { gather } from './processes/gather.ts';
import { learn } from './processes/learn.ts';
import { attend, settle } from './processes/mind.ts';
import { kinOf } from './util.ts';
import type { State } from './types.ts';

/** One week, lived in place. The state given is changed and returned. */
export function advance(s: State, keepLog = false): State {
  const kinBefore = kinOf(s);
  // With a court, the week's record already holds the hearings.
  if (!keepLog) s.log = [];
  sky(s, s);        // the forcing
  grow(s);
  make(s);
  decay(s);
  move(s, s);
  bind(s);
  attend(s);        // each hearth takes up the mind of the one who speaks for it
  choose(s);
  learn(s);         // beliefs are made, told and forgotten
  settle(s);        // what was learned is kept by people
  gather(kinBefore, s);  // bodies form and dissolve
  s.t++;
  return s;
}

/** One week as a pure function: the state it is given is never touched. */
export function step(prev: State): State {
  const { log: _log, ...rest } = prev;
  const s = structuredClone(rest) as State;
  return advance(s);
}
