# The primitives-only core

A headless rebuild of the game from a closed set of interrelated primitives. No situation is coded. Situations emerge when households, driven by their state, ask for combinations of primitives and the court rules.

| File | Contents |
|---|---|
| `core.js` | things, measures, relationships, bindings, tests, effects, and the week's close |
| `generator.js` | motive → means × payer → petition (ask, alternative, deny), and the general reactions to a ruling |
| `sim.js` | an automatic court, a reign runner, and the emergence checks |

Run the emergence checks:

```
node core/sim.js [reigns=200] [seed=1]
```

## The vocabulary

- **Measures:** pressure, regard, esteem, devotion, superstition, grievance, standing, need balance
- **Relationships:** kin, owes, charge, grudge (at a household, an estate or the court), esteem (estate → member), rivalry/alliance (estate ↔ estate)
- **Bindings:** word, ordinance, compact, pledge (a vow is a pledge before the church), bond, rule, law
- **Tests:** not urgent · duty met · need met · heard · attends · regard at least · present
- **Motives:** relief · redress · need · faith · sign · ambition
- **Means:** direct · shift · defer · relate
- **Payers:** the court · a duty · a household · peers · an estate · nobody

## Principles

1. Nothing is authored. If the game feels bland, add or deepen a system; never write an event.
2. The emergence checks in `sim.js` are patterns read from the record. A check that never fires points to a missing primitive or a wrong starting condition.
3. Flavour will be composed from the same primitives, never mapped from named situations.

The current game (`index.html`) is untouched by this work.
