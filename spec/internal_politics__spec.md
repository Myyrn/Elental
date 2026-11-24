# Internal Politics — Specification

KB: `kb/internal_politics__kb.md`. Mirror of its `##/###` headings; cross-references live in kb only. Bootstrapped 2026-11-13 (the older first-pass spec was replaced; its formulas survive where code or kb confirm them); synced to kb 2026-11-16 (Cell Preferences & Propaganda rev 3, Government Portrait rev 3, Requisition Duty rev 4) **and, for the sections named here, to kb 2026-11-24 (Entitlement loss rev 2, Grouping / Faction computation rev 2, Faction escalation state rev 2, Compliance rev 3, Question handling rev 3, Rules rev 3)**. Sources: kb, `src/modules/polity/{derive,step,behaviour,actions,remaining,mobility,demotion,convergence,propaganda,portrait,module}.js` (`cellstate.js`, `transfer.js` only through the names the others import), `src/engine/engine.js` (`writeLog`, step 2), `tests/{econ_polity,behaviour,politics_remaining,polity_queue,portrait}.test.js` (files, not individual test names, were checked); **for the 2026-11-19/22 sections (Question handling, debate modifiers, Persuasion) the sources are `administration__spec.md` (which describes `administration/{step,queue,actions,module}.js` and `polity/step.js` `updateMomentum`) and the changelog of 2026-11-22, not a fresh read of `src/`; their tests are `tests/{slate_colonize,debate,queue,handling}.test.js`**. On 2026-11-16 the designer ran the whole suite once: `portrait.test.js` (rev 2 of the alignment channel) and six of seven `polity_queue.test.js` tests passed, the seventh (default end to end) was fixed the same day (see Status); the other failures were a stale generated `data/ruleset.json` (run `npm run build:data` after any change to `scenarios/alpha/tuning.defaults.json`). Where code and the old spec disagree, **code wins** (**code-led**); where code lags kb it is listed under Status as outstanding. Anything the kb does not state is **(spec decision)**. Not-yet-written code is **(target)**. Economics half: `economics__spec.md`. Shared scale (confirmed): grievance severity, compliance and need satisfaction are per-cell values in **[0,1]**.

## Data Structures

State and conventions:
```js
state.polity = { cells: Record<CellKey, Cell>, law: Record<Country, {rights: Record<id, Entry[]>, duties: Record<id, Entry[]>, requisitions: ReqEntry[]}>,
                 momentum: Record<`${cellKey}|${need}`, number> /*@cache*/, rung: Record<same, int> /*@cache*/, log: DecisionEntry[], petitions: {cell, need, turn}[],
                 mobilityGap: Record<Country, Record<`${fromEstate}>${toEstate}`, number>>,
                 portrait?: Record<Country, Record<axis, {baseline?: number, mods: Mod[]}>>,          // baseline absent = the Country's amalgam; written by reinforcePortrait (step 5) / worldgen
                 debate?: Record<questionKey, {since, duration, assembly?, holder?, scope?, conceded?, expired?}>, waiting?: Record<questionKey, true>, petitionClock?: Record<questionKey, {since, refused?}> }   // (2026-11-19/22) the debate state is written by Administration step 6 and polity step 5; its shape and rules are in `administration__spec.md` (Question Active Slate, Assembly Queue)
Cell = {key: cellKey(nation, estate, region), nation, estate, region, population, labour, labourCommitted, laborProfile, wealth, satisfaction{subsistence,comfort,luxury},
        grievance: Record<need, 0..1>, pref: Record<axis, baseline>, prefMods: Record<axis, Mod[]>, opinionGovMods, prestigeMods, fairnessMods: Mod[], target, delivered, warHarm,
        flags?: {converged, parts}, defiance: {tax?}, hoardFrac}                  // Mod = {id, value, decay: {kind:'exp', rateKey} | {kind:'ctx', fn}, turn, source}
Entry = {scope, value, declaredTurn, seq?}      // laws are scoped entries per Country (supersedes Cell.rights/duties in modules__spec); ReqEntry = {scope, target:{good}, amount, unit:'fraction'|'absolute', since}
DecisionEntry (as written by engine `writeLog`) = {id: action id, actor: {kind:'government', country} | {kind:'cell', key}, action_type, visibility: 'public'|'covert', turn, affected_cells, loads?: Record<axis, ±1>}
                                  // loads = the act's realized direction on the Portrait axes (action type `axisShift`, else its static `axisLoads`), snapshotted when the act executes
ctx.polityQueue = {requisitionHits: Hit[], defaults?: Default[]}      // per-turn hand-off from Economics step 3, drained by readPolityQueue in step 5; never persisted
countryOf(key) = ctx.derive.worldmap.regionOwner(parseCellKey(key).region);   T = ctx.T (every number is a tuning key; missing key throws)
```
Step 5 order (`step.js`): `stepRemainingPolity` (propaganda → Mobility → Demotion → divergence) → `updateGrievance` per cell → `readDecisionLog` → modifier stacks tick (`opinionGovMods`, `prestigeMods`, `fairnessMods`, `prefMods`, then **`tickPortrait`**) → **`reinforcePortraitFromActs`** (after the tick, so a fresh entry lands at full strength) → **`readPolityQueue`** (after the decay pass, before `bump`) → Questions → momentum/rungs (**`updateMomentum`, which since 2026-11-19/22 also holds the addressed freeze, the expiry modifier of an unresolved debate and the petition refusal clock**: Faction escalation state and Question handling below). Cells act at step 2 from last turn's cached rungs (`decideCellActions`); the Government slate and the assembly queue (step 6) are for next turn.

### Actor (base unit)
Code: `state.polity.cells`, `cellKey`/`parseCellKey` (`kernel/ids.js`), `worldmap/regions.js` (`mergeCells`)
- One cell per `(Nation, Estate, Region)`; no province key. Population-sum constraint holds through `transferCohort` (Mobility/Demotion move population between same-(Nation, Region) cells; extensive stocks move pro rata) and `mergeConverged` (sums).
- `weight(key) = population × max(eps.prestige, prestige(key))`.
- **Not in polity code**: Opinion per (Estate, other Nation), Foreign Standing per (cell, foreign Country), Character-leader, Region fracture/merger/reorganization stock split for polity cells, the Reorganization Event gate (every Veto/Council holder in the Country, then self-interest × Preference alignment). Opinion-toward-Government is `opinionGovMods` (a stack) plus performance plus the alignment term (see Compliance).

### Government and Ledger (resource-holder, not a will — settled 2026-11-02)
Code: `state.admin.governments[country]` = `{ledger, spendingDial: {entries, reserve, sink}, controlDial, inventory, upkeepFraction, poolUnmet, controlBonus, borrowedThisTurn}`; Ledger resolution is Economics `ledgerUpdate` (`economics__spec.md`, Resolution order)
- Actions in code: `setTaxLaw`, `setSpendingDial`, `setControlAllocation`, `placeRequisition` (`polity/actions.js`); **`persuade` (`administration/actions.js`, 2026-11-22) debits the Ledger inside its `apply`**; the Ledger is a stock, never below 0, no Question or Opinion of its own.
- **Not in code**: Borrow/Default/debt-forgiveness events, Direct intervention and Restructuring as spending actions (the dial rows exist, the action types do not), enterprise income, State tariffs/minting inflows, war indemnities.
- Unmet upkeep: `upkeepFraction` (aggregate readout) and, since 2026-11-15, per-pool `poolUnmet` written by `ledgerUpdate` from `pool`-tagged mandatory rows (`economics__spec.md`, Resolution order); Administration's `produceCCO` reads it. Unmet upkeep never spawns Questions.

### Government values and Government-to-Government standing (settled 2026-11-03)
Code: `propaganda.js` (`amalgam`), service `polity.amalgam(country)`
```js
amalgam(country)[axis] = Σ_cells weight(k) × effectivePref(cell, axis) / Σ weight          // derived, never stored; the baseline source of a Portrait with no stored baseline
```
- Used as the default `ideal` of a propaganda commitment with no `ideal`, and (since 2026-11-16) as the Portrait baseline when none is stored (see Government Portrait). Feeding an AI Government's decisions from the Portrait and the player readout: **(target)**, not in polity code.
- **Not in code**: Government-to-Government Foreign Standing (`RelationState.opinion`) as a Weight-aggregate of cells' Foreign Standing + amalgam/Portrait alignment (Countries/Diplomacy side; not verified).

### Estate Labor Profile (per (Nation, Estate, Region) cell)
Code: `cell.laborProfile` (`Record<pool, weight>`); read by Teaching (`economics__spec.md`); blended by `mergeConverged` (population-weighted)
- A target only; actual distribution moves via Teaching at its rate. **Not in code**: the two change channels (structural reform with a Grievance spike; incentive/inspiration funded by Wealth/Persuasion) — no action edits `laborProfile`. Example leans (kb table) are scenario data.

### Estate Convergence (structural, top-down; per (Nation, Region) cell pair — 2026-11-02)
Code: `convergence.js`, wiring `remaining.js`
```js
checklistDistance(a, b) = Σ over ruleset.rights and ruleset.duties of diffValue(effective value of a, of b)          // diffValue ∈ [0,1] per entry; objects average over keys
convergenceCandidates = same (Nation, Region), distinct cells, distance ≤ T('conv.eps')                              // derived, never stored
declareConvergence (event, gate 'administration', needs ≥ 1 candidate)  |  forceConvergence (cell, defiance, minRung 4, utility conv.force × anger × (1 − involuntary) − defy.risk × involuntary)
  → ctx.schedule({dueStep: 8, kind: 'polity.converge', payload: {scope|cell}})                                         // both routes schedule the same merge: Outcome Asymmetry
runConvergence (step 8, before the Region pass): one pair per (Nation, Region) per act → mergeConverged(a, b)
mergeConverged: extensive stocks sum, intensive state blends by population (laborProfile, pref, momentum/rung, mod stacks scaled); estate = mergedEstateLabel; flags.parts keep the shares; obligations re-pointed
divergeCell (every step 5): a converged cell splits by flags.parts when the part Estates' checklists are > conv.eps apart again
```
- Rarity emerges only from the distance condition; no flag. Tested in `tests/politics_remaining.test.js`.

### Scope syntax and Region-level Convergence/Mobility/Demotion (settled 2026-11-02; ladder 2026-11-09)
Code: `kernel/scope.js` (`resolveState`, `covers`, `mergedEstateLabel`), `scopeCtx` (`administration/module.js`), `applyLawEntries` (`remaining.js`)
- Laws are read with `resolveState(entries, cellKey, scopeCtx)` (most specific scope wins) and amounts add (Requisition, Control). `applyLawEntries` replaces the entry with the identical scope (`value === null` removes) — the `reformRightsDuties` action and rebel-peace concessions share it.
- **Not verified in this session** (read `kernel_engine__spec.md`/`scope.js` before relying on it): the full ladder (Cell < Nation < Regional-Estate < Region < Estate < Empire), same-rung "latest declared wins", the Precedence (Autonomy ↔ Unitarism) flag, and the technology flag hiding Estate/Empire scopes.
- Mobility/Demotion/Convergence resolve per (Nation, Region) as the kb says (their own sections); Region split/merge scales cell state in `worldmap/regions.js` (not re-read).

### Existential vs. Secondary needs
Code: `ruleset.needs[id] = {class: 'existential'|'secondary', kind: 'material'|'nonMaterial'|'fairness', tier?, accum, decay, axisLoads}`; `derive.questions`
- Class is data (`identity_autonomy`, `solidarity`, `subsistence` existential; the rest secondary; Fairness secondary by default). A Question's tier is `existential` only if the need's class is existential and `gap > tier.existential`; else `structural` above `tier.structural`; else `routine`.

### Fairness bucket (contribution vs. entitlement — settled 2026-11-01)
Code: `derive.js` (`fairnessGap`), `step.js` (`updateGrievance`)
```js
fairnessGap(key) = contribution(key)/Σ contribution − weight(key)/Σ weight        // over the cells of the cell's Country; > 0 = under-rewarded (contribution: economics__spec.md)
fairness shortfall = clamp01(fairnessGap × T('fair.scale')) + Σ fairnessMods          // entitlement-loss modifiers ride the same bucket (and credit-default grievance, below; the expired-debate and petition modifiers, Faction escalation state and Question handling)
grievance[need] = clamp01(grievance × (1 − n.decay) + n.accum × clamp01(shortfall))   // leaky accumulator; existential fast-in/slow-out, secondary the reverse (data)
material shortfall = 1 − satisfaction[tier];   nonMaterial = target > eps.need ? 1 − delivered/target : 0;   security also adds clamp01(cell.warHarm) + war.occupiedShare(key)
```
- Over-rewarded cells accumulate nothing from the gap (it enters through `max(0)` via `clamp01`). Needs, tiers and pairings are data in `ruleset.needs`; the Portrait-axis pairings (Security, Excellence, Superiority, Pleasure) are `axisLoads`, not code.
- **(code-led)** the old spec's `identity_autonomy` extras (`nonTitularCost`, `suppressionCost`) and a general `warHarm` term on every need are not in code; war harm lands on `security` only.
- Accumulation/decay rates: numbers pass.

### Entitlement loss (decaying modifier on Fairness — settled shape)
Code: `behaviour.js` (`acceptance`, `entitlementLoss`, `decayFns.lossDecay`, `crisisSeverity`)
```js
acceptance = clamp01(acc.w0 + acc.crisis × crisisSeverity(addresses, country) + acc.exposure × max over addressed needs of cell.grievance
                     + acc.burden × (1 − burdenShare) − acc.alt × visibleAlt)
burdenShare = clamp01(0.5 × cost / (mean cost over the Country's cells + 1e-9));   visibleAlt = clamp01(ledger / (ledger + acc.altScale))
crisisSeverity = max over live Questions on the addressed needs of clamp01(gap) × (1 existential | 0.5 secondary)       // read live, never stored
entitlementLoss(holders, action): cell.fairnessMods.push({value: cost × (1 − acceptance) + eps.modifier, decay: {kind:'ctx', fn:'lossDecay'}, addresses})
lossDecay = crisis still live on the addresses ? loss.decay.live : addresses non-empty ? loss.decay.restored : loss.decay.inForce       // read from CURRENT state, never crisis age
```
- Judged from the faction's own exposure, never Government framing. Forcing a vetoed act through Control writes these modifiers, nothing bespoke. Tested in `tests/behaviour.test.js`.
- **(code-led)** `visibleAlt` is a saturating function of the Ledger alone (reserve floor and untouched cheaper levers are not modelled).
- **The size measure `entitlement_loss_size` (kb rev 2, 2026-11-24; the definition is proposed)**: in code it already exists as the `cost` that `ActionType.impact(ctx, a, key) → {cost, relief}` returns for a covering cell, and `cost` is what `entitlementLoss` and `burdenShare` read above. The kb names `cost` the **loss size** and `relief` the **gain size** (`entitlement_gain_size`), on one scale. **Not in code (target)**: a derive that gives both for a set of cells without gating (the debate's concession of a Right needs it):
```js
entitlementSize(ctx, a, keys) -> {loss: Record<cell, number>, gain: Record<cell, number>}       // (spec decision) = {cost, relief} of registry.get(a.type).impact(ctx, a, key) per key; {0, 0} for a type without `impact`
rightConcession(ctx, a, faction) = T('concession.rightK') × mean over faction cells of gain[cell]       // kb: only the faction's own gain counts; a loss the act imposes on it is not subtracted
```
  A Right granted during a debate then adds `rightConcession` to `polity.debate[key].conceded` (like `persuade`'s `amount`); the hook for it is in the polity step after `step2` (read the Government acts of this turn from the Decision Log, as `reinforcePortraitFromActs` does). **Not in code**; `concession.rightK` is a new tuning key (numbers pass).

### Government benefits (settled shape 2026-11-01)
Code: none (target)
- Pain-alleviating benefit = `reliefDelivered`/`fairnessMods` reduction or a Right grant raising `weight`; joy-giving = a positive `opinionGovMods` entry. No `grantBenefit` action; Government grants of goods are Economics Event Drafts (`economics__spec.md`, also target). Payoff curves: numbers pass. A benefit offsetting a requisition hit works today only through the hit's own decay. **`persuade` (2026-11-22) is the one joy-giving benefit in code**: see Compliance.

### Awareness and attributed discontent (settled shape 2026-11-01)
Code: `derive.js` (`awareness`), `step.js` (`readDecisionLog`)
```js
awareness(key) = clamp01(aware.base + aware.k × Σ over {Teaching, Culture, Bureaucrats, Diplomacy, Trade/Commerce} of labour[pool]/Σ labour)
readDecisionLog: for h of ctx.harmQueue {cell, logId, magnitude, kind}:  vis = log entry public ? 1 : 0;  k = awareness × vis;  war → k = k ** attr.warSteepness
                 awareness < attr.lowAwareness → k = 0 (blame redirected to authority/fate, not modelled further);  k > 0 → opinionGovMods.push({value: −magnitude × k, decay: exp(opinion.modDecay)})
```
- Awareness gates attribution only; direct effects reach needs regardless. Intent is never modelled.
- **(code-led)** awareness omits Printed Goods consumption, `urbanization_rate` and held political Rights (Council/Petition/Veto); covert acts are simply invisible (no detection tiers, no per-observer reveal, no recency decay of `vis`); redirected blame goes nowhere. These are the kb's targets.

### Decision Log (alpha causal-provenance mechanism — settled shape 2026-11-01)
Code: `state.polity.log` (read by `readDecisionLog`, `actionRecord` and `reinforcePortraitFromActs`); written by the engine's `writeLog` (`engine/engine.js`) on every executed action
```js
entry = {id: a.id, actor, action_type, visibility: 'public' | 'covert', turn, affected_cells, loads?}          // covert concealment tier lives on a CovertOp referenced from the entry (log schema unchanged)
loads = typeof type.axisShift === 'function' ? type.axisShift(ctx, a) : type.axisLoads          // evaluated BEFORE type.apply (it reads the state the act changes); omitted when the type has none
```
- **(spec decision, 2026-11-16, confirmed)** `id` is the action's own id (it was not written before, so `readDecisionLog`'s lookup by `harmQueue.logId` found nothing; no harm producer exists yet). `loads` snapshots the act's realized direction so the record can tell a tax cut from a tax rise; old entries without it fall back to the type's static `axisLoads`.
- **Action type hook (Actions)**: `axisShift(ctx, a) → Record<axis, ±1>`, optional; implemented for `setTaxLaw` and `placeRequisition` (see Requisition Duty and below). `actions__spec.md` lists the hook (2026-11-16/18); the Actions kb text for it is in rev 2.
- **Known schema gap (kb and this spec)**: the kb's entry schema in this section still reads `{actor, action_type, visibility, turn, affected_cells}` (no `id`, no `loads`); the code and the Actions kb have both. To be corrected in the kb at the planned chapter split of this file (the Decision Log section is untouched on purpose until then).

### Rights checklist (universal, per-cell configurable)
Code: `derive.js` (`right`), `ruleset.rights[id] = {silentDefault, prestigeWeight}`
- Silence = allowed (`silentDefault`). Ids consumed in code: `MarketAccess`, `Lending`, `TradeInfraConstruction`, `EstateMobility` (scalar 0–1), `Veto.<domain>` (strict `=== true`; domains in `remaining.js` DOMAIN: taxLaw, market, skilledLabour, retinue, administration), `Forbid.<actionId>` (a law forbidding a cell action), `Council` (**consulted, non-blocking is not implemented: Veto only**), **`Petition` (read by the assembly queue and the slate for the priority multiplier, the agenda share and `handling`: `administration__spec.md`)**. The rest of the kb checklist is scenario data in `ruleset.rights` with no consumer yet (Land is Economics' `land`; Retinue is read by War).
- **Not verified**: Precedence flag (see Scope section).

### Estate Mobility (bottom-up, gradual, individual/family-scale)
Code: `mobility.js`; Government action `setMobilityGap`
```js
eligible(origin, dest, country) = mobilityGap(country, origin.estate, dest.estate) defined && prestige(dest) − prestige(origin) ≤ gap       // no gap set = not eligible
stepMobility: for each cell with scalar = clamp(right('EstateMobility'), 0..1) > 0: total = min(1, scalar × T('mob.eligibleShare')) split over eligible same-(Nation, Region) cells
  moved = transferCohort(origin, dest, share);  origin opinion mod +mob.originGain × share;  dest opinion mod −mob.destResent × moved/dest.population         // both target the Government
```
- Permanent: `setMobilityGap` blocks further conversion only; revoking never reverts movers. Tested in `tests/politics_remaining.test.js`.

### Duties checklist (universal, per-cell configurable)
Code: `derive.js` (`duty`), `ruleset.duties[id] = {prestigeWeight}`
- Consumers verified: `Taxation` `{market, wealth}` (Economics), `Demotion` (scalar), Requisition (as `law.requisitions`, not a duty entry). **Unverified/no consumer found**: Levy, Corvée, Hospitality/billeting, Loyalty oath, Skilled-labour duty (War/Administration may read some).

### Wealth flow (per Actor, per turn)
Code: Economics step 3 (`economics__spec.md`); polity only reads `wealth`, `salesValue`, `cash`. Net position `wealth + claims − obligations` is derived in `demotion.js` (`netPosition`); no polity-side Wealth math.

### Prestige (derived, recomputed/turn)
Code: `derive.js` (`prestige`)
```js
prestige(key) = Σ over ruleset.rights of prestigeWeight × (number | boolean→1 | 0) − Σ over ruleset.duties of prestigeWeight × burden (number | Σ object values | 0) + stack(prestigeMods)
```
- **(spec decision)** structural baseline = weighted Rights minus weighted Duty burden; the Character channel (post-alpha) is absent; there is no action pushing `prestigeMods` yet.

### Duty compliance
Code: `derive.js` (`compliance`), consumers in Economics (`taxation`, `requisition`) and `demotion.js`
```js
delivered = claimed × compliance(key).involuntary          // involuntary from Administration's controlGrant(key); no Bureaucrats/Army/Police trio
```

### Skilled-labour Duty — make vs. buy
Code: none (target): conscript via Duty (free, uses Control, `labourCommitted`) vs. purchase on the market (money; tariffs partially clawed back). Not in polity or Economics.

### Requisition Duty (settled 2026-11-01)
Code: Government action `placeRequisition`, resolution in Economics `requisition` (`economics__spec.md`), hit in `step.js` (`readPolityQueue`), structural hit through `portrait.js` (`alignment`)
- `placeRequisition {good, amount, scope}` (gate domain `market`; impact = cost proportional to amount × `salesValue`/scale; static `axisLoads: {extraction_investment: -1}`, realized direction `axisShift`, below) writes `law.requisitions` (replaces any entry for that good; amount 0 removes). Scope is the shared scope filter; pre-cascade resolution with delivered scaled by involuntary compliance; goods go to `gov.inventory`.
- **Direct Opinion hit (kb rev 2 alpha shape, implemented 2026-11-15)**: Economics pushes `{cell, country, target, claimed, delivered, value, shortfall}` per covered cell to `ctx.polityQueue.requisitionHits`; `readPolityQueue` consumes and drains it:
```js
for h of requisitionHits:  skip if !cell or !(h.value > 0)                        // a requisition that took nothing (no Control) is no hit
  burden = h.value / max(1e-9, (cell.salesValueBase ?? 0) + h.value)            // share of the cell's own market output (base value) that was taken
  addOpinionMod(cell, {id: `req.${turn}.${h.target}`, value: −T('req.opinionHit') × burden, decay: exp(opinion.modDecay), turn, source: 'requisition'})
```
  The hit is on delivered goods, abundant goods included; the unmet claim shows up as defiance, not a second hit. It enters `opinionGov` (hence voluntary compliance) from the next turn.
- **Structural hit (kb rev 4, 2026-11-16, confirmed)**: not a separate stock and no extra code in the queue reader. The executed `placeRequisition` is a public Decision Log entry whose `loads` carry its direction:
```js
placeRequisition.axisShift = (ctx, a) => { prev = law.requisitions entry for a.params.good ?.amount ?? 0, next = a.params.amount ?? 0
  next > prev ? {extraction_investment: −1} : next < prev ? {extraction_investment: +1} : {} }        // a bigger take is Extraction; a smaller or lifted one is Investment
```
  It feeds `actionRecord` and reaches each cell through `alignment` (Cell Preferences & Propaganda). The entry fades with age (a standing requisition does not renew it: settled for alpha).
- **Not in code**: pool (labour) targets in the action (the kb scope allows goods or pools); weighting of the direct hit by how essential the good is and softening by crisis acceptance (kb open); offset by later benefits except through decay.
- Hit size: `req.opinionHit` (placeholder 2, numbers pass).
- Tests: `tests/polity_queue.test.js` (hit = `req.opinionHit × burden`; nothing delivered is no hit; a bigger take hits harder; no Control, no hit); `tests/portrait.test.js` (a requisition entry lowers an Investment-leaning cell's Opinion more than an Extraction-leaning one's; its direction through `axisShift`).

### Credit default consequences (settled 2026-11-15)
Code: `step.js` (`readPolityQueue`); the default itself is Economics `debtService` (`economics__spec.md`, Credit)
```js
for d of polityQueue.defaults {creditor, debtor, principal}:  skip if !creditor cell
  loss = d.principal / max(1e-9, creditor.wealth + d.principal)                 // share of what the creditor held before the loan; never above 1
  addOpinionMod(creditor, {id: `default.${turn}`, value: −T('default.opinionHit') × loss, decay: exp(opinion.modDecay), turn, source: 'default'})
  creditor.fairnessMods.push({id: `default.${turn}`, value: +T('default.fairnessHit') × loss, decay: exp(opinion.modDecay), turn, source: 'default'})     // enters the Fairness shortfall in updateGrievance
```
- The debtor takes no additional Opinion hit (its cost is the net-position fall, Demotion's `netPosition`). Neither modifier is a stored currency. The Rights-tier CB for a cross-Country default is Diplomacy's and **not wired**.
- Coefficients `default.opinionHit` (placeholder 2) and `default.fairnessHit` (placeholder 0.3): numbers pass.
- Tests: `tests/polity_queue.test.js` (hits by loss share on a hand-built queue, the debtor untouched, queue drained; an obligation past the arrears limit defaults end to end — the end-to-end test starts the obligation already past the limit so it defaults whether or not the debtor can pay that turn's interest).

### Subinfeudation
Code: none (target): Actor A with Local Jurisdiction over B provides Control to enforce B's Duty compliance at no Opinion cost, receives a share of B's Corvée output and collects estate-tariffs on transited zone edges (Economics Estate-Tariffs, also target).

### Grouping / Faction computation (Question-time only, never persisted)
Code: `behaviour.js` (`factions`, a derived readout; service `polity.factions`); **`administration/step.js` (`factionOf`, `questionScope`, `durationOf`, `assemblyOf`, 2026-11-22)** for the faction that raised a Question
```js
factions(ctx) = for each need with live Questions:
  groups per (country, estate); an Estate group fractures per Nation when mean |Δpref| between the first cells of two Nations > −T('faction.fracture')       // (code-led)
  blocs per country: a faction joins a bloc when every member's 1 − |Δpref| ≥ T('faction.align') − 1
  → {need, country, estates, cells, weight, momentum: Weight-aggregated, fullNation: more than one faction in the bloc}
factionOf(q)     = the cells of q's Country that hold a live Question on the same issue (q.cell included), and the Regions they sit in       // issue = the need, the last part of the key  (kb rev 2, 2026-11-22)
questionScope(q) = regions(factionOf(q)) = 1 ? 'region' : regions > 0.5 × (the Country's Regions) ? 'empire' : 'multi'                          // fixes the length (1 / 3 / 5 turns) and the assembly of the debate (`administration__spec.md`)
```
- **(code-led)** a factions readout, not acting blocs: nothing consumes it for decisions; `fullNation` is "more than one faction", not "all four Estate cells share the goal"; coordination cost (`bloc.cost`) and the Coordination capacity of cells are not computed; the acting set is each cell's own `decideCellActions`.
- **(spec decision, kb rev 2)** `factionOf` is **not** the `factions` readout: it is the plain set of cells with a live Question on the same need, with no Estate/Nation fracture and no alignment test. It is what the debate machinery uses (scope, expiry modifier, `persuade` targets, the faction population that prices `persuade`); the readout above feeds nothing in the debate. The two may be merged when blocs become acting factions.
- Stance and agency: per cell, `stance(selfInterest × alignment)` with `alignment = max(0, 1 + stance.align × Σ sign(load) × effectivePref)` (this is the action-stance alignment in `behaviour.js`, a different quantity from the Opinion alignment in Compliance; it reads the static `axisLoads`, not a realized direction).
- Faction action set in code: `petition`, `taxRefusal`, `hoard`, `buildTradeInfra`, `counterPropaganda`, `forceConvergence`; armed rung → War, kin-state appeal and seek recognition → Countries/Diplomacy (not in polity), strike/Duty-withholding **not in code** (taxRefusal is the withheld duty).
- Tests: `tests/handling.test.js` (the scope of a Question in a four-Region Country: 1 of 4, 2 of 4, 3 of 4), written 2026-11-22, **not yet run**.

### Faction escalation state (settled 2026-11-02)
Code: `step.js` (`updateMomentum`, `rungOf`), `behaviour.js` (`cellRung`); the slate-side helpers `addressed`, `isListed`, `extendedNow` and the expiry/petition helpers are in `administration/step.js` and `polity/step.js` (`administration__spec.md`, Question Active Slate, owns their formulas)
```js
momentum[key] = m0 × (1 − mom.decay) + mom.rise × gap × (addressed ? T('slate.addressedRise') : 1)          // key = `${cellKey}|${need}`; (2026-11-19/22) the attention factor is the addressed freeze: slate.addressedRise 0 = the rise is frozen while the Question is discussed, the decay is not
rungOf(m, prev): highest i such that m ≥ rung.enter[i−1] or (prev ≥ i and m ≥ rung.exit[i−1])          // banded hysteresis
lapsed Question (grievance ≤ compliance): momentum × (1 − mom.decay), removed below eps.modifier together with its rung
cellRung(key) = max rung over the cell's needs
```
- Cached, re-derivable, carried per (cell, need) not per faction; repression lapses the Question but leaves grievance. Existential shocks skip rungs only through the larger rise. Bloc momentum is the Weight aggregate in `factions`; below-rung members' non-participation is **not** applied (**code-led**). Thresholds: numbers pass.
- **A discussed Question does not rise (kb rev 2, settled 2026-11-19/20; code 2026-11-19/22)**: `addressed(q, g)` = a debate record that is still within its length (`turn − since < duration`), or, with no debate record, the Question is listed (on `gov.attention` or in `gov.standing`) and not `waiting`, or an `extendDebates` commitment holds it. While addressed the rise is multiplied by `slate.addressedRise` (placeholder 0); a waiting or unlisted Question rises as before. **(code-led)** the kb's "finite Coordination affects rise" is now this one factor, not a continuous attention fraction.
- **An unresolved debate leaves a minor modifier (kb rev 2)**: when a debate record that has not `expired` is no longer addressed, `updateMomentum` sets `expired` once and pushes, on every cell of `factionOf(q)`, a Fairness modifier `debate.expiryGrievance × (cell holds Petition ? petition.expiryMult : 1)` (decay `opinion.modDecay`, source `debate`), unless the debate's `conceded` reached `petition.comparable`. The Question is not addressed again until it stops being live; `step 5` drops its `polity.debate` record, petition clock and `extendDebates` commitments when it does (resolved or faded: no modifier).
- Tests: `tests/slate_colonize.test.js` (the freeze through a real turn, green in the run of 2026-11-20), `tests/debate.test.js` (expiry modifier, extension) and `tests/handling.test.js` (the moderate and the minor modifier, the concession that leaves none), the last two **not yet run**.

### Compliance (per Actor cell, per need)
Code: `derive.js` (`compliance`, `opinionGov`), `portrait.js` (`alignment`)
```js
voluntary = sigmoid(opinion.k × opinionGov);  involuntary = 1 − exp(−controlGrant(key) / (compliance.controlPerCapita × max(1, population)));  total = min(1, voluntary + involuntary)
opinionGov = opinion.perf × (mean satisfaction − opinion.satNeutral) + opinion.align × alignment(key) + Σ opinionGovMods          // alignment is signed: gain when the Government's behaviour matches the cell's ideal, loss when it opposes it
```
- The alignment term landed 2026-11-16 (kb Cell Preferences & Propaganda rev 3). `compliance` is the same scalar for every need (per-need compliance = total). Tested in `tests/econ_polity.test.js`; the alignment term in `tests/portrait.test.js`.
- **Persuasion (kb rev 3, 2026-11-24 confirmed): Question-time Persuasion is the Government event `persuade {questionKey, amount}` (`administration/actions.js`, 2026-11-22)**: `cost = persuade.costK × amount × Σ population of factionOf(q) / persuade.popUnit`, paid from the Ledger inside `apply`; every cell of the faction gets `addOpinionMod({id: 'persuade.<turn>.<key>', value: amount, decay: exp(opinion.modDecay), source: 'persuasion'})`; the debate's `conceded` grows by `amount`. It raises `voluntary` through `opinionGov` and never touches `involuntary`. The Question stops being live only through the ordinary trigger (`grievance > compliance.total`). **Not in code**: standing/proactive Persuasion. Spec of the action: `administration__spec.md` (Question Active Slate); test: `tests/handling.test.js` (cost, Opinion modifiers, concession record; written 2026-11-22, not yet run).
- `opinionGovMods` also receives the requisition and credit-default hits (above) besides attributed discontent, Mobility, Demotion, civil-war suppression and persuasion.

### Pressure and Question queue
Code: `derive.js` (`questions`)
```js
questions = for each cell and need with grievance > compliance.total: {key: `${cell}|${need}`, cell, need, gap, tier}          // independent of the Government slate
```
- **Not in code**: `Pressure(Country) = Σ severity × population × weight`, `queue_priority = f(severity, Weight) × Petition_multiplier` (the slate lives in Administration, `administration__spec.md`; its `priority = gap × Weight × (Petition ? queue.petitionMult : 1)` is the instantiation), routine-tier minor-issue handling cost, Observation-gated visibility of off-slate escalation (Administration side).

### Question handling — consultation and petition (2026-11-09, proposed: modifiers land on the Fairness bucket)
Code: cell action `petition` (`polity/actions.js`); **handling, the petition clock and the expiry modifiers (2026-11-22, confirmed 2026-11-24): `polity/step.js` (`updateMomentum`, `petitionRefusal`, `expiryModifier`) and the readout `derive.administration.slate`; not yet run**
```js
handling(q) = discussed(q) ? (cell holds Petition ? 'debated' : 'consulted') : 'ignored'          // derived, never stored (`administration/module.js`, the readout row `handling`); discussed = addressed (above)
petition (cell action, permitted, minRung 1): appends {cell, need, turn} to state.polity.petitions        // the cell's claim to be heard; the Petition RIGHT (right(cell, 'Petition')) is what the rules below read
petitionRefusal(q): a live Question of a cell holding Petition that is not discussed:  clock {since} on first sight (polity.petitionClock[key]);
  when turn − since ≥ T('petition.grace') and not refused → refused = true; cell.fairnessMods.push({id: `petition.${key}`, value: T('petition.refuseHit'), decay: exp(petition.refuseDecay), source: 'petition'})      // large, slow, ONCE
  being discussed (addressed) before the grace runs out drops the clock; the clock is dropped with the Question
expiry of an unresolved debate: the modifier in Faction escalation state (× petition.expiryMult on a petitioning cell; none when conceded ≥ petition.comparable)
concession: persuade (amount)  [in code]  |  a Right granted during the debate (rightConcession)  [target, see Entitlement loss]
consultation (a cell WITHOUT Petition): no refusal clock, no refusal penalty; ignoring it costs only Outcome Asymmetry
```
- **(spec decision, confirmed 2026-11-24)** the Petition Right (not the `petition` action) decides `debated` vs `consulted` and who has a refusal clock; the cell action `petition` only records the cell's request in `state.polity.petitions` (code-led: nothing else reads that list yet); the three modifiers (large slow refusal, moderate expiry, minor expiry) are all Fairness-type (`fairnessMods`) and decay without becoming a stored currency.
- **Not in code**: a Right granted during a debate as a concession (target: `rightConcession`, Entitlement loss), the slate-attention cost of debating beyond the assembly slot (the slot and the slate threshold are both charged), standing consultation of an existential need for cells without Petition (the readout labels it `consulted`; no hearing is opened for it), early resolution of a debate (`administration__spec.md`, Assembly Queue: the decision rule is a kb target, no code).
- Sizes and decay: numbers pass. Placeholders: `petition.grace` 1, `petition.refuseHit` 0.3, `petition.refuseDecay` 0.03, `petition.expiryMult` 3, `petition.comparable` 1, `debate.expiryGrievance` 0.05 (`administration__spec.md`, Question Active Slate, lists all the keys).
- Tests: `tests/handling.test.js` (handling derived as debated / consulted / ignored, the petition clock: once, slow decay, no clock without Petition, heard before the grace; the moderate and the minor expiry modifier; the concession that leaves none), written 2026-11-22, **not yet run**.

### Government Portrait (Country-level root trait bundle)
Code: `portrait.js` (`portrait`, `reinforcePortrait`, `reinforcePortraitFromActs`, `tickPortrait`), derive `polity.portrait(country)`; state `state.polity.portrait`
```js
portrait(country)[axis] = clamp((stored[axis]?.baseline ?? amalgam(country)[axis] ?? 0) + stack(stored[axis]?.mods ?? []), -1, +1)          // axes = stored axes ∪ amalgam axes; derived on read
reinforcePortrait(ctx, country, axis, value): push {id: `portrait.${turn}.${axis}`, value, decay: exp('pref.modDecay'), turn, source: 'reinforcement'} onto stored[axis].mods; ctx.bump()
tickPortrait(ctx) (step 5, with the other stack decays): every stored stack ticks like a prefMods stack
reinforcePortraitFromActs(ctx) (step 5, after tickPortrait): for each Decision Log entry of THIS turn with actor.kind === 'government' (public or covert):
    loads = e.loads ?? registry type axisLoads;  for each axis with load l ≠ 0:  reinforcePortrait(ctx, e.actor.country, axis, sign(l) × T('portrait.reinforce'))
```
- **(kb rev 3, confirmed 2026-11-16)** the reinforcement trigger is Government actions/behaviour: each executed Government act, whether visible or not, pushes the Portrait a fixed step toward the pole it acts on; no success/failure term yet. A missing baseline reads as the amalgam, so an AI-run Country's Portrait follows its cells; a worldgen-assigned baseline (written to `portrait[country][axis].baseline` by the scenario) overrides it. The stack reuses the tuning key `pref.modDecay` for decay (a Portrait-specific key is a numbers-pass split); `portrait.reinforce` (placeholder 0.05) is the step.
- **Not in code**: success/failure and stakes scaling of the step (kb open); the use of the Portrait by AI behaviour (outside this module; `ai_diplomacy` etc. not verified); succession-type baseline changes (Characters, post-alpha). The Portrait is never read by cells: they read the action record (below).
- Tests: `tests/portrait.test.js` (amalgam default, stored baseline wins, reinforcement pushes and clamps, ticking decays the stack, a turn with a tax rise reinforces the Extraction pole by `portrait.reinforce`).

### Cell Preferences & Propaganda (settled shape 2026-11-01; mechanics partly proposed)
Code: `propaganda.js`, `cellstate.js` (`effectivePref`, `prefMods`), `remaining.js` (action types), `portrait.js` (`actionRecord`, `observedPortrait`, `alignment`)
```js
effectivePref(cell, axis) = clamp(baseline + Σ prefMods[axis], -1, 1)          // cellstate.js; portrait.js computes the same sum locally (prefOf) instead of importing it
propaganda (commitment; Government: params.amount of Coordination; others: pool ∈ {Culture, Teaching}, amount ≤ freePoolLabour, zero-sum with ordinary use)
  stepPropaganda (start of step 5): targets = cells covered by params.targets; ideal = params.ideal ?? amalgam(country); per = amount / targets
    pool 'Teaching' → educatePreference(cell, ideal, per):  baseline += min(1, edu.rate × per / population) × (ideal − baseline)          // slow, durable
    else            → pushPreference(cell, ideal, per):     push = sign(gap) × min(|gap|, prop.rate × prop.resist × per / population); Σ mods clamped to ±pref.modRange; decay exp(pref.modDecay)   // fast, modifier stack, reversible
counterPropaganda (cell, permitted, minRung 1, pool Culture): pulls the cell's own effective preference back toward its baseline, re-decided every turn
liftPropaganda (event) removes a commitment;  commitments of vanished cells lapse
```
Alignment channel (kb rev 3, confirmed 2026-11-16; all derives, memoised per bump, never stored):
```js
actionRecord(country)[axis]       = Σ over ctx.state.polity.log entries e with e.visibility === 'public' && e.actor.kind === 'government' && e.actor.country === country:
                                      sign(load(e, axis)) × (1 − T('opinion.modDecay')) ** max(0, turn − e.turn)          // load(e, axis) = e.loads?.[axis] ?? registry.types.get(e.action_type)?.axisLoads?.[axis]; unknown types skipped
observedPortrait(key)[axis]       = awareness(key) × r / (1 + |r|),  r = actionRecord(countryOf(key))[axis]                  // (−1, +1); the 1 in the denominator is one fresh act's worth, structural
match(key, axis)                  = 1 − |effectivePref(cell, axis) − observedPortrait(key)[axis]|                         // +1 at the cell's ideal, −1 at opposite poles
alignment(key)                    = Σ over the record's axes of |observedPortrait[axis]| × (match > 0 ? T('opinion.alignGain') × match : match)          // signed; silent record → 0
```
- The record is the Government's own acts (cell acts are excluded); covert entries are invisible to every cell (as in `readDecisionLog`). The **direction** of an act comes from `loads` on its log entry: `setTaxLaw.axisShift` and `placeRequisition.axisShift` return Extraction (−1) for a rise and Investment (+1) for a cut or a lifted requisition; other types carry their static `axisLoads`.
```js
setTaxLaw.axisShift = (ctx, a) => { d = Σ over cells covered by a.params.scope of (market − cur.market) × salesValue + (wealth − cur.wealth) × wealth   // value-weighted change of the take
  if d = 0: d = the plain sum of rate changes over covered cells
  d > 0 ? {extraction_investment: −1} : d < 0 ? {extraction_investment: +1} : {} }
```
- **(spec decision, confirmed)** the 1 − distance recentring puts the neutral at "half an axis away"; gains are scaled by `opinion.alignGain` (placeholder 0.5, so that being served is worth less than being opposed of equal mismatch); salience weighting means a silent Government changes nothing. Code-led limits: a standing law does not renew its entry (it fades; accepted for alpha); the record's memory reuses `opinion.modDecay`; the whole log is scanned per bump (prune by age if it grows); the stance of Veto holders (gating) still reads the static load, not the realized direction.
- Printed Goods as a directed *good* channel is deferred (`PROPAGANDA_POOLS = ['Culture','Teaching']`); propaganda is covert by default; Persuasion is separate (Opinion; see Compliance). Competing propaganda sums on the same stack. Foreign propaganda reuses `pushPreference` (Diplomacy `foreignPropaganda`). Tested in `tests/politics_remaining.test.js`; the alignment channel in `tests/portrait.test.js`.
- Resistance to propaganda (`prop.resist` is a flat key; Faith/Identity/awareness resistance is open in kb).

## Rules
Code: per-rule notes
1. Derived values are recomputed on read (`derive.*`, memoised per bump); `momentum`/`rung` are the only polity caches (`@cache`, re-derivable), besides the debate records of Administration.
2. Faction/bloc shape is never stored (`factions` derived; `factionOf` derived).
3. Need class is data, not code.
4. Duty extraction scales with `compliance.involuntary` (tax, requisition, demotion).
5. Rights/Duties are `ruleset` data; an Estate's identity is its checklist configuration + label.
6. Veto/other categories are open-ended (`Veto.<domain>`, `Forbid.<id>` by name).
7–10. Profile rules: `laborProfile` is per-cell data; nothing but Teaching moves actual labour; changing it has no action yet (**target**).
11. Outcome Asymmetry: `declareConvergence` and `forceConvergence` schedule the same handler (tested).
12. Mobility and Demotion share the Prestige derivation, independent checklist entries, net position triggers Demotion.
13. Portrait axes as root traits: stored Portrait with stack and readout in `portrait.js`, reinforced by Government acts each turn; no AI consumer in polity yet (**target**).
14. A Question exists per (cell, need) when `grievance > compliance.total`.
15–17. Ledger stock rules: Economics `ledgerUpdate`; no Ledger-drawing action may touch another Actor's resources (not enforced; the only Ledger-paid action in code, `persuade`, touches none).
18–19. Fairness gap and entitlement loss as in their sections; the loss and gain sizes are the `cost` and `relief` of the act's `impact` (target derive `entitlementSize`).
20. Awareness gates attribution only; intent never modelled.
21–22. Factions derived; Questions independent of the slate.
23. Unmet upkeep: `upkeepFraction` and per-pool `poolUnmet` (both written by `ledgerUpdate`); never spawns Questions.
24. Requisition scopes and pre-cascade order (Economics); the direct Opinion hit is consumed in polity step 5, the structural hit reaches cells through the action record and `alignment`.
25. Preference baseline + decaying stack; propaganda pool-gated; reversible.
26. Portrait/AI vs player record: cells read the action record (`actionRecord`/`observedPortrait`); the Portrait is for AI behaviour only (no consumer in polity).
27. Bloc coordination cost: **not in code**.
28. Borrowing/reserve floor: spending dial in code; Borrow event not.
29. Momentum cached per (cell, need) with banded hysteresis (tested).
30. Scope filter: `resolveState`/`covers` (ladder and Precedence flag unverified).
31. Convergence/Mobility/Demotion per (Nation, Region); rarity emergent (tested).
32. No anonymous debts: Economics `Obligation` records.
33. Cells are actors: `decideCellActions`.
34. Government values: `amalgam` readout; also the Portrait baseline when none is stored.
35–36. Per-Region laws, tech-gated Estate/Empire scopes: unverified.
37. Petition handling penalties: refusal clock, moderate/minor expiry modifier, comparable concession (written 2026-11-22, **not yet run**; kb alpha shape confirmed 2026-11-24).
38. A discussed Question's momentum does not rise; a waiting or ignored one does; an unresolved debate leaves one minor modifier per cell of its faction (code 2026-11-19/22; the freeze green on 2026-11-20, the modifier not yet run).
39. The scope of a Question is the scope of its faction (`questionScope`): 1 Region / several / more than half of the Country's Regions, fixing the debate's length and assembly (written 2026-11-22, not yet run).
40. `persuade` pays from the Ledger, adds an Opinion benefit to the faction and a concession to the debate (written 2026-11-22, not yet run; a Right as a concession is a target).

## Status
- **Implemented, with a test file covering it**: grievance accumulator and Fairness gap, Compliance, Questions (iff grievance > compliance), momentum with banded rungs (`tests/econ_polity.test.js`); gating by Veto holders, acceptance, force-through with entitlement-loss modifiers and `lossDecay`, cell action choice (permitted/granted/defiance, rung-gated), `petition`/`taxRefusal`/`hoard`/`buildTradeInfra`, derived factions (`tests/behaviour.test.js`); **Estate Mobility, Demotion, Convergence (declare, force, diverge), propaganda (Government and cell, Teaching education), counter-propaganda** (`tests/politics_remaining.test.js`). Test files were checked; individual test names were **not** re-verified, so the `1` code revs in Sync are provisional until spot-checked.
- **Implemented 2026-11-15**: `readPolityQueue` — the direct requisition Opinion hit and the credit-default consequences (`tests/polity_queue.test.js`; first run 2026-11-16: six of seven green, the end-to-end default test failed because it relied on the debtor having no income, now rewritten; it is to be re-run).
- **Implemented 2026-11-16, tests written the same day** (all code revs below rest on them; lower to `-` if red): the Opinion-alignment channel — `actionRecord`, `observedPortrait`, `alignment` (aligned cells gain via `opinion.alignGain`, misaligned lose) and the `opinion.align × alignment` term in `opinionGov`; the stored Portrait — `portrait`, `reinforcePortrait`, `reinforcePortraitFromActs`, `tickPortrait` (`src/modules/polity/portrait.js`); **engine**: `writeLog` writes `id` and `loads`, step 2 snapshots `loads` before `apply`; **actions**: `axisShift` on `setTaxLaw` and `placeRequisition`; tuning keys `opinion.alignGain`, `portrait.reinforce` (**run `npm run build:data` to regenerate `data/ruleset.json`**). Tests: `tests/portrait.test.js` (rewritten for the gain and the direction), `tests/polity_queue.test.js`. **Risk to check first**: any test that executes public Government actions and then asserts exact `opinionGov`/`compliance` values for cells with non-zero `pref`.
- **Implemented 2026-11-19/22 (this spec section added 2026-11-24 from `administration__spec.md` and the changelog, not a fresh read of `src/`)**: the addressed freeze (green in the run of 2026-11-20), the expiry modifier, the petition refusal clock and moderate expiry modifier, `factionOf`/`questionScope`, handling as a readout, `persuade`. Tests `tests/{debate,queue,handling}.test.js` **written, not run**; the last suite run (2026-11-20, 194 tests) passed 186 and the eight failures (`transfer.js` debt records, a `reorg.js` duplicate, tests assuming nothing migrates) were fixed and **not re-run**. **To run first**: `npm run build:data` (24 new tuning keys since 2026-11-19, among them `question.turns.multi`, `question.turns.empire`, `petition.*`, `persuade.*`), then `npm test`. The code revs of the sections concerned (Sync below) are provisional until then.
- **Outstanding vs kb (code to follow kb, designer to decide order)**: (1) success/failure and stakes scaling of Portrait reinforcement, and the Portrait's consumers (AI behaviour, outside this module); (2) essentialness weighting and crisis-acceptance softening of the direct requisition hit (kb open); (3) attribution: covert detection tiers, recency decay, low-awareness redirect; awareness inputs (Printed Goods, urbanization, held Rights); (4) factions as acting blocs with Coordination cost (the kb's attention factor on the rise is the addressed freeze only); (5) **a Right as a concession in a debate (the `entitlementSize` derive and `rightConcession`; kb 2026-11-24) and standing Persuasion** (the rest of Petition handling and Question-time Persuasion is written, not run); (6) Borrow/Default/debt-forgiveness and Direct/Restructuring actions; (7) benefits other than `persuade`, Labor Profile change channels, Prestige modifier actions; (8) Region reorganization gating and polity-cell split on Region fracture; (9) Foreign Standing and Government-to-Government standing; (10) Skilled-labour Duty make-vs-buy and Subinfeudation; (11) the stance of Veto holders toward an act with a realized direction (gating reads the static load); (12) ~~the Actions kb/spec do not list the `axisShift` hook~~ (listed in `actions__spec.md` since 2026-11-16/18); (13) **the debate's decision rule and the answer object** (`administration__kb.md` 2026-11-24, proposed; needs `entitlementSize` for its stance inputs).
- **Not verified this session**: scope ladder and Precedence flag (`kernel/scope.js`), tech gate on Estate/Empire scopes, `cellstate.js`/`transfer.js` internals, `kernel/modifiers.js` (`tick` and `value` used as `step.js`/`derive.js` use them), how `tests/fixtures.js` builds its ruleset (the stale-ruleset failures showed it reads `data/ruleset.json`).
- **(code-led)**: no `warHarm` term on every need (security only), `visibleAlt` from the Ledger alone, awareness from five pools only, the momentum attention factor is the addressed freeze (`slate.addressedRise`), `fullNation` = more than one faction, `clamp01` on the Fairness gap, public-or-invisible attribution, propaganda covert by default with Culture/Teaching labour (Printed Goods channel deferred), Mobility needs an explicit `mobilityGap` per Estate pair, Demotion goes to the same-(Nation, Region) cell with the closest Prestige below, Demotion Control gain written to `controlBonus` for next turn, tuning keys listed below; **the Petition Right, not the `petition` action, decides `debated` vs `consulted`**; `factionOf` is its own simple set, not the `factions` readout.
- **Confirmed 2026-11-15 (were spec decisions)**: the `polityQueue` hand-offs and their shapes; the burden definition of the direct requisition hit (delivered value ÷ (value still sold + value taken)); the credit-default hits on the creditor (Opinion and Fairness, by loss share) with no extra debtor hit; the three coefficients as placeholders.
- **Confirmed 2026-11-16 (were spec decisions)**: the alignment channel's shapes (public Government record, `x/(1+|x|)` saturation, awareness scaling, salience-weighted match, reuse of `opinion.modDecay`/`pref.modDecay`), the Portrait storage and baseline rule, the structural requisition hit as this channel; **designer decisions**: aligned cells gain, a standing law may fade, direction of an act matters, the Portrait is reinforced by Government actions.
- **Confirmed 2026-11-24 (were spec decisions)**: the Question-handling alpha shape (derived handling, refusal clock and large slow modifier, moderate and minor expiry, `persuade` as a Ledger-paid concession, the comparable concession), the Country's assembly for multi-Region and country-wide Questions; **proposed 2026-11-24 (awaiting OK)**: the size measure as the act's `impact` (`entitlementSize`, `rightConcession`, `concession.rightK`), a debate resolved by an adopted answer leaves no expiry modifier.
- **(spec decision)** (pending confirmation): laws per Country as scoped entries; `harmQueue` hand-off; formula shapes above; `compliance` shared across needs; Prestige as weighted Rights − Duties; `Forbid.<id>` as the way a law forbids a cell action; `setMobilityGap` as the per-pair gap action; the Decision Log `id`/`loads` fields and the `axisShift` hook (confirmed with the 2026-11-16 proposals).
- **Open (kb)**: accumulation/decay rates; Opinion fracture thresholds; Prestige weighting; Profile normalisation; Convergence/Mobility/Demotion thresholds; Portrait success/failure scaling; bloc alignment threshold; rung ordering and band widths; Requisition and default hit sizes; initial Estate world-views; petition and expiry modifier sizes; `concession.rightK`; tech gate on tax law and Requisition scopes; the alignment coefficients; standing Persuasion.
- **Decision Log schema text (kb and this spec's pointer)**: still the old entry schema in the kb; correct at the chapter split (see Decision Log above).
- **Tuning keys** (first-pass placeholders, authoritative in `tuning.defaults.json`): `eps.modifier` 0.0001, `eps.need` 0.01, `eps.prestige` 0.05, `fair.scale` 1.0, `opinion.k` 3, `opinion.perf` 2, `opinion.satNeutral` 0.7, `opinion.align` 1 (loss coefficient of the alignment term), **`opinion.alignGain` 0.5 (gain share of the alignment term, 2026-11-16)**, `opinion.modDecay` 0.1 (also the action record's memory), `compliance.controlPerCapita` 0.001, `attr.warSteepness` 4, `attr.lowAwareness` 0.2, `tier.existential` 0.5, `tier.structural` 0.2, `faction.fracture` −0.3, `faction.align` 0.6, `bloc.cost` 1 (unused), `mom.rise` 0.5, `mom.decay` 0.1, `rung.enter` [0.2, 0.5, 0.9, 1.4], `rung.exit` [0.1, 0.35, 0.7, 1.1], `stance.align` 0.5, `acc.w0` 0.1, `acc.crisis` 0.5, `acc.exposure` 0.3, `acc.burden` 0.2, `acc.alt` 0.2, `loss.decay.live` 0.05, `loss.decay.restored` 0.3, `loss.decay.inForce` 0.02, `prop.rate` 0.1, `pref.modRange` 2, `pref.modDecay` 0.1 (also the Portrait stack's decay), **`portrait.reinforce` 0.05 (Portrait step per Government act per axis, 2026-11-16)**, `edu.rate` 0.01, `req.opinionHit` 2, `default.opinionHit` 2, `default.fairnessHit` 0.3 (2026-11-15); **2026-11-19/22 (Administration spec lists them with their placeholders): `slate.addressedRise` 0, `debate.expiryGrievance` 0.05, `petition.grace` 1, `petition.refuseHit` 0.3, `petition.refuseDecay` 0.03, `petition.expiryMult` 3, `petition.comparable` 1, `persuade.costK` 1, `persuade.popUnit` 1000, `question.turns.{region,multi,empire}` 1/3/5; proposed 2026-11-24: `concession.rightK`, `decision.majority` (2/3)**; keys seen in code without a recorded placeholder: `aware.base`, `aware.k`, `acc.altScale`, `cell.minUtility`, `defy.risk`, `petition.effect`, `hoard.frac`, `infra.richPerCap`, `infra.costPerCap`, `infra.delta`, `mob.eligibleShare`, `mob.originGain`, `mob.destResent`, `demo.rate`, `demo.control`, `demo.opinion`, `demo.opinionDecay`, `demo.destResent`, `conv.eps`, `conv.force`, `prop.resist`, `cprop.frac`, `cprop.k`.
- **Sync:** (`<section> = <kb rev> / <code rev>`; `-` = no or insufficient code+tests; `1` = code and a test file present, names not re-verified; revs set on tests written but not yet run green are provisional)
  - Data Structures > Actor (base unit) = 1 / -
  - Data Structures > Government and Ledger (resource-holder, not a will — settled 2026-11-02) = 1 / -
  - Data Structures > Government values and Government-to-Government standing (settled 2026-11-03) = 1 / -
  - Data Structures > Estate Labor Profile (per (Nation, Estate, Region) cell) = 1 / -
  - Data Structures > Estate Convergence (structural, top-down; per (Nation, Region) cell pair — 2026-11-02) = 1 / 1
  - Data Structures > Scope syntax and Region-level Convergence/Mobility/Demotion (settled 2026-11-02; ladder 2026-11-09) = 1 / -
  - Data Structures > Existential vs. Secondary needs = 1 / 1
  - Data Structures > Fairness bucket (contribution vs. entitlement — settled 2026-11-01) = 1 / 1
  - Data Structures > Entitlement loss (decaying modifier on Fairness — settled shape) = 2 / 1
  - Data Structures > Government benefits (settled shape 2026-11-01) = 1 / -
  - Data Structures > Awareness and attributed discontent (settled shape 2026-11-01) = 1 / -
  - Data Structures > Decision Log (alpha causal-provenance mechanism — settled shape 2026-11-01) = 1 / -
  - Data Structures > Rights checklist (universal, per-cell configurable) = 1 / -
  - Data Structures > Estate Mobility (bottom-up, gradual, individual/family-scale) = 1 / 1
  - Data Structures > Duties checklist (universal, per-cell configurable) = 1 / -
  - Data Structures > Wealth flow (per Actor, per turn) = 1 / -
  - Data Structures > Prestige (derived, recomputed/turn) = 1 / 1
  - Data Structures > Duty compliance = 1 / 1
  - Data Structures > Skilled-labour Duty — make vs. buy = 1 / -
  - Data Structures > Requisition Duty (settled 2026-11-01) = 4 / 4
  - Data Structures > Credit default consequences (settled 2026-11-15) = 1 / 1
  - Data Structures > Subinfeudation = 1 / -
  - Data Structures > Grouping / Faction computation (Question-time only, never persisted) = 2 / 2
  - Data Structures > Faction escalation state (settled 2026-11-02) = 2 / 2
  - Data Structures > Compliance (per Actor cell, per need) = 3 / 3
  - Data Structures > Pressure and Question queue = 1 / -
  - Data Structures > Question handling — consultation and petition (2026-11-09, proposed: modifiers land on the Fairness bucket) = 3 / 2
  - Data Structures > Government Portrait (Country-level root trait bundle) = 3 / 3
  - Data Structures > Cell Preferences & Propaganda (settled shape 2026-11-01; mechanics partly proposed) = 3 / 3
  - Rules = 3 / -
