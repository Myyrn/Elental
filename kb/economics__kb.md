# Economics — Knowledge Base

Status: core mechanisms settled — resource tiers, skilled labor pools,
consumption tiers, money, trade-zone network, warehousing. Formulas/
coefficients open pending pacing pass. Estate-level economic *profiles*
live in `internal_politics__kb.md`, not here.

**2026-11-01 overhaul pass**: Requisition (in-kind claim) and Government
market-buyer rules added; contribution valuation for Internal Politics'
Fairness bucket assigned here (open); Culture/Printed Goods/Teaching output
can be directed to propaganda.

**2026-11-02 rules pass**: contribution valuation settled for Teaching and
Meteomancy/Theurgy (Meteomancy rituals carry authored relative prices);
three-pool default coefficients moved here from Administration (numbers pass).

**2026-11-02 (second pass)**: Credit (obligation records), Prices, minting
content/fineness, `trade_infrastructure_level`, Land share bookkeeping and the
Teaching dead-end rule settled; numeraire for authored relative values is the
money metal (Refined Precious Metals), not a food unit.

## Data Structures

### Resource Tiers (45 goods, 5 tiers)
| Tier | Count | Goods |
|---|---|---|
| Raw | 16 | Grain, Livestock, Fine Horses, Fish, Timber, Stone, Iron Ore, Precious Metal Ore, Coal, Sulfur, Fiber, Wool, Hides, Salt, Herbs, Magical Reagents |
| Semi-Finished | 13 | Flour, Lumber, Cut Stone, Steel, Refined Precious Metals, Cloth, Tanned Leather, Preserved Food, Gunpowder, Processed Reagents, Paper, Ink, Quills/Printing Colors |
| Light Industry | 6 | Bread, Garments, Furniture/Household Goods, Medicine, Consumer/Luxury Goods, Printed Goods |
| Heavy Industry | 7 | Cold Weapons, Armor, Firearms, Artillery, Tools & Machinery, Ships, Fortifications |
| Transport | 3 | Draft Animals, Carts/Carriages, Transport Machinery (later tech) |

Flexible sourcing: Preserved Food (Livestock or Fish+Salt); Draft Animals (Livestock or Fine Horses). Fuel (a Subsistence need, not a good) is met by Coal or Lumber. Magical Reagents→Processed Reagents is a
terminal two-tier chain, consumed by ritual action, never stockpilable.

### Skilled Labor Pools (19, independent, non-fungible)
`Agriculture, Mining, Woodcraft, Crafting/Industry, Meteomancy/Theurgy,
Culture, Medicine, Builders, Diplomacy, Espionage, Trade/Commerce,
Teaching, Bureaucrats, Shock Infantry, Pike Infantry, Skirmishers,
Cavalry, Artillery, Siege Corps`

- No pool converts to another except via Teaching (target-pool-specific). **Permanent loss is possible (settled 2026-11-02)**: a pool with zero population in a whole Country cannot be taught back and is recoverable only by importing teachers from another Country (Diplomacy's LaborMigrationBan axis); a pool absent from one cell but alive elsewhere in the Country rebuilds normally at the Teaching rate; a pool extinct worldwide stays gone. Resurrecting a tradition from zero (events/politics) is post-alpha and not designed.
- Each pool is a **dual-claim stock**: normal production output, or administrative directive output (Control/Coordination/Observation) — mutually exclusive, zero-sum per turn. The split is set by an Allocation Dial (`actions__kb.md`): floors for administrative and Army claims by priority, production as the natural sink.

### Administrative Capability Envelope (per pool — production side)
```
envelope(pool) = { Control: c, Coordination: n, Observation: o }   // fixed ceiling
combined_envelope(axis) = Σ [pool_units_committed × pool_envelope(axis)] / total_units_committed
```
No hardcoded institutions exist in the data model — a directive is a
player-set C/C/O weighting over whichever pool(s) are committed that turn.
This is the **production** step only; targeting the resulting output to
specific Actor cells is Administration's Control Allocation (see
`administration__kb.md`) — Economics owns the labor-supply fact, not the
targeting layer. Coefficients per pool: **open, deferred**.

### Consumption Tiers
| Tier | Goods | Failure |
|---|---|---|
| Subsistence | Bread or Preserved Food, Garments, Fuel | Crisis state after sustained failure |
| Comfort | Furniture, Medicine, higher-volume Garments/Fuel | Pressure only |
| Luxury | Consumer/Luxury Goods, Printed Goods | Status signal only, no material cost |

Resolution order: Subsistence → Comfort → Luxury, each gated by market
access/tariffs/throughput. Taxation applies **after** the cascade.

**Requisition (settled 2026-11-01)**: an Internal Politics
Requisition Duty is an in-kind claim on a good or Skilled Labor pool, scoped
to a cell, Estate, Nation, Region or Empire. It resolves
*before* the cell's cascade; any shortfall feeds subsistence Grievance
through normal channels. Taxation is unchanged (post-cascade). Because it bypasses the Prestige/market structure, a shortage propagates through the normal cascade and prices to the wider society — except where the good is abundant, where no shortage arises (the Opinion cost remains; see Internal Politics).

**Government as buyer**: absent a Requisition Duty the Government buys
goods and labour as an ordinary market participant (Ledger Wealth, tariffs,
throughput, prices) and competes with cells under the usual rules.

### Non-Material Consumption Channel
Fed by Culture-good output, satisfies IP's Grievance buckets
(Identity/Autonomy, Solidarity, Purpose/Meaning; Faith/Cosmology open).
**Not stockpiled** — unconsumed output is lost each turn.
Culture-good, Printed Goods and Teaching output may instead be
*directed* to propaganda/education (Internal Politics' cell Preference
vectors) — zero-sum with its ordinary use, not a new pool-claim type (settled 2026-11-03).
Capability is pool-gated, not tech-gated (Government propaganda draws on
Administration's Coordination pool instead); later tech eras are intended to
amplify it (post-alpha, not designed). Printed Goods consumption is also an
awareness input; abundance alone does not set orientation.

### Contribution valuation (supplies Internal Politics' Fairness bucket — settled 2026-11-02 except ritual catalogue)
```
contribution_share(cell) = cell's share of current value to the common pool
  = f(market output value × pool scarcity)      // derived, never stored
```
Economics owns the valuation; Internal Politics owns the bucket. Market
output is straightforward; non-market contribution = **need satisfaction
delivered** (settled 2026-11-01): military pools scale with live war
Questions, Culture/Clergy with the grievance their output relieves. For
landholding Estates the computation uses the Land layer (below).
- **Teaching (settled 2026-11-02)** has two outputs. *Retraining* is credited as the **marginal value the conversion adds**, as a flow while conversion happens (not a permanent credit; avoids double-counting with the receiving cell's own output). *Education/propaganda* directed at cells is valued like Culture (need relief delivered: Identity, Awareness).
- **Meteomancy/Theurgy (settled 2026-11-02, revised 2026-11-03)** is its own arcane pool (not Clergy) and **not a mana-like commodity**. Its rituals are preconditions for special actions (Actions: Ritual) that directly resolve, alleviate or change a crisis. Every **population-scale** ritual type gets a **manually authored relative price**, a multiple of the numeraire (a unit of Refined Precious Metals, the money metal) — relative, never absolute; **character-scale rituals are post-alpha**. The authored price is the ritual's value in numeraire units: contribution = authored price × rituals performed (× the general pool-scarcity factor applied to every pool). There is **no scarcity market and no live-crisis demand term**; a crisis is changed by the ritual's own authored effect. Reagent inputs are real goods, but their cost is not itself contribution.
- **Open**: the ritual catalogue (which rituals exist in alpha) and their effects; the prices themselves (numbers pass).

### Land (ownership share — settled 2026-11-02)
Land ownership is a Right (Internal Politics checklist) expressed as a
per-cell ownership share of a province's output — no stock separate from
Wealth; the owner's income is its share of that production.
- **Shares** across holders total at most 1; the **remainder stays with the producing cells** as ordinary output.
- **Absentee holders allowed**: a cell may hold shares in provinces outside its own Region.
- **Transfers** only through Events (grant/revoke a Right, sale, conquest/occupation per War); inheritance is not modeled.
- **Order**: production → **Land split** → Requisition → consumption cascade → taxation (see Resolution order).
- **No double-dip**: Land applies to origin production; Estate-Tariffs apply to transit. They are different bases; one cell holding both is intended (subinfeudation).
- Feeds `contribution_share` for landholding Estates. Numeric shares: numbers pass.

### Money (settled 2026-11-02)
Single world-wide metallic standard. Refined Precious Metals *are* money;
minting = conversion to coined form (State-only unless granted as a Right).
No exchange-rate layer.
```
Coin = { face_value, fineness }        // fineness = metal content
price_level = f(coined_money_supply / cleared_transaction_volume)
```
- **Debasement is a content parameter** on the Mint Event (minting/recoining at lower fineness) — not a separate event type.
- **Fineness record per issuer**: each issuer's fineness is a derived record of its mint events.
- Coins are legal tender at **face value** domestically; between issuers they are valued by **fineness** — the standard is metal weight, so no exchange-rate table exists.
- Face-value supply drives `price_level` (inflation); the issuer's gain (seigniorage) is the metal saved.
- **Loans stay nominal** (face value): debasement erodes creditors' real claims (see Credit).
- Debasement is a causal action (public or covert in the Decision Log); discontent follows awareness × causal visibility (Internal Politics).
- Open: recoinage cost; how fast an issuer's fineness record shifts (numbers pass).

### Credit (obligation records — settled shape 2026-11-02)
```
Obligation = { creditor: cell, debtor: cell | Government, principal_outstanding, terms }
net_position(actor) = Wealth + Σ claims − Σ obligations owed      // derived
```
- **No anonymous debts**: every debt is an obligation record with a named creditor.
- **Any cell may lend unless a law forbids it**: Lending is a Rights-checklist permission (default permitted, forbiddable per scope); cells lend to each other and to the Government.
- **Cells are actors (2026-11-03)**: a cell lends where Lending is permitted (default permitted), out of Wealth beyond its own needs, and borrows against shortfalls; the Government's demand is its Borrow Event. Credit still resolves as one derived market pass (supply, demand, clearing) and clearing creates obligation records.
- **Interest is derived** per trade zone from lendable Wealth versus demand, with an **optional legal ceiling** (usury law) as a Right/Duty. Numbers pass.
- **Range follows the trade-zone network, like goods**: mostly within a zone; inter-zone lending is possible through zone edges (cross-Empire edges gated by Diplomacy). Cross-zone friction (settled 2026-11-03) is a spread between zone rates, derived from the lower of the two hubs' `trade_infrastructure_level` and any Diplomacy gating on the edge; lending flows until the rate gap equals the spread. No new stock. Cross-Country default has no collection mechanism: the creditor's remedy is Opinion/Grievance and a Rights-tier CB for its Country.
- **Debt service (settled 2026-11-03)** comes after the consumption cascade (necessities first) and taxation; a shortfall is arrears; default costs the creditor its claim and Opinion/Grievance, and the debtor's net position falls (Demotion Duty trigger).
- **Loans stay nominal**: debasement hurts creditors (Money).

### Prices (settled shape 2026-11-02)
```
price(good, zone) = base_value(good) × scarcity(good, zone) × price_level   // derived at resolution, never stored
```
- **base_value is manually authored and relative**, expressed in units of the **numeraire — Refined Precious Metals (the money metal)**; same convention as Meteomancy ritual prices.
- **scarcity** is derived from the zone's supply–demand balance at resolution, in **a single pass** inside Economics' step (no stored prices, no equilibrium solver).
- Cross-zone flows move goods from surplus to shortage up to `throughput_cap`, net of tariffs.
- The global `price_level` applies to all goods; the numeraire's own scarcity is expressed through `price_level`, not through its own multiplier (settled 2026-11-03).
- Open: scarcity function shape (numbers pass).

### Resolution order within Economics (settled 2026-11-03)
production → **Land split** → Requisition (pre-cascade) → consumption cascade → taxation → debt service (existing obligations) → credit clearing (new loans, Borrow) → Ledger → Government upkeep shortfall (Actions pipeline step 3). Government market purchases are funded from the start-of-turn Ledger balance; this turn's taxation lands for next turn.

### Trade-Zone Network
- Provinces form a graph via World Map adjacency.
- Membership **derived, not stored**: `trade-gravity = production_output × trade_infrastructure_level`; resolves to strongest-pulling neighbor hub. No separate hysteresis rule (settled 2026-11-02): membership is always derived at read time (Rule 7) and the slow-moving `trade_infrastructure_level` stock damps hub switching.
- Not bounded by Country borders. No entity is specially "a capital" — just the highest-gravity province.
- `trade_infrastructure_level` is an Economics-owned **per-province stock** (commercial institutions: markets, banks), **distinct** from World Map's `infrastructure_level` (roads/logistics) — settled 2026-11-02: built with Builders + Wealth by **any cell including the Government unless forbidden** (Rights checklist: Trade-infrastructure construction, default permitted); decays without upkeep; **no Trade/Commerce labour cap**. **No builder return (settled 2026-11-02)**: it is a costly public investment whose payoff is the increased flow of goods that benefits everyone if built at the proper time.

### Trade-Zone Edges
```
edge = (zone_A, zone_B, throughput_cap, current_flow)
```
`throughput_cap` is a hard per-turn ceiling, raised by infrastructure
investment. Cross-Empire edges additionally gated by Diplomacy.

### Estate-Tariffs
```
shipment_value_realized = base_value − State_tariff(origin) − Σ estate_tariff(transit) − State_tariff(destination)
```
Levied by any Actor/Estate-cell holding Local Jurisdiction over a transited
province. Affects extracted value only, never `throughput_cap`.

### Warehousing (per province)
```
warehouse(province) = { capacity, built_cost, upkeep_cost }
```
Tracked per province (not per zone). Built via Builders + Wealth. Overflow:
perishables spoil at a decay rate; non-perishables degrade slower, exposed
to theft/seizure during unrest.

```
Placeholder pools (flag placeholder = true, replaceable at the numbers pass): Fishing, Reagent Gathering
raw-good extraction pool (authored per good): Agriculture <- Grain, Livestock, Fine Horses, Fiber, Wool, Hides, Herbs
                                              Mining      <- Stone, Iron Ore, Precious Metal Ore, Coal, Sulfur, Salt
                                              Woodcraft   <- Timber
                                              Fishing*    <- Fish          Reagent Gathering* <- Magical Reagents
Government inventory: requisitioned goods go to an abstract Government inventory consumed by upkeep
                      (army supply still draws provincial warehouses)
```


## Rules
1. No pool converts to another except via slow Teaching.
2. Labor committed to an administrative directive is fully unavailable to production that turn (zero-sum, no partial residual).
3. No named administrative institution is hardcoded — all C/C/O output is a computed pool-blend.
4. Consumption resolves Subsistence→Comfort→Luxury strictly; Taxation is post-cascade.
5. Non-material consumption is never stockpiled.
6. Money is a single global standard; no per-country currency/exchange rate.
7. Trade-zone membership is always computed at read-time, never persisted.
8. Estate-tariffs modify realized value only, never `throughput_cap`.
9. Warehouse capacity is a province-level stock, independent of current trade-zone membership.
10. Requisition is a pre-cascade in-kind claim; Taxation stays post-cascade.
11. Absent a Requisition Duty the Government is an ordinary market buyer.
12. Propaganda/education draws on the same Culture/Print/Teaching output, zero-sum with its ordinary use.
13. No anonymous debts: every debt is an obligation record with a named creditor; lending is a Rights permission (default allowed) resolving through a derived credit market.
14. Interest is derived per trade zone (optional legal ceiling); lending range follows the trade-zone network like goods; loans stay nominal.
15. Prices are base_value (authored, relative, in numeraire units) × derived scarcity × global price_level, computed in a single pass; never stored.
16. Debasement is a content (fineness) parameter on the Mint Event; fineness is recorded per issuer; coins trade at face domestically and by fineness between issuers.
17. Land shares total at most 1 per province, the remainder stays with the producing cells; the Land split precedes Requisition.
18. `trade_infrastructure_level` is a per-province stock any permitted cell may build; it decays without upkeep and carries no labour cap.
19. Permanent loss of a Skilled Labor pool is possible; recovery requires importing teachers.
20. Raw goods are extracted by an existing labour pool where one fits, otherwise by a placeholder pool.
21. Processing labour is allocated across feasible recipes by value added (price of output − input cost); the Government's `planning_posture` dial blends this toward Government-demanded goods.
22. Labour and population spread over the provinces of a Region by the cell's presence share per province.


## Cross-references
- **Internal Politics** — Estate economic profiles use this file's vocabulary; unmet consumption feeds Grievance; Local Jurisdiction enables estate-tariffs.
- **Administration** — consumes envelope output via Control Allocation (targeting layer, not defined here).
- **World Map** — terrain/adjacency feeds yields and the trade graph; `infrastructure_level` ≠ `trade_infrastructure_level` (see World Map Rule 9).
- **Diplomacy** — reads trade capacity; gates cross-Empire edges (TradeAccess/ResourceExportBan axes).
- **War** — Firearms/Artillery build+use cost; garrison-directed Army labor competes with War's draw on the same pools.
- **Internal Politics (2026-11-01)** — Fairness bucket reads this file's contribution valuation; Requisition Duty and Government material needs defined there; propaganda directs Culture/Print/Teaching output. **(2026-11-02)** Ledger inflows read State tariffs and minting here; Borrowing creates obligations settled through Wealth Flow channels.
- **Administration (2026-11-01)** — enforces Requisition scope via Control Allocation; unmet Government upkeep degrades C/C/O.
- **Internal Politics (2026-11-02)** — Rights checklist gains Lending and Trade-infrastructure construction (default permitted); Wealth debt becomes obligation records; Demotion Duty reads net position.
- **Diplomacy (2026-11-02)** — cross-Empire edges also gate inter-zone lending; LaborMigrationBan blocks teacher import after pool extinction.

## Status
- Resource tiers, pool list (19), consumption tiers, money standard, trade-zone shape, estate-tariffs, warehousing ownership: **settled**.
- Envelope coefficients, production-chain formulas, Teaching retraining rate, trade-gravity formula: **open, deferred** (numbers pass).
- **2026-11-01 — settled**: Government buys under ordinary market rules absent a Requisition Duty; Requisition exists at any scope; propaganda capability is pool-gated.
- **2026-11-03 — settled**: propaganda as directed (not new-claim) pool output.
- **2026-11-01 — open** (contribution valuation resolved 2026-11-02): tech-era propaganda amplification (post-alpha).
- **2026-11-01 (confirmed) — settled**: Requisition is pre-cascade; non-market contribution = need satisfaction delivered.
- **2026-11-01 — exogenous shocks**: harvest variance perturbs yields; epidemic burden is read against the Medicine pool (World Map holds the risk drivers); no Events module in alpha. Variance magnitudes: numbers pass.
- **2026-11-02 — settled**: Teaching valuation (retraining as marginal flow; education/propaganda like Culture); Meteomancy/Theurgy valued by authored relative per-ritual price anchored to a numeraire (a unit of Refined Precious Metals, the money metal); no scarcity market and no crisis-demand term (2026-11-03).
- **2026-11-02 — open**: ritual catalogue, effects and prices (numbers pass); three-pool default envelope coefficients (moved here from Administration, numbers pass).
- **2026-11-02 (later) — settled**: credit as obligation records with a derived, nominal market (interest derived per zone, optional legal ceiling, range follows the trade-zone network); `trade_infrastructure_level` as a per-province stock; Land share bookkeeping and ordering (absentee holders allowed); Prices = authored base × derived scarcity in a single pass, numeraire = the money metal; minting content/fineness parameter with a record per issuer; Teaching permanent loss.
- **2026-11-02 (later) — confirmed**: credit as a derived market; Wealth never negative with derived net position; no builder return on trade infrastructure.
- **2026-11-02 (later) — proposed/open**: recoinage cost; numeric shapes (numbers pass). Debt-service position and numeraire scarcity via price_level settled 2026-11-03.
- **2026-11-03 (dial pass) — settled**: dual-claim pool splits use the Allocation Dial (floors for administrative/Army claims by priority, production as the sink); Government spending is a standing dial with a reserve floor (Actions, Internal Politics).
- **2026-11-03 — settled**: cells are actors (credit supply/demand are cell acts, cleared as one derived pass); debt-service position; numeraire scarcity via `price_level` (now in the price formula); cross-zone friction spread; propaganda as directed output; Government purchases funded from the start-of-turn Ledger; Meteomancy revised (rituals are preconditions for crisis-resolving actions, no scarcity market, character-scale post-alpha); Fuel is flexible sourcing, 45 goods.
- **2026-11-04 — settled**: placeholder pools; extraction-pool map (placeholders aside); production-planning rule; Government inventory.
