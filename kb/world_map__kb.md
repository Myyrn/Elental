# World Map — Knowledge Base

Status: terrain/resource/edge/region model settled. Grid substrate merged in
from former world_map_graphics__kb.md (rendering itself now lives in
ui__kb.md — see that file). Exact worldgen pipeline,
Grassland forestation ceiling value open. **2026-11-09 designer input**: Region is now a stored administrative partition with a Reorganization Event; resettlement widened and Expulsion added; every hex is a province and Sea becomes the 10th terrain type (see Status; items tagged **(proposed)** await the designer's OK).

## Data Structures

### Grid
Pointy-top, odd-r offset hex, 25×20 (500 hexes) at alpha — 1 hex = 1
province, **sea hexes included (2026-11-09: exactly 500 provinces)**. Sourced from a 157×114 @16px/cell raw terrain grid via
majority-vote/centroid sampling per hex. (Rendering of this grid is UI's
concern; this is the coordinate substrate War/Economics/etc. address.)

### Province (hex)
```
province = {
  terrain_type, forestation (0-100%),
  max_area, max_arable_area, max_population_density,
  current_population, urbanization_rate, sanitation_level,
  water_source: river_adjacent | coastal | none,
  habitability_state: Wasteland | Claimed/Frontier | Settled,
  cataclysm_status,   // reserved — cataclysm is post-alpha
  infrastructure_level (0-100%)   // roads/logistics quality
}
```

### Terrain Types (10)
`Mountain, Hill, Desert, Steppe, Grassland, Wetland, Jungle, Arctic, Taiga, Sea`
— fixed at worldgen and for all of alpha (cataclysm/reclamation changes are post-alpha).
**Sea (2026-11-09)**: a province like any other (population, owner and warehouse fields exist), but in alpha **no Nation has the capability to settle it** (`capability.settleSea = false`, post-alpha tech), so it stays Wasteland; land armies cannot enter (`traversal.Sea = false` until naval tech). Lakes stay non-province water. Open: whether unsettled sea can be owned (default no), Sea's Fish yield, numbers.

### Forestation
Independent 0-100% scalar, capped per terrain:
| Terrain | Forestation ceiling | Arable ceiling | Pop density ceiling |
|---|---|---|---|
| Desert | 0-10% | very low | very low |
| Arctic | 0-15% | near-zero | very low |
| Steppe | 0-40% | medium | low-medium |
| Mountain | 0-40% | low | low |
| Taiga | 50-90% | low | low |
| Wetland | 20-70% | medium-low | medium-high |
| Hill | 10-70% | medium | medium |
| Grassland | 10-70%* | high | high |
| Jungle | 60-100% | low | low-medium |
| Sea | 0% | none | none (unsettleable in alpha) |

*flagged for correction to a higher ceiling — exact value **open, unresolved**.

### Resource Extraction
`yield(resource, hex) = baseline_rate + terrain_favor(terrain_type, resource)`
Timber is the exception: scales directly with forestation%, independent of
the favor table.

| Terrain | Favored resources (×mult) |
|---|---|
| Mountain | Iron Ore ×8, Precious Metal Ore ×8, Coal ×6, Stone ×8, Sulfur ×5 |
| Hill | Stone ×4, Iron Ore ×3, Coal ×3, Fine Horses ×2, Wool ×2 |
| Desert | Salt ×6, Sulfur ×4, Precious Metal Ore ×2 |
| Steppe | Fine Horses ×8, Livestock ×5, Wool ×3 |
| Grassland | Grain ×6, Livestock ×5, Wool ×2 |
| Wetland | Fish ×5, Fiber ×5, Salt ×3, Herbs ×3, Iron Ore ×2 |
| Jungle | Herbs ×8, Magical Reagents ×5, Fiber ×4 |
| Arctic | Fish ×4 (coastal only), Hides ×3, Precious Metal Ore ×2 |
| Taiga | Timber (forestation-driven), Hides ×5, Fish ×3 |
| Sea | Fish (yield **open**; unreachable while no Nation can settle Sea) |

### Edges (not hex attributes)
```
edge = { hex_A, hex_B, type: river | mountain_pass | sea_lane, fortress: bool }
```
- River — crossing costs extra supply/time/combat penalty; bridge removes it at that edge.
- Mountain Pass — only interactive route through a Mountain Region's interior.
- Sea Lane — connects coastal hexes; needs naval capability; landmass stays topologically contiguous regardless of routing. Sea Lane edges route through Sea provinces (2026-11-09).
- Fortress — sits on a chokepoint edge, converts free passage into siege-required. Most edges are unfortified — porosity is intentional.


### Population dynamics (settled shape 2026-11-02)
World Map owns the province population stock; nothing here is a stored rate.
- **Growth** is derived from the cell's need satisfaction in the consumption cascade (subsistence/comfort), minus epidemic burden, bounded by `max_population_density`. The **birth-rate formula** (derived from various parameters) is designed at the numbers pass.
- **Gradual migration** is derived: pull between adjacent provinces along existing edges = the difference in need satisfaction, scaled by movement permissions (Movement autonomy Right and laws). Cross-Country movement is gated by Diplomacy's LaborMigrationBan axis. Migrants join the same Estate cell in the destination Region, carrying pro-rata stocks (as in the Region-split rule), and keep their Nation identity.
- **Settlement** (Wasteland → Frontier → Settled) has three routes: (1) **gradual migration** into the province; (2) **cell action** — cells are actors, so a cell may settle frontier out of necessity or opportunity, paid from its own Wealth and labour, permitted unless a law forbids it ("undecided" means allowed; Rights checklist: Settlement; a forbidding law bites through `involuntary_compliance`); (3) **Government action**, in two forms: (a) a **free-colonization policy** — lifted restrictions plus incentive spend (Wealth, a commitment) that raises the pull, compelling no one; (b) **direct resettlement** (2026-11-09): an Event that moves the population of **cells, Nations or Estates** (any scope filter) into a target province, carrying pro-rata stocks; overriding Movement autonomy is entitlement loss (forced through Control).
- **Expulsion (2026-11-09)**: an Event removing the population of cells / a Nation / an Estate from the Country across a border into a destination Country's province; destination gating by Diplomacy's LaborMigrationBan; the expelled lose a Government-chosen share of their stocks (confiscated to the Government inventory); maximal entitlement loss for the cells, a public Decision Log entry (awareness-driven discontent for others) and a kin-state appeal CB if the Nation has a kin Country. **(proposed details)** Both resettlement and expulsion are drafts with preview and gating.

### Region (administrative region, 2026-11-09)
A stored, per-Country partition of its provinces into contiguous same-owner groups (default size 6-8, guidance not a hard cap). Worldgen seeds the initial partition. Primary
player-attention unit, the level at which laws are set, and the resolution level at which Internal Politics'
`(Nation, Estate, Region)` actor stocks are held. Ownership change still forces split/merge (cell stocks by population share). The former automatic "sustained development" re-derivation becomes an **advisory readout**; applying it is a reorganization. **(proposed)**

**Reorganization Event** (Event Draft): split a Region, merge adjacent Regions, or move provinces between adjacent Regions (contiguity and ownership preserved). Cells' stocks split/sum by population share; effective laws re-resolve; worsening = entitlement loss; gating per Internal Politics (Country-wide Veto/Council consultation). Applied once at end of turn with the Region pass.

**Region pass timing (settled 2026-11-02, adapted)**: one pass at the **end of each
turn, after Diplomacy (step 7)**, applying all splits, sums and queued reorganizations, so mid-turn
logic always sees stable Regions. The advisory development readout uses a
**banded enter/exit threshold** (hysteresis, as with faction escalation).
Occupation applies to the captured province's population share of the cell
until the pass runs.

### Megaregion (derived, scale-conditional)
6-8 Regions, "Region-of-Regions." Only instantiated past alpha scale (~5000
provinces), when per-empire Region count alone would exceed attention cap.

```
hex = province = { x, y, terrain_type (10 incl. Sea) }      // every grid hex is a province
lake = non-province water (no terrain/owner/population/warehouse)
water_source: river_adjacent | coastal | none
    precedence: river first  (river edge or lake shore -> river_adjacent; touches a Sea province -> coastal)  [lake shore = fresh water: to confirm]
```
Sea provinces carry population, owner and warehouse fields like any province but stay Wasteland and untraversable by land armies in alpha (see Terrain Types). Sea Lane edges connect coastal provinces and route through Sea provinces (path length is the lane's length).


## Rules
1. Terrain type static; forestation an independent scalar bounded by terrain ceiling.
2. Resource yield = baseline + terrain-favor; Timber uniquely keys off forestation%.
3. Rivers/passes/sea-lanes are edges, never hex attributes.
4. Fortresses attach to chokepoint edges only; they gate passage, never generate value by existing.
5. Habitability gates all production/culture — Wasteland yields nothing regardless of terrain.
6. Region membership requires contiguity + common ownership over the Country's owned provinces of any terrain; the partition is stored and changes by ownership change (split/merge) or a player Reorganization Event, applied once per turn (Rule 11), never continuously.
7. On partial Region conquest, actor stocks (Internal Politics) split proportionally by population share (Nations' data) across the fractured provinces, then both fragments are placed in the Region partition. Merger reverses (stocks sum). Reorganization uses the same split/sum rule.
8. Megaregion instantiation is scale-conditional, not hardcoded.
9. `infrastructure_level` is a per-province 0-100% scalar (Builders + Wealth), reduces Supply decay (War) along routes through the province. **It is a distinct stock from Economics' `trade_infrastructure_level`** (roads/logistics vs. commercial institutions/markets/banks) — not an alias, no duplicate tracking implied.
10. Population growth, migration and settlement are derived from existing stocks — no stored birth rate or migration rate; settlement is gradual migration plus action by a cell (actors; permitted unless forbidden) or the Government (free-colonization policy or direct resettlement of cells/Nations/Estates). Expulsion is a gated Event, never a stored rate.
11. The Region pass runs once at end of turn after Diplomacy, applying splits, sums and queued reorganizations; the development readout is advisory with banded enter/exit thresholds.
12. Cataclysm is post-alpha; terrain is fixed throughout alpha.
13. Every hex of the 25×20 grid is a province (exactly 500 at alpha); lakes are non-province water. Sea is a terrain type that no Nation can settle in alpha.
14. `water_source` is single-valued; when several apply, river-adjacent wins over coastal.
15. Movement across Mountain edges is blocked unless the edge is a Mountain Pass — an edge between two Mountain hexes (the Region interior) is traversable only as `mountain_pass`; Mountain↔non-Mountain edges stay open (to confirm). Worldgen guarantees land connectivity.
16. Land armies cannot enter Sea provinces until naval technology (`traversal.Sea`); Sea provinces cannot be settled until a capability flag allows it (`capability.settleSea`).


## Cross-references
- **Economics** — reads terrain-favor/forestation for yields, habitability for developability. `trade_infrastructure_level` is a separate Economics-owned stock (see Rule 9) — its definition is settled in Economics (per-province stock, 2026-11-02).
- **UI** — sole consumer of this data for rendering; owns all lens/color/icon/overlay logic (see `ui__kb.md`; Regions rendering and Trade Zones lens 2026-11-09).
- **Countries / Administration** — Region is the actor-cell resolution layer Countries/Administration consume, not one they compute themselves.
- **Internal Politics** — `(Nation, Estate, Region)` actor granularity resolves here; laws are set per administrative Region; Region fracture/merger/reorganization triggers IP's stock-split/sum (Rule 7) and entitlement loss on worsened laws. `urbanization_rate` is an awareness input (2026-11-01).
- **Diplomacy** — LaborMigrationBan gates cross-border migration and Expulsion destinations.
- **Exogenous shocks (2026-11-01)** — epidemic risk derives from `sanitation_level` × `urbanization_rate` × Economics' Medicine pool; harvest variance feeds Economics yields; cataclysm is post-alpha (2026-11-02). No Events module in alpha.
- **Nations** — province-level population is the divisor for Region-fracture splitting.
- **War** — chokepoint edges/fortresses gate supply/siege; `infrastructure_level` feeds Supply decay and army `edge_quality`; Sea provinces are untraversable by land armies in alpha.

## Status
- Terrain types, forestation-as-scalar, favor-table structure, edge model, fortress-as-edge-blocker, Region/Megaregion derivation, Grid substrate, infrastructure_level as a distinct stock from trade_infrastructure_level: **settled**.
- Exact favor-table coefficients, forestation-to-Timber curve, Megaregion threshold, Grassland forestation ceiling exact value: **open, deferred**.
- **2026-11-02 — settled**: population growth/migration/settlement shape (formula at the numbers pass); Region re-derivation timing and banded development trigger; cataclysm and terrain change moved to post-alpha.
- **2026-11-03 — settled**: cells are actors for settlement; Government settlement as a free-colonization policy or direct resettlement of specific cells.
- **2026-11-04 — settled**: surface (land/sea/lake) model; river-first water source; non-pass Mountain edges blocked (interior reading to confirm). **The land/sea/lake surface model is superseded 2026-11-09** by sea provinces (below); river-first water source and the Mountain-edge rule stand.
- **2026-11-09 — designer input**: Region is the stored administrative Region with a Reorganization Event; direct resettlement widened to cells/Nations/Estates; Expulsion added; every hex is a province and Sea is the 10th terrain type (500 provinces; Rules 6, 11, 13, 16). **Proposed (awaiting OK)**: advisory development readout replacing automatic re-derivation; Expulsion details (confiscated share, kin-state CB). **Open**: whether unsettled sea can be owned (default no); Sea's Fish yield; Sea `water_source`; numbers.
