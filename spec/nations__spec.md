# Nations — Specification

KB: `kb/nations__kb.md`. Mirror of its `##/###` headings; cross-references live in kb only. Bootstrapped 2026-11-14 from kb rev 1 and `src/` (there is **no Nations module** in `src/modules/`: Nations is data in `state.nations`, read through `worldmap` derives and mutated by `worldmap/population.js`). Sources: `src/data/loaders/buildState.js`, `src/modules/worldmap/{module,population,regions}.js`, `src/modules/economics/teaching.js`, `src/modules/diplomacy/readouts.js`, `src/modules/war/internal.js`, `src/editor/generators.js`, `tests/population.test.js`, `tests/worldmap.test.js`; scenario schemas in `scenario_schemas__spec.md`, generator in `worldgen__spec.md`. Where code and the old `modules__spec.md` text disagree, **code wins** (**code-led**; the Nations text there is superseded). Anything the kb does not state is **(spec decision)** (pending OK); not-yet-written code is **(target)**. Shared scale: Sympathy, Foreign Standing and need satisfaction are values in [0,1] or signed modifiers as in Internal Politics.

## Data Structures

State and conventions:
```js
state.nations = { presence: Record<provId, Record<NationId, number /*people, not a share*/>>,
                  affinity: Record<NationId, Record<pool, number>> }               // copied from scenario `nations.json` by buildState
// scenario doc nations.json = { nations: Record<NationId, {name, color, reactionTemperament, poolAffinity, prefTraits}>, presence }   (scenario_schemas__spec.md)
// buildState copies only `presence` and `poolAffinity -> affinity`; name, color, reactionTemperament, prefTraits are NOT in `state` (editor/UI read the scenario docs)
ctx.derive.worldmap.presence(p, nation) = state.nations.presence[p]?.[nation] ?? 0
cell.nation = NationId on every polity cell (Actor = (Nation, Estate, Region))
T = ctx.T            // every number is a tuning key
```

### Nation
Code: `state.nations` keys; `cell.nation` (`polity/cellstate.js`); scenario `nations.json`
- A Nation is an id with data in the scenario document and the keys of `presence` and `affinity`; it has no territory and no statehood. Cells carry it as the first component of their key. Countries own statehood (`countries__spec.md`).
- **(code-led)** Name, colour, Reaction Temperament and Preference traits (`prefTraits`, keyed by the Portrait axes `extraction_investment`, `homogenizing_pluralist`, `fervor_secular`, `ruthlessness_restraint`, `conservatism_reformism`) are scenario data only; no `src/` consumer was found for `reactionTemperament`, and the seeding of cell preferences from `prefTraits` was **not verified** (`data/loaders`, `editor/generators.js`).
- Tests: Nation-keyed cells and presence are exercised throughout `tests/population.test.js` and `tests/worldmap.test.js` (test names not re-verified).

### Population Presence
Code: `state.nations.presence`; `worldmap/module.js` (`presence`, `cellProvShare`, `step8` split), `worldmap/population.js` (`stepPopulation`), `editor/generators.js` (`normalisePresence`)
```js
presence[p][n] = number of people of Nation n in province p                    // (code-led) a count, not a share; the share is derived
share(p, n) = presence[p][n] / Σ_m presence[p][m]                                // derived
invariant: Σ_n presence[p][n] ≈ province.population, tolerance 0.1% (the editor's normalisePresence rescales; stepPopulation keeps both in step)
cellProvShare(cellKey, p) = presence[p][nation] / Σ_{q ∈ regionProvinces(region)} presence[q][nation]   // falls back to 1/|provinces| when the Nation has no presence in the Region
stepPopulation (step 8, before the Region pass): delta = cell.population × pop.growth × f(satisfaction);  growth spreads over the Region's habitable provinces by presence (water-filled, capped by each province's density ceiling);  decrease removes pro rata to presence;  presence[p][n] and province.population move together
step8 Region split: for each cell, shares[newRegion] = Σ over its old provinces of presence share; cell stocks are split by splitCell(cell, shares) and merged by mergeCells (Nations supplies the numbers, World Map computes the split — Rule 9)
```
- Minority/diaspora are the same data at lower presence (several Nations per province).
- **(code-led)** presence changes only through natural growth (`stepPopulation`); migration, settlement and assimilation transfers are **not in code** (World Map's migration target; assimilation below).
- Tests: `tests/population.test.js` (growth, invariants, Region split) — test names not re-verified.

### Core (emergent, computed)
Code: none (target); worldgen uses a seeding version (`worldgen__spec.md` stage 10: `cores = farthestPointSampling`, presence share `exp(−d/λ) × arableScore`) that is generation-time only, not a runtime derive
```js
// target — Nations derive, never stored (Rule 1); formulas are (spec decision), coefficients numbers pass
coreStrength(n, p) = presence[p][n] × share(p, n) ^ T('core.shareExp')
influence(n, p)    = max over q of coreStrength(n, q) × exp(−dist(p, q) / T('core.lambda'))          // dist in hex steps (worldmap neighbours)
cores(n)           = local maxima of coreStrength over the province graph (several allowed, none stored)
```
- Consumers (all target): Assimilation Drift, the UI Cultural lens (`ui__kb.md`), Statehood Pathway preconditions, Diplomacy's `nationalism` CB uses presence directly (below), not cores.

### Titular Nation (set, settled 2026-11-02)
Code: `state.countries[c].titularNations: NationId[]` (no cap); consumers `diplomacy/readouts.js` (`activeCBs` nationalism, `closeness` kin); `war/internal.js` sets the titular of a seceded Country
```js
nationalism CB (structural, derived): holder's titularNations have presence share ≥ T('cb.nationalism.share') in some foreign province → {tier: 'Rights', reason: 'nationalism', class: 'structural'}
closeness kin: observer and victim share a titular Nation → T('closeness.kin')
secession (internal.js): Free Country gets titularNations = [the bloc's most populous Nation]
```
- **Not in code**: any way to change the set (**target**: `setTitularNations`, event, gate `autonomy-titular` Veto, public; **(spec decision)**), `titular_effects` (Prestige+ as a decaying modifier on that Nation's cells' `prestigeMods` on declaration; Identity+ only while the cultural need is delivered via the non-material channel) and `non_titular_cost ∝ size × concentration` (the old polity formula `nonTitularCost` is not in `polity/step.js`), forced change under dependency only when culture/language is a ceded axis (Countries).
```js
// target
nonTitularCost(cell) = !titular(country, cell.nation) ? T('titular.cost') × size(cell.nation, country) × concentration(cell.nation, country) : 0      // size = Nation population share in the Country, concentration = Σ_p presence share²
// adds to the Identity/Autonomy shortfall in updateGrievance (internal_politics spec)
```

### Sympathy (computed, not stored)
Code: none (target)
```js
sympathy(n, c) = baseNeedSatisfaction(n, c) + stack(state.nations.standing[`${n}>${c}`])      // stack: kernel/modifiers.js ModifierStack, decaying (Rule 5)
```
- The value is derived on read; the decaying modifier stack is the only stored piece (**(spec decision)**, same pattern as `diplomacy.leverage`). `baseNeedSatisfaction` (how well Country c serves Nation n's cultural needs: titular status, treatment of its cells there, delivered culture) and its coefficients are open (numbers pass); standing modifiers are pushed by events (treatment, support of a kin Nation).
- Per (Nation, Country) pair; nothing aggregates back (Internal Politics' Foreign Standing reads it as base; **not in code**, nor is the `derive.nations` service).

### Reaction Temperament
Code: scenario data only (`reactionTemperament` in `nations.json`); no `src/` consumer
- Target: a per-Nation scalar ≥ 0 that multiplies the **magnitude** of the standing modifiers a Nation takes from treatment events (never the influence decay by distance, Rule 6); other consumers (grievance accumulation of the Nation's cells) await the designer's OK.

### Nation pool affinity (settled 2026-11-02)
Code: `state.nations.affinity[nation][pool]` (from `poolAffinity`); `economics/teaching.js`
```js
Teaching deficit weight(pool) = deficit(pool) × (state.nations.affinity[nation]?.[pool] ?? 1)           // biases conversion toward the Nation's leanings (economics__spec.md, Teaching)
default labour profile bias: not in code (the scenario generator seeds laborProfile; affinity is applied there at most — not verified)
```
- Data on existing quantities, no new mechanic; no other non-political traits.

### Assimilation Drift
Code: none (target); reuses `polity/transfer.js` `transferCohort` once written
```js
// target; coefficients numbers pass
passiveDrift(cell) = T('assim.k') × f(sympathy(cell.nation, country), distance to the nearest core, cultural weight of the dominant local Nation)         // share of the cell moved per turn
active_policy ∈ suppress | accommodate | fund_culture | language_policy                                // new Country-level event types (spec decision): setAssimilationPolicy
on drift: moved = transferCohort(cell, dominantCell(sameEstate, sameRegion), share)                       // pro-rata stocks, as in the Region split; presence[p][from] −= moved × (share by province), presence[p][to] += same
          dominantCell.prefMods gain a decaying modifier toward the dominant Nation's preference (effectivePref shifts gradually)
suppress: mandatory Identity/Autonomy cost on the suppressed cell (suppressionCost, polity spec — not in code);  fund_culture: directs Culture/Teaching output (Economics non-material channel) and counteracts the drift
```
- No `setAssimilationPolicy` or equivalent exists in `src/`; the polity `suppressionCost` is not in `updateGrievance`.

### Statehood Pathway
Code: partial — the result side only: `war/internal.js` (Free Country from a rebel bloc), `diplomacy/actions.js` `recognizeBloc` (`state.diplomacy.recognition`)
```js
// target precondition (readout, derived): stateless Nation (not titular anywhere) + concentration ≥ T('state.conc') + sympathy toward its Country ≤ T('state.low') + internal pressure (live Question on identity_autonomy at the bloc's rung) → autonomy → independence
// code: a rebel bloc that wins (internal armed conflict, war__spec.md) forms `free-<bloc>` with titularNations = [its largest Nation], the parent's law copied, a new Government record
```
- The same event as Internal Politics' Faction rebellion and the recognition route (Rule 8); no autonomy step (an `autonomy-titular` Veto concession) and no readout of the preconditions exist yet.

### Placeholder world (alpha scenario seed — 2026-11-09)
Code: none — data; `scenarios/alpha/` currently holds only `tuning.defaults.json`, `scenarios/demo/` the demo (Vantirians, Kerin, Dornish)
- To author (target): `nations.json`, `countries.json`, `polity.json` for the five Countries of the kb table through the editor/worldgen (`scenario_editor__spec.md`, `worldgen__spec.md`). Axis mapping for `prefTraits` (+ = Pole A): Ruthlessness → `ruthlessness_restraint`, Conservatism → `conservatism_reformism`, Extraction → `extraction_investment`, Homogenizing → `homogenizing_pluralist`, Fervor → `fervor_secular`; Country-level baselines seed Estate cells' `pref` (Internal Politics: Preference vector). Estate recostumes (Overlords/Slaves, Burghers, Clergy…) are `polity.json` Estate configurations (`defaultRights`, `defaultDuties`, `laborProfile`).
- **Open (kb)**: Retlaytiland has no named Nation (the table shows "—"; a placeholder id is needed before authoring); Alatyr's terrain is unspecified; all values await the numbers pass.

## Rules
Code: per-rule notes
1. Cores are derived on read, never stored (target; no code).
2. Multiple cores per Nation: `cores(n)` = every local maximum (target).
3. Titular status is a Country policy: `titularNations` (set); no setter yet.
4. Sympathy is per (Nation, Country) pair (target).
5. Standing modifiers decay (ModifierStack; target).
6. Reaction Temperament scales magnitude only (target).
7. Assimilation = drift + active policy; suppression carries an Identity cost (target).
8. Statehood Pathway = Faction rebellion = recognition route: the result side exists (`war/internal.js`, `recognizeBloc`).
9. Region-fracture divisor: `presence` (code; `step8`, `cellProvShare`).
10. Several titular Nations; Identity bonus needs delivered culture (set exists; effects target).
11. Pool affinity biases Teaching (code); default labour profile bias not verified.
12. Assimilation transfers to the dominant Nation's cell of the same Estate and Region with pro-rata stocks (target).
13. Placeholder world is scenario data (not yet authored in `scenarios/alpha/`).

## Status
- **Implemented**: `state.nations` (presence, affinity); `presence`/`cellProvShare` derives; presence kept in step with province population by `stepPopulation`; Region split by presence share; Teaching weighted by affinity; titular set read by Diplomacy (nationalism CB, kin closeness); Free Country formation with a titular Nation.
- **Not in code**: Core/influence, titular effects and the non-titular cost, any titular setter, Sympathy and standing stack, Reaction Temperament, Assimilation Drift and its policies, Statehood Pathway readout and the autonomy step, migration/settlement presence changes, the `derive.nations` service, the five-Country scenario package, default labour profile bias from affinity.
- **(code-led)**: presence is a count and its share is derived; name/colour/temperament/`prefTraits` stay in the scenario docs; no Nation entity in state.
- **(spec decision)**: core and non-titular formulas and their keys, `standing` stack storage, `setTitularNations` and `setAssimilationPolicy` as new event types, `nations` derive service names.
- **Open (kb)**: core-strength and assimilation coefficients; standing-modifier decay rate; Retlaytiland's Nation; Alatyr's terrain; placeholder values.
- **Tuning keys** (placeholders, none in code yet): `core.shareExp`, `core.lambda`, `titular.cost`, `assim.k`, `state.conc`, `state.low`; existing keys used here: `pop.growth`, `cb.nationalism.share`, `closeness.kin`.
- **Sync:** (`<section> = <kb rev> / <code rev>`; `-` = no or insufficient code+tests; `1` = code and a test file present, names not re-verified)
  - Data Structures > Nation = 1 / 1
  - Data Structures > Population Presence = 1 / 1
  - Data Structures > Core (emergent, computed) = 1 / -
  - Data Structures > Titular Nation (set, settled 2026-11-02) = 1 / -
  - Data Structures > Sympathy (computed, not stored) = 1 / -
  - Data Structures > Reaction Temperament = 1 / -
  - Data Structures > Nation pool affinity (settled 2026-11-02) = 1 / -
  - Data Structures > Assimilation Drift = 1 / -
  - Data Structures > Statehood Pathway = 1 / -
  - Data Structures > Placeholder world (alpha scenario seed — 2026-11-09) = 1 / -
  - Rules = 1 / -
