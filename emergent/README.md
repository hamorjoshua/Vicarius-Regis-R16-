# The emergent realm

The build of [The Emergent Realm](../docs/living-realm-design.md), stage by stage. The current game (`../index.html`) and the first build (`../realm/`) are untouched; `realm/` stays as a reference until stage 2 replaces its harness.

**Stages 1 to 6 of 9 are here.** Stage 5 leaves out forged records and beliefs about who holds what. Stage 1 is a toy: land of 100 cells, about 200 people, fourteen kinds of matter, and no court. Stage 2 is the readers: they recognise events, write a chronicle and take the design's measures. Stage 3 is bonds on bonds. Stage 4 is bodies made of bodies. Stage 5 so far is ways of dealing that people find for themselves, and beliefs about what brings harm. Stage 6 is the living land. The prediction log is not built. Stages 7 to 9 are not started.

**The tables and findings below "What thirty years look like" were taken before stage 3.** The sections "After stage 3", "After stage 4" and "Stage 5 so far" have the later figures; the last of them, "With fallible blame", is current.

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

## After stage 3

Stage 3 added, to the bond that already existed:

- **A bond may be about another bond.** One body may use what another holds for a share of what it yields, and that right can itself be let, without limit. A holding may stand as surety for a debt and pass if the debt is broken.
- **Work can be owed.** Someone short of food can take goods now against days of work, done a part of each week.
- **A debt can be made good another way**: in other goods of the same toil, or worked off.
- **Foresight was corrected first**: people read the cold they can feel, allow for the weeks reaping takes, and do not count on the last weeks of the season.

Four realms of thirty years (`measures 30 1,2,3,4`):

| Seed | Peak | Trough | Fall | End |
| --- | --- | --- | --- | --- |
| 1 | 395 | 47 | 88% | 122 |
| 2 | 424 | 49 | 88% | 142 |
| 3 | 388 | 60 | 85% | 146 |
| 4 | 456 | 43 | 91% | 85 |

| Form of bond | First seen, by realm (year) | Standing at year 30 |
| --- | --- | --- |
| A lease of a holding | 1, 2, 2, 1 | None |
| A lease of a lease | 2, 2, 2, 2 | None |
| A lease of a lease of a lease | 5, 3, 3, 3 | None |
| Work owed by word | 1, 12, 13, 4 | None |
| Work owed for a wrong | Seed 3 only, year 13 | None |
| A pledge of a holding | 13, 14, never, never | None |

What changed:

- **Fighting fell sharply.** Feuds went from about 200 a realm to about 45, and fights over debts no longer appear in the falls. Deaths from blows in a fall went from about 145 to about 100.
- **New arrangements arise by themselves**, three levels deep within five years.
- **The fall got deeper, not shallower** (85 to 91%, from 72 to 84%). Realms now grow further, to about 390 to 460, before they fall, and the fall is almost all hunger: about 270 deaths for want of food each.
- **None of the new forms survives the fall.** The design's test for this stage is arrangements standing at year thirty of a form absent at year one. That is not met: they arise, and are swept away.
- **Realms are no less alike.** Every realm shows the same 20 shapes of event.

So the fall is not caused by fighting or by the landless having nothing to offer. The land fills by about year 12, stores per head shrink for several years while numbers keep rising, and then everyone runs out at once.

## After stage 4

Stage 4 added:

- **Hearths are no longer given.** Each grown person is founded alone, with children beside their mother. In seed 1, 75 bodies at the founding become 51 hearths within a year, by the same rule that joins any wedded pair.
- **Bodies made of bodies.** Bodies that hold one another well enough, all round, become one body. It keeps a store in common that its parts put into in plenty and draw on in want, and its parts stand with one another in a struggle. A part the rest no longer hold well leaves; a body of fewer than two comes apart.
- **The same rule at every level.** A body made of bodies is a unit like any hearth, so bodies join bodies.

Four realms of thirty years:

| Seed | Peak | Trough | Fall | End | Bodies of bodies at year 30 | Deepest |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 421 | 41 | 90% | 104 | 4 | 1 |
| 2 | 382 | 50 | 87% | 120 | 4 | 1 |
| 3 | 396 | 88 | 78% | 195 | 6 | 2 |
| 4 | 474 | 111 | 77% | 209 | 8 | 2 |

- **Bands form and break:** 45 formed, 46 came apart, and 23 times bands joined into a larger body, the largest of 11 houses.
- **Bodies of bodies stand at year thirty in every realm**, which no realm had at year one. Unlike the leases of stage 3, they outlast the fall.
- **Realms begin to differ in kind:** 25 shapes of event in all, and 25, 24, 22 and 23 in the four realms. Before, every realm had the same 20.
- **The fall is unchanged in most realms** (77 to 90%). Two of four are shallower than any after stage 3; four realms are too few to say bodies did that.
- **Feuds rose somewhat** from stage 3 (about 60 a realm against 45), still far below the 200 before it.
- **A body does little yet.** It shares a store and stands together. It does not hold land, make rules, speak with one voice or deal as one, all of which the design asks of a body.

## Stage 5 so far

**Ways of dealing are found, not written.** The loan, pledge, lease and work-for-goods branches of stage 3 are gone from the rules. A side of a dealing is one of six things: goods, goods later, days of work, the use of ground, a share of what that ground yields, or ground standing surety. A hearth in want uses the ways it knows. After four weeks of going without it tries giving something it has for the thing it lacks, and if the other gains too, both now know that way. A way that only fails is forgotten. Everyone starts knowing only how to swap goods for goods.

**Beliefs about what brings harm.** A house that suffers a death, a taking or a broken promise blames what it lately met with: a house it dealt with, a way of dealing, a newcomer, the state it was in when a child was born. Beliefs are told to kin, to fellows of the same body and to any who hold the teller well; they lose a fifth in the telling and fade. A house acts on what it believes: it will not deal with newcomers, will not use a way, thinks worse of a house, or waits to have a child.

Three realms of thirty years (`measures 30 1,2,3`):

| Way of dealing | First used (year, by realm) | Times used |
| --- | --- | --- |
| Goods later for days of work (hiring on credit) | 1, 1, 1 | 2481, 2699, 2108 |
| Goods for days of work (wages) | 1, 1, 1 | 699, 731, 532 |
| Goods later for goods (a loan) | 1, 1, 1 | 193, 188, 138 |
| Days of work for goods | 1, 1, 1 | 159, 221, 106 |
| Goods later, on surety of ground, for days of work | 1, 1, 1 | 81, 89, 44 |
| Goods for the use of ground (rent paid down) | 2, 2, 2 | 10, 19, 19 |
| A share of the yield for the use of ground | 2, 2, 2 | 14, 12, 7 |
| Days of work for the use of ground (labour rent) | 2, never, 2 | 2, 0, 4 |
| The use of ground for days of work | 18, 2, never | 1, 1, 0 |
| Days of work, on surety of ground, for goods | 1, never, 3 | 4, 0, 1 |

| Belief | Came to it themselves / were told it | Holding it at year 30 |
| --- | --- | --- |
| That some named house brings harm | 1014/9211, 762/7941, 1092/7886 | 14, 22, 25 |
| That newcomers bring harm | 38/247, 27/152, 19/174 | 0, 0, 10 |
| That hiring on credit brings harm | 78/259, 65/164, 86/224 | 0, 2, 1 |
| That a child born to a house with under a season of bread comes to harm | 7/65, 8/69, 7/42 | 0, 0, 0 |

What this shows:

- **Arrangements nobody wrote do arise.** I wrote the six sides, not the ten pairings. Hiring on credit, wages, rent paid down and labour rent were not in stage 3.
- **Beliefs spread mostly by telling**, about six told for each one learned at first hand, and they change what houses do.
- **Some are false.** Newcomers do nothing in the rules that others do not, yet in every realm houses come to refuse them. I have not measured how often a blamed house or way had anything to do with the harm.
- **Ill opinion of particular houses spreads too easily.** By year 30 nearly every house holds that some other brings harm, and feuds are back up to about 100 a realm from 60.
- **The fall is not cured** (81 to 91%). The belief that children born in want come to harm does arise, but only at years 15 to 17, in the fall itself, and it is forgotten by year 30. People learn restraint from the catastrophe, not before it.
- **Realms differ a little more:** 36 shapes of event in all, 32 or 33 in each.
- **It is slower:** about 25 ms a week, from 15.

Not yet built of stage 5: a mind for each person (a hearth still chooses as one), plans of several steps, practices of work that are copied imperfectly and recombined, beliefs about facts (who holds what, who did what), and crop foresight that is learned and not given.

## With a past

Every command now starts from a realm that was founded thirty years back and lived through to week 0 (`inherit` in `sim/found.ts`; `P.past`). Year 1 of a run is year 31 of the realm. Three realms, thirty years of run after that past:

| Seed | Start | Peak | Trough | Deepest fall | End |
| --- | --- | --- | --- | --- | --- |
| 1 | About 70 | 173 | 68 | 4% | 173 |
| 2 | About 120 | 414 | 61 | 85%, around year 22 | 80 |
| 3 | About 250 | 290 | 232 | 9% | 290 |

- **The run opens on a realm with a history:** people already know five or six ways of dealing, hold ill opinions of particular houses, and belong to bodies.
- **Two of three runs have no fall.** But that is because their fall happened in the past, off stage, and they have not yet regrown to the land's limit.
- **Seed 2 falls a second time,** as deep as the first (85%), about 22 years into the run. Its people had lived through one fall a generation before and it did not help.
- **Why memory fails:** a belief halves in under three years unless harm renews it. The belief that children born in want come to harm had vanished long before numbers pressed on the land again.

So a past does what the design wants of it, an opening that differs from realm to realm. It does not cure the fall.

## With customs

A belief that half or more of a body's houses hold is taken up by all its members and does not fade among them. Three realms, forty years of run after the thirty-year past (`measures 40 1,2,3`):

| Seed | Peak | Trough | Deepest fall | End |
| --- | --- | --- | --- | --- |
| 1 | 465 | 111 | 76% | 172 |
| 2 | 359 | 57 | 84% | 126 |
| 3 | 338 | 78 | 77% | 106 |

- **Every realm falls again**, so the fall recurs about once a generation. Seeds 1 and 3, which had no fall in thirty years of run, have one within forty.
- **Customs do form and last,** but not the one hoped for. Standing at the end: that newcomers bring harm (three bodies in seed 1), and that some named house brings harm (one to three bodies in each realm).
- **No custom about children ever forms.** That belief arises only in a fall, when bodies are breaking apart, and never reaches half of one.
- **In each fall, ground others hold is gathered from 1,500 to 3,000 times.** Unlike a taking from a store, this is never opposed.

## With fields defended

A taking from ground whose holder lives within reach is now a struggle, by the rule that already governed a taking from a store. The same three realms, forty years of run:

| Seed | Before: deepest fall | Before: end | Now: deepest fall | Now: end |
| --- | --- | --- | --- | --- |
| 1 | 76% | 172 | 7% (no fall yet) | 270 |
| 2 | 84% | 126 | 87% | 271 |
| 3 | 77% | 106 | 64% | 248 |

- **Not cured.** Seed 2 falls as hard as ever. Seed 3 is somewhat shallower. Seed 1 has not fallen in forty years, but it began the run small and may simply not have reached the land's limit.
- **Realms end far larger** (about 250 to 270, from 100 to 170), so they recover faster.
- **Blood feuds nearly vanish:** 12 across the three realms, from 110.
- **A custom about children stands for the first time.** In seed 3, six bodies hold at the end that a child born to a house with under half a year of bread comes to harm.
- Three realms are too few to be sure of any of this.

## With the living land

Stage 6 added:

- **Water has a path.** Rain soaks in or runs off according to what covers the ground, and what runs off is sent downhill cell by cell. Where a channel carries more than four times its usual flow it floods, and the flood carries off standing crop and a share of the stores of those who live there.
- **Soil moves.** Water takes soil off bare slopes and lays it on the cell below. Cropping tires soil and dung restores it.
- **Three creatures, as table rows only:** one that feeds on herds, one on grain laid by, one on the standing crop. Each wanders toward where there is more to feed on, and the cold kills two of them.

Three realms, forty years of run after the past (`measures 40 1,2,3`):

| Seed | Peak | Trough | Deepest fall | End |
| --- | --- | --- | --- | --- |
| 1 | 318 | 47 | 85% | 159 |
| 2 | 322 | 20 | 94% | 48 |
| 3 | 249 | 55 | 78% | 167 |

| The land, mean of the realms | Year 1 | Year 10 | Year 20 | Year 30 | Year 40 |
| --- | --- | --- | --- | --- | --- |
| Woods | 73,606 | 71,819 | 72,897 | 80,042 | 77,052 |
| Fish | 138 | 907 | 1,336 | 2,081 | 1,328 |
| Ore left | 6,633 | 5,832 | 5,243 | 4,839 | 4,019 |
| Vermin | 464 | 414 | 530 | 320 | 944 |
| Mean soil | 0.61 | 0.59 | 0.58 | 0.59 | 0.58 |
| Floods in the ten years | | 3.7 | 3.7 | 1.3 | 1.3 |

- **New kinds of event:** 30 floods, 20 of them great (the largest carried off 592 of crop and stores), and 63 years of vermin in 120 realm-years, the worst eating 3,915.
- **Slow change is there but small:** soil thins a little, the ore is being worked out, and the fish come back when there are fewer people.
- **The design's test for this stage is not met.** It asks for a slow consequence nobody ordered, such as a flood from felled woods. The woods are not being felled faster than they grow, so no such flood happens; floods here follow the weather, not what people did.
- **The creatures that feed on herds died out** in every realm, because people had already hunted the herds down. The blight never took hold.
- **Realms are poorer and the fall is no better:** peaks of 250 to 320, from 330 to 430, and falls of 78 to 94%. Vermin and floods take a steady share.
- **The first version of this stage killed every realm** within five years. Four faults were corrected; see the commit "the living land made liveable".

## With minds and plans

**A mind for each person.** Beliefs, ways of dealing and skill at each kind of work belong to people. A hearth acts on what the eldest of its grown members knows. Members teach one another as far as each is ready to believe. What a person knows goes with them when they marry out, and is lost to the hearth when they die. Skill grows with doing and slips without it, and children start unskilled.

**Plans held over weeks.** A hearth that can offer nothing today for what it lacks asks what the one who has it most wants that this hearth could make. It sets itself to make that, keeps it back from other dealings, and gives up after half a year if nothing comes of it. This is one kind of plan only; schemes of several dealings are not built.

Three realms, forty years of run after the past, measured three times as these were added:

| | Seed 1: peak, deepest fall, end | Seed 2 | Seed 3 |
| --- | --- | --- | --- |
| Minds only | 146, 10%, 188 | 291, 89%, 47 | 65, 17%, 215 |
| Minds and plans, first version | 73, 7%, 75 | 156, 32%, 158 | 42, 5%, 166 |
| Minds and plans, corrected | 371, 88%, 56 | 146, 12%, 149 | 316, 75%, 81 |

- **Hearths specialise.** The best hearth at netting reaches a skill of about 1.5 where the average is 0.95; at panning 1.2 to 1.4 against 0.8.
- **Plans mostly fail.** Of 340 to 890 made in a realm, 8 to 18% are fulfilled. In the first version it was 5 to 12%, because a hearth would give no more than half of what it had made for the purpose.
- **Three realms cannot tell these versions apart.** The same seed gives a peak of 73 under one version and 371 under the next. A small change to the rules sends a realm down a different road, which is what the design wants of the realm but means a batch of three measures nothing about a change. Batches need to be larger.
- **One oddity:** rest is a kind of work in the tables, so people grow skilled at resting.

Not yet built of stage 5: beliefs about facts (who holds what, who did what), and foresight about crops that is learned and not given.

## A baseline of twelve

Twelve realms with minds and plans, forty years of run after the past, four at a time on four cores:

| Seed | Peak | Trough | Deepest fall | End |
| --- | --- | --- | --- | --- |
| 1 | 371 | 43 | 88% | 56 |
| 2 | 146 | 129 | 12% | 149 |
| 3 | 316 | 79 | 75% | 81 |
| 4 | 62 | 52 | 16% | 176 |
| 5 | 33 | 32 | 3% | 57 |
| 6 | 284 | 36 | 87% | 134 |
| 7 | 92 | 86 | 7% | 138 |
| 8 | 37 | 31 | 16% | 140 |
| 9 | 103 | 85 | 17% | 156 |
| 10 | 216 | 25 | 88% | 73 |
| 11 | 110 | 87 | 21% | 247 |
| 12 | 54 | 50 | 7% | 99 |

A third of the realms (4 of 12) suffer a fall of 75% or more within forty years of run. The other eight open small, having fallen in their past, and spend the run regrowing.

## With learned foresight

Each person holds a belief about how much a unit of seed returns, drawn at birth around their parents' and corrected each midwinter by what the year's sowing brought back. The hearth sows by its eldest member's belief. The same twelve realms:

| | Baseline | With learned foresight |
| --- | --- | --- |
| Realms that fall by 75% or more | 4 of 12 | 3 of 12 |
| Realms that fall by 40 to 75% | 0 | 4 |
| Mean number at the end | 126 | 171 |
| Shapes of event, per batch of three | 30 to 35 | 35 to 41 |

- **Hearths come to believe very different things.** Within one realm the believed return runs from 4 to 58 for a unit of seed.
- **Belief drifts upward,** to a mean near 30 from a start near 6. Sparse sowing returns more for each seed, so sowing little teaches that seed goes far.
- **Realms end larger on average,** and falls are more often partial. With twelve realms this is a tendency, not a proof.
- Still given, not learned: when the season for sowing is open, and how a standing crop is expected to ripen.

## With fallible blame

A holder who lives near their ground knows who stripped it. One who lives further off must guess, and lays it to whichever house within reach they already think worst of. The debt, and any fight, fall on that house. The same twelve realms:

| | Baseline | Learned foresight | And fallible blame |
| --- | --- | --- | --- |
| Realms that fall by 75% or more | 4 of 12 | 3 of 12 | 6 of 12 |
| Realms that fall by 40 to 75% | 0 | 4 | 2 |
| Mean number at the end | 126 | 171 | 99 |

- **Nearly three in four unseen takings are laid to the wrong house:** 1,117 wrong against 421 right across the twelve realms.
- **Realms are worse off for it.** Twice as many fall hard, and they end smaller. An innocent house made to pay for another's taking is pushed toward want itself, and the guilty one is never checked.
- **More kinds of thing happen:** 39 to 42 shapes of event in each batch of three.
- Not built: beliefs about who holds what, and records that can be forged.

## Known gaps

1. **The fall is still too deep** (64 to 87% where it happens), and it recurs about once a generation. Foresight, a past, customs and defended fields have each been tried; the last helped most and none cured it. Belief supplies restraint only while children are dying, and is forgotten within a few years. Customs now exist and last, but none forms about children. The depth of the fall may lie less in births than in the fields: the hungry strip standing crops, their own and others', unopposed, and the next harvest fails for everyone.
2. **Blame of particular houses is too catching**, and has brought feuds back up.
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

Stage 7, the realm: 2,000 cells, 14,000 people and the full tables, inside the time budget. A week now takes 15 to 55 ms for a few hundred people, so the first work of stage 7 is speed.
