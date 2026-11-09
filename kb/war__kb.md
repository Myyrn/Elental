# War — Knowledge Base

Status: roster/fielding/Supply/Combat/maneuver/siege/battle structure,
War Score, War Exhaustion, Peace Conference, and Technology Tier all
settled. Occupation is recorded here as the single source of truth (was
previously duplicated in `internal_politics__kb.md` — removed there).
Coefficients remain open (numbers pass). Naval scope for alpha, soft
substitutable garrison, the rebel Peace Conference, Retinue sizing, civil-war
martial law and Troop Training were settled 2026-11-02 — see below.

**2026-11-01 overhaul pass**: War Score is now per-cell harm in existing
stocks (no Loyalty stock, no persistent Faction); War Exhaustion is derived,
not stored; Fielding/Supply acquisition follows Internal Politics' Government
rules (market purchase default, Requisition override); internal armed
conflict (a faction's armed rung) is resolved here; war harm is attributed to
the enemy by default. See Status.

**2026-11-02 rules pass**: alpha naval scope is minimal (sea lanes carry transport
and supply; no fleet combat, no new pool); Occupation's garrison is soft and
substitutable with Control; internal conflicts resolve through the same Peace
Conference with Rights/Duties-vocabulary terms; Retinue is a scalar Right;
civil-war martial law reuses occupation's Control cost; Troop Training is a
commitment; Army Tactics are dials; war-declaration timing settled; one stance
function governs Veto-to-declare and Veto-to-continue.

## Data Structures

### Technology Tier
```
technology_tier(country | province) = cold_steel | gunpowder   // flag, not a second roster
```
All pools persist across both tiers. Gunpowder grants a significant
effectiveness bonus to infantry/cavalry/artillery **conditional on live
ammunition Supply**; cut off, effectiveness degrades toward/below
cold-steel baseline rather than losing a flat bonus.

### Army Roster
Six Army Skilled Labor pools (Economics' 19-pool list):
`Shock Infantry, Pike Infantry, Skirmishers, Cavalry, Artillery, Siege Corps`
Mages are **not** a seventh pool — draw on Meteomancy/Theurgy directly,
blending artillery/support/disruption into one unit type.

### Fielded Unit (Standing Commitment)
```
unit = {
  origin_cell: (Nation, Estate, Region), composition: {pool: count},
  equipment_tier, armor_invested: 0-100%,
  strength_current, cohesion (persistent), position, supply_state: 0-100%
}
```
Fielding consumes Heavy Industry goods once, drawn from the recruiting
warehouses in the provinces of the recruiting Region (warehouses are per province — Economics). Acquisition: market purchase with Ledger Wealth by
default; a wartime Requisition Duty may override it (pre-cascade, two Opinion
hits — `internal_politics__kb.md`); labour via Levy Duty. **Casualties**: Killed (permanent, deducted from
origin cell) · Wounded/scattered (temporary, returns after delay) ·
Captured (open — likely discounted/delayed Killed, ransom hook deferred
to Characters/Diplomacy). Disbandment returns labor immediately, no penalty.

### Garrison (Recurring Claim — distinct from field units)
```
garrison(province) = { strength_current, max_capacity = h(fortification_level), composition }
```
No `origin_cell` — anonymous draw; losses never trace to a cell's war-harm accounting. The labour itself still comes from Army pools (Economics); anonymity applies to loss accounting only. Refilled each turn up to `max_capacity`, gated by a
per-Region `priority ∈ [0,1]` dial (0 = field units drawn first). Fields
as a full unit in Relief battles.

### Combat Envelope
```
base_envelope(pool) = { melee_atk, melee_def, ranged_atk, ranged_def,
                         speed, discipline, upkeep: {food, fodder, ammo} }
```
`charge_bonus = k × speed(unit)` — derived at resolution, never stored.
`armor_mitigation`/`armor_speed_penalty` — see Armor.

### Traits & Interactions (sparse tags)
```
unit_traits(pool): Cavalry{mounted}, Pike Infantry{reach},
  Shock Infantry{shock}, Skirmishers{skirmish, evasive},
  Artillery{ranged, fragile}, Siege Corps{siege}, Mage{ritual}
interaction(tag_A, tag_B) = multiplier   // sparse
  reach vs mounted → defender bonus; shock vs reach → attacker bonus;
  penetration vs armor → discounts armor_mitigation
```
Estate/culture/tech can add traits on top of pool-fixed ones.

### Estate / Nation Modifiers
```
combat_envelope(unit) = base_envelope(pool) × estate_modifier(origin_Estate, pool)
                       × terrain_combat_modifier(terrain_type, pool)
nation_material_modifier(nation) = { effectiveness_mult, speed_penalty_mult }   // Armor only
```
No new pools for heavy/light variants (recostuming principle) — e.g.
Nobility Cavalry: def+/atk+/speed−/upkeep+; Peasantry Cavalry: speed+/
upkeep−/pursuit bonus.

### Armor
```
armor_invested ∈ [0,100%]   // player-set dial, at fielding/refit
armor_mitigation = k1 × armor_invested
armor_speed_penalty = k2 × armor_invested × tech_modifier(tier) × nation_material_modifier(nation).speed_penalty_mult
```
`penetration` (gunpowder ranged sources) sharply discounts mitigation vs.
ranged specifically — armor stays relevant vs. melee even at gunpowder tier.

### Terrain Combat Modifier
| Terrain | Favors | Penalizes |
|---|---|---|
| Grassland/Steppe | Cavalry | — |
| Mountain/Hill | Pike/Shock (def), Siege Corps (immobile) | Cavalry |
| Wetland/Jungle/high forestation | Skirmishers | Cavalry, Artillery |
| Desert/Arctic | — | primarily a Supply-decay effect |

`forest_movement` trait overrides forest hard-block for movement.

### Army Position & Maneuver
```
army_position = { province: (x,y), entry_side: 0-5, route_side: 0-5,
                   detachment_depths: {vanguard, center, rearguard} ∈ [0,1] }
```
`army_speed = min(speed(Center), speed(Rearguard))` — Vanguard exempt.
Reroute always legal, costs a full turn with zero progress.
`edge_quality = province.infrastructure_level × edge_type_modifier` gates
the **attacker's** advance rate on its committed route; defenders use the
full internal network. Detection: Vanguard composition vs. terrain-derived
concealment. Stacking uncapped, self-limited by Supply competition.
Formation cohesion gate: `spread = max(depths)−min(depths)`; over
threshold, closest pair fights first, remainder delayed/misses.

### Evasion / Compel
1. Gate — attacker `army_speed` must threaten interception.
2. Compel — Vanguard vs. Vanguard via `screening_strength`: defender wins → clean disengage; attacker too weak → deflected; attacker wins → battle at current depths.
3. Rearguard raids — cheaper, separate Supply-interdiction action.

### Supply
```
supply(unit) = f(path_distance_to_nearest_valid_source, terrain/edge
                  penalties, path_severed: bool)
```
Valid source: sufficient Warehousing, reachable through owned/allied/
access-granted territory only. Pathing uses World Map's edge graph (not
Economics' trade edges); `infrastructure_level` reduces decay. Upkeep is a
real zero-sum draw against the nearest warehouse, competing with civilian
consumption (through market prices by default, or pre-cascade under a wartime
Requisition Duty). Local requisition (Vanguard) draws directly on occupied
territory, bypassing home-source pathing. Interdiction: enemy occupation
of a transit province breaks the edge for pathing that turn; besieging the
source cuts it entirely.

### Fortress / Blockade Typing (derived)
```
blockade_type(fortress) = hard-capable if edge ∈ {mountain_pass, river_crossing}
                           or hex.forestation ≥ threshold; soft-only otherwise
hard → blocks movement/depth-advance until reduced by siege
soft → movement unimpeded; interdicts Supply unless blockaded at strength
       ≥ garrison_strength × 3 (coefficient open)
```
River hard-block applies only to the specific crossing edge. Province
Fortress fixed at `depth = 0.5` regardless of entry side.

### Settlements
```
settlement(province) = { name }   // only field stored
major_nations(settlement) = recomputed each turn from Nations' data
```
Multiple settlements per province are flavor-only — no independent
Warehousing/production stock.

### Siege State
```
siege_progress += f(besieger_SiegeCorps, besieger_Supply)
             − f(fortification_level, garrison_strength, defender_Supply)
```
Falls at capture threshold. Attritional — logs a per-cell harm War Score
entry every turn it holds. Besieger's own army draws Supply normally
(often worse terms) — the mechanical basis for holding out. Sally: defender
forces a normal field Compel. Relief: friendly army skips detection,
triggers immediate Compel; garrison may sally as a full unit. Assault:
besieger spends Siege Corps for an immediate capture attempt scaled by progress.

### Battle Resolution (sequential, state carries forward)
1. **Skirmish** — ranged vs. ranged (full-effect); ranged vs. melee-tagged (harassment, reduced). Carries into Melee.
2. **Melee** — screening contest (`screening_strength = discipline × reach_bonus × tactic_modifier`) determines whether mounted sub-units bypass to fragile ranged units (`charge_bonus` applies) or get forced into reach engagement; paired duels resolve independently per sub-unit; cascading reinforcement applies `flanking_bonus`.
3. **Rout** — aggregate cohesion vs. threshold: clean break (pursuit, `speed`-driven casualties) or orderly withdrawal.

```
cohesion: win → += Δwin; stalemate/loss → −= Δloss   // persistent, bounded, never reset
```
**Tactic Stances**: Hold Formation (↑screening/def, ↓atk) · Aggressive
(↑atk/charge, ↓screening/def) · Cautious (↑cohesion retention, ↓atk/charge)
· Flanking-focused (↑reinforcement, ↓screening).

### Army Tactics
`Seek Battle, Raid, Forced March, Siege, Garrison/Hold, Shadow/Screen, Blockade`
— Raid damages enemy production/Warehousing; Forced March trades Supply
for Speed/depth; Shadow/Screen is pure recon; Blockade commits strength ≥
`garrison_strength × 3` against a soft-type target.
**Class (settled 2026-11-02)**: Army Tactics are **dials** — free to change, with consequences coming only from the resulting state.

### Internal Armed Conflict (handed off from Internal Politics — settled 2026-11-01)
A faction's armed rung (armed retinue / revolt) resolves here, on the same
combat, Supply, Siege and Occupation machinery.
- **Sides**: Government vs. rebelling bloc — `side` need not be a Country.
- **Rebel units**: drawn only from the rebelling cells' own Army pools via
  the Retinue Right; origin accounting unchanged (casualties deduct from
  origin cells).
- **Rebel Supply**: warehouses in territory the rebels control.
- **End states**: concession (grievance addressed → ends), suppression
  (Occupation-style martial law on the rebelling cells), secession
  (Countries Formation via Nations' Statehood Pathway).
- **Settled 2026-11-02**: Retinue Right sizing, rebel Peace Conference and civil-war martial law (see Internal armed conflict — sizing and resolution, below).

### Troop Training (settled 2026-11-02)
```
Training(army, target_Country_or_Bloc) = decaying_modifier → Diplomacy's
  Military Leverage category, keyed (this Country, target Country/Bloc)
```
- A **commitment** (persistent claim, renewed or released), **public** by default visibility, distinct from the existing Army Tactics — the army must be positioned in a border Region adjacent to the target Country/Bloc.
- Magnitude scales with troop count/efficiency committed.
- **Inherits Garrison/Hold's supply draw** while training (settled; no separate supply rule).
- Recomputed at Diplomacy negotiation time against the target's own Military Leverage plus its Alliance-tier partners' (bloc-pair scoping, `diplomacy__kb.md`).
- Stacks additively with War Exhaustion and other active-war Military Leverage penalties — never replaces them.
- Decay rate, magnitude/efficiency curve, troop-count weighting: numbers pass.

### Occupation (canonical — War-triggered, consequences owned elsewhere)
On capture, every occupied province's `(Nation, Estate, Region)` cells
receive an `occupation` modifier:
- Excluded from grouping into the occupier's own Faction computation (IP's domain — an exclusion flag, not a new Faction mechanic).
- Gains **Grievance: Occupation**, or (if population sympathy favors the occupier as liberator, per Nations' data) a sympathy bonus instead.
- Carries **`martial law`**: raised Administration Control cost, raised uprising-trigger threshold, hampers Espionage against the cell; the garrison requirement is soft and substitutable (see Occupation garrison below).
- Removed by peace ratification (Diplomacy) or unilateral Annexation (reputational/Opinion penalty toward third parties unless pre-agreed).
- After removal, rejoins normal Faction eligibility, may still face ordinary legal discrimination under existing Rights/Duties.
- Vanguard local requisition on occupied cells (settled 2026-11-02) is a requisition: it carries the two Opinion hits toward the occupier (Internal Politics) on top of Occupation Grievance.

### Occupation garrison (soft, substitutable — settled 2026-11-02)
There is no fixed garrison number and no hard requirement. An occupation garrison is a recurring claim like any other, and **troops and Control are interchangeable ways to hold a province**. Sizing is derived from the occupied cells' population and grievance. An unmet garrison raises martial-law Control cost and lowers the uprising-trigger threshold.

### Civil-war martial law (settled 2026-11-02)
Suppression of rebelling cells uses the **same martial-law Control cost** as occupation. The Occupation Grievance does not apply (they are the Government's own citizens); the political cost arrives through Rights revocation and entitlement loss (Internal Politics).

### Naval scope (alpha — settled 2026-11-02)
Sea lanes carry **transport and supply only**: movement along a sea lane is limited by the Ships good (Economics, ordinary production and market rules). There is **no fleet combat and no naval pool** in alpha; fleet battles are post-alpha.

### Internal armed conflict — sizing and resolution (settled 2026-11-02)
- **Retinue Right is a scalar** per cell (like Estate Mobility): the maximum fraction of the cell's **own** armed pools that can serve as retinue. Cells without the Right cannot take the armed rung; their labour inside Government pools can still defect under Administration's leaderless defection rule.
- **Rebel Peace Conference**: internal conflicts resolve through the **same capability-assessment Peace Conference**. Terms use Internal Politics' vocabulary — concessions are Rights/Duties Events, secession is Formation (Countries). Rebels facing the Government alone get only terms the parent accepts or that they win militarily; **recognized** rebels (Countries, international-recognition route) can have terms backed by recognizers (e.g. Guarantee tier).

### War Score (computed ledger, not spendable — revised 2026-11-01)
```
WarScoreEntry = { side, target_cells: set<(Nation,Estate,Region)>,
                  cause: battle|siege|blockade|raid,
                  harm: {casualties, production_destroyed, occupation, ...}   // existing stocks
                  turn }
WarScore(side) = running signed total inflicted minus received
```
Per-cell harm in existing stocks — no Loyalty stock and no persistent
"Faction". Every entry tags the specific cells hit (razed
farmland→Peasantry cells; blockaded trade→Citizens; seized land→Nobility) —
never an undifferentiated per-side number. Enables deliberate cell/Estate
targeting as strategy. Siege writes an entry every turn it holds.
**Attribution**: war harm is attributed to the enemy by default; a cell
blames its own Government only when the Government's causal role is **very
obviously** incompetent (attributability stays near zero until causal
visibility is very high — `internal_politics__kb.md`, Awareness). Declaring
war is a public causal action, so a diversionary war gets no special rally
effect and loses it on aware cells.

### War Exhaustion (derived, per-cell — revised 2026-11-01)
```
Exhaustion(cell)    = read-only derived readout of war-attributable grievance
Exhaustion(Country) = read-only aggregate rollup, never a mechanic input
```
War weariness is not a stored stock: war costs already reach cells through
existing channels — casualties (`origin_cell`), Levy/Requisition Duties,
Supply competing with civilian consumption, raids/siege damage — and become
ordinary grievance. Estate differences (Peasantry, bulk of drafted labor,
accrues fast; Nobility accrues slowly, partly served by the war's Prestige
goal) emerge from exposure, `burden_share` and contribution (military-pool
contribution rises with live war Questions), not from per-Faction rates.
Crossing the general Question trigger can spawn a peace-demanding Question
regardless of the cell's original war stance or Veto status (actor-forced
escalation, Outcome Asymmetry).

### Peace Conference (capability assessment, not War Score arithmetic)
```
peace_evaluation(side, proposed_terms) = f(remaining_Supply_state,
  army_composition_and_readiness, occupied_territory,
  remaining_Exhaustion_headroom(per cell, derived), active_treaty-graph_commitments)
```
Same mirrored-stance negotiation pattern as Administration/Diplomacy.
`WarScore` is **context**, never a direct arithmetic term — it shifts how
a side weighs its own continuation-capability. Ratification removes
Occupation automatically; resolves into Countries-level territorial/treaty
changes.

## Rules
1. Army roster = six pools + Meteomancy/Theurgy-drawn Mages; variants are Estate/culture/tech modifiers, never new pools.
2. Fielded units are Standing Commitments (persistent, origin-traced); garrisons are recurring anonymous claims — loss accounting never shared.
3. Killed labor permanently deducts from origin cell's Army pool.
4. `charge_bonus`/`armor_mitigation`/`armor_speed_penalty` always derived at resolution, never stored.
5. Combat Envelope resolves: base × Estate modifier × terrain modifier, then trait interactions.
6. Attacker movement gated by its single route's `edge_quality`; defenders use the full network — structural, not a stat difference.
7. Formation cohesion gate checked fresh whenever battle triggers.
8. Supply upkeep is a real zero-sum draw against warehouse stock, competing directly with civilian consumption.
9. Fortress `blockade_type` always derived at read-time, never stored.
10. Province-center Fortress sits at `depth = 0.5` unconditionally; multiple settlements carry no independent stocks.
11. Battle phases resolve sequentially, state carrying forward; sub-units resolve pairwise, never pooled.
12. Cohesion persists across battles per unit, never reset to baseline.
13. Occupation is applied by War at capture; its consequences are computed/owned by Internal Politics/Administration/Diplomacy — War doesn't duplicate that state.
14. War Score is a per-engagement log of per-cell harm in existing stocks (no Loyalty stock, no persistent Faction) — never independently spendable.
15. War Exhaustion is a derived per-cell readout of war-attributable grievance; the general Question trigger can spawn a peace Question regardless of original stance/Veto status.
16. Peace conference weighs continuation-capability; WarScore is context only.
17. Gunpowder bonus is conditional on live ammunition Supply.
18. Troop Training only accrues its Military Leverage modifier when the training army is positioned in a border Region adjacent to the specific target Country/Bloc.
19. Troop Training's Leverage modifier stacks with War Exhaustion / active-war Military Leverage penalties, never substitutes for them.
20. Fielding and Supply acquisition: market purchase (Ledger Wealth) by default; a wartime Requisition Duty is an override.
21. War harm is attributed to the enemy by default; a cell blames its own Government only when its causal role is very obviously incompetent.
22. Internal armed conflict is resolved by War; a side need not be a Country.
23. Sea lanes carry transport and supply only in alpha; no fleet combat, no naval pool.
24. Occupation garrison is soft and substitutable with Control; sizing is derived from the occupied cells' population and grievance; civil-war martial law reuses occupation's Control cost.
25. Retinue is a scalar Right; internal conflicts resolve through the same Peace Conference with Rights/Duties-vocabulary terms.
26. Army Tactics are dials; Troop Training is a public commitment inheriting Garrison/Hold's supply draw.
27. Veto-to-declare and Veto-to-continue share one stance function; the difference emerges from live state (e.g. War Exhaustion), not a separate curve.
28. Movement is blocked across an edge between two Mountain hexes unless it is a `mountain_pass` (see World Map Rule 15); supply routes obey the same edge rule.

## Cross-references
- **Economics** — Army pool/envelope ground truth; Heavy Industry goods consumed at fielding; Warehousing backs Supply and equipment purchase.
- **World Map** — province-edge graph is Supply's pathing structure (distinct from trade-zone edges); `infrastructure_level` feeds `edge_quality` and Supply decay; terrain/forestation feed Combat Envelope and Fortress typing.
- **Internal Politics** — Fielding/Killed-casualties trace to `origin_cell` at `(Nation, Estate, Region)`; Occupation's Actor-cell consequences are specified once, in this file (Occupation section); Internal Politics only reads them. Requisition, benefits and attribution rules apply to wartime acquisition and war harm; a faction's armed rung is handed to War (Internal Armed Conflict).
- **Administration** — Occupation's `martial law` Control cost and multi-origin-cell stacking Coordination cost read Administration's pools; War Exhaustion is derived from war-attributable grievance (Internal Politics), not a separate writeback.
- **Diplomacy** — military access agreements extend valid Supply-source territory; unilateral Annexation is a forced-annexation act (Sovereignty-tier CB plus per-observer overreach, `diplomacy__kb.md`); peace ratification's Occupation removal resolves at Diplomacy step 7; Troop Training feeds Diplomacy's Military Leverage category.
- **Nations** — sympathy data determines occupied-population Grievance vs. liberator bonus; Statehood Pathway is the secession end state of internal armed conflict.
- **Characters** — deferred hook for named-commander bonuses and captured-personnel ransom. Beyond alpha (2026-11-01).

## Status
- Roster, Technology Tier, Fielding, Garrison, Combat Envelope (incl. Armor/traits/modifiers), Army Position, Supply, Fortress/Blockade typing, Siege state, Battle resolution, Army Tactics, Occupation, War Score, War Exhaustion, Peace Conference: **settled**.
- All numeric coefficients (envelope values, terrain multipliers, decay/upkeep rates, thresholds, blockade multiplier, siege progress rate): **open, deferred pending pacing pass**.
- Citizens/Clergy combat-modifier flavors; ransom/exchange mechanic (post-alpha, Characters): **open, unresolved**. Naval fleet combat: **post-alpha**; alpha naval scope, garrison sizing and martial-law garrison softness: **settled 2026-11-02**.
- **Troop Training**: **settled 2026-11-02** as a commitment; numeric decay/magnitude open (numbers pass).
- **2026-11-01 overhaul — settled**: per-cell War Score; derived War Exhaustion; market-purchase default + Requisition override for Fielding/Supply; internal armed conflict ownership; war harm attributed to the enemy by default; diversionary war handled by attribution (no special rally rule).
- **2026-11-01 — open** (resolved 2026-11-02 except numbers): Retinue Right sizing; rebel Peace Conference analogue; civil-war martial-law cost; Vanguard requisition Opinion hits; numeric coefficients (pacing).
- **2026-11-02 — settled**: alpha naval scope; soft substitutable garrison; rebel Peace Conference reuse; scalar Retinue Right; civil-war martial law; Troop Training commitment; Army Tactics as dials; Vanguard requisition hits; one stance function for Veto-to-declare/-continue; war-declaration timing (validated and logged step 2, diplomatic effects step 7, hostilities from next turn's step 4).
- **2026-11-03 — settled**: Annexation is a forced-annexation act (Diplomacy CB + overreach); peace-ratification removal of Occupation resolves at Diplomacy step 7; fielding goods come from provincial warehouses; Occupation's consequences are specified only here.
