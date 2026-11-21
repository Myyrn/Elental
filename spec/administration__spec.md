# Administration — Specification

KB: `kb/administration__kb.md`. Mirror of its `##/###` headings; cross-references live in kb only. Split out of `admin_war_diplomacy__spec.md` (§1) on 2026-11-12. Besides kb, sources: `src/modules/administration/{module,step,queue,actions}.js`, `src/modules/economics/derive.js` (`produceCCOByRegion`), `src/modules/polity/actions.js` (`setControlAllocation`), `src/modules/polity/step.js` (`updateMomentum`: the slate's first consumer, 2026-11-19; the expired-debate modifier, 2026-11-20; queue-aware debates, 2026-11-21), `src/modules/diplomacy/covert.js` (Observation dial and detection), `src/client/readoutsAdmin.js` (the `slate` query), `src/ui/{forms,app}.js` and `src/ui/views/apparatus.js` (the slate card and the forms), `tests/{espionage,administration,slate_colonize,debate,queue}.test.js`. Where code and the old spec disagree, **code wins** (**code-led**); where the old spec and the kb disagree, **the kb wins** (the slate section below was corrected on 2026-11-17). Anything the kb does not state is **(spec decision)**; both are listed under Status. Sections the code has not reached are **(target)**: the administration module holds the Control derives, step 6 (the slate, 2026-11-17, then the assembly queue, 2026-11-21), the slate readout (2026-11-19) and the debate extension (`extendDebates`, 2026-11-20).

## Data Structures

State (code today and target):
```js
state.admin.governments[country] = {
  controlDial: {entries}, observationDial: {entries}, spendingDial: {entries, reserve, sink},   // in code
  controlSupply?: number /*scenario/test override of the produced Control*/, controlBonus?: number /*coercion gains (Demotion Duty)*/,   // in code
  coordinationSupply?: number /*scenario/test override of the produced Coordination (same role as controlSupply); a Region assembly gets it split by population*/,   // in code (2026-11-17)
  attention: [{questionKey, coordinationCommitted}], standing: string[] /*routine Question keys handled by standing administration*/,   // in code (2026-11-17, written by step 6)
  poolSplit: Record<pool, AllocationDial>, planningPosture: 0..1, borderPolicy, emergency: null | {magnitude, since, addresses: string[]},   // target
  upkeepFraction: 0..1, observationCache: Record<`${kind}|${target}`, {turn, value}>, inventory: Record<good, number> }   // upkeepFraction/inventory written by Economics; observationCache target
state.polity.debate?: Record<questionKey, {since: turn, duration: number, assembly?: 'region:<id>', holder?: 'government' | cellKey, expired?: true}>   // in code (2026-11-19/21): opened by the assembly queue at step 6 (assembly and holder set) or by polity for a routine Question in standing administration (no assembly); `expired` set once when it ends unresolved; removed when the Question stops being live
state.polity.waiting?: Record<questionKey, true>   // in code (2026-11-21): Questions on the slate that the queue gave no slot at the last step 6 (rewritten every turn)
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
Code: `src/modules/administration/step.js` (`step6`, `questionPriority`, `isListed`, `addressed`, `extensions`, `extensionTurns`, `extensionShare`, `extendedNow`, `debateLength`), `queue.js` (`openDebates`, run right after `step6`), `module.js` (`steps: {6}`, derives `coordinationSupply`, `slate`, `extensionShare`), `actions.js` (`extendDebates`, `liftExtendDebates`), `src/modules/polity/step.js` (`updateMomentum`); tests `tests/administration.test.js` (written 2026-11-17, **green since 2026-11-18**), `tests/slate_colonize.test.js` (2026-11-19, **green in the run of 2026-11-20**; its debate-record assertion was adapted on 2026-11-21), `tests/debate.test.js` (2026-11-20) and `tests/queue.test.js` (2026-11-21), **not yet run**
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
openDebates(ctx) — right after step6: the assembly queue (next section) gives the listed Questions their debating slots
```
- `Question.tier ∈ {existential, structural, routine}` comes from polity (`derive.polity.questions`, thresholds `tier.existential`, `tier.structural`); Questions exist independent of the slate (trigger `grievance > compliance`); off-slate Questions keep accumulating and their factions may escalate (polity).
- **(code-led, kb wins over the 2026-11-13 sketch)** the old spec looped over routine Questions with a `slate.routine` threshold as well as the overhead; the kb (settled 2026-11-02) says routine Questions are handled by standing administration without a slate commitment, so `slate.routine` is **not read** by the code.
- **(spec decision)** the overhead is charged first and routine Questions are cut by lowest priority when Coordination runs short; the Government's propaganda draw is charged next; `gov.standing` records which routine Questions are handled.
- **(spec decision)** `queue.petitionMult` (placeholder 2) multiplies the priority of a Question whose cell holds the Petition Right; `Weight × gap` is the "f(severity, Weight)" of the polity kb, and the existential > structural > routine tier order comes first. Not touched: polity's Pressure and Question queue section (still lists `queue_priority` as not in code; update it at the next polity sync).
- Tuning keys (placeholders): `slate.existential` 10, `slate.structural` 5, `slate.routine` 1 (unused), `admin.routineOverhead` 0.1, `queue.petitionMult` 2.
- **Addressed Questions, the debate and the escalation freeze (kb 2026-11-19/20, in code)** — the slate's first consumer, in polity step 5 (`updateMomentum`), reading what step 6 wrote last turn:
```js
isListed(q, g)   = g.attention has q.key  ||  g.standing includes q.key
debateLength(d)  = d.duration ?? T('question.turns.region')
extendedNow(q)   = an `extendDebates` commitment names q.key, a debate record exists and extensionShare(country) < 1           // the Government pays to keep it discussed
addressed(q, g)  = (polity.debate[q.key] ? turn − debate.since < debateLength(debate) : isListed(q, g) && !polity.waiting[q.key])  ||  extendedNow(q)
updateMomentum(q):
  if isListed(q, g) and no debate record and not waiting → polity.debate[q.key] = {since: turn, duration}                  // standing administration (or a direct call): a debate starts WITHOUT a queue slot
  if a debate record exists, not yet `expired`, and !addressed(q, g) → d.expired = true; expiryModifier(q)            // the debate ended unresolved, ONCE
  momentum = momentum × (1 − T('mom.decay')) + T('mom.rise') × gap × (addressed ? T('slate.addressedRise') : 1)          // placeholder 0: the rise is frozen, the decay is not
expiryModifier(q) = for every cell of q's Country that holds a live Question on the same issue (the faction that raised it; q.cell included):
  cell.fairnessMods.push({id: `debate.${q.key}`, value: T('debate.expiryGrievance'), decay: opinion.modDecay, turn, source: 'debate'})     // minor, decaying; spec decision: Fairness-type
step 5 removes polity.debate[key] and the `extendDebates` commitments for every Question that is no longer live (resolved or faded: no modifier); a Question still pressing after its debate is NOT addressed again until it has stopped being live
```
  A routine Question in standing administration counts as addressed (kb) and is not queued. **(spec decision)** the debate length is the single placeholder `question.turns.region` (1; every Question is a cell Question, i.e. of one Region): the freeze lasts one turn unless the Government extends it. The 3 and 5 turn lengths (several Regions, the whole Country) need Questions of that scope and are not in code. A debate cannot be resolved yet (see Assembly Queue: quickening); a Question leaves by ceasing to be live, or its debate expires.
- **Extending a debate (kb 2026-11-20, shape confirmed; in code 2026-11-20, tests not yet run)**: commitment `extendDebates {questionKey}` (Government actor only, class commitment, no gate, public, `costs()` `[]`: the cost is a share taken off the produced supplies, not a claim), event `liftExtendDebates {id}`:
```js
extensionTurns(key) = max(0, turn − debate[key].since − debateLength(debate[key]) + 1)      // k: 0 during the natural timespan, 1 on the first extra turn, 2 on the next, ...
extensionShare(c)   = min(1, Σ over c's extendDebates commitments of T('debate.extendBase') × extensionTurns(key)²)      // s0 × k² per extended Question
controlSupply and coordinationSupply are multiplied by (1 − extensionShare(c))                  // the same share of both
validate: Government actor; the Question is live, belongs to the actor's Country, has a debate record that has not expired (or is listed and not waiting); not already extended
lapse: lifted, or extensionShare reaches 1 (cannot be paid), or the Question stops being live → the debate ends; an unresolved one expires (modifier above)
```
- **Slate readout (kb consumer order 1, in code 2026-11-19, `waiting` and assemblies 2026-11-21)**: `derive.administration.slate(country)` = `{attention, standing, questions: [{key, cell, need, tier, gap, priority, status, debate}], unaddressed: key[], waiting: key[], assemblies: [{assembly, cap, slots, open}]}`, sorted tier then priority then key; `status` = `'slate'` (on attention and debated), `'standing'` (routine in standing administration), `'debate'` (a debate is open or extended though the slate no longer lists it), `'waiting'` (listed but its assembly gave no slot: not addressed), `'unaddressed'` (its faction may escalate; includes a listed Question whose debate has ended). Derived, nothing stored. The UI reads it through the query `slate` (`client/readoutsAdmin.js`: the readout plus `heldShare`, the supplies, the extensions with their k and the free-colonization commitments) and draws the **Question slate and debates** card in the Apparatus workspace (2026-11-21).
- Tuning keys (2026-11-19/21, placeholders): `slate.addressedRise` 0, `question.turns.region` 1, `debate.expiryGrievance` 0.05, `debate.extendBase` 0.05.

### Assembly Queue and Question Resolution Time (2026-11-10)
Code: `src/modules/administration/queue.js` (`assemblyCoordination`, `queueCap`, `holderStrength`, `agenda`, `openDebates`, **written 2026-11-21, tests not yet run**), `economics/derive.js` (`produceCCOByRegion`); debate state in `polity.debate` / `polity.waiting` (`state.polity.questions[key].debate` of the earlier plan was not needed: Questions are derived, there is no stored Question object)
```js
assemblyCoordination(Region r)  = (gov.coordinationSupply defined ? gov.coordinationSupply × pop(r's cells) / pop(the Country's cells) : economics.produceCCOByRegion(r).coordination) × (1 − extensionShare(owner))      // the pools staffed from r's cells, degraded like the Country's; Σ over a Country's Regions = produceCCO(country)
assemblyCoordination(Empire c)  = economics.produceCCO(c).coordination × (1 − extensionShare(c))      // no Empire-scope Question exists yet
queueCap(scope)                 = max(1, floor(T('assembly.k') × assemblyCoordination(scope)))       // derived, never stored; at least one slot
holderStrength(cell)            = (right(cell, 'Petition') ? 1 : 0) + #{Council* rights the cell holds (=== true)}
agenda(Region r): holders = cells of r with holderStrength > 0;  share(h) = T('assembly.agendaK') × Weight(h) × holderStrength(h) / Σ Weight(r's cells)  (scaled down if Σ shares > 1)
  slots[h] = floor(cap × share(h));  slots.government = cap − Σ slots[h]        // the Government keeps whatever the holders do not claim
openDebates(ctx)   (step 6, after the slate):
  occupancy = open debates with an assembly: !expired and (turn + 1 − since < length  ||  extended)        // an extension keeps the slot, an expired debate frees it
  for each Country, candidates = Questions on gov.attention without a debate record, sorted tier, priority desc, key
    holder = (slots[q.cell] > 0) ? q.cell : 'government'          // a holder opens its own Questions in its own share
    free slot for the holder → polity.debate[q.key] = {since: turn + 1, duration: T('question.turns.region'), assembly: `region:${r}`, holder}
    else → polity.waiting[q.key] = true                              // not debated, not addressed: its faction may escalate
  polity.waiting is rewritten every turn; routine Questions in standing administration are NOT queued
```
- **(spec decisions, built as proposed in the kb 2026-11-10; the designer said "continue" on 2026-11-21 — pending explicit OK)**: the cap mapping (`assembly.k` 0.2, linear in the Region's Coordination); the agenda-share formula and Petition (and each Council seat) carrying a share; a holder opens only its own cell's Questions; the Government's slots are the remainder; `since` = next turn (the turn polity first sees the debate); a waiting Question is not addressed; the population split of an overridden `coordinationSupply` (a scenario/test hook); `assembly.agendaK` 1.
- A Question holds its slot from the turn it starts debate until its natural length is over, or longer while extended, or until it expires; the queue and the slate are independent limits, both Coordination-derived.
- **Quickening (not in code)**: at the start of each turn of a debate, `holders = polity.gateHolders(…)`; with `s_i` = Weight-weighted stance of each covering holder (`stance()`, `kernel/stance.js`): `strongVeto = some Veto holder with !approves(s_i)`; resolve early iff `(!strongVeto && Σ Weight(holder in favour) / Σ Weight(holders) > 0.5) || (strongVeto && every holder approves)`; otherwise at `since + duration` (+ the extension) under the existing gating rules (Veto, force through Control with entitlement-loss). It needs a decision object to take a stance on (a proposed act answering the Question), which belongs to the next consumer, **Question handling** (kb order 3: petition handling, Persuasion); until it exists nothing resolves a debate.
- Open: existential Questions bypassing the cap; `g` shape and Weight × right-strength split (numbers pass); durations 3 and 5 (need multi-Region and Country-wide Questions).

### Government upkeep (execution side — settled 2026-11-02)
Code: Economics (`economics/upkeep.js` `poolUnmetFrom`, `ledgerUpdate` writes `gov.poolUnmet` each turn; `produceCCO` applies it — see `economics__spec.md`, Resolution order); nothing in `administration/`
```js
unmetFraction(pool) = 1 − granted/needed for the upkeep items of that pool, from the spending dial's waterline (resolveAllocation rows; cut order = the dial's priority order)
pool.cco *= (1 − unmetFraction(pool))           // applied by economics.ledgerUpdate (step 3); proportional; never spawns Questions
leaderlessDefection(pool): if unmetFraction(pool) > T('defect.threshold') → labour returns to ORIGIN cells (dual-claim reverses → production);
                           optional: cell at the armed rung with the Retinue Right → labour joins the rebels (War resolves)
```
- Degraded Control lowers `involuntary_compliance` (it reads the degraded `produceCCO`), and degraded Coordination now also shrinks the slate (step 6 reads `produceCCO`) and the assemblies' caps. Computed in step 3 so polity step 5 reads it the same turn. Curve beyond proportional: numbers pass. `defect.threshold` 0.3 (defection itself: **not in code**).

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
Code: `polity/actions.js` (`setControlAllocation`, `placeRequisition`), `diplomacy/covert.js` (`setObservationAllocation`), `administration/actions.js` (`extendDebates`, `liftExtendDebates`, 2026-11-20); the rest none. Forms: `ui/forms.js` (`extendDebates`, `liftExtendDebates`, 2026-11-21)
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
5. Questions are polity state, independent of `attention` (step 6 writes only `attention` and `standing`); an addressed Question (debated, or routine in `standing`, or extended) has the rise of its momentum frozen only while it is discussed (`updateMomentum`, `slate.addressedRise`); a Question on the slate that the queue gave no slot waits and rises; the rise resumes when the debate ends while it is still pressing, and an unresolved ending leaves the expiry modifier once on the faction's cells (2026-11-19/21).
6. Requisition scope is enforced through `controlGrant` additively per covered cell (target: `requisitionEnforcementShare`).
7. Government propaganda draws on Coordination (step 6 subtracts the draw of its commitments before the slate).
8. Routine Questions cost `admin.routineOverhead` each of Coordination (in code); Observation controls the stamp of off-slate escalation (target).
9. `detectionStrength = observationAt + counterIntel` (in code; Diplomacy owns the thresholds).
10. Default unit of a dial is the cell (`cellsCovered`).
11. Surplus auto-fill costs nothing: no claim, no order (in `resolveAllocation`).
12. `queueCap` derived each turn from the Region's Coordination, at least 1 (in code, 2026-11-21).
13. Government holds the whole agenda by default; Council/Petition holders claim `agendaShare` of the slots and open their own Questions (in code, 2026-11-21; pending explicit OK).
14. `duration` 1 in code; 3 and 5, and the quickening rule, are target.
15. Slate and queue are independent limits (in code).
16. `extendDebates`: the held share of Control and Coordination is `min(1, Σ s0 × k²)` over the extended Questions, applied by multiplying both supplies by `1 − share` (in code, 2026-11-20); an extended debate keeps its queue slot.

## Status
- **In code**: Control derives, Observation dial and `observationAt`/`detectionStrength`, `setControlAllocation`, `setObservationAllocation`, `placeRequisition`; **since 2026-11-17 step 6**: `coordinationSupply`, `questionPriority`, `step6` writing `gov.attention` and `gov.standing`, tuning key `queue.petitionMult`. `tests/espionage.test.js` covers the Observation dial and additive detection; `tests/administration.test.js` (2026-11-17, **green since 2026-11-18**) covers the slate: tier order, thresholds, routine overhead and shortfall, propaganda draw, priority within a tier, the one-turn lag through a real turn. No test asserts `controlGrant` directly (it is exercised through polity compliance and `tests/internal_conflict.test.js`).
- **Written 2026-11-19, green in the run of 2026-11-20** (`tests/slate_colonize.test.js`): the slate readout `derive.administration.slate`, `isListed`/`addressed`, the debate record `polity.debate` and the escalation freeze in `polity/step.js` `updateMomentum`; the slate has its first consumer (kb order 1 and 2).
- **Written 2026-11-20/21, tests written the same days and not yet run** (`tests/debate.test.js`, `tests/queue.test.js`; run `npm run build:data` for the four new keys first): the expired-debate modifier, `extendDebates` / `liftExtendDebates`, the supplies × (1 − held share); **the assembly queue** (`queue.js`: cap from the Region's Coordination, agenda shares, slots, `polity.waiting`), `economics.produceCCOByRegion`, queue-aware `addressed` and `updateMomentum`; the `slate` UI query, the Apparatus card and the forms.
- **Not in code**: **quickening and the resolution of a debate** (needs Question handling), durations of 3 and 5 turns, the Empire assembly (no Empire-scope Question), defection (Economics side unverified), Emergency Powers, audits, planning posture, border policy, pool split action, stamps, Observation stamp wiring, consumers 3 (Question handling: petition handling, Persuasion), 5 (Emergency Powers) and 6 (AI Governments), the Petition-holder test of `questionPriority` beyond the one in `queue.test.js`.
- **(code-led)**: `controlSupply` override and martial-law subtraction; `coordinationSupply` override (same role; a Region assembly gets it split by population); Observation default spread by population with `obs.defaultSpread`; `setObservationAllocation` registered as an event; routine Questions have no slate threshold (kb), `slate.routine` unused; the debate lives in `polity.debate` (no stored Question object).
- **(spec decision)**: group targets allocation-local; `acceptanceOfEmergency` export; `emergency.obsShare`; audit as an `observationCache` refresh; the slate details above (overhead first, then propaganda draw, cut routine by lowest priority, `gov.standing`, `questionPriority` = gap × Weight × Petition multiplier); tuning keys `slate.*`, `admin.routineOverhead`, `queue.petitionMult`, `defect.threshold`, `observe.*`, `assembly.k`, `assembly.agendaK`, `question.turns.region`, `debate.*`, `emergency.obsShare` (placeholders; values in `tuning.defaults.json`). **2026-11-19/21**: the status vocabulary of the readout (`slate | standing | debate | waiting | unaddressed`); the expiry modifier as a Fairness-type modifier; the extension as a share multiplying both supplies rather than a claim; routine Questions not queued; the queue details listed under Assembly Queue (**pending explicit OK**).
- **Open (kb)**: existential Questions bypassing the cap; `g(Coordination)` shape; Weight × right-strength split; degradation curve beyond proportional; numbers pass (sizes of `s0`, the expiry modifier, `assembly.k` among them); how a Question gets resolved (Question handling).
- **Sync:** (`<section> = <kb rev> / <code rev>`; `-` = no or insufficient code+tests; revs set on tests written but not yet run are provisional)
  - Data Structures > Control Allocation (settled; Allocation Dial semantics settled 2026-11-03) = 1 / -
  - Data Structures > Observation Allocation (settled 2026-11-01; detection settled 2026-11-02) = 1 / 1
  - Data Structures > Question Active Slate (attention commitment — revised 2026-11-02) = 4 / 4
  - Data Structures > Assembly Queue and Question Resolution Time (2026-11-10) = 3 / 3
  - Data Structures > Government upkeep (execution side — settled 2026-11-02) = 1 / -
  - Data Structures > Emergency Powers (settled 2026-11-02) = 1 / -
  - Data Structures > Administration actions (execution layer; classes per `actions__kb.md`) = 2 / -
  - Rules = 4 / -
