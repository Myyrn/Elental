# AI — War — Specification

Status: first pass (2026-11-11). Source: `kb/ai_war__kb.md`, `src/modules/ai/simpleWar.js`, `src/modules/war/actions.js`. Items tagged **(spec decision)** are listed under Status.

Code: `src/modules/ai/aiWar.js` (hooks), `src/modules/ai/simpleWar.js` (unchanged army handling).

## Data Structures
```
aiWarOrders(ctx) -> orders[]      // same shape as simpleWarOrders; reads ctx.state.ai.diplomacy.campaigns (previous turn's cache)
HOSTILE = ['Provoke', 'Strike', 'Squeeze']
```
No stored state. Enabled together with AI-Diplomacy (`ruleset.aiDiplomacy.enabled === true`, via `ai/index.js`).

## Rules
1. **Deployment.** For each non-player Country with no army and a hostile Campaign toward a Country it is not at war with: choose the first own province adjacent to a province owned by the target (sorted id); take the most populous peasant cell of that province's Region; order `fieldUnits {originCell, composition:{'Shock Infantry': floor(0.3 × free labour)}, at}`. The order is emitted only if the registered `fieldUnits` validation passes (goods, labour, cap).
2. **Tactic.** For each own army: want `aggressive` when a Strike Campaign targets a Country currently at war with the owner, else `balanced`; emit `setTactic {armyId, tactic}` only if it differs from the army's current tactic.
3. **Army handling at war**: unchanged (`simpleWar.js`). Because Rule 1 leaves the Country with an army, `simpleWar` will not raise a second one.
4. Stance stays Balanced; `stancePolicy` is reserved (kb).

## Cross-references
- `ai_diplomacy__spec.md` (Campaign cache), `admin_war_diplomacy__spec.md` (war actions), kb `ai_war__kb.md`, `war__kb.md`.

## Status
- **Implemented**: Rules 1–2. Tests: `tests/ai_war.test.js` not written yet.
- **(spec decision)**: the 0.3 labour fraction and the 'peasants' cell choice are copied from `simpleWar.js`; tactic is per army because per-detachment tactics and Contingents are not in code (`war__kb.md` Status: army composition spec/code outstanding).
- **Not yet done**: war army-composition spec and code (Contingents, sorting templates, merge/split, reinforcement, per-detachment tactic, Balanced stance); AI peace proposals; tests.
