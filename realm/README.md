# The living realm

A first complete pass at [the living-realm design](../docs/living-realm-design.md): a material simulation beneath the court's docket. Weather, harvests, prices, sickness, unrest, belief and politics determine one another, and petitions are the realm speaking about what is happening to it. Nothing is authored.

The current game (`../index.html`) is untouched.

## Play it

Open `realm/index.html` in a browser. It is one static file and runs offline.

A reign is a seed plus the rulings you gave, so a save is tiny and a replay is exact.

## Run it

```
cd realm
npm install            # esbuild, preact, typescript: build tools only
npm test               # the invariants
npm run build          # rebuilds index.html
npm run check          # typecheck

node harness/run.ts courts [reigns] [seed]      # scripted courts
node harness/run.ts emergence [reigns] [seed]   # emergence checks
node harness/run.ts chronicle [years] [seed]    # what happened, in plain sentences
node harness/run.ts petitions [seed]            # a reign's petitions, composed
node harness/run.ts stable [years]              # years with no shocks
node harness/run.ts sweep [reigns] [all]        # each parameter 20% down and up
```

Node 22.18 or later runs the TypeScript directly; nothing is compiled for the harness.

## What is here

| Folder | Contents |
| --- | --- |
| `sim/` | The simulation: a pure `step(state, rulings)`, `petitions`, `forecast`, `explain` |
| `sim/systems/` | Sky, land, crops and herds, duties, markets, people, health, security, society, mind |
| `sim/court/` | Petitions from households' own choices; rulings as primitive effects; bindings |
| `sim/params.ts` | Every constant, with its unit and a note |
| `flavour/` | The composer: pleas, options and the record, built from causes |
| `harness/` | Scripted courts, emergence checks, chronicle, sweep |
| `test/` | Determinism, purity, exact replay, conservation, bounds, designated chance |
| `ui/` | The screen: audience, hearings with forecasts, almanac, markets, realm, record, ledger |

## How it follows the design

- **Everything is caused.** There is no event table. Floods come from Highland runoff against the levee's condition; fever from fouled water; bandits from the desperate and from deserters; riots from the ledger's blame.
- **Chance only at the boundary.** Six designated draws: the founding, weather, constitution, pestilence, raiders, prices abroad. A test fails if anything else draws, and another checks that the sky is identical whatever the court rules.
- **Pressure is read, never set.** It is weeks of cover: stocks, coin and expected income against food, dues and debts.
- **Petitions are choices.** Each strained holder weighs its own remedies (sell beasts, borrow, eat seed, kin, a patron) against what it has learned the court grants. Keepers speak for purposes in shortfall.
- **Every number answers why.** Touch a number on screen to see its largest causes.
- **Forecasts never show the drawn future.** They assume the season's expected weather and no boundary events.

## Where it stands against the design's tests

Scripted courts, 100 reigns each (20 for the two slow ones):

| Court | Reigns kept | Mean breaches |
| --- | --- | --- |
| Null | 40% | 2.7 |
| Random | 73% | 1.3 |
| Greedy | 70% | 1.0 |
| Careful | 75% | 0.9 |
| Naive | 82% | 0.7 |

Emergence over 200 null-court reigns:

| Pattern | Seen | Target |
| --- | --- | --- |
| Bread riot | 31% | 10–25% |
| Blight year | 11% | 15–30% |
| Levee breach | 8% | 10–20% |
| Winter cough | 4% | 20–40% |
| Summer fever | 0% | 15–40% |
| Famine migration | 9% | 10–20% |
| Hoarding | 55% | 30–80% |
| Debt cascade | 27% | 5–15% |
| Bandits | 11% | 10–25% |
| Scapegoating | 9% | 5–15% |
| Raid | 11% | 10–35% |
| Pestilence | 4% | 2–10% |

Also: fifty years with no shocks loses 3% of souls; petitions follow what the court grants (47% against 34% in the learning check); a week ticks in about 1.4 ms and a founding in about 36 ms.

## Known gaps

These are where the build falls short of the design. Each is a calibration or depth question, not a missing foundation.

1. **Granting everything is too safe.** The naive court keeps more reigns than the careful one. The cost of an empty purse and granary does not yet bite inside one year, so the design's central test (careful clearly best) is not met.
2. **Sickness is too tame.** Summer fever never breaks out on its own and winter cough rarely does. The spread rules are in place; their thresholds are too high.
3. **Too few petitions in a calm year.** Fewer than two a week arrive, against three hearings, so choosing whom to hear rarely hurts.
4. **Crises rarely recover within the reign.** Only about a third see ten quiet weeks before the close.
5. **Simplified against the design:** timber and cloth are not stocked goods (crafts are a flow of spending and wages); named households have a head and heirs but no other named members; previews use the expected forecast only (the ensemble exists in `forecast` but the screen does not call it); there is no map panel and no court's-view mode, only the steward's ledger.
6. **The sensitivity sweep exists but has not been run to completion**, so the most sensitive parameters are not yet known.

## Decisions taken

The design left these open. Each can be changed.

| Decision | Taken |
| --- | --- |
| Scale | About 14,000 souls |
| Purse and granary | Both adopted |
| Reign | 52 weeks; the simulation itself runs for any number of years |
| Map | Three regions |
| Catastrophe | Pestilence, rare and survivable |
| Named people | Heads and heirs, with deaths and inheritance |
| Language | TypeScript |
| Where | This folder |
| Tests and build | Node's own test runner and esbuild, rather than Vitest and Vite, to keep the tooling small |
| The start of a reign | Each realm lives one year of real weather before the reign begins, so the regent inherits a history |
