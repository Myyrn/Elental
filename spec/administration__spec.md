# Administration — Specification

KB: `kb/administration__kb.md`. Mirror of its `##/###` headings; cross-references live in kb only. Split out of `admin_war_diplomacy__spec.md` (§1) on 2026-11-12. **Synced to kb 2026-11-25 (Assembly Queue rev 6, Administration actions rev 5, Rules rev 7): the decision rule of 2026-11-24 and its object (the answer, confirmed 2026-11-25) are now in code (`decision.js`); the code revs below are provisional until the suite is run.** Besides kb, sources: `src/modules/administration/{module,step,queue,actions,decision}.js`, `src/engine/engine.js` (`resolveTurn` answers, the `onAct` hook), `src/modules/economics/derive.js` (`produceCCOByRegion`), `src/modules/polity/actions.js` (`setControlAllocation`), `src/modules/polity/step.js` (`updateMomentum`: the slate's consumer, 2026-11-19; the expired-debate and petition modifiers, 2026-11-20/22; queue-aware debates, 2026-11-21; a decided debate leaves no modifier, 2026-11-25), `src/modules/diplomacy/covert.js` (Observation dial and detection), `src/client/readoutsAdmin.js` (the `slate` query), `src/ui/{forms,app}.js` and `src/ui/views/apparatus.js` (the slate card and the forms), `tests/{espionage,administration,slate_colonize,debate,queue,handling,decision}.test.js`. Where code and the old spec disagree, **code wins** (**code-led**); where the old spec and the kb disagree, **the kb wins** (the slate section below was corrected on 2026-11-17). Anything the kb does not state is **(spec decision)**; both are listed under Status. Sections the code has not reached are **(target)**: the administration module holds the Control derives, step 6 (the slate, 2026-11-17, then the assembly queue, 2026-11-21, with scopes by faction, 2026-11-22, and the votes on answers, 2026-11-25), the slate readout (2026-11-19), the debate extension (`extendDebates`, 2026-11-20), Question-time Persuasion (`persuade`, 2026-11-22; confirmed 2026-11-24) and the Government's answer (`proposeAnswer`, 2026-11-25).

## Data Structures

State (code today and target):
```js
state.admin.governments[country] = {
  controlDial: {entries}, observationDial: {entries}, spendingDial: {entries, reserve, sink},   // in code
  controlSupply?: number /*scenario/test override of the produced Control*/, controlBonus?: number /*coercion gains (Demotion Duty)*/,   // in code
  coordinationSupply?: number /*scenario/test override of the produced Coordination (same role as controlSupply); a Region assembly gets it split by population, the Empire assembly as it is*/,   // in code (2026-11-17)
  attention: [{questionKey, coordinationCommitted}], standing: string[] /*routine Question keys handled by standing administration*/,   // in code (2026-11-17, written by step 6)
  poolSplit: Record<pool, AllocationDial>, planningPosture: 0..1, borderPolicy, emergency: null | {magnitude, since, addresses: string[]},   // target
  upkeepFraction: 0..1, observationCache: Record<`${kind}|${target}`, {turn, value}>, inventory: Record<good, number> }   // upkeepFraction/inventory written by Economics; observationCache target
state.admin.answers?: Action[]      // in code (2026-11-25): answers adopted by the holders at step 6 ({actor: government, type, params, visibility: 'public', id: 'ans<n>', answerOf: questionKey}); the engine moves them into the planned orders of the NEXT turn and empties the list
state.polity.debate?: Record<questionKey, {since: turn, duration: number, assembly?: 'region:<id>' | 'empire:<country>', holder?: 'government' | cellKey, scope?: 'region' | 'multi' | 'empire', conceded?: number, expired?: true, proposal?: {act: {type, params}, turn}, decided?: {turn, type, id}}>   // in code (2026-11-19/22, `proposal` and `decided` 2026-11-25): opened by the assembly queue at step 6 (assembly, holder and scope set) or by polity for a routine Question in standing administration (no assembly, never voted); `conceded` = the Persuasion given and the Rights granted (as concessions) during the debate; `proposal` = the Government's answer; `decided` set when the holders adopt it; `expired` set once when the debate ends (a decided debate is expired too, with no modifier); removed when the Question stops being live
state.polity.waiting?: Record<questionKey, true>   // in code (2026-11-21): Questions on the slate that the queue gave no slot at the last step 6 (rewritten every turn)
state.polity.petitionClock?: Record<questionKey, {since: turn, refused?: true}>   // in code (2026-11-22): a petitioning cell's Question that nobody discusses; removed with the Question
state.commitments: {..., type: 'extendDebates', actor: {kind: 'government', country}, params: {questionKey}}   // in code (2026-11-20): one per extended Question; dropped when its debate is decided
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
Code: `src/modules/administration/step.js` (`step6`, `questionPriority`, `isListed`, `addressed`, `factionOf`, `questionScope`, `durationOf`, `assemblyOf`, `extensions`, `extensionTurns`, `extensionShare`, `extendedNow`, `debateLength`), `queue.js` (`openDebates`), `decision.js` (`decideDebates`, `onAct`; step 6 runs the slate, then `decideDebates`, then `openDebates`), `module.js` (`steps: {6}`, `onAct`, derives `coordinationSupply`, `slate`, `extensionShare`), `actions.js` (`extendDebates`, `liftExtendDebates`, `persuade`, `proposeAnswer`), `src/modules/polity/step.js` (`updateMomentum`); tests `tests/administration.test.js` (written 2026-11-17, **green since 2026-11-18**), `tests/slate_colonize.test.js` (2026-11-19, **green in the run of 2026-11-20**; its debate-record assertion was adapted on 2026-11-21), `tests/debate.test.js` (2026-11-20), `tests/queue.test.js` (2026-11-21), `tests/handling.test.js` (2026-11-22) and `tests/decision.test.js` (2026-11-25), **not yet run**
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
decideDebates(ctx), then openDebates(ctx) — right after step6: the votes on answers (Assembly Queue), then the queue gives the listed Questions their debating slots (a decided debate has freed its slot)
```
- `Question.tier ∈ {existential, structural, routine}` comes from polity (`derive.polity.questions`, thresholds `tier.existential`, `tier.structural`); Questions exist independent of the slate (trigger `grievance > compliance`); off-slate Questions keep accumulating and their factions may escalate (polity).
- **(code-led, kb wins over the 2026-11-13 sketch)** the old spec looped over routine Questions with a `slate.routine` threshold as well as the overhead; the kb (settled 2026-11-02) says routine Questions are handled by standing administration without a slate commitment, so `slate.routine` is **not read** by the code.
- **(spec decision)** the overhead is charged first and routine Questions are cut by lowest priority when Coordination runs short; the Government's propaganda draw is charged next; `gov.standing` records which routine Questions are handled.
- **(spec decision)** `queue.petitionMult` (placeholder 2) multiplies the priority of a Question whose cell holds the Petition Right; `Weight × gap` is the "f(severity, Weight)" of the polity kb, and the existential > structural > routine tier order comes first.
- Tuning keys (placeholders): `slate.existential` 10, `slate.structural` 5, `slate.routine` 1 (unused), `admin.routineOverhead` 0.1, `queue.petitionMult` 2.
- **The faction and the scope of a Question (kb 2026-11-22, designer)**:
```js
factionOf(q)     = the cells of q's Country that hold a live Question on the same issue (q.cell included), and the Regions they sit in       // issue = the need, the last part of the key
questionScope(q) = regions(faction) = 1 ? 'region' : regions(faction) > 0.5 × (the Country's Regions) ? 'empire' : 'multi'
durationOf(scope) = T(`question.turns.${scope}`)          // 1 / 3 / 5 (placeholders)
assemblyOf(q)    = scope = 'region' ? `region:${region(q.cell)}` : `empire:${country}`
```
- **Addressed Questions, the debate and the escalation freeze (kb 2026-11-19/20, in code)** — the slate's consumer, in polity step 5 (`updateMomentum`), reading what step 6 wrote last turn:
```js
isListed(q, g)   = g.attention has q.key  ||  g.standing includes q.key
debateLength(d)  = d.duration ?? T('question.turns.region')
extendedNow(q)   = an `extendDebates` commitment names q.key, a debate record exists that is not `decided`, and extensionShare(country) < 1           // the Government pays to keep it discussed
addressed(q, g)  = (polity.debate[q.key] ? !debate.decided && turn − debate.since < debateLength(debate) : isListed(q, g) && !polity.waiting[q.key])  ||  extendedNow(q)      // a decided debate is over (2026-11-25)
updateMomentum(q):
  if isListed(q, g) and no debate record and not waiting → polity.debate[q.key] = {since: turn, duration: T('question.turns.region')}      // standing administration (or a direct call): a debate starts WITHOUT a queue slot
  if a debate record exists, not yet `expired`, and !addressed(q, g) → d.expired = true; if (!d.decided) expiryModifier(q, d)            // the debate ended: ONCE; a decided debate was resolved and leaves no modifier
  if addressed → drop the petition clock;  else if no debate record and the cell holds Petition → petitionRefusal(q)        // heard, or asked and refused
  momentum = momentum × (1 − T('mom.decay')) + T('mom.rise') × gap × (addressed ? T('slate.addressedRise') : 1)          // placeholder 0: the rise is frozen, the decay is not
expiryModifier(q, d) = unless d.conceded ≥ T('petition.comparable'): for every cell of factionOf(q):
  cell.fairnessMods.push({id: `debate.${q.key}`, value: T('debate.expiryGrievance') × (cell holds Petition ? T('petition.expiryMult') : 1), decay: opinion.modDecay, turn, source: 'debate'})     // minor; moderate on a petitioning cell; spec decision: Fairness-type
petitionRefusal(q) = clock {since} on first sight; when turn − since ≥ T('petition.grace') and not refused → refused = true; q.cell.fairnessMods.push({id: `petition.${q.key}`, value: T('petition.refuseHit'), decay: petition.refuseDecay, source: 'petition'})      // large, slow, ONCE (confirmed 2026-11-24)
step 5 removes polity.debate[key], the petition clock and the `extendDebates` commitments of every Question that is no longer live (resolved or faded: no modifier); a Question still pressing after its debate (decided or expired) is NOT addressed again until it has stopped being live
```
  A routine Question in standing administration counts as addressed (kb) and is not queued, and has no assembly, so it is never voted on; its debate has the Region length. A Question leaves by ceasing to be live, by its debate expiring, or by its debate being decided (below).
- **Extending a debate (kb 2026-11-20, shape confirmed; in code 2026-11-20, tests not yet run)**: commitment `extendDebates {questionKey}` (Government actor only, class commitment, no gate, public, `costs()` `[]`: the cost is a share taken off the produced supplies, not a claim), event `liftExtendDebates {id}`:
```js
extensionTurns(key) = max(0, turn − debate[key].since − debateLength(debate[key]) + 1)      // k: 0 during the natural timespan, 1 on the first extra turn, 2 on the next, ...
extensionShare(c)   = min(1, Σ over c's extendDebates commitments of T('debate.extendBase') × extensionTurns(key)²)      // s0 × k² per extended Question
controlSupply and coordinationSupply are multiplied by (1 − extensionShare(c))                  // the same share of both
validate: Government actor; the Question is live, belongs to the actor's Country, has a debate record that has neither expired nor been decided (or is listed and not waiting); not already extended
lapse: lifted, or extensionShare reaches 1 (cannot be paid), or the Question stops being live, or the debate is decided (decideDebates drops the commitment) → the debate ends; an unresolved one expires (modifier above)
```
- **Question-time Persuasion (kb Internal Politics, Compliance and Question handling, 2026-11-22, confirmed 2026-11-24; in code, tests not yet run)**: event `persuade {questionKey, amount}` (Government actor only, no gate, public, `costs()` `[]`: the cost is paid from the Ledger inside `apply`):
```js
cost = T('persuade.costK') × amount × Σ population of factionOf(q) / T('persuade.popUnit')
validate: Government actor; the Question is live and of the actor's Country; amount > 0; addressed(q, g) (being discussed); Ledger ≥ cost
apply:    ledger −= cost;  every cell of factionOf(q) gets addOpinionMod({id: `persuade.${turn}.${key}`, value: amount, decay: opinion.modDecay, source: 'persuasion'});  polity.debate[key].conceded += amount
```
  The concession is what makes an unresolved debate leave no modifier once it reaches `petition.comparable`; whether the Question stops being live is the ordinary compliance trigger (the Opinion modifier raises `voluntary_compliance`). **A Right as a concession (kb 2026-11-24, confirmed; in code 2026-11-25)** is the module hook `onAct` (below). Standing Persuasion is not in code; `persuade` itself is not an answer to vote on.
- **A Right granted during a debate is a concession (kb 2026-11-24; in code 2026-11-25, tests not yet run)**: the engine calls `module.onAct(ctx, a, t)` for every module before an action applies (`engine.js` `step2`; it reads the state the act is about to change, like `axisShift`). Administration's `onAct` (`decision.js`):
```js
entitlementSize(ctx, a, keys) = {loss: {key: impact.cost}, gain: {key: impact.relief}}      // registry.get(a.type).impact?.(ctx, a, key); {0, 0} for a type without `impact`; derived, never stored
rightConcession(ctx, a, keys) = T('concession.rightK') × mean over keys of gain[key]        // 0 for no keys; a loss the act imposes is NOT subtracted
onAct(ctx, a, t): skip unless a.actor.kind === 'government' && t.impact && a.type ∉ NOT_ANSWERS {proposeAnswer, persuade, extendDebates, liftExtendDebates}
  for each live Question q of the actor's Country with a debate record that is neither decided nor expired and is addressed:  c = rightConcession(ctx, a, factionOf(q).cells);  if (c > 0) debate.conceded += c
```
- **Slate readout (kb consumer order 1, in code 2026-11-19; `waiting` and assemblies 2026-11-21; scope and handling 2026-11-22; proposal and decided 2026-11-25)**: `derive.administration.slate(country)` = `{attention, standing, questions: [{key, cell, need, tier, gap, priority, scope, petition, handling, status, debate}], unaddressed: key[], waiting: key[], assemblies: [{assembly, cap, slots, open}]}`, sorted tier then priority then key; `handling` = `'debated'` (discussed, the cell holds Petition), `'consulted'` (discussed, no Petition), `'ignored'` (not discussed); `status` = `'slate'` (on attention and debated), `'standing'` (routine in standing administration), `'debate'` (a debate is open or extended though the slate no longer lists it), `'waiting'` (listed but its assembly gave no slot: not addressed), `'unaddressed'` (its faction may escalate; includes a listed Question whose debate has ended or been decided). `debate` is the record, with the proposed answer and, once adopted, `decided`; `open` of an assembly counts debates that are neither expired nor decided. Derived, nothing stored. The UI reads it through the query `slate` (`client/readoutsAdmin.js`: the readout plus `heldShare`, the supplies, the extensions with their k and the free-colonization commitments) and draws the **Question slate and debates** card in the Apparatus workspace (2026-11-21, with handling, scope and the concession 2026-11-22; `ui__spec.md`; the card does not show the proposed answer yet).
- Tuning keys (2026-11-19/25, placeholders unless noted): `slate.addressedRise` 0, `question.turns.region` 1, `question.turns.multi` 3, `question.turns.empire` 5, `debate.expiryGrievance` 0.05, `debate.extendBase` 0.05, `petition.grace` 1, `petition.refuseHit` 0.3, `petition.refuseDecay` 0.03, `petition.expiryMult` 3, `petition.comparable` 1, `persuade.costK` 1, `persuade.popUnit` 1000, **`decision.majority` 2/3 (authored, designer 2026-11-24) and `concession.rightK` 1 (placeholder), both in `tuning.defaults.json` since 2026-11-25: run `npm run build:data`**.

### Assembly Queue and Question Resolution Time (2026-11-10)
Code: `src/modules/administration/queue.js` (`assemblyCoordination`, `queueCap`, `holderStrength`, `agendaOf`, `agenda`, `parseAssembly`, `openDebates`, **written 2026-11-21/22, tests not yet run**), `src/modules/administration/decision.js` (`decideDebates`, `votersOf`, written 2026-11-25, not yet run), `economics/derive.js` (`produceCCOByRegion`, `economics__spec.md`); debate state in `polity.debate` / `polity.waiting` (Questions are derived: there is no stored Question object)
```js
assemblyCoordination(Region r)  = (gov.coordinationSupply defined ? gov.coordinationSupply × pop(r's cells) / pop(the Country's cells) : economics.produceCCOByRegion(r).coordination) × (1 − extensionShare(owner))      // the pools staffed from r's cells, degraded like the Country's; Σ over a Country's Regions = produceCCO(country)
assemblyCoordination(Empire c)  = (gov.coordinationSupply ?? economics.produceCCO(c).coordination) × (1 − extensionShare(c))      // the whole Country
queueCap(scope)                 = max(1, floor(T('assembly.k') × assemblyCoordination(scope)))       // derived, never stored; at least one slot
holderStrength(cell)            = (right(cell, 'Petition') ? 1 : 0) + #{Council* rights the cell holds (=== true)}
agendaOf(assembly): holders = cells of the assembly (a Region's, or all the Country's) with holderStrength > 0;  share(h) = T('assembly.agendaK') × Weight(h) × holderStrength(h) / Σ Weight(the assembly's cells)  (scaled down if Σ shares > 1)
  slots[h] = floor(cap × share(h));  slots.government = cap − Σ slots[h]        // the Government keeps whatever the holders do not claim
openDebates(ctx)   (step 6, after the slate and after decideDebates):
  occupancy = open debates with an assembly: !expired and !decided and (turn + 1 − since < length  ||  extended)        // an extension keeps the slot; an expired or a decided debate frees it
  for each Country, candidates = Questions on gov.attention without a debate record, sorted tier, priority desc, key
    scope = questionScope(q);  assembly = assemblyOf(q, scope)                // region:<id> for a Question of one Region, else empire:<country>
    holder = (slots[q.cell] > 0) ? q.cell : 'government'                      // a holder opens its own cell's Questions in its own share
    free slot for the holder → polity.debate[q.key] = {since: turn + 1, duration: durationOf(scope), assembly, holder, scope}
    else → polity.waiting[q.key] = true                                       // not debated, not addressed: its faction may escalate
  polity.waiting is rewritten every turn; routine Questions in standing administration are NOT queued
```
- **Confirmed 2026-11-21 (designer)**: the cap mapping (`assembly.k` 0.2, linear in the Assembly's Coordination); the agenda-share formula and Petition (and each Council seat) carrying a share; a holder opens only its own cell's Questions; the Government's slots are the remainder; a waiting Question is not addressed. **Designer 2026-11-22**: the scope (and with it the length and the assembly) of a Question follows its faction. **Confirmed 2026-11-24**: multi-Region and country-wide Questions in the Country's assembly (the Empire assembly with the Country's Coordination and all its cells as potential holders). **Still a spec decision** (a scenario/test hook, not in the kb): `since` = next turn; the population split of an overridden `coordinationSupply`.
- A Question holds its slot from the turn it starts debate until its natural length is over, or longer while extended, or until it expires or is decided; the queue and the slate are independent limits, both Coordination-derived.
- **Resolution by decision — Quickening (kb 2026-11-24, designer rule; the object confirmed 2026-11-25; in code 2026-11-25, tests not yet run)**: a debated Question can be decided on **any turn of its debate**, without waiting for its duration, when **two thirds of the voting Weight is in favour** (an absolute majority of all the voters, not of those who take part) **and nothing gates it** (no refusing covering Veto holder). This **replaces** the earlier sketch (a Weight majority above 0.5 with no strong veto, or full consensus under a strong veto). The decision object is an **answer** of the Government (`actions.js`, `decision.js`):
```js
// event proposeAnswer {questionKey, act: {type, params}}  — Government actor only; class event; ungated (gateDomain null); public; costs() []
validate: the Question is live, of the actor's Country, and its debate has an assembly, has neither expired nor been decided, and is addressed;
          act.type is a registered type, not in NOT_ANSWERS {proposeAnswer, persuade, extendDebates, liftExtendDebates};  the act's own validate({actor, type, params}) is ok
apply:    polity.debate[key].proposal = {act: {type, params: structuredClone(params ?? {})}, turn}                 // one per debate, replaceable while the debate is open
votersOf(ctx, d, act) = cells of d.assembly (a Region's or the Country's) with holderStrength > 0   ∪   polity.gateHolders(ctx, act.actor, domain)   (domain = the act type's gateDomain; none → no Veto voters)      // sorted, unique
decideDebates(ctx) (step 6, after the slate, BEFORE openDebates), for each debate (sorted by key) with a proposal, an assembly, not decided, not expired, whose Question is live:
  act = {actor: government of the Question's Country, type, params, visibility: 'public', answerOf: key}
  skip if the act type's validate says not ok now;  skip if gate(ctx, act).blocked          // a covering Veto holder (or a foreign Veto) refuses
  voters = votersOf(...);  W = polity.weight
  if voters is not empty:  fns = polity.stanceFns(ctx, act.type);  yes = Σ W(h) for h in voters with approves(stance(h, act, ctx, fns), ctx)
                           skip unless yes ≥ T('decision.majority') × Σ W(h)               // the stance skeleton: self-interest (acceptance + relief − cost) × Preference alignment
  (no voters → the Government answers alone: adopted at once, the gate above being clear)
  adopt: state.admin.answers.push({...act, id: nextId('ans')});  debate.decided = {turn, type, id};  drop the debate's `extendDebates` commitment;  return the key
resolveTurn (engine): planned = [...orders, ...aiOrders, ...state.admin.answers];  state.admin.answers = []       // the adopted act runs at the NEXT step 2: validated against the start-of-turn state, gated again by the ordinary gate(), logged, with its `loads`
the debate ends RESOLVED: addressed() is false from now on (the freeze ends), the slot is free, step 5 marks it expired WITHOUT the expiry modifier, momentum rises again if the Question is still pressing
```
  **(spec decision, proposed 2026-11-25)**: the check runs before the queue opens new debates (a freed slot is used the same step); the adopted act is gated once more at execution (the state may have changed since the vote), so it can still be refused then; a proposal that is invalid or gated just stays until the debate ends or it is replaced; routine Questions in standing administration (no assembly) are never voted; the stance's self-interest input is `acceptance + relief − cost` of the act's `impact` on the voter (polity `stanceFns`), as for any Veto holder. **Not decided by the designer**: a Government answer to a Question that has no debate (it is an ordinary act: ordinary gate, force-through, entitlement loss).
- Open: existential Questions bypassing the cap; `g` shape and Weight × right-strength split (numbers pass).

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
Code: `polity/actions.js` (`setControlAllocation`, `placeRequisition`), `diplomacy/covert.js` (`setObservationAllocation`), `administration/actions.js` (`extendDebates`, `liftExtendDebates`, 2026-11-20; `persuade`, 2026-11-22; `proposeAnswer`, 2026-11-25); the rest none. Forms: `ui/forms.js` (`extendDebates`, `liftExtendDebates`, 2026-11-21; `persuade`, 2026-11-22; `proposeAnswer`, 2026-11-25)
| Type id | Class | Gate | Status |
|---|---|---|---|
| `setControlAllocation {entries}` | dial | administration | in code |
| `setObservationAllocation {entries}` | dial (code: event) | — | in code (class to fix) |
| `setPoolSplit {pool, entries, reserve?, sink?}` | dial | administration | target |
| `declareEmergencyPowers`, `liftEmergencyPowers` | commitment / event | administration | target |
| `extendDebates {questionKey}` | commitment | — | in code (2026-11-20, not yet run): share of Control and Coordination taken off the supplies, `s0 × k²` |
| `liftExtendDebates {id}` | event | — | in code (2026-11-20, not yet run) |
| `persuade {questionKey, amount}` | event | — | in code (2026-11-22, not yet run; **confirmed 2026-11-24**): Ledger-paid decaying Opinion modifier on the faction, a concession in the debate |
| `proposeAnswer {questionKey, act}` | event | — | in code (2026-11-25, not yet run; **confirmed 2026-11-25**): attaches the answer the holders vote on; adopted by two thirds of the voting Weight with no refusing Veto (Assembly Queue) |
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
5. Questions are polity state, independent of `attention` (step 6 writes only `attention` and `standing`); an addressed Question (debated, or routine in `standing`, or extended) has the rise of its momentum frozen only while it is discussed (`updateMomentum`, `slate.addressedRise`); a Question on the slate that the queue gave no slot waits and rises; the rise resumes when the debate ends while it is still pressing, and an unresolved ending leaves the expiry modifier once on the faction's cells (2026-11-19/22).
6. Requisition scope is enforced through `controlGrant` additively per covered cell (target: `requisitionEnforcementShare`).
7. Government propaganda draws on Coordination (step 6 subtracts the draw of its commitments before the slate).
8. Routine Questions cost `admin.routineOverhead` each of Coordination (in code); Observation controls the stamp of off-slate escalation (target).
9. `detectionStrength = observationAt + counterIntel` (in code; Diplomacy owns the thresholds).
10. Default unit of a dial is the cell (`cellsCovered`).
11. Surplus auto-fill costs nothing: no claim, no order (in `resolveAllocation`).
12. `queueCap` derived each turn from the assembly's Coordination, at least 1 (in code, 2026-11-21; confirmed).
13. Government holds the whole agenda by default; Council/Petition holders claim `agendaShare` of the slots and open their own cell's Questions (in code, 2026-11-21; confirmed).
14. The length of a debate is 1 / 3 / 5 turns by the scope of the Question's faction (in code, 2026-11-22); **it can be decided on any turn when two thirds of the voting Weight is in favour of the Government's proposed answer and no Veto holder refuses it; a decided debate ends resolved (no expiry modifier, freeze over, slot freed) (kb 2026-11-24/25; in code 2026-11-25, not yet run)**.
15. Slate and queue are independent limits (in code).
16. `extendDebates`: the held share of Control and Coordination is `min(1, Σ s0 × k²)` over the extended Questions, applied by multiplying both supplies by `1 − share` (in code, 2026-11-20); an extended debate keeps its queue slot.
17. The scope of a Question is the scope of its faction: one Region = 'region' (that Region's assembly); several Regions, not more than half of the Country's = 'multi'; more than half = 'empire' (the Country's assembly) (in code, 2026-11-22; the designer's rule, the Country's assembly for the last two confirmed 2026-11-24).
18. `persuade` pays from the Ledger, gives the faction a decaying Opinion modifier and records a concession in the debate; a concession of `petition.comparable` leaves an unresolved debate without a modifier; it is not an answer to vote on (in code, 2026-11-22, not yet run; confirmed 2026-11-24).
19. **(2026-11-25)** An adopted answer is run by the engine as an ordinary Government action at the next step 2 (`state.admin.answers` → planned orders); a Right (any Government act with a gain for the faction) taken during a debate adds to its `conceded` through the module hook `onAct`, before the act applies.

## Status
- **In code**: Control derives, Observation dial and `observationAt`/`detectionStrength`, `setControlAllocation`, `setObservationAllocation`, `placeRequisition`; **since 2026-11-17 step 6**: `coordinationSupply`, `questionPriority`, `step6` writing `gov.attention` and `gov.standing`, tuning key `queue.petitionMult`. `tests/espionage.test.js` covers the Observation dial and additive detection; `tests/administration.test.js` (2026-11-17, **green since 2026-11-18**) covers the slate: tier order, thresholds, routine overhead and shortfall, propaganda draw, priority within a tier, the one-turn lag through a real turn. No test asserts `controlGrant` directly (it is exercised through polity compliance and `tests/internal_conflict.test.js`).
- **Written 2026-11-19, green in the run of 2026-11-20** (`tests/slate_colonize.test.js`): the slate readout `derive.administration.slate`, `isListed`/`addressed`, the debate record `polity.debate` and the escalation freeze in `polity/step.js` `updateMomentum`; the slate has its first consumer (kb order 1 and 2).
- **Written 2026-11-20/22, tests written the same days and not yet run** (`tests/debate.test.js`, `tests/queue.test.js`, `tests/handling.test.js`; run `npm run build:data` for the new keys first, then `npm test`; `autotest.bat` calls `npm test`): the expired-debate modifier, `extendDebates` / `liftExtendDebates`, the supplies × (1 − held share); the assembly queue (`queue.js`: cap from the assembly's Coordination, agenda shares, slots, `polity.waiting`), `economics.produceCCOByRegion`, queue-aware `addressed` and `updateMomentum`; **the scope of a Question by its faction (1 / 3 / 5 turns, Region or Country assembly), handling, the petition clock and the moderate expiry modifier, `persuade`**; the `slate` UI query, the Apparatus card and the forms.
- **Written 2026-11-25, tests written the same day and not yet run** (`tests/decision.test.js`, 8 tests, added to `npm test`): `administration/decision.js` (`decideDebates`, `votersOf`, `entitlementSize`, `rightConcession`, `onAct`), the action `proposeAnswer`, the engine changes (`answers` into the planned orders, the `onAct` hook before `apply`), a decided debate being over in `addressed`/`extendedNow`/the queue/`updateMomentum`, the form `proposeAnswer`, the keys `decision.majority` and `concession.rightK`. **Risks to look at first when the suite is run**: `Veto.administration` and `Petition` as rights in the fixtures' ruleset (the test builds them); any existing test that compares the whole state after a turn (the engine now writes `state.admin.answers = []`); a test that counts the forms (30 now); the stub act type registered inside `tests/decision.test.js`.
- **Not in code**: standing Persuasion, defection (Economics side unverified), Emergency Powers, audits, planning posture, border policy, pool split action, stamps, Observation stamp wiring, consumers 5 (Emergency Powers) and 6 (AI Governments); the slate card does not show the proposed answer or the vote.
- **(code-led)**: `controlSupply` override and martial-law subtraction; `coordinationSupply` override (same role; a Region assembly gets it split by population); Observation default spread by population with `obs.defaultSpread`; `setObservationAllocation` registered as an event; routine Questions have no slate threshold (kb), `slate.routine` unused; the debate lives in `polity.debate` (no stored Question object).
- **(spec decision)**: group targets allocation-local; `acceptanceOfEmergency` export; `emergency.obsShare`; audit as an `observationCache` refresh; the slate details above (overhead first, then propaganda draw, cut routine by lowest priority, `gov.standing`, `questionPriority` = gap × Weight × Petition multiplier); tuning keys (placeholders; values in `tuning.defaults.json`). **2026-11-19/22**: the status vocabulary of the readout (`slate | standing | debate | waiting | unaddressed`) and the handling vocabulary; the expiry modifier as a Fairness-type modifier; the extension as a share multiplying both supplies rather than a claim; routine Questions not queued and with the Region length; the petition refusal clock, the expiry multiplier, the comparable concession and `persuade` (cost formula, Opinion modifier) — **the Country's assembly and the whole Petition/Persuasion shape were confirmed 2026-11-24; the decision object and the concession shape of a Right were confirmed 2026-11-25**. **2026-11-25, awaiting OK (the kb lists them)**: the check before the queue, the adopted act gated again at execution, a proposal that stays when invalid or gated, routine Questions never voted, the `onAct` hook as the home of the Right-as-concession, `NOT_ANSWERS`.
- **Open (kb)**: existential Questions bypassing the cap; `g(Coordination)` shape; Weight × right-strength split; degradation curve beyond proportional; numbers pass (sizes of `s0`, the expiry modifier, `assembly.k`, the petition, persuasion and concession keys among them); standing Persuasion.
- **Sync:** (`<section> = <kb rev> / <code rev>`; `-` = no or insufficient code+tests; revs set on tests written but not yet run are provisional)
  - Data Structures > Control Allocation (settled; Allocation Dial semantics settled 2026-11-03) = 1 / -
  - Data Structures > Observation Allocation (settled 2026-11-01; detection settled 2026-11-02) = 1 / 1
  - Data Structures > Question Active Slate (attention commitment — revised 2026-11-02) = 5 / 5
  - Data Structures > Assembly Queue and Question Resolution Time (2026-11-10) = 6 / 6
  - Data Structures > Government upkeep (execution side — settled 2026-11-02) = 1 / -
  - Data Structures > Emergency Powers (settled 2026-11-02) = 1 / -
  - Data Structures > Administration actions (execution layer; classes per `actions__kb.md`) = 5 / 5
  - Rules = 7 / -
