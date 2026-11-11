# AI — Diplomacy — Specification

Status: first spec pass (2026-11-11). Source: `kb/ai_diplomacy__kb.md` (read in full), `spec/architecture__spec.md`, `spec/admin_war_diplomacy__spec.md` §5-§6 (Diplomacy), `src/modules/ai/simpleWar.js` and `src/modules/war/actions.js` (the only implemented AI/action conventions). Ground truth stays the kb; anything this file decides that the kb does not is tagged **(spec decision)** and listed under Status. **The Diplomacy module is not implemented yet** (`ctx.derive.diplomacy` and its action types do not exist in `src/`), so the agent reads through one adapter file and skips any action role whose ActionType is not registered. It works end to end against the implemented War actions today and gains behaviour as Diplomacy lands.

## Data Structures

### 1. Files
```
src/modules/ai/diplomacyAgent.js          entry: planDiplomacy(ctx, country) -> {orders, cache}; diplomacyOrders(ctx) -> orders[]  (same shape as simpleWarOrders)
src/modules/ai/diplomacy/reads.js         the ONLY file that touches ctx.derive / ctx.state of other modules (adapter)
src/modules/ai/diplomacy/posture.js       derivePosture, balance-of-power, shared threat
src/modules/ai/diplomacy/campaign.js      campaign values, selection, switching, hysteresis
src/modules/ai/diplomacy/candidates.js    candidate generators per campaign type
src/modules/ai/diplomacy/score.js         expected gain, cost, covert risk, budget selection
src/modules/ai/diplomacy/negotiate.js     responses to proposals / Negotiation Session turns
src/modules/ai/module.js                  SimModule 'ai': owns state.ai (cache only), service ai.setCache
tests/ai_diplomacy.test.js                node --test
```
Pure functions: no `Date.now`, no `Math.random`, no `ctx.rng` (ties break by sorted id), no writes to `ctx.state`.

### 2. State (cache only, never spendable)
```js
// state.ai.diplomacy  @cache — every field re-derivable; a rederive() test covers it
{ posture:   Record<`${a}|${b}`, {value: 'Ally'|'Partner'|'Wary'|'Dominate', since: number, powerShare: number}>,   // hysteresis memory
  campaigns: Record<country, Campaign[]> }
// Campaign {id, target: countryId | blocId, type: 'Court'|'Secure'|'Squeeze'|'Provoke'|'Strike'|'Support', since: number, snap: {cbs: number, allies: number}}
```
The agent returns `cache`; the engine's AI planner writes it through `ctx.services.ai.setCache(country, cache)` (module-owned slice, services convention). If `state.ai` is missing the agent starts from empty caches: posture is derived without the band and campaigns are re-chosen from values.

### 3. Ruleset data (`ruleset.aiDiplomacy`, authored in the Editor; numbers in `ruleset.tuning`)
```js
aiDiplomacy: {
  actionMap: { improveRelations: 'improveRelations', tradeAgreement: null, tariffExemption: null, imposeTariff: null, embargo: null,
               alliance: null /* param tier */, guarantee: null, coalition: null, gift: null, propaganda: null, espionage: null,
               cooperation: null, declareWar: 'declareWar', proposePeace: 'proposePeace' },   // null = Diplomacy not registered yet -> role skipped
  postureGate:   { Ally: ['Court','Support','Secure'], Partner: ['Court','Support','Secure'], Wary: ['Secure','Squeeze','Court'],
                   Dominate: ['Squeeze','Provoke','Strike','Secure'] },
  campaignFocus: { Court: ['improveRelations','tradeAgreement','tariffExemption','gift','cooperation','propaganda:overt'],
                   Support: ['alliance:climb','guarantee','coalition:offer','gift'],
                   Secure: ['tradeAgreement','alliance','espionage:influence','cooperation'],
                   Squeeze: ['alliance:neighbours','tariffExemption:neighbours','embargo:recruit','imposeTariff','propaganda:covert','espionage'],
                   Provoke: ['imposeTariff','embargo','espionage:falseFlag','propaganda:covert'],
                   Strike: ['declareWar','coalition:request','alliance:call'] },
  effects: { /* role -> {economic, diplomatic, military, cultural} signed expected change in A's relative leverage over/with the target, per unit magnitude */ }
}
```
`actionMap` ids are **(spec decision)** until `diplomacy/actions.js` registers the catalogue; `declareWar` and `proposePeace` already exist (params `{target, goals}` and `{war, terms}`).

### 4. Reads adapter (`reads.js`) — one place to rename when Diplomacy lands
```js
export const reads = {
  countries:   ctx => Object.keys(ctx.state.countries).sort(),
  opinion:     (ctx, a, b) => ctx.derive.countries?.opinion?.(a, b) ?? 0,                 // -100..100  (spec decision: name)
  leverage:    (ctx, a, b) => ctx.derive.diplomacy?.leverage?.(a, b),                     // {economic, diplomatic, military, cultural}, never summed here
  reputation:  (ctx, a, b) => ctx.derive.diplomacy?.reputation?.(a, b) ?? 0,              // value of the Reputational stack
  cbs:         (ctx, holder, target) => ctx.derive.diplomacy?.activeCBs?.(ctx, holder, target) ?? [],
  tariffAsym:  (ctx, a, b) => ctx.derive.economics?.tariffAsymmetry?.(a, b) ?? 0,
  treaties:    (ctx, c) => ctx.derive.diplomacy?.treatiesOf?.(c) ?? [],                  // for alliance graph
  portrait:    (ctx, c) => ctx.derive.polity?.governmentPortrait?.(c) ?? {},              // Government amalgam
  poolSupply:  (ctx, c, role) => ctx.derive.economics?.poolSupply?.(c, ctx.ruleset.aiDiplomacy.pools[role]) ?? 0,
  detection:   (ctx, defender, region) => observationAt(ctx, defender, region) + counterIntelCommitted(ctx, defender, region),   // exact in alpha (kb Rule 11)
  threshold:   (ctx, type, tier, target) => kernel.threshold(type, tier, target, ctx),    // labour needed; binary, target-scaled
  warState:    (ctx, a, b) => atWar(ctx, a, b), inboundProposals: (ctx, c) => ctx.state.diplomacy?.proposals?.filter(p => p.to === c) ?? []
}
```

## Rules

### 1. Turn procedure (per non-player Country; the player is read as an ordinary B)
```js
export function planDiplomacy(ctx, a) {
  const R = snapshot(ctx, a)                                    // one read pass: W(a), leverage matrix, CBs, treaties, power shares
  const posture = Object.fromEntries(others(ctx, a).map(b => [b, derivePosture(ctx, a, b, R)]))   // 2
  const campaigns = updateCampaigns(ctx, a, posture, R)         // 3
  const budget = labourBudget(ctx, a)                           // {diplomacy, espionage}, minus T('ai.dip.budget.reserve')
  const cands = campaigns.flatMap(c => generate(ctx, a, c, posture[c.target], R))              // 4: only roles whose actionMap id is registered
  const orders = [...respond(ctx, a, R, posture), ...select(ctx, a, cands, budget, R)]         // 5-6
  return { orders, cache: { posture: pack(posture, R), campaigns } }
}
```
All orders use the envelope `{id: 'ai.<country>.<role>.<target>.<turn>', actor: {kind:'government', country}, type, params}` and go through `Engine.submit` validation like the player's (architecture Rule 8).

### 2. Decision weights and posture
```js
const W = (ctx, a) => { const p = reads.portrait(ctx, a), ruth = p.ruthlessness_restraint ?? 0   // -1 restraint .. +1 ruthless
  return { economic: 1, diplomatic: 1, cultural: 1, military: 1 + ctx.T('ai.dip.w.ruth') * ruth } }   // decision-time only, never stored (kb)
const edge = (ctx, a, b, R) => Σ_c W[c] * (lev(a,b)[c] - lev(b,a)[c]) / normaliser                   // A's weighted edge over B, -1..1; existential override promotes military
function affinity(ctx, a, b, R) {                                                                   // -1..1
  return ctx.T('ai.dip.posture.w.opinion') * reads.opinion(ctx,a,b)/100 + ctx.T('ai.dip.posture.w.rep') * norm(reads.reputation(ctx,a,b))
       + ctx.T('ai.dip.posture.w.shared') * sharedThreat(ctx,a,b,R) - ctx.T('ai.dip.posture.w.tariff') * norm(reads.tariffAsym(ctx,a,b))
       - ctx.T('ai.dip.posture.w.cb') * (heldAgainst(R, b, a) ? 1 : 0) }
function derivePosture(ctx, a, b, R) {
  const s = affinity(ctx,a,b,R), e = edge(ctx,a,b,R) - bopPenalty(ctx,a,b,R), prev = R.cache.posture[`${a}|${b}`]?.value, band = ctx.T('ai.dip.posture.band')
  const sh = v => (prev === v ? -band : 0)                                                          // hysteresis: current posture's lower boundary is easier to stay above
  if (s >= ctx.T('ai.dip.posture.tAlly') + sh('Ally')) return 'Ally'
  if (s >= ctx.T('ai.dip.posture.tPartner') + sh('Partner')) return 'Partner'
  return e >= ctx.T('ai.dip.posture.tDominate') + sh('Dominate') ? 'Dominate' : 'Wary'
}
```
- One function, no player branch (kb Rule 1); the initial `opinion` therefore seeds the starting posture through `affinity`.
- **Balance of power:** `powerShare(b) = Σ_c W[c]·lev_c(b, *) / Σ over all countries`. `bopPenalty(a,b) = max(0, powerShare(b) − powerShare(a) − T('ai.dip.bop.margin'))` makes the strongest Country look less dominable and more worth containing: it lowers `edge` and, via `sharedThreat`, raises affinity between every pair that is threatened by `b`. `sharedThreat(a,c) = max over b ∉ {a,c} of min(threatOn(a,b), threatOn(c,b))`, `threatOn(x,b) = max(0, powerShare(b) − powerShare(x) − T('ai.dip.bop.margin'))`.
- Growth: `pack()` stores `powerShare` in the posture cache; a rise above `T('ai.dip.bop.growth')` between turns counts as an opportunity/threat signal for campaign bypass.

### 3. Campaigns
```js
function typeValue(ctx, a, b, type, R) {                        // 0..1, derived from readouts only
  switch (type) {
    case 'Court':   return clamp01(affinity(...))                                                 // worth building trust
    case 'Support': return heldAgainstPartner(R, b) || atWar(b) ? 1 : clamp01(affinity(...))      // partner under pressure
    case 'Secure':  return maxContestedValue(ctx, a, b, R)                                        // kb Contested Asset, normalised
    case 'Squeeze': return clamp01(edgeAfterNetwork(ctx,a,b,R))                                   // gain from isolating b
    case 'Provoke': return (hasUsableCB(R, a, b) ? 0 : 1) * clamp01(edge(...))                    // only while no CB held
    case 'Strike':  return hasUsableCB(R,a,b) && proportionate(R,a,b) && edge(...) > T('ai.dip.strike.edge') ? clamp01(edge(...)) : 0
  } }
function updateCampaigns(ctx, a, posture, R) {
  const out = []
  for (const b of rankedTargets(ctx, a, posture, R).slice(0, ctx.T('ai.dip.maxCampaigns'))) {      // concurrent cap
    const allowed = ctx.ruleset.aiDiplomacy.postureGate[posture[b]], cur = R.cache.campaigns[a]?.find(c => c.target === b)
    const best = argmax(allowed, t => typeValue(ctx, a, b, t, R))                                  // tie: type order in gate list
    const bypass = existentialTrigger(R, a, b) || newOpportunity(R, cur, b)                         // new CB since snap, target ally count dropped, power share jump
    const margin = bypass ? 0 : ctx.T('ai.dip.switchMargin')
    const keep = cur && allowed.includes(cur.type) && typeValue(ctx,a,b,cur.type,R) + margin >= typeValue(ctx,a,b,best,R)
    out.push(keep ? { ...cur, snap: snapOf(R, b) } : { id: `cmp.${a}.${b}.${ctx.state.meta.turn}`, target: b, type: best, since: ctx.state.meta.turn, snap: snapOf(R, b) })
  }
  return out
}
```
- Switching costs no order and no labour; the margin is the only friction. A posture change that removes the current type from `postureGate` forces a switch regardless of the margin.
- A Country may hold several campaigns, at most one per target per turn in this spec **(spec decision)**; several types toward one target in parallel are expressed by the portfolio, not by multiple records.

### 4. Candidates, score, selection
```js
function score(ctx, a, c, cand, R) {
  const w = W(ctx, a), eff = ctx.ruleset.aiDiplomacy.effects[cand.role]
  const gain = cand.magnitude * Σ_k w[k] * (eff[k] ?? 0)
  const focus = inFocus(c.type, cand) ? ctx.T('ai.dip.focus') : 0                                  // campaign focus bonus, never a prohibition
  return gain + focus - cost(ctx, a, cand, R)                                                      // labour (scarcity price of the pool), reputation, CB risk, own-Region harm
}
function select(ctx, a, cands, budget, R) {                                                        // binary thresholds: fund fully or skip, no partial, no refund
  const sorted = cands.map(x => ({...x, s: score(...)})).filter(x => x.s > 0).sort((p, q) => q.s / p.labour - p.s / q.labour || p.key.localeCompare(q.key))
  const out = []; for (const x of sorted) { if (x.labour > budget[x.pool]) continue; budget[x.pool] -= x.labour; out.push(x.order) }
  return out
}
```
- `cand.labour = reads.threshold(ctx, type, tier, target)`; a candidate below threshold is never emitted.
- **Covert risk:** the exact detection value `d = reads.detection(ctx, target, region)` (alpha reads exact data) gives a deterministic outcome per concealment tier: `d < conceal.act` undetected; `< conceal.sender` act detected; otherwise sender revealed (or, for a false flag, the apparent sender until `conceal.falseFlag`). The agent picks the cheapest tier that stays undetected and prices the residual risk (Reputational Leverage + CB for the true sender) when none does.
- **CB fabrication (kb Rule 4):**
  - *goad*: `imposeTariff`, `embargo` and border deployment orders while no usable CB is held, only if the target's expected retaliation would open a CB for A (`tariffAsymmetry` crossing the Grievance tier).
  - *frame*: `espionage` with `falseFlag: apparent=b` against a region of a third Country `c`; gain = `c`'s CB against `b` that A can then back through `coalition`.
  - *self-targeted*: same with `region ∈ own regions`; cost term adds `T('ai.dip.selfFlag.harm') * population(region)` plus the exposure price.
- **Finish (Strike):** `declareWar` with `{target, goals}` (goals within the CB's tier; overreach priced per observer), then the diplomatic follow-up `coalition:request` / `alliance:call`. Army handling is `simpleWar.js` now and AI-War later.
- **Alliance squeeze (Squeeze):** the generator ranks the target's neighbours and trading partners by `tradeDependency` and proposes `alliance` / `tradeAgreement` / `tariffExemption` to them, and `embargo:recruit` to those already hostile to the target; `greatPowerBacked(coalition)` is read to price rejected-demand reputation hits.

### 5. Responding to proposals (`negotiate.js`)
```js
function respond(ctx, a, R, posture) {
  return reads.inboundProposals(ctx, a).map(p => {
    const sat = satisfaction(ctx, a, p, posture[p.from], R)             // Σ over terms: signed term value from the weighted effects table, scaled by posture direction
    if (sat >= ctx.T('ai.dip.neg.accept')) return answer(p, 'accept')
    if (sat <  ctx.T('ai.dip.neg.walk'))   return answer(p, 'reject')   // stronger side withdrawing leaves the decaying mark; priced in sat via cost()
    return counter(p, minimalConcession(p, sat))                        // one step per round: drop or add the single term with the best sat gain per cost
  })
}
```
Ratification by the receiving Country's own cells (`ratify()`) is Diplomacy's job and is unchanged; the agent only decides the Government's position. `answer`/`counter` action ids are **(spec decision)** pending the Negotiation Session implementation.

### 6. Internal politics on autopilot and "strengthen first"
The agent emits no internal-politics or economy orders. The AI Government runs on the scenario's default dials (Allocation Dial defaults, standing spending dial with reserve floor) and on `simpleWar.js`; there is no hidden stability number (kb Rule 10). **(spec decision)** In alpha, "strengthen first" is therefore limited to those defaults plus the diplomatic half of *Secure* (treaties, trade access, influence). A dedicated economy/army-growth autopilot is a separate item.

### 7. TUNE catalogue (all `placeholder`, appended to `tuning.defaults.json`)

| Key | Value | Key | Value | Key | Value |
|---|---|---|---|---|---|
| `ai.dip.w.ruth` | 0.5 | `ai.dip.posture.w.opinion` | 0.4 | `ai.dip.posture.w.rep` | 0.2 |
| `ai.dip.posture.w.shared` | 0.2 | `ai.dip.posture.w.tariff` | 0.1 | `ai.dip.posture.w.cb` | 0.1 |
| `ai.dip.posture.tAlly` | 0.6 | `ai.dip.posture.tPartner` | 0.2 | `ai.dip.posture.tDominate` | 0.25 |
| `ai.dip.posture.band` | 0.05 | `ai.dip.bop.margin` | 0.1 | `ai.dip.bop.growth` | 0.05 |
| `ai.dip.switchMargin` | 0.1 | `ai.dip.maxCampaigns` | 4 | `ai.dip.focus` | 0.3 |
| `ai.dip.strike.edge` | 0.3 | `ai.dip.budget.reserve` | 0.1 | `ai.dip.selfFlag.harm` | 0.0005 |
| `ai.dip.neg.accept` | 1.0 | `ai.dip.neg.walk` | 0.4 | | |

## Cross-references
- `admin_war_diplomacy__spec.md` §5-§6: CB derivation, overreach, leverage readouts, covert/detection thresholds, step-7 order; `war/actions.js`: `declareWar`, `proposePeace`, `fieldUnits`, `orderMove`.
- `architecture__spec.md`: SimModule contract, services convention, `ctx.T`, determinism, Rule 8 (AI uses `Engine.submit`).
- `kernel_engine__spec.md`: `threshold`, `stance`, ActionRegistry.
- kb: `ai_diplomacy__kb.md`, `diplomacy__kb.md`, `actions__kb.md`.

## Status
- **Settled in kb, encoded**: symmetric posture function, parallel portfolio, Campaign record with focus bonus, free switching with a margin and bypass, balance-of-power term, CB provocation (goad, frame, self-targeted false flag), alliance squeeze, autopilot internal politics.
- **(spec decision) — please confirm or overrule**
  1. Agent returns `{orders, cache}`; the cache is written by the `ai` module's service, not by the agent.
  2. `reads.js` adapter with optional chaining, and `actionMap` with `null` entries: roles whose ActionType is not registered are skipped, so the agent runs before Diplomacy exists.
  3. Formula shapes in §2-§4 (affinity as a weighted sum, edge as a W-weighted leverage difference, posture hysteresis via lowered lower bounds, one campaign per target per turn, greedy value-per-labour selection) and all `ai.dip.*` keys.
  4. Action ids other than `declareWar`/`proposePeace`/`improveRelations`, and the derive names in `reads.js` (`opinion`, `reputation`, `tariffAsymmetry`, `treatiesOf`, `governmentPortrait`, `poolSupply`), are provisional.
  5. "Strengthen first" is not implemented by this agent (see Rules §6).
  6. The agent runs only for non-player Countries (`!isPlayer`), but reads the player like any other B.
- **Open**: `effects` table values; the Campaign type list stays working; Portrait → appetite beyond the Military weight; numbers pass.
- **Not yet done**: code, tests (planned names: `posture is symmetric for player and AI targets`, `posture hysteresis holds near a boundary`, `campaign switch needs the margin`, `campaign bypass on new CB`, `candidates skipped when action role unregistered`, `binary threshold funds fully or not at all`, `self-targeted false flag is priced with own-Region harm`, `agent is deterministic and does not mutate state`), `modules__spec.md` pointer, `index.md` module row 13, `.outline/`.
