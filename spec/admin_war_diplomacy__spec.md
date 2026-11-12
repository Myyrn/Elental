# Administration & Diplomacy — Detailed Specification

Status: first detailed pass (2026-11-04); **trimmed 2026-11-12**: the War sections (old §2–§4), the war tuning keys and the war rules moved to `war__spec.md`; the Actions pointers go to `actions__spec.md`. What remains is Administration (§1) and Diplomacy (§5–§6) in their pre-bootstrap form: the kb ↔ spec mirror (`Sync:` blocks) for `administration__kb.md` and `diplomacy__kb.md` is pending, and this file should then be split into `administration__spec.md` and `diplomacy__spec.md`. (The file keeps its old name until then so existing references hold.) Source: `administration__kb.md`, `diplomacy__kb.md`, `actions__kb.md`. Rules and order come from the kb; formulas are open until the numbers pass, so each is a **(spec decision)** with its numbers in `ruleset.tuning` as `placeholder` (catalogue §10, shipped in `scenarios/alpha/tuning.defaults.json`). Beyond alpha and therefore only hooks: Characters (named commanders, ransom, Succession/Common Ruler), naval fleet combat, fog-of-war layer.

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
Actions: `setControlAllocation`, `setObservationAllocation` (dial entries), `setPoolSplit(pool, dial)`, `setPlanningPosture`, `setBorderPolicy`, `declareEmergencyPowers` (commitment; cost derived each turn), `escalateExternalQuestion`, `commissionAudit` — registered by `administration/actions.js` with the gate domains from `actions__spec.md` (Existing actions by module).

### 2–4. War — moved to `war__spec.md`.

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
| DomainVeto | adds the grantee as a Veto holder for named Rights/Duties domains in `polity.gateHolders` (in code: `diplomacy.foreignVetoes`, consulted by `gate()` in `engine.js`; see `actions__spec.md` Gating) |
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
  military:   warFeed(ctx, a, bOrBloc) + showOfForce(ctx, a, bOrBloc) - exhaustionPenalty(ctx, a),   // stacks, never replaces; showOfForce = state.war.showOfForce[`${a}|${b}`] (war__spec.md; was trainingModifiers)
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

### 7. TUNE catalogue additions (all `placeholder`; appended to `tuning.defaults.json`; War keys: `war__spec.md`)

| Key | Value | Key | Value | Key | Value |
|---|---|---|---|---|---|
| `admin.routineOverhead` | 0.1 | `slate.existential` | 10 | `slate.structural` | 5 |
| `slate.routine` | 1 | `observe.liveThresholdPerPop` | 0.001 | `observe.estimateFraction` | 0.4 |
| `defect.threshold` | 0.3 | `eps.cb` | 0.01 | `cb.decay.Grievance` | 0.2 |
| `cb.decay.Rights` | 0.1 | `cb.decay.Sovereignty` | 0.04 | `cb.decay.Existential` | 0.02 |
| `overreach.k` | 1 | `gp.share` | 0.6 | `leverage.decay` | 0.05 |
| `conceal.act.low/medium/high` | 2 / 5 / 10 | `conceal.sender.low/medium/high` | 4 / 9 / 16 | `conceal.falseFlag` | 20 |
| `thresholds.espionage.influence` | 6 | `thresholds.foreignPropaganda.overt` | 4 | `thresholds.foreignPropaganda.covert` | 8 |

## Rules

1. Control, Observation and the pool split are pure Allocation Dials re-resolved every turn; Observation never costs Coordination for surplus auto-fill.
2. Visibility is a stamp on every political/covert/foreign readout: live / estimated / stale / unknown; `unknown` is never guessed; fog-of-war stays a separate deferred layer.
3. The slate is attention only; Questions exist independent of it; thresholds are fixed per severity tier.
4–7. (War rules: moved to `war__spec.md` Rules.)
8. Diplomacy has no global tension metric: war chains are treaty-graph propagation, great-power backing is a derived predicate.
9. CBs: state-based and structural are derived on read, only event-based are stored; overreach is per observer.
10. Every Diplomacy/Espionage action declares `targetScale`; below threshold nothing happens and nothing is refunded; detection = Observation + counter-intelligence (additive) with separate act/sender/false-flag thresholds.
11. Leverage categories are readouts, never summed in simulation code; weighting belongs to the AI layer.

## Cross-references
`actions__spec.md` (action system, pipeline, Allocation Dial, gating, Decision Log) · `kernel_engine__spec.md` (thresholds, stance primitives) · `war__spec.md` (War, Show of Force) · `economics_polity__spec.md` (CCO production, spending dial, polity reads) · `modules__spec.md` §4-§6 (class diagrams) · `worldgen__spec.md` (edges that War paths over) · kb: Administration, Diplomacy, Actions.

## Status
- **Settled in kb, encoded**: Administration structures and rules above; CB classes, overreach, axes, alliance tiers, thresholds, detection, false flags, leverage readouts.
- **(spec decision)**: formula shapes and all keys in §7; `observationCache` for stale reads; `CovertOp` record; step-7 internal order; stamp thresholds; Government inventory use.
- **Confirmed 2026-11-04**: Cultural Leverage scored on realized alignment (output side).
- **Open**: captured-unit handling, ransom, named commanders and naval combat stay post-alpha (kb).
- **Found while implementing (now spec)**: modules expose cross-module mutations only through `module.services` (`ctx.services.<module>.<fn>`), reads through `ctx.derive`.
- **Pending**: kb ↔ spec bootstrap (`Sync:` blocks) and the split into `administration__spec.md` / `diplomacy__spec.md`; the Diplomacy code status (CB/overreach/treaties/Espionage are implemented per `tests/diplomacy.test.js`, `tests/espionage.test.js`, not verified in this pass); Observation stamps status.
