# Vicarius Regis — The Living Realm: Simulation Design

Nov 26, 2026 · Third version, rewritten around emergence. This file is the source. Earlier versions are in its git history, and the [Claude Doc](https://claude.ai/artifact/HejEULhYmPgyQz9c882bHT) it was first exported from holds the first.

## Summary

Build the realm from a few elementary laws acting on a great many particular things, and write nothing above that level. What happens in a reign should be something neither the designer nor the builder could have listed in advance.

The player's side is unchanged. The regent hears three petitions a week, rules, and keeps the court's standing until the king returns three or four years later. Everything beneath the docket is a realm of some 2,800 households, each simulated as itself, in about forty parishes.

The rule for the whole design is **many nouns, few verbs**. The realm may be as full as Dwarf Fortress: goods, tools, mills, bridges, kin, debts, rights, offices. But only eight laws act on all of it, and the same law that spreads a fever spreads a rumour, a panic and a fire.

Three things follow from that rule.

- **Nothing above the laws is written.** There is no code for a famine, a riot, a feud, a price or a faction. Each is recognised in the record after it has happened, never triggered.
- **Nobody is an average.** Every household has its own stocks, ties, claims and thresholds, and knows only what it has seen or been told.
- **The law of the realm is written by play.** A ruling makes a rule that lesser courts apply, so a question the regent has settled stops arriving, and what arrives next is something else.

This version replaces most of the second. The first build, in `realm/`, followed the earlier design faithfully and was monotonous: every event had a cause, and a reign still showed about seventeen shapes of petition, most of them repeats. The causes of that were in the design, and they are listed under What stays, what goes.

One cost should be stated plainly. A realm built this way cannot be steered toward particular stories, and it cannot be forecast with confidence. It can only be tested for general properties: that it is varied, that it answers to the player, and that it is neither frozen nor chaotic.

## The goals, and the principle above everything

This document is one attempt at a set of goals. If a better version would serve them better, the better version wins, even where it contradicts everything written here.

### The goals

1. **A living realm.** The realm is simulated deeply enough to feel alive, in the spirit of Dwarf Fortress: weather, harvests, trade, sickness, faith, kinship, unrest and politics.
2. **Emergence.** What happens arises from elementary rules acting on one another, as in the study of complex systems. The designers should be unable to say in advance what a reign will contain.
3. **Chance at the edges.** Randomness decides little, and only at designated points.
4. **Decisions that echo.** The player's rulings feed back into the realm and shape what it later produces, in systems the player affects but does not control.
5. **The court.** The player governs only through a weekly docket of hearings, three as now, and the rulings given there, with the court's standing at stake.
6. **Nothing authored.** Events, outcomes and their words arise from the machinery, never from scripts, lists of situations or categories of happening.
7. **Never bland, never repetitive.** A player should not see the same thing happen again for the same reasons, nor see things happen regardless of what they ruled.
8. **Texture and truth.** Belief, superstition, kinship and custom give the realm its texture, grounded in how medieval life actually worked.

Goal 2 is new in this version and replaces "mutual determination", which it includes. Goals 6 and 7 are sharpened. The goals themselves change only when the designer decides they should.

### The principle

Everything beneath the goals is provisional: the pillars, the laws, the nouns, the numbers, the week's order, the architecture and the build plan. Each is the current best guess at serving the goals. When a better way appears, take it, name the goal it serves better, and change this document to match.

### Reading this document

- Treat the specifics as a worked example of the goals, not a contract.
- Prefer a simpler law that produces the same variety over a complicated one written here.
- If something here works against a goal, the goal wins at once.
- When in doubt, build the smallest version that shows whether the goals are being met, and let what it shows decide.

## What emergence means here

Emergence here means that the things a player would name in a reign were never named in the rules. The rules speak of households, needs, things, ties and claims. The player sees a famine, a feud, a corrupt reeve and a town turning against its merchants.

### What is written, and what is left to arise

| Written by us | Left to arise |
| --- | --- |
| The kinds of noun: place, household, person, thing, good, tie, claim, rule | Prices, wages and where markets reach |
| The eight laws | Custom, and the law of the realm |
| The tables of nouns: which goods, tools, ties and claims exist | Factions, patronage and feuds |
| The starting map and the weather's climate | Famines, epidemics, panics and riots |
| The court's loop: audience, hearings, standing | Crime, corruption and who is blamed |
| The words for nouns and laws | The petitions, and the cases they make |

If something in the right-hand column ever appears in the rules as a thing with its own code, the design has gone wrong at that point.

### What makes it happen

Complex behaviour does not come from complicated rules. It comes from a few conditions, and the design must hold all of them.

| Condition | Here |
| --- | --- |
| Many actors that differ | About 2,800 households, each with its own holdings, ties, temper and thresholds |
| Local knowledge | A household knows its own state, its neighbours' visible state, and what it has been told |
| Local action | A household acts on what it can reach: its things, its ties, its parish |
| Thresholds | People act when enough has gathered: enough hunger, enough anger, enough neighbours doing the same |
| Adaptation | Households learn what works and copy neighbours who fare better |
| Conservation | Grain, coin, labour and people are never created to solve a problem |
| History | What has happened stays in the state: debts, grudges, rules, ruins |

The first build had one of these seven, conservation. Its actors were averages, they knew the whole region's state, and they neither copied nor crossed thresholds one by one.

### Recognised, not triggered

Events are read from the record by recognisers, which are separate from the rules and cannot change the state. A recogniser sees that forty households in one ward took grain from three merchants' stores in a single week, and writes "riot". The rules never contain the word.

This is the test that keeps the design honest. Search the rules for "famine", "riot", "feud", "faction", "panic" or "price", and they should not be found.

### What this costs

- **No steering.** The realm cannot be tuned toward chosen stories. It can be tuned only by changing nouns, laws and the measure of harm.
- **Weak forecasts.** Small differences grow. A preview can say what the steward expects and how sure he is, not what will happen.
- **Surprises of the wrong kind.** Some of what emerges will be dull, absurd or broken. The harness exists to find those before a player does.

## Pillars

Thirteen rules are the current best reading of the goals. When a design question is unclear, they decide it, until something serves the goals better.

1. **Few verbs.** Eight laws act on everything. A new law needs far stronger reasons than a new noun.
2. **Many nouns.** Goods, things, ties and claims are rows in tables, and the tables may be long. Excess belongs here.
3. **Everyone is someone.** No household is an average or a copy. Aggregates are sums taken for the screen, never things the rules act on.
4. **Local knowledge, local action.** Nobody in the realm sees the whole of it. Beliefs can be wrong, late and contagious.
5. **Recognised, not triggered.** Nothing a player would call an event has code of its own.
6. **Chance enters only at the boundary.** Weather, sickness from abroad, raiders, prices abroad, and the thresholds each person and thing is born with. Nothing else draws.
7. **Nothing is free.** Every grant comes out of something particular that someone else holds or wants. A ruling with no loser means something is not being counted.
8. **The player acts only through hearings.** Three a week, four at a cost in standing. The regent's acts are the same elementary acts open to everyone, done with more power.
9. **Rulings leave things behind.** Every ruling adds a noun to the realm: a rule, a claim, a debt, an office-holder, a grudge. Those act later.
10. **A question settled stays settled.** What the regent holds, lesser courts apply. The same question returns only when someone pushes the holding further or challenges it.
11. **Explained afterwards.** What happens need not be predictable, but once it has happened the ledger can say why, link by link.
12. **Every noun needs a mouth.** A noun is worth adding only if it can reach the docket as a new kind of case, or change who brings one.
13. **Blandness means a missing noun or a missing meeting.** If the realm is flat, add something that can collide with what is there. Never write an event.

## What stays, what goes

The player's side of the game survives. So do the foundations of the first build. The middle of both earlier designs is replaced.

### Kept as it is

| Element | As it works today |
| --- | --- |
| The reign's end | The king returns at the close, and the reign is kept if any standing remains |
| The calendar | Four quarter days: Lady Day (week 7), Midsummer (20), Michaelmas (34) and Christmas (46) |
| Audience and docket | Petitioners wait in an audience. The player hears 3 a week, or 4 by spending 2 standing |
| Rulings | Grant, an alternative, or deny. Each option shows its effects before it is chosen |
| Standing | 10 seals; the reign falls at 0 |
| Regions and estates | Capital, Highlands, Riverlands. Noble, Cleric, Official, Merchant, Soldier, Commoner |
| The visual language | Cards, pressure pips, binding boxes, rule plates, seals, tiles |
| The platform | A static web app that runs offline in a browser |

### Kept from the first build

| Piece | Why it holds |
| --- | --- |
| A pure step, plain state, exact replay | A save is a seed and the rulings given |
| Designated draws, and a test that nothing else draws | Decisions change the odds, never the dice |
| The causal ledger | It is what makes an unforeseen outcome explicable |
| Composing words from causes | No text belongs to a situation |
| The harness and the invariants | It found every real fault long before play would have |
| The weather, the river and crop growth | They are the forcing, and they behaved well |
| A year or more of history before the reign | Openings differed as soon as it was added |

### Replaced

| Earlier design | Why it produced monotony | Now |
| --- | --- | --- |
| Eighteen cohorts, and named households built as small copies of them | Averages behave smoothly and have no troubles of their own | Every household is simulated as itself |
| One measure of pressure, weeks of cover | Frost, murrain, a raid and a debt all read as hunger | A reading for each need; the scarcest binds |
| A price formula for each region | The price was computed, so nothing about it could surprise | Prices arise from households trading in parish markets |
| Formulas for unrest, grievance, devotion and superstition by region | A region had one mood | Each household holds its own, and they spread |
| Sickness counted by region | An outbreak had no path | Sickness passes from household to household |
| A riot coded as a stage with effects | It was an event with a trigger | Many households taking at once; recognised afterwards |
| A list of about twenty-four asks | Four of them made three quarters of all petitions | An ask is a cut in a chain of causes |
| A list of aims, a list of misfortunes, a table of what opens a dispute | Each was a list of situations under another name | One law of acting, one of wear, one of claims |
| Eight fixed maxims | The court's principles were chosen before play | Holdings are rules made by rulings |
| Emergence checks as targets for named stories | Tuning toward stories we already knew | Tests of general properties; named patterns only as a sanity check |
| A reign of 52 weeks | One harvest, so every reign had the same arc | Three or four years |
| Authored petition kinds and hallway matters | They were the monotony this design set out to cure | Nothing |

### References

- `index.html`: the current game. It stays playable until the new one surpasses it.
- `core/`: the primitives prototype. `core/README.md` lists its vocabulary.
- `realm/`: the first build. `realm/README.md` records what it showed.

## The nouns

A noun is a kind of thing the realm contains. There are eight kinds, and each is a table of data. The tables are meant to be long.

| Kind | About how many | What one is |
| --- | --- | --- |
| Place | 40 parishes, 3 regions, the world abroad | A node with neighbours, land by kind, water, and what stands on it |
| Household | 2,800 | The actor: its people, stocks, things, ties, claims, beliefs, memory |
| Person | 14,000 | Age, kin, trade and skill, health, and thresholds fixed at birth |
| Thing | several thousand | Something that holds, makes or carries: a field, a mill, a team, a bridge, a barn |
| Good | 20 to 30 kinds | Something made, kept, carried and used up |
| Tie | open | A link between two households, with a weight and an age |
| Claim | open | A right of a household over a thing, a person or a flow |
| Rule | open | What a power has held or decreed about claims and acts |

Every household is simulated. A household is "named" only in the sense that the composer gives a name to anyone it has to speak of. None is more real than another.

### Goods and needs

A good is a row: what it is made from, by what thing and skill, how it keeps, how it carries, and which need it meets. A need is something a household must have, and needs do not stand in for one another.

| Need | Met by | When unmet |
| --- | --- | --- |
| Bread | Grain, ground at a mill | Hunger |
| Meat, dairy and fish | Herds, rivers | Weakness; fast days broken |
| Fuel | Wood, peat | Cold and sickness |
| Salt | Trade from the coast | Meat that cannot be kept |
| Cloth | Wool, a loom | Cold; rank unmarked |
| Tools | Iron, a forge, a smith | Work that cannot be done |
| Draught | Oxen, horses | Land unsown, goods uncarried |
| Hands | The household's own workers | Its work left undone |
| Shelter | A sound house | Exposure and fever |
| Ready coin | Sales and wages | Nothing to pay with when a payment falls |
| Safety | A watch, a wall, a lord, kin | Loss, flight |
| Right | Claims that others honour | Dispossession |
| Honour | The esteem of those one lives among | Being shut out |
| Salvation | A priest, the sacraments, alms | Fear |

The last four are not goods, but they are needs like the rest: a household can be short of them, will act to mend the shortage, and can come to court about it.

### Things

A thing is a row of the same shape whatever it is: where it stands, who owns it, who keeps it, what it takes in, what it gives out, how much it can bear, its condition, its wear, and a soundness fixed when it was made.

| Thing | Takes in | Gives out | Many depend on it for |
| --- | --- | --- | --- |
| Field, meadow, pasture, wood | Seed, labour, weather | Grain, hay, grazing, fuel | A year's keep |
| Plough team, cart, barge | Fodder, a driver | Ploughing, carriage | Sowing; reaching a market |
| Mill | Grain, water or wind, a miller | Flour | A parish's bread |
| Loom, forge, oven, brewhouse | Wool, iron, flour, malt; skill | Cloth, tools, bread, ale | A trade; a neighbourhood |
| Barn, granary, cellar | Goods | The same goods, later | Getting through winter |
| Bridge, ford, road, quay | Upkeep | Passage | A route |
| Levee, wall, well, drain | Upkeep | Dry fields, safety, clean water | Everyone behind it |
| Church, bell, relic, shrine | Upkeep, a priest | The sacraments, consolation | A parish's salvation |
| Market, fair, court | A place, a time, a keeper | A meeting | Trade and judgment |

There is no special rule for any of them. A mill is a thing whose row says grain in, flour out, water needed, one skilled keeper.

### Ties

A tie links two households and has a weight that grows with use and fades without it.

| Tie | Made by | Carries |
| --- | --- | --- |
| Kin | Birth, marriage | Help in need, inheritance, shared honour and shared quarrels |
| Neighbour | Living side by side | What each can see of the other; sickness, fire, talk |
| Service | Tenancy, apprenticeship, hire, office | Labour one way, keep or protection the other |
| Debt | A loan, a sale on trust, a fine | A sum and a day |
| Trust | Promises kept | Willingness to lend, deal and believe |
| Grudge | Harm done | Willingness to harm, accuse and refuse |
| Fellowship | A guild, a tithing, a parish | Answering for one another |

### Claims

A claim says that a household may use, take from, command or exclude others from something. It has a holder, an object, a basis and a strength.

| Object | Claims on it |
| --- | --- |
| Land | Tenure, common right, right of way, tithe, rent |
| Water | A pond for a mill, flooding for a meadow, fishing, a ford |
| A thing | Ownership, use, suit (others must use it), a toll for its use |
| A person | Service, wardship, a marriage, the right to judge them |
| A flow | Dues, tithe, toll, a pension, a share of fines |
| A place | A market, a liberty, sanctuary |

A basis is long use, a charter, a ruling, a purchase or bare possession. Use strengthens a claim and disuse weakens it.

### Powers

A power is a household or body that others accept as able to decide about certain claims. That acceptance is itself a claim, so powers can be disputed like anything else.

| Power | Decides about |
| --- | --- |
| The head of a household | Its own people and goods |
| The lord of a manor | Tenures, services and the manor's things |
| The parish and the church | Tithe, marriage, wills, sanctuary, sin |
| The borough or guild | Its trade, its market, its members |
| An officer of the Crown | What his office covers: dues, the watch, a work |
| The regent | Anything, and whatever the others cannot or will not settle |

Each power keeps rules: what it has held before. Lesser powers follow the rules of the powers above them.

## The laws

Eight laws act on all the nouns. Each is one rule with no knowledge of what it is being applied to. Everything else in the realm is one of these laws meeting a row in a table.

### 1. Need

Every household reads its cover for each need: how long what it has and expects will last against what it uses and owes. The scarcest need binds.

```math
\text{cover}_k = \frac{\text{held}_k + \text{expected}_k}{\text{used}_k + \text{owed}_k}
\qquad
\text{pressure}_k = \min\!\big(8,\ \max(0,\ 2\,(4 - \log_2 \text{cover}_k))\big)
\qquad
\text{pressure} = \max_k \text{pressure}_k
```

Pressure is read, never set. For needs that are not goods, cover is read the same way: safety from the watch and wall nearby, right from the strength of one's claims, honour from the esteem of one's ties, salvation from a priest within reach.

### 2. Make

A thing turns what it takes in into what it gives out, as far as its inputs, its keeper's skill, its condition and the weather allow. The least of these limits the result.

```math
\text{out} = \text{capacity} \cdot \min\!\big(\text{each input against what is needed},\ \text{hands},\ \text{skill},\ \text{condition}\big) \cdot \text{weather}
```

A field makes grain from seed, labour and a season. A mill makes flour from grain, water and a miller. A priest makes consolation from his time. There is one rule.

### 3. Wear

Everything that is used or neglected wears, is mended by work and materials, and fails when its wear passes the soundness it was made with.

This holds for tools, buildings, roads and the levee. It also holds for soil, which tires; for bodies, where wear is hunger, toil, sickness and age set against a constitution fixed at birth; for claims, which lapse when unused; for trust, which decays without dealings; and for memory.

Fire, a broken wheel, a death and a lapsed custom are the same law reaching its threshold in different rows.

### 4. Flow

Goods, coin, people and water move along a link when the difference across it is greater than the cost of crossing.

```math
\text{move from } a \text{ to } b \quad \text{while} \quad \text{worth}_b - \text{worth}_a > \text{cost}_{a \to b}
```

Water runs downhill, and the cost is the levee. Grain is carted while the price gap pays for the road, its tolls and its dangers. People move when another parish offers more than the cost of leaving. Each mover decides for itself on what it knows.

### 5. Spread

A state passes from a household to its neighbours and ties. A household takes it on when what it is exposed to passes its own threshold for that state.

```math
\text{exposure}_i = \sum_{j \in \text{ties}(i)} w_{ij}\,\text{state}_j
\qquad
i \text{ takes it on when } \text{exposure}_i > \theta_i
```

Sickness, fire, news, rumour, fear, anger, a belief and a practice all spread this way. They differ only in which ties carry them, how fast they fade, and which threshold resists them.

Because thresholds differ from household to household, the same spark dies in one ward and takes a whole town in another, and nobody can say which beforehand. That is where most of the realm's surprises come from.

### 6. Act

Each week every household takes the one act that it believes will most ease its binding need, or secure what it holds, at a cost it can bear. It chooses among elementary acts applied to what it can reach.

| Act | In plain words |
| --- | --- |
| Work | Make with a thing, or mend it |
| Move | Go, carry, or send |
| Give | Hand over, as alms, a gift, a dowry, a bribe |
| Take | Seize, distrain, steal, graze, cut |
| Trade | Exchange with a willing other |
| Promise | Bind oneself: a loan, a contract, a betrothal, an oath |
| Break | Fail or refuse to keep a promise or a rule |
| Tell | Pass on what one knows or believes; accuse |
| Ask | Request an act of someone with the power to do it |
| Bar | Refuse entry, use, service or dealing |
| Join | Act together with others who share the cause |

There is no list of aims, remedies or crimes. Borrowing is a promise. Hoarding is declining to trade. Poaching is taking where a claim forbids it. A betrothal is a promise that makes a tie. A strike is many households barring their labour and joining. An aim is only an act that takes several weeks, kept up until it succeeds or looks hopeless.

A household values an act by what it expects, and what it expects is learned.

```math
\text{value}(\text{act}) = \text{belief it works} \times \text{ease to the binding need} - \text{cost} - \text{what it risks}
```

### 7. Claim

When what is claimed from a thing is more than the thing can bear, the claims conflict. A conflict stands until someone yields, the parties bargain, one side takes, or a power decides.

```math
\sum_{\text{claims on } x} \text{use claimed} > \text{what } x \text{ can bear} \;\Rightarrow\; \text{conflict over } x
```

Nothing opens a dispute but this. A drought lowers what a stream can bear, and the mill's claim and the meadow's can no longer both be met. A death removes a holder, and every claim that rested on him is reopened. A new work raises what a thing can bear and ends a quarrel, or lays a claim across someone's land and starts one.

Powers decide by their rules. A decision is itself a new rule.

### 8. Learn

A household keeps a memory of what it tried and what came of it, and of what others did to it. It adjusts what it believes works, and it copies acts that it sees working for those it is tied to.

```math
\hat{q}_{\text{act}} = \frac{\text{times it worked} + \alpha}{\text{times tried or seen} + \alpha + \beta}
\qquad \text{counts fade at } \lambda = 0.97 \text{ a week}
```

This is how the court gets a name: households learn what the regent grants and to whom. It is also how habits form and travel. A way of getting by that works in one parish is taken up in the next, whether it is coming to court, withholding a due, or going to the roads.

### What the laws do not contain

No law mentions a famine, a market, a price, a faction, a feud, a crime or a custom. These are what the laws produce.

| What a player would name | What it is underneath |
| --- | --- |
| A price | What households in one market last gave for a good |
| A market's reach | How far carting pays |
| A famine | Many households with bread as the binding need, and no act that eases it |
| A panic | The practice of holding grain back, spreading |
| An epidemic | Sickness spreading where thresholds are low: the hungry, the crowded |
| A riot | Anger spread through a ward, then many households taking in one week |
| A feud | Grudges along kin ties, each harm answered |
| A faction | Households tied to one another who hold the same grievance |
| Custom | Claims strengthened by long use, and practices long copied |
| Corruption | An office-holder under pressure taking from a flow he keeps |
| The law | The rules that powers have made by deciding |

## The forcing

The realm is driven from outside by the weather and the world abroad. These are the only parts of the design that are random, and their models are kept from the earlier versions because they behaved well.

### Weather

Weather is a seasonal baseline plus a persistent anomaly, so wet years and droughts come in runs. Each region carries a temperature anomaly and a rain anomaly; each parish adds a small one of its own.

```math
a_{r,t} = 0.8\,a_{r,t-1} + 0.6\,z_{t} + 0.4\,z_{r,t}
\qquad
T_{r,t} = \bar{T}_r(w) + \sigma_T\,a^{T}_{r,t} \qquad R_{r,t} = \bar{R}_r(w)\,e^{\sigma_R\,a^{R}_{r,t}}
```

Soil moisture, snow, frost and the river's level are derived from the running totals. The river carries Highland runoff to the Riverlands a week later, by the law of flow.

### The farming calendar

The calendar is fixed; its outcome is not.

| Weeks | Season | Work |
| --- | --- | --- |
| 4–12 | March–April | Spring ploughing; barley and oats sown |
| 13–25 | May–July | The hungry gap |
| 17–20 | June | Shearing |
| 20–25 | Late June–July | Haymaking |
| 25–31 | August–mid-September | The grain harvest |
| 34–38 | October | Winter wheat sown |
| 40 | Martinmas | Slaughter of beasts that cannot be fed |

A crop grows week by week from temperature and moisture, is killed by frost when tender, and takes blight in warm wet weeks. That growth is the weather term in the law of making.

### The world abroad

Beyond the border are a market whose prices drift, sickness that comes and goes, and raiders. They touch the realm at the quays and the Highland wall, by the designated draws.

## How the old systems read under the laws

Nothing that the earlier versions simulated is lost. Each system is now an outcome of the laws rather than a set of formulas of its own.

| Earlier system | The laws that produce it |
| --- | --- |
| Harvests and herds | Make, with weather; Wear on soil and beasts |
| Works and their decay | Wear; Act (work to mend) |
| Markets and prices | Act (trade) between households that meet in a market |
| Carting and trade abroad | Flow |
| Credit and debt | Act (promise, break); Learn (trust) |
| Duties and dues | Claims held by powers over flows and labour |
| Health and disease | Spread, against thresholds lowered by Need; Wear on bodies |
| Fire | Wear reaching a threshold; Spread to neighbours |
| Security and bandits | Need (safety); Act (take, bar, join) |
| Grievance and unrest | Learn (memory of harm); Spread (anger); Act (take, join) |
| Migration | Flow of people |
| Devotion and superstition | Need (salvation); Spread of beliefs and fears |
| Offices and corruption | Claims over flows; Act (take) under pressure |
| Rumour and expectation | Spread; Learn |
| Rules and law | Claim: decisions by powers |

The formulas the earlier versions gave for prices, unrest, grievance, devotion and regional sickness are withdrawn. They remain useful as rough expectations: if grain a tenth short does not come to cost about a third more, the households' trading is probably wrong.

## The week

Every week runs the same phases in the same order. The same seed with the same rulings always gives the same realm.

### A. Dawn: the audience

1. Households that asked the regent last week, and were not heard, are waiting. Those the regent gave his word to are seated first, the rest by urgency.
2. Each petition's chain of causes and its options are drawn up.

### B. The hearings

3. The player rules on up to three petitions, or four for 2 standing.
4. Rulings take effect at once, as elementary acts by the regent, and each leaves a rule.

### C. The week passes

5. **Forcing.** The weather draw; the river; the world abroad.
6. **Make.** Every thing in use turns inputs into outputs.
7. **Wear.** Things, soil, bodies, claims and trust wear or are mended; what passes its soundness fails.
8. **Flow.** Water, carts and people move where the difference pays.
9. **Trade.** Households meet in their markets; prices are whatever they deal at.
10. **Need.** Everyone uses what they have; cover is read for each need.
11. **Spread.** Sickness, fire, news, fear, anger and practices pass along ties.
12. **Claim.** Things whose claims exceed what they can bear are in conflict.
13. **Act.** Every household takes its act. Lesser powers answer what was asked of them, by their rules. What only the regent can answer joins next week's audience.
14. **Learn.** Memories and beliefs are updated.

### D. Dusk

15. Promises due are kept or broken.
16. Harm traced to the court is tallied; standing is settled.
17. The ledger is written, and the recognisers read the week and write the record.
18. The reign ends when the king returns, or when standing reaches 0.

Within a phase, every household reads the state as it stood when the phase began, so the order in which households are processed cannot matter.

### Scales of time

| Pace | What moves at it |
| --- | --- |
| The week | Weather, dealings, sickness, quarrels, the docket |
| The season | Sowing and harvest, the hungry gap, building, raiding |
| The year | Soil, rents and dues, a herd rebuilt, a debt run its course |
| Several years | A feud, a child coming of age, a work built or left to fall |
| A generation | Lines, custom, the standing of a house |

A reign of three or four years lets the player live through the first four. The history before the reign supplies the fifth.

## Randomness: the boundary rule

Chance enters only where the world beyond the realm touches it, and once in the making of each person and thing. Inside the realm, every outcome follows from state.

| Draw | When | What it decides | Odds shaped by |
| --- | --- | --- | --- |
| The founding | Once, from the seed | The realm a generation before the reign | Nothing |
| Weather | Weekly: the realm, each region, each parish | The anomalies of temperature and rain | Nothing |
| Thresholds | Once for each person at birth and each thing at its making | Constitution, temper, credulity; a thing's soundness | Nothing |
| Pestilence | Weekly | Whether a carrier comes ashore | Ships in port, sickness abroad, quarantine |
| Raiders | Weekly in season | Whether a band crosses the border, and its size | The wall, the garrison, disorder |
| Prices abroad | Monthly | The drift of the outside market | Nothing |

No law may draw. Exact ties break by a fixed order.

Every number comes from a hash of the seed, the channel, the place and the week, so adding a channel never shifts another's numbers. The sky is identical in every future of a seed, whatever the court rules. Rulings change the state, and so change the odds the same number has to beat.

### Why this still surprises

A realm with no dice inside it is still unpredictable. Thousands of households with different thresholds, acting on partial knowledge and copying one another, magnify small differences. One ruling early in a reign can leave a different realm two years on.

This is deliberate. It means that a player's choices matter in ways nobody could have tabulated, and that replaying a seed with one ruling changed is a different game.

### What the player is shown

- **Never the drawn future.** Previews assume the season's expected weather and no boundary events.
- **Expectation with doubt.** A preview runs a handful of futures and says how far they agree. "The steward expects bread to ease; he is not sure of it."
- **The almanac.** The season's baseline and the run of the weather so far.

## From the realm to the docket

A petition is the act of asking, directed at the regent. Nothing generates petitions; households choose to bring them.

### An obstacle and a power

A household under pressure looks along the chain of causes behind its binding need, as its own ledger records them. Each link is an obstacle: a thing that failed, a person who took, a claim that blocks, a rule that forbids, a promise falling due.

For each obstacle there is a power that could remove it. If that power is the household itself, it acts. If it is a neighbour, it bargains, takes or bars. If it is a lord, a priest or a borough, it asks them.

It asks the regent when the regent is the lowest power that can act, when a lower power has refused or is itself the other party, or when it has learned that the regent grants such things.

### The chain and the cuts

A petition is shown as its chain of causes, and each option is a place where the court could cut it.

Take a household whose chain runs: a frost in the ninth week, a short barley crop, seed sold to meet a debt, the rest of the debt falling due at Michaelmas, a plough team pledged against it.

| Cut at | The court would | Who bears it |
| --- | --- | --- |
| The debt's day | Order the creditor to wait | The creditor |
| The pledge | Forbid the taking of plough beasts for debt | Every lender, from now on |
| The seed | Lend seed from the granary | The Crown, and whoever wanted that seed next |
| The crop | Nothing: it is past | No one |
| The household | Deny, and let the pledge be taken | The household |

The petitioner asks for the cut it believes most likely to be granted. The alternatives are the other cuts. Because chains differ, the options differ, and no list of asks exists anywhere in the rules.

Each cut is one of the elementary acts, done by the regent: give, take, promise, bar, or a decision between claims.

### One voice for many

When many households share an obstacle and are tied to one another, they join, and the one among them with the most esteem speaks. The audience then shows forty families of one parish, not forty cards.

### Two sides

When the obstacle is another household's claim or act, that household answers. The card shows both pleas, each composed from that side's own ledger.

A plea states what the pleader believes and wants believed. It can be partial. An inquest spends a hearing and shows the ledger.

### The audience

Urgency combines pressure, how near the threat is, how long the petitioner has waited, and how many they speak for. The six most urgent are seated, after any to whom the regent has given his word.

A petition left unheard returns, more pressing. After a few weeks the household gives up, takes whatever other act it can, and thinks less of the court.

### One case, traced

1. **Twenty years before the reign.** A lord builds a mill at Ashford. An earlier regent holds that his tenants must grind there. That holding is a rule, and the manor court has applied it since.
2. **Year 1, week 19.** A dry summer lowers the stream. The miller raises his dam; by the law of claims, the mill's pond and the meadow below can no longer both be served.
3. **Week 22.** The meadow is held in dower by the widow Agnes Thorne. Her hay fails.
4. **Week 40.** With no fodder she must sell her oxen. Her stepson, whose own binding need is land, offers to buy them.
5. **The petition.** She asks the manor court first. The lord is the other party, so it finds for the mill. She asks the regent: lower the dam. The lord answers that his right rests on a regent's own holding, and that a parish must have bread.
6. **The cuts.** Lower the dam; make the lord supply hay; forbid the sale of plough beasts under such need; or deny.
7. **Afterwards.** Hold for the mill, and manor courts along the whole river apply it. Three more meadows dry out next summer, and none of those cases reaches the regent. Hold for the meadow, and every lord with a mill doubts his pond, and some begin to buy the meadows below them.

None of it was written, and step 7 was not foreseen by anyone, including the author of the laws.

## Rulings

A ruling is one or more elementary acts done by the regent, and a rule that records what was decided. It reaches the future through the same laws as everything else.

### What a ruling leaves behind

| A ruling that | Leaves in the realm | Which then |
| --- | --- | --- |
| Decides between claims | A rule, and a stronger and a weaker claim | Is applied below, relied on, stretched and challenged |
| Gives from the Crown | A granary or purse that much emptier | Is short when next wanted |
| Lends or defers | A debt and a day | Falls due in a year nobody foresaw |
| Grants a right | A new claim | Meets other claims on the same thing |
| Appoints | A household holding an office, with needs of its own | Serves, takes, quarrels, dies |
| Forbids or permits an act | A rule binding everyone it names | Changes what households find worth doing |
| Gives the regent's word | A promise | Is kept or broken in public |

By the second year, much of the docket should be the player's own earlier rulings coming back in forms the player did not expect.

### The law, written by play

A rule records the kinds of claim that met, the kind of thing they met over, the circumstance, and which prevailed. Lesser powers then decide like cases the same way, without the regent.

So the realm's law differs in every reign, and it is the player's own. One regent's realm protects plough beasts from creditors and has cautious lenders and little credit. Another's enforces every bond and has ready credit and many landless men.

What earlier versions called laws are the same thing. An assize of bread is a rule that bars trading above a price. Its consequences are whatever households then do.

Reversing a rule is allowed and costs what it costs: every household that acted on the old rule has been harmed, and remembers.

### Nothing is free

Every grant comes out of something particular. Grain comes from a granary that stands in one parish and will be empty when next wanted. A due remitted is pay the garrison does not get. A right given to one house is use taken from another.

The first build failed here. A court that granted every ask kept more reigns than a careful one.

### Harm and standing

Balance is left to the realm, with one exception: how harm compares with the court's standing. That is a single table.

A household holds a grievance against the court for harm that its own ledger traces to a ruling, a petition left unheard, or a word broken. Hardship the court had no hand in makes people angry, but not at the court.

| Harm a household traces to the court | Counts as |
| --- | --- |
| A week with a need unmet | 1 |
| A thing it lived by, lost | 20 |
| A claim taken away | 30, more for an old one |
| A death in the household | 60 |
| Left unheard in urgent need | 5 a week |
| The regent's word to it broken | 50 |
| A rule it relied on, reversed | 15 |
| A wrong done to it left unanswered | 10 |

Grievance spreads along ties like any other state, so those tied to a wronged household come to share it. When enough tied households hold enough of it, they are a faction, and a faction that reaches a fixed share of the realm breaches confidence.

Standing falls by the weight of the faction, and factions are whatever forms: the kin of one house, the millers of a river, a parish, an estate. The numbers are first guesses. The point is that there is one table, and nothing else is tuned to make the game hard or easy.

## What the player sees

The player sees the realm as a regent would, with one addition: any outcome, once it has happened, can be followed back link by link.

| View | Shows |
| --- | --- |
| The audience | Who waits, for how many they speak, and how pressed they are |
| A hearing | The chain of causes, the pleas of each side, and the cuts on offer |
| The record | What the recognisers read in the week: a riot, a default, a death, a holding applied |
| A household, a place, a thing, a claim | Its history, its ties, who depends on it, and every ruling that touched it |
| The rolls of law | Every rule the regent has made, and where lesser courts have applied it |
| The almanac and the markets | The run of the weather; what goods fetch in each market |
| The steward's ledger | Any sum over the realm, and the households behind it |

The chain is the main aid to judgment. A numeric forecast is offered beside it, stated with its doubt.

The current game's visual language carries over: cards, pips, plates, seals and tiles.

Whether the player sees the true ledger or only what officers report is still to be decided. The ledger is built first, because development needs it.

## Words from the machinery

Every word is composed from the nouns and laws that produced the thing spoken of. No text belongs to a situation.

| Ingredient | Comes from |
| --- | --- |
| The cause | The links of the chain: "the dam was raised in the dry weeks" |
| The need | Which need binds: bread, fuel, right, honour |
| The act asked | The cut, in exact terms: "until Lady Day"; "forty bushels" |
| The tie | The pleader's relation to the other party: "my husband's son" |
| Voice | The pleader's estate and trade |
| Place and season | The parish, its land and water, the week |
| Strain | Pressure, from measured complaint to despair |
| Memory | What the regent, or his rule, did to this household before |

Clauses are keyed to laws and kinds of noun: one for a thing failing, one for a claim crossed, one for a promise due. None is keyed to a mill, a widow or a dam.

The recognisers supply the record's vocabulary, and they are the only place where words like "riot" and "famine" are allowed.

If a plea reads thin, the fix is a richer chain, not another template.

## Validation

The realm is judged by general properties, measured by machine over many reigns. It is not judged by whether particular stories occur.

### Invariants

- **Determinism.** The same seed and rulings give the same state every week; a replay is exact.
- **Conservation.** Goods, coin and people appear or vanish only through named processes.
- **Designated chance.** A test fails if anything draws outside its channel.
- **Bounds.** No negative stocks; every ratio in range.
- **No event in the rules.** A test searches the laws for the recognisers' vocabulary and fails if it finds any.

### Measures of emergence

A shape is a petition's binding need, the kind of obstacle, the kind of cut asked, and the kind of object. The baseline is the first build over 30 reigns.

| Property | Measure | First build | Wanted |
| --- | --- | --- | --- |
| Variety | Petitions repeating a shape seen in the last 26 weeks | 79% | Under 35% |
| Variety | The five commonest shapes together | 51% | Under 25% |
| Novelty that lasts | New shapes appearing in each later year of a reign | Not measured | Still arriving in year three |
| Unforeseen | Chains of causes found in no other of 100 reigns | Not measured | Most |
| Answering to the player | Petitions after year one whose chain includes a ruling | Not measured | A third or more |
| Answering to the player | One ruling changed: how much of the docket differs a year on | Not measured | A tenth or more |
| Neither frozen nor chaotic | The same, a month on | Not measured | Little |
| Every noun has a mouth | Kinds of thing, tie and claim that appear in some petition | Few | Nearly all |
| Scale-free trouble | Sizes of what the recognisers find: riots, defaults, outbreaks | Not measured | Many small, a few very large |
| Nobody is an average | Spread of fortunes among like households in one parish | None | Wide |

Two of these need a word.

A realm that is frozen ignores the player: change a ruling and nothing differs. A realm that is chaotic ignores the player in another way: everything differs at once, so no choice can be reasoned about. The wanted state lies between, where one ruling changes little next month and a good deal next year.

Trouble that comes in all sizes is the usual mark of a system in that state. If every riot is about the same size, something is forcing them.

### The prediction log

Before each batch, the designer and the builder each write down the ten commonest petitions and the three largest events they expect. Afterwards the lists are compared with what happened.

If the lists are mostly right, the realm is still foreseeable, and goal 2 is not met. This is the only test of unforeseeability there can be, and it is cheap.

### Sanity patterns

The earlier versions listed patterns to tune toward: a bread riot, a blight year, a levee breach. These are kept only as a check that familiar things remain possible. Each should be recognised sometimes and never always. None has a target.

### Scripted courts

| Court | Plays by | Should show |
| --- | --- | --- |
| Null | Hearing no one | The realm running on lesser courts alone, and wearing the regent's standing down |
| Naive | Granting every ask | Relief now; an empty purse and a tangle of rules later |
| Random | Choosing at random | A baseline |
| Consistent | Always deciding like cases alike | A realm that settles, and a docket that moves on |
| Careful | Reading the chain and cutting where least is lost | The best results |

The careful court must keep the realm clearly more often than the naive one. If it does not, something is free.

### Performance

With 2,800 households a week should tick in 20 ms or less, so a 200-week reign runs in about four seconds and a hundred reigns in seven minutes. A preview of a few futures over four weeks then takes under a second, in a worker.

## Architecture

The simulation is a pure function from a state and a week's rulings to the next state. The screen, the previews and the batch runs all call that one function.

```ts
step(state: State, rulings: Ruling[]): State        // pure and deterministic
petitions(state: State): Petition[]                  // this dawn's audience
forecast(state: State, ruling: Ruling, weeks: number): Forecast
explain(state: State, ref: Ref): Link[]              // the chain behind anything
recognise(before: State, after: State): Event[]      // reads; never writes state
```

| Principle | In practice |
| --- | --- |
| Laws are code; nouns are data | Eight modules for the laws. Goods, things, ties and claims are tables that can grow without touching a law |
| Laws do not know their nouns | No law may test for a particular row. A law that says "if mill" is a bug |
| Recognisers are apart | They read states and write the record. The laws never import them |
| A pure step | No globals, no clock, no `Math.random` |
| One source of chance | `draw(seed, channel, place, week)` |
| State as tables | Households and things in flat arrays, so a state of thousands copies in a millisecond |
| Read old, write new | Each phase reads the state as it began |
| A chain for everything | Every change records what caused it; `explain` walks back |
| The same maths everywhere | The project's own `exp`, `log` and `pow` |

```
realm/
  sim/
    laws/        need, make, wear, flow, spread, act, claim, learn
    nouns/       goods, things, ties, claims, powers  (data)
    forcing/     weather, river, abroad
    court/       petitions, rulings, rules, harm, standing
    found.ts     the founding and the history before the reign
    ledger.ts    chains and explain()
    step.ts      the week
  read/          recognisers
  words/         the composer
  harness/       scripted courts, the measures, the prediction log
  ui/            the screen
```

TypeScript, Node's own test runner and esbuild, as in the first build.

## Extending the realm

The realm is never finished. It grows by nouns, which are cheap, and almost never by laws, which are not.

### Adding a noun

A new good, thing, tie or claim is a row. It must pass five tests.

1. **A warrant.** It fills a gap the measures show, or follows a documented medieval practice.
2. **It fits the shape.** It is a row in an existing table, with no rule of its own.
3. **It meets something.** At least one existing noun can make it, use it, claim it or collide with it.
4. **A mouth.** It can reach the docket as a new shape of case, and the measures move after it lands.
5. **Old saves still load.**

### Adding a law

A ninth law needs a behaviour that the eight cannot produce from any noun, shown by trying. It must apply to more than one kind of noun, or it is a special case in disguise.

### What may never be added

- **An event,** or any rule that fires because a table or a timer chose it.
- **A category of happening** in the rules: a famine, a riot, a feud.
- **A list of situations** under another name: aims, crimes, quarrels, remedies.
- **Text written for a situation.**
- **Chance outside the boundary.**
- **A recogniser that changes the state.**

### Nouns worth adding first

These documented practices are all rows in the tables above, and each brings its own cases.

| Noun | Kind | What it brings |
| --- | --- | --- |
| Suit of mill | Claim over others' use of a thing | Millers with power; tenants who grind at home in secret |
| Heriot, merchet, wardship | Claims falling due at a death or a marriage | Heirs as wards; marriages bargained over |
| Common rights and forest law | Claims on pasture, wood and game | Stints, enclosure, poaching |
| The tithing | A tie of fellowship that answers for its members | Reasons to accuse and reasons to conceal |
| Sanctuary and benefit of clergy | A claim of the church to judge | Justice split between two powers |
| A borough charter | A claim to self-rule, bought from a lord | Towns against lords over tolls |
| Guilds | Fellowship with a claim over a trade | Masters against journeymen and strangers |
| Fairs | A market held once a year | Trade, crowds and sickness in one place |
| Purveyance | The Crown's claim to take provisions at its own price | A hated taking |
| Salt, fuel and iron | Goods | Winters that are about wood; years when meat cannot be kept |
| The fasting calendar | A rule of the church about what may be eaten when | Fish and meat in season; devotion made visible |
| Relics and pilgrimage | A thing that draws people | Trade, alms and sickness along one road |

## Build plan

Start small and watch. The laws are few enough to build quickly on a toy realm, and it is the watching that shows what is missing.

### What carries over from `realm/`

| Kept | Rebuilt |
| --- | --- |
| The pure step, the draws, exact replay | State, as tables of thousands |
| The causal ledger | Chains kept for every household |
| The weather, river and crop growth | The same, with a term for each parish |
| The composer's method | Its clauses, keyed to laws and nouns |
| The harness and invariants | The measures of emergence |
| The screen's language | Its pages |

The first build's households, markets, society, sickness and petition generator are set aside.

### Stages

| Stage | Builds | Done when |
| --- | --- | --- |
| S1 A toy realm | The eight laws; 300 households in 6 parishes; a dozen goods and kinds of thing; the forcing | Thirty years run with no court; prices, shortages and quarrels appear that no rule names |
| S2 Readers | Recognisers, the chronicle, the measures, the prediction log | The chronicle reads as a history, and its authors' predictions are mostly wrong |
| S3 The full realm | 2,800 households, 40 parishes, the full tables; a generation of history at the founding | Two seeds open on visibly different realms; a week ticks in 20 ms |
| S4 Powers | Lords, church and borough deciding by rule | Most conflicts are settled below the regent, and differently in different manors |
| S5 The court | Petitions as chains and cuts, two sides, rulings as rules, harm, factions, standing | A playable reign of three years; the careful court beats the naive one |
| S6 The screen | Hearings with chains, pages for households, places, things and claims, the rolls of law | A tester can say why a case arose and which ruling it came from |
| S7 Fuller | More nouns from the list above, each through the five tests | The measures reach their wanted values |
| S8 The measure of harm | The one table | Reigns are winnable and losable, and differ |

### Working habits

- **Watch before adding.** After every change, run thirty years and read the chronicle.
- **Keep the prediction log** from S2 onward.
- **When the realm is flat, add a noun that meets something.** When it explodes, look for something that is free.
- **Never fix a dull stretch with a rule about that stretch.**
- **Leave difficulty alone until S8.**
- **Keep the current game playable throughout.**

## Decisions to make

Settled so far, by the designer or by the first build:

| Decision | Settled as |
| --- | --- |
| The aim | Emergence in the sense of complex systems: outcomes nobody listed |
| Reign length | Three or four years |
| Balance | A back seat: one table of harm, tuned last |
| Scale | About 14,000 souls |
| The Crown's purse and granary | Both kept, as particular things in particular places |
| Language and place | TypeScript, in `realm/` |

Still open. Each has a recommendation, and none blocks S1 or S2.

| Decision | Options | Recommendation |
| --- | --- | --- |
| Every household, or some | All 2,800 simulated alike; or a few hundred in full and the rest summed | All of them. The first build's summed cohorts were the main cause of its monotony |
| Standing by faction or by estate | Factions as they form; or the eighteen fixed constituencies of the current game | Factions. Fall back to estates only if factions prove illegible in play |
| Maxims | Keep the eight named maxims as labels; or let rules stand unnamed | Let rules be whatever play makes them, and let the composer name each from its terms |
| Three years or four | A fixed length; or a return that moves with events abroad | Three to start |
| The pace of play | Three hearings every week; or quiet weeks passing at a touch | Weekly, but a week with nobody waiting closes itself |
| How long a history | Ten years, a generation, or a century | A generation, at a coarse step |
| How far a plea may shade the truth | True; partial; false | Partial, never false, until play shows doubt is enjoyed |
| The ledger or the regent's view | Which is the default way to play | The ledger during development; decide after S6 |
| How large the toy realm | 100, 300 or 1,000 households | 300: large enough for cascades, small enough to read |

## Appendix

### Lessons from the `realm/` build

1. **Caused is not the same as emergent.** Every event had a cause, and a reign still showed about 17 shapes of petition, 79% of them repeats.
2. **Averages make no cases.** Eighteen cohorts behaved smoothly, and households built as copies of them had no troubles of their own.
3. **One number hides everything.** Frost, murrain, a raid and a debt all became weeks of cover, then one of four asks.
4. **A computed price cannot surprise.** Nor can a computed mood. What is given by a formula is foreseen by whoever wrote it.
5. **Lists are scripts.** A list of asks, of aims or of remedies decides in advance what can happen.
6. **Depth without a mouth is wasted.** Murrain and the wool clip were simulated with care and almost never reached the court.
7. **Free relief breaks the game.** A court that granted every ask kept 82% of reigns; a careful one kept 75%.
8. **A missing brake looks like a wrong number.** The realm collapsed until merchants had credit, the hungry could leave, and emptied land drew settlers. Each was a missing interaction.
9. **A history helps at once.** One year lived before the reign was enough to make openings differ.
10. **The harness finds what reading cannot.** A fever that never broke out, a pestilence seeded by mistake, and one small group causing most breaches each showed as a number first.

### Lessons from the `core/` prototype

1. **A closed vocabulary works.** A few motives, means and payers produced recognisable situations with none written by hand.
2. **Promises must start next week.** A word tested the day it was given was always kept.
3. **The court's habits shape the results,** so every measure needs several courts.
4. **Words are thin without material causes.**

### Glossary

| Term | Meaning |
| --- | --- |
| Noun | A kind of thing the realm contains: place, household, person, thing, good, tie, claim, rule |
| Law | One of the eight rules that act on all nouns: need, make, wear, flow, spread, act, claim, learn |
| Forcing | What drives the realm from outside: the weather and the world abroad |
| Need | Something a household must have; needs do not stand in for one another |
| Binding need | The scarcest need, which sets a household's pressure and what it will act on |
| Pressure | A household's strain on its binding need: 0 to 8; pressing at 2, urgent at 4 |
| Threshold | A level, fixed at birth or making, past which a person or thing changes state |
| Tie | A link between two households: kin, neighbour, service, debt, trust, grudge, fellowship |
| Claim | A household's right over a thing, a person or a flow |
| Conflict | Claims on one thing that it cannot all bear |
| Power | Whoever is accepted as able to decide about certain claims |
| Rule | What a power has decided, applied thereafter to like cases |
| Chain | The links of cause behind a household's condition |
| Cut | A place in a chain where the court could act; an option |
| Recogniser | A reader that names what happened, and cannot change the state |
| Faction | Tied households holding the same grievance |
| Shape | A petition's binding need, obstacle, cut and object; the unit of the measures |
| Mouth | A noun's path to the docket |
| Audience | The petitioners waiting this week, about six |
| Standing | The court's confidence, 10 seals; at 0 the reign falls |
| Designated draw | One of the few places where chance enters |
| Ration | One adult's food for a week |
