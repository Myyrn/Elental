# Simulation Modules — Specification

Status: first spec pass (2026-11-03). Source: the eight module kb files. Each module =
`state.js` (slice shape) · `derive.js` (readouts) · `step.js` (pipeline hook) ·
`actions.js` · `schema.js`. Every number is `ctx.T('...')` (`// TUNE`); `// ASSUME` =
spec decision not in the kb (listed in Status). Characters, Events, AI internals,
cataclysm, naval combat, character-scale rituals are beyond alpha: only hooks/interfaces.

## Data Structures

### 1. World Map, Nations, Countries

```plantuml
@startuml
title World Map / Nations / Countries
class Province { id, x, y, terrain, forestation, maxArea, maxArableArea, maxPopDensity,\npopulation, urbanization, sanitation, waterSource, habitability,\ninfrastructureLevel, owner: countryId|null }
class Edge { a, b, type: river|mountain_pass|sea_lane, fortress: bool, bridge: bool }
class Region <<derived snapshot @cache>> { id, owner, provinces[] }
class PopulationPresence { provinceId, nationId, count }
class Nation <<config>> { id, name, reactionTemperament, poolAffinity{pool:mult}, prefTraits{axis:v} }
class Country { id, name, titularNations[] , capital <<derived>>, territory <<derived>> }
class RelationState { pair, opinion <<derived>>, claims[], goals[], cbs[] }
class Dependency { subject, overlord, axes: AxisGrant[] }
class Confederation { members[], axes: AxisGrant[] }
Province "1" -- "*" PopulationPresence
Nation "1" -- "*" PopulationPresence
Province "*" -- "0..1" Country : owner
Region "1" o-- "6..8" Province
Country "1" -- "*" RelationState
Country "1" -- "*" Dependency : as subject
Edge "*" -- "2" Province
@enduml
```

```js
// worldmap/derive.js
const ODDR = [ [[+1,0],[0,-1],[-1,-1],[-1,0],[-1,+1],[0,+1]],         // even rows ; side index 0=E 1=NE 2=NW 3=W 4=SW 5=SE
               [[+1,0],[+1,-1],[0,-1],[-1,0],[0,+1],[+1,+1]] ]         // odd rows   (ASSUME: side numbering for entry_side/route_side)
const neighbors = (x, y) => ODDR[y & 1].map(([dx,dy]) => [x+dx, y+dy]).filter(inGrid)
function forestationCeiling(ctx, terrain) { return ctx.ruleset.terrain[terrain].forestMax }     // clamp on write; Editor warns
function resourceYield(ctx, prov, res) {
  if (res === 'Timber') return ctx.T('yield.timberPerForest') * prov.forestation                // exception: forestation-driven
  return ctx.T('yield.baseline') + ctx.ruleset.terrain[prov.terrain].favor[res] ?? 0            // baseline_rate + terrain_favor
}
function habitableOutput(prov, x) { return prov.habitability === 'Wasteland' ? 0 : x }          // Rule 5: Wasteland yields nothing

// worldmap/step.js  step 1: epidemic risk; step 8: Regions
function epidemicRisk(ctx, prov) { return ctx.T('epi.k') * prov.sanitationBad * prov.urbanization / (1 + ctx.derive.economics.medicineOutput(prov)) }  // drivers: sanitation x urbanization x Medicine pool
function step8(ctx) {                                                 // single end-of-turn pass, after Diplomacy
  const changed = ownershipChanged(ctx) || developmentTriggerCrossed(ctx)    // banded enter/exit thresholds (hysteresis)
  if (!changed) return
  const next = deriveRegions(ctx)                                     // see below
  for (const [oldId, parts] of splitsAndMerges(ctx.state.world.regionSnapshot, next)) {
    // fracture: per-cell stocks split by Nations' population share; merger: stocks sum (incl. merged flags, momentum, occupation)
    ctx.module('polity').rekeyCells(ctx, oldId, parts, popShare => nationsPresenceShare(ctx, popShare))
  }
  ctx.state.world.regionSnapshot = next
}
function deriveRegions(ctx) {   // ASSUME algorithm: kb gives only "6-8 contiguous same-owner hexes, snapshot-and-drift"
  // keep existing Regions whose provinces are still contiguous + same owner; re-cluster only affected components:
  for (const comp of connectedComponentsBySameOwner(affectedProvinces)) {
    const k = max(1, round(comp.size / 7)); seeds = pickFarthestSeeds(comp, k); region = balancedBfsAssign(comp, seeds)   // components < 6 stay single Regions
  }
}
```

Population dynamics (World Map owns the stock; **no stored rate**):

```js
function growth(ctx, cell) { return ctx.T('pop.birth') * needSatisfaction(ctx, cell) - epidemicBurden(ctx, cell) }   // bounded by maxPopDensity at province level; formula = numbers pass
function migrationPull(ctx, from, to) {            // along existing edges only; Movement autonomy Right/laws scale it; cross-Country gated by LaborMigrationBan
  return (needSat(to) - needSat(from)) * movementPermission(ctx, from, to)
}                                                  // migrants join SAME Estate cell in destination Region, pro-rata stocks, keep Nation identity
// Settlement routes: (1) migration, (2) cell action `settle` (permitted unless a law forbids), (3) Government freeColonization (commitment) | directResettlement (event)
```

```js
// nations/derive.js
const coreStrength = (ctx, n, p) => ctx.T('core.k') * presence(n, p).count * share(n, p)            // TUNE shape f(count, concentration)
const influence = (ctx, n, p) => coreStrength(ctx, n, nearestCore(n, p)) * decay(distance(n, p))     // multiple cores allowed; never stored
const sympathy = (ctx, n, c) => baseNeedSatisfaction(ctx, n, c) + value(ctx.state.nations.sympathyMods[`${n}|${c}`])   // mod stack decays; base for IP Foreign Standing
function assimilate(ctx, cell) { /* passive drift = f(local sympathy, distance to core, relative weight);
   transfer: population -> dominant Nation's cell, SAME Estate+Region, pro-rata stocks; its Preference baseline shifts via a decaying modifier */ }
```

```js
// countries/derive.js
const satisfaction = (ctx, subject, overlord) =>                       // readout, never an exit trigger
  weightAggregate(cellsOf(subject), c => foreignStanding(ctx, c, overlord))
  + materialBalance(ctx, subject, overlord)                            // benefits - burden of ceded axes
  + visibleRivalOffers(ctx, subject)
// Country.opinion (RelationState) = polity.govToGovStanding ; goals = declared war goals ; standing / government form = display-only readouts
// Lifecycle events: Formation{settlement,secession,independence}, Dissolution{collapse,absorption}, Merger (gated Event, `treaty` Veto), Dependency, Confederation.
// Collapse has NO timer: outcome of internal armed conflict / Peace Conference.
```

### 2. Internal Politics (polity)

```plantuml
@startuml
title Polity (Internal Politics) — state slice
class Cell { key: CellKey, population, labour: Record<pool,number>, wealth,\ngrievance: Record<need,number>, opinionOfNation: Record<nationId,Stack>,\nopinionGov: Stack, pref: Record<axis,Stack>, fairnessMods: Stack,\nrights: Record<right,RightEntry[]>, duties: Record<duty,DutyEntry[]>,\nlaborProfile: Record<pool,number>, flags{converged, occupied} }
class Stack <<ModifierStack>> { baseline, mods[] }
class RightEntry { scope, value, declaredTurn }
class Obligation { creditor: CellKey, debtor: CellKey|'gov', principal, terms }
class Momentum <<cache>> { key "cell|need", value }
class LogEntry { actor, action_type, visibility, turn, affected_cells }
class Question <<derived>> { cell, need, severity, tier }
class Faction <<derived, per Question>> { question, cells[], stance, rung }
class Portrait { country, axes: Record<axis,Stack> }
Cell *-- Stack
Cell o-- RightEntry
Cell "1" -- "*" Momentum
Question ..> Cell
Faction ..> Question
@enduml
```

```js
// polity/derive.js — everything below is derived on read (Rule 1)
const prestige  = (ctx, c) => structuralBaseline(ctx, c) /* Rights/Duties balance */ + sumMods(c.prestigeMods)
const weight    = (ctx, c) => c.population * prestige(ctx, c)
const compliance = (ctx, c, need) => voluntary(ctx, c) + involuntary(ctx, c)         // voluntary = f(opinionGov); involuntary = Σ Control grants (Administration dial)
const awareness = (ctx, c) => f(c.labour.Teaching, c.labour.Culture, c.labour.Bureaucrats, c.labour.Diplomacy, c.labour['Trade/Commerce'],
                                printedGoodsConsumption(c), urbanization(c), politicalRights(c))
const contributionShare = (ctx, c) => ctx.derive.economics.contribution(c) / Σ_cells(...)                  // economics supplies valuation
const entitlementShare  = (ctx, c) => weight(ctx, c) / Σ_cells weight                                      // Prestige-weighted standing
const fairnessGap = (ctx, c) => contributionShare(ctx, c) - entitlementShare(ctx, c)                       // >0 under-rewarded -> accumulates
const acceptance = (ctx, c, lossAction) => f(crisisSeverity(ctx, lossAction) /* live Question state */, factionExposure(ctx, c),
                                              burdenShare(ctx, c), visibleAlternatives(ctx, c))             // incl. unspent Ledger reserve
const entitlementLoss = (ctx, cells, a) => for (c of cells) push(c.fairnessMods, {value: size(a, c) * (1 - acceptance(ctx, c, a)), decay: {kind:'ctx', fn:'lossDecay'}})
const amalgam = (ctx, country, axis) => Σ w(c)*effectivePref(c, axis) / Σ w(c)   // w = Weight; AI value source; player readout only
const foreignStanding = (ctx, c, other) => ctx.derive.nations.sympathy(c.nation, other) + cellTerms(ctx, c, other)   // never aggregates back into Sympathy
const govToGovStanding = (ctx, a, b) => weightAggregate(powerfulCells(a), c => foreignStanding(ctx, c, b)) + alignment(amalgam(a), observedPortrait(b))
```

```js
// polity/step.js  step 5 (order matters)
function step5(ctx) {
  for (const c of cells(ctx)) {
    updateGrievance(ctx, c)               // needs: shortfall from step-3 cascade (Subsistence existential), Identity/Autonomy+Solidarity (existential everywhere),
  }                                       //   Purpose, Faith(open), Fairness(secondary by default), war harm, occupation.  Leaky accumulator: // TUNE rate per class
  readDecisionLog(ctx)                    // attributed discontent = harm x attributability(awareness, causalVisibility) -> decaying mod on opinionGov (per observer detection)
  decayAllStacks(ctx)                     // prestige, opinion, pref, fairness (ctx-rate), sympathy, portrait
  ctx.questions = triggerQuestions(ctx)   // per (cell, need): severity > compliance ; independent of Government slate; tier existential/structural/routine
  ctx.factions  = computeFactions(ctx, ctx.questions)     // issue-scoped, derived, NEVER persisted: Estate merge / Nation fracture; cross-Estate partial blocs
  for (const [key, q] of ctx.questions) updateMomentum(ctx, key)   // rises fast, decays slow; Question lapse -> decays; repression doesn't erase grievance
}
function updateMomentum(ctx, key) {       // banded hysteresis
  m = ctx.state.polity.momentum[key] = decay(m) + attentionGate(ctx, key) * rise(max(0, grievance - compliance))
  rung = bandedRung(m, prevRung, ctx.T('bands'))          // distinct enter/exit thresholds; existential shocks may skip rungs; bloc acts at Weight-aggregated momentum
}
// Rungs (order = numbers pass): petition -> dutyWithholding/taxRefusal/hoarding -> armed retinue/revolt -> Estate-forced Convergence ; foreign appeals
function decideCellActions(ctx) {         // called at step 2 with LAST turn's cached rungs
  for (const c of cells(ctx)) { avail = registry.listFor({kind:'cell',key:c.key}, ctx)      // permitted ∪ granted(by Rights) ∪ defiance(capability)
    pick = argmax(avail, a => stance(c, a, ctx, cellStanceFns))                             // self-interest x Preference alignment ; owned by AI-Econ/IP
    if (pick) yield pick }                // no available action -> only grievance accumulates and migration pull (World Map)
}
```
Rights checklist keys (data, from Ruleset): Council seat · Veto{war, autonomy-titular, market, skilled-labour, administration, retinue, treaty, tax-law} · Local Jurisdiction (+estate-tariff) · Petition · Land share · Retinue (scalar) · Marriage/Movement autonomy · Legal immunity · Skilled-Labour permissions (bitmask) · Market access · Foreign trade access · Minting · Lending · Trade-infrastructure construction · Settlement · Internal/Foreign tariff rate · Tariff exemption · Corvée · Estate Mobility (0-100%). Duties: Taxation (market, wealth) · Levy · Skilled-labour duty · Requisition · Corvée · Hospitality · Loyalty oath · Demotion Duty. Absent entry = **allowed (default)**. Estate identity = checklist + label (recostuming).

Other polity rules in code: Mobility moves population between Estate cells in the same (Nation, Region), permanent; Demotion triggers on `netPosition = wealth + claims − obligations < 0`, destination by Prestige gap; Convergence per (Nation, Region) pair when Rights AND Duties distance → 0 (rarity emerges from cost, no flag); Persuasion → opinionGov mod; Propaganda → pref modifier stack (fast) / Teaching → pref baseline (slow); Government benefits: pain-alleviating or joy-giving.

### 3. Economics

```plantuml
@startuml
title Economics
class Warehouse { provinceId, capacity, stock: Record<good,number> }
class Good <<config>> { id, tier, baseValue, perishable, decayRate, sourcing: alt[] }
class Pool <<config>> { id, envelope{control,coordination,observation}, kind }
class TradeZone <<derived>> { hub, provinces[] }
class ZoneEdge <<derived>> { a, b, throughputCap, currentFlow }
class Obligation { creditor, debtor, principal, terms }
class Coinage { supply, issuers: Record<id,fineness> }
class LandShare { provinceId, holder: CellKey, share }
Warehouse "*" -- "1" Province
TradeZone "1" o-- "*" Province
ZoneEdge "*" -- "2" TradeZone
@enduml
```

```js
// economics/step.js  step 3 — fixed resolution order
function step3(ctx) {
  const out = production(ctx)                    // yields from provinces x labour in pools (production side of each dual-claim pool); harvest variance already applied in step 1
  landSplit(ctx, out)                            // Σ shares ≤ 1; remainder stays with producing cells; absentee holders allowed
  requisition(ctx, out)                          // pre-cascade; scope filter; shortfall -> subsistence grievance; two Opinion hits queued for polity
  const prices = pricePass(ctx)                  // single pass, nothing stored
  cascade(ctx, prices)                           // Subsistence -> Comfort -> Luxury; gated by market access, tariffs, throughput; non-material channel not stockpiled
  taxation(ctx)                                  // post-cascade; wealth tax and market tax independent
  debtService(ctx)                               // after cascade+tax; shortfall = arrears -> default costs claim + Opinion/Grievance; net position falls
  creditClearing(ctx)                            // one derived pass: lend supply (cells, permitted) vs demand (cells + Government Borrow) -> new Obligations
  ledgerUpdate(ctx)                              // inflows: taxes, enterprises, state tariffs, minting, indemnities, borrowing
  upkeepShortfall(ctx)                           // spending dial resolved vs START-of-turn balance; unmet fraction -> ctx.state.admin degradation read by step 5
}
const price = (ctx, good, zone) => ctx.ruleset.goods[good].baseValue * scarcity(ctx, good, zone) * priceLevel(ctx)  // base in numeraire (Refined Precious Metals = 1)
const priceLevel = ctx => f(coinedSupply(ctx) / clearedVolume(ctx))                                                   // numeraire scarcity expressed here only
const zoneOf = (ctx, prov) => strongestPullingHub(prov, p => outputOf(p) * ctx.state.economy.tradeInfra[p])           // derived, never stored; damped by slow stock
const realized = (ship) => ship.value - stateTariff(ship.origin) - Σ estateTariff(ship.transit) - stateTariff(ship.dest) // estate tariffs never change throughput_cap
function contribution(ctx, cell) {               // supplies Fairness
  return marketOutputValue(cell) * poolScarcity(cell)
       + needSatisfactionDelivered(cell)          // military: scales with live war Questions; Culture/Clergy: grievance relieved
       + teachingRetrainingFlow(cell) + ritualPriceSum(cell)    // ritual: authored relative price x rituals performed, no scarcity market
}
function produceCCO(ctx, country) {              // Administrative Capability Envelope
  const units = committedUnitsPerPool(country)   // from the pool dual-claim split
  return mapAxes(axis => Σ_pool(units[pool] * env[pool][axis]) / Σ_pool units[pool])     // blend; no hardcoded institution
}
// Pools: no conversion except Teaching (slow, target-specific); permanent loss if pool count = 0 country-wide (recover only via teacher import, LaborMigrationBan gates)
// Mint(fineness): per-issuer record; face value domestic, fineness between issuers; loans nominal. Rituals: commitment above labour threshold + Processed Reagents consumed,
//   sustained for authored duration; completion -> authored one-shot effect on a named crisis state. Trade infra: Builders + Wealth, any permitted cell, decays without upkeep, no builder return.
```

### 4. Administration

```plantuml
@startuml
title Administration
class Government { country, ledger: number >= 0, controlDial, observationDial, spendingDial,\npoolSplit: Record<pool,AllocationDial>, planningPosture, borderPolicy,\nemergency?: {magnitude}, attention: AttentionEntry[], upkeepFraction }
class AllocationDial <<kernel>>
class AttentionEntry { questionKey, coordinationCommitted }
Government *-- AllocationDial
Government o-- AttentionEntry
@enduml
```

```js
function step6(ctx) {                                 // slate allocation for NEXT turn (lags one turn)
  const cco = ctx.derive.economics.produceCCO(country)
  const routine = ctx.T('admin.routineOverhead') * countRoutine(ctx)             // continuous; shortfall -> routine Questions drop to unaddressed
  let coord = cco.coordination - routine - propagandaDraw(ctx) - emergencyDraw(ctx)
  for (q of ctx.questions sortedBySeverity) { th = ctx.T(`slate.${q.tier}`); if (coord >= th) { attention.push({q, coordinationCommitted: th}); coord -= th } }   // fixed threshold per tier; no slot formula
}
const emergencyCost = (ctx, e) => e.magnitude * (1 - acceptance(ctx, ...))        // derived each turn; NO duration term
function applyUpkeepDegradation(ctx, g) {          // proportional to unmet fraction; cut order = spending-dial priority; never spawns Questions
  pool.cco *= (1 - unmetFraction); if (deeplyUnmet(pool)) returnLabourToOriginCells(pool)     // leaderless defection; armed contribution only if rung+Retinue (War resolves)
}
const detectionStrength = (ctx, country, region) => committedObservation(country, region) + counterIntelEspionage(country, region)   // additive
```
Pool dual-claim split (production vs admin C/C/O vs Army): one `AllocationDial` per (Country, pool): entries `{kind:'claim', claim:'admin'|'army'}` with floors by priority, sink = production. ASSUME: the claim is drawn from cells holding the pool pro rata to their labour (kb: "pools staffed from cells' own labour"; draw rule unspecified).

### 5. War

```plantuml
@startuml
title War
class Unit { id, originCell, composition: Record<pool,n>, equipmentTier, armorInvested,\nstrength, cohesion, position, supplyState }
class Army { id, owner, units[], position: {province, entrySide, routeSide, depths{vanguard,center,rearguard}}, tactic, stance }
class Garrison { province, strength, maxCapacity <<derived from fortification>>, composition }
class War { id, sides[], goals[], startedTurn }
class WarScoreEntry { side, targetCells[], cause, harm{}, turn }
class Occupation { cell, martialLaw, garrisonDemand <<derived>> }
Army "1" o-- "*" Unit
War "1" -- "*" WarScoreEntry
@enduml
```

```js
// war/step.js  step 4
function step4(ctx) {
  for (army of armies) move(ctx, army)                      // speed = min(Center, Rearguard); attacker gated by edge_quality = infra x edge_type; reroute costs a turn
  for (army of armies) supply(ctx, army)                    // path to valid source via World Map edges; real draw on warehouse stock (market default, wartime Requisition override)
  for (clash of detectClashes(ctx)) resolveBattle(ctx, clash)
  for (siege of sieges) siege.progress += f(SiegeCorps, supplyB) - f(fortification, garrison, supplyD)   // writes WarScoreEntry every turn held
  internalArmedConflict(ctx)                                // faction armed rung: same machinery, side need not be a Country
}
function resolveBattle(ctx, clash) {                        // phases sequential, state carries forward; sub-units resolve pairwise
  state = skirmish(clash)  ->  melee(state)  ->  rout(state)
  // envelope = base(pool) x estateModifier(originEstate,pool) x terrainModifier(terrain,pool); then trait interactions (sparse table)
  // charge_bonus, armor_mitigation, armor_speed_penalty derived here, never stored; gunpowder bonus conditional on live ammunition supply
  // cohesion persists per unit (win +Δ, loss -Δ, bounded, never reset); casualties: Killed deducted from origin cell pool; Wounded return after delay
  logWarScore(ctx, clash)                                   // per-cell harm in existing stocks; never a currency
}
const blockadeType = (ctx, fortress) => hardCapable(fortress.edge.type, forestation) ? 'hard' : 'soft'   // derived at read time
const exhaustion = (ctx, cell) => warAttributableGrievance(ctx, cell)                                   // read-only readout; never an input
function peaceEvaluation(ctx, side, terms) { return stance(side, terms, ctx, peaceFns) }                // capability assessment; WarScore is context only; same machinery for rebel conferences
// Occupation: on capture each occupied cell gets {occupation modifier -> Grievance:Occupation or liberator sympathy bonus, martial law (Control cost, uprising threshold),
//   faction-eligibility exclusion}; garrison demand derived from population+grievance, troops and Control substitutable; removed by peace ratification (step 7) or Annexation.
```

### 6. Diplomacy

```plantuml
@startuml
title Diplomacy
class CB { holder, target, tier: Grievance|Rights|Sovereignty|Existential, class: state|event|structural,\nexternallyRecognized: bool, mods: Stack? }
class Treaty { kind: Sanction|Dependency|Alliance|Confederation|Cooperation, parties[], axes: AxisGrant[], tier? }
class AxisGrant { axis, terms, scope }
class CovertOp { id, sender, apparentSender, targetRegion, kind, concealmentTier, falseFlag }
class FacilitationGrant { grantor, grantee, asset, terms }
Treaty "1" o-- "*" AxisGrant
CB ..> Treaty
@enduml
```

```js
// diplomacy/step.js step 7: ratification (reads polity `treaty` Veto), propaganda/espionage resolution, Leverage, CB generation, war-declaration effects, peace -> Occupation removal
function runThresholdAction(ctx, a) {                         // Espionage / Diplomacy / foreign propaganda
  const th = threshold(a.type, a.tier, a.target, ctx); return applyThreshold(committedLabour(a), th)    // binary, no refund, target-scaled, never opponent-size-scaled
}
function detect(ctx, defender, op) {
  const d = detectionStrength(ctx, defender, op.targetRegion)
  if (d < thresholdAct(op.concealmentTier, op)) return 'undetected'
  return d >= thresholdSender(op) ? (op.falseFlag && d < thresholdFalseFlag(op) ? {revealed: op.apparentSender} : {revealed: op.sender}) : 'actDetected'
}                                                              // detected -> victim Grievance/Rights CB; exposure of false flag costs true sender Leverage + a CB
const overreach = (ctx, cb, goals) => f(tierGap(cb.tier, goals))                              // applied PER OBSERVER: Leverage stack toward overreacher x closeness to victim
const leverageReadouts = (ctx, a, bOrBloc) => ({ economic: tradeDependency(...), diplomatic: value(reputational stack), military: warFeed(...) + troopTraining, cultural: prefAlignment(...) })  // never summed
const greatPowerBacked = (ctx, coalition) => share(coalition.imposers, topCountriesBy(military, economic)) >= ctx.T('gp.share')           // derived predicate; replaces "Concert"
const structuralCBs = (ctx, a, b) => [nationalismClaims(a, b), militaristicDisposition(a)]                                                   // derived, no prior justification
// Axis menu (extensible): CultureLanguageSovereignty, MilitaryCap, ForeignPolicy, TradeAccess, Fortification, ResourceExportBan, LaborMigrationBan, DomainVeto; Succession/Common Ruler post-alpha
// Alliance tiers: Guarantee, BenevolentNeutrality, Defensive (gated by CB external recognition), Coalition (expires with named conflict), StandingOffensive, Confederation (symmetric, no teeth)
```

### 7. AI interfaces (stubs; AI-Diplomacy / AI-War / AI-Econ-Polity are post-kb)

```js
/** @typedef {{decide:(view:ObservableState, ctx)=>Action[]}} Agent */      // identical API to the player; observation-bounded view
// agents: GovernmentAgent(country) [value source = amalgam], CountryAgent(country) [Leverage weights seeded from Portrait; existential-threshold override],
//         CellAgent [stance function; no leader in alpha]
const collectAiOrders = (state0, ruleset) => aiCountries.flatMap(c => agentFor(c).decide(observe(state0, c), ctx))
```

## Rules

1. Each module writes only its own slice; reads others via `ctx.derive.<module>.*`.
2. Province is never a polity key; cells are `(Nation, Estate, Region)`; Region fracture/merge rekeys cells by Nations' population share and happens only at step 8.
3. Weight, Prestige, Opinion, Foreign Standing, factions, Questions, trade zones, prices, blockade type, War Exhaustion, amalgam, satisfaction are derived on read; only tagged caches persist.
4. Factions are never persisted or actors; commitments belong to cells; momentum is per (cell, need).
5. Government is a resource-holder (ledger ≥ 0, pools, dials), never an Actor; borrowing is the only way past balance.
6. Economics resolves in the fixed order of §3; Government purchases fund from the start-of-turn ledger.
7. No named administrative institution; C/C/O is always a pool blend.
8. War Score and Exhaustion are logs/readouts; Peace Conference weighs capability.
9. Diplomacy readouts (four Leverage categories) are never aggregated outside an AI decision.
10. Below-threshold Espionage/Diplomacy/ritual actions do nothing and are not refunded.

## Cross-references
`kernel_engine__spec.md` (dials, stacks, stance, gating, pipeline) · `scenario_editor__spec.md` (every `ruleset.*`/`ctx.T` key used above is an Editor-editable field) · kb files per module.

## Status
- **Settled in kb, encoded**: all data shapes, derived-vs-stored split, pipeline hooks, order inside Economics, detection tiers, CB classes, gating inputs.
- **(spec decision)**: Region clustering algorithm; side numbering 0-5 (E,NE,NW,W,SW,SE); pool claim drawn pro rata from holding cells; `Obligation.debtor` = cell key or `'gov'`; `CovertOp` record; Questions recomputed (not stored) each step 5 and cached on `ctx` only.
- **Open (needs your call)**:
  1. **Where production physically happens**: kb gives yields per province and labour per cell `(Nation, Estate, Region)`. Spec assumes a cell's labour is spread over the Region's provinces by its population share per province — confirm or give the intended rule.
  2. **Region snapshot**: stored as `@cache` (needed for snapshot-and-drift stability) although the kb calls Regions "derived, not a stored entity" — OK?
  3. Unit of compliance vs. grievance severity (see kernel_engine Status).
  4. `Question.tier` thresholds and the Council/Veto holder rule for domain gates on `setBorderPolicy`, `placeRequisition` (market vs skilled-labour) are my mapping.
- **Deferred (numbers pass)**: every `// TUNE`; ritual catalogue; scarcity function shape; growth formula; band widths; Control→compliance scaling.
