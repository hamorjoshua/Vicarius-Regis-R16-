# The emergent realm

The build of [The Emergent Realm](../docs/living-realm-design.md), stage by stage. The current game (`../index.html`) and the first build (`../realm/`) are untouched; `realm/` stays as a reference until stage 2 replaces its harness.

**Stages 1 and 2 of 9 are here.** Stage 1 is a toy: land of 100 cells, about 200 people, fourteen kinds of matter, simple bonds, and no court. Stage 2 is the readers: they recognise events, write a chronicle and take the design's measures. The prediction log is not built. Stages 3 to 9 are not started.

## Run it

```
cd emergent
npm install                          # typescript only, for the typecheck
npm test                             # the invariants
npm run check                        # typecheck
node harness/run.ts chronicle 30 1   # the history of realm 1, in plain sentences, with causes
node harness/run.ts measures 30 1,2,3   # the measures over several realms
node harness/run.ts hearth 12 30 1   # one house: what it did and suffered, and its cover each year
node harness/run.ts cell 45 30 1     # one cell: what stood on it, who held it, who worked it
node harness/run.ts years 30 1       # raw yearly counts of every act
```

Node 22.18 or later runs the TypeScript directly. Thirty years of one realm takes 20 to 30 seconds.

## What is here

| Path | Contents |
| --- | --- |
| `sim/tables.ts` | Everything that exists, as data: needs, kinds of matter, what lives on the land, ways of making, constants. The only file that names a row |
| `sim/types.ts` | The state: flat tables of cells, people, bodies, bonds and regard |
| `sim/found.ts` | The founding: land, people and stores drawn once |
| `sim/step.ts` | The week: a pure function from one state to the next |
| `sim/processes/` | `sky` (the forcing), `grow`, `make`, `decay`, `move`, `bind`, `choose`, `gather` |
| `sim/value.ts` | Cover of each need in weeks, and what more of anything is worth to a body |
| `readers/readers.ts` | The readers: they recognise famines, feuds, flights, failed crops and the like from the record, and follow causes back. The only place a situation is named |
| `harness/run.ts` | The commands above |
| `test/` | Determinism, purity, designated chance, conservation, the two rules about the rules, and that readers cannot change the state |

## How it follows the design

- **Processes do not know what they act on.** A test fails if any process names a row of a table, and another if it names a situation (famine, feud, price, market, law and the like).
- **Rest is a need like any other.** A day of rest is a row in the table of ways of making; nothing in the rules knows it is rest.
- **A dozen acts on anything in reach.** People work, move, give, take, trade, promise and break. Borrowing is a promise; reaping another's ground is a taking against a bond.
- **No price and no market.** A swap happens when two bodies value two things differently, at a rate between their two valuations.
- **Chance only at the edges.** The founding, the weather, and each person's thresholds at birth. A test checks every draw.
- **The farming year is not scheduled.** It follows from when the crop row grows and what cold does to it.
- **A holding grows from use.** Whoever sows ground comes to hold it; the bond weakens when the ground is left.
- **Every record is an act or a process**, with the record that led to it where one is known.

## What thirty years look like

Six realms of thirty years (`measures 30 1,2,3,4,5,6`):

| Seed | ms a week | Peak | Trough | Fall | Years falling | End |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 13.9 | 376 | 62 | 84% | 1.3 | 158 |
| 2 | 13.9 | 312 | 85 | 73% | 3.8 | 258 |
| 3 | 15.3 | 380 | 84 | 78% | 4.3 | 192 |
| 4 | 13.1 | 280 | 70 | 75% | 3.6 | 199 |
| 5 | 21.3 | 542 | 152 | 72% | 1.4 | 209 |
| 6 | 14.1 | 330 | 68 | 79% | 3.8 | 163 |

Every realm grows for about a decade, falls once by 70 to 85%, and then recovers steadily.

What the readers found across the six:

| Event | Count | Median size | Largest |
| --- | --- | --- | --- |
| Feud (three or more fights between two houses) | 945 | 6 fights | 137 |
| Blood feud (a feud with deaths) | 277 | 9 fights | 189 |
| Ground or water stripped bare | 664 | | |
| The same come back | 565 | | |
| Crop lost to cold | 148 | 3,824 units | 26,674 |
| House died out | 59 | | |
| Flight (three or more houses leaving together) | 45 | 4 houses | 33 |
| Hungry season, dearth, famine | 23, 3, 8 | 1, 9, 135 deaths | 197 |
| Great crop, failed crop | 22, 18 | | |
| Year of broken promises | 20 | 74 broken | 124 |

None of these has a rule. A sample from one chronicle:

> A famine: 169 died for want of food over 27 weeks from the spring of year 13, most of them around (4,3).
> because house 47 broke its word to repay grain to house 22 ← house 47, in want of food, borrowed grain from house 22 ← house 8 fought house 47 for the grain it was owed ← house 47 broke its word to repay grain to house 8

## What the readers showed about the fall

- **It starts with a crop left in the field.** In 148 of 180 realm-years the cold takes a tenth or more of the standing crop. In the one realm read closely (seed 3), the fall follows a year when the cold took 5,129 against 7,205 brought in. People reap too late or too slowly. Whether every fall starts this way is not yet checked.
- **Blows kill about as many as hunger.** In the six falls, 865 died of blows and 924 for want of food.
- **Three loops run at once:** gathering from ground others hold (about 1,800 times a fall), taking from stores (about 1,200), and fighting over debts (about 1,100).
- **Trouble comes at every scale**, as the design wants: many small feuds and a few very long ones; many hungry seasons and a few famines.

## Where the measures stand

| Measure | Now | Note |
| --- | --- | --- |
| Speed | 13 to 21 ms a week for 200 to 500 people | The design's budget is 100 ms for 14,000. Not on course; to be profiled before stage 7 |
| Shapes of event | 24 in all, 19 to 21 in each realm | Every realm contains nearly the same kinds of thing |
| Chains of causes found in only one realm | 14% | The design wants most. Chains are short because few acts record a cause yet |
| Novelty of each year against earlier years | About 0.8 throughout, drifting down to 0.76 | A crude measure (how badly the year's record compresses given the past); it has not been checked against a realm known to repeat |
| Petition measures | None | There is no court until stage 8 |

## Known gaps

1. **The fall is too deep**, at 70 to 85%. The readers point at late reaping first, then at the three loops above.
2. **The landless have nothing to offer.** Nobody can work another's ground for a share. This needs a promise of labour, which is a bond about an act and belongs to stage 3.
3. **Realms are alike.** They differ in when and where, not in what kinds of thing happen. Bonds on bonds, bodies and minds are meant to change that.
4. **The prediction log is not built**, and no predictions were written before these runs.
5. **Six of the design's needs are missing** (health, safety, company, standing, security in what one holds, the hope of salvation), because nothing made can serve them yet.
6. **Simplified against the design, on purpose, for now:**
   - A hearth chooses as one, with its eldest member's thresholds. Each person choosing is stage 5.
   - The hearth is the only body, and it is given at the founding. Bodies that form are stage 4.
   - Matter is an amount, not particular things with their own soundness.
   - Everyone knows the true state of what they can reach, and expects crops to grow by a formula. Beliefs are stage 5.
   - There is no sickness, fire or news (the process of passing on), and no learning.
   - Water only wets the soil; there are no floods. The living land in full is stage 6.
   - Dealings happen in order within a week, so a later dealer sees an earlier one's swap.
7. **The numbers in `tables.ts` are first guesses**, tuned only far enough for the realm to live.

## Next

Stage 3, bonds on bonds: a bond whose object is any thing, act or other bond, starting with a promise of labour.
