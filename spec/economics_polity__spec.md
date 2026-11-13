# Internal Politics — Detailed Specification (file keeps its old name until the Internal Politics bootstrap)

Status: first detailed pass (2026-11-04); **trimmed 2026-11-13**: the Economics sections (old §2–§5, the Economics rules and tuning keys) moved to `economics__spec.md`. What remains is the Internal Politics part (laws, grievance, compliance, Questions, factions, entitlement, prestige, Preferences, mobility). The kb ↔ spec mirror (`Sync:` block) for `internal_politics__kb.md` is pending; then this file should be replaced by `internal_politics__spec.md`. Source: `internal_politics__kb.md`, `administration__kb.md`, `actions__kb.md`. The kb fixes *rules and order*; formulas are open until the numbers pass, so every formula here is a **(spec decision)** with its numbers in `ruleset.tuning` as `placeholder` (catalogue in §9). Shared scale (confirmed): grievance severity, compliance and need satisfaction are per-cell values in **[0,1]**.

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

### 2–5. Economics — moved to `economics__spec.md`.

### 6. Polity — grievance, compliance, opinion

```js
// shapes: Need = ruleset.needs[id] = {class:'existential'|'secondary', accum, decay, kind:'material'|'nonMaterial'|'fairness', axisLoads:{axis:sign}}
function updateGrievance(ctx, c) {
  for (n of needs) {
    shortfall = n.kind === 'material' ? 1 - c.satisfaction[n.tier]                        // from step-3 cascade
              : n.kind === 'fairness' ? clamp01(fairnessGap(ctx, c) * T('fair.scale')) + lossMods(c)       // gap > 0 only; entitlement-loss mods added as decaying part
              : 1 - c.delivered[n.id] / Math.max(T('eps.need'), c.target[n.id])                           // non-material channel delivered (Culture); Identity adds nonTitularCost
    if (n.id === 'identity_autonomy') shortfall += nonTitularCost(ctx, c) + suppressionCost(ctx, c)
    shortfall += warHarm(ctx, c, n) + occupationGrievance(ctx, c, n)                                    // warHarm = the cached derived war-attributable value (war__spec.md, War Exhaustion)
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
Alpha uses leaderless factions; ownership of the full action-choice rule is AI-Econ/Internal Politics — this default is replaceable behind `decideCellActions`. (In code the choice runs through each cell type's `propose`/`utility`/`minRung`: `actions__spec.md`, Cell actions.)

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

### 9. TUNE catalogue (Internal Politics keys; all `placeholder`; Economics keys: `economics__spec.md`)

| Key | Placeholder | Key | Placeholder |
|---|---|---|---|
| `eps.modifier` | 0.0001 | `eps.need` | 0.01 |
| `eps.prestige` | 0.05 | `fair.scale` | 1.0 |
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
2–4. (Economics rules: moved to `economics__spec.md` Rules.)
5. Grievance, compliance and satisfaction are 0..1; a Question exists whenever `grievance > compliance`, independent of the slate.
6. Attribution = harm × attributability(awareness × causal visibility); war harm blames the enemy unless the Government's role is very obviously incompetent; intent is never modelled.
7. Momentum is cached per (cell, need) with banded hysteresis; factions are derived per issue and never persisted; cells act at step 2 from last turn's rung.
8. Propaganda directs finished output (fast, modifier stack); Teaching education moves the baseline (slow); no spend API on stacks.
9. Every number is a `ctx.T` key from §9 (and the Economics catalogue); changing balance never changes code.

## Cross-references
`economics__spec.md` (production, prices, credit, Ledger) · `modules__spec.md` (class diagrams, other modules) · `kernel_engine__spec.md` (stacks, stance) · `actions__spec.md` (allocation, gating, cell actions) · `administration__spec.md` (Control/Observation, slate) · `war__spec.md` (`warHarm` cache, exhaustion) · `scenario_schemas__spec.md` (where `tuning`, `needs`, `goods`, `rights` live) · kb: Internal Politics, Economics, Administration, Actions.

## Status
- **Settled in kb, encoded**: cell-level action classes, acceptance inputs, attribution shape, hysteresis, requisition effects (polity side).
- **Confirmed by designer**: 0..1 scale; labour spread by presence share; (2026-11-04) the 8 psychological needs (adds security, excellence, superiority, pleasure to Identity/Autonomy, Solidarity, Purpose/Meaning, Faith/Cosmology) and their Portrait-axis pairings: security ← Ruthlessness↔Restraint & Conservatism, excellence ← Extraction↔Investment & Reformism, superiority ← Homogenizing↔Pluralist & Ruthlessness, pleasure ← Luxury-tier satisfaction (data, not code). Each new need is `nonMaterial` with its own `target` and Culture-channel delivery and `axisLoads`.
- **(spec decision)**: laws stored per Country, `harmQueue`/`polityQueue` hand-offs between steps, formula shapes in §6–§8.
- **Spec consequences**: `ruleset.needs` gains `security, excellence, superiority, pleasure`.
- **Implemented 2026-11-04 (runnable subset, `src/modules/polity`, tests in `tests/econ_polity.test.js`)**: grievance accumulator, compliance, Questions (iff grievance > compliance), momentum with banded rungs; `polity.rung` is a persisted `@cache` alongside `momentum`; `shortfall` (credit demand) = unmet subsistence value (Economics side); new tuning keys `aware.base`, `aware.k`.
- **Implemented 2026-11-05 (`src/modules/polity/behaviour.js`, `actions.js`; 7 behaviour tests)**: real gating (cells holding `Veto.<domain>` judge the action with the shared stance function: `acceptance + relief − cost`, modifier = Preference alignment), force-through with entitlement-loss modifiers that decay through the context-read `lossDecay`, acceptance (crisis from live Questions, own exposure, burden share, visible alternatives), cell action choice (`permitted` / `granted` / `defiance`, rung-gated; chosen by the stance skeleton, scaled by `1 − involuntary compliance` when a law forbids), cell actions `petition`, `taxRefusal`, `hoard` (covert), `buildTradeInfra`, derived factions (Estate groups merge across Nations unless Preference vectors are far apart; cross-Estate blocs by alignment; Weight-aggregated momentum). Not implemented: Mobility, Demotion, Convergence, propaganda/Teaching directed output, factions acting as blocs (they are a readout), Council (consulted, non-blocking) — Veto only.
- **Not yet implemented (specified above)**: factions as acting blocs, attribution beyond the basic path, Mobility/Demotion/Convergence, propaganda.
- **Pending**: kb ↔ spec bootstrap (`Sync:` blocks) and the rename to `internal_politics__spec.md`; Internal Politics code status verification (`convergence.js`, `mobility.js`, `demotion.js`, `remaining.js`, `propaganda.js` exist in `src/modules/polity/` and are not covered by this file's older Status).
