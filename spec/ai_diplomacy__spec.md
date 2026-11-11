# AI — Diplomacy — Specification

Status: second pass (2026-11-11), **rewritten against the implemented Diplomacy module**. Source: `kb/ai_diplomacy__kb.md`, `src/modules/diplomacy/{module,readouts,covert,actions}.js`, `src/modules/war/actions.js`, `src/engine/engine.js`, `src/client/engineClient.js`. Ground truth stays the kb; anything decided here that the kb does not say is tagged **(spec decision)** and listed under Status.

Code: `src/modules/ai/diplomacyAgent.js`, `src/modules/ai/diplomacy/*`, `src/modules/ai/actions.js`, `src/modules/ai/index.js`.

## Data Structures

### 1. Files
```
src/modules/ai/index.js                   aiOrders(ctx): simpleWar + simpleDiplomacy always; AI-Diplomacy + AI-War only when ruleset.aiDiplomacy.enabled === true
src/modules/ai/diplomacyAgent.js          planDiplomacy(ctx, a, rd?, cache?) -> {orders, cache, posture, campaigns}; diplomacyOrders(ctx, rd?) -> orders[]
src/modules/ai/actions.js                 pseudo-action `aiMemo` + writeCache(ctx, country, cache)
src/modules/ai/diplomacy/tuning.js        DEFAULTS for every ai.dip.* key + T(ctx, key)
src/modules/ai/diplomacy/config.js        DEFAULT_CONFIG (postureGate, campaignFocus, effects, postureFactor), config(ctx)
src/modules/ai/diplomacy/reads.js         the ONLY file touching ctx.state / ctx.derive / other modules
src/modules/ai/diplomacy/posture.js       shared snapshot, weights, edge, affinity, balance of power, derivePosture
src/modules/ai/diplomacy/campaign.js      typeValue, updateCampaigns (margin, bypass)
src/modules/ai/diplomacy/candidates.js    generate(): per-campaign candidate actions, validated against the real ActionRegistry
src/modules/ai/diplomacy/score.js         labourBudget, score, select (binary thresholds)
src/modules/ai/diplomacy/negotiate.js     respond() to pending proposals
tests/ai_diplomacy.test.js
```
Pure functions: no `Date`, no `Math.random`, no `ctx.rng` (ties break by sorted id), no writes to `ctx.state`. The agent takes an injectable `rd` (reads adapter) so it is testable without a world.

### 2. State (cache only)
```js
state.ai.diplomacy = { posture:   { 'A|B': { value, since, powerShare } },
                       campaigns: { A: [ { id, target, type, since, snap: { cbs, allies, power } } ] } }
```
Re-derivable; if missing the agent starts empty (no hysteresis band, campaigns re-chosen from values). **Persistence (spec decision):** `aiOrders` runs on a cloned ctx, so the agent cannot write state. It emits one pseudo-action per AI Country, `aiMemo {country, cache}` (class event, covert, no cost, no gate), whose `apply` calls `writeCache`. No engine change; the Decision Log records the entry with no affected cells.

### 3. Reads adapter (`reads.js`; every function takes `ctx` first, `ctx.derive.*` is already bound)
`countries, isPlayer, turn, opinion, leverage(a,b), reputation(a,b), cbs(holder,target), bestCBRank, warForbidden, treatyTier, tradeDep, power, treaties(c), tariffAsym, portrait(c), atWar, regions(c), regionPop, targetScale, opThreshold(p), detection(defender, region), espionageFree(c), conceal(which, level), hasCommitment, inboundProposals(c), registered(type), validate(order)`.
- `opinion`: `derive.countries.opinion` does not exist; falls back to `ruleset.aiDiplomacy.initialOpinion['A>B']` (−100..100) else 0. **(spec decision)** This is the seed the kb asks for; no Country-to-Country opinion stock exists yet.
- `tariffAsym`: `derive.economics.tariffAsymmetry` does not exist yet; reads 0.
- `validate(order)` runs the registered ActionType's `validate`; candidates failing it are never emitted (this replaces the old `actionMap` / `null` roles).

### 4. Ruleset data (`ruleset.aiDiplomacy`, all optional; `config.js` holds defaults)
`{ enabled, initialOpinion, postureGate, campaignFocus, effects, postureFactor }`. `enabled` defaults to **false**: the agent is opt-in until the designer turns it on.
```
postureGate: Ally/Partner → Court, Support, Secure · Wary → Secure, Squeeze, Court · Dominate → Strike, Squeeze, Provoke, Secure   // list order breaks ties
campaignFocus (roles/tags): Court treatyBN treatyDef propaganda:overt · Support treatyDef treatyOff guarantee coalition · Secure treatyBN treatyDef influence · Squeeze treatyBN:neighbours treatyDef:neighbours propaganda:covert influence · Provoke frame selfFlag influence · Strike declareWar coalition:request
```

## Rules

### 1. Turn procedure (per non-player Country; the player is read as an ordinary B)
`shared snapshot → posture toward every other Country → updateCampaigns → labour budget → candidates (validated) → score → greedy binary selection`, plus `respond()` to inbound proposals. Order ids: `ai.<country>.<role>.<target>[.<region>].<turn>`.

### 2. Weights, edge, affinity, posture
- `W`: Economic/Diplomatic/Cultural = 1; Military = `1 + ai.dip.w.ruth × ruthlessness_restraint` (Portrait amalgam, −1..1), floor 0.1. Decision-time only.
- `edge(a,b) = Σ W_k · clamp((lev(a,b)_k − lev(b,a)_k) / (2·scale_k)) / Σ W_k`, `scale_k` = largest |readout| of that category over all ordered pairs (**spec decision**: scale-free normaliser; the old per-pair ratio saturates for antisymmetric categories). An Existential CB held by b against a drops every weight except Military.
- `affinity = w.opinion·opinion/100 + w.rep·tanh(reputation) + w.shared·sharedThreat − w.tariff·tanh(tariffAsym) − w.cb·[b holds a CB against a]`.
- Balance of power: `power(c)` = Diplomacy's normalised power readout (**spec decision**: replaces the W-weighted leverage sum). `threatOn(x,b) = max(0, share(b) − share(x) − bop.margin)`; `bopPenalty = bop.gain · threatOn(a,b)`; `sharedThreat(a,c) = clamp01(bop.gain · max_b min(threatOn(a,b), threatOn(c,b)))`.
- Posture: Ally if `affinity ≥ tAlly`, Partner if `≥ tPartner`, else Dominate if `edge − bopPenalty ≥ tDominate`, else Wary. The cached current posture's lower boundary is lowered by `posture.band` (hysteresis). One function; no player branch.

### 3. Campaigns
Values in 0..1 from readouts only: Court = affinity; Support = 1 if an Ally/Partner target is under pressure (at war or a CB held against it) else affinity; Secure = trade dependency / largest (**placeholder** for the open Contested Asset formula); Squeeze = netEdge + share of the target's trade held by our Ally/Partner postures; Provoke = (no usable CB) · netEdge; Strike = netEdge if a usable CB is held (recognised, no treaty forbids, not at war) and `netEdge > strike.edge`, else 0.
Targets ranked by best allowed value (> `minValue`), at most `maxCampaigns`. The current campaign is kept while `its value + switchMargin ≥ best`; the margin is 0 (bypass) when an Existential CB is held against us, a new CB of ours appeared since `snap`, the target lost allies, or its power share rose by more than `bop.growth`. A posture change that removes the type from the gate forces a switch. Switching costs no order and no labour. One campaign per target.

### 4. Candidates (each is validated; unregistered or invalid ones vanish)
- **Treaty ladder**: `proposeTreaty {to, kind:'Alliance', tier}` stepping BenevolentNeutrality → Defensive → StandingOffensive; Guarantee (Support, target under pressure); Coalition (offer to a partner at war; request from Allies/Partners holding a CB against the target).
- **Propaganda**: `foreignPropaganda` overt (Court) or covert (Squeeze) in the target's most populous regions; **influence**: `covertInfluence` with `opinion: −1` (Squeeze). Labour = `opThreshold` exactly (binary, no partial funding); skipped when an identical commitment already stands. Covert risk = priced exposure from exact detection (alpha reads exact data): 0 undetected, 30% of `cost.exposure` act-detected, full when the sender would be revealed.
- **CB fabrication (Provoke)**: *frame* = `covertInfluence` with `falseFlag: b` against the smallest region of a third Country, offered only inside the window `conceal.sender.low·scale ≤ detection < conceal.falseFlag·scale` (the victim must notice the act and still attribute it to b); harm term for Ally/Partner victims. *selfFlag* = the same against an own region with harm `selfFlag.harm · population`.
- **Finish (Strike)**: `declareWar {target, goals:[{type}]}` with the goal type of the best CB tier (Grievance tribute, Rights cede, Sovereignty dependency, Existential annex); pool `war`, one per turn.
- **Squeeze network**: treaty ladder to the target's top-3 trade partners (not Dominate postures).
- Score `= magnitude · Σ W_k·effects[role]_k + focus bonus − labour price − risk − harm`; greedy by score per labour; one treaty/war/covert op per target-region; pools: `espionage` (free Espionage minus `budget.reserve`), `proposals` (`budget.proposals` per turn; treaties cost no labour in code), `war` (1).

### 5. Responding to proposals
`satisfaction = postureFactor[posture(from)] · Σ W_k·effects[role]_k` (Dependency: −1 if we would be the subject). `≥ neg.accept` → `answerProposal {id, accept:true}`; `< neg.walk` → accept:false; between: no answer (the proposal expires by TTL). **(spec decision)** Counter-steps wait for the Negotiation Session implementation.

### 6. Internal politics and "strengthen first"
The agent emits no economy or internal-politics orders (kb Rule 10); in alpha "strengthen first" is the scenario defaults plus the Secure campaign's treaty step.

### 7. Tuning
All `ai.dip.*` keys live in `tuning.js` DEFAULTS (placeholders) and may be overridden by `tuning.defaults.json` entries; moving them into that file is a follow-up. Keys: `w.ruth, posture.w.{opinion,rep,shared,tariff,cb}, posture.{tAlly,tPartner,tDominate,band}, bop.{margin,growth,gain}, switchMargin, maxCampaigns, minValue, focus, strike.edge, budget.{reserve,proposals}, cost.{labour,exposure,harmAlly}, selfFlag.harm, neg.{accept,walk}`.

## Cross-references
- `admin_war_diplomacy__spec.md` §5–§6 (CBs, overreach, leverage, covert); `ai_war__spec.md` (deployment, tactics); `architecture__spec.md` (Rule 8: AI uses the same order path).
- kb: `ai_diplomacy__kb.md`, `diplomacy__kb.md`, `actions__kb.md`.

## Status
- **Implemented**: everything in Rules 1–6 except as listed below. Tests: `tests/ai_diplomacy.test.js` (written, **not yet run**: no execution environment this session).
- **Finding — self-targeted false flag is not possible in the current Diplomacy code**: `covert.js` `validate` rejects `target === actor`, and `detect()`/`consequences()` would use the AI's own Observation and grant a CB against itself. The `selfFlag` candidate is therefore generated but always dropped by validation. Needs a Diplomacy rule (who detects a self-flag) before enabling; `diplomacy__kb.md` wording still unchecked.
- **(spec decision) — confirm or overrule**: opt-in `enabled` flag (default off); `aiMemo` persistence; scale-free edge; `power` readout for balance of power; seed opinion via `initialOpinion`; treaty ladder and propaganda/influence as the alpha roles; defaults living in code, not `tuning.defaults.json`; Dominate gate order Strike, Squeeze, Provoke, Secure.
- **Not implemented (no ActionType yet)**: Embargo, Tariffs, Improve Relations, Trade Agreement, Gift, alliance-call, counter-proposals.
- **Open**: `effects` values; Contested Asset formula; Portrait → appetite; numbers pass.
- **Not yet done**: `modules__spec.md` pointer, `.outline/`, moving tuning into the JSON.
