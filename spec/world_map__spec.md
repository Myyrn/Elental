# World Map — Specification

KB: `kb/world_map__kb.md`. Mirror of its `##/###` headings; cross-references live in kb only. Bootstrapped 2026-11-14 from kb rev 1 and `src/`. Sources: `src/modules/worldmap/{hex,regions,population,module}.js`, `src/data/loaders/buildState.js`, `src/modules/war/graph.js`, `src/modules/economics/step.js` (extraction), `tests/worldmap.test.js`, `tests/population.test.js`; scenario schema `scenario_schemas__spec.md` §2 and generator `worldgen__spec.md` (not re-read). Where code and the old `modules__spec.md` text disagree, **code wins** (**code-led**; the World Map text there is superseded). Anything the kb does not state is **(spec decision)** (pending OK); not-yet-written code is **(target)**.

## Data Structures

State and conventions:
```js
state.world = { grid: {w, h, orientation, rawW, rawH, rawCellPx}, hexes /*raw terrain samples, shape not verified*/,
                provinces: Record<provId, Province>, edges: Record<edgeKey, Edge>,
                regionSnapshot: {assignment: Record<provId, regionId>, next: number, owners: Record<regionId, countryId>} }
state.economy.warehouses[p], state.economy.tradeInfra[p]        // Economics-owned stocks keyed by province (not on the Province record in state)
ids: province `p:x,y` (provId), hex `h:x,y` (hexId; raw grid), region `r<n>`, edge `${a}~${b}` with a < b (edgeKey)
worldmap derive (ctx.derive.worldmap.*): regionProvinces(region), regionOwner(region), presence(p, nation), cellProvShare(key, p), neighbors(p)
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
- **Consumers verified**: `terrain`, `forestation`, `habitability` (Economics extraction, `worldmap/population.js`), `maxPopulationDensity`×`maxArea` (density ceiling in `stepPopulation`), `owner` (Regions, War, Diplomacy), `population` (kept equal to Σ presence), `resourceOverrides` (extraction), `infrastructureLevel` (War supply; see `war__spec.md`). **No consumer found** for `urbanization` and `sanitation` (awareness input and epidemic burden are targets in Internal Politics/Exogenous shocks).

### Terrain Types (10)
Code: scenario `ruleset.terrain` (**9 keys, no Sea**: `data/ruleset.json` has no `Sea`); `worldmap/hex.js` (`edgePassable`)
- **(code-led)** the ruleset and `scenario_schemas__spec.md` §2 still describe 9 terrains: Sea, `water_body` (sea | lake), `capability.settleSea`/`settleLake` and `traversal.Sea`/`Lake` (kb 2026-11-09/10) are **not in code or data**; water provinces, lake hexes and the 500-province grid exist only in the kb. No code checks `terrain === 'Sea'`.
- Wasteland yields nothing (`extract` returns 0) and does not grow (`stepPopulation` skips provinces with `habitability === 'Wasteland'`); this is how unsettled water will behave once Sea exists (target: terrain `Sea`, `waterBody` field, flags in `ruleset.capability`/`ruleset.traversal`, `settleSea`/`settleLake` checked by the settlement route, `traversal` checked in `war/graph.js`). Ownership of unsettled water (kb open): default not owned; `deriveRegions` already gives unowned provinces no Region.
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
- Target: the generator seeds a Settled province's `population` from `anchor(terrain)` — Grassland ≈ 10,000, Taiga/Mountain ≈ 1,000, other land terrains interpolated by `popDensityCeiling` **(spec decision)**, Sea/lake 0, Frontier/Wasteland lower (open). The kb states the concrete numbers in `data/`/`scenarios/` and worldgen code were **not** changed, so the anchors are not applied yet. At runtime population is only dynamics (below).

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
- **Not verified** here: river crossing costs, sea-lane routing through water provinces and the naval scope (War). Tests: the Mountain interior rule in `tests/worldmap.test.js`.

### Population dynamics (settled shape 2026-11-02)
Code: `worldmap/population.js` (`stepPopulation`, `growthFactor`) at step 8 before the Region pass
```js
delta(cell) = cell.population × T('pop.growth') × f;  f = subsistence < 1 ? subsistence − 1 : comfort           // in [-1, +1], from last step-3 satisfaction
growth: placed over the Region's habitable provinces by the Nation's presence (water-filled), capped by each province's density ceiling (maxPopulationDensity × maxArea); decrease removes pro rata to presence
the change is mirrored into province.population and state.nations.presence; the cell's free labour scales by the same factor (committed labour neither breeds nor starves)
```
- Epidemic burden (sanitation × urbanization × Medicine), gradual migration (pull = need-satisfaction difference along edges, scaled by Movement autonomy, `LaborMigrationBan`), the three settlement routes (gradual migration, cell action `settle`, Government free-colonization policy or direct resettlement), and Expulsion are **not in code** (the `Settlement` Right exists in `ruleset.rights` with default permitted but nothing reads it).
- **(target, spec decisions)**: `settle` cell action (permitted, minRung 1; commitment paid from the cell's Wealth and labour); `freeColonization` commitment (`actions__spec.md`, target); `directResettlement` and `expel` events (scope filter, target province, gate `Movement`/Veto, entitlement loss; expel adds a Government-chosen confiscated share into `gov.inventory`, a public log entry and a kin-state CB); migration derive `pull(p→q) = satisfaction(q) − satisfaction(p)` scaled by movement permissions, applied at step 8 with the same presence/population mirroring.
- Tests: `tests/population.test.js` (growth, bounds, invariants; names not re-verified).

### Region (administrative region, 2026-11-09)
Code: `worldmap/regions.js` (`deriveRegions`, `splitShares`, `splitCell`, `mergeCells`, `RECORDS`, `EXTENSIVE`), `worldmap/module.js` (`step8`)
```js
deriveRegions(world:{w,h}, owners: Record<provId, country|null>, prev, {target: 7, minSize: 6, maxSize: 8}) -> {assignment, regions: Record<rid, {owner, provinces}>, next}
  1 keep previous Regions that are still whole, same-owner and contiguous (snapshot-and-drift: ids stay stable)
  2 leftover components smaller than minSize join an adjacent kept Region of the same owner if it stays ≤ maxSize
  3 other components: k = n < 2·minSize ? 1 : min(⌊n/minSize⌋, max(⌈n/maxSize⌉, round(n/target))); farthest-point seeds, round-robin flood fill, then rebalance to 6–8 while keeping parts contiguous
  unowned provinces (incl. all water today) get no Region; ids r<n>; deterministic (sorted iteration)
step8 (ONE pass at end of turn): stepPopulation → if some assigned province's owner differs from its Region's recorded owner: re-derive, then for every polity cell
  shares[newRegion] = Σ presence share of the cell's Nation over its old provinces; splitCell(cell, shares) or mergeCells; remap momentum/rung (max over parts);  regionSnapshot replaced
splitCell: EXTENSIVE ['population','wealth'] and RECORDS ['labour','labourCommitted','hoard'] split pro rata; intensive fields (grievance, opinion, pref stacks, momentum) copied
mergeCells: extensive summed; grievance population-weighted; other intensive fields taken from the first cell (code-led)
```
- **Code runs the pre-2026-11-09 model**: Regions are re-derived automatically after an ownership change (the stored partition is `regionSnapshot`), size 6–8 is enforced except for components too small to split, and the whole thing is pure derivation. **Not in code**: the **Reorganization Event** (split, merge, move provinces between Regions; gate: Country-wide Veto/Council consultation; names every resulting capital; applied with the Region pass), `capital_province` (stored, chosen by player/AI; fallback when a split/merge leaves none: previous capital if still in the Region, else the most populous province — **proposed**), the advisory development readout with banded enter/exit thresholds, the Region-assembly unit pointer (Administration).
- **(code-led, by reading — not tested)** the change test compares only the owners of provinces already in `assignment`, so a province newly owned from `null` (a settlement or claim) is not given a Region until some other assigned province changes owner; no code path creates such ownership yet.
- **(target, spec decisions)**: `state.world.regions: Record<rid, {capital: provId}>` beside `regionSnapshot`; event `reorganizeRegions` `{ops: [{kind: 'split'|'merge'|'move', ...}], capitals: Record<rid, provId>}` (class event, gate by every Veto/Council holder in the Country, previewable; applied at step 8 by the same `splitCell`/`mergeCells` rule; worsened laws are entitlement loss); `setRegionCapital(region, province)` event for the administrative setting.
- Tests: `tests/worldmap.test.js` (contiguity, same owner, 6–8 sizes, determinism, id stability under unrelated change; split by presence preserving totals; merge sums).

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
6. Region membership: contiguous, same owner, derived over owned provinces; **stored `regionSnapshot` but changed only by automatic re-derivation** (Reorganization Event not in code).
7. Cell stocks split/sum by presence share (`splitCell`/`mergeCells`, tested).
8. Megaregion: none.
9. `infrastructureLevel` and `tradeInfrastructureLevel` are separate fields/stocks (`state.economy.tradeInfra` for the latter).
10. No stored birth or migration rate: growth is derived (`growthFactor`); migration, settlement actions and Expulsion not in code.
11. One Region pass at step 8 after population, once per turn (tested through `step8`; "after Diplomacy" = step 8 after step 7); no banded development readout.
12. Cataclysm: none.
13. 500 provinces / Sea as terrain: not in data or code.
14. `waterSource` single-valued data.
15. Mountain interior edges blocked unless `mountain_pass` (`edgePassable`, used by `war/graph.js`, tested).
16. Sea/lake traversal and settlement flags: not in code.
17. Starting population anchors: generation-time only; not applied.
18. `capital_province`: not in code.

## Status
- **Implemented and tested**: odd-r grid and distance, Mountain-edge rule, Region derivation (contiguity, size, determinism, id stability), split/merge by presence share, natural population growth with density ceiling and presence mirroring (test files: `worldmap.test.js`, `population.test.js`; names of the population tests not re-verified).
- **Implemented, no direct test**: `step8` re-keying of polity cells and momentum, `regionOwner`/`cellProvShare`, forestation movement block in `war/graph.js`.
- **Not in code**: Sea/lake terrain, `water_body`, capability/traversal flags, 500-province grid, starting-population anchors, epidemic burden, migration, settlement (cell action, free colonization, direct resettlement), Expulsion, Reorganization Event, Region `capital_province`, advisory development readout, Megaregion, `urbanization`/`sanitation` consumers, `LaborMigrationBan` consumer, Fish "coastal only" rule.
- **Stale elsewhere**: `scenario_schemas__spec.md` §2 and `data/ruleset.json` list 9 terrains and no Sea; `modules__spec.md` World Map text is superseded by this file.
- **(code-led)**: Regions are re-derived automatically (snapshot-and-drift) rather than reorganized by an Event; `mergeCells` keeps the first cell's intensive fields except grievance; the ownership-change test misses newly owned unowned provinces; ids `r<n>` assigned by derivation order.
- **(spec decision)**: field-name mapping, `regions` store with `capital`, `reorganizeRegions`/`setRegionCapital` events, `settle`/`directResettlement`/`expel` event shapes, migration pull formula, interpolation of anchors by `popDensityCeiling`.
- **Open (kb)**: Grassland forestation ceiling; favor coefficients and Timber curve; Megaregion threshold; unsettled water ownership; Sea/lake Fish yield and Sea `water_source`; Sea Lane routing through lakes; Frontier/Wasteland seeds; capital gameplay effect and the AI's selection rule; birth-rate formula and migration numbers.
- **Tuning keys** (existing): `pop.growth`, `yield.baseline`, `yield.timberPerForest`, `war.forest.block`; none new. `scenarios/alpha/tuning.defaults.json` is authoritative for values.
- **Sync:** (`<section> = <kb rev> / <code rev>`; `-` = no or insufficient code+tests; `1` = code and a test file present, names not re-verified)
  - Data Structures > Grid = 1 / 1
  - Data Structures > Province (hex) = 1 / -
  - Data Structures > Terrain Types (10) = 1 / -
  - Data Structures > Forestation = 1 / -
  - Data Structures > Starting population (worldgen anchors, 2026-11-10) = 1 / -
  - Data Structures > Resource Extraction = 1 / -
  - Data Structures > Edges (not hex attributes) = 1 / -
  - Data Structures > Population dynamics (settled shape 2026-11-02) = 1 / -
  - Data Structures > Region (administrative region, 2026-11-09) = 1 / -
  - Data Structures > Megaregion (derived, scale-conditional) = 1 / -
  - Data Structures > Water provinces and water source (substrate summary) = 1 / -
  - Rules = 1 / -
