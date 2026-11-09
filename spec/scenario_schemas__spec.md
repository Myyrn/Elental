# Scenario Package — Concrete Schemas

Status: first pass (2026-11-04). Turns the document list of `scenario_editor__spec.md` into
field-level definitions in the `Field` language implemented and tested in `src/kernel/schema.js`
(types: `int float bool string color enum ref list record object`; `status`, `ref`, `check`).
Tuning defaults ship as data: `scenarios/alpha/tuning.defaults.json` (54 keys, all `placeholder`).
IDs: lower-case slugs (`vantir`, `nobility`, `grain`); province id `p:<x>,<y>`; pool ids are the
exact kb names (`Agriculture`, `Trade/Commerce`, ...). **(spec decision)** unless quoted from the kb.

## Data Structures

### 1. `manifest.json`

```json
{ "schemaVersion": 1, "id": "alpha", "name": "Alpha — 10 empires", "description": "",
  "rulesetRef": "scenarios/alpha/ruleset.json", "seed": 20261104,
  "worldgen": { "seed": 20261104, "attempt": 0, "report": null }, "createdWith": "editor 0.1" }
```
| Field | Type | Rule |
|---|---|---|
| `schemaVersion` | int | migrations keyed by version; loader refuses newer |
| `id` | string slug | unique per repository |
| `seed` | int | engine RNG seed (`state.meta.rng` = `seedFrom`) |
| `worldgen` | object | provenance of last generation (never read by the engine) |

### 2. `world.json`

```json
{ "grid": { "w": 25, "h": 20, "orientation": "pointy-top-odd-r", "rawW": 157, "rawH": 114, "rawCellPx": 16 },
  "provinces": { "p:3,4": { "x": 3, "y": 4, "terrain": "Grassland", "forestation": 25, "habitability": "Settled",
                            "waterSource": "river_adjacent", "maxArea": 100, "maxArableArea": 70, "maxPopulationDensity": 60,
                            "population": 4200, "urbanization": 0.1, "sanitation": 0.5, "infrastructureLevel": 30,
                            "tradeInfrastructureLevel": 10, "owner": "vantir", "settlementName": "Oras",
                            "resourceOverrides": { "Grain": 1.2 }, "provenance": "generated" } },
  "edges": [ { "a": "p:3,4", "b": "p:4,4", "type": "river", "fortress": false, "bridge": false } ],
  "warehouses": { "p:3,4": { "capacity": 500, "stock": { "Grain": 120 } } } }
```
| Field | Type | Rule |
|---|---|---|
| `terrain` | enum of `ruleset.terrain` keys (9) | fixed for all of alpha |
| `forestation` | int 0-100 | `check`: within terrain ceiling |
| `habitability` | enum `Wasteland`/`Claimed/Frontier`/`Settled` | Wasteland → population 0 |
| `waterSource` | enum `river_adjacent`/`coastal`/`none` | single-valued (kb) |
| `infrastructureLevel`, `tradeInfrastructureLevel` | float 0-100 | **two distinct stocks** (World Map Rule 9) |
| `edges[].type` | enum `river`/`mountain_pass`/`sea_lane` | `a`,`b` refs to provinces; `fortress` only on edges |
| `provenance` | enum `generated`/`manual` | worldgen lock |

### 3. `nations.json`

```json
{ "vantir": { "name": "Vantirians", "color": "#c0392b", "reactionTemperament": 0.6,
              "poolAffinity": { "Cavalry": 1.3, "Agriculture": 0.9 },
              "prefTraits": { "extraction_investment": 0.1, "homogenizing_pluralist": -0.2, "fervor_secular": 0.3,
                              "ruthlessness_restraint": -0.1, "conservatism_reformism": -0.3 } } }
```
Population presence is kept in this same file under `presence: { "p:3,4": { "vantir": 3000, "kerin": 1200 } }` (Σ per province ≤ `population`; the remainder = unaffiliated, flagged by validator).

### 4. `countries.json`

```json
{ "countries": { "vantiria": { "name": "Empire of Vantiria", "color": "#c0392b", "titularNations": ["vantir"],
                               "isPlayer": true, "aiProfile": null, "capitalHint": "p:3,4" } } }
```
Ownership is on `province.owner` (single source of truth); `capital` is derived (highest gravity), `capitalHint` only seeds the generator. Exactly one `isPlayer: true` in alpha (warn otherwise).

### 5. `polity.json`

```json
{ "estates": { "nobility": { "label": "Nobility", "laborProfile": { "Bureaucrats": 0.2, "Diplomacy": 0.1, "Cavalry": 0.3 },
                             "prefBaseline": { "extraction_investment": -0.2, "conservatism_reformism": -0.6 },
                             "estateModifier": { "Cavalry": { "def": 1.1, "atk": 1.1, "speed": 0.9, "upkeep": 1.2 } },
                             "populationShare": 0.03 } },
  "lawTemplates": { "default": { "rights": { "Council": [ { "scope": {"kind":"estate","estate":"nobility"}, "value": true } ] },
                                 "duties": { "Taxation": [ { "scope": {"kind":"estate","estate":"peasantry"}, "value": {"market":0.1,"wealth":0.0} } ] } } },
  "countryLaws": { "vantiria": { "template": "default", "overrides": { "rights": {}, "duties": {} } } },
  "cells": { "vantir|nobility|r1": { "population": 3000, "wealth": 400, "labour": { "Cavalry": 300 } } },
  "portraitSeeds": { "vantiria": { "extraction_investment": 0.0 } } }
```
`cells` keys use the `CellKey` of **seed Regions** (`r<n>`): the loader runs `deriveRegions` on the world, matches `region` ids by order, and `seedCells` (editor) guarantees the sum constraints. Estate identity = label + checklist + profile (recostuming): `estates` is a record, so a fifth Estate is data, not code (validator warns off the alpha count of 4). Scope objects use the shared syntax of `kernel/scope.js`.

### 6. `relations.json`

```json
{ "claims": [ { "holder": "vantiria", "target": "kerinia", "province": "p:9,2" } ],
  "treaties": [ { "kind": "Alliance", "tier": "Defensive", "parties": ["vantiria", "dorn"], "axes": [] },
                { "kind": "Dependency", "overlord": "vantiria", "subject": "orlan", "axes": [ { "axis": "TradeAccess", "terms": {}, "scope": {"kind":"empire"} } ] } ],
  "confederations": [] }
```
`kind ∈ Sanction | Dependency | Alliance | Confederation | Cooperation`; alliance `tier` from the six kb tiers; `axes[].axis` ref to `ruleset.axes`. Reputational stacks, CBs and opinion start empty (derived/event-based); optional `cbs` list for scripted starts.

### 7. `scenario.json`

```json
{ "startTurn": 0, "playerCountry": "vantiria", "aiProfiles": { "default": { "leverageSeed": "portrait" } },
  "options": { "fogOfWar": false, "headlessMaxTurns": 200 } }
```
`fogOfWar` is a placeholder flag (kb: deferred layer) and must stay `false` in alpha.

### 8. `ruleset.json` — section field definitions (extract)

```js
// data/schemas/ruleset.js  (Field definitions; the real file also lists doc strings and groups)
export const rulesetSchema = { type: 'object', fields: {
  terrain: { type: 'record', item: { type: 'object', fields: {
    forestMin: { type: 'int', min: 0, max: 100 }, forestMax: { type: 'int', min: 0, max: 100 },
    arableCeiling: { type: 'float', min: 0, max: 1, status: 'placeholder' },
    popDensityCeiling: { type: 'float', min: 0, status: 'placeholder' },
    favor: { type: 'record', item: { type: 'float', min: 0 } },                       // resource -> multiplier (kb table)
    combat: { type: 'record', item: { type: 'float', min: 0 } } } } },                // pool -> terrain combat modifier
  goods: { type: 'record', ref: 'goods', item: { type: 'object', fields: {
    tier: { type: 'enum', values: ['raw','semi','light','heavy','transport'], required: true },
    baseValue: { type: 'float', min: 0, status: 'placeholder', unit: 'numeraire', doc: 'Refined Precious Metals = 1' },
    extractPool: { type: 'ref', ref: 'pools' }, perishable: { type: 'bool', default: false },
    decayRate: { type: 'float', min: 0, max: 1, status: 'placeholder' },
    recipe: { type: 'object', fields: { pool: { type: 'ref', ref: 'pools' }, labourPerRun: { type: 'float', min: 0, status: 'placeholder' },
              inputs: { type: 'list', item: { type: 'object', fields: { any: { type: 'list', item: { type: 'ref', ref: 'goods' } }, qty: { type: 'float', min: 0 } } } },
              outQty: { type: 'float', min: 0 } } } } } },
  pools: { type: 'record', ref: 'pools', item: { type: 'object', fields: {
    kind: { type: 'enum', values: ['civil','army','arcane','admin'] },
    envelope: { type: 'object', fields: { control: { type: 'float', min: 0, status: 'placeholder' },
                coordination: { type: 'float', min: 0, status: 'placeholder' }, observation: { type: 'float', min: 0, status: 'placeholder' } } },
    combat: { type: 'object', fields: { meleeAtk: {type:'float'}, meleeDef: {type:'float'}, rangedAtk: {type:'float'}, rangedDef: {type:'float'},
              speed: {type:'float'}, discipline: {type:'float'}, upkeep: {type:'record', item:{type:'float'}} } },
    traits: { type: 'list', item: { type: 'string' } } } } },
  needs: { type: 'record', ref: 'needs', item: { type: 'object', fields: {
    class: { type: 'enum', values: ['existential','secondary'] }, kind: { type: 'enum', values: ['material','nonMaterial','fairness'] },
    tier: { type: 'enum', values: ['subsistence','comfort','luxury'] },
    accum: { type: 'float', min: 0, max: 1, status: 'placeholder' }, decay: { type: 'float', min: 0, max: 1, status: 'placeholder' },
    axisLoads: { type: 'record', item: { type: 'float', min: -1, max: 1 } } } } },
  consumption: { type: 'record', item: { type: 'list', item: { type: 'object', fields: {      // per tier
    any: { type: 'list', item: { type: 'ref', ref: 'goods' } }, perCapita: { type: 'float', min: 0, status: 'placeholder' } } } } },
  rights: { type: 'record', ref: 'rights', item: { type: 'object', fields: {
    valueType: { type: 'enum', values: ['bool','scalar','scopeList','bitmask','vetoDomain'] },
    silentDefault: { type: 'any', doc: 'value when no law speaks (silence = allowed)' }, prestigeWeight: { type: 'float', status: 'placeholder' } } } },
  duties: { type: 'record', ref: 'duties', item: { type: 'object', fields: { valueType: { type: 'enum', values: ['rate','amount','scalar','bool'] },
    prestigeWeight: { type: 'float', status: 'placeholder' } } } },
  axes: { type: 'record', ref: 'axes', item: { type: 'object', fields: { doc: { type: 'string' }, symmetricAllowed: { type: 'bool' }, postAlpha: { type: 'bool' } } } },
  cb: { type: 'object', fields: { tiers: { type: 'list', item: { type: 'string' } }, decayPerTier: { type: 'record', item: { type: 'float', status: 'placeholder' } } } },
  thresholds: { type: 'record', item: { type: 'record', item: { type: 'float', min: 0, status: 'placeholder' } } },   // type -> tier -> base
  rituals: { type: 'record', item: { type: 'object', fields: { scale: { type: 'enum', values: ['population'] },
    price: { type: 'float', min: 0, status: 'placeholder', unit: 'numeraire' }, labourThreshold: { type: 'float' },
    reagents: { type: 'record', item: { type: 'float' } }, duration: { type: 'int', min: 1 },
    effect: { type: 'object', fields: { path: { type: 'string' }, op: { type: 'enum', values: ['add','mul','set'] }, value: { type: 'float' } } } } } },
  worldgen: { type: 'object', fields: { /* see worldgen__spec §4 */ } },
  tuning: { type: 'record', item: { type: 'object', fields: { value: { type: 'any' }, status: { type: 'enum', values: ['placeholder','authored'] } } } }
} }
```
**Referential-integrity names** (`ref:` values the validator indexes): `goods, pools, needs, rights, duties, axes, terrain, nations, countries, estates, provinces`.
`any` is an additional Field type (`kernel/schema.js` skips type checks for it; use sparingly).

### 9. Loader contract (`data/loaders/`)

```js
readPackage(src)            -> {manifest, ruleset, overrides, world, nations, countries, polity, relations, scenario}
effectiveRuleset(pkg)       -> deepMerge(pkg.ruleset, pkg.overrides)  // + tuning defaults for missing keys, status 'placeholder'
refsOf(pkg)                 -> Record<refName, Set<id>>               // fed to kernel/schema.validate
validateAll(pkg)            -> Issue[]    // structural (schema) + referential + invariants (scenario_editor__spec §4)
buildState(pkg, ruleset)    -> GameState  // each SimModule.initState; rng = makeRng(seedFrom(manifest.seed))
```

## Rules

1. Every package document is validated by the same `Field` definitions the Editor renders; a field without a definition is an `unknownKey` warning.
2. Package documents contain no derived values (capital, Region membership, prices, zones, Weight); the only generated-but-stored items are authored/worldgen outputs tagged with provenance.
3. Province id, cell key and scope syntax are the same strings in documents, State and UI.
4. Authored numbers carry `status`; `placeholders()` is the numbers-pass worklist.
5. Estates, Rights, Duties, axes, needs, rituals are records, so adding one is data, never code (recostuming; "open-ended" Rule 6 of Internal Politics).
6. Ownership has one source of truth: `province.owner`.
7. Population sums per Region (Estate vs Nation) are invariants checked after any edit to `cells` or presence.

## Cross-references
`scenario_editor__spec.md` (panels, validators, generators) · `worldgen__spec.md` (writes these documents) · `economics_polity__spec.md` (§9 tuning keys used here) · kb: World Map (province fields), Nations, Countries, Economics (goods/pools), Internal Politics (Rights/Duties checklist).

## Status
- **Settled in kb, encoded**: province fields, edge types, two infrastructure stocks, 4 Estates/19 pools/45 goods/9 terrains as data, Rights/Duties checklist names, axis menu, alliance tiers, authored relative values.
- **(spec decision)**: document split, slug/id conventions, `presence` inside `nations.json`, `lawTemplates` + `countryLaws`, `cells` keyed by seed Regions, `any` field type, `scenario.options`.
- **Open**: (a) full list of Rights/Duties value types per entry (names are settled, shapes are mine); (b) whether `warehouses` start populated or empty in a fresh scenario (spec: optional); (c) ritual catalogue remains empty until you author examples.
