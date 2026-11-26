// The screen. It calls the same contract as the forecasts and the batch runs: found, petitions, step, forecast, explain.

import { render } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { found } from '../sim/found.ts';
import { advance } from '../sim/step.ts';
import { petitions } from '../sim/court/petitions.ts';
import { forecast, type Forecast } from '../sim/forecast.ts';
import { explain } from '../sim/ledger.ts';
import { P } from '../sim/params.ts';
import { CROPS, DISEASES, ESTATES, REGIONS, souls, weekOf, type Event, type Holder, type Option, type Petition, type Ruling, type State } from '../sim/types.ts';
import { need, quarterDays, QUARTER_NAMES, weeksToHarvest } from '../sim/util.ts';
import { STAGES } from '../sim/systems/society.ts';
import { growthIndex } from '../sim/systems/crops.ts';
import { causeLabel, coin, constituency, dutyName, effectLine, eventLine, eventWeight, grain, lawName, MAXIM, MAXIM_MEANING, nameOf, optionLabel, pathLabel, payerLabel, plea, price, seasonOf, title, workName } from '../flavour/compose.ts';

const SAVE = 'vr-realm-save-1';
interface Save { seed: number; weeks: Ruling[][] }

function load(): Save | null {
  try { const raw = localStorage.getItem(SAVE); return raw ? (JSON.parse(raw) as Save) : null; } catch { return null; }
}
function store(save: Save | null): void {
  try { if (save) localStorage.setItem(SAVE, JSON.stringify(save)); else localStorage.removeItem(SAVE); } catch { /* play on without a save */ }
}
/** A save is a seed and the rulings given: the same seed with the same rulings always gives the same realm. */
function replay(save: Save): State {
  let s = found(save.seed);
  for (const w of save.weeks) s = advance(s, w);
  return s;
}

const pct = (x: number): string => `${Math.round(x * 100)}%`;
const sgn = (x: number, d = 1): string => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`;
const QUESTION: Record<string, string> = { letter: 'bond', mercy: 'bond', crown: 'realm', hearth: 'realm', old: 'custom', fresh: 'custom', kin: 'kinship', oath: 'kinship' };
const MOTIVE: Record<string, string> = { relief: 'Relief', protection: 'Protection', redress: 'Redress', need: 'Need', ambition: 'Ambition', faith: 'Faith', sign: 'Sign' };

type Ask = (path: string) => void;

function Why({ path, ask, children }: { path: string; ask: Ask; children: preact.ComponentChildren }) {
  return <button class="why" onClick={e => { e.stopPropagation(); ask(path); }}>{children}</button>;
}

function Pips({ n, of = 8 }: { n: number; of?: number }) {
  return <span class="pips" aria-label={`pressure ${n.toFixed(1)} of ${of}`}>{Array.from({ length: of }, (_, i) => <i class={i < Math.round(n) ? (n >= 4 ? 'on hot' : 'on') : ''} />)}</span>;
}
function Bar({ v, warn = 0.6, low = 0.4 }: { v: number; warn?: number; low?: number }) {
  return <span class="bar"><i class={v < low ? 'low' : v < warn ? 'warn' : ''} style={{ width: `${Math.max(2, Math.min(100, v * 100))}%` }} /></span>;
}
function Tile({ kind, children }: { kind: string; children: preact.ComponentChildren }) {
  return <span class={`tile ${kind}`}>{children}</span>;
}

function fmtPath(path: string, v: number): string {
  if (path.startsWith('price')) return price(v);
  if (path === 'purse') return coin(v);
  if (path === 'granary') return grain(v);
  if (path.startsWith('works') || path.startsWith('readiness') || path.startsWith('duty') || path.startsWith('sick')) return pct(v);
  if (path.startsWith('hungry') || path.startsWith('bandits')) return String(Math.round(v));
  return v.toFixed(1);
}

function Explain({ s, path, close }: { s: State; path: string; close: () => void }) {
  const causes = explain(s, path);
  const max = Math.max(0.0001, ...causes.map(c => Math.abs(c.a)));
  const odds = path.startsWith('odds.');
  return (
    <div class="sheet-back" onClick={close}>
      <div class="sheet" onClick={e => e.stopPropagation()}>
        <h3>{pathLabel(s, path)}</h3>
        <p class="sub">{odds ? 'What shapes the odds this week' : 'Its largest causes of late'}</p>
        {causes.length === 0 && <p class="quiet">Nothing has moved it lately.</p>}
        {causes.map(c => (
          <div class="cause">
            <span class="cause-name">{causeLabel(c.k)}{c.x && c.x !== c.k && !/^w\d|^h\d|^c\d/.test(c.x) ? ` (${causeLabel(c.x)})` : ''}</span>
            {odds ? <span class="cause-amt">{c.k === 'odds' ? `1 in ${Math.round(1 / Math.max(1e-6, c.a))}` : `×${c.a.toFixed(2)}`}</span>
              : <span class={`cause-bar ${c.a < 0 ? 'neg' : 'pos'}`}><i style={{ width: `${(Math.abs(c.a) / max) * 100}%` }} /></span>}
          </div>
        ))}
        <button class="btn ghost" onClick={close}>Close</button>
      </div>
    </div>
  );
}

function OptionCard({ s, p, o, i, chosen, choose, canRule }: { s: State; p: Petition; o: Option; i: number; chosen: boolean; choose: () => void; canRule: boolean }) {
  const [fc, setFc] = useState<Forecast | null>(null);
  const rule = o.holds ? s.rules[QUESTION[o.holds]!] : undefined;
  const reverses = !!(o.holds && rule && rule.side !== o.holds && rule.count >= 2);
  const follows = !!(o.holds && rule && rule.side === o.holds);
  return (
    <div class={`option ${o.deny ? 'deny' : ''} ${chosen ? 'chosen' : ''}`}>
      <div class="option-head">
        <span class="option-tag">{o.deny ? 'Deny' : i === 0 ? 'Grant' : 'Alternative'}</span>
        <strong>{optionLabel(s, p, o)}</strong>
      </div>
      <p class="payer">{payerLabel(s, o)}</p>
      {o.effects.length > 0 && <ul class="effects">{o.effects.map(e => <li>{effectLine(s, e)}</li>)}</ul>}
      {o.holds && (
        <div class={`plate ${reverses ? 'reverses' : ''}`} title={MAXIM_MEANING[o.holds]}>
          <span class="plate-text">“{MAXIM[o.holds]}”</span>
          <span class="plate-note">{reverses ? 'Reverses what the court has held' : follows ? 'As the court has held' : 'Sets what the court holds'}</span>
        </div>
      )}
      {fc && (
        <div class="forecast">
          <p class="sub">Over four weeks of expected weather, against leaving it unheard</p>
          {fc.lines.length === 0 && <p class="quiet">No great difference.</p>}
          {fc.lines.map(l => <div class="fline"><span>{pathLabel(s, l.path)}</span><b class={l.delta > 0 ? 'up' : 'down'}>{fmtPath(l.path, l.from)} → {fmtPath(l.path, l.to)}</b></div>)}
        </div>
      )}
      <div class="option-foot">
        {!fc && <button class="btn ghost" onClick={() => setFc(forecast(s, { petition: p.id, option: i }, 4))}>Forecast</button>}
        <button class="btn" disabled={!canRule && !chosen} onClick={choose}>{chosen ? 'Withdraw' : 'Rule so'}</button>
      </div>
    </div>
  );
}

function Hearing({ s, p, ruling, setRuling, close, ask, canRule }: { s: State; p: Petition; ruling: number | undefined; setRuling: (i: number | undefined) => void; close: () => void; ask: Ask; canRule: boolean }) {
  const f = s.holders.find(h => h.id === p.for);
  return (
    <div class="hearing">
      <button class="back" onClick={close}>‹ The audience</button>
      <h2>{title(s, p)}</h2>
      <div class="tiles">
        <Tile kind="region">{REGIONS[p.region]}</Tile><Tile kind="estate">{ESTATES[p.estate]}</Tile><Tile kind="motive">{MOTIVE[p.motive]}</Tile>
        {p.collective && <Tile kind="souls">{Math.round(p.souls).toLocaleString()} souls</Tile>}
        {p.word && <Tile kind="word">Holds the court’s word</Tile>}
      </div>
      {!p.keeper && f && <p class="pressure-line">Pressure <Why path={`pressure.${f.id}`} ask={ask}><Pips n={p.pressure} /></Why> <span class="quiet">{f.cover.toFixed(0)} weeks of cover{p.waited ? ` · waited ${p.waited} week${p.waited > 1 ? 's' : ''}` : ''}</span></p>}
      <blockquote>{plea(s, p)}</blockquote>
      {p.options.map((o, i) => <OptionCard key={p.id + i} s={s} p={p} o={o} i={i} chosen={ruling === i} canRule={canRule} choose={() => { setRuling(ruling === i ? undefined : i); if (ruling !== i) close(); }} />)}
    </div>
  );
}

function PetitionCard({ s, p, ruling, open }: { s: State; p: Petition; ruling: number | undefined; open: () => void }) {
  return (
    <button class={`pcard ${ruling !== undefined ? 'ruled' : ''}`} onClick={open}>
      <div class="pcard-top"><Tile kind="region">{REGIONS[p.region]}</Tile><Tile kind="estate">{ESTATES[p.estate]}</Tile><Tile kind="motive">{MOTIVE[p.motive]}</Tile>{p.word && <Tile kind="word">Word</Tile>}</div>
      <strong>{title(s, p)}</strong>
      <span class="pcard-ask">{optionLabel(s, p, p.options[0]!)}</span>
      <span class="pcard-foot"><Pips n={p.pressure} />{p.waited > 0 && <em>waited {p.waited}</em>}{ruling !== undefined && <b>{p.options[ruling]!.deny ? 'Denied' : ruling === 0 ? 'Granted' : 'Eased'}</b>}</span>
    </button>
  );
}

function Court({ s, rulings, setRulings, ask }: { s: State; rulings: Ruling[]; setRulings: (r: Ruling[]) => void; ask: Ask }) {
  const [open, setOpen] = useState<string | null>(null);
  const audience = useMemo(() => petitions(s), [s]);
  const p = audience.find(x => x.id === open);
  const of = (id: string): number | undefined => rulings.find(r => r.petition === id)?.option;
  const canRule = rulings.length < P.hearings + 1;
  if (p) return <Hearing s={s} p={p} ruling={of(p.id)} canRule={canRule} ask={ask} close={() => setOpen(null)} setRuling={i => setRulings(i === undefined ? rulings.filter(r => r.petition !== p.id) : [...rulings.filter(r => r.petition !== p.id), { petition: p.id, option: i }])} />;
  const open2 = s.bindings.filter(b => b.state === 'open');
  return (
    <div>
      <h2>The audience</h2>
      <p class="sub">{audience.length === 0 ? 'No one waits on the court this week.' : `${audience.length} wait${audience.length === 1 ? 's' : ''} to be heard${s.docket.length > audience.length ? `, and ${s.docket.length - audience.length} more outside` : ''}. You may hear three; a fourth costs two seals.`}</p>
      <div class="hearings">{[0, 1, 2, 3].map(i => <i class={i < rulings.length ? (i === 3 ? 'used extra' : 'used') : i === 3 ? 'extra' : ''} />)}<span>{rulings.length} of 3 hearings{rulings.length > 3 ? ' and a fourth' : ''}</span></div>
      {audience.map(x => <PetitionCard s={s} p={x} ruling={of(x.id)} open={() => setOpen(x.id)} />)}
      {Object.keys(s.rules).length > 0 && <h3>What the court holds</h3>}
      {Object.entries(s.rules).map(([q, r]) => <div class="plate" title={MAXIM_MEANING[r.side]}><span class="plate-text">“{MAXIM[r.side]}”</span><span class="plate-note">On the {q}: held {r.count} time{r.count > 1 ? 's' : ''}{r.count >= 2 ? ', and relied upon' : ''}</span></div>)}
      {s.laws.length > 0 && <h3>Laws in force</h3>}
      {s.laws.map(l => <div class="law"><b>{lawName(l.kind)}</b> in the {l.region < 0 ? 'realm' : REGIONS[l.region]}{l.kind === 'assize' ? ` at ${price(l.value)}` : l.kind === 'wageCap' ? ` at ${l.value.toFixed(1)}d` : ''} · {l.until - s.t} weeks left</div>)}
      {open2.length > 0 && <h3>Bindings</h3>}
      {open2.map(b => <div class={`binding ${b.kind}`}><b>{b.kind === 'word' ? 'The court’s word' : b.kind}</b> to {nameOf(s, b.by === 'court' ? b.to : b.by, true)}: {b.label} <span class="hourglass">⧗ {Math.max(0, b.end - s.t)} week{b.end - s.t === 1 ? '' : 's'}</span></div>)}
    </div>
  );
}

function skyWords(dev: number, a: string, b: string): string { return dev > 0.8 ? `much ${a}` : dev > 0.3 ? a : dev < -0.8 ? `much ${b}` : dev < -0.3 ? b : 'as usual'; }

function Almanac({ s, ask }: { s: State; ask: Ask }) {
  const w = weekOf(s.t), levee = s.works.find(x => x.id === 'levee')!;
  const holds = P.leveeCap * (P.leveeBanks + (1 - P.leveeBanks) * levee.cond);
  return (
    <div>
      <h2>The almanac</h2>
      <p class="sub">Week {w}: {seasonOf(w)}. {weeksToHarvest(w) === 0 ? 'The harvest is coming in.' : `${weeksToHarvest(w)} weeks to the harvest.`}</p>
      {s.regions.map((R, r) => (
        <section class="panel">
          <h3>{REGIONS[r]}</h3>
          <p>{R.sky.temp.toFixed(0)}° this week, {skyWords((R.sky.temp - R.sky.tBar) / 3, 'warmer', 'colder')} for the season; rain {skyWords(Math.log(R.sky.rain / R.sky.rBar), 'heavier', 'lighter')}. The run of the weather: {skyWords(R.sky.aR / 1.2, 'wet', 'dry')} and {skyWords(R.sky.aT / 1.2, 'warm', 'cold')}.{R.sky.snow > 5 ? ` Snow lies ${R.sky.snow > P.snowBlock ? 'deep; the upland roads are closed' : 'on the hills'}.` : ''}</p>
          <div class="row"><span>Soil</span><span>{R.sky.moist < 0.6 ? 'parched' : R.sky.moist < 0.85 ? 'dry' : R.sky.moist > 1.5 ? 'waterlogged' : R.sky.moist > 1.2 ? 'wet' : 'in good heart'}</span></div>
          {R.crops.map((c, i) => {
            const acres = s.holders.reduce((a, h) => a + (h.region === r ? h.acres[i]! : 0), 0);
            if (acres < 1) return null;
            return (
              <div class="row">
                <span>{CROPS[i]![0]!.toUpperCase() + CROPS[i]!.slice(1)}</span>
                <Why path={`crop.${r}.${i}`} ask={ask}>{c.sown < 1 ? `not yet sown · last year ${pct(c.last)}` : `${pct(c.sown / acres)} sown · stands at ${pct(growthIndex(c) * (1 - c.frost) * (1 - c.blight) * (1 - c.flood))}${c.frost > 0.02 ? ' · frosted' : ''}${c.blight > 0.05 ? ' · blighted' : ''}${c.flood > 0.02 ? ' · flooded' : ''}`}</Why>
              </div>
            );
          })}
          {r === 2 && <div class="row"><span>The river</span><span>{pct(s.river.level / holds)} of what the levee holds{s.river.flood > 0 ? ' · IN FLOOD' : ''}</span></div>}
        </section>
      ))}
      <section class="panel"><h3>The year</h3>{quarterDays().map((q, i) => <div class="row"><span>{QUARTER_NAMES[i]}</span><span>{q > w ? `in ${q - w} weeks` : q === w ? 'this week' : 'past'}</span></div>)}<p class="quiet">Rents, dues and debts fall due on quarter days.</p></section>
    </div>
  );
}

function Markets({ s, ask }: { s: State; ask: Ask }) {
  const names: Record<string, string> = { cr: 'River road: Riverlands → Capital', ch: 'North road: Highlands → Capital', hr: 'Drove road: Riverlands → Highlands', sea: 'The sea: Capital → abroad' };
  return (
    <div>
      <h2>The markets</h2>
      {s.regions.map((R, r) => (
        <section class="panel">
          <h3>{REGIONS[r]}</h3>
          <div class="big"><Why path={`price.${r}`} ask={ask}>{price(R.price)}</Why><span class={R.trend > 0.01 ? 'up' : R.trend < -0.01 ? 'down' : ''}>{R.trend > 0.01 ? '▲ rising' : R.trend < -0.01 ? '▼ falling' : 'steady'}</span></div>
          <div class="row"><span>Usual</span><span>{price(R.priceRef)}</span></div>
          <div class="row"><span>Barns against custom</span><span><Bar v={R.stock / Math.max(1, R.custom) / 1.5} warn={0.55} low={0.4} /> {pct(R.stock / Math.max(1, R.custom))}</span></div>
          <div class="row"><span>Wages</span><Why path={`wage.${r}`} ask={ask}>{R.wage.toFixed(1)}d a week (usual {R.wageRef.toFixed(1)}d)</Why></div>
          {R.hoard > 0.2 && <p class="warn">Holders are keeping corn back.</p>}
        </section>
      ))}
      <section class="panel">
        <h3>The roads</h3>
        {s.routes.map(x => { const road = s.works.find(k => k.id === x.work)!; return <div class="row"><span>{names[x.id]}</span><span>{Math.abs(x.flow) < 1 ? 'no carts' : `${grain(Math.abs(x.flow))}${x.flow < 0 ? ' the other way' : ''}`} · <Why path={`works.${road.id}`} ask={ask}>{pct(road.cond)} sound</Why></span></div>; })}
        <div class="row"><span>Corn abroad</span><span>{price(P.grainPrice * s.abroad.grain)}</span></div>
      </section>
      <section class="panel">
        <h3>The Crown</h3>
        <div class="row"><span>Purse</span><Why path="purse" ask={ask}>{coin(s.purse)}</Why></div>
        <div class="row"><span>Granary</span><Why path="granary" ask={ask}>{grain(s.granary)}</Why></div>
      </section>
    </div>
  );
}

function Realm({ s, ask }: { s: State; ask: Ask }) {
  return (
    <div>
      <h2>The realm</h2>
      {s.regions.map((R, r) => {
        const hs = s.holders.filter(h => h.region === r), N = hs.reduce((a, h) => a + souls(h), 0);
        return (
          <section class="panel">
            <h3>{REGIONS[r]} <span class="quiet">{Math.round(N).toLocaleString()} souls</span></h3>
            <div class="row"><span>The streets</span><Why path={`unrest.${r}`} ask={ask}><span class={`stage s${R.stage}`}>{STAGES[R.stage]}</span></Why></div>
            <div class="row"><span>Going hungry</span><span>{R.hungry < 5 ? 'none' : Math.round(R.hungry).toLocaleString()}</span></div>
            <div class="row"><span>Sick</span><Why path={`sick.${r}`} ask={ask}>{R.sick < 0.004 ? 'few' : pct(R.sick)}{R.disease.map((d, i) => (d.out ? ` · ${DISEASES[i]}` : '')).join('')}</Why></div>
            <div class="row"><span>Deaths this week</span><Why path={`deaths.${r}`} ask={ask}>{Math.round(R.deaths)} (usual {Math.round(R.deathsExp)})</Why></div>
            <div class="row"><span>Garrison</span><Why path={`readiness.${r}`} ask={ask}><Bar v={R.readiness} /> {pct(R.readiness)} ready</Why></div>
            <div class="row"><span>On the roads</span><Why path={`bandits.${r}`} ask={ask}>{R.bandits < 5 ? 'quiet' : `${Math.round(R.bandits)} bandits`}</Why></div>
            <div class="row"><span>Devotion</span><Why path={`devotion.${r}`} ask={ask}><Bar v={R.devotion} low={0.25} warn={0.4} /></Why></div>
            <div class="row"><span>Superstition</span><Why path={`superstition.${r}`} ask={ask}><Bar v={1 - R.superstition} low={0.45} warn={0.65} /> {R.superstition > 0.55 ? 'high' : R.superstition > 0.35 ? 'stirring' : 'low'}</Why></div>
            {R.blame >= 0 && <p class="warn">The {ESTATES[R.blame]!.toLowerCase()}s are being blamed.</p>}
            <h4>Works</h4>
            {s.works.filter(x => x.region === r).map(x => <div class="row"><span>{workName(x.id)}</span><Why path={`works.${x.id}`} ask={ask}><Bar v={x.cond} /> {pct(x.cond)}{x.levy > s.t ? ' · levy' : x.funded > 0.005 ? ' · mending' : ''}</Why></div>)}
            <h4>Duties</h4>
            {s.duties.filter(d => d.region === r && d.kind !== 'tithe' && d.kind !== 'dues').map(d => <div class="row"><span>{dutyName(d.kind)}</span><span><Bar v={d.provision} /> {pct(d.provision)}</span></div>)}
          </section>
        );
      })}
      <section class="panel"><h3>At the border</h3><div class="row"><span>Odds of a raid this week</span><Why path="odds.raid" ask={ask}>see what shapes them</Why></div><div class="row"><span>Odds of pestilence</span><Why path="odds.pestilence" ask={ask}>see what shapes them</Why></div></section>
    </div>
  );
}

function Record({ s }: { s: State }) {
  const weeks: { t: number; ev: Event[] }[] = [];
  for (const e of s.record) {
    if (e.t < 0 || eventWeight(e) < 2) continue;
    let w = weeks[weeks.length - 1];
    if (!w || w.t !== e.t) { w = { t: e.t, ev: [] }; weeks.push(w); }
    w.ev.push(e);
  }
  const before = s.record.filter(e => e.t < 0 && eventWeight(e) >= 6);
  return (
    <div>
      <h2>The record</h2>
      {weeks.length === 0 && <p class="quiet">Nothing is yet recorded of this reign.</p>}
      {weeks.slice().reverse().map(w => <section class="panel"><h3>Week {weekOf(w.t)}</h3>{w.ev.sort((a, b) => eventWeight(b) - eventWeight(a)).map(e => <p class={`ev w${Math.min(9, eventWeight(e))}`}>{eventLine(s, e)}</p>)}</section>)}
      {before.length > 0 && <section class="panel"><h3>The year before your regency</h3>{before.map(e => <p class="ev">{eventLine(s, e)}</p>)}</section>}
    </div>
  );
}

function Ledger({ s, ask }: { s: State; ask: Ask }) {
  const row = (h: Holder) => (
    <tr>
      <td>{h.hs ? nameOf(s, h.id, true) : ESTATES[h.estate]}{h.hs && <small> {h.hs.role}{h.hs.sick ? ' · sick' : ''}{h.hs.charge ? ' · charged' : ''}</small>}</td>
      <td>{Math.round(souls(h)).toLocaleString()}</td>
      <td><Why path={`pressure.${h.id}`} ask={ask}><Pips n={h.pressure} /></Why></td>
      <td>{pct(h.n)}</td>
      <td>{(h.grain / Math.max(0.01, need(h))).toFixed(0)}w</td>
      <td>{coin(Math.max(0, h.coin))}</td>
    </tr>
  );
  return (
    <div>
      <h2>The steward’s ledger</h2>
      <p class="sub">The full state of the realm. Touch any number to see its causes.</p>
      <section class="panel">
        <h3>Confidence</h3>
        {[0, 1, 2].map(r => <div><h4>{REGIONS[r]}</h4>{ESTATES.map((e, i) => { const g = s.grievance[r * 6 + i]!; return <div class="row"><span>{e}s</span><Why path={`grievance.${r * 6 + i}`} ask={ask}><span class="bar griev"><i class={g >= 2 ? 'low' : g >= 1 ? 'warn' : ''} style={{ width: `${Math.min(100, (g / P.breachLine) * 100)}%` }} /></span> {g.toFixed(1)} of {P.breachLine}</Why></div>; })}</div>)}
        <p class="quiet">A constituency breaches confidence when its grievance reaches {P.breachLine}; a breach costs {P.breachCost} seals.</p>
      </section>
      {[0, 1, 2].map(r => (
        <section class="panel">
          <h3>{REGIONS[r]}</h3>
          <table><thead><tr><th>Estate</th><th>Souls</th><th>Pressure</th><th>Fed</th><th>Corn</th><th>Coin</th></tr></thead><tbody>{s.holders.filter(h => h.region === r && !h.hs).map(row)}</tbody></table>
          <table><thead><tr><th>House</th><th>Souls</th><th>Pressure</th><th>Fed</th><th>Corn</th><th>Coin</th></tr></thead><tbody>{s.holders.filter(h => h.region === r && h.hs).map(row)}</tbody></table>
        </section>
      ))}
      <section class="panel">
        <h3>Debts</h3>
        {s.debts.length === 0 && <p class="quiet">None on the rolls.</p>}
        {s.debts.map(d => <div class="row"><span>{nameOf(s, d.debtor, true)} owes {nameOf(s, d.creditor, true)}</span><span>{coin(d.principal * (1 + d.rate))} · due week {weekOf(d.due)}{d.security !== 'none' ? ` · on ${d.security}` : ''}</span></div>)}
      </section>
      <section class="panel">
        <h3>What the estates expect of the court</h3>
        {s.expect.map((e, i) => Object.keys(e).length === 0 ? null : <div class="row"><span>{ESTATES[i]}s</span><span>{Object.entries(e).filter(([, v]) => v.asked > 0.3).map(([k, v]) => `${k.replace('|', ' by ')}: ${pct((v.granted + P.expectA) / (v.asked + P.expectA + P.expectB))}`).join(' · ')}</span></div>)}
        <p class="quiet">Estates learn what the court grants, by means and by who pays, and change what they ask for.</p>
      </section>
    </div>
  );
}

function Week({ s, since, close }: { s: State; since: number; close: () => void }) {
  const ev = s.record.filter(e => e.t === since && eventWeight(e) >= 2).sort((a, b) => eventWeight(b) - eventWeight(a));
  return (
    <div class="sheet-back">
      <div class="sheet week">
        <h3>Week {weekOf(since)} has passed</h3>
        {ev.length === 0 && <p class="quiet">A quiet week. Nothing came to the court’s notice.</p>}
        {ev.map(e => <p class={`ev w${Math.min(9, eventWeight(e))}`}>{eventLine(s, e)}</p>)}
        <button class="btn" onClick={close}>{s.over ? 'The reign is over' : 'To the audience'}</button>
      </div>
    </div>
  );
}

function Over({ s, again }: { s: State; again: () => void }) {
  const notable = s.record.filter(e => e.t >= 0 && eventWeight(e) >= 7).slice(-14);
  return (
    <div class="title over">
      <h1>{s.over === 'kept' ? 'The king returns' : 'The reign has fallen'}</h1>
      <p class="tag">{s.over === 'kept' ? `You kept the realm for fifty-two weeks, with ${s.standing} seals of standing.` : `The court’s standing was spent in week ${weekOf(s.t - 1)}.`}</p>
      <p class="sub">{s.breaches} breach{s.breaches === 1 ? '' : 'es'} of confidence · {Math.round(s.holders.reduce((a, h) => a + souls(h), 0)).toLocaleString()} souls in the realm</p>
      <div class="chron">{notable.map(e => <p><b>Week {weekOf(e.t)}.</b> {eventLine(s, e)}</p>)}</div>
      <button class="btn big-btn" onClick={again}>A new reign</button>
    </div>
  );
}

const TABS = ['Court', 'Almanac', 'Markets', 'Realm', 'Record', 'Ledger'] as const;

function App() {
  const [save, setSave] = useState<Save | null>(null);
  const [s, setS] = useState<State | null>(null);
  const [rulings, setRulings] = useState<Ruling[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Court');
  const [path, setPath] = useState<string | null>(null);
  const [passed, setPassed] = useState<number | null>(null);
  const [seedText, setSeedText] = useState(String(1 + Math.floor((Date.now() / 1000) % 9000)));
  const saved = useMemo(load, []);

  const begin = (sv: Save): void => { setSave(sv); setS(replay(sv)); setRulings([]); setTab('Court'); store(sv); };
  if (!s || !save) {
    return (
      <div class="title">
        <div class="seal" aria-hidden="true">⚜</div>
        <h1>Vicarius Regis</h1>
        <p class="tag">THE LIVING REALM</p>
        <p class="sub">The king is away for a year. You hear three petitions a week, and rule. Beneath the docket the realm lives on its own: weather, harvest, price, sickness, belief. Nothing happens because it was scheduled; everything happens because something else did.</p>
        <label class="seed">Seed of the realm <input value={seedText} inputMode="numeric" onInput={e => setSeedText((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 9))} /></label>
        <button class="btn big-btn" onClick={() => begin({ seed: +seedText || 1, weeks: [] })}>Begin the reign</button>
        {saved && saved.weeks.length > 0 && <button class="btn ghost" onClick={() => begin(saved)}>Continue: seed {saved.seed}, week {saved.weeks.length + 1}</button>}
      </div>
    );
  }
  if (s.over && passed === null) return <Over s={s} again={() => { store(null); setS(null); setSave(null); }} />;

  const w = weekOf(s.t);
  const closeWeek = (): void => {
    const sv = { seed: save.seed, weeks: [...save.weeks, rulings] };
    setS(advance(s, rulings)); setSave(sv); store(sv); setRulings([]); setPassed(s.t); setTab('Court');
  };
  return (
    <div class="app">
      <header>
        <div class="when"><b>Week {w}</b> of 52 · {seasonOf(w)}</div>
        <Why path="standing" ask={setPath}><span class="seals" aria-label={`${s.standing} seals of standing`}>{Array.from({ length: P.standingMax }, (_, i) => <i class={i < s.standing - (rulings.length > 3 ? P.extraHearingCost : 0) ? 'on' : i < s.standing ? 'spent' : ''} />)}</span></Why>
        <div class="crown"><Why path="purse" ask={setPath}>{coin(s.purse)}</Why><Why path="granary" ask={setPath}>{grain(s.granary)}</Why></div>
      </header>
      <nav>{TABS.map(t => <button class={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>
      <main>
        {tab === 'Court' && <Court s={s} rulings={rulings} setRulings={setRulings} ask={setPath} />}
        {tab === 'Almanac' && <Almanac s={s} ask={setPath} />}
        {tab === 'Markets' && <Markets s={s} ask={setPath} />}
        {tab === 'Realm' && <Realm s={s} ask={setPath} />}
        {tab === 'Record' && <Record s={s} />}
        {tab === 'Ledger' && <Ledger s={s} ask={setPath} />}
      </main>
      <footer><button class="btn big-btn" onClick={closeWeek}>{rulings.length === 0 ? 'Hear no one, and close the week' : `Close the week with ${rulings.length} ruling${rulings.length > 1 ? 's' : ''}`}</button></footer>
      {path && <Explain s={s} path={path} close={() => setPath(null)} />}
      {passed !== null && <Week s={s} since={passed} close={() => setPassed(null)} />}
    </div>
  );
}

render(<App />, document.getElementById('app')!);
