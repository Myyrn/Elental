# AI — Diplomacy — Specification

KB: `kb/ai_diplomacy__kb.md`. Mirror of its `##/###` headings; cross-references live in kb only. Besides kb, sources: `src/modules/diplomacy/{module,readouts,covert,actions}.js`, `src/modules/war/actions.js`, `src/engine/engine.js`, `src/client/engineClient.js`. Anything decided here that kb does not say is tagged **(spec decision)** and listed under Status (confirmed by the designer on 2026-11-12).

## Data Structures

### Principles
Code: `src/modules/ai/index.js`, `src/modules/ai/actions.js`, `src/modules/ai/diplomacy/reads.js`
```
src/modules/ai/index.js                aiOrders(ctx): simpleWar + simpleDiplomacy always; AI-Diplomacy + AI-War only when ruleset.aiDiplomacy.enabled === true
src/modules/ai/diplomacyAgent.js       planDiplomacy(ctx, a, rd?, cache?) -> {orders, cache, posture, campaigns}; diplomacyOrders(ctx, rd?) -> orders[]
src/modules/ai/actions.js              pseudo-action `aiMemo` + writeCache(ctx, country, cache)
src/modules/ai/diplomacy/tuning.js     DEFAULTS for every ai.dip.* key + T(ctx, key)
src/modules/ai/diplomacy/config.js     DEFAULT_CONFIG (postureGate, campaignFocus, effects, postureFactor), config(ctx)
src/modules/ai/diplomacy/reads.js      the ONLY file touching ctx.state / ctx.derive / other modules
src/modules/ai/diplomacy/posture.js    shared snapshot, weights, edge, affinity, balance of power, derivePosture
src/modules/ai/diplomacy/campaign.js   typeValue, updateCampaigns (margin, bypass)
src/modules/ai/diplomacy/candidates.js generate(): per-campaign candidate actions, validated against the real ActionRegistry
src/modules/ai/diplomacy/score.js      labourBudget, score, select (binary thresholds)
src/modules/ai/diplomacy/negotiate.js  respond() to pending proposals
tests/ai_diplomacy.test.js
```
- Same surface as the player: orders go through the registered ActionRegistry; `validate(order)` runs the ActionType's own `validate` and candidates failing it are never emitted. No private state, no hidden numbers.
- Pure functions: no `Date`, no `Math.random`, no `ctx.rng` (ties break by sorted id), no writes to `ctx.state`. The agent takes an injectable reads adapter `rd`, so it is testable without a world. Deterministic, no LLM.
- `enabled` defaults to **false** (opt-in until the designer turns it on).
- The module path in kb (`src/modules/ai_diplomacy.js`) is superseded by the layout above **(spec decision)**.

**Reads adapter** (`reads.js`; every function takes `ctx` first, `ctx.derive.*` is already bound):
`countries, isPlayer, turn, opinion, leverage(a,b), reputation(a,b), cbs(holder,target), bestCBRank, warForbidden, treatyTier, tradeDep, power, treaties(c), tariffAsym, portrait(c), atWar, regions(c), regionPop, targetScale, opThreshold(p), detection(defender, region), espionageFree(c), conceal(which, level), hasCommitment, inboundProposals(c), registered(type), validate(order)`.
- `opinion`: `derive.countries.opinion` does not exist; falls back to `ruleset.aiDiplomacy.initialOpinion['A>B']` (−100..100), else 0. **(spec decision)** This is the seed the kb asks for.
- `tariffAsym`: `derive.economics.tariffAsymmetry` does not exist yet; reads 0.

**Ruleset data** `ruleset.aiDiplomacy` (all optional; `config.js` holds defaults): `{ enabled, initialOpinion, postureGate, campaignFocus, effects, postureFactor }`.

**Tuning**: all `ai.dip.*` keys live in `tuning.js` DEFAULTS (placeholders) and may be overridden by `tuning.defaults.json` entries (moving them there is a follow-up). Keys: `w.ruth, posture.w.{opinion,rep,shared,tariff,cb}, posture.{tAlly,tPartner,tDominate,band}, bop.{margin,growth,gain}, switchMargin, maxCampaigns, minValue, focus, strike.edge, budget.{reserve,proposals}, cost.{labour,exposure,harmAlly}, selfFlag.harm, neg.{accept,walk}`.

### Posture(A → B) (derived)
Code: `src/modules/ai/diplomacy/posture.js`
- `affinity = w.opinion·opinion/100 + w.rep·tanh(reputation) + w.shared·sharedThreat − w.tariff·tanh(tariffAsym) − w.cb·[b holds a CB against a]`.
- `edge(a,b) = Σ W_k · clamp((lev(a,b)_k − lev(b,a)_k) / (2·scale_k)) / Σ W_k`, `scale_k` = largest |readout| of that category over all ordered pairs. **(spec decision)** scale-free normaliser; the old per-pair ratio saturates for antisymmetric categories. An Existential CB held by b against a drops every weight except Military.
- Balance of power: `power(c)` = Diplomacy's normalised power readout **(spec decision)**, replacing the W-weighted leverage sum. `threatOn(x,b) = max(0, share(b) − share(x) − bop.margin)`; `bopPenalty = bop.gain · threatOn(a,b)`; `sharedThreat(a,c) = clamp01(bop.gain · max_b min(threatOn(a,b), threatOn(c,b)))`.
- Posture: Ally if `affinity ≥ tAlly`, Partner if `≥ tPartner`, else Dominate if `edge − bopPenalty ≥ tDominate`, else Wary. The cached current posture's lower boundary is lowered by `posture.band` (hysteresis). One function; no player branch (the player is read as an ordinary B).
- Cache: `state.ai.diplomacy.posture = { 'A|B': { value, since, powerShare } }`. Re-derivable; if missing, derived without the band.
- `postureGate` (which campaign types a posture allows; list order breaks ties): Ally/Partner → Court, Support, Secure · Wary → Secure, Squeeze, Court · Dominate → Strike, Squeeze, Provoke, Secure **(spec decision: Dominate order)**.

### Campaign (stored, cached intent)
Code: `src/modules/ai/diplomacy/campaign.js`, `src/modules/ai/actions.js`
```js
state.ai.diplomacy.campaigns = { A: [ { id, target, type, since, snap: { cbs, allies, power } } ] }   // kb: since_turn
type ∈ Court | Secure | Squeeze | Provoke | Strike | Support
```
- Values in 0..1 from readouts only: Court = affinity; Support = 1 if an Ally/Partner target is under pressure (at war or a CB held against it) else affinity; Secure = trade dependency / largest (**placeholder** for the open Contested Asset formula); Squeeze = netEdge + share of the target's trade held by our Ally/Partner postures; Provoke = (no usable CB) · netEdge; Strike = netEdge if a usable CB is held (recognised, no treaty forbids, not at war) and `netEdge > strike.edge`, else 0.
- Targets ranked by best allowed value (> `minValue`), at most `maxCampaigns`; one campaign per target (kb allows several types per target: **spec decision**, simpler).
- The current campaign is kept while `its value + switchMargin ≥ best`. Margin = 0 (bypass) when an Existential CB is held against us, a new CB of ours appeared since `snap`, the target lost allies, or its power share rose by more than `bop.growth`. A posture change that removes the type from the gate forces a switch. Switching costs no order and no labour.
- Focus bonus table `campaignFocus` (roles/tags): Court treatyBN treatyDef propaganda:overt · Support treatyDef treatyOff guarantee coalition · Secure treatyBN treatyDef influence · Squeeze treatyBN:neighbours treatyDef:neighbours propaganda:covert influence · Provoke frame selfFlag influence · Strike declareWar coalition:request.
- **Persistence (spec decision):** `aiOrders` runs on a cloned ctx, so the agent cannot write state. It emits one pseudo-action per AI Country, `aiMemo {country, cache}` (class event, covert, no cost, no gate), whose `apply` calls `writeCache`. No engine change; the Decision Log records the entry with no affected cells. If the cache is missing the agent starts empty (campaigns re-chosen from values; the kb's Decision-Log re-derivation is not implemented).

### Leverage weights (decision-time)
Code: `src/modules/ai/diplomacy/posture.js`
- `W`: Economic/Diplomatic/Cultural = 1; Military = `1 + ai.dip.w.ruth × ruthlessness_restraint` (Portrait amalgam, −1..1), floor 0.1. Decision-time only, never stored.
- Existential-threat override: see Posture (`edge`).

### Contested Asset (derived readout)
Code: none (placeholder in `campaign.js`, Secure value)
- Not implemented. Secure currently uses trade dependency / largest as a stand-in. Formula is open in kb (numbers pass). Rivals are any Countries, the player included.

### Action Score
Code: `src/modules/ai/diplomacy/score.js`
- Score `= magnitude · Σ W_k·effects[role]_k + focus bonus − labour price − risk − harm`; greedy by score per labour; one treaty/war/covert op per target-region.
- Pools: `espionage` (free Espionage minus `budget.reserve`), `proposals` (`budget.proposals` per turn; treaties cost no labour in code), `war` (1). Binary thresholds: labour = `opThreshold` exactly, no partial funding; skipped when an identical commitment already stands (`hasCommitment`).
- Covert risk = priced exposure from exact detection (alpha reads exact data): 0 undetected, 30% of `cost.exposure` act-detected, full when the sender would be revealed.
- Decision Log as scoring evidence (kb): not implemented; only `hasCommitment` is read.

## Rules
Code: `src/modules/ai/diplomacy/{candidates,score,negotiate}.js`, `src/modules/ai/diplomacyAgent.js`

Turn procedure (per non-player Country; the player is read as an ordinary B): `shared snapshot → posture toward every other Country → updateCampaigns → labour budget → candidates (validated) → score → greedy binary selection`, plus `respond()` to inbound proposals. Order ids: `ai.<country>.<role>.<target>[.<region>].<turn>`.

1. **Symmetry.** One `derivePosture`; `isPlayer` is used only to exclude the player from being an acting AI.
2. **Parallel portfolio.** Every turn all candidates for all campaigns are generated, scored, and chosen greedily within the pools; campaigns do not gate each other.
3. **Strengthen first.** The agent emits no economy or force-building orders; in alpha this is the scenario defaults plus the Secure campaign's treaty step (`treatyBN`, `treatyDef`, `influence`).
4. **Provocation toward a CB.** Implemented: *(b) frame* = `covertInfluence` with `falseFlag: b` against the smallest region of a third Country, offered only inside the window `conceal.sender.low·scale ≤ detection < conceal.falseFlag·scale` (the victim must notice the act and still attribute it to b), harm term for Ally/Partner victims; *(d)* standing CBs enter through the Strike value. **Post-alpha (decided 2026-11-13)**: *(c) selfFlag* (the same against an own region with harm `selfFlag.harm · population`); the candidate is still generated by `candidates.js` and always dropped by validation, so it should be removed or gated behind a `ruleset.aiDiplomacy.selfFlag` flag (default false) until Diplomacy supports it. **Not implemented**: *(a) goad* (tariffs, embargo, Show of Force; no ActionType yet).
5. **Finish.** `declareWar {target, goals:[{type}]}` with the goal type of the best CB tier (Grievance tribute, Rights cede, Sovereignty dependency, Existential annex); pool `war`, one per turn. Strike value requires a usable CB and `netEdge > strike.edge` (stands for "Military readout favourable"). Gap: allies/coalitions "in place" is not a condition; coalition requests (from Allies/Partners holding a CB against the target) are separate candidates. Deployment and army handling: `ai_war__spec.md`.
6. **Alliance squeeze.** Implemented: treaty ladder to the target's top-3 trade partners (not Dominate postures); `foreignPropaganda` covert and `covertInfluence` with `opinion: −1` in the target's most populous regions. **Not implemented**: Tariff Exemptions, Trade Agreements, Embargo recruitment.
7. **Balance of power.** Via `bopPenalty` and `sharedThreat` (Posture) and the `bop.growth` campaign bypass; player included.
8. **Ally behaviour.** Implemented: `proposeTreaty {to, kind:'Alliance', tier}` stepping BenevolentNeutrality → Defensive → StandingOffensive; Guarantee (Support, target under pressure); Coalition offer to a partner at war; overt `foreignPropaganda` (Court). **Not implemented (no ActionType yet)**: Improve Relations, Trade Agreement, Tariff Exemption, Gifts/Facilitation Grants, ally refusal of an unrecognised Defensive trigger, drift to Wary on broken promises (reputation enters affinity only through `tanh(reputation)`).
9. **Negotiation.** `satisfaction = postureFactor[posture(from)] · Σ W_k·effects[role]_k` (Dependency: −1 if we would be the subject). `≥ neg.accept` → `answerProposal {id, accept:true}`; `< neg.walk` → accept:false; between: no answer (the proposal expires by TTL). **(spec decision)** Counter-steps and the walk-out mark wait for the Negotiation Session implementation (`diplomacy__spec.md`).
10. **Internal politics on autopilot.** No economy or internal-politics orders are emitted.
11. **Fog.** Exact reads (`reads.js` is the single swap point for estimates).

## Status
- **Implemented**: Principles, Posture, Campaign, Leverage weights, Action Score, and Rules except the not-implemented items named in Rules 4, 6, 8, 9. Contested Asset is a placeholder. Tests: `tests/ai_diplomacy.test.js` written, **not yet run** (no execution environment); code rev below therefore means "written", not "verified".
- **Decided 2026-11-13**: the self-targeted false flag is post-alpha (kb Rules rev 2); `covert.js` keeps rejecting `target === actor`. The `selfFlag` candidate is dead code until then.
- **(spec decision, confirmed 2026-11-12)**: opt-in `enabled`; `aiMemo` persistence; scale-free edge; `power` readout for balance of power; `initialOpinion` seed; treaty ladder and propaganda/influence as alpha roles; defaults in code not `tuning.defaults.json`; Dominate gate order; one campaign per target.
- **Not implemented (no ActionType)**: Embargo, Tariffs, Improve Relations, Trade Agreement, Gift, alliance-call, counter-proposals.
- **Open**: `effects` values; Contested Asset formula; Portrait → appetite; numbers pass.
- **Not yet done**: `modules__spec.md` pointer, `.outline/`, tuning into the JSON.
- **Sync:** (`<section> = <kb rev> / <code rev>`)
  - Data Structures > Principles = 1 / 1
  - Data Structures > Posture(A → B) (derived) = 1 / 1
  - Data Structures > Campaign (stored, cached intent) = 1 / 1
  - Data Structures > Leverage weights (decision-time) = 1 / 1
  - Data Structures > Contested Asset (derived readout) = 1 / -
  - Data Structures > Action Score = 1 / 1
  - Rules = 2 / -
