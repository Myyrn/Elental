# Administration — Specification

KB: `kb/administration__kb.md`. Mirror of its `##/###` headings; cross-references live in kb only. Split out of `admin_war_diplomacy__spec.md` (§1) on 2026-11-12. Besides kb, sources: `src/modules/administration/{module,step,actions}.js`, `src/modules/polity/actions.js` (`setControlAllocation`), `src/modules/polity/step.js` (`updateMomentum`: the slate's first consumer, 2026-11-19; the expired-debate modifier, 2026-11-20), `src/modules/diplomacy/covert.js` (Observation dial and detection), `tests/{espionage,administration,slate_colonize,debate}.test.js`. Where code and the old spec disagree, **code wins** (**code-led**); where the old spec and the kb disagree, **the kb wins** (the slate section below was corrected on 2026-11-17). Anything the kb does not state is **(spec decision)**; both are listed under Status. Sections the code has not reached are **(target)**: the administration module holds the Control derives, step 6 (the slate, 2026-11-17), the slate readout (2026-11-19) and, since 2026-11-20, the debate extension (`extendDebates`); no assembly queue yet.

## Data Structures

State (code today and target):
```js
state.admin.governments[country] = {
  controlDial: {entries}, observationDial: {entries}, spendingDial: {entries, reserve, sink},   // in code
  controlSupply?: number /*scenario/test override of the produced Control*/, controlBonus?: number /*coercion gains (Demotion Duty)*/,   // in code
  coordinationSupply?: number /*scenario/test override of the produced Coordination (same role as controlSupply)*/,   // in code (2026-11-17)
  attention: [{questionKey, coordinationCommitted}], standing: string[] /*routine Question keys handled by standing administration*/,   // in code (2026-11-17, written by step 6)
  poolSplit: Record<pool, AllocationDial>, planningPosture: 0..1, borderPolicy, emergency: null | {magnitude, since, addresses: string[]},   // target
  upkeepFraction: 0..1, observationCache: Record<`${kind}|${target}`, {turn, value}>, inventory: Record<good, number> }   // upkeepFraction/inventory written by Economics; observationCache target
state.polity.debate?: Record<questionKey, {since: turn, expired?: true}>   // in code (2026-11-19, interim): the debate of a Question the Government took up; written by polity step 5, `expired` set once when it ends unresolved; removed when the Question stops being live
state.commitments: {..., type: 'extendDebates', actor: {kind: 'government', country}, params: {questionKey}}   // in code (2026-11-20): one per extended Question
```

### Control Allocation (settled; Allocation Dial semantics settled 2026-11-03)
Code: `src/modules/administration/module.js` (`derive.administration.{controlSupply, controlResult, controlGrant}`), `src/kernel/allocation.js`
```js
scopeCtx(ctx, country) = { country, cellKeys: () => cells whose Region is owned by country, cellCountry: k => regionOwner(region(k)), T: ctx.T }   // the scope helper `cellsCovered` and `resolveAllocation` expect
controlSupply(ctx, c)  = max(0, (gov.controlSupply ?? economics.produceCCO(c).control) + (gov.controlBonus ?? 0) − (derive.war.martialCost?.(c) ?? 0)) × (1 − extensionShare(c))   // (code-led) martial-law Control cost of held cells is subtracted; the held share of debate extensions (below) is taken off the produced Control
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
Code: `src/modules/administration/step.js` (`step6`, `questionPriority`, `isListed`, `addressed`, `extensions`, `extensionTurns`, `extensionShare`), `module.js` (`steps: {6}`, derives `coordinationSupply`, `slate`, `extensionShare`), `actions.js` (`extendDebates`, `liftExtendDebates`), `src/modules/polity/step.js` (`updateMomentum`); tests `tests/administration.test.js` (written 2026-11-17, **green since 2026-11-18**), `tests/slate_colonize.test.js` (2026-11-19, **green in the run of 2026-11-20**), `tests/debate.test.js` (2026-11-20, **not yet run**)
```js
coordinationSupply(ctx, c) = max(0, gov.coordinationSupply ?? economics.produceCCO(c).coordination) × (1 − extensionShare(c))      // the slate's budget; Emergency Powers' cost joins here when they exist (target); degraded output already comes from produceCCO
step6(ctx) — runs after polity step 5; writes the slate for NEXT turn (it lags one turn); for each Country with a Government:
  qs = live Questions of the Country's cells (polity.questions, independent of the slate), sorted: tier existential > structural > routine, then priority desc, then key
  priority(q) = q.gap × Weight(q.cell) × (right(q.cell, 'Petition') ? T('queue.petitionMult') : 1)             // (spec decision) the instantiation of polity's queue_priority
  coord = coordinationSupply(c)
  routine tier: standing administration, NO slate commitment (kb): handled = min(#routine, floor(coord / T('admin.routineOverhead')));  coord -= T('admin.routineOverhead') × handled
                gov.standing = keys of the `handled` highest-priority routine Questions; the rest are unaddressed (never removed; their factions may escalate)
  coord -= propagandaDraw(c)                                    // Government propaganda draws on the Coordination pool (the sum of its commitments' params.amount)
  gov.attention = []
  for q of qs (existential, then structural): th = T(`slate.${q.tier}`); if (coord ≥ th) { gov.attention.push({questionKey: q.key, coordinationCommitted: th}); coord -= th }      // fixed threshold, no slot formula; skipped Questions do not stop lower ones that still fit
```
- `Question.tier ∈ {existential, structural, routine}` comes from polity (`derive.polity.questions`, thresholds `tier.existential`, `tier.structural`); Questions exist independent of the slate (trigger `grievance > compliance`); off-slate Questions keep accumulating and their factions may escalate (polity).
- **(code-led, kb wins over the 2026-11-13 sketch)** the old spec looped over routine Questions with a `slate.routine` threshold as well as the overhead; the kb (settled 2026-11-02) says routine Questions are handled by standing administration without a slate commitment, so `slate.routine` is **not read** by the code.
- **(spec decision)** the overhead is charged first and routine Questions are cut by lowest priority when Coordination runs short; the Government's propaganda draw is charged next; `gov.standing` records which routine Questions are handled.
- **(spec decision)** `queue.petitionMult` (placeholder 2) multiplies the priority of a Question whose cell holds the Petition Right; `Weight × gap` is the "f(severity, Weight)" of the polity kb, and the existential > structural > routine tier order comes first. Not touched: polity's Pressure and Question queue section (still lists `queue_priority` as not in code; update it at the next polity sync).
- Tuning keys (placeholders): `slate.existential` 10, `slate.structural` 5, `slate.routine` 1 (unused), `admin.routineOverhead` 0.1, `queue.petitionMult` 2.
- **Addressed Questions, the debate and the escalation freeze (kb 2026-11-19/20, in code)** — the slate's first consumer, in polity step 5 (`updateMomentum`), reading what step 6 wrote last turn:
```js
isListed(q, g)   = g.attention has q.key  ||  g.standing includes q.key
extendedNow(q)   = an `extendDebates` commitment names q.key, a debate record exists and extensionShare(country) < 1           // the Government pays to keep it discussed
addressed(q, g)  = (polity.debate[q.key] ? turn − debate.since < T('question.turns.region') : isListed(q, g))  ||  extendedNow(q)
updateMomentum(q):
  if isListed(q, g) and no debate record → polity.debate[q.key] = {since: turn}                                    // the Government took it up: a debate starts
  if a debate record exists, not yet `expired`, and !addressed(q, g) → d.expired = true; expiryModifier(q)            // the debate ended unresolved, ONCE
  momentum = momentum × (1 − T('mom.decay')) + T('mom.rise') × gap × (addressed ? T('slate.addressedRise') : 1)          // placeholder 0: the rise is frozen, the decay is not
expiryModifier(q) = for every cell of q's Country that holds a live Question on the same issue (the faction that raised it; q.cell included):
  cell.fairnessMods.push({id: `debate.${q.key}`, value: T('debate.expiryGrievance'), decay: opinion.modDecay, turn, source: 'debate'})     // minor, decaying; spec decision: Fairness-type
step 5 removes polity.debate[key] and the `extendDebates` commitments for every Question that is no longer live (resolved or faded: no modifier); a Question still pressing after its debate is NOT addressed again until it has stopped being live
```
  A routine Question in standing administration counts as addressed (kb). **(spec decision)** until the assembly queue exists the debate length is the single placeholder `question.turns.region` (1; every Question is a cell Question, i.e. of one Region): the freeze lasts one turn unless the Government extends it. Resolution before the queue is not possible (nothing resolves a debate; a Question leaves by ceasing to be live), so the code can only fade a Question or expire its debate. The queue replaces `polity.debate = {since}` by `state.polity.questions[key].debate = {assembly, holder, since, duration}` (below) and the length by `duration(q)`.
- **Extending a debate (kb 2026-11-20, shape confirmed; in code 2026-11-20, tests not yet run)**: commitment `extendDebates {questionKey}` (Government actor only, class commitment, no gate, public, `costs()` `[]`: the cost is a share taken off the produced supplies, not a claim), event `liftExtendDebates {id}`:
```js
extensionTurns(key) = max(0, turn − debate[key].since − T('question.turns.region') + 1)      // k: 0 during the natural timespan, 1 on the first extra turn, 2 on the next, ...
extensionShare(c)   = min(1, Σ over c's extendDebates commitments of T('debate.extendBase') × extensionTurns(key)²)      // s0 × k² per extended Question
controlSupply and coordinationSupply are multiplied by (1 − extensionShare(c))                  // the same share of both
validate: Government actor; the Question is live, belongs to the actor's Country, has a debate record that has not expired (or is listed); not already extended
lapse: lifted, or extensionShare reaches 1 (cannot be paid), or the Question stops being live → the debate ends; an unresolved one expires (modifier above)
```
- **Slate readout (kb consumer order 1, in code 2026-11-19)**: `derive.administration.slate(country)` = `{attention, standing, questions: [{key, cell, need, tier, gap, priority, status, debate}], unaddressed: key[]}`, sorted tier then priority then key; `status` = `'slate'` (on attention), `'standing'` (routine in standing administration), `'debate'` (a debate is open though the slate no longer lists it), `'unaddressed'` (its faction may escalate; includes a listed Question whose debate has ended). Derived, nothing stored; the UI card that draws it is **not in code**.
- Tuning keys (2026-11-19/20, placeholders): `slate.addressedRise` 0, `question.turns.region` 1, `debate.expiryGrievance` 0.05, `debate.extendBase` 0.05.

### Assembly Queue and Question Resolution Time (2026-11-10)
Code: none (target); Question debate state belongs to polity (`state.polity.questions[key].debate`; the interim `state.polity.debate[key] = {since}` of the slate consumer above is the seed of it)
```js
queueCap(ctx, scope /* {kind:'region', id} | {kind:'empire', country} */) = max(1, floor(T('assembly.k') × assemblyCoordination(ctx, scope)))        // derived, never stored; (proposed) g
assemblyCoordination(Region r) = Σ Coordination output of pools staffed from r's cells    // needs economics.derive `produceCCOByRegion(region)` (spec decision; not in code)
assemblyCoordination(Empire c) = produceCCO(c).coordination
agendaShare(holder) = clamp01(T('assembly.agendaK') × Σ Weight(cell) × rightStrength(cell, 'Council' | 'Petition') / Σ Weight(cells in the assembly's scope))   // holders with a Council seat or Petition Right; Government keeps 1 − Σ shares  (proposed)
slots(holder) = floor(queueCap × share)       // Government gets the remainder; within a share Questions are ordered by polity's queue_priority (severity, Weight, Petition multiplier)
duration(q) = scope(q) is one Region ? 1 : spans several Regions but not the Country ? 3 : 5     // keys question.turns.{region,multi,empire}; only `region` exists (2026-11-19)
```
- A Question holds its slot from the turn it starts debate until resolved; when the queue is full it waits in the share of the holder who would open it.
- **Quickening**: at the start of each turn of a debate, `holders = polity.gateHolders(…)`; with `s_i` = Weight-weighted stance of each covering holder (`stance()`, `kernel/stance.js`): `strongVeto = some Veto holder with !approves(s_i)`; resolve early iff `(!strongVeto && Σ Weight(holder in favour) / Σ Weight(holders) > 0.5) || (strongVeto && every holder approves)`; otherwise at `since + duration` (+ the extension) under the existing gating rules (Veto, force through Control with entitlement-loss).
- Slate attention and queue slot are independent limits, both Coordination-derived. Open: existential Questions bypassing the cap; `g` shape and Weight × right-strength split (numbers pass).
- `extendDebates` (above) already works on the interim debate record; with the queue, `extensionTurns` counts from `since + duration(q)` and the extended debate keeps its slot.
- **(spec decision)** an assembly is addressed as `region:<id>` / `empire:<country>` in `state.polity.questions[key].debate = {assembly, holder, since, duration}`.

### Government upkeep (execution side — settled 2026-11-02)
Code: Economics (`economics/upkeep.js` `poolUnmetFrom`, `ledgerUpdate` writes `gov.poolUnmet` each turn; `produceCCO` applies it — see `economics__spec.md`, Resolution order); nothing in `administration/`
```js
unmetFraction(pool) = 1 − granted/needed for the upkeep items of that pool, from the spending dial's waterline (resolveAllocation rows; cut order = the dial's priority order)
pool.cco *= (1 − unmetFraction(pool))           // applied by economics.ledgerUpdate (step 3); proportional; never spawns Questions
leaderlessDefection(pool): if unmetFraction(pool) > T('defect.threshold') → labour returns to ORIGIN cells (dual-claim reverses → production);
                           optional: cell at the armed rung with the Retinue Right → labour joins the rebels (War resolves)
```
- Degraded Control lowers `involuntary_compliance` (it reads the degraded `produceCCO`), and degraded Coordination now also shrinks the slate (step 6 reads `produceCCO`). Computed in step 3 so polity step 5 reads it the same turn. Curve beyond proportional: numbers pass. `defect.threshold` 0.3 (defection itself: **not in code**).

### Emergency Powers (settled 2026-11-02)
Code: none (target)
```js
declareEmergencyPowers {magnitude, addresses?: string[]}     // commitment, gate 'administration', public; stores gov.emergency = {magnitude, since, addresses}; liftEmergencyPowers = release
envelopeSupply: control += emergency.magnitude ; coordination −= emergencyCost ; observation −= emergencyCost × T('emergency.obsShare')       // (spec decision) the Observation expense share
emergencyCost(ctx, c) = emergency.magnitude × (1 − ctx.derive.polity.acceptanceOfEmergency(c))      // derived EVERY turn; NO duration term
```
- `acceptanceOfEmergency` = the polity entitlement-loss acceptance function (live crisis severity from current Question state, the faction's own exposure, burden share, visible alternatives); the cost lands as the usual decaying Opinion/Fairness modifier. Only time-dependence: decay of modifiers already applied.
- Hook `acceptanceOfEmergency` is **not** exported by polity today (spec decision: add it to `polity.derive`); `coordinationSupply` is where its Coordination cost would be subtracted, next to the extension share.

### Administration actions (execution layer; classes per `actions__kb.md`)
Code: `polity/actions.js` (`setControlAllocation`, `placeRequisition`), `diplomacy/covert.js` (`setObservationAllocation`), `administration/actions.js` (`extendDebates`, `liftExtendDebates`, 2026-11-20); the rest none
| Type id | Class | Gate | Status |
|---|---|---|---|
| `setControlAllocation {entries}` | dial | administration | in code |
| `setObservationAllocation {entries}` | dial (code: event) | — | in code (class to fix) |
| `setPoolSplit {pool, entries, reserve?, sink?}` | dial | administration | target |
| `declareEmergencyPowers`, `liftEmergencyPowers` | commitment / event | administration | target |
| `extendDebates {questionKey}` | commitment | — | in code (2026-11-20, not yet run): share of Control and Coordination taken off the supplies, `s0 × k²` |
| `liftExtendDebates {id}` | event | — | in code (2026-11-20, not yet run) |
| `escalateExternalQuestion {questionKey}` | event | — | target: marks an external Question existential for this turn's slate |
| `setPlanningPosture {value 0..1}` | dial | — | target: Economics reads `gov.planningPosture` |
| `setBorderPolicy {scope, policy}` | dial | market | target: Economics `frictionOf` / `zoneEdgeGate` read it |
| `placeRequisition`, `liftRequisition` | event | market / skilled-labour | `placeRequisition` in code (polity, enforcement via Control grant); `liftRequisition` not seen (`placeRequisition` with amount 0 lifts) |
| `commissionAudit {region \| cell \| rumor}` | event, covert | — | target: consumes Observation; surfaces hidden Grievance/compliance state: sets `observationCache` (stamp `live`) for the target for the turn **(spec decision)** |
- Informational actions never mutate simulation state beyond the Decision Log and `observationCache`.

## Rules
Code: per-rule notes
1. Control Allocation is an `AllocationDial`: per-cell floors by priority, surplus by weight, additive stacking, lowest priority truncated (`resolveAllocation`, tested in `tests/kernel.test.js`).
2. `setControlAllocation` has no costs; only the compliance shift follows.
3. Slate thresholds are fixed per tier (`slate.existential`, `slate.structural`); existential Questions come first and can displace lower ones from `attention`, never from existence (`step6`; routine Questions have no slate threshold).
4. Upkeep degradation proportional, cut order from the spending dial (Economics, in code); leaderless defection returns labour to origin cells (target).
5. Questions are polity state, independent of `attention` (step 6 writes only `attention` and `standing`); an addressed Question (listed on `attention`, or routine in `standing`, or extended) has the rise of its momentum frozen only while it is discussed (`updateMomentum`, `slate.addressedRise`), rises again when the debate ends while it is still pressing, and an unresolved ending leaves the expiry modifier once on the faction's cells (2026-11-19/20).
6. Requisition scope is enforced through `controlGrant` additively per covered cell (target: `requisitionEnforcementShare`).
7. Government propaganda draws on Coordination (step 6 subtracts the draw of its commitments before the slate).
8. Routine Questions cost `admin.routineOverhead` each of Coordination (in code); Observation controls the stamp of off-slate escalation (target).
9. `detectionStrength = observationAt + counterIntel` (in code; Diplomacy owns the thresholds).
10. Default unit of a dial is the cell (`cellsCovered`).
11. Surplus auto-fill costs nothing: no claim, no order (in `resolveAllocation`).
12. `queueCap` derived each turn (target).
13. Government holds the whole agenda by default; Council/Petition shares by `agendaShare` (target, proposed).
14. `duration` 1/3/5 and the quickening rule above (target).
15. Slate and queue are independent limits (target).
16. `extendDebates`: the held share of Control and Coordination is `min(1, Σ s0 × k²)` over the extended Questions, applied by multiplying both supplies by `1 − share` (in code, 2026-11-20).

## Status
- **In code**: Control derives, Observation dial and `observationAt`/`detectionStrength`, `setControlAllocation`, `setObservationAllocation`, `placeRequisition`; **since 2026-11-17 step 6**: `coordinationSupply`, `questionPriority`, `step6` writing `gov.attention` and `gov.standing`, tuning key `queue.petitionMult`. `tests/espionage.test.js` covers the Observation dial and additive detection; `tests/administration.test.js` (2026-11-17, **green since 2026-11-18**) covers the slate: tier order, thresholds, routine overhead and shortfall, propaganda draw, priority within a tier, the one-turn lag through a real turn. No test asserts `controlGrant` directly (it is exercised through polity compliance and `tests/internal_conflict.test.js`).
- **Written 2026-11-19, green in the run of 2026-11-20** (`tests/slate_colonize.test.js`): the slate readout `derive.administration.slate`, `isListed`/`addressed`, the debate record `polity.debate` and the escalation freeze in `polity/step.js` `updateMomentum`; the slate now has its first consumer (kb order 1 and 2).
- **Written 2026-11-20, tests written the same day and not yet run** (`tests/debate.test.js`; run `npm run build:data` for the two new keys first): the expired-debate modifier (once, on the faction's cells), `extendDebates` / `liftExtendDebates`, `extensionTurns` / `extensionShare`, the supplies multiplied by `1 − share`, the cleanup of extensions of Questions that are no longer live.
- **Not in code**: assembly queue, defection (Economics side unverified), Emergency Powers, audits, planning posture, border policy, pool split action, stamps, Observation stamp wiring, a UI card for the slate readout, consumers 3 (Question handling: petition handling, Persuasion) to 6 (AI Governments), the Petition-holder test of `questionPriority` (the scope syntax for a single cell was not verified, so it is untested), **resolution of a debate before it ends** (only the queue can resolve one).
- **(code-led)**: `controlSupply` override and martial-law subtraction; `coordinationSupply` override (same role); Observation default spread by population with `obs.defaultSpread`; `setObservationAllocation` registered as an event; routine Questions have no slate threshold (kb), `slate.routine` unused; **`polity.debate[key] = {since}` is an interim debate record** (the queue's `questions[key].debate` is the target).
- **(spec decision)**: group targets allocation-local; `produceCCOByRegion`; `acceptanceOfEmergency` export; `emergency.obsShare`; audit as an `observationCache` refresh; `state.polity.questions[key].debate`; the slate details above (overhead first, then propaganda draw, cut routine by lowest priority, `gov.standing`, `questionPriority` = gap × Weight × Petition multiplier); tuning keys `slate.*`, `admin.routineOverhead`, `queue.petitionMult`, `defect.threshold`, `observe.*`, `assembly.k`, `assembly.agendaK`, `question.turns.*`, `emergency.obsShare` (placeholders; values in `tuning.defaults.json` when implemented). **2026-11-19/20**: the debate seed `polity.debate`, one debate length `question.turns.region` for every Question until the queue, the status vocabulary of the readout (`slate | standing | debate | unaddressed`), a listed Question whose debate ended reads as unaddressed; the expiry modifier as a Fairness-type modifier (`fairnessMods`, `debate.expiryGrievance`); the extension as a share multiplying both supplies rather than a claim; `extendDebates` validating against a live debate; extensions of Questions that stop being live are dropped.
- **Open (kb)**: existential Questions bypassing the cap; `g(Coordination)` shape; Weight × right-strength split; degradation curve beyond proportional; numbers pass (sizes of `s0` and of the expiry modifier among them); how a Question gets resolved before the queue exists.
- **Sync:** (`<section> = <kb rev> / <code rev>`; `-` = no or insufficient code+tests; revs set on tests written but not yet run are provisional)
  - Data Structures > Control Allocation (settled; Allocation Dial semantics settled 2026-11-03) = 1 / -
  - Data Structures > Observation Allocation (settled 2026-11-01; detection settled 2026-11-02) = 1 / 1
  - Data Structures > Question Active Slate (attention commitment — revised 2026-11-02) = 4 / 4
  - Data Structures > Assembly Queue and Question Resolution Time (2026-11-10) = 3 / -
  - Data Structures > Government upkeep (execution side — settled 2026-11-02) = 1 / -
  - Data Structures > Emergency Powers (settled 2026-11-02) = 1 / -
  - Data Structures > Administration actions (execution layer; classes per `actions__kb.md`) = 2 / -
  - Rules = 4 / -
