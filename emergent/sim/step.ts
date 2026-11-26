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
import type { State } from './types.ts';

export function step(prev: State): State {
  const { log: _log, ...rest } = prev;
  const s = structuredClone(rest) as State;
  s.log = [];
  sky(prev, s);     // the forcing
  grow(s);
  make(s);
  decay(s);
  move(prev, s);
  bind(s);
  choose(s);
  learn(s);         // beliefs are made, told and forgotten
  gather(prev, s);  // bodies form and dissolve
  s.t = prev.t + 1;
  return s;
}
