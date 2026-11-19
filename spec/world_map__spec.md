# World Map — Specification

KB: `kb/world_map__kb.md`. Mirror of its `##/###` headings; cross-references live in kb only. Bootstrapped 2026-11-14 from kb rev 1 and `src/`; Region capital and Reorganization Event added 2026-11-17; migration, settlement, direct resettlement and Expulsion (slice 3b) added 2026-11-19. Sources: `src/modules/worldmap/{hex,regions,reorg,actions,population,migration,module}.js`, `src/data/loaders/buildState.js`, `src/modules/war/graph.js`, `src/modules/economics/step.js` (extraction), `src/modules/polity/transfer.js` (`transferCohort`), `tests/{worldmap,population,worldmap_reorg,worldmap_migration}.test.js`; scenario schema `scenario_schemas__spec.md` §2 and generator `worldgen__spec.md` (not re-read). Where code and the old `modules__spec.md` text disagree, **code wins** (**code-led**; the World Map text there is superseded). Anything the kb does not state is **(spec decision)**; the four decisions of 2026-11-14 (regions store with capital and its two events, the `settle`/`directResettlement`/`expel` shapes, the migration pull formula, interpolation of the anchors) are **confirmed 2026-11-14** (one shape detail of the two region events changed on 2026-11-17: capitals named inside the ops, **confirmed 2026-11-18**); the field-name mapping is not yet confirmed; not-yet-written code is **(target)**.

## Data Structures

State and conventions:
```js
state.world = { grid: {w, h, orientation, rawW, rawH, rawCellPx}, hexes /*raw terrain samples, shape not verified*/,
                provinces: Record<provId, Province>, edges: Record<edgeKey, Edge>,
                regionSnapshot: {assignment: Record<provId, regionId>, next: number, owners: Record<regionId, countryId>},
                regions?: Record<regionId, {capital: provId}>,                 // stored administrative setting (2026-11-17); absent = the fallback below
                pendingReorg?: {country, ops}[],                               // queued Reorganization Events, applied and emptied at step 8 (2026-11-17)
                pendingMoves?: PendingMove[] }                                  // queued settle / resettle / expel orders, applied and emptied at step 8 (2026-11-19)
// PendingMove = {kind: 'settle', cell: cellKey, province, amount} | {kind: 'resettle' | 'expel', country, params: {scope, province, share?, confiscate?}}
state.economy.warehouses[p], state.economy.tradeInfra[p]        // Economics-owned stocks keyed by province (not on the Province record in state)
ids: province `p:x,y` (provId), hex `h:x,y` (hexId; raw grid), region `r<n>`, edge `${a}~${b}` with a < b (edgeKey)
worldmap derive (ctx.derive.worldmap.*): regionProvinces(region), regionOwner(region), regionCapital(region), presence(p, nation), cellProvShare(key, p), neighbors(p)
T = ctx.T            // every number is a tuning key
```

### Grid
Code: `worldmap/hex.js` (`ODDR`, `neighbors`, `sideTo`, `distance`, `hexId`, `provId`, `parseId`, `inGrid`)
```js
// pointy-top, odd-r offset; side index 0=E 1=NE 2=NW 3=W 4=SW 5=SE; neighbours clipped to the grid
neighbors(x, y, w, h) -> [{x, y, side}]      distance(a, b) via cube coordinates (hex steps)
ctx.derive.worldmap.neighbors(p) = neighbours that exist in state.world.provinces
```
- 25×20 at alpha is scenario data (`grid.w`/`grid.h`), not a code constant; nothing in code asserts "exactly 500 provinces" (every hex a province, water included) — the validator/generator own that invariant.
- Tests: `tests/worldmap.test.js` (neighbour symmetry, distance 1, corner and interior neighbour counts).

### Province (hex)
Code: `state.world.provinces[id]` built from `world.json` by `buildState` (copied as is); consumers across modules
```js
Province = {x, y, terrain, forestation, habitability: 'Wasteland'|'Claimed/Frontier'|'Settled', waterSource: 'river_adjacent'|'coastal'|'none',
            maxArea, maxArableArea, maxPopulationDensity, population, urbanization, sanitation, infrastructureLevel, tradeInfrastructureLevel,
            owner: CountryId|null, settlementName?, resourceOverrides?: Record<good, mult>, provenance}
// kb name → code field: terrain_type→terrain, max_population_density→maxPopulationDensity, current_population→population, urbanization_rate→urbanization,
//   sanitation_level→sanitation, water_source→waterSource, habitability_state→habitability, infrastructure_level→infrastructureLevel
```
- Not in the record (**not in code**): `water_body`, `cataclysm_status` (post-alpha). `tradeInfrastructureLevel` is the scenario seed of Economics' stock (copied into `state.economy.tradeInfra`; **distinct from** `infrastructureLevel`, Rule 9).
- **Consumers verified**: `terrain`, `forestation`, `habitability` (Economics extraction, `worldmap/population.js`, **and since 2026-11-19 `worldmap/migration.js`, the only runtime writer: Wasteland → Claimed/Frontier → Settled**), `maxPopulationDensity`×`maxArea` (density ceiling in `stepPopulation` and in every move), `owner` (Regions, War, Diplomacy), `population` (kept equal to Σ presence), `resourceOverrides` (extraction), `infrastructureLevel` (War supply; see `war__spec.md`). **No consumer found** for `urbanization` and `sanitation` (awareness input and epidemic burden are targets in Internal Politics/Exogenous shocks).

### Terrain Types (10)
Code: scenario `ruleset.terrain` (**9 keys, no Sea**: `data/ruleset.json` has no `Sea`); `worldmap/hex.js` (`edgePassable`), `worldmap/migration.js` (`canSettle`)
- **(code-led)** the ruleset and `scenario_schemas__spec.md` §2 still describe 9 terrains: Sea, `water_body` (sea | lake), `capability.settleSea`/`settleLake` and `traversal.Sea`/`Lake` (kb 2026-11-09/10) are **not in data**; water provinces, lake hexes and the 500-province grid exist only in the kb. `traversal` is not checked in code. **Since 2026-11-19 one runtime check exists**: `canSettle(ctx, p)` is false for `terrain === 'Sea'` unless `ruleset.capability.settleLake` (when `province.waterBody === 'lake'`) or `settleSea` is truthy, so migration, settlement and forced moves already refuse water once the data has it (the flag names follow the kb; `waterBody` is the spec decision's field name, slice 3c).
- Wasteland yields nothing (`extract` returns 0) and does not grow (`stepPopulation` skips provinces with `habitability === 'Wasteland'`); this is how unsettled water will behave once Sea exists (target: terrain `Sea`, `waterBody` field, flags in `ruleset.capability`/`ruleset.traversal`, `traversal` checked in `war/graph.js`). Ownership of unsettled water (kb open): default not owned; `deriveRegions` already gives unowned provinces no Region.
- Terrain is fixed for all of alpha: nothing writes `terrain` at runtime.

### Forestation
Code: scenario data `province.forestation` (0–100), `ruleset.terrain[t].forestMin/forestMax` (checked by the editor/schema), consumers `economics/step.js` (`resourceYield`: Timber), `war/graph.js` (movement block)
```js
forestation ∈ [forestMin(terrain), forestMax(terrain)]          // validated at authoring (schema `check`), static at runtime
Timber yield = T('yield.timberPerForest') × forestation          // independent of the favor table (economics__spec.md)
war: forestation ≥ T('war.forest.block') and no `forest_movement` trait → the edge into that province is not traversable   // (code-led, war/graph.js)
```
- Arable and density ceilings are the data `arableCeiling` and `popDensityCeiling` per terrain (placeholders); Grassland's forestation ceiling is open (kb).

### Starting population (worldgen anchors, 2026-11-10)
Code: none in runtime (generation-time only: `editor/generators.js`, `worldgen__spec.md`)
- Target: the generator seeds a Settled province's `population` from `anchor(terrain)` — Grassland ≈ 10,000, Taiga/Mountain ≈ 1,000, other land terrains interpolated by `popDensityCeiling` **(spec decision, confirmed 2026-11-14)**, Sea/lake 0, Frontier/Wasteland lower (open). The kb states the concrete numbers in `data/`/`scenarios/` and worldgen code were **not** changed, so the anchors are not applied yet. At runtime population is only dynamics (below).

### Resource Extraction
Code: `economics/step.js` (`extract`, `resourceYield`), `ruleset.terrain[t].favor`
```js
yield(g) = T('yield.baseline') + (ruleset.terrain[terrain].favor[g] ?? 0)          // Timber: T('yield.timberPerForest') × forestation;  × (province.resourceOverrides?.[g] ?? 1)
```
- Full formula and extraction pools: `economics__spec.md` (Warehousing section). The favor table is `ruleset.terrain.<terrain>.favor` data (kb multipliers; Fish for Arctic "coastal only" and Sea Fish are **not enforced in code**).

### Edges (not hex attributes)
Code: `state.world.edges` (`{a, b, type, fortress, bridge?}` keyed by `edgeKey`), `worldmap/hex.js` (`edgeKey`, `edgePassable`), `war/graph.js`
```js
edgeKey(a, b) = a < b ? `${a}~${b}` : `${b}~${a}`
edgePassable(a, b, edges, terrainOf) = !(terrain a === 'Mountain' && terrain b === 'Mountain') || edges[edgeKey(a, b)]?.type === 'mountain_pass'      // Mountain↔non-Mountain open
```
- Types in data: `river`, `mountain_pass`, `sea_lane`; `fortress` and `bridge` booleans on the edge. War reads them for crossing cost, bridge removal and siege-required passage (`war__spec.md`); Economics trade edges are a separate graph (zones, `economics__spec.md`).
- **Not verified** here: river crossing costs, sea-lane routing through water provinces and the naval scope (War). Tests: the Mountain interior rule in `tests/worldmap.test.js`. Migration ignores edge types (it follows province adjacency only; **(spec decision)**, the kb says "along existing edges" without a cost).

### Population dynamics (settled shape 2026-11-02)
Code: `worldmap/population.js` (`stepPopulation`, `growthFactor`), `worldmap/migration.js` (`stepMigration`, `moveCohort`, `planForcedMove`, `applyPendingMoves`, `queueMove`, `settleProposal`/`settleUtility`/`checkSettle`, `canSettle`, `scopeFor`), `worldmap/actions.js` (`settle`, `directResettlement`, `expel`), all run at step 8 from `worldmap/module.js`. **Migration part written 2026-11-19, tests written the same day and not yet run.**
```js
step8 order: stepPopulation (growth) → stepMigration (derived pull) → applyPendingMoves (queued settle / resettle / expel) → queued Reorganizations → ownership re-derivation
delta(cell) = cell.population × T('pop.growth') × f;  f = subsistence < 1 ? subsistence − 1 : comfort           // in [-1, +1], from last step-3 satisfaction
growth: placed over the Region's habitable provinces by the Nation's presence (water-filled), capped by each province's density ceiling (maxPopulationDensity × maxArea); decrease removes pro rata to presence
the change is mirrored into province.population and state.nations.presence; the cell's free labour scales by the same factor (committed labour neither breeds nor starves)
```
- Epidemic burden (sanitation × urbanization × Medicine) is **not in code**.
- **The one move primitive** `moveCohort(ctx, cell, amount, q, {take?, confiscate?, gov?})` (**spec decision**): moves up to `amount` people of the cell's Nation into province `q`. `amount` is capped by the cell's population and by the room at `q` (density ceiling; `Infinity` without `maxArea`/`maxPopulationDensity`); they are taken from the provinces named in `take` (`{prov: weight}`) or, by default, from the cell's Region by the Nation's presence (never from `q`), each capped by its presence. `q` must belong to a Region and pass `canSettle`. The Nation's `presence` and the province `population` are mirrored; when `q` lies in another Region the cell hands over `frac = moved / cell.population` through `polity/transfer.js` `transferCohort` (population, wealth, `labour`/`labourCommitted`/`hoard` pro rata, grievance blended population-weighted, debts follow the cohort) into the cell `nation|estate|region(q)`, **created if missing** (zero stocks, `pref` and `laborProfile` copied from the source, so migrants keep their Nation and Estate). Within one Region only presence and province stock move. `confiscate` (Expulsion) first takes that share of the moving cohort's `wealth` into `gov.ledger` and of its `hoard` goods into `gov.inventory`. Afterwards `promote(q)` runs.
- **Settlement states** (**spec decision**): a province with `habitability: 'Wasteland'` that reaches `population ≥ T('settle.frontierMin')` becomes `'Claimed/Frontier'`; a Frontier province reaching `T('settle.settledMin')` becomes `'Settled'` (absolute people; no reverse step yet). Frontier provinces grow (`stepPopulation` skips only Wasteland). Only **owned** provinces of a Region can be settled: a province without owner has no Region, so no cell could hold the migrants (claiming unowned land is not modelled).
- **Gradual migration** (`stepMigration`, derived, nothing stored; the pull formula is **confirmed 2026-11-14**, the two readings below are **spec decisions, pending OK**):
```js
regionSat(r, n) = Σ growthFactor(c)·pop(c) / Σ pop(c)  over the cells of Region r owned by Nation n (all cells of r when n has none; 0 when r has none)      // in [-1,+1]; province-level satisfaction does not exist, cells are per Region
pull(p→q, n)    = regionSat(region(q), n) + (q not 'Settled' ? T('mig.frontierPull') : 0) − regionSat(region(p), n)
flow(p→q, n)    = presence[p][n] × T('mig.rate') × pull × autonomy(region(p), n)        if pull > 0, else 0
autonomy(r, n)  = share of n's population in r living in cells whose `MovementAutonomy` Right is not false       // a Right forbidding movement blocks gradual migration; forcing is the resettlement Event
```
  for every ordered pair of adjacent provinces `p`, `q` where `q` is in a Region and passes `canSettle`; a `LaborMigrationBan` (`derive.diplomacy.laborMigrationBanned(owner p, owner q)`, absent derive = no ban) between different owners blocks the pair. All flows are computed from the state at the start of the pass, scaled so a province gives no more than its presence of that Nation, then applied in sorted order, each capped by the presence left and the room at `q`. Between provinces of one Region the pull is zero except toward unsettled provinces, so migration is a Region-to-Region and a frontier effect. Cross-Region flows split over the Nation's Estate cells of the origin Region by population (`moveCohort` with `take = {p: 1}`).
  - **`T('mig.frontierPull')` is new (spec decision)**: without it nothing would ever flow into an unsettled province of the same Region (settlement route 1 of the kb would be dead). Placeholder 0.1.
- **Settlement routes** (kb): (1) gradual migration, above. (2) **cell action `settle`** (spec decision, confirmed shape 2026-11-14: `cellAvailability: 'permitted'`, `minRung: 1`, class event, public, no gate): `propose` = the unsettled (not `'Settled'`) owned province of the cell's own Country in or next to the cell's Region that passes `canSettle` (Frontier before Wasteland, then by id) with `amount = population × T('settle.cohort')`; null when the `Settlement` Right is false for the cell. `utility = T('settle.crowdK') × crowding − T('settle.costPerCap') × amount / max(1, wealth)`, where `crowding = clamp01(Σ population / Σ density ceiling)` over the Region's non-Wasteland provinces (0 when ceilings are unbounded). `validate` = `checkSettle` (cell exists, amount > 0, `Settlement` not forbidden, province owned by the cell's Country, not Settled, receivable). `apply` queues `{kind: 'settle', cell, province, amount × scale}`; **step 8** re-validates, charges `min(wealth, T('settle.costPerCap') × amount)` from the cell's `wealth` (a sink, like `buildTradeInfra`; refunded when nothing could move) and calls `moveCohort`. (3) **Government**: (3b) **`directResettlement`** below; (3a) the **free-colonization policy** (incentive spend) is **not in code**: lifting the restrictions is already possible with `reformRightsDuties` (`Settlement`, `MovementAutonomy`), the incentive part needs a commitment lifecycle decision (see Status).
- **Direct resettlement and Expulsion** (event types `directResettlement` and `expel`, class event, public, gate domain `administration` **(spec decision: the ruleset has no `Veto.movement` domain; the confirmed shape of 2026-11-14 said "Movement/Veto")**; shapes confirmed 2026-11-14):
```js
directResettlement { scope, province, share? = 1 }                   // the target is a province of the actor's Country
expel              { scope, province, share? = 1, confiscate? = 0 }  // the target is a province of ANOTHER Country that borders the actor's territory
planForcedMove(ctx, country, kind /* 'resettle' | 'expel' */, params) -> {ok, reasons, moves: [{cell, amount}], total, capped}      // pure dry run, the preview
  covered cells = cells of the actor's Country with population > 0 and `covers(scope, key, scopeFor(ctx, country))` (any shared scope kind: cell, nationRegion, estateRegion, estate, nation, region, empire, group)
  amount per cell = share × population, handed out in cell-key order until the room at the target is used up (`capped` says it was)
  rejected: unknown province or scope, share ∉ (0,1], confiscate ∉ [0,1], target not in a Region or not receivable, (resettle) target not the actor's, (expel) target owner missing or the actor itself,
            target not bordering the actor's territory, a LaborMigrationBan binds the two Countries, nobody to move
apply: queueMove → state.world.pendingMoves;  step 8: planForcedMove again on the then-current state (one that no longer holds is dropped whole), then moveCohort per cell
  expel: confiscate share of the moved cohort's wealth and hoard goods → the Government (`gov.ledger`, `gov.inventory`); the destination Country's cell takes the rest
  opinion: each source cell that moved people gets `opinionGovMods` −T('force.opinionHit') × share (expel: always, share counted as it was ordered; resettle: only where `MovementAutonomy` is not false)      // the cells' own entitlement loss
  expel: for every Country whose `titularNations` include a moved Nation (other than the actor): `services.diplomacy.grantCB(kin, actor, 'Rights', 'expulsion-of-kin', T('cb.mag.expel'))`      // the kin-state appeal; absent service = none
  gating: `impact(ctx, a, key)` = cost for covered cells (expel 1; resettle `share` where the Right is held), relief 0; a forced act passes the Control path and the engine records the holders' entitlement loss
  Decision Log: the entry is public by default; `axisLoads` of `expel` = {ruthlessness_restraint: −1, homogenizing_pluralist: −1} (the Portrait reads it), `directResettlement` none
```
- Placeholder keys (new 2026-11-19): `mig.rate` 0.02, `mig.frontierPull` 0.1, `settle.frontierMin` 20, `settle.settledMin` 500, `settle.cohort` 0.05, `settle.costPerCap` 0.5, `settle.crowdK` 1, `force.opinionHit` 1.5, `cb.mag.expel` 1. **After adding them run `npm run build:data`** (a turn reads `mig.rate` in step 8).
- Tests: `tests/population.test.js` (growth, bounds, invariants; names not re-verified); `tests/worldmap_migration.test.js` (2026-11-19, **not yet run**: the pull and its invariants, autonomy and `LaborMigrationBan` blocks, promotion and the water flag, `settle`, planning and executing a resettlement, Expulsion with confiscation, opinion hit and kin CB, a resettlement through a real turn, a queued order that stopped holding, determinism, the step-8 wiring).

### Region (administrative region, 2026-11-09)
Code: `worldmap/regions.js` (`deriveRegions`, `splitShares`, `splitCell`, `mergeCells`, `RECORDS`, `EXTENSIVE`), `worldmap/reorg.js` (`applyReorg`, `retargetLaws`, `regionCapitalOf`), `worldmap/actions.js` (`reorganizeRegions`, `setRegionCapital`), `worldmap/module.js` (`step8`, `rekeyCells`, derive `regionCapital`)
```js
deriveRegions(world:{w,h}, owners: Record<provId, country|null>, prev, {target: 7, minSize: 6, maxSize: 8}) -> {assignment, regions: Record<rid, {owner, provinces}>, next}
  1 keep previous Regions that are still whole, same-owner and contiguous (snapshot-and-drift: ids stay stable)
  2 leftover components smaller than minSize join an adjacent kept Region of the same owner if it stays ≤ maxSize
  3 other components: k = n < 2·minSize ? 1 : min(⌊n/minSize⌋, max(⌈n/maxSize⌉, round(n/target))); farthest-point seeds, round-robin flood fill, then rebalance to 6–8 while keeping parts contiguous
  unowned provinces (incl. all water today) get no Region; ids r<n>; deterministic (sorted iteration)
step8 (ONE pass at end of turn): stepPopulation → stepMigration → applyPendingMoves → queued Reorganization Events (below) → if some assigned province's owner differs from its Region's recorded owner: re-derive;
  both paths re-key every polity cell with rekeyCells(ctx, oldAssignment, newAssignment): shares[newRegion] = Σ presence share of the cell's Nation over its old provinces; splitCell(cell, shares) or mergeCells; remap momentum/rung (max over parts); regionSnapshot replaced
splitCell: EXTENSIVE ['population','wealth'] and RECORDS ['labour','labourCommitted','hoard'] split pro rata; intensive fields (grievance, opinion, pref stacks, momentum) copied
mergeCells: extensive summed; grievance population-weighted; other intensive fields taken from the first cell (code-led)
```
- **Region capital (kb 2026-11-10, in code 2026-11-17)**: stored administrative setting `state.world.regions[rid].capital`, always a province of the Region; never derived, no gameplay effect yet.
```js
regionCapitalOf(w, region) = stored capital if it is still a province of the Region, else the most populous province of the Region (ties by id; null for an empty Region)      // the kb's proposed fallback; derive `worldmap.regionCapital(region)`
setRegionCapital {region, province}  (class dial, no gate, public): valid iff the Region exists, is owned by the actor's Country and `province` belongs to it; writes world.regions[region].capital at once
```
  Nothing writes capitals for a Region created by the automatic ownership re-derivation (the fallback stands until the player or AI sets one: kb "re-set whenever a split or merge leaves a Region without a valid capital", AI selection rule open).
- **Reorganization Event (kb, in code 2026-11-17)**: event `reorganizeRegions {ops}` (class event, gate domain `administration` = every Veto holder of the Country, public); `validate` dry-runs `applyReorg` on the state (a bad order is rejected with its reasons, never thrown); `apply` queues `{country, ops}` in `world.pendingReorg`; **step 8 applies each queued event once** (re-validated against the then-current state; one that no longer holds is dropped whole).
```js
ops: [ {kind:'split', region, parts: [{provinces: provId[], capital}, ...≥2]}              // the parts partition the Region exactly, each contiguous, capital ∈ its part; every part gets a new id
     | {kind:'merge', regions: [a, b], capital}                                           // adjacent (some province of a borders some province of b), same owner; one new id
     | {kind:'move',  province, to, fromCapital?, toCapital?} ]                            // province leaves its Region for the adjacent Region `to`; the donor keeps ≥ 1 province and stays contiguous; ids unchanged
// every Region touched must belong to the actor's Country; ops apply in order on a copy of the snapshot, later ops may use ids created by earlier ones
// a move of the province that is the donor's STORED capital must name `fromCapital` (∈ the donor's remaining provinces); capitals of split/merge results are required, in the op
applyReorg(w, country, ops) -> {ok, reasons, assignment, next, owners, capitals, gone, targets}      // pure; targets(oldRegion) = the live Regions that took its place ([self] if it still exists)
step8: rekeyCells (stocks split/sum by presence share, Rule 7) → retargetLaws → capitals of results stored, ids that disappeared deleted from world.regions → regionSnapshot replaced
retargetLaws(law, res): for every Right/Duty/Requisition entry whose scope names a Region that no longer exists, the entry is copied to each Region that took its place (scope.region replaced; scope kinds cell, nationRegion, estateRegion, region);
  entries that collide on the same scope after a merge: Rights/Duties keep the later `declaredTurn`, Requisitions keep the larger `amount` (spec decision)
```
- **(spec decision, 2026-11-17, deviates from the 2026-11-14 shape; confirmed 2026-11-18)** the capital of every resulting Region is named **inside its op** (`parts[i].capital`, `merge.capital`, `move.fromCapital`/`toCapital`) rather than in a `capitals: Record<rid, provId>` beside `ops`, because a new Region has no id at order time. The rest of the 2026-11-14 shapes stand.
- **Not in code**: the self-interest side of gating (the action's `impact` is zero, so only a Veto holder who would refuse for other reasons blocks it), entitlement loss for worsened laws (laws are re-pointed, not re-resolved and compared), re-pointing of Control/Observation dial targets and propaganda target scopes that name a removed Region (they stop covering it), the advisory development readout with banded enter/exit thresholds, the Region-assembly unit pointer (Administration), a **size limit** on player reorganizations (the kb calls 6–8 guidance, not a hard cap; the automatic derivation keeps whole Regions of any size), capitals for Regions created by ownership change.
- **(code-led, by reading — not tested)** the change test compares only the owners of provinces already in `assignment`, so a province newly owned from `null` (a settlement or claim) is not given a Region until some other assigned province changes owner; no code path creates such ownership yet. Slice 3b does not create it either (settlement is restricted to provinces that already have a Region).
- Tests: `tests/worldmap.test.js` (contiguity, same owner, 6–8 sizes, determinism, id stability under unrelated change; split by presence preserving totals; merge sums); `tests/worldmap_reorg.test.js` (2026-11-17, **green since 2026-11-18**: every op's accept/reject reasons, id chains, law re-pointing and collisions, capital fallback, a split through a real turn with cell, law and capital results).

### Megaregion (derived, scale-conditional)
Code: none (post-alpha scale, ~5000 provinces); nothing in code to instantiate it, nothing to remove.

### Water provinces and water source (substrate summary)
Code: `province.waterSource` is data (single-valued, stored); no derive recomputes it
- Precedence (river first; lake shore counts as `river_adjacent`, Sea-body contact `coastal`) is a generation/validation rule (`worldgen__spec.md`, editor validators; **not verified** here), not runtime code. Water provinces, sea-lane routing through them and the capability/traversal flags are **targets** (see Terrain Types).

## Rules
Code: per-rule notes
1. Terrain is data fixed at generation; forestation validated at authoring (schema `check`).
2. Yield = baseline + favor; Timber by forestation (`economics/step.js`).
3. Rivers, passes and sea lanes live in `state.world.edges` only.
4. Fortress is an edge flag consumed by War (no value generation in Economics).
5. `habitability === 'Wasteland'` yields nothing and grows nothing (extraction, `stepPopulation`).
6. Region membership: contiguous, same owner, derived over owned provinces; stored `regionSnapshot` changed by automatic re-derivation after an ownership change **or by a queued Reorganization Event (`applyReorg`)**, both once per turn at step 8.
7. Cell stocks split/sum by presence share (`splitCell`/`mergeCells`/`rekeyCells`, tested); a move of people between Regions uses the same pro-rata rule through `transferCohort`.
8. Megaregion: none.
9. `infrastructureLevel` and `tradeInfrastructureLevel` are separate fields/stocks (`state.economy.tradeInfra` for the latter).
10. No stored birth or migration rate: growth is derived (`growthFactor`), migration is derived from the Region satisfaction difference (`stepMigration`); settlement is gradual migration plus the `settle` cell action (in code) or the Government's direct resettlement (in code) and free-colonization policy (**not in code**); Expulsion is a gated Event (`expel`, in code); nothing stores a rate.
11. One Region pass at step 8 after population, once per turn (tested through `step8`; "after Diplomacy" = step 8 after step 7); migration and queued moves run between growth and the Reorganizations; reorganizations then ownership re-derivation; no banded development readout.
12. Cataclysm: none.
13. 500 provinces / Sea as terrain: not in data or code.
14. `waterSource` single-valued data.
15. Mountain interior edges blocked unless `mountain_pass` (`edgePassable`, used by `war/graph.js`, tested).
16. Sea/lake traversal and settlement flags: `canSettle` reads `ruleset.capability.settleSea`/`settleLake`; `traversal` not in code.
17. Starting population anchors: generation-time only; not applied.
18. `capital_province`: a stored setting (`world.regions[rid].capital`) set by `setRegionCapital` or by the capitals named in a Reorganization; always a province of its Region (an invalid stored value reads as the most-populous fallback); no gameplay effect.

## Status
- **Implemented and tested**: odd-r grid and distance, Mountain-edge rule, Region derivation (contiguity, size, determinism, id stability), split/merge by presence share, natural population growth with density ceiling and presence mirroring (test files: `worldmap.test.js`, `population.test.js`; names of the population tests not re-verified).
- **Implemented 2026-11-17, suite green since 2026-11-18**: Region capital (`regionCapitalOf`, derive `regionCapital`, `setRegionCapital`), the Reorganization Event (`applyReorg`, `retargetLaws`, `reorganizeRegions`, queue and application at step 8 through the refactored `rekeyCells`); registered in `src/modules/index.js` (`createRegistry`).
- **Implemented 2026-11-19, tests written the same day and not yet run** (revs below provisional): gradual migration (`stepMigration`), settlement (`moveCohort`, Wasteland → Frontier → Settled, the `settle` cell action), direct resettlement and Expulsion (`planForcedMove`, `directResettlement`, `expel`, the `pendingMoves` queue), the water capability check in `canSettle`. **New tuning keys: run `npm run build:data` first.** `registerWorldmapActions` now registers five types.
- **Implemented, no direct test**: `step8` re-keying through the ownership path, `regionOwner`/`cellProvShare`, forestation movement block in `war/graph.js`.
- **Not in code**: Sea/lake terrain, `water_body`, `traversal` flags and the 500-province grid (slice 3c), starting-population anchors, epidemic burden, the free-colonization policy (incentive spend), claiming unowned land, a reverse Settled → Frontier step, advisory development readout, Megaregion, `urbanization`/`sanitation` consumers, Fish "coastal only" rule; the Reorganization gaps listed under Region; the Government's self-interest side of gating for resettlement and Expulsion beyond `impact` (no Veto domain of its own).
- **Stale elsewhere**: `scenario_schemas__spec.md` §2 and `data/ruleset.json` list 9 terrains and no Sea; `modules__spec.md` World Map text is superseded by this file; `actions__spec.md` does not list `settle`, `directResettlement` and `expel` yet.
- **(code-led)**: Regions are re-derived automatically after an ownership change (snapshot-and-drift) and also changed by Reorganization Events; `mergeCells` keeps the first cell's intensive fields except grievance; the ownership-change test misses newly owned unowned provinces; ids `r<n>` assigned by derivation order and by `applyReorg` from the same `next` counter; presence and population are mixed freely in units (presence is only a weight in the fixtures, people in real data: a move treats them as the same unit).
- **(spec decision, confirmed 2026-11-14)**: `regions` store with `capital`, `reorganizeRegions`/`setRegionCapital` events, `settle`/`directResettlement`/`expel` event shapes, migration pull formula, interpolation of anchors by `popDensityCeiling`.
- **Confirmed 2026-11-18**: capitals named inside the ops.
- **(spec decision, 2026-11-17, pending OK)**: law re-pointing and collision rules; `world.pendingReorg`; a dropped event is dropped whole; impact zero (nominal gating).
- **(spec decision, 2026-11-19, pending OK)**: Region-level satisfaction as the province-level readout of the pull; the `mig.frontierPull` term; `MovementAutonomy` as a multiplier on gradual migration; the single move primitive and its capping rules; the promotion thresholds; settlement only on owned provinces; gate domain `administration` for the two Events; the opinion hit `force.opinionHit`; `settle`'s cost as a Wealth sink and its propose/utility; Expulsion's border requirement, `gov.ledger`/`gov.inventory` as the confiscation targets and the kin CB (`Rights`, `expulsion-of-kin`); everything queued and applied at step 8, not at step 2.
- **(spec decision, not yet confirmed)**: the kb → code field-name mapping on the Province record.
- **Open (kb)**: Grassland forestation ceiling; favor coefficients and Timber curve; Megaregion threshold; unsettled water ownership; Sea/lake Fish yield and Sea `water_source`; Sea Lane routing through lakes; Frontier/Wasteland seeds; capital gameplay effect and the AI's selection rule; birth-rate formula and migration numbers.
- **Tuning keys** (existing): `pop.growth`, `yield.baseline`, `yield.timberPerForest`, `war.forest.block`; (new 2026-11-19, placeholders): `mig.rate`, `mig.frontierPull`, `settle.frontierMin`, `settle.settledMin`, `settle.cohort`, `settle.costPerCap`, `settle.crowdK`, `force.opinionHit`, `cb.mag.expel`. `scenarios/alpha/tuning.defaults.json` is authoritative for values.
- **Sync:** (`<section> = <kb rev> / <code rev>`; `-` = no or insufficient code+tests; `1` = code and a test file present, names not re-verified; revs set on tests written but not yet run are provisional)
  - Data Structures > Grid = 1 / 1
  - Data Structures > Province (hex) = 1 / -
  - Data Structures > Terrain Types (10) = 1 / -
  - Data Structures > Forestation = 1 / -
  - Data Structures > Starting population (worldgen anchors, 2026-11-10) = 1 / -
  - Data Structures > Resource Extraction = 1 / -
  - Data Structures > Edges (not hex attributes) = 1 / -
  - Data Structures > Population dynamics (settled shape 2026-11-02) = 1 / 1
  - Data Structures > Region (administrative region, 2026-11-09) = 1 / 1
  - Data Structures > Megaregion (derived, scale-conditional) = 1 / -
  - Data Structures > Water provinces and water source (substrate summary) = 1 / -
  - Rules = 1 / -
