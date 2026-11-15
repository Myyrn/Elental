# Diplomacy — Specification

KB: `kb/diplomacy__kb.md`. Mirror of its `##/###` headings; cross-references live in kb only. Split out of `admin_war_diplomacy__spec.md` (§5–§7) on 2026-11-12. Besides kb, sources: `src/modules/diplomacy/{actions,common,covert,module,readouts,treaties}.js`, `tests/diplomacy.test.js`, `tests/espionage.test.js`. Where code and the old spec disagree, **code wins** (**code-led**). Anything the kb does not state is **(spec decision)**; both are listed under Status. Parts the code has not reached are **(target)**: the Negotiation Session, most of the Action Catalogue, tariffs, Improve Relations, Government-to-Government `opinion`.

## Data Structures

State (`makeDiplomacyState`, `common.js`):
```js
state.diplomacy = { treaties: Treaty[], cbs: CB[] /*event-based only*/, leverage: Record<pairKey, ModifierStack>, covert: CovertRecord[] /*last 80*/, grants: FacilitationGrant[],
                    proposals: Proposal[], recognition: Record<blocId|countryId, {recognizers: Id[]}>, claims: {holder, target, province}[], rejected?: {id, turn, reason}[] /*last 20*/, rekeyed?: Record<blocId, countryId> }
// Treaty = { id, kind: 'Sanction'|'Dependency'|'Alliance'|'Confederation'|'Cooperation', status: 'active'|'broken'|'ended'|'replaced', since, axes: AxisGrant[],
//            parties?, imposers? /*Sanction*/, target?, overlord?, subject?, tier? /*Alliance*/, against? /*Coalition*/, stripsCB?, backed?, breach? }
// Proposal = { id, from, to, kind, tier?, axes, cooperation?, guarantor?, overlord?, subject?, amend?, turn, status: 'pending'|'rejected', accepted? }
```
Pipeline (code-led): `step7 = resolveProposals → resolveCovert → decayStacks`; war-declaration effects run through the scheduler handler `diplomacy.warDeclared` (scheduled by `declareWar`, `war__spec.md`); peace ratification is War's handler `war.peaceResolve` (installs treaties through `services.diplomacy.installTreaty`, removes Occupation).

### Casus Belli (CB)
Code: `readouts.js` (`activeCBs`, `grantCB`, `bestCBRank`, `externallyRecognised`, `applyOverreach`, `goalsRank`, `closeness`), `common.js` (`TIERS`, `rank`)
```js
CB.tier ∈ Grievance < Rights < Sovereignty < Existential            // TIERS order in common.js; rank(tier) numeric
activeCBs(ctx, holder, target) = [                                   // derived on read, except event-based
  state-based  : occupied territory of holder held by target → {Sovereignty, 'occupied-territory'};  unremedied treaty breach by target → {breach.tier ?? Rights, 'unremedied-breach'}   // persist while the fact holds, no timer
  event-based  : state.diplomacy.cbs[].mods summed > T('eps.cb') → {tier, reason, id, recognised: externallyRecognised(cb)}
  structural   : claims (holder→target province still owned by target) → {Rights, 'claim'};  nationalism (holder's titular Nation presence ≥ T('cb.nationalism.share') in a target province) → {Rights, 'nationalism'};
                 militaristic ≥ T('cb.militaristic.wars') wars started by holder (non-internal, non-chained) → {Rights, 'militaristic-disposition'} (against ANY target) ]
grantCB(ctx, holder, target, tier, reason, magnitude) pushes a mod {value, decay: {kind:'exp', rateKey:`cb.decay.${tier}`}}   // persistence scales with tier via the decay key
externallyRecognised(ctx, cb) = !exists active Sanction with target === cb.holder && stripsCB          // independent of tier; the target's own recognition is untouched
```
- **Overreach** (per observer, never global): `gap = max(0, goalsRank(war.goals) − bestCBRank(war.a, war.b))`; `mag = T('overreach.k') × gap`; for each observer `o ≠ war.a`: `h = mag × closeness(o, war.b)` → `addReputation(o, war.a, −h, 'overreach')`. `GOAL_TIER = {tribute: Grievance, cede: Rights, dependency: Sovereignty, annex: Sovereignty}`. `closeness = clamp01(max(treatyTier factor `closeness.<tier>`, Dependency `closeness.Dependency`, kin `closeness.kin`) + min(1, tradeDependency/T('overreach.tradeNorm')))`. Applied in `warDeclared` and stored as `war.overreach`.
- Existential CBs are event-based (granted through `grantCB`); the derivation from the Great-War chain is not automatic **(code-led)**.
- Sources of event-based CBs in code: ad hoc Sanction (Grievance, `cb.mag.sanction`), detected covert influence (Rights/Grievance, `cb.mag.covert`), exposed false flag (Rights), `denounce` (Rights/Sovereignty `cb.mag.break`), recognising rebels (Sovereignty `cb.mag.recognize`).
- **Not in code**: Oppression-of-a-Nation CB (tier by kin/titular link), kin-state appeal, tariff-asymmetry and blocked-edge CBs, annexation as a forced-annexation act, the militaristic disposition from the Portrait (code counts started wars), Decision Log input.

### Reputational Leverage
Code: `readouts.js` (`addReputation`, `reputation`, `decayStacks`, `allianceBonus`)
```js
state.diplomacy.leverage[pairKey(observer, subject)] = {baseline: 0, mods: [{id, value, decay:{kind:'exp', rateKey:'leverage.decay'}, turn, reason}]}   // directional; observer's belief about subject
addReputation(ctx, observer, subject, delta, reason)       // no-op for observer === subject or delta 0
reputation(ctx, o, s) = stackValue(stack) + allianceBonus(o, s)       // allianceBonus = T('rep.allianceBonus') while treatyTier(o,s) is any alliance-like tier; derived from the treaty graph, never stored
decayStacks: tick every stack (kernel modifiers), delete empty ones, tick and prune cbs below T('eps.cb')
```
- Feeds in code: overreach (−), sanction (`rep.sanction`), covert detection (`rep.covert`), false-flag exposure (`rep.falseFlag`), treaty break (`rep.break`, scaled by closeness `rep.breakClose`), recognising rebels (`rep.recognize`), secession recognition (`recog.standing`). **Not in code**: promise fulfilled, Veto/treaty compliance, rejecting a coalition-backed demand, negotiation withdrawal mark.
- Never spendable; separate from the Portrait's Ruthlessness axis (`axisLoads` on actions feed the Portrait in polity).

### Great-power backing (derived — replaces "Concert", 2026-11-03)
Code: `readouts.js` (`power`, `greatPowerBacked`, `armyMen`)
```js
power(c) = T('gp.milWeight') × armyMen(c)/Σ armyMen + (1 − T('gp.milWeight')) × population(c)/Σ population        // (code-led) stand-in for "ranked by the Military and Economic readouts"
greatPowerBacked(imposers) = Σ power(imposers) / Σ power(all Countries) ≥ T('gp.share')                            // derived predicate; no body, no vote
```
- Applied to `imposeSanction` (`treaty.backed`; an ad hoc one grants the target a Grievance CB, a backed one does not). "Great-War chain" = `warChain` below, treaty-graph propagation only. Coalition backing as an Existential CB: not in code.

### Government-to-Government standing (settled 2026-11-03)
Code: none (target)
```js
RelationState.opinion(A, B) = amalgamStanding(A, B) + alignment(amalgam(A), observedPortrait(B)) + Σ improveRelations modifiers        // polity derives the Foreign Standing aggregate; not a stored stock
```
- `ctx.derive.countries.opinion` does not exist; the AI reads `ruleset.aiDiplomacy.initialOpinion` instead (`ai_diplomacy__spec.md`). Improve Relations (target): `opinionMods[pairKey]` ModifierStack, refresh to full on repeat (never stacks).

### Leverage (general)
Code: none
- No scalar and no module code: instrument selection is AI — Diplomacy. Nothing to implement here.

### Leverage Categories (readouts settled 2026-11-02; weights by AI-Diplomacy from the Portrait, settled 2026-11-03)
Code: `readouts.js` (`leverage`, `tradeDependency`), derive export `leverage` in `module.js`
```js
leverage(ctx, a, bOrBloc /* Country id or array of Country ids */) = {                                // derived each call, never stored, never summed
  economic:   Σ tradeDependency(a, b)            // capacity of trade edges crossing the two Countries (zoneEdges/throughputCap)
  diplomatic: Σ reputation(b, a)                 // the Reputational stack of the other side toward a
  military:   armyMen(a) − Σ armyMen(b) − T('leverage.exhaustion') × countryExhaustion(a)       // (code-led) Show of Force is NOT yet in this sum
  cultural:   Weight-weighted mean over the target's cells of (1 − mean |effectivePref(cell, axis) − amalgam(a)[axis]| / 2) }    // output side (confirmed 2026-11-04)
```
- Show of Force feed (`war__spec.md`): add `+ Σ stack value of state.war.showOfForce['a|b']` to `military` (target).
- Existential-threat override trigger = core province occupied or an Existential CB held against the Country (settled kb); weighting itself is `ai_diplomacy__spec.md` (`edge`, `posture.js`).

### Negotiation Session (2026-11-10)
Code: none (target)
```js
state.diplomacy.negotiations: Record<id, {a, b, terms: {a: Proposal[], b: Proposal[]}, state: 'open'|'concluded'|'withdrawn', walkout: {a, b}}>      // no `turns`, no deadline
satisfaction(side, n) = stance(side, n.terms, ctx, fns)    // same stance-times-modifier shape; in a war = War's peaceEvaluation(side) (war__spec.md Peace Conference)
step7: for each open session and side: if satisfaction < walkout(side) → that side withdraws
withdraw(n, by): n.state = 'withdrawn' (a later session starts from scratch); if by is the STRONGER party (leverage comparison at negotiation time, bilateral or bloc-pair) →
                 addReputation(otherParty, by, −T('neg.withdrawMark'), 'withdrawal')    // (proposed) negative, on the stronger Country's own stack, decays; weaker withdrawing leaves none
meter(viewer, n) = {otherSatisfaction, otherWalkout, stamp: 'live' (alpha) | 'estimated' (post-alpha fog)}
```
- Today: `proposeTreaty` / `answerProposal` with a pending list and `treaty.proposalTTL` stand in for a session; no withdrawal, no satisfaction meter. **(spec decision)** the session wraps `proposeTreaty` proposals of one pair; alliance negotiation: a higher chain link covers and disables the lower ones (`covers(tier)` in `ALLIANCE_TIERS` order BenevolentNeutrality → Defensive → StandingOffensive; Coalition and Guarantee independent).
- The Peace Conference (`war__spec.md`) reuses this session (proposed reading in kb).

### Axis Bundle (shared substrate — Sanctions/Dependency/Alliance)
Code: `readouts.js` (`axisGrants`, `grantsOver`), `treaties.js` (axis hooks), `ruleset.axes`
```js
AxisGrant = {axis, terms, scope?}
axisGrants(ctx) → [{grantor, grantee, axis, terms, scope, treaty}]    // Dependency: subject→overlord; Sanction: target→each imposer; Confederation/Alliance axes symmetric over parties
grantsOver(ctx, grantor, axis) = axisGrants(ctx).filter(g => g.grantor === grantor && g.axis === axis)
```
| Axis | Engine hook (code) |
|---|---|
| CultureLanguageSovereignty | `titularForced(country)` = grantees that force titular status; read by Countries |
| MilitaryCap | `militaryCap(country)` = min `terms.maxMen`; `war.fieldUnits` validate rejects above it (tested); breach CB for neighbours: not in code |
| ForeignPolicy | `ratify`: the party cannot ratify without the grantee's consent unless `reputation(grantee, party) ≥ veto.repMin` (tested) |
| TradeAccess | `tradeFactor(za, zb, good)` = 0 for `terms.embargo` against the named third Country (every good) |
| ResourceExportBan | `tradeFactor` = 0 for `terms.good` between grantor and grantee; Economics reads `derive.diplomacy.tradeFactor` |
| Fortification | no consumer yet |
| LaborMigrationBan | `laborMigrationBanned(a, b)` derive; no Economics/World Map consumer yet |
| DomainVeto | `foreignVetoes(ctx, a, domain)` returns grantee Countries whose `reputation(grantee, country) < veto.repMin`; `engine.gate()` refuses unconditionally and Control cannot force it (tested) |
| Succession / Common Ruler | post-alpha; `axisOk` rejects axes marked `postAlpha` |
- `ruleset.axes[axis] = {postAlpha?, …}` is the menu; `axisOk` validates `proposeTreaty`/`imposeSanction`.
- **(code-led)** foreign vetoes are exercised by reputation (a grantee with no grudge lets the act through), not by a full stance computation; `actions__spec.md` Gating records the same.

### Sanction / Dependency / Alliance
Code: `actions.js` (`proposeTreaty`, `answerProposal`, `imposeSanction`, `denounceTreaty`, `ratifyTreaty` pseudo-type), `treaties.js` (`ratify`, `treatyValue`, `resolveProposals`, `installTreaty`, `denounce`, `warChain`, `joinWars`, `warDeclared`), `common.js` (`KINDS`, `ALLIANCE_TIERS`, `NON_AGGRESSION`)
- `proposeTreaty {to, kind: Dependency|Alliance|Confederation|Cooperation, tier?, axes?, cooperation?, guarantor?, overlord?, amend?}` (event, gate `treaty`, public): rejects Sanction kind, unknown party, a rebel bloc for anything but a Guarantee, unknown tier/axis, an identical pending proposal. `imposeSanction {target, axes, stripsCB?}` (event, gate `treaty`): merges imposers into an existing Sanction with the same axes; `backed = greatPowerBacked(imposers)`; ad hoc → Grievance CB for the target; `addReputation(target, imposer, −rep.sanction)`.
- **Ratification** (`ratify`, step 7): (1) ForeignPolicy grants over each Country party; (2) a rebel-bloc recipient accepts; (3) an AI recipient decides at once by `approves(stance(to, p, ctx, treatyStanceFns))` with `selfInterest = treatyValue(party, p)` and `modifier = 1 + T('treaty.rep') × reputation(party, other)`; a player recipient waits for `answerProposal` until `treaty.proposalTTL`; (4) `polity.gateHolders(…,'treaty')` cells must each approve via `ratifyTreaty.impact` (cost/relief from `treaty.cell*` keys); the Government's own acceptance is not required to exceed the Veto holders'. Rejected proposals append to `diplomacy.rejected`.
- `treatyValue`: Alliance Guarantee (guarantor `−treaty.guaranteeBurden`, guaranteed `+treaty.guaranteeBenefit`), BenevolentNeutrality `treaty.bn`, Defensive/StandingOffensive/Coalition `treaty.pact − treaty.pactBurden − treaty.axisBurden × n`, Dependency (overlord `treaty.axisGain × n`, subject `treaty.depBenefit − treaty.axisBurden × n`), Confederation `treaty.conf − treaty.axisBurden × n × treaty.confAxisShare`, Cooperation `treaty.coop × max(1, #axes)`; plus `treaty.enemy` when parties share an enemy.
- `warChain(war)`: attackers/defenders closure over `Alliance` treaties: Guarantee → guarantor defends the guaranteed (no reciprocal); Defensive → defenders always, the attacker's allies only if an externally recognised CB exists (none = no cause); StandingOffensive → ally joins; Coalition → joins only `against` the named enemy. `joinWars` creates chained wars `{chained, chainedFrom}`, hostilities from next turn's step 4, skipped for non-aggression pairs (`NON_AGGRESSION`, Confederation). `warForbidden(a, b)` rejects `declareWar` between partners (tested).
- `denounce`: status `broken` (a Sanction lifts: `ended`, no breach); `breach = {by, tier: Dependency ? Sovereignty : Rights}`; wronged parties get an event-based CB `broken-treaty` (`cb.mag.break`) and every observer `−rep.break` (closeness-scaled by `rep.breakClose`).
- Tier table per kb (Guarantee, BenevolentNeutrality, Defensive, Coalition, StandingOffensive, Confederation) is encoded by `ALLIANCE_TIERS` and `treatyTier` (strongest alliance-like tier binding two parties). Confederation: symmetric axes over `parties`, no overlord; changes need mutual consent via `amend`; Dependency's titular status survives unless CultureLanguageSovereignty is bundled.
- Recognition route (rebel blocs): `recognizeBloc {bloc}` (event, gate `treaty`; only when the bloc's goal is independence or the Government refused its terms; the parent cannot recognise) → `recognize`: adds a recognizer, grants the parent a Sovereignty CB `recognized-rebels` against the recognizer and `−rep.recognize`; `joinGuaranteedWars` pulls a guarantor into the bloc's internal war; `onBlocEnded` ends chained wars and treaties naming the bloc; `onFormation` re-keys treaties, recognition and grants to the new Country (all tested).

### Cooperation / Facilitation Grant
Code: `actions.js` (`grantFacilitation`, Cooperation via `proposeTreaty`)
```js
grantFacilitation {to, from /*grantor province*/, good, qty, dest?}   // event, public→(code) covert default; validates the stock and ownership; real zero-sum transfer warehouse→warehouse
  push {id, grantor, to, good, qty, turn, dest} to state.diplomacy.grants          // `to` may be a Country or a rebel bloc (dest = a province it holds)
Cooperation(A,B) = a Treaty {kind:'Cooperation', cooperation: ['Trade'|'Scientific'|'LegalJustice'…]}; exists with no political alliance
```
- **(code-led)** `grantFacilitation` is `defaultVisibility: 'covert'`; the kb catalogue lists "Gift / Facilitation Grant" under Cooperation without a visibility. Terms beyond a good transfer ("scoped micro-Right") are not modelled.

### Diplomacy/Espionage Action Threshold (settled 2026-11-02)
Code: `covert.js` (`targetScale`, `opThreshold`, `espionageTotal/Committed/Free`, `resolveCovert`), `kernel/threshold.js`
```js
targetScale(ctx, region) = population(region) / T('espionage.popUnit')          // each Region-targeted type declares its own; never the opponent's size
opThreshold(ctx, p) = threshold(TYPE[p.kind], tier, {region}, ctx) + (p.falseFlag ? T('thresholds.falseFlag') × targetScale : 0)      // tier: propaganda overt|covert, influence 'influence'
  = T(`thresholds.${type.id}.${tier}`) × targetScale
applyThreshold(committed, need) → {met} binary; below threshold: nothing happens and the labour STAYS committed for the turn (no refund)
```
- Espionage pool: `espionageTotal` = Σ over the Country's cells of `labour.Espionage − labourCommitted.Espionage`; `espionageFree = total − Σ (covert + counterIntel commitments)`; operations resolve in id order against the sender's free labour (`left[sender]`); an op without free labour is logged `met: false, reason: 'no free Espionage labour'`.
- Rule: each new Diplomacy/Espionage action type must declare `targetScale` (Rule 20); `registry.register` throws for `thresholdBound` types without it (`actions__spec.md`).
- Placeholder keys: `thresholds.foreignPropaganda.overt` 4, `.covert` 8, `thresholds.espionage.influence` 6, `thresholds.falseFlag` (placeholder), `espionage.popUnit`.

### Action Catalogue (2026-11-10)
Code: `actions.js`, `covert.js`; most catalogue actions have no ActionType yet
| Catalogue action | Status | Type id / mapping |
|---|---|---|
| Trade Agreement, Tariff Exemption, Impose Tariff | target | new types writing `TradeAccess` terms / Economics tariff rates; `tariff_asymmetry` readout (below) |
| **Embargo** | partial | `imposeSanction` with `TradeAccess {embargo: <Country>}` or `ResourceExportBan {good}`; **strength, Region scope and goods list are not modelled** (binary, whole-Country) |
| Migration Treaty / Migration Ban | target | `LaborMigrationBan` axis exists; no consumer |
| Military Access | target | needs Supply source extension (`war__spec.md`) |
| Demand Disarmament | target | `MilitaryCap` axis via Dependency/Confederation (no standalone demand) |
| Ban Fortification | target | `Fortification` axis, no consumer |
| Alliance actions (BN, Defensive, StandingOffensive, Coalition, Guarantee) | in code | `proposeTreaty {kind:'Alliance', tier}`; the chain-cover rule is spec decision (Negotiation Session) |
| Impose Cultural Autonomy, Take Over Foreign Policy, Demand a Say in Domestic Law, Establish Dependency | partial | `proposeTreaty {kind:'Dependency', axes}` (consent by the proposal, not a demand with accept/reject/pushed-into consequences) |
| Confederation | in code | `proposeTreaty {kind:'Confederation'}` |
| Scientific / Legal Exchange, Gift / Facilitation Grant | in code | `proposeTreaty {kind:'Cooperation'}`, `grantFacilitation` |
| Propaganda (overt), Covert Influence | in code | `foreignPropaganda`, `covertInfluence` (+ `counterIntelligence`, `liftCovert`) |
| Improve Relations | target | `improveRelations {target}`: Espionage-threshold-style fixed cost; pushes a decaying mod into `opinionMods[pair]`, refresh to full on repeat |
| Declare War / Propose Peace | War's | `war__spec.md` |
- **Kinds (proposed)**: agreement / unilateral act / demand; encoded as `ActionType.diplomacyKind` (spec decision) with `demand` resolving through `ratify`-like accept / reject (`rep` and CB consequences) / pushed-by-Leverage; none of this is in code.
- **Direction rule**: positive 0–100, hostile −100–0 (named tiers allowed), optional `duration`; each action declares `targetScale`, default visibility and a `narrative` key (text still to be written).
- **Tariff asymmetry (proposed)**: `tariffAsymmetry(A, B) = Σ_good dep(good) × (tariff_{B→A}(good) − tariff_{A→B}(good)) / Σ dep`; while it exceeds `tariff.asym.min` the disadvantaged side holds a state-based Grievance CB (`reason: 'tariff-asymmetry'`, added to `activeCBs`) and an opinion modifier; `derive.economics.tariffAsymmetry` does not exist yet (AI reads 0). Embargo is the escalation.

### Covert Faction Influence & Foreign Propaganda (settled shape 2026-11-01)
Code: `covert.js` (`writeIntoCells`, `detect`, `consequences`, `resolveCovert`, `registerCovertActions`)
```js
covert commitment (class 'commitment', renew each turn): {type:'covert', params:{target, region, kind:'propaganda'|'influence', tier, concealment, falseFlag?, labour, opinion?, grievanceNeed?, ideal?}}
resolveCovert (step 7, id order): rec = {id, commitment, sender, apparentSender: falseFlag ?? sender, target, region, kind, tier, concealment: overt ? 'overt' : (concealment ?? 'low'), falseFlag, turn}
  labour > free → log met:false; else claim labour; need = opThreshold; below → met:false; else writeIntoCells → detect → consequences → log {met, need, detection, revealed, falseFlagExposed}
writeIntoCells: propaganda → pushPreference(cell, ideal (overt: amalgam(sender); covert: params.ideal), T('fprop.magnitude'));
                influence  → cell.opinionGovMods.push({value: clamp(opinion)×T('infl.opinion'), decay opinion.modDecay}) (target-agnostic) and grievance[need] += T('infl.grievance')
detect(ctx, op): concealment 'overt' → open; d = observationAt(target, region) + counterIntel(target, region); s = targetScale;
  d < conceal.act.<tier>×s → undetected;  d < conceal.sender.<tier>×s → actDetected (names nobody);
  falseFlag && d < conceal.falseFlag×s → senderRevealed(apparentSender);  else senderRevealed(sender, falseFlagExposed)
consequences (senderRevealed, not open): CB against the revealed sender (influence → Rights, propaganda → Grievance, `cb.mag.covert`) and `−rep.covert`; if falseFlagExposed also a Rights CB 'false-flag-exposed' and `−rep.falseFlag` against the TRUE sender
```
- Actions: `foreignPropaganda`, `covertInfluence`, `counterIntelligence` (own-Region guard, same Espionage pool, zero-sum), `liftCovert`; validation: target Region must belong to the target Country, a false flag must name another Country and a covert tier, labour ≤ free Espionage. `setObservationAllocation` is registered here (`administration__spec.md`).
- Visibility: `foreignPropaganda` public, the others covert (code default); detection is per defender (`target`), not per observer **(code-led)**: a third observer is not modelled.
- **Self-targeted false flag is post-alpha feature** (`validate` rejects `target === actor`, `detect`/`consequences` would use the AI's own Observation): needs a Diplomacy rule for who detects a self-flag (`ai_diplomacy__spec.md` Status).
- Exposure leaves the implicated party unconstrained (kb): no limit on friends.

## Rules
Code: per-rule notes
1. A CB tier never grants a war goal by itself; `declareWar` takes goals and overreach is the only consequence (`applyOverreach`).
2. Overreach = `max(0, goalsRank − bestCBRank)` (tested: proportionate goal → no hit).
3. `externallyRecognised` independent of tier; `stripsCB` Sanction removes only external recognition (tested).
4. One axis menu (`ruleset.axes`, `axisGrants`) for Sanction/Dependency/Alliance/Confederation.
5. `addReputation` stack is separate from polity's Portrait axes (`axisLoads`).
6. Coalition-demand rejection mark: not in code.
7. `applyThreshold`: binary, no extra effect above threshold (tested).
8. `warChain`: a Defensive ally of the attacker joins only with an externally recognised CB (tested).
9. `leverage` returns four readouts, no sum (tested shape).
10. Military readout stacks with exhaustion (`leverage.exhaustion`); Show of Force term to add.
11. Foreign propaganda is Espionage-threshold per Region (in code).
12. Detected covert influence gives a Grievance/Rights CB to the victim (tested).
13. Cultural readout from preference alignment (output side).
14. `detectionStrength = observationAt + counterIntel`; separate act/sender/false-flag thresholds (tested).
15. CB classes: state/event/structural in `activeCBs`; Grievance decays fastest (tested).
16. Per-observer overreach (tested: victim > close ally, distant observer none).
17. Thresholds scale with the target Region's population only (tested).
18. DomainVeto in the axis menu; Confederation symmetric, no teeth (tested hooks).
19. No stored aggregate of Leverage (tested: state keys).
20. `targetScale` required for threshold-bound types.
21–23. Negotiation Session: not in code.
24. Direction rule: not enforced (no catalogue types yet).
25. Embargo/Tariffs: partial (see Action Catalogue).
26. Alliance chain cover/disable: not in code; Coalition (with `against`) and Guarantee already independent in `warChain`.
27. Improve Relations: not in code.
28. Show of Force: War derives it; this module only reads it.

## Status
- **Implemented and tested** (`tests/diplomacy.test.js`, `tests/espionage.test.js`): Reputational Leverage and alliance bonus readout, CB classes and decay, ad hoc vs backed Sanctions and `stripsCB`, per-observer overreach, ratification with Veto holders and ForeignPolicy, treaty proposals (AI at once, player answers, identical pending rejected), war chain, denounce, axis hooks (MilitaryCap, TradeAccess/ResourceExportBan, DomainVeto, ForeignPolicy), recognition route with Guarantee and Formation, Facilitation Grant, Espionage thresholds, overt/covert propaganda, covert influence, detection tiers, false flag, counter-intelligence, Observation dial, determinism.
- **Not in code**: Negotiation Session, Improve Relations, tariffs and `tariff_asymmetry`, Embargo strength/scope/goods, Migration/Military Access/Disarmament/Fortification demands and the demand kind, Oppression-of-a-Nation CB and kin-state appeal, Government-to-Government `opinion`, coalition-backing Existential CB, withdrawal mark, Show of Force term in Military Leverage, Portrait-derived militaristic disposition, per-observer detection, Fortification and LaborMigrationBan consumers.
- **(code-led)**: `step7` order and the scheduler/War handlers; `power` stand-in for great-power ranking; foreign vetoes by reputation threshold; `militaristic-disposition` from war count; `ratify` flow (ForeignPolicy → AI stance → Veto holders); `grantFacilitation` covert by default; `espionage` TYPE ids; detection per defender; Existential CBs only via `grantCB`.
- **(spec decision)**: opinion mod storage `opinionMods`; Negotiation Session wrapper; `diplomacyKind`; `tariffAsymmetry` formula and `tariff.asym.min`; `neg.withdrawMark`; catalogue mapping table; tuning keys (placeholders): `leverage.decay`, `leverage.exhaustion`, `eps.cb`, `cb.decay.*`, `cb.mag.*`, `rep.*`, `gp.share`, `gp.milWeight`, `cb.nationalism.share`, `cb.militaristic.wars`, `closeness.*`, `overreach.k`, `overreach.tradeNorm`, `treaty.*`, `veto.repMin`, `recog.standing`, `espionage.popUnit`, `thresholds.*`, `conceal.*`, `fprop.magnitude`, `infl.*`, `opinion.modDecay`.
- **Open (kb)**: overreach curve; Improve Relations target-scale; hostile counterpart (Denounce/Insult); satisfaction function and walk-out values; mark sign/holder (proposed); every threshold and parameter (numbers pass); `narrative` texts.
- **Sync:** (`<section> = <kb rev> / <code rev>`; `-` = no or insufficient code+tests)
  - Data Structures > Casus Belli (CB) = 1 / 1
  - Data Structures > Reputational Leverage = 1 / 1
  - Data Structures > Great-power backing (derived — replaces "Concert", 2026-11-03) = 1 / 1
  - Data Structures > Government-to-Government standing (settled 2026-11-03) = 1 / -
  - Data Structures > Leverage (general) = 1 / -
  - Data Structures > Leverage Categories (readouts settled 2026-11-02; weights by AI-Diplomacy from the Portrait, settled 2026-11-03) = 1 / 1
  - Data Structures > Negotiation Session (2026-11-10) = 1 / -
  - Data Structures > Axis Bundle (shared substrate — Sanctions/Dependency/Alliance) = 1 / 1
  - Data Structures > Sanction / Dependency / Alliance = 1 / 1
  - Data Structures > Cooperation / Facilitation Grant = 1 / 1
  - Data Structures > Diplomacy/Espionage Action Threshold (settled 2026-11-02) = 1 / 1
  - Data Structures > Action Catalogue (2026-11-10) = 1 / -
  - Data Structures > Covert Faction Influence & Foreign Propaganda (settled shape 2026-11-01) = 1 / 1
  - Rules = 1 / -
