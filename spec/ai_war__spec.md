# AI — War — Specification

KB: `kb/ai_war__kb.md`. Mirror of its `##/###` headings; cross-references live in kb only. Sources besides kb: `src/modules/ai/simpleWar.js`, `src/modules/war/actions.js`. Items tagged **(spec decision)** are listed under Status.

## Data Structures

### Principles
Code: `src/modules/ai/aiWar.js`
- Orders only through registered War actions (`fieldUnits`, `orderMove`, `setTactic`, `declareWar`), same envelope and validation as the player (`actions__kb.md`). No private state, no hidden numbers.
- Deterministic; no stored state. Enabled together with AI-Diplomacy: `ruleset.aiDiplomacy.enabled === true`, wired in `ai/index.js`.
- Every Contingent is Balanced in alpha; no stance order is ever emitted.

### Inputs (read-only)
Code: `src/modules/ai/aiWar.js`
```
aiWarOrders(ctx) -> orders[]      // same shape as simpleWarOrders
campaigns(A) = ctx.state.ai.diplomacy.campaigns[A]   // previous turn's cache: { target, type, since }
HOSTILE = ['Provoke', 'Strike', 'Squeeze']           // hostile(type) = HOSTILE.includes(type)
```
War state, armies, border provinces and free Army labour per cell come from ordinary War / World Map readouts; nothing is cached by AI-War.

### Reserved interface (post-alpha)
Code: none (reserved; no file yet)
```
stancePolicy(contingent, army, campaign, war) -> stance   // owned by AI-War; alpha: constant 'Balanced', not called
```

## Rules
Code: `src/modules/ai/aiWar.js` (Rules 1, 3), `src/modules/ai/simpleWar.js` (Rule 2, unchanged)
1. **Pre-war deployment.** For each non-player Country with no army and a hostile Campaign toward a Country it is not at war with: take the first own province adjacent to a province owned by the target (sorted by id); take the most populous peasant cell of that province's Region; emit `fieldUnits {originCell, composition: {'Shock Infantry': floor(0.3 × free labour)}, at}`. Emitted only if the registered `fieldUnits` validation passes (goods, labour, cap). Show of Force is derived from the positioned army (`war__kb.md`); no separate order. The "no army" guard is a **(spec decision)**.
2. **Army handling at war** is `simpleWar.js` unchanged: raise one army near the enemy border if none exists; idle armies march on the nearest enemy army, else the nearest enemy province. Because Rule 1 leaves the Country with an army, `simpleWar` raises no second one.
3. **Tactic.** For each own army: want `aggressive` when a Strike Campaign targets a Country currently at war with the owner, else `balanced`; emit `setTactic {armyId, tactic}` only if it differs from the army's current tactic. Per army now; per detachment once `war__kb.md` Rule 26 exists in code, same rule.
4. **Composition.** Rule 1's single composition is what the cell can give. Default sorting template (20/60/20) is applied by War's own sorting once it exists; the AI never reassigns Contingents. Not in code.
5. **Merge / Split.** No AI orders; `mergeArmies` / `splitArmy` stay player-only. Nothing to implement.
6. **Reinforcement.** Automatic in War once implemented; the AI emits no order for it. Nothing to implement.
7. **War declaration.** Owned by AI-Diplomacy (Strike Campaign → Declare War, goals proportionate to the CB; see `ai_diplomacy__spec.md`). AI-War emits no `declareWar`.
8. **Peace.** No peace proposals in alpha; no hook.

## Status
- **Implemented**: Rules 1–3. Tests: `tests/ai_war.test.js` not written. Rules 4–8 are "nothing to implement" until War composition lands.
- **(spec decision)**: 0.3 labour fraction and 'peasants' cell choice copied from `simpleWar.js`; tactic is per army because Contingents and per-detachment tactics are not in code (`war__kb.md` Status: army composition spec/code outstanding); "no army" guard in Rule 1.
- **Sync:** (`<section> = <kb rev> / <code rev>`)
  - Data Structures > Principles = 1 / -
  - Data Structures > Inputs (read-only) = 1 / -
  - Data Structures > Reserved interface (post-alpha) = 1 / -
  - Rules = 1 / -
