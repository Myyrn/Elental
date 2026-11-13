# Kernel & Engine — Specification

Status: first spec pass (2026-11-03); **trimmed 2026-11-12**: the action system, Allocation Dial, claims, gating, Decision Log, Scheduler, pipeline and Preflight (old §3, §5, §8–§12) moved to `actions__spec.md`. What remains are the shared kernel primitives. They have no kb file of their own yet; their continuity bootstrap (kb ↔ spec mirror) is pending with `cross_module_notes__kb.md`. Section numbers are kept stable so existing references hold. Source: `internal_politics__kb.md` (scope syntax, stacks), `cross_module_notes__kb.md` (caching, skin/skeleton). **(spec decision)** marks anything the kb does not state.

## Data Structures

### 1. Keys and Scope (`kernel/ids.js`, `kernel/scope.js`)

```js
/** @typedef {string} Id */                       // 'nation:vantir', 'prov:12,7' ...
/** @typedef {string} CellKey */                  // `${nation}|${estate}|${region}`
const cellKey = (n, e, r) => `${n}|${e}|${r}`
const parseCellKey = k => { const [nation, estate, region] = k.split('|'); return {nation, estate, region} }

/** Shared scope syntax: Rights/Duties, Requisition, Control, Observation, UI Scope. */
/** @typedef {{kind:'cell',nation,estate,region}
 *          | {kind:'nationRegion',nation,region} | {kind:'estateRegion',estate,region}
 *          | {kind:'estate',estate} | {kind:'nation',nation} | {kind:'region',region}
 *          | {kind:'empire'}} Scope */
/** Allocation-local only (not part of the shared syntax): */
/** @typedef {{kind:'group', cells:CellKey[]}} GroupTarget */

function covers(scope, key, ctx)                  // is the cell inside the scope? ('empire' = same Country as ctx.country)
function cellsCovered(scope, ctx): CellKey[]      // expansion used by every per-cell dial
function specificity(scope): 3|2|1|0              // cell=3; nationRegion/estateRegion=2; estate/nation/region=1; empire=0

/** Rights/Duties are STATES: most specific scope wins. Control/Requisition are AMOUNTS: stack additively. */
function resolveState(entries /* {scope, value, declaredTurn} */, key, ctx) {
  const hits = entries.filter(e => covers(e.scope, key, ctx))
  if (!hits.length) return undefined                           // silence = "allowed (default)"
  const top = max(hits.map(h => specificity(h.scope)))
  return hits.filter(h => specificity(h.scope) === top)
             .sort(byDeclaredTurnDesc)[0].value                // ASSUME: ties (e.g. Estate vs Nation) -> latest declared wins
}
const resolveAmount = (entries, key, ctx) => sum(entries.filter(e => covers(e.scope, key, ctx)).map(e => e.amount))
```

### 2. ModifierStack (`kernel/modifiers.js`) — the one shape behind Prestige, Opinion, Preference, Sympathy, Portrait, Cell Preference, entitlement-loss, Reputational Leverage

```js
/** @typedef {{id:Id, value:number, decay:DecayRef, turn:number, source?:string /*Decision Log id*/ }} Mod
 *  @typedef {{baseline:number, mods:Mod[], lo?:number, hi?:number}} ModifierStack
 *  @typedef {{kind:'exp', rateKey:string} | {kind:'linear', stepKey:string} | {kind:'none'}
 *          | {kind:'ctx', fn:string}} DecayRef   // 'ctx': rate read from CURRENT state each turn (entitlement-loss; never from crisis age)
 */
const value = s => clamp(s.baseline + sum(s.mods.map(m => m.value)), s.lo ?? -Infinity, s.hi ?? Infinity)   // derived on read
function tick(s, ctx) { for (m of s.mods) m.value *= (1 - rateOf(m.decay, ctx, m)); s.mods = s.mods.filter(m => abs(m.value) > ctx.T('eps.modifier')) }
function push(s, mod) { s.mods.push(mod) }       // no spend(): stacks are never currencies
```
There is intentionally **no `spend`/`subtract` API** (cross-module Rule 2).

### 3. AllocationDial — moved to `actions__spec.md` (Allocation Dial).

### 4. ThresholdMeter (`kernel/threshold.js`)

```js
function threshold(actionType, tier, target, ctx) {
  return ctx.T(`thresholds.${actionType.id}.${tier}`) * actionType.targetScale(ctx, target)   // every type DECLARES targetScale (Diplomacy Rule 20)
}
function applyThreshold(committed, th) { return committed >= th ? {met:true, effect:'full'} : {met:false, effect:'none', refunded:false} }  // binary, no extra benefit, no refund
```
Validator test: an `ActionType` with a threshold and no `targetScale` fails registry load (`ActionRegistry.register` throws for `thresholdBound` types; `threshold()` throws without `targetScale`).

### 5. Claims — moved to `actions__spec.md` (Lifecycle classes).

### 6. Stance skeleton (`kernel/stance.js`) — the shared "skin/skeleton" mechanic

```js
const stance = (party, proposal, ctx, {selfInterest, modifier}) =>
  selfInterest(party, proposal, ctx) * modifier(party, proposal, ctx)     // material self-interest x (Preference alignment | relationship history)
const approves = (s, ctx) => s >= ctx.T('stance.approve')
```
Reused by: gating (Veto/Council cells), Administration Actor-cell negotiation, Diplomacy ratification, War Peace Conference, cell action choice, Veto-to-declare/continue war. Distinct selfInterest/modifier functions per module; UI never names the shared shape (UI Rule 13).

### 7. GameState root

```plantuml
@startuml
title GameState (all plain JSON; records keyed by id)
class GameState {
  meta: {turn, scenarioId, rulesetVersion, rng}
  pending: PendingEffect[]
  commitments: Commitment[]
}
class WorldSlice { provinces: Record<Id,Province>\nedges: Edge[]\nregionSnapshot @cache: Record<Id,Id> }
class NationsSlice { presence: Record<provId, Record<nationId,number>> }
class CountriesSlice { countries: Record<Id,Country>\nrelations: Record<pairKey,RelationState>\ndependencies: Dependency[]\nconfederations: Confederation[] }
class EconomySlice { warehouses: Record<provId,Warehouse>\ntradeInfra: Record<provId,number>\nobligations: Obligation[]\ncoinage: {supply, issuers: Record<Id,Fineness>}\nland: Record<provId,LandShare[]> }
class PolitySlice { cells: Record<CellKey,Cell>\nmomentum @cache: Record<"cell|need",number>\nlog: LogEntry[] }
class AdminSlice { governments: Record<countryId,Government> }
class WarSlice { units: Record<Id,Unit>\narmies: Record<Id,Army>\ngarrisons: Record<provId,Garrison>\nwars: War[]\nscore: WarScoreEntry[]\noccupations: Record<CellKey,Occupation> }
class DiplomacySlice { treaties: Treaty[]\ncbs: CB[]\nleverage: Record<pairKey,ModifierStack>\ncovert: CovertOp[]\ngrants: FacilitationGrant[] }
GameState *-- WorldSlice
GameState *-- NationsSlice
GameState *-- CountriesSlice
GameState *-- EconomySlice
GameState *-- PolitySlice
GameState *-- AdminSlice
GameState *-- WarSlice
GameState *-- DiplomacySlice
@enduml
```
Slice field details: `modules__spec.md`. `Commitment` and `PendingEffect` shapes: `actions__spec.md`.

### 8–12. Action system, Gating, Decision Log, Scheduler, Engine API and turn pipeline — moved to `actions__spec.md`.

### 13. EngineClient protocol (`client/engineClient.js`)

```js
class EngineClient {                                  // identical API for Worker or main thread
  async init({scenarioPackage | saveGame})            // validates package, builds state
  async query(name, args, viewer)                     // -> {value, stamp:'live'|'stale'|'estimated'|'unknown', asOfTurn}
  async setOrders(orders); async getOrders()
  async preview(orders)                               // -> Preview (observation-bounded)
  async preflight()                                   // -> Warning[]
  async endTurn()                                     // -> TurnReport
  async listActions(actor)                            // -> ActionType descriptors available to this actor
  async save() / load(snapshot)                       // JSON snapshot, IndexedDB by saveGames.js
  async rawObject(path)                               // Debug Mode "View Raw": the exact live object
}
// query names map 1:1 to module `derive` exports: 'polity.cellCard', 'economy.price', 'world.lens', ...
// visibility stamp computed by engine from committed Observation (inside the Country) or detection (abroad); unknown is never guessed.
```
Code today (`src/client/engineClient.js`, main-thread only): `init(pkg, baseRuleset)`, `submit(order)`, `clearOrders()`, `removeOrder(id)`, `endTurn()`, `runTurns(n)`, `query(name, args)` (plain JSON, no `stamp`). Missing: `setOrders/getOrders` (replaced by `submit/...`), `preview`, `preflight`, `listActions`, `save/load`, `rawObject`, the stamp.

## Rules

6. ModifierStack has no spend API; caches are tagged and re-derivable.
8. Every threshold-bound action type declares `targetScale`; below threshold nothing happens and nothing is refunded.
10. UI never receives an `unknown` readout filled with a guess; the stamp is part of every political/covert/foreign query result.

Rules 1–5, 7 and 9 (action classes, simultaneous planning, gating, Decision Log, Allocation Dial, randomness, Scheduler) moved to `actions__spec.md` Rules.

## Cross-references
- `actions__spec.md` — action system, pipeline, gating, Allocation Dial, claims, Scheduler.
- `modules__spec.md` — implements `steps[n]`, `derive`, `actionTypes` per module.
- `scenario_editor__spec.md` — `ruleset.tuning` supplies every `ctx.T(...)`; `thresholds.*` table.
- `ui__kb.md` — Orders tray, Preflight, Event Draft consume `preview`/`preflight`.

## Status
- Primitives (Scope, ModifierStack, ThresholdMeter, Stance, GameState root): tests in `tests/kernel.test.js`; scope tie-break (Estate vs Nation at equal specificity → latest declared) is now tested, so open item (b) below is effectively settled by code, pending your OK.
- **(spec decision)**: tie-break for equal-specificity scopes = latest declared; query/stamp wire format.
- **Open (needs your call)**: (b) equal-specificity scope tie-break confirmation; (c) the common unit of `grievance_bucket_severity` and `compliance` — the kb compares them directly, so the spec needs one scale (proposed: both normalised 0..1 per cell, factor in Ruleset.tuning). Open item (a), covert concealment tier storage, moved to `actions__spec.md` Status.
- **Pending**: kb ↔ spec mirror and `Sync:` block for these primitives once their kb home is decided (candidates: `cross_module_notes__kb.md`, `internal_politics__kb.md` for scope syntax).
