# Administration — Specification

KB: `kb/administration__kb.md`. Mirror of its `##/###` headings; cross-references live in kb only. Split out of `admin_war_diplomacy__spec.md` (§1) on 2026-11-12. Besides kb, sources: `src/modules/administration/module.js`, `src/modules/polity/actions.js` (`setControlAllocation`), `src/modules/diplomacy/covert.js` (Observation dial and detection), `tests/espionage.test.js`. Where code and the old spec disagree, **code wins** (**code-led**). Anything the kb does not state is **(spec decision)**; both are listed under Status. Sections the code has not reached are **(target)**: the administration module today holds only the Control derives (no step 6, no slate, no assembly queue).

## Data Structures

State (code today and target):
```js
state.admin.governments[country] = {
  controlDial: {entries}, observationDial: {entries}, spendingDial: {entries, reserve, sink},   // in code
  controlSupply?: number /*scenario/test override of the produced Control*/, controlBonus?: number /*coercion gains (Demotion Duty)*/,   // in code
  poolSplit: Record<pool, AllocationDial>, planningPosture: 0..1, borderPolicy, emergency: null | {magnitude, since, addresses: string[]},   // target
  attention: [{questionKey, coordinationCommitted}], upkeepFraction: 0..1, observationCache: Record<`${kind}|${target}`, {turn, value}>, inventory: Record<good, number> }   // target
```

### Control Allocation (settled; Allocation Dial semantics settled 2026-11-03)
Code: `src/modules/administration/module.js` (`derive.administration.{controlSupply, controlResult, controlGrant}`), `src/kernel/allocation.js`
```js
scopeCtx(ctx, country) = { country, cellKeys: () => cells whose Region is owned by country, cellCountry: k => regionOwner(region(k)), T: ctx.T }   // the scope helper `cellsCovered` and `resolveAllocation` expect
controlSupply(ctx, c)  = max(0, (gov.controlSupply ?? economics.produceCCO(c).control) + (gov.controlBonus ?? 0) − (derive.war.martialCost?.(c) ?? 0))   // (code-led) martial-law Control cost of held cells is subtracted
controlResult(ctx, c)  = resolveAllocation(gov.controlDial ?? {entries: []}, controlSupply(ctx, c), scopeCtx(ctx, c))                              // pure, every turn, no pipeline step
controlGrant(ctx, key) = grantFor(controlResult(ctx, regionOwner(region(key))), key)                                                             // additive stacking over covering entries
```
- Target: Requisition enforcement share is added in `controlGrant` (`+ requisitionEnforcementShare(ctx, cell)`; polity owns the Requisition Duty); `emergencyBonus` joins `controlSupply` (Emergency Powers).
- Dial shape, per-cell default, aggregate/group filters, priority/floor/surplus semantics, free reallocation: `actions__spec.md` (Allocation Dial). `involuntaryCompliance(cell) = Σ grants covering the cell` is read by polity (`derive.polity.compliance(key).involuntary`).
- Action: `setControlAllocation {entries}` (class dial, gate `administration`, public), registered in `polity/actions.js` with `module: 'administration'`; stores `{entries}` (code-led: the old `setPoolSplit` and `sink` parameters are not in it).
- **(spec decision)** group targets are allocation-local `{kind:'group', cells}` and not part of the shared scope syntax (`actions__spec.md`).

### Observation Allocation (settled 2026-11-01; detection settled 2026-11-02)
Code: `src/modules/diplomacy/covert.js` (`observationSupply`, `observationResult`, `observationAt`, `detectionStrength`, action `setObservationAllocation`), derive exports in `diplomacy/module.js`
```js
observationSupply(ctx, c) = economics.produceCCO(c).observation
observationResult(ctx, c) = resolveAllocation(gov.observationDial ?? {entries: []}, observationSupply(ctx, c), scopeCtx(ctx, c))
observationAt(ctx, c, region):                                          // committed awareness of one of the Country's own Regions
  no dial entries → T('obs.defaultSpread') × observationSupply × (population of c's cells in region) / (population of all c's cells)     // (code-led) even-by-population default
  else            → Σ grantFor(result, cell.key) over c's cells of the Region
detectionStrength(ctx, c, region) = observationAt + counterIntel(ctx, c, region)                                                         // additive; Diplomacy owns the thresholds
```
- **(code-led)** the code lives in the Diplomacy folder because detection reads it; the module id of the types is `administration`. The action `setObservationAllocation {entries}` is registered as class `event` (kb: dial, free to change): needs a fix in code, not in the kb. `gateDomain` null, public.
- Off-slate escalation visibility: the visibility stamp is derived from `observationAt` (**target**):
```js
stampFor(ctx, viewer, kind, target) =
  domestic: obs = observationAt(viewer, target); full = T('observe.liveThresholdPerPop') × population(target)
            obs ≥ full → 'live';  obs ≥ T('observe.estimateFraction') × full → 'estimated';  lastSeen(kind, target) → 'stale';  else 'unknown'
  foreign:  by Diplomacy detection / Cooperation; 'unknown' is never guessed
// every 'live' read refreshes gov.observationCache (presentation only; never read by simulation)
```
- Stamp wire format and `EngineClient.query` stamps: `actions__spec.md` (not in code).

### Question Active Slate (attention commitment — revised 2026-11-02)
Code: none (target `src/modules/administration/step.js`, pipeline step 6)
```js
step6(ctx) — slate for NEXT turn (lags one turn):
  for country of countries:
    coord  = envelopeSupply(ctx, country).coordination          // = produceCCO(c).coordination − emergencyCost(c)
    coord -= T('admin.routineOverhead') × count(routine Questions)        // continuous overhead; shortfall → routine Questions unaddressed (never removed)
    coord -= propagandaDraw(ctx, country)                       // Government propaganda draws on the Coordination pool
    g.attention = []
    for q of questions(country) sorted existential > structural > routine, then queue_priority:
      th = T(`slate.${q.tier}`); if (coord ≥ th) { g.attention.push({questionKey: q.key, coordinationCommitted: th}); coord -= th }   // fixed threshold, no slot formula
```
- `Question.severity ∈ {existential, structural, routine}` comes from polity (`state.polity.questions`); Questions exist independent of the slate (trigger `grievance_bucket_severity > compliance`); off-slate Questions keep accumulating and their factions may escalate (polity).
- Routine tier: handled by standing administration without a slate commitment at a continuous Coordination overhead scaling with their number.
- Tuning keys (placeholders): `slate.existential` 10, `slate.structural` 5, `slate.routine` 1, `admin.routineOverhead` 0.1.

### Assembly Queue and Question Resolution Time (2026-11-10)
Code: none (target); Question debate state belongs to polity (`state.polity.questions[key].debate`)
```js
queueCap(ctx, scope /* {kind:'region', id} | {kind:'empire', country} */) = max(1, floor(T('assembly.k') × assemblyCoordination(ctx, scope)))        // derived, never stored; (proposed) g
assemblyCoordination(Region r) = Σ Coordination output of pools staffed from r's cells    // needs economics.derive `produceCCOByRegion(region)` (spec decision; not in code)
assemblyCoordination(Empire c) = produceCCO(c).coordination
agendaShare(holder) = clamp01(T('assembly.agendaK') × Σ Weight(cell) × rightStrength(cell, 'Council' | 'Petition') / Σ Weight(cells in the assembly's scope))   // holders with a Council seat or Petition Right; Government keeps 1 − Σ shares  (proposed)
slots(holder) = floor(queueCap × share)       // Government gets the remainder; within a share Questions are ordered by polity's queue_priority (severity, Weight, Petition multiplier)
duration(q) = scope(q) is one Region ? 1 : spans several Regions but not the Country ? 3 : 5     // keys question.turns.{region,multi,empire}
```
- A Question holds its slot from the turn it starts debate until resolved; when the queue is full it waits in the share of the holder who would open it.
- **Quickening**: at the start of each turn of a debate, `holders = polity.gateHolders(…)`; with `s_i` = Weight-weighted stance of each covering holder (`stance()`, `kernel/stance.js`): `strongVeto = some Veto holder with !approves(s_i)`; resolve early iff `(!strongVeto && Σ Weight(holder in favour) / Σ Weight(holders) > 0.5) || (strongVeto && every holder approves)`; otherwise at `since + duration` under the existing gating rules (Veto, force through Control with entitlement-loss).
- Slate attention and queue slot are independent limits, both Coordination-derived. Open: existential Questions bypassing the cap; `g` shape and Weight × right-strength split (numbers pass).
- **(spec decision)** an assembly is addressed as `region:<id>` / `empire:<country>` in `state.polity.questions[key].debate = {assembly, holder, since, duration}`.

### Government upkeep (execution side — settled 2026-11-02)
Code: none in `administration/`; Economics step 3 is expected to apply degradation (not verified in this pass)
```js
unmetFraction(pool) = 1 − granted/needed for the upkeep items of that pool, from the spending dial's waterline (resolveAllocation rows; cut order = the dial's priority order)
pool.cco *= (1 − unmetFraction(pool))           // applied by economics.ledgerUpdate (step 3); proportional; never spawns Questions
leaderlessDefection(pool): if unmetFraction(pool) > T('defect.threshold') → labour returns to ORIGIN cells (dual-claim reverses → production);
                           optional: cell at the armed rung with the Retinue Right → labour joins the rebels (War resolves)
```
- Degraded Control lowers `involuntary_compliance` (it reads the degraded `produceCCO`). Computed in step 3 so polity step 5 reads it the same turn. Curve beyond proportional: numbers pass. `defect.threshold` 0.3.

### Emergency Powers (settled 2026-11-02)
Code: none (target)
```js
declareEmergencyPowers {magnitude, addresses?: string[]}     // commitment, gate 'administration', public; stores gov.emergency = {magnitude, since, addresses}; liftEmergencyPowers = release
envelopeSupply: control += emergency.magnitude ; coordination −= emergencyCost ; observation −= emergencyCost × T('emergency.obsShare')       // (spec decision) the Observation expense share
emergencyCost(ctx, c) = emergency.magnitude × (1 − ctx.derive.polity.acceptanceOfEmergency(c))      // derived EVERY turn; NO duration term
```
- `acceptanceOfEmergency` = the polity entitlement-loss acceptance function (live crisis severity from current Question state, the faction's own exposure, burden share, visible alternatives); the cost lands as the usual decaying Opinion/Fairness modifier. Only time-dependence: decay of modifiers already applied.
- Hook `acceptanceOfEmergency` is **not** exported by polity today (spec decision: add it to `polity.derive`).

### Administration actions (execution layer; classes per `actions__kb.md`)
Code: `polity/actions.js` (`setControlAllocation`, `placeRequisition`), `diplomacy/covert.js` (`setObservationAllocation`); the rest none
| Type id | Class | Gate | Status |
|---|---|---|---|
| `setControlAllocation {entries}` | dial | administration | in code |
| `setObservationAllocation {entries}` | dial (code: event) | — | in code (class to fix) |
| `setPoolSplit {pool, entries, reserve?, sink?}` | dial | administration | target |
| `declareEmergencyPowers`, `liftEmergencyPowers` | commitment / event | administration | target |
| `escalateExternalQuestion {questionKey}` | event | — | target: marks an external Question existential for this turn's slate |
| `setPlanningPosture {value 0..1}` | dial | — | target: Economics reads `gov.planningPosture` |
| `setBorderPolicy {scope, policy}` | dial | market | target: Economics `frictionOf` / `zoneEdgeGate` read it |
| `placeRequisition`, `liftRequisition` | event | market / skilled-labour | `placeRequisition` in code (polity, enforcement via Control grant); `liftRequisition` not seen |
| `commissionAudit {region \| cell \| rumor}` | event, covert | — | target: consumes Observation; surfaces hidden Grievance/compliance state: sets `observationCache` (stamp `live`) for the target for the turn **(spec decision)** |
- Informational actions never mutate simulation state beyond the Decision Log and `observationCache`.

## Rules
Code: per-rule notes
1. Control Allocation is an `AllocationDial`: per-cell floors by priority, surplus by weight, additive stacking, lowest priority truncated (`resolveAllocation`, tested in `tests/kernel.test.js`).
2. `setControlAllocation` has no costs; only the compliance shift follows.
3. Slate thresholds are fixed per tier (`slate.*`); existential Questions can displace lower ones from `attention`, never from existence (target).
4. Upkeep degradation proportional, cut order from the spending dial; leaderless defection returns labour to origin cells (target).
5. Questions are polity state, independent of `attention` (target step 6 writes only `attention`).
6. Requisition scope is enforced through `controlGrant` additively per covered cell (target: `requisitionEnforcementShare`).
7. Government propaganda draws on Coordination (`propagandaDraw`, target).
8. Observation controls the stamp of off-slate escalation; routine Questions cost `admin.routineOverhead` each (target).
9. `detectionStrength = observationAt + counterIntel` (in code; Diplomacy owns the thresholds).
10. Default unit of a dial is the cell (`cellsCovered`).
11. Surplus auto-fill costs nothing: no claim, no order (in `resolveAllocation`).
12. `queueCap` derived each turn (target).
13. Government holds the whole agenda by default; Council/Petition shares by `agendaShare` (target, proposed).
14. `duration` 1/3/5 and the quickening rule above (target).
15. Slate and queue are independent limits (target).

## Status
- **In code**: Control derives, Observation dial and `observationAt`/`detectionStrength`, `setControlAllocation`, `setObservationAllocation`, `placeRequisition`. `tests/espionage.test.js` covers the Observation dial and additive detection. No test asserts `controlGrant` directly (it is exercised through polity compliance and `tests/internal_conflict.test.js`).
- **Not in code**: `step6` (slate, routine overhead), assembly queue, upkeep degradation/defection (Economics side unverified), Emergency Powers, audits, planning posture, border policy, pool split action, stamps, Observation stamp wiring.
- **(code-led)**: `controlSupply` override and martial-law subtraction; Observation default spread by population with `obs.defaultSpread`; `setObservationAllocation` registered as an event.
- **(spec decision)**: group targets allocation-local; `produceCCOByRegion`; `acceptanceOfEmergency` export; `emergency.obsShare`; audit as an `observationCache` refresh; `state.polity.questions[key].debate`; tuning keys `slate.*`, `admin.routineOverhead`, `defect.threshold`, `observe.*`, `assembly.k`, `assembly.agendaK`, `question.turns.*`, `emergency.obsShare` (placeholders; values in `tuning.defaults.json` when implemented).
- **Open (kb)**: existential Questions bypassing the cap; `g(Coordination)` shape; Weight × right-strength split; degradation curve beyond proportional; numbers pass.
- **Sync:** (`<section> = <kb rev> / <code rev>`; `-` = no or insufficient code+tests)
  - Data Structures > Control Allocation (settled; Allocation Dial semantics settled 2026-11-03) = 1 / -
  - Data Structures > Observation Allocation (settled 2026-11-01; detection settled 2026-11-02) = 1 / 1
  - Data Structures > Question Active Slate (attention commitment — revised 2026-11-02) = 1 / -
  - Data Structures > Assembly Queue and Question Resolution Time (2026-11-10) = 1 / -
  - Data Structures > Government upkeep (execution side — settled 2026-11-02) = 1 / -
  - Data Structures > Emergency Powers (settled 2026-11-02) = 1 / -
  - Data Structures > Administration actions (execution layer; classes per `actions__kb.md`) = 1 / -
  - Rules = 1 / -
