# Administration, War & Diplomacy — Detailed Specification

Status: first detailed pass (2026-11-04). Expands §4-§6 of `modules__spec.md`. Source:
`administration__kb.md`, `war__kb.md`, `diplomacy__kb.md` (re-read in full for this pass),
`actions__kb.md`. Rules and order come from the kb; formulas are open until the numbers pass,
so each is a **(spec decision)** with its numbers in `ruleset.tuning` as `placeholder`
(catalogue §10, shipped in `scenarios/alpha/tuning.defaults.json`). Beyond alpha and therefore
only hooks: Characters (named commanders, ransom, Succession/Common Ruler), naval fleet combat,
fog-of-war layer.

## Data Structures

### 1. Administration

```js
// state.admin.governments[country]
{ ledger, spendingDial, controlDial, observationDial, poolSplit: Record<pool, AllocationDial>,
  planningPosture /*0..1*/, borderPolicy, emergency: null | {magnitude, since, addresses:string[]},
  attention: [ {questionKey, coordinationCommitted} ], upkeepFraction /*0..1 this turn*/,
  observationCache @cache: Record<`${kind}|${target}`, {turn, value}>, inventory: Record<good, number> }
```
```js
// administration/derive.js
function envelopeSupply(ctx, country) {                        // Economics.produceCCO per axis, from committed pool units (poolSplit result)
  const e = ctx.derive.economics.produceCCO(country)           // {control, coordination, observation}, already reduced by unmetFraction per pool
  return {control: e.control, coordination: e.coordination - emergencyCost(ctx, country), observation: e.observation}
}
const controlResult = (ctx, country) => resolveAllocation(gov(ctx, country).controlDial, envelopeSupply(ctx, country).control, ctx)   // pure, every turn
const controlGrant = (ctx, cell) => grantFor(controlResult(ctx, countryOf(cell)), cell.key) + requisitionEnforcementShare(ctx, cell)  // additive stacking
const observationAt = (ctx, country, cellOrRegion) => grantFor(observationResult(ctx, country), key) // Σ over cells of the Region for a Region read
const emergencyCost = (ctx, c) => !gov(c).emergency ? 0 : gov(c).emergency.magnitude * (1 - ctx.derive.polity.acceptanceOfEmergency(c))   // derived each turn; NO duration term
function stampFor(ctx, viewer, kind, target) {                  // visibility stamp attached to every political/covert/foreign query
  const obs = observationAt(ctx, viewer, target), full = ctx.T('observe.liveThresholdPerPop') * population(ctx, target)
  if (domesticTarget(viewer, target)) return obs >= full ? 'live' : obs >= ctx.T('observe.estimateFraction') * full ? 'estimated' : lastSeen(gov, kind, target) ? 'stale' : 'unknown'
  return foreignStamp(ctx, viewer, kind, target)               // via Diplomacy detection / Cooperation; 'unknown' is never guessed
}
// every 'live' read refreshes observationCache (for later 'stale' reads); the cache is a presentation cache, never read by simulation
```
```js
// administration/step.js — step 6: slate for NEXT turn (lags one turn)
function step6(ctx) {
  for (const country of countries(ctx)) {
    let coord = envelopeSupply(ctx, country).coordination
    coord -= ctx.T('admin.routineOverhead') * countRoutineQuestions(ctx, country)               // continuous overhead; shortfall -> routine Questions unaddressed (not removed)
    coord -= propagandaDraw(ctx, country)                                                       // Government propaganda draws on the Coordination pool
    const g = gov(ctx, country); g.attention = []
    for (const q of questionsOf(ctx, country).sort(bySeverityTier)) {                           // existential > structural > routine
      const th = ctx.T(`slate.${q.tier}`); if (coord >= th) { g.attention.push({questionKey: q.key, coordinationCommitted: th}); coord -= th }   // fixed threshold, no slot formula
    }
  }
}
// upkeep degradation (applied by economics.ledgerUpdate): pool.cco *= (1 - unmetFraction_pool); cut order = spendingDial priority; never spawns Questions
function leaderlessDefection(ctx, g, pool) {                    // deeply unmet pool: labour returns to ORIGIN cells; armed contribution only if rung + Retinue (War resolves)
  if (unmetFraction(g, pool) > ctx.T('defect.threshold')) returnLabourToOriginCells(ctx, g, pool)
}
```
Actions: `setControlAllocation`, `setObservationAllocation` (dial entries), `setPoolSplit(pool, dial)`, `setPlanningPosture`, `setBorderPolicy`, `declareEmergencyPowers` (commitment; cost derived each turn), `escalateExternalQuestion`, `commissionAudit` — registered by `administration/actions.js` with the gate domains from `kernel_engine__spec §8`.

### 2. War — graph, movement, supply

```js
// war/state.js
state.war = { units: Record<Id, Unit>, armies: Record<Id, Army>, garrisons: Record<provId, Garrison>, wars: War[],
              score: WarScoreEntry[], sieges: Record<provId, {besieger, progress, since}>, occupations: Record<CellKey, Occupation>,
              training: Record<`${armyId}|${target}`, ModifierStack>, techTier: Record<countryId, 'cold_steel'|'gunpowder'> }
// Unit {id, originCell, composition: Record<pool,n>, equipmentTier, armorInvested(0..1), strength, cohesion, position, supply(0..1), wounded: [{n, returnTurn}]}
// Army {id, owner, side, units[], tactic, stance, position:{province, entrySide, routeSide, depths:{vanguard,center,rearguard}}, routePath?}
```
```js
// movement graph: land edges of the World Map only (NOT Economics' trade-zone edges)
function stepAllowed(ctx, a, b, army) {                        // a,b = province ids
  if (!edgePassable(a, b, ctx.state.world.edges, terrainOf)) return false                          // Mountain interior blocked unless pass (confirmed)
  if (forestBlocked(ctx, b) && !armyHasTrait(army, 'forest_movement')) return false               // forestation >= T('war.forest.block')
  const e = edge(a, b); if (e?.type === 'river' && !e.bridge) return {costMult: T('war.river.cost')}   // River: crossing penalty, hard-block only if a Fortress holds the edge
  if (e?.fortress && hardCapable(e) && !reduced(e)) return false                                    // hard blockade until reduced by siege
  return true
}
const edgeQuality = (ctx, a, b) => infra(a) * edgeTypeModifier(edge(a, b))                          // gates the ATTACKER on its committed route; defenders use the full network
function moveArmy(ctx, army) {
  const speed = Math.min(speedOf(army, 'center'), speedOf(army, 'rearguard'))                      // Vanguard exempt
  if (army.rerouted) { army.rerouted = false; return }                                              // reroute is always legal, costs a full turn, zero progress
  advance(army, speed * (attacking(army) ? edgeQuality(ctx, ...) : 1))
}
function supplyState(ctx, unit, army) {                        // 0..1, derived each turn
  const src = nearestValidSource(ctx, army)                    // warehouse with sufficient stock, reachable through OWNED/ALLIED/ACCESS-GRANTED territory only (Diplomacy access)
  if (!src || pathSevered(ctx, src, army)) return 0
  return clamp01(1 - T('war.supply.decay') * pathDistance(src, army) * terrainPenalty(path) * (1 - T('war.supply.infraRelief') * meanInfra(path)))   // infrastructure reduces decay
}
function drawUpkeep(ctx, army) {                               // real zero-sum draw against the nearest warehouse (competes with civilian consumption)
  for (u of army.units) for (good of upkeepGoods(u)) takeFromWarehouse(ctx, src, good, upkeepQty(u, good))   // market price by default; wartime Requisition overrides pre-cascade
  // Vanguard local requisition draws occupied territory directly -> a requisition (two Opinion hits toward the occupier + Occupation Grievance)
}
// Interdiction: enemy occupation of a transit province breaks the edge for pathing this turn; besieging the source cuts it entirely.
// Alpha naval: sea lanes carry transport + supply only, capacity limited by the Ships good; no fleet combat, no naval pool.
```

### 3. War — fielding, garrison, battle

```js
function fieldUnits(ctx, a) {                                  // commitment: labour via Levy Duty, goods once from recruiting-Region warehouses
  consume(ctx, a.params.heavyIndustryGoods, warehousesOf(regionOf(a.params.originCell)))              // fielding goods come from provincial warehouses
  labour: claim pool units from originCell (Army pools only), recorded in unit.originCell
}
function refillGarrisons(ctx) {                                 // recurring anonymous claim; no origin accounting
  for (p of provinces) { cap = h(fortificationLevel(p)); want = Math.min(cap, cap * priorityDial(regionOf(p))); draw from Army pools by priority (0 = field units first) }
}
function resolveBattle(ctx, clash) {
  const subs = pairUp(clash)                                    // sub-units resolve PAIRWISE, never pooled
  const env = u => baseEnvelope(u.pool) * estateModifier(u.originEstate, u.pool) * terrainModifier(terrain, u.pool)     // then trait interactions below
  let state = skirmish(subs)  ->  melee(state)  ->  rout(state)  // sequential, state carries forward
}
function skirmish(subs) {      // ranged vs ranged full effect; ranged vs melee-tagged = harassment (x T('war.skirmish.harass'))
  for (s of subs) dmg = rangedAtk(s.a) * interaction(tag(s.a), tag(s.b)) * (1 - armorMitigationVsRanged(s.b)) ; apply(s.b, dmg) }
function melee(state) {
  screening = u => discipline(u) * reachBonus(u) * tacticModifier(u.army.stance)      // contest: mounted bypass to fragile ranged (charge_bonus) or forced into reach engagement
  chargeBonus = u => T('war.k.charge') * speed(u)                                      // derived, never stored
  armorMitigation = u => T('war.k.armor1') * u.armorInvested                          // penetration (gunpowder ranged) discounts mitigation vs RANGED only
  armorSpeedPenalty = u => T('war.k.armor2') * u.armorInvested * techModifier(tier) * nationMaterialMod(u.nation).speedPenaltyMult
  duels independent per sub-unit; cascading reinforcement applies flankingBonus = T('war.flank')
  gunpowder: effectiveness *= 1 + T('war.gunpowder.bonus') * u.supply  (cut off -> degrades toward/below cold-steel baseline)
}
function rout(state) { cohesionAgg = Σ cohesion / n ; cohesionAgg < T('war.rout.threshold') ? cleanBreak(pursuit casualties ∝ speed) : orderlyWithdrawal }
// afterwards: cohesion persists per unit: win +T('war.cohesion.win'); stalemate/loss −T('war.cohesion.loss'); bounded [0,1], never reset
// casualties: Killed (permanent, deducted from originCell's Army pool) · Wounded (T('war.wounded.share'), return after T('war.wounded.delay')) · Captured: open (post-alpha hook)
// formation cohesion gate: spread = max(depths) - min(depths); spread > T('war.spread.max') => closest pair fights first, remainder delayed/misses
// evasion/compel: gate (attacker speed threatens interception) -> Vanguard vs Vanguard screening_strength -> disengage | deflect | battle at current depths
```
Sieges, blockade, occupation:
```js
const blockadeType = (ctx, f) => (['mountain_pass','river'].includes(f.edge.type) || forestation(f.hex) >= ctx.T('war.forest.block')) ? 'hard-capable' : 'soft-only'   // derived on read
function siegeTick(ctx, s) {
  s.progress += T('war.siege.rate') * siegeCorps(s.besieger) * supply(s.besieger) - T('war.siege.defRate') * fortification(s.province) * garrison(s.province) * supply(defender)
  logWarScore(ctx, {cause: 'siege', targetCells: cellsOf(s.province)})                          // every turn it holds
  if (s.progress >= T('war.siege.capture')) capture(ctx, s.province, s.besieger)
}
function capture(ctx, province, byWhom) {            // occupation modifiers applied to the province's population share of each cell (until step-8 re-derivation)
  for (cell of cellsIn(province)) occupations[cell.key] = {occupier: byWhom, martialLaw: true, sympathy: liberatorOrOccupied(ctx, cell, byWhom)}
  // consequences (faction-eligibility exclusion, Grievance:Occupation or liberator bonus, hampered Espionage, Control cost) are READ by polity/admin; War does not duplicate them
}
const garrisonDemand = (ctx, cell) => T('war.garrison.perPop') * cell.population * (1 + cell.grievance.occupation)       // soft: troops and Control are substitutable
const martialLawControlCost = (ctx, cell) => T('war.martialLaw.control') * cell.population * shortfallFraction(garrisonDemand, troopsPresent + controlSubstitute)
const uprisingThreshold = (ctx, cell) => T('war.uprising.base') * (1 + occupied ? T('war.martialLaw.raise') : 0) * (1 - unmetGarrisonFraction(ctx, cell))   // unmet garrison LOWERS the threshold
```
Removal: peace ratification (Diplomacy step 7) or unilateral Annexation (forced-annexation CB + per-observer overreach). Civil-war martial law reuses `martialLawControlCost`; Occupation Grievance does not apply.

### 4. War — score, exhaustion, peace, internal conflict, training

```js
function logWarScore(ctx, {side, targetCells, cause, harm}) { ctx.state.war.score.push({side, target_cells: targetCells, cause, harm, turn: ctx.state.meta.turn}) }  // per-cell harm in existing stocks; never spendable
const warScore = (ctx, side) => Σ inflicted − Σ received                           // running signed total — context only
const exhaustion = (ctx, cell) => ctx.derive.polity.warAttributableGrievance(cell)   // read-only; Country exhaustion = aggregate readout; never an input
function peaceEvaluation(ctx, side, terms) {                                          // capability assessment, WarScore is CONTEXT, never an arithmetic term
  return stance(side, terms, ctx, {
    selfInterest: (s, t) => continuationCapability(ctx, s) - termCost(ctx, s, t),     // remaining Supply, composition/readiness, occupied territory, exhaustion headroom per cell, treaty commitments
    modifier:     (s, t) => 1 + T('war.peace.scoreWeight') * normalised(warScore(ctx, s)) })
}
// exhaustion can spawn a peace Question regardless of original stance/Veto (actor-forced escalation); Veto-to-declare and Veto-to-continue share ONE stance function:
//   stanceFns('declareWar') === stanceFns('continueWar'); the difference comes from live state (exhaustion), not a separate curve.
function internalArmedConflict(ctx) {   // faction armed rung: same combat/supply/siege/occupation machinery; side need not be a Country
  rebelUnits: only from rebelling cells' Army pools via the scalar Retinue Right (fraction of cell Army labour); rebel supply = warehouses in rebel-held territory;
  end states: concession (grievance addressed) | suppression (martial law on those cells) | secession (Countries Formation via Statehood Pathway)
  peace = the SAME Peace Conference with Rights/Duties-vocabulary terms
}
function troopTrainingTick(ctx, army, target) {   // public commitment; army must sit in a border Region adjacent to the target Country/Bloc; inherits Garrison/Hold's supply draw
  if (!inBorderRegionAdjacent(army, target)) return
  push(training[`${army.id}|${target}`], {value: T('war.training.k') * troopCount(army) * efficiency(army), decay: {kind:'exp', rateKey:'war.training.decay'}})
}   // feeds Diplomacy's Military Leverage readout; stacks additively with exhaustion, never replaces it
```

### 5. Diplomacy

```js
// state.diplomacy = { treaties: Treaty[], cbs: CB[] (event-based only), leverage: Record<pairKey, ModifierStack>, covert: CovertOp[], grants: FacilitationGrant[],
//                     proposals: Proposal[] }
// CB derivation: state-based + structural are DERIVED each read, only event-based are stored
function activeCBs(ctx, holder, target) {
  return [ ...stateBased(ctx, holder, target),                         // unremedied breach, occupied territory, blocked edge — persist while the fact holds (no timer)
           ...ctx.state.diplomacy.cbs.filter(cb => cb.holder === holder && cb.target === target && value(cb.mods) > ctx.T('eps.cb')),   // event-based: decaying, persistence scales with tier
           ...structural(ctx, holder, target) ]                        // nationalism/claims from Nations data; militaristic disposition (Ruthlessness + war record in Decision Log)
}
const cbDecayKey = tier => `cb.decay.${tier}`                          // Grievance fastest ... Sovereignty/Existential slowest
const oppressionTier = (ctx, intervener, nation) => isTitularOrKin(ctx, intervener, nation) ? 'Sovereignty' : 'Rights'   // 'at most'
function overreach(ctx, cb, goals, observer) {                         // PER OBSERVER, never global
  const magnitude = T('overreach.k') * tierGap(cb.tier, goalsTier(goals))
  return magnitude * closeness(ctx, observer, victim)                  // alliance tier, kin ties, trade dependence
}                                                                       // applied as a hit on THAT observer's Reputational Leverage stack toward the overreacher
const externallyRecognised = (ctx, cb) => !sanctionedAway(ctx, cb)     // independent of tier; Defensive-tier allies trigger only if true; target's own population still recognises it
// Treaties & axes — each axis declares engine hooks (data in ruleset.axes + code in diplomacy/axes.js):
```
| Axis | Engine hook |
|---|---|
| CultureLanguageSovereignty | `countries.titularForced(subject)` → forces titular Nation; unblocks forced change |
| MilitaryCap | caps Levy Duty / Army sub-pool ceiling in `war.fieldUnits` validate; breach emits event-based Rights CB for neighbours |
| ForeignPolicy | `proposeTreaty` by target requires grantee consent (gate) |
| TradeAccess | forces tariff exemption/embargo vs a third party in `economics.frictionOf` / `zoneEdgeGate` |
| Fortification | `economics.construct` validate rejects/forces dismantle in scope |
| ResourceExportBan | `zoneEdge.throughputCap[good] = 0` on the edge |
| LaborMigrationBan | `economics.teaching` cannot recruit from the other Country; `world.migrationPull` cross-Country = 0 |
| DomainVeto | adds the grantee as a Veto holder for named Rights/Duties domains in `polity.gateHolders` |
| Succession / Common Ruler | **post-alpha** (Characters) — present in menu with `postAlpha: true`, inert |
```js
function ratify(ctx, proposal) {                                      // Administration skeleton under the hood; never surfaced in UI
  const holders = ctx.derive.polity.cellsHoldingVeto(proposal.party, 'treaty')
  const stances = holders.map(c => stance(c, proposal, ctx, treatyStanceFns))        // material self-interest x relationship history / Preference alignment
  return stances.every(s => approves(s, ctx))                                       // gating by held Rights; no holder -> counterpart's government decides
}
const warChain = (ctx, attackerCB, attacked) => propagate(ctx.state.diplomacy.treaties, attacked, tier =>
    tier === 'Defensive' ? externallyRecognised(ctx, attackerCB) : ['Guarantee','StandingOffensive','Coalition'].includes(tier))   // "Great-War chain" = treaty-graph propagation only; no global metric
const greatPowerBacked = (ctx, coalition) => share(coalition.imposers, topCountries(ctx, ['military','economic'])) >= ctx.T('gp.share')   // derived predicate
```
Espionage, propaganda, detection (threshold model from `kernel/threshold.js`):
```js
// ActionType declares targetScale: espionage/propaganda on a Region -> population(region); Sanction -> target's economy size; Cooperation -> 1 (each type declares its own)
function runCovert(ctx, a) {
  const th = threshold(a.type, a.params.tier, a.target, ctx); const r = applyThreshold(committedLabour(a), th)       // binary, no refund, never opponent-size-scaled
  if (!r.met) return                                                                                              // claim stays locked this turn
  const op = {id: nextId(ctx,'cv'), sender: a.actor.country, apparentSender: a.params.falseFlag ?? a.actor.country, targetRegion: a.target, kind: a.type,
              concealmentTier: a.params.concealment ?? 'overt', falseFlag: !!a.params.falseFlag}                    // CovertOp record referenced from the Decision Log entry
  writeIntoCells(ctx, op)       // (1) opinionGov adjustment target-agnostic (may favour a third party), (2) grievance injection, (3) Preference-modifier push (overt = sender's Portrait; covert = any point)
}
function detect(ctx, defender, op) {                                    // per observer; additive strength
  const d = observationAt(ctx, defender, op.targetRegion) + counterIntelCommitted(ctx, defender, op.targetRegion)
  const tAct = ctx.T(`conceal.act.${op.concealmentTier}`) * targetScale(op), tSender = ctx.T(`conceal.sender.${op.concealmentTier}`) * targetScale(op)
  if (d < tAct) return {tier: 'undetected'}
  if (d < tSender) return {tier: 'actDetected'}                         // victim gets a Grievance- or Rights-tier CB against... nobody attributable (act only)
  if (op.falseFlag && d < ctx.T('conceal.falseFlag') * targetScale(op)) return {tier: 'senderRevealed', sender: op.apparentSender}   // CB against the APPARENT sender
  return {tier: 'senderRevealed', sender: op.sender, falseFlagExposed: op.falseFlag}   // exposure costs true sender Reputational Leverage + a CB; no limit on whom a false flag may implicate
}
```
Leverage readouts (derived, never aggregated, scope = pair or alliance-bloc pair, evaluated at decision time):
```js
const leverage = (ctx, a, bOrBloc) => ({
  economic:   tradeDependency(ctx, bOrBloc, a),                                           // throughput-based
  diplomatic: value(ctx.state.diplomacy.leverage[pairKey(a, b)]),                         // the Reputational stack
  military:   warFeed(ctx, a, bOrBloc) + trainingModifiers(ctx, a, bOrBloc) - exhaustionPenalty(ctx, a),  // stacks, never replaces
  cultural:   weightAggregate(cellsOf(bOrBloc), c => alignment(effectivePref(c), observedPortrait(a))) })   // from culture pools + preference alignment (open: input vs output side — spec uses output side)
// existential-threat override promotes one category (typically military): trigger = core province occupied OR Existential CB held against the Country; weighting itself is AI-Diplomacy's
```
Reputational stack feed: `overreach(−)`, promise kept/broken (±), Veto/treaty compliance (±), rejecting a coalition-backed demand (− only vs that coalition's supporters), active Alliance ≥ Benevolent Neutrality adds a standing bonus. Never a spendable currency; separate from Portrait's Ruthlessness↔Restraint.

### 6. Diplomacy step 7 order
```js
function step7(ctx) {
  resolveProposals(ctx)           // ratify() per treaty/proposal; Sanctions, Dependency, Alliance, Confederation (symmetric consent), Cooperation, FacilitationGrants
  resolveCovert(ctx); detectAll(ctx)    // placed here so detection uses this turn's Observation + counter-intel claims
  decayLeverage(ctx); generateCBs(ctx)  // event-based CBs from this turn's breaches/detections
  warDeclarationEffects(ctx)      // scheduler 'diplomacy.warDeclared': CB check, overreach per observer, treaty chain
  peaceRatification(ctx)          // Occupation removal, Countries-level territory/treaty changes; Annexation = forced-annexation CB + overreach (no separate penalty stack)
}
```

### 7. TUNE catalogue additions (all `placeholder`; appended to `tuning.defaults.json`)

| Key | Value | Key | Value | Key | Value |
|---|---|---|---|---|---|
| `admin.routineOverhead` | 0.1 | `slate.existential` | 10 | `slate.structural` | 5 |
| `slate.routine` | 1 | `observe.liveThresholdPerPop` | 0.001 | `observe.estimateFraction` | 0.4 |
| `defect.threshold` | 0.3 | `war.k.charge` | 0.5 | `war.k.armor1` | 0.4 |
| `war.k.armor2` | 0.3 | `war.skirmish.harass` | 0.4 | `war.flank` | 0.2 |
| `war.cohesion.win` | 0.05 | `war.cohesion.loss` | 0.08 | `war.rout.threshold` | 0.3 |
| `war.supply.decay` | 0.05 | `war.supply.infraRelief` | 0.5 | `war.gunpowder.bonus` | 0.5 |
| `war.siege.rate` | 1 | `war.siege.defRate` | 1 | `war.siege.capture` | 100 |
| `war.blockade.mult` | 3 | `war.wounded.share` | 0.5 | `war.wounded.delay` | 3 |
| `war.garrison.perPop` | 0.001 | `war.martialLaw.control` | 0.002 | `war.martialLaw.raise` | 0.5 |
| `war.uprising.base` | 0.5 | `war.forest.block` | 80 | `war.spread.max` | 0.5 |
| `war.river.cost` | 1.5 | `war.training.k` | 0.01 | `war.training.decay` | 0.1 |
| `war.peace.scoreWeight` | 0.2 | `eps.cb` | 0.01 | `cb.decay.Grievance` | 0.2 |
| `cb.decay.Rights` | 0.1 | `cb.decay.Sovereignty` | 0.04 | `cb.decay.Existential` | 0.02 |
| `overreach.k` | 1 | `gp.share` | 0.6 | `leverage.decay` | 0.05 |
| `conceal.act.low/medium/high` | 2 / 5 / 10 | `conceal.sender.low/medium/high` | 4 / 9 / 16 | `conceal.falseFlag` | 20 |
| `thresholds.espionage.influence` | 6 | `thresholds.foreignPropaganda.overt` | 4 | `thresholds.foreignPropaganda.covert` | 8 |

## Rules

1. Control, Observation and the pool split are pure Allocation Dials re-resolved every turn; Observation never costs Coordination for surplus auto-fill.
2. Visibility is a stamp on every political/covert/foreign readout: live / estimated / stale / unknown; `unknown` is never guessed; fog-of-war stays a separate deferred layer.
3. The slate is attention only; Questions exist independent of it; thresholds are fixed per severity tier.
4. Army movement uses World Map land edges (not trade edges); Mountain interiors are blocked unless a pass; the attacker is gated by `edgeQuality`, defenders use the full network.
5. Combat, charge, armor, blockade type and exhaustion are derived at resolution; only cohesion, strength, supply, progress and logs persist.
6. Fielded units trace to origin cells; garrisons are anonymous recurring claims; occupation is applied by War and consumed (not duplicated) by Politics/Administration/Diplomacy.
7. War Score is a per-cell harm log and peace weighs capability; Veto-to-declare and Veto-to-continue share one stance function.
8. Diplomacy has no global tension metric: war chains are treaty-graph propagation, great-power backing is a derived predicate.
9. CBs: state-based and structural are derived on read, only event-based are stored; overreach is per observer.
10. Every Diplomacy/Espionage action declares `targetScale`; below threshold nothing happens and nothing is refunded; detection = Observation + counter-intelligence (additive) with separate act/sender/false-flag thresholds.
11. Leverage categories are readouts, never summed in simulation code; weighting belongs to the AI layer.

## Cross-references
`kernel_engine__spec.md` (dials, thresholds, stance, scheduler) · `economics_polity__spec.md` (CCO production, spending dial, polity reads) · `modules__spec.md` §4-§6 (class diagrams) · `worldgen__spec.md` (edges that War paths over) · kb: Administration, War, Diplomacy, Actions.

## Status
- **Settled in kb, encoded**: all structures and rules above; battle phase order, supply, siege, occupation, score, exhaustion, peace; CB classes, overreach, axes, alliance tiers, thresholds, detection, false flags, leverage readouts.
- **Confirmed by designer**: Mountain interior edges blocked unless pass.
- **(spec decision)**: formula shapes and all keys in §7; `Hex`-level pathing details (forest block rule, river cost); `observationCache` for stale reads; `CovertOp` record; step-7 internal order; stamp thresholds; Government inventory use.
- **Confirmed 2026-11-04**: Mountain interior = Mountain↔Mountain only; forest hard-block at `forestation ≥ war.forest.block` (80); Cultural Leverage scored on realized alignment (output side).
- **Open**: captured-unit handling, ransom, named commanders and naval combat stay post-alpha (kb).

- **Implemented 2026-11-05 (`src/modules/war`, `worldmap` step 8, `ai/simpleWar.js`; 9 war tests)**: land graph (Mountain interior blocked, forest hard-block, river cost), armies with muster point (`fieldUnits.at`), movement with edge-quality gating, supply with a **real draw from the supply zone's market** (service `ctx.services.economics.draw`) and military upkeep added to zone demand and reserved in the cascade, pairwise three-phase battle (skirmish/melee/rout, interaction table, cohesion, killed/wounded, pursuit), sieges with a `war.siege.turns` calibration, occupation (per province; cells read `occupiedShare`), per-cell war score, `warHarm` (decaying, feeds the Security grievance and the Exhaustion readout), declareWar via the Scheduler, proposePeace with a **receiver-only** willingness evaluation (weak/exhausted accepts; strong refuses), cession + occupation removal, and **Region re-derivation at step 8** with cell split/merge by Nations' presence (`labourCommitted` and `hoard` are extensive records). Not implemented: internal armed conflict (armed rung/Retinue), garrison refill as an anonymous claim, fortification levels beyond fortress edges, Diplomacy (CB/overreach/treaties/Espionage), Observation stamps.
- **Found while implementing (now spec)**: (1) peace acceptance is `(0.5 − ownShare) + exhaustion·k − cedeCost·k + gain·k`; the proposer accepts its own terms. (2) Siege gain per turn = `capture/turns × clamp((siege − defence)/(siege + defence), −0.5, 1)`. (3) Modules expose cross-module mutations only through `module.services` (`ctx.services.<module>.<fn>`), reads through `ctx.derive`. (4) War needs the army pools' `combat` block in the ruleset (tags, speeds, upkeep) — generated by `tools/buildRuleset.mjs` as placeholders.
