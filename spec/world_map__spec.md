# World Map — Specification

KB: `kb/world_map__kb.md`. Mirror of its `##/###` headings; cross-references live in kb only. Bootstrapped 2026-11-14 from kb rev 1 and `src/`; Region capital and Reorganization Event added 2026-11-17; migration, settlement, direct resettlement, Expulsion (slice 3b) and free colonization added 2026-11-19; **the data model of slice 3c (Sea terrain, every hex a province, water capability and traversal) added 2026-11-27**. Sources: `src/modules/worldmap/{hex,regions,reorg,actions,population,migration,module}.js`, `src/data/loaders/buildState.js`, `src/data/{terrainRules,schemas/index,validators/index}.js`, `src/worldgen/{terrain,world}.js`, `src/modules/war/graph.js`, `src/modules/economics/step.js` (extraction), `src/modules/polity/transfer.js` (`transferCohort`), `tools/{buildRuleset,makeDemo}.mjs`, `tests/{worldmap,population,worldmap_reorg,worldmap_migration,slate_colonize,worldgen_terrain,worldmap_sea}.test.js`; scenario schema `scenario_schemas__spec.md` §2 (not re-read) and generator `worldgen__spec.md`. Where code and the old `modules__spec.md` text disagree, **code wins** (**code-led**; the World Map text there is superseded). Anything the kb does not state is **(spec decision)**; the four decisions of 2026-11-14 (regions store with capital and its two events, the `settle`/`directResettlement`/`expel` shapes, the migration pull formula, interpolation of the anchors) are **confirmed 2026-11-14** (one shape detail of the two region events changed on 2026-11-17: capitals named inside the ops, **confirmed 2026-11-18**); the 2026-11-19 decisions are **confirmed 2026-11-19** and now stand in the kb (Population dynamics rev 2, Rules rev 2); **the 2026-11-10 proposals (one Sea terrain with `water_body`, per-body flags, lake shore as river-adjacent, anchors interpolated by ceiling) were confirmed 2026-11-25/26 and the kb is at Starting population rev 2, Edges rev 2, Rules rev 3**; the field-name mapping is not yet confirmed; not-yet-written code is **(target)**.

## Data Structures

State and conventions:
```js
state.world = { grid: {w, h, orientation, rawW, rawH, rawCellPx}, hexes /*one per grid hex: {x, y, surface: 'land'|'sea'|'lake'}, the surface DERIVED from the province (2026-11-27)*/,
                provinces: Record<provId, Province>, edges: Record<edgeKey, Edge>,
                regionSnapshot: {assignment: Record<provId, regionId>, next: number, owners: Record<regionId, countryId>},
                regions?: Record<regionId, {capital: provId}>,                 // stored administrative setting (2026-11-17); absent = the fallback below
                pendingReorg?: {country, ops}[],                               // queued Reorganization Events, applied and emptied at step 8 (2026-11-17)
                pendingMoves?: PendingMove[] }                                  // queued settle / resettle / expel orders, applied and emptied at step 8 (2026-11-19)
// PendingMove = {kind: 'settle', cell: cellKey, province, amount} | {kind: 'resettle' | 'expel', country, params: {scope, province, share?, confiscate?}}
state.commitments: {..., type: 'freeColonization', actor: {kind: 'government', country}, params: {incentive}}      // the standing free-colonization policy (2026-11-19)
state.economy.warehouses[p], state.economy.tradeInfra[p]        // Economics-owned stocks keyed by province (not on the Province record in state); water provinces have no warehouse
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
- 25×20 at alpha is scenario data (`grid.w`/`grid.h`), not a code constant. **Every hex a province, water included (500)**: the generator writes it (`worldgen/world.js`) and the validators check it (`hexNoProvince`, `provinceCount`, `noHex`, `surfaceMismatch`, 2026-11-27); the engine itself still asserts nothing.
- Tests: `tests/worldmap.test.js` (neighbour symmetry, distance 1, corner and interior neighbour counts).

### Province (hex)
Code: `state.world.provinces[id]` built from `world.json` by `buildState` (copied as is); consumers across modules; schema `data/schemas/index.js`
```js
Province = {x, y, terrain, waterBody?: 'sea'|'lake' /*terrain Sea only*/, forestation, habitability: 'Wasteland'|'Claimed/Frontier'|'Settled', waterSource: 'river_adjacent'|'coastal'|'none',
            maxArea, maxArableArea, maxPopulationDensity, population, urbanization, sanitation, infrastructureLevel, tradeInfrastructureLevel,
            owner: CountryId|null, settlementName?, resourceOverrides?: Record<good, mult>, provenance}
// kb name → code field: terrain_type→terrain, water_body→waterBody, max_population_density→maxPopulationDensity, current_population→population, urbanization_rate→urbanization,
//   sanitation_level→sanitation, water_source→waterSource, habitability_state→habitability, infrastructure_level→infrastructureLevel
```
- `waterBody` is in the schema and the generated documents since 2026-11-27 (tests: `tests/worldmap_sea.test.js`); a water province is `terrain: 'Sea'`, `forestation 0`, `waterSource 'none'`, `owner null`, Wasteland, no population, density ceiling 0. Not in the record (**not in code**): `cataclysm_status` (post-alpha). `tradeInfrastructureLevel` is the scenario seed of Economics' stock (copied into `state.economy.tradeInfra`; **distinct from** `infrastructureLevel`, Rule 9).
- **Consumers verified**: `terrain`, `forestation`, `habitability` (Economics extraction, `worldmap/population.js`, `worldmap/migration.js`, the only runtime writer: Wasteland → Claimed/Frontier → Settled), `maxPopulationDensity`×`maxArea` (density ceiling in `stepPopulation` and in every move), `owner` (Regions, War, Diplomacy), `population` (kept equal to Σ presence), `resourceOverrides` (extraction), `infrastructureLevel` (War supply; see `war__spec.md`). **No consumer found** for `urbanization` and `sanitation` (awareness input and epidemic burden are targets in Internal Politics/Exogenous shocks). **Not run with water provinces**: economics, population and war were never run against a world with Sea provinces (see Status, risks).

### Terrain Types (10)
Code: `src/data/terrainRules.js` (**the single source**: `terrain` (ten keys incl. `Sea`), `capability`, `traversal`, `hexArea`, `densityScale`), written into `data/ruleset.json` by `tools/buildRuleset.mjs`; `worldmap/hex.js` (`edgePassable`), `worldmap/migration.js` (`canSettle`), `war/graph.js` (`landBlocked`)
```js
terrain.Sea = {forestMin: 0, forestMax: 0, arableCeiling: 0, popDensityCeiling: 0, water: true, favor: {Fish: 4 /*placeholder, kb open*/}}
capability = {settleSea: false, settleLake: false}                       // kb: in alpha no Nation can settle water, lakes included
traversal  = {Sea: {land: false, sea: true}, Lake: {land: false, sea: true}}   // land: false = armies on foot cannot enter; sea: true = ships and sea lanes (naval movement: not in code)
landBlocked(ctx, province) = province.terrain === 'Sea' && ruleset.traversal?.[province.waterBody === 'lake' ? 'Lake' : 'Sea']?.land === false      // used by stepAllowed (so findPath) and bfsDistance (supply)
canSettle(ctx, p) is false for terrain 'Sea' unless ruleset.capability.settleLake (waterBody 'lake') or settleSea is truthy
```
- **(spec decision, kb shape confirmed 2026-11-25/26)** one Sea terrain with `waterBody`, and the kb's `traversal.Sea = false` flags are objects here (`{land, sea}`) so ships can read the same table later; `capability` follows the kb's flag names. The validators require Sea in the ruleset (error `seaTerrain`) and check the water invariants of a world (`waterBody` present, unowned, no water source, no population unless the capability allows, a lake should be enclosed).
- **(code-led)** the committed `data/ruleset.json` and `scenario_schemas__spec.md` §2 predate this (9 terrains) until `npm run build:data` is run; the schema accepts `ruleset.capability`, `ruleset.traversal`, `terrain.water` and `province.waterBody` since 2026-11-27.
- Wasteland yields nothing (`extract` returns 0) and does not grow (`stepPopulation` skips provinces with `habitability === 'Wasteland'`); this is how unsettled water behaves. Ownership of unsettled water (kb open): the data keeps it unowned (validator warning `waterOwner` otherwise); `deriveRegions` gives unowned provinces no Region, so water never joins a Region.
- Terrain is fixed for all of alpha: nothing writes `terrain` at runtime.

### Forestation
Code: scenario data `province.forestation` (0–100), `ruleset.terrain[t].forestMin/forestMax` (checked by the editor/schema and by the validator `forestCeiling`), consumers `economics/step.js` (`resourceYield`: Timber), `war/graph.js` (movement block)
```js
forestation ∈ [forestMin(terrain), forestMax(terrain)]          // validated at authoring, static at runtime (Sea: 0)
Timber yield = T('yield.timberPerForest') × forestation          // independent of the favor table (economics__spec.md)
war: forestation ≥ T('war.forest.block') and no `forest_movement` trait → the edge into that province is not traversable   // (code-led, war/graph.js)
```
- Arable and density ceilings are the data `arableCeiling` and `popDensityCeiling` per terrain (placeholders); Grassland's forestation ceiling is open (kb).

### Starting population (worldgen anchors, 2026-11-10)
Code: `worldgen/terrain.js` (`DEFAULTS.anchors`, `buildProvinces`), `worldgen/world.js` (`anchorsOf`); generation-time only
```js
anchor(t) = t === 'Sea' ? 0 : max(250, 1000 + 9000 × (popDensityCeiling[t] − popDensityCeiling.Taiga) / (popDensityCeiling.Grassland − popDensityCeiling.Taiga))      // the ruleset's ceilings: Grassland 1.0, Taiga and Mountain 0.1
// Grassland 10,000; Taiga, Mountain 1,000; Wetland 6,000; Hill 5,000; Steppe 4,000; Jungle 3,000; Desert, Arctic 300 (the floor 250 is never reached)
```
- **Grassland carries ten times Taiga's people, in ceiling and in anchor (designer 2026-11-25)**: the ceilings in `terrainRules.js` are placeholders chosen by me (Mountain 0.1, Hill 0.5, Wetland 0.6, Steppe 0.4, Jungle 0.3, Desert and Arctic 0.03); the anchors follow them linearly (kb 2026-11-25 confirmed). The generator writes each province's `anchor` and `worldFromTerrain` leaves `population: 0`, Wasteland: **applying the anchors to Settled provinces is the settling stage, which needs Countries (target)**. At runtime population is only dynamics (below).

### Resource Extraction
Code: `economics/step.js` (`extract`, `resourceYield`), `ruleset.terrain[t].favor`
```js
yield(g) = T('yield.baseline') + (ruleset.terrain[terrain].favor[g] ?? 0)          // Timber: T('yield.timberPerForest') × forestation;  × (province.resourceOverrides?.[g] ?? 1)
```
- Full formula and extraction pools: `economics__spec.md` (Warehousing section). The favor table is `ruleset.terrain.<terrain>.favor` data (kb multipliers; Fish for Arctic "coastal only" is **not enforced in code**; Sea Fish is a placeholder that nothing reaches while water stays unsettled and Wasteland).

### Edges (not hex attributes)
Code: `state.world.edges` (`{a, b, type, fortress, bridge?}` keyed by `edgeKey`), `worldmap/hex.js` (`edgeKey`, `edgePassable`), `war/graph.js`
```js
edgeKey(a, b) = a < b ? `${a}~${b}` : `${b}~${a}`
edgePassable(a, b, edges, terrainOf) = !(terrain a === 'Mountain' && terrain b === 'Mountain') || edges[edgeKey(a, b)]?.type === 'mountain_pass'      // Mountain↔non-Mountain open
```
- Types in data: `river`, `mountain_pass`, `sea_lane`; `fortress` and `bridge` booleans on the edge. War reads them for crossing cost, bridge removal and siege-required passage (`war__spec.md`); Economics trade edges are a separate graph (zones, `economics__spec.md`).
- **Sea lanes (kb 2026-11-25, designer)**: the edges still exist with Sea provinces on the grid, and **a sea lane speeds up sea travel along the coast**. In code a `sea_lane` edge is only data (the validator checks its endpoints are coastal or Sea provinces; the renderer draws it dotted); **the speed-up and naval movement are targets** (a naval-movement number, kb open; ships read `traversal.*.sea`). Land armies ignore sea lanes. The generator does not write edges yet (rivers, passes and lanes are later stages).
- **Not verified** here: river crossing costs and the naval scope (War). Tests: the Mountain interior rule in `tests/worldmap.test.js`. Migration ignores edge types (it follows province adjacency only; **(spec decision)**).

### Population dynamics (settled shape 2026-11-02)
Code: `worldmap/population.js` (`stepPopulation`, `growthFactor`), `worldmap/migration.js` (`stepMigration`, `moveCohort`, `planForcedMove`, `applyPendingMoves`, `queueMove`, `settleProposal`/`settleUtility`/`checkSettle`, `canSettle`, `colonizeIncentive`, `scopeFor`), `worldmap/actions.js` (`settle`, `directResettlement`, `expel`, `freeColonization`, `liftFreeColonization`), all run at step 8 from `worldmap/module.js`. **Written 2026-11-19, kb rev 2 (the same day); tests written and not yet run.**
```js
step8 order: stepPopulation (growth) → stepMigration (derived pull) → applyPendingMoves (queued settle / resettle / expel) → queued Reorganizations → ownership re-derivation
delta(cell) = cell.population × T('pop.growth') × f;  f = subsistence < 1 ? subsistence − 1 : comfort           // in [-1, +1], from last step-3 satisfaction
growth: placed over the Region's habitable provinces by the Nation's presence (water-filled), capped by each province's density ceiling (maxPopulationDensity × maxArea); decrease removes pro rata to presence
the change is mirrored into province.population and state.nations.presence; the cell's free labour scales by the same factor (committed labour neither breeds nor starves)
```
- Epidemic burden (sanitation × urbanization × Medicine) is **not in code**.
- **The one move primitive** `moveCohort(ctx, cell, amount, q, {take?, confiscate?, gov?})` (**confirmed 2026-11-19**): moves up to `amount` people of the cell's Nation into province `q`. `amount` is capped by the cell's population and by the room at `q` (density ceiling; `Infinity` without `maxArea`/`maxPopulationDensity`); they are taken from the provinces named in `take` (`{prov: weight}`) or, by default, from the cell's Region by the Nation's presence (never from `q`), each capped by its presence. `q` must belong to a Region and pass `canSettle` (so never a water province: no Region, and the capability flags are false). The Nation's `presence` and the province `population` are mirrored; when `q` lies in another Region the cell hands over `frac = moved / cell.population` through `polity/transfer.js` `transferCohort` (population, wealth, `labour`/`labourCommitted`/`hoard` pro rata, grievance blended population-weighted, debts follow the cohort) into the cell `nation|estate|region(q)`, **created if missing** (zero stocks, `pref` and `laborProfile` copied from the source, so migrants keep their Nation and Estate). Within one Region only presence and province stock move. `confiscate` (Expulsion) first takes that share of the moving cohort's `wealth` into `gov.ledger` and of its `hoard` goods into `gov.inventory`. Afterwards `promote(q)` runs.
- **Settlement states** (**confirmed 2026-11-19**, thresholds are placeholders): a province with `habitability: 'Wasteland'` that reaches `population ≥ T('settle.frontierMin')` becomes `'Claimed/Frontier'`; a Frontier province reaching `T('settle.settledMin')` becomes `'Settled'` (absolute people; no reverse step yet). Frontier provinces grow (`stepPopulation` skips only Wasteland). Only **owned** provinces of a Region can be settled: a province without owner has no Region, so no cell could hold the migrants (claiming unowned land is not modelled).
- **Gradual migration** (`stepMigration`, derived, nothing stored; the pull formula **confirmed 2026-11-14**, the readings below **confirmed 2026-11-19**):
```js
regionSat(r, n) = Σ growthFactor(c)·pop(c) / Σ pop(c)  over the cells of Region r owned by Nation n (all cells of r when n has none; 0 when r has none)      // in [-1,+1]; province-level satisfaction does not exist, cells are per Region
pull(p→q, n)    = regionSat(region(q), n) + (q not 'Settled' ? T('mig.frontierPull') + T('colonize.pullK') × incentive(owner q) : 0) − regionSat(region(p), n)
flow(p→q, n)    = presence[p][n] × T('mig.rate') × pull × autonomy(region(p), n)        if pull > 0, else 0
autonomy(r, n)  = share of n's population in r living in cells whose `MovementAutonomy` Right is not false       // a Right forbidding movement blocks gradual migration; forcing is the resettlement Event
incentive(c)    = Σ params.incentive of c's Government `freeColonization` commitments, 0 when the Government's ledger is empty
```
  for every ordered pair of adjacent provinces `p`, `q` where `q` is in a Region and passes `canSettle`; a `LaborMigrationBan` (`derive.diplomacy.laborMigrationBanned(owner p, owner q)`, absent derive = no ban) between different owners blocks the pair. All flows are computed from the state at the start of the pass, scaled so a province gives no more than its presence of that Nation, then applied in sorted order, each capped by the presence left and the room at `q`. Between provinces of one Region the pull is zero except toward unsettled provinces, so migration is a Region-to-Region and a frontier effect. Cross-Region flows split over the Nation's Estate cells of the origin Region by population (`moveCohort` with `take = {p: 1}`).
  - **`T('mig.frontierPull')`** is the term that lets an unsettled province of the same Region fill at all (settlement route 1). Placeholder 0.1.
- **Settlement routes** (kb): (1) gradual migration, above. (2) **cell action `settle`** (confirmed shape 2026-11-14: `cellAvailability: 'permitted'`, `minRung: 1`, class event, public, no gate): `propose` = the unsettled (not `'Settled'`) owned province of the cell's own Country in or next to the cell's Region that passes `canSettle` (Frontier before Wasteland, then by id) with `amount = population × T('settle.cohort')`; null when the `Settlement` Right is false for the cell. `utility = T('settle.crowdK') × crowding − T('settle.costPerCap') × amount / max(1, wealth)`, where `crowding = clamp01(Σ population / Σ density ceiling)` over the Region's non-Wasteland provinces (0 when ceilings are unbounded). `validate` = `checkSettle` (cell exists, amount > 0, `Settlement` not forbidden, province owned by the cell's Country, not Settled, receivable). `apply` queues `{kind: 'settle', cell, province, amount × scale}`; **step 8** re-validates, charges `min(wealth, T('settle.costPerCap') × amount)` from the cell's `wealth` (a sink, like `buildTradeInfra`; refunded when nothing could move) and calls `moveCohort`. (3) **Government**: (3a) **`freeColonization`** and (3b) **`directResettlement`**, below.
- **Free colonization (standing commitment, kb and designer 2026-11-19)**: commitment `freeColonization {incentive > 0}` (Government actor only, class commitment, no gate, public, `costs()` `[]`, `axisLoads` none; `apply` pushes `{id, actor, type: 'freeColonization', claims: [], since, renew: true, params: {incentive}}` into `state.commitments`, like `propaganda`); event `liftFreeColonization {id}` removes one's own. Its effect lives in `stepMigration`: the pull toward an unsettled province of the Country rises by `T('colonize.pullK') × incentive` (the Settlement and Movement autonomy Rights are the lifted restrictions: `reformRightsDuties`), and **each settler who arrived in an unsettled province is paid** `min(ledger, moved × incentive × T('colonize.costPerSettler'))` from the Government's ledger to the arriving Nation's cells in that Region (by population; zero-sum, nothing is created). The policy lapses while the ledger is empty (incentive 0, no payment); it compels no one. Several commitments add up. **(spec decision, pending OK)**: payment per arrival rather than per turn, paid to the arriving cells, applies to gradual migration only (not to `settle`); units: `incentive` is wealth per settler divided by `colonize.costPerSettler`.
- **Direct resettlement and Expulsion** (event types `directResettlement` and `expel`, class event, public, gate domain `administration` **(confirmed 2026-11-19: the ruleset has no `Veto.movement` domain)**; shapes confirmed 2026-11-14):
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
- Placeholder keys (new 2026-11-19): `mig.rate` 0.02, `mig.frontierPull` 0.1, `settle.frontierMin` 20, `settle.settledMin` 500, `settle.cohort` 0.05, `settle.costPerCap` 0.5, `settle.crowdK` 1, `force.opinionHit` 1.5, `cb.mag.expel` 1, `colonize.pullK` 1, `colonize.costPerSettler` 1. **After adding them run `npm run build:data`** (a turn reads `mig.rate` in step 8).
- Tests: `tests/population.test.js` (growth, bounds, invariants; names not re-verified); `tests/worldmap_migration.test.js` (2026-11-19, **not yet run**: the pull and its invariants, autonomy and `LaborMigrationBan` blocks, promotion and the water flag, `settle`, planning and executing a resettlement, Expulsion with confiscation, opinion hit and kin CB, a resettlement through a real turn, a queued order that stopped holding, determinism, the step-8 wiring); `tests/slate_colonize.test.js` (2026-11-19, **not yet run**: free colonization pull, payment, lapse and lifting).

### Region (administrative region, 2026-11-09)
Code: `worldmap/regions.js` (`deriveRegions`, `splitShares`, `splitCell`, `mergeCells`, `RECORDS`, `EXTENSIVE`), `worldmap/reorg.js` (`applyReorg`, `retargetLaws`, `regionCapitalOf`), `worldmap/actions.js` (`reorganizeRegions`, `setRegionCapital`), `worldmap/module.js` (`step8`, `rekeyCells`, derive `regionCapital`)
```js
deriveRegions(world:{w,h}, owners: Record<provId, country|null>, prev, {target: 7, minSize: 6, maxSize: 8}) -> {assignment, regions: Record<rid, {owner, provinces}>, next}
  1 keep previous Regions that are still whole, same-owner and contiguous (snapshot-and-drift: ids stay stable)
  2 leftover components smaller than minSize join an adjacent kept Region of the same owner if it stays ≤ maxSize
  3 other components: k = n < 2·minSize ? 1 : min(⌊n/minSize⌋, max(⌈n/maxSize⌉, round(n/target))); farthest-point seeds, round-robin flood fill, then rebalance to 6–8 while keeping parts contiguous
  unowned provinces (all water provinces: `owner` null) get no Region; ids r<n>; deterministic (sorted iteration)
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
Code: `province.waterSource` is data (single-valued, stored); no derive recomputes it; the generator writes it (`worldgen/terrain.js`: river-adjacent first, a lake shore counts as river-adjacent, contact with a sea body is coastal); the validator checks water provinces (`worldmap_sea.test.js`)
- A water province (terrain Sea, `waterBody` sea or lake) is a province: it has a hex, a record, an `owner: null`, `waterSource: 'none'`, no Region, no warehouse and no presence (an empty record in the demo). **Lakes are small enclosed Sea bodies** (at most 3 hexes, not touching the grid edge: a generator rule, placeholders) and are not settleable in alpha (`capability.settleLake` false, as the kb says). Land armies cannot enter any water province (`traversal`); sea-lane routing and ships are targets. Precedence rule: river first (kb), applied by the generator, not by runtime code.

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
10. No stored birth or migration rate: growth is derived (`growthFactor`), migration is derived from the Region satisfaction difference (`stepMigration`); settlement is gradual migration plus the `settle` cell action or the Government's `freeColonization` standing commitment or direct resettlement (all in code); Expulsion is a gated Event (`expel`, in code); every move of people uses `moveCohort` and respects the destination's density ceiling; nothing stores a rate.
11. One Region pass at step 8 after population, once per turn (tested through `step8`; "after Diplomacy" = step 8 after step 7); migration and queued moves run between growth and the Reorganizations; reorganizations then ownership re-derivation; no banded development readout.
12. Cataclysm: none.
13. **Every hex of the grid is a province (500 at alpha), water included; Sea is the terrain of seas and lakes (`waterBody`); no Nation can settle it in alpha** — in data and generator since 2026-11-27 (validators `hexNoProvince`, `provinceCount`, `surfaceMismatch`, `waterBody`, `waterPop`); the engine asserts nothing at runtime.
14. `waterSource` single-valued data.
15. Mountain interior edges blocked unless `mountain_pass` (`edgePassable`, used by `war/graph.js`, tested).
16. **Land armies cannot enter water provinces (`landBlocked` from `ruleset.traversal`, in `stepAllowed`/`findPath` and the supply search); water cannot be settled (`canSettle` from `ruleset.capability`, both false in alpha); tested in `tests/worldmap_sea.test.js` with stubs.**
17. Starting population anchors: Grassland 10,000, Taiga and Mountain 1,000, the others by density ceiling; **written by the generator as `anchor` (`anchorsOf`), applied by the settling stage (target)**; Grassland's ceiling is ten times Taiga's.
18. `capital_province`: a stored setting (`world.regions[rid].capital`) set by `setRegionCapital` or by the capitals named in a Reorganization; always a province of its Region (an invalid stored value reads as the most-populous fallback); no gameplay effect.
19. **Sea lane edges exist with Sea provinces and speed up sea travel along the coast (kb 2026-11-25); in code only as edge data (validated, drawn); the speed-up and naval movement are targets.**

## Status
- **Implemented and tested**: odd-r grid and distance, Mountain-edge rule, Region derivation (contiguity, size, determinism, id stability), split/merge by presence share, natural population growth with density ceiling and presence mirroring (test files: `worldmap.test.js`, `population.test.js`; names of the population tests not re-verified).
- **Implemented 2026-11-17, suite green since 2026-11-18**: Region capital (`regionCapitalOf`, derive `regionCapital`, `setRegionCapital`), the Reorganization Event (`applyReorg`, `retargetLaws`, `reorganizeRegions`, queue and application at step 8 through the refactored `rekeyCells`); registered in `src/modules/index.js` (`createRegistry`).
- **Implemented 2026-11-19, tests written the same day and not yet run** (revs below provisional): gradual migration (`stepMigration`), settlement (`moveCohort`, Wasteland → Frontier → Settled, the `settle` cell action), direct resettlement and Expulsion (`planForcedMove`, `directResettlement`, `expel`, the `pendingMoves` queue), free colonization (`freeColonization`, `liftFreeColonization`, `colonizeIncentive`, payment in `stepMigration`), the water capability check in `canSettle`. **New tuning keys: run `npm run build:data` first.** `registerWorldmapActions` now registers seven types.
- **Implemented 2026-11-25/27 (slice 3c), tests written and run ONLY in my sandbox against stubs, not in the repository** (revs below provisional): the terrain generator (`worldgen/terrain.js`, 8 tests), **the data model**: `src/data/terrainRules.js` (ten terrains with Sea, `capability`, `traversal`, density ceilings with Grassland 10× Taiga), `buildRuleset.mjs` using it, the schema (`waterBody`, `terrain.water`, `capability`, `traversal`), the validators (every hex a province, water invariants, Sea required), `war/graph.js` `landBlocked`, the demo world in the new model (`makeDemo.mjs`: sea and lake are Sea provinces), `worldgen/world.js` (the `world.json` document from generated terrain, `anchorsOf`), the Sea colour in the renderer; tests `tests/worldgen_terrain.test.js` and `tests/worldmap_sea.test.js` (13 tests).
- **Implemented, no direct test**: `step8` re-keying through the ownership path, `regionOwner`/`cellProvShare`, forestation movement block in `war/graph.js`.
- **Not in code**: the 500-province alpha world package (the generator writes terrain, forestation, water source and capacities; owners, Nations and presence, Countries, edges, settlement and cell seeding are later stages; `tools/` has no alpha-world script), applying the starting-population anchors, naval movement and the sea-lane speed-up, epidemic burden, claiming unowned land, a reverse Settled → Frontier step, free-colonization payment for `settle` arrivals, advisory development readout, Megaregion, `urbanization`/`sanitation` consumers, Fish "coastal only" rule; the Reorganization gaps listed under Region; the Government's self-interest side of gating for resettlement and Expulsion beyond `impact` (no Veto domain of its own).
- **Risks to check first when the suite and `npm run headless` run** (also in the changelog of 2026-11-27): (1) trade zones — unowned water provinces pull only toward each other (`openness(null, null)` is 1), so each connected sea forms its own empty zone hub and `zoneEdges` gain edges between sea zones and land zones; (2) code that iterates `state.world.provinces` and assumes land (economics, population, war supply and occupation, the UI province card); (3) the Editor's map tools and generators (not read) still assume that a water hex has no province, and `tests/editor.test.js` may fail; (4) a test that counts the demo's provinces (140 now) or reads the old surface model; (5) a reduced test ruleset without Sea now fails the validator (`seaTerrain`).
- **Stale elsewhere**: `scenario_schemas__spec.md` §2 (9 terrains, the old water rules); `modules__spec.md` World Map text is superseded by this file; `actions__kb.md` may still list `freeColonization` under Economics; `data/ruleset.json` and the demo package in the repository are stale until `npm run build:data` is run and committed.
- **(code-led)**: Regions are re-derived automatically after an ownership change (snapshot-and-drift) and also changed by Reorganization Events; `mergeCells` keeps the first cell's intensive fields except grievance; the ownership-change test misses newly owned unowned provinces; ids `r<n>` assigned by derivation order and by `applyReorg` from the same `next` counter; presence and population are mixed freely in units (presence is only a weight in the fixtures, people in real data: a move treats them as the same unit).
- **(spec decision, confirmed 2026-11-14)**: `regions` store with `capital`, `reorganizeRegions`/`setRegionCapital` events, `settle`/`directResettlement`/`expel` event shapes, migration pull formula, interpolation of anchors by `popDensityCeiling`.
- **Confirmed 2026-11-18**: capitals named inside the ops.
- **(spec decision, 2026-11-17, pending OK)**: law re-pointing and collision rules; `world.pendingReorg`; a dropped event is dropped whole; impact zero (nominal gating).
- **Confirmed 2026-11-19 (designer: "Confirm all small choices")**: Region-level satisfaction as the readout of the pull; the `mig.frontierPull` term; `MovementAutonomy` as a multiplier on gradual migration; the single move primitive and its capping rules; the promotion thresholds; settlement only on owned provinces; gate domain `administration` for the two Events; the opinion hit `force.opinionHit`; `settle`'s cost as a Wealth sink and its propose/utility; Expulsion's border requirement, `gov.ledger`/`gov.inventory` as the confiscation targets and the kin CB (`Rights`, `expulsion-of-kin`); everything queued and applied at step 8; free colonization as a standing commitment.
- **Confirmed 2026-11-26 (designer: "I confirm all your propositions")**: the Sea terrain and water shapes of 2026-11-10 (one Sea terrain with `waterBody`, per-body flags, lake shore as river-adjacent, anchors interpolated by ceiling); the build choices of 2026-11-27 below are **proposed, awaiting OK**.
- **(spec decision, 2026-11-27, awaiting OK)**: `traversal` and `capability` as objects/flags in `terrainRules.js` (the kb has booleans); the density ceilings chosen by me (Grassland 1.0 … Desert/Arctic 0.03) and `densityScale` 200 / `hexArea` 100; lake rule (≤ 3 hexes, not touching the edge) and lake carving in the generator; the hex `surface` kept in the world document as a derived field; validators: water unowned (warn), `seaTerrain` an error; demo water provinces get an empty presence record and no warehouse; the Sea Fish favor of 4 as a placeholder.
- **(spec decision, 2026-11-19, pending OK)**: the details of the free-colonization payment (per arrival, to the arriving cells, gradual migration only, `incentive` units) and that it lapses with an empty ledger.
- **(spec decision, not yet confirmed)**: the kb → code field-name mapping on the Province record.
- **Open (kb)**: Grassland forestation ceiling; favor coefficients and Timber curve; Megaregion threshold; unsettled water ownership (the data keeps it unowned); Sea/lake Fish yield; the naval speed-up number; whether Sea Lanes cross lakes; Frontier/Wasteland seeds; capital gameplay effect and the AI's selection rule; birth-rate formula and migration numbers.
- **Tuning keys** (existing): `pop.growth`, `yield.baseline`, `yield.timberPerForest`, `war.forest.block`; (new 2026-11-19, placeholders): `mig.rate`, `mig.frontierPull`, `settle.frontierMin`, `settle.settledMin`, `settle.cohort`, `settle.costPerCap`, `settle.crowdK`, `force.opinionHit`, `cb.mag.expel`, `colonize.pullK`, `colonize.costPerSettler`. `scenarios/alpha/tuning.defaults.json` is authoritative for values; the terrain table, capability and traversal are not tuning keys (`src/data/terrainRules.js`).
- **Sync:** (`<section> = <kb rev> / <code rev>`; `-` = no or insufficient code+tests; `1` = code and a test file present, names not re-verified; revs set on tests written but not yet run are provisional)
  - Data Structures > Grid = 1 / 1
  - Data Structures > Province (hex) = 1 / 1
  - Data Structures > Terrain Types (10) = 1 / 1
  - Data Structures > Forestation = 1 / -
  - Data Structures > Starting population (worldgen anchors, 2026-11-10) = 2 / 2
  - Data Structures > Resource Extraction = 1 / -
  - Data Structures > Edges (not hex attributes) = 2 / 1
  - Data Structures > Population dynamics (settled shape 2026-11-02) = 2 / 2
  - Data Structures > Region (administrative region, 2026-11-09) = 1 / 1
  - Data Structures > Megaregion (derived, scale-conditional) = 1 / -
  - Data Structures > Water provinces and water source (substrate summary) = 1 / 1
  - Rules = 3 / -
