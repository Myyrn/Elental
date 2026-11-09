# Economics & Internal Politics — Detailed Specification

Status: first detailed pass (2026-11-04). Expands §2-§3 of `modules__spec.md` into
implementable algorithms. Source: `economics__kb.md`, `internal_politics__kb.md`,
`administration__kb.md`, `actions__kb.md`. The kb fixes *rules and order*; formulas are open
until the numbers pass, so every formula here is a **(spec decision)** with its numbers in
`ruleset.tuning` as `placeholder` (catalogue in §9). Shared scale (confirmed): grievance
severity, compliance and need satisfaction are per-cell values in **[0,1]**.

## Data Structures

### 1. Conventions

```js
const T = ctx.T                          // tuning accessor; no literals
const cellProvShare = (ctx, cell, p) =>  // confirmed rule: labour/population spreads over the Region's provinces by presence share
  presence(p, cell.nation) / sum(provincesOf(cell.region).map(q => presence(q, cell.nation)))
const clamp01 = x => Math.min(1, Math.max(0, x))
```
Laws are stored **per Country as scoped entries**, not per cell (supersedes `Cell.rights/duties` in `modules__spec`);
the effective value for a cell is derived with `resolveState` (Rights/Duties) or `resolveAmount` (Requisition, Control):
```js
state.polity.law[country] = { rights: Record<rightId, RightEntry[]>, duties: Record<dutyId, DutyEntry[]>, requisitions: ReqEntry[] }
// RightEntry/DutyEntry = {scope, value, declaredTurn, seq} ; ReqEntry = {scope, target:{good|pool}, amount, unit:'fraction'|'absolute', since}
const right = (ctx, cell, id) => resolveState(law(cell).rights[id] ?? [], cell.key, ctx) ?? ctx.ruleset.rights[id].silentDefault   // silence = allowed
```

### 2. Economics — production

```js
// economics/derive.js
const poolLabour = (ctx, cell, pool) => cell.labour[pool] - committedElsewhere(ctx, cell, pool)  // production side of the dual-claim split (dial result)
const labourAt = (ctx, p, pool) => Σ_cells poolLabour(cell, pool) * cellProvShare(cell, p)
// Extraction (raw goods)  — each raw good declares its extraction pool in ruleset.goods[g].extractPool
const extract = (ctx, p, g) => habitableOutput(prov(p), T('prod.k') * resourceYield(ctx, prov(p), g) * prov(p).resourceOverrides?.[g] ?? 1)
                                * labourAt(ctx, p, goods[g].extractPool) ** T('prod.alpha')       // diminishing returns, alpha < 1
// Processing (semi/light/heavy/transport) — per trade zone, from zone stock + this turn's raw output
function processZone(ctx, zone) {
  const lab = Σ_p labourAt(ctx, p, 'Crafting/Industry') over zone provinces            // other pools per recipe.pool
  const feasible = recipes.filter(r => inputsAvailable(zone, r))                        // alternatives: Preserved Food, Draft Animals, Fuel
  const margin = r => Math.max(0, price(r.out) * r.outQty - Σ price(i) * i.qty)         // ASSUME planning rule: labour follows value added
  const w = feasible.map(r => margin(r) ** T('prod.theta')); normalise(w)
  for (r of feasible) { runs = min(w[r] * lab / r.labourPerRun, limiting input / r.inQty); consume(inputs, runs); produce(r.out, runs * r.outQty) }
}
```
Planning posture dial (`planningPosture ∈ [0,1]`, Administration): at 1 processing labour is allocated by the Government's `plannedWeights`
(Questions' demanded goods) instead of `margin`; at 0 it is purely market. Units produced go to the producing province's warehouse (capped; overflow spoils, §6).

### 3. Economics — prices, scarcity and flows (single pass, nothing stored)

```js
// derived at resolution (kb Rule 15): price = base_value(authored, numeraire units) × scarcity × price_level
function pricePass(ctx) {
  for (z of zones) for (g of goods) { S[z][g] = production + stock(z,g); D[z][g] = plannedDemand(z,g) }     // cells' tier needs + processing inputs + Government + army upkeep
  const pre = (z,g) => scarcity(S[z][g], D[z][g])
  for (e of zoneEdges) for (g of goods) {                                    // cross-zone flows move goods from surplus to shortage
    gap = price(z2,g) - price(z1,g)*(1+friction(e)) ; if (gap > 0) q = min(e.throughputCapLeft, surplus(z1,g) * T('flow.share'), ...)   // net of tariffs; ONE pass
    move(q); e.currentFlow += q
  }
  for (z, g) final[z][g] = scarcity(S'[z][g], D[z][g])                       // recomputed once from post-flow balances (no equilibrium solver)
  return (g, z) => base(g) * final[z][g] * priceLevel(ctx)
}
const scarcity = (S, D) => clamp((D + T('scar.eps')) / (S + T('scar.eps')), T('scar.min'), T('scar.max')) ** T('scar.elasticity')
const priceLevel = ctx => ((coinSupply(ctx) / clearedVolume(ctx)) / ctx.state.economy.coinage.ratio0) ** T('money.kappa')   // numeraire scarcity lives here only
const frictionOf = (ctx, e) => T('flow.friction') * (1 / Math.max(T('eps.infra'), minTradeInfra(e)))                          // lower trade infrastructure -> more friction
```
Trade zones (derived, never stored): `gravity(p) = output(p) * tradeInfra(p)`; `hubOf(p)` = hill-climb to the strongest neighbouring gravity
(ties by id); zone = provinces with the same hub. `throughputCap(zA,zB) = T('zone.capBase') * min(tradeInfra(hubA), tradeInfra(hubB)) * diplomacyGate(zA,zB)`
(**ASSUME**: kb says "raised by infrastructure investment"; gate = 0 on embargo/ResourceExportBan, exempt under TradeAccess). Estate tariffs reduce realised value only.

### 4. Economics — resolution order (step 3), line by line

```js
function step3(ctx) {
  const L0 = gov(ctx).ledger                                 // start-of-turn balance: Government purchases fund from it
  const out = production(ctx)                                // §2, per province, then split to producing cells by cellProvShare
  landSplit(ctx, out)                                        // for each province: holders' shares (Σ ≤ 1) take their share of output; remainder -> producing cells
  requisition(ctx)                                           // PRE-cascade
  const price = pricePass(ctx)
  cascade(ctx, price)                                        // Subsistence -> Comfort -> Luxury
  taxation(ctx, price)                                       // post-cascade
  debtService(ctx)                                           // existing obligations
  creditClearing(ctx)                                        // new loans + Borrow
  ledgerUpdate(ctx, L0)                                      // spending dial vs L0, then inflows
}
function requisition(ctx) {
  for (entry of reqEntries(ctx)) for (cell of cellsCovered(entry.scope, ctx)) {
    claimed = entry.unit === 'fraction' ? entry.amount * holdings(cell, entry.target) : entry.amount
    delivered = claimed * compliance01(ctx, cell).involuntary         // delivered = claimed x involuntary_compliance
    take(cell, entry.target, delivered) ; gov.inventory[entry.target] += delivered
    ctx.polityQueue.requisitionHits.push({cell: cell.key, target: entry.target, essentiality: essentiality(entry.target), shortfall: claimed - delivered})
  }                                                          // polity step 5 converts hits into the TWO Opinion hits (direct, offsettable; structural via Extraction<->Investment alignment)
}
function cascade(ctx, price) {                               // phases are global per tier so scarcity hits luxury first
  for (tier of ['subsistence', 'comfort', 'luxury']) {
    for (g of goodsInTier(tier)) for (z of zones) {
      demand = cellsIn(z).map(c => wantQty(c, g, tier) capped by affordable(c, price(g,z), c.cash))                // alternatives (Bread|Preserved Food, Coal|Lumber) -> cheapest
      fill = Math.min(1, supplyLeft(z,g) / Σ demand)                                                          // pro rata when short
      for (c) { buy(c, g, demand[c] * fill) ; c.satisfaction[tier] += (demand[c]*fill) / need(c,tier) share }
    }
  }
  for (c of cells) { c.cash = c.sales - purchases ; c.satisfaction[tier] = clamp01(...) }
  deliverNonMaterial(ctx)                                    // Culture pool output (labour * rate, directed share removed) relieves Identity/Solidarity/Purpose by grievance*pop weighting; never stockpiled
}
// Market access, tariffs and throughput gate each purchase: a cell without Market access (Right) or behind a blocked edge gets fill = 0 for that good.
function taxation(ctx, price) {
  for (c of cells) {
    base = {market: c.salesValue, wealth: c.wealth}
    due = Σ over {market, wealth}: dutyRate(c, kind) * base[kind]           // independent, both may apply; Duty rate resolved by scope (most specific wins)
    paid = Math.min(due * compliance01(ctx, c).involuntary, c.cash)         // never below zero; Wealth never negative
    c.wealth += c.cash - paid; ctx.taxCollected[c.country] += paid
  }
}
function debtService(ctx) {
  for (o of obligations) {
    due = o.principal * rate(zoneOf(o.debtor)) ; paid = Math.min(due, cashOf(o.debtor)) ; transfer(o.debtor, o.creditor, paid)
    o.arrears += due - paid
    if (o.arrears > T('debt.arrearsLimit') * o.principal) defaultObligation(ctx, o)    // ASSUME auto-default for cells; creditor loses claim; Opinion/Grievance hit queued; net position falls
  }
}
function creditClearing(ctx) {                               // one derived pass per trade zone
  lenders = cells.filter(c => right(c, 'Lending') && c.wealth > needReserve(c)).map(c => ({c, supply: (c.wealth - needReserve(c)) * T('credit.lendFraction')}))
  borrowers = [...cells.filter(c => c.shortfall > 0).map(c => ({c, demand: c.shortfall})), ...(govBorrowEvent ? [{c: 'gov', demand: amount}] : [])]
  r = clamp(T('credit.r0') * (Σdemand / Σsupply) ** T('credit.eta'), 0, legalCeiling(zone) ?? Infinity)
  match greedily (lenders desc by supply, borrowers desc by demand): create Obligation{creditor, debtor, principal, terms:{rate: derived each turn, nominal}}   // no anonymous debts
  // cross-zone: surplus lenders may serve a higher-rate zone while (rate gap > spread), spread = f(min hub tradeInfra, Diplomacy gating); no collection mechanism across Countries
}
function ledgerUpdate(ctx, L0) {
  const d = resolveAllocation(spendingDial(ctx), L0, ctx)                    // floors = upkeep (mandatory) + discretionary; reserve floor; sink keep
  for (row of d.rows) apply(row)                                             // wages/rations purchases at zone prices; direct intervention/restructuring spend
  gov.upkeepFraction = unmetFraction(d)                                      // read by Administration degradation and polity step 5 same turn
  gov.ledger = L0 - Σ spent + taxCollected + stateTariffs + enterprises + seigniorage + borrowed            // never negative; this turn's taxes land for NEXT turn's spending
}
```
Mint (Event): `mint(metal q, fineness f)` converts Refined Precious Metals to coin face value `F = q * baseMetalValue / f`; `coinage.supply += F`;
issuer record `fineness[issuer] = weightedAverage(...)` (derived record of its mint events); seigniorage = `F - q*baseMetalValue`. Domestic coin is legal tender at face value; between issuers by fineness.
Rituals: commitment above `labourThreshold` of Meteomancy/Theurgy + Processed Reagents consumed from warehouses, sustained `duration` turns; on completion apply `effect` (`{path:'crisis.epidemicBurden', region, op:'add'|'mul'|'set', value}`) once.

### 5. Economics — contribution, pools, Teaching, warehouses

```js
const poolScarcity = (ctx, pool) => (totalLabour(ctx) / Math.max(1, labourOf(ctx, pool))) ** T('contrib.beta') / meanScarcity(ctx)    // rarer pools worth more; applied to every pool
const contribution = (ctx, c) => marketOutputValue(c) * poolScarcity(ctx, mainPool(c))                                                   // output valued at base_value (not live price)
                               + needSatisfactionDelivered(c)               // military: scales with live war Questions; Culture/Clergy: grievance relieved
                               + teachingMarginalFlow(c) + ritualAuthoredPrice(c)   // retraining as a FLOW; ritual = authored relative price x rituals performed
function teaching(ctx, cell) {                // moves actual labour toward the Estate Labor Profile at the Teaching rate
  const target = pool => cell.laborProfile[pool] * cell.population
  capacity = poolLabour(cell, 'Teaching') * T('teach.rate') * nationAffinityBias(cell)
  for (pool of poolsBelowTarget sorted by deficit) { move = min(capacity, deficit); taken pro rata from pools above target; capacity -= move }   // target-pool-specific; no direct conversion
  // permanent loss: Σ_country labour[pool] == 0 -> unreachable unless teachers imported (LaborMigrationBan gates)
}
function warehouses(ctx) { for (w of stocks) { over = max(0, total - capacity); spoil(over, goods[g].decayRate perishable | decayRate*T('wh.slowFactor')); if (unrest) theft(over) } }
```
Administrative envelope: `produceCCO` as in `modules__spec`; unmet upkeep multiplies each pool's contributed C/C/O by `(1 - unmetFraction_pool)`, `unmetFraction_pool` taken from the spending-dial item attached to that pool.

### 6. Polity — grievance, compliance, opinion

```js
// shapes: Need = ruleset.needs[id] = {class:'existential'|'secondary', accum, decay, kind:'material'|'nonMaterial'|'fairness', axisLoads:{axis:sign}}
function updateGrievance(ctx, c) {
  for (n of needs) {
    shortfall = n.kind === 'material' ? 1 - c.satisfaction[n.tier]                        // from step-3 cascade
              : n.kind === 'fairness' ? clamp01(fairnessGap(ctx, c) * T('fair.scale')) + lossMods(c)       // gap > 0 only; entitlement-loss mods added as decaying part
              : 1 - c.delivered[n.id] / Math.max(T('eps.need'), c.target[n.id])                           // non-material channel delivered (Culture); Identity adds nonTitularCost
    if (n.id === 'identity_autonomy') shortfall += nonTitularCost(ctx, c) + suppressionCost(ctx, c)
    shortfall += warHarm(ctx, c, n) + occupationGrievance(ctx, c, n)
    c.grievance[n.id] = clamp01(c.grievance[n.id] * (1 - n.decay) + n.accum * clamp01(shortfall))   // leaky accumulator: existential fast-in/slow-out, secondary slow-in/fast-out (class sets accum/decay)
  }
}
const voluntary01   = (ctx, c) => sigmoid(T('opinion.k') * opinionGov(ctx, c))
const involuntary01 = (ctx, c) => 1 - Math.exp(-controlGrant(ctx, c) / (T('compliance.controlPerCapita') * c.population))       // Control from the Allocation Dial result
const compliance01  = (ctx, c) => ({voluntary: voluntary01(ctx, c), involuntary: involuntary01(ctx, c), total: Math.min(1, voluntary01(ctx, c) + involuntary01(ctx, c))})
const opinionGov = (ctx, c) => T('opinion.perf') * (meanSatisfaction(c) - T('opinion.satNeutral'))     // performance
                             - T('opinion.align') * distance(effectivePref(c), observedPortrait(ctx, c))   // alignment; observed = action record filtered by awareness
                             + sumMods(c.opinionGovMods)                                              // attributed discontent, benefits, Persuasion, mobility reactions, requisition hits
```
Attribution (Decision Log read, per observer = the cell):
```js
function readDecisionLog(ctx) {
  for (h of ctx.harmQueue) {                      // actions' apply() pushes {cell, logId, magnitude} for any harm they cause
    vis = causalVisibility(ctx, h.cell, logEntry(h.logId))      // public -> recency-decayed 1 ; covert -> per-observer detection tiers (undetected 0 / act detected / sender revealed)
    k = attributability(awareness(ctx, h.cell), vis)            // awareness gates ATTRIBUTION, never suffering
    if (h.kind === 'war') k = k ** T('attr.warSteepness') ;     // enemy blamed by default; Government only when very obviously incompetent
    if (awareness(ctx, h.cell) < T('attr.lowAwareness')) redirect(h, nearestVisibleAuthority(ctx, h.cell) ?? 'fate')   // Local Jurisdiction holder or Faith
    else push(c.opinionGovMods, {value: -h.magnitude * k, decay: {kind:'exp', rateKey:'opinion.modDecay'}, source: h.logId})   // incompetent-government modifier arises the same way
  }
}
```
Intent is never modelled; blunders, engineered crises and wars share this path.

### 7. Polity — Questions, factions, momentum, cell decisions

```js
const questions = ctx => cells.flatMap(c => needs.filter(n => c.grievance[n.id] > compliance01(ctx, c).total)
    .map(n => ({key: `${c.key}|${n.id}`, cell: c.key, need: n.id, gap: c.grievance[n.id] - compliance01(ctx, c).total, tier: tierOf(ctx, c, n)})))     // independent of the Government slate
const tierOf = (ctx, c, n) => n.class === 'existential' && gap > T('tier.existential') ? 'existential' : gap > T('tier.structural') ? 'structural' : 'routine'
function computeFactions(ctx, qs) {              // issue = need; derived per Question-time, never persisted
  for (issue of groupBy(qs, q => q.need)) {
    for (estate of estates) {                    // 1 merge across Nations, unless Opinion(Estate, NationPair) crosses fracture threshold on the issue's axes
      groups = fractureIfOpinionBelow(cellsOf(estate, issue), T('faction.fracture'))   // sub-faction Weight = proportional split of parent Weight
    }
    blocs = clusterByAlignment(groups, issue.axisLoads, T('faction.align'))             // per Nation, cross-Estate partial coalitions; FULL-Nation bloc only if all Estate cells share the goal
    for (b of blocs) b.stance = stanceSum(b, issue) ; b.coordCost = T('bloc.cost') * spread(b) / concentration(b)   // paid by member cells' Coordination (capacity from awareness inputs + Council/Petition + organizing pools)
  }
}
function updateMomentum(ctx, q, prevRung) {
  const key = q.key, m0 = ctx.state.polity.momentum[key] ?? 0
  const attn = attentionGate(ctx, q.cell, q)     // finite cell Coordination across live Questions by severity: affects RISE only
  const m = m0 * (1 - T('mom.decay')) + attn * T('mom.rise') * q.gap          // rises fast, decays slowly; while Question lapsed: m0*(1-decay) only
  ctx.state.polity.momentum[key] = m
  return rungOf(m, prevRung)
}
const rungOf = (m, prev) => max(r ∈ 0..R such that m >= T('rung.enter')[r] || (prev >= r && m >= T('rung.exit')[r]), default 0)    // banded hysteresis; enter[r] > exit[r]; existential shocks may skip rungs (large rise)
// bloc acts at Weight-aggregated momentum of members; members below the bloc's rung do not participate
function decideCellActions(ctx) {                // at step 2, from LAST turn's cached rungs
  for (c of cells) {
    options = registry.listFor({kind:'cell', key: c.key}, ctx).filter(a => a.minRung <= rungOf(c))     // permitted ∪ granted (held Right) ∪ defiance (capability only)
    best = argmax(options, a => stance(c, a, ctx, cellStanceFns)) ; if (best && stance > 0) yield instantiate(best)
  }
}
const cellStanceFns = { selfInterest: (c, a, ctx) => expectedRelief(ctx, c, a) - cost(ctx, c, a) / Math.max(1, c.wealth),     // relief = Σ weighted grievance reduction on a.addresses
                        modifier:     (c, a, ctx) => 1 + T('stance.align') * Σ_axis sign(a.axisLoads[axis]) * effectivePref(c, axis) }   // Preference alignment
// Defiance and 'forbidden but permitted' acts are scaled by (1 - involuntary01(c)); a cell with no available action only accumulates grievance and migrates.
```
Alpha uses leaderless factions; ownership of the full action-choice rule is AI-Econ/Internal Politics — this default is replaceable behind `decideCellActions`.

### 8. Polity — entitlement, prestige, Preferences, mobility

```js
const prestige = (ctx, c) => Σ_r ruleset.rights[r].prestigeWeight * rightScore(ctx, c, r) - Σ_d ruleset.duties[d].prestigeWeight * dutyBurden(ctx, c, d) + sumMods(c.prestigeMods)
const weight = (ctx, c) => c.population * Math.max(T('eps.prestige'), prestige(ctx, c))
const acceptance = (ctx, c, a) => clamp01(T('acc.w0') + T('acc.crisis') * crisisSeverity(ctx, a.addresses)        // from live Question state, never stored
                                         + T('acc.exposure') * c.grievance[a.addresses]                            // faction's OWN exposure
                                         + T('acc.burden') * (1 - burdenShare(ctx, c, a))                          // cell cost relative to others' sacrifice
                                         - T('acc.alt') * visibleAlternatives(ctx, c))                             // unspent Ledger above reserve, untouched cheaper levers
const lossDecay = (ctx, mod) => crisisLive(ctx, mod.source) ? T('loss.decay.live')
                              : restored(ctx, mod.source)   ? T('loss.decay.restored')        // fast
                              :                               T('loss.decay.inForce')          // slowest: emergency measure remains without a live crisis
function propagandaStep(ctx, p) {                   // commitment: directs finished Culture/Print/Teaching output (zero-sum with ordinary use); Government draws on Coordination
  for (c of targets(p)) for (axis of axes) {
    push = T('prop.rate') * directedOutput(p) / c.population * Math.sign(p.ideal[axis] - effectivePref(c, axis))
    push(c.pref[axis], {value: push, decay: {kind:'exp', rateKey:'pref.modDecay'}})             // fast, needs sustained spend; |mod| <= T('pref.modRange') (range able to cross baseline sign)
  }
  education: c.pref[axis].baseline += T('edu.rate') * teachingDirected(p) * (p.ideal[axis] - baseline)   // slow, durable
}
// Estate Mobility: per cell pair in same (Nation, Region): eligible if Prestige(dest) - Prestige(origin) <= maxCoverableGap; moved = scalar * eligiblePop per turn; permanent; origin opinionGov mod +, destination mod - (both target Government)
// Demotion: netPosition(c) = wealth + claims - obligations < 0 -> population moves to the cell with the Prestige gap closest below; coercive: Control gain, heavy opinion mod
// Convergence: per (Nation, Region) pair when rights AND duties distance == 0 -> merge cells (population-weighted labour profile); declared (gated) or estate-forced (an ordinary Question); reversible via later drift
```
Government amalgam, Government-to-Government standing, Foreign Standing: see `modules__spec.md` §2. Questions/factions/slate lag one turn: factions use last turn's rung, the slate (step 6) is for NEXT turn.

### 9. TUNE catalogue (all `placeholder`; defaults only so a first playable runs)

| Key | Placeholder | Key | Placeholder |
|---|---|---|---|
| `eps.modifier` | 0.0001 | `eps.need` | 0.01 |
| `eps.infra` | 0.05 | `eps.prestige` | 0.05 |
| `prod.k` | 1.0 | `prod.alpha` | 0.85 |
| `prod.theta` | 1.5 | `scar.eps` | 1.0 |
| `scar.min` / `scar.max` | 0.25 / 4 | `scar.elasticity` | 0.8 |
| `flow.share` | 0.5 | `flow.friction` | 0.05 |
| `zone.capBase` | 100 | `money.kappa` | 1.0 |
| `credit.lendFraction` | 0.5 | `credit.r0` | 0.02 |
| `credit.eta` | 0.7 | `debt.arrearsLimit` | 0.5 |
| `contrib.beta` | 0.5 | `teach.rate` | 0.02 |
| `wh.slowFactor` | 0.25 | `fair.scale` | 1.0 |
| `opinion.k` | 3 | `opinion.perf` | 2 |
| `opinion.satNeutral` | 0.7 | `opinion.align` | 1 |
| `opinion.modDecay` | 0.1 | `compliance.controlPerCapita` | 0.001 |
| `attr.warSteepness` | 4 | `attr.lowAwareness` | 0.2 |
| `tier.existential` / `tier.structural` | 0.5 / 0.2 | `faction.fracture` | -0.3 |
| `faction.align` | 0.6 | `bloc.cost` | 1 |
| `mom.rise` | 0.5 | `mom.decay` | 0.1 |
| `rung.enter` | [0.2, 0.5, 0.9, 1.4] | `rung.exit` | [0.1, 0.35, 0.7, 1.1] |
| `stance.align` | 0.5 | `stance.approve` | 0 |
| `acc.w0` | 0.1 | `acc.crisis` / `acc.exposure` | 0.5 / 0.3 |
| `acc.burden` / `acc.alt` | 0.2 / 0.2 | `loss.decay.live` / `.restored` / `.inForce` | 0.05 / 0.3 / 0.02 |
| `prop.rate` | 0.1 | `pref.modRange` | 2 |
| `pref.modDecay` | 0.1 | `edu.rate` | 0.01 |

## Rules

0. Needs (data, `ruleset.needs`): material `subsistence`(existential), `comfort`, `luxury`; non-material `identity_autonomy`(existential), `solidarity`(existential), `purpose_meaning`, `faith_cosmology`, `security`, `excellence`, `superiority`, `pleasure`; `fairness` (secondary by default).
1. Laws (Rights, Duties, Requisitions) are scoped entries per Country; per-cell values are derived with the shared scope rules (state: most specific wins; amount: additive).
2. Economics order is fixed (production → Land split → Requisition → cascade → taxation → debt service → credit clearing → Ledger); Government purchases use the start-of-turn balance.
3. Prices, scarcity, trade zones, flows' gaps and contribution are derived each pass; only `currentFlow` per edge and stocks persist.
4. Delivered duty = claimed × involuntary compliance; Wealth and Ledger never go negative; debts exist only as obligation records.
5. Grievance, compliance and satisfaction are 0..1; a Question exists whenever `grievance > compliance`, independent of the slate.
6. Attribution = harm × attributability(awareness × causal visibility); war harm blames the enemy unless the Government's role is very obviously incompetent; intent is never modelled.
7. Momentum is cached per (cell, need) with banded hysteresis; factions are derived per issue and never persisted; cells act at step 2 from last turn's rung.
8. Propaganda directs finished output (fast, modifier stack); Teaching education moves the baseline (slow); no spend API on stacks.
9. Every number is a `ctx.T` key from §9; changing balance never changes code.

## Cross-references
`modules__spec.md` (class diagrams, other modules) · `kernel_engine__spec.md` (allocation, stacks, gating) · `scenario_schemas__spec.md` (where `tuning`, `needs`, `goods`, `rights` live) · kb: Economics, Internal Politics, Administration, Actions.

## Status
- **Settled in kb, encoded**: all orders, derived-vs-stored, cell-level action classes, acceptance inputs, attribution shape, hysteresis, requisition effects, credit/price shape.
- **Confirmed by designer**: 0..1 scale; labour spread by presence share.
- **(spec decision)**: production planning rule (labour follows value added; planning-posture blend), extraction pool per raw good, processing at zone level, laws stored per Country, greedy credit matching, auto-default after arrears limit, `harmQueue`/`polityQueue` hand-offs between steps, government inventory for requisitioned goods, formula shapes in §2-§8.
- **Confirmed by designer 2026-11-04**: the 8 psychological needs (adds security, excellence, superiority, pleasure to Identity/Autonomy, Solidarity, Purpose/Meaning, Faith/Cosmology); extraction pools = existing 19 where they fit, **placeholder pools** otherwise; production-planning rule; abstract Government inventory.
- **Spec consequences**: `ruleset.needs` gains `security, excellence, superiority, pleasure`; `ruleset.pools` gains placeholder pools `Fishing` and `Reagent Gathering` (flag `placeholder: true`) — raw goods map: Agriculture ← Grain, Livestock, Fine Horses, Fiber, Wool, Hides, Herbs; Mining ← Stone, Iron Ore, Precious Metal Ore, Coal, Sulfur, Salt; Woodcraft ← Timber; Fishing(placeholder) ← Fish; Reagent Gathering(placeholder) ← Magical Reagents.
- **Confirmed 2026-11-04**: the Portrait-axis pairings below for the four new needs. **Note**: how the four new psychological needs are fed (the kb names inputs only for Identity/Autonomy, Purpose/Meaning via Culture delivery and Fairness). Spec default: each is `nonMaterial` with its own `target` and Culture-channel delivery and `axisLoads` — security ← Ruthlessness↔Restraint & Conservatism, excellence ← Extraction↔Investment & Reformism, superiority ← Homogenizing↔Pluralist & Ruthlessness, pleasure ← Luxury-tier satisfaction. Please correct the pairings; they are data, not code.

- **Implemented 2026-11-04 (runnable subset, `src/modules/economics`, `src/modules/polity`, 10 tests)**: extraction with diminishing returns, zone processing by value added, Land split, Requisition (delivered × involuntary compliance, into Government inventory), hill-climb trade zones, price pass with capped cross-zone flows and a second scarcity pass, tier-first cascade under a cash limit, taxation, debt service with auto-default, greedy credit clearing, spending dial vs start-of-turn Ledger, grievance accumulator, compliance, Questions (iff grievance > compliance), momentum with banded rungs.
- **Details fixed while implementing (now spec)**: a cell's `cash = salesValue + wealth × cash.wealthFraction`; `wealth' = wealth + sales − purchases − tax` (never negative); `cellZone` = zone of the Region province where the cell's Nation is most present; `labourCommitted[pool]` is the claim taken off production by the pool split; `satisfaction[tier]` = mean over the tier's items of bought/needed; `shortfall` (credit demand) = unmet subsistence value; `polity.rung` is a persisted `@cache` alongside `momentum`. New tuning keys: `yield.baseline`, `yield.timberPerForest`, `cash.wealthFraction`, `credit.reservePerCap`, `aware.base`, `aware.k`.
- **Not yet implemented (specified above)**: processing planning-posture blend, warehouse spoilage/theft, Teaching, Mint, rituals, Land-share bookkeeping tests, factions, cell action choice, attribution beyond the basic path, Mobility/Demotion/Convergence, propaganda.
- **Refinements found by running the demo (now spec, 2026-11-04)**: (1) a pool's labour is **split across the raw goods it can extract in a province** by `(yield × base value × live scarcity)^prod.theta` — without this every good received the full pool and labour piled into goods nobody wanted; live scarcity is derived this turn from stock and *derived demand*, nothing is stored. (2) **Derived demand**: final consumption is propagated backward through recipes, net of stock, giving `need[zone][good]`; processing runs are capped by need and inputs, and labour is allocated by **water-filling** (weights = value added with live value, caps = need/inputs, leftovers redistributed) from one labour budget per zone and pool shared across tiers (no double counting). This keeps the confirmed rule "labour follows value added" but with live prices and demand. (3) Raw output enters zone stock before processing, and tiers run semi → light → heavy → transport so chains complete within a turn. (4) Consumption items with alternatives (`Bread|Preserved Food`, `Coal|Lumber`) pick the cheapest alternative **that is on the market**. (5) Trade-zone gravity is smoothed (own pull + half of each neighbour's) with a deterministic tie-break, otherwise equal terrain fragments into one zone per province.

- **Implemented 2026-11-05 (`src/modules/polity/behaviour.js`, `actions.js`; 7 behaviour tests)**: real gating (cells holding `Veto.<domain>` judge the action with the shared stance function: `acceptance + relief − cost`, modifier = Preference alignment), force-through with entitlement-loss modifiers that decay through the context-read `lossDecay`, acceptance (crisis from live Questions, own exposure, burden share, visible alternatives), cell action choice (`permitted` / `granted` / `defiance`, rung-gated; chosen by the stance skeleton, scaled by `1 − involuntary compliance` when a law forbids), cell actions `petition`, `taxRefusal`, `hoard` (covert), `buildTradeInfra`, derived factions (Estate groups merge across Nations unless Preference vectors are far apart; cross-Estate blocs by alignment; Weight-aggregated momentum), hoarding withholds raw goods and releases them when it stops, trade infrastructure decays without upkeep. Not implemented: Mobility, Demotion, Convergence, propaganda/Teaching, factions acting as blocs (they are a readout), Council (consulted, non-blocking) — Veto only.
