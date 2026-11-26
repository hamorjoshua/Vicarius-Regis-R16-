# The emergent realm

The build of [The Emergent Realm](../docs/living-realm-design.md), stage by stage. The current game (`../index.html`) and the first build (`../realm/`) are untouched; `realm/` stays as a reference until stage 2 replaces its harness.

**Stage 1 of 9 is here: a toy.** Land of 100 cells, about 200 people, twelve kinds of matter, simple bonds, and no court. Stages 2 to 9 are not started.

## Run it

```
cd emergent
npm install                          # typescript only, for the typecheck
npm test                             # the invariants
npm run check                        # typecheck
node harness/run.ts years 30 1       # thirty years of seed 1, a summary of each year
```

Node 22.18 or later runs the TypeScript directly. Thirty years takes about 20 seconds.

## What is here

| Path | Contents |
| --- | --- |
| `sim/tables.ts` | Everything that exists, as data: needs, kinds of matter, what lives on the land, ways of making, constants. The only file that names a row |
| `sim/types.ts` | The state: flat tables of cells, people, bodies, bonds and regard |
| `sim/found.ts` | The founding: land, people and stores drawn once |
| `sim/step.ts` | The week: a pure function from one state to the next |
| `sim/processes/` | `sky` (the forcing), `grow`, `make`, `decay`, `move`, `bind`, `choose`, `gather` |
| `sim/value.ts` | Cover of each need in weeks, and what more of anything is worth to a body |
| `harness/run.ts` | A reader: runs a realm and prints what its people did each year |
| `test/` | Determinism, purity, designated chance, conservation, and the two rules about the rules |

## How it follows the design

- **Processes do not know what they act on.** A test fails if any process names a row of a table, and another if it names a situation (famine, feud, price, market, law and the like).
- **A dozen acts on anything in reach.** People work, move, give, take, trade, promise and break. Borrowing is a promise; reaping another's ground is a taking against a bond.
- **No price and no market.** A swap happens when two bodies value two things differently, at a rate between their two valuations.
- **Chance only at the edges.** The founding, the weather, and each person's thresholds at birth. A test checks every draw.
- **The farming year is not scheduled.** It follows from when the crop row grows and what cold does to it.
- **A holding grows from use.** Whoever sows ground comes to hold it; the bond weakens when the ground is left.
- **Every record is an act or a process**, with the record that led to it where one is known.

## What thirty years look like

Four seeds, people alive at the end of each second year:

| Seed | 2 | 6 | 10 | 14 | 18 | 22 | 26 | 30 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 226 | 281 | 124 | 68 | 60 | 65 | 94 | 126 |
| 2 | 230 | 284 | 343 | 394 | 126 | 92 | 77 | 58 |
| 3 | 228 | 276 | 327 | 393 | 80 | 60 | 60 | 74 |
| 4 | 225 | 287 | 355 | 441 | 127 | 89 | 65 | 71 |

Stage 1 is done by the design's measure: thirty years run with no court, and people trade, starve, move and quarrel without a rule naming any of it. Things that arose with no rule for them:

- A farming year: sowing in the first warm weeks, reaping as growth stops.
- Waters fished out and wild herds culled away where nobody holds them.
- The hungry reaping green corn, their own and other people's, which ruins the next harvest.
- Takings that leave a debt, debts that are fought over, and enmity between houses that outlasts its cause.
- Loans in a bad year, most kept, some broken; goodwill between houses that trade.
- Hearths dividing when full, orphans going to kin, the dead leaving land to kin.

## Known gaps

1. **The crash is too deep.** Every seed grows for 8 to 15 years, outruns its land, and loses about 70% of its people in two or three years. A real famine takes far fewer. Hunger, green corn, taking and fighting feed one another with too little to stop them.
2. **Recovery is slow.** After a crash, houses stay at odds for years and births stay low, though land is plentiful.
3. **The landless have nothing to offer.** Nobody can work another's ground for a share. This needs a promise of labour, which is a bond about an act and belongs to stage 3. It is probably the largest missing brake.
4. **Idle days are spent oddly.** People with nothing pressing make far more blades and halls than they use.
5. **Simplified against the design, on purpose, for this stage:**
   - A hearth chooses as one, with its eldest member's thresholds. Each person choosing is stage 5.
   - The hearth is the only body, and it is given at the founding. Bodies that form are stage 4.
   - Matter is an amount, not particular things with their own soundness.
   - Everyone knows the true state of what they can reach. Beliefs are stage 5.
   - There is no sickness, fire or news (the process of passing on), and no learning.
   - Water only wets the soil; there are no floods. The living land in full is stage 6.
   - Dealings happen in order within a week, so a later dealer sees an earlier one's swap.
6. **The numbers in `tables.ts` are first guesses**, tuned only far enough for the realm to live.

## Next

Stage 2, readers: recognisers that name what happened, a chronicle in plain sentences, the design's measures, and the prediction log.
