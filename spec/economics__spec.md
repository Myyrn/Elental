# Economics — Specification

KB: `kb/economics__kb.md`. Mirror of its `##/###` headings; cross-references live in kb only. Split out of `economics_polity__spec.md` (§1–§5, the Economics rules and tuning keys) on 2026-11-13; the Internal Politics part lives in `internal_politics__spec.md`. Synced to kb 2026-11-15 (Trade-Zone Network rev 4, Credit rev 2); **2026-11-24: the derive `produceCCOByRegion` (written 2026-11-21 for the assembly queue) is added to the Administrative Capability Envelope section (no kb change), and two stale lines about the structural Requisition hit are corrected**. Besides kb, sources: `src/modules/economics/{derive,step,upkeep,teaching,module}.js`, `src/modules/diplomacy/border.js` (borderOpenness), `src/kernel/allocation.js` (row `pool` tag), `tests/econ_polity.test.js`, `tests/economics_upkeep.test.js`, `tests/economics_zones.test.js`, `tests/polity_queue.test.js`; for `produceCCOByRegion` only `administration__spec.md` and the changelog of 2026-11-22 (`src/modules/economics/derive.js` was not re-read on 2026-11-24). Where code and the old spec disagree, **code wins** (**code-led**) — except where the designer has decided for the kb (2026-11-13/14/15, marked **(code to follow kb)**). Anything the kb does not state is **(spec decision)**; both are listed under Status. Sections the code has not reached are **(target)**.

## Data Structures

State and conventions:
```js
state.economy = { warehouses: Record<provId, {capacity: number|null /*null = unlimited, JSON-safe*/, stock: Record<good, number>}>,
                  tradeInfra: Record<provId, number>, obligations: Obligation[], coinage: {supply, ratio0, lastVolume, issuers?: Record<Id, fineness>},   // issuers: target
                  land: Record<provId, {holder: CellKey, share: number}[]>, lastOutput: Record<provId, number> /*@cache*/,
                  lastMarket: Record<zone, Record<good, {stock, demand, price}>> /*@cache for the Economy workspace*/, lastRate: Record<zone, number> /*@cache*/ }
state.admin.governments[country].poolUnmet: Record<pool, number>          // written by ledgerUpdate every turn (replaced, never accumulated); read by produceCCO
cell (polity slice) fields read/written here: labour, labourCommitted, population, wealth, laborProfile, hoardFrac, hoard, cash, salesValue, salesValueBase, purchases, satisfaction{subsistence,comfort,luxury}, shortfall, flow.teaching, defiance.tax
ctx.scratch (per step 3, never persisted): zs, need, demand, mil, prod, sales, price(g,z), signal(p,g), lastOutput, tax[country]
T = ctx.T            // every number is a tuning key; ruleset.goods[g] = {tier, baseValue, recipe?: {pool, labourPerRun, inputs:[{any:[good], qty}], outQty}, extractPool?, decayRate?}
const cellProvShare = (ctx, key, p) => ctx.derive.worldmap.cellProvShare(key, p)      // labour/population spread over the Region's provinces by presence share (Rule 22)
```

### Resource Tiers (45 goods, 5 tiers)
Code: data in the scenario ruleset (`ruleset.goods`, built by `tools/buildRuleset.mjs`; `tests/fixtures.js` carries a reduced set)
- `ruleset.goods[g].tier ∈ raw | semi | light | heavy | transport`; the 45-good list is data, not code. Alternatives are `recipe.inputs[].any` / `ruleset.consumption[tier][].any` (Preserved Food from Livestock or Fish+Salt; Draft Animals from Livestock or Fine Horses; Fuel need met by Coal or Lumber, a need not a good). Magical Reagents → Processed Reagents is a terminal chain consumed by ritual action, never stockpilable (target: the consuming Ritual action does not exist).
- Raw goods carry `extractPool` (map below); processed goods carry `recipe.pool`.

### Skilled Labor Pools (19, independent, non-fungible)
Code: `derive.js` (`poolLabour`, `labourAt`), `teaching.js`; `ruleset.pools[pool] = {kind?, envelope?, combat?, placeholder?}`
```js
poolLabour(ctx, key, pool) = max(0, cell.labour[pool] − (cell.labourCommitted?.[pool] ?? 0))      // production side of the dual-claim split
labourAt(ctx, p, pool)     = Σ over the Region's cells of poolLabour × cellProvShare(cell, p)      // zero-sum: committed labour is fully unavailable to production
```
- `labourCommitted[pool]` is the claim taken off production by the pool split (administrative C/C/O commitments, Army fielding, Espionage, Teaching directed share). Dual-claim resolution by an Allocation Dial (`actions__spec.md` Shared pools): `setPoolSplit` is **not in code** (`administration__spec.md`); today commitments are written directly by the consuming modules.
- Teaching is the only conversion (below); permanent loss through `extinctPools`.
- **Pool wiring audit (open in kb)**: verified live sinks in code: Agriculture/Mining/Woodcraft (extraction), Crafting/Industry (processing recipes), Teaching (retraining), pools with `envelope` (C/C/O through `produceCCO`), army pools (War fielding), Espionage (covert labour). **Not verified**: Meteomancy/Theurgy (no ritual action), Culture (non-material channel), Medicine (epidemic burden), Builders (infrastructure/warehouses), Diplomacy, Trade/Commerce, placeholder pools Fishing and Reagent Gathering.

### Administrative Capability Envelope (per pool — production side)
Code: `derive.js` (`produceCCO`, `produceCCOByRegion`)
```js
// kb (settled 2026-11-14): per committed unit, linear — no division by total units
produceCCO(ctx, country)[axis] = Σ over the Country's cells, over pool in cell.labourCommitted:  units × ruleset.pools[pool].envelope[axis] × (1 − (gov.poolUnmet?.[pool] ?? 0))
// → {control, coordination, observation}
produceCCOByRegion(ctx, region)[axis] = the same sum restricted to the cells whose Region is `region`                         // (2026-11-21, for the assembly queue; same `poolUnmet` factor of the Region's owner)
// → {control, coordination, observation};  Σ over a Country's Regions = produceCCO(country)
```
- Code matches the kb (a plain sum of unit × envelope, with the `poolUnmet` degradation read). The first reading of 2026-11-13 (a blend dividing by total committed units) was dropped by the designer on 2026-11-14: a pool with no committed units gives nothing, and output stays linear for large numbers.
- **`produceCCOByRegion` (2026-11-21, written, tests not yet run)**: the envelope of the pools **staffed from one Region's cells**, the Coordination of a Region's assembly (`administration__spec.md`, Assembly Queue: `assemblyCoordination(Region r)` reads `.coordination` and multiplies by `1 − extensionShare(owner)`). It adds no new rule and no new data: the Country sum stays the source, and the per-Region split follows from where the committed labour sits (a pool committed from a cell counts for that cell's Region). The Country's assembly uses `produceCCO(country)` as before. **(spec decision, not in the kb)** the additivity `Σ_regions produceCCOByRegion = produceCCO` is the test to pin (`tests/queue.test.js` is expected to check it; **not verified**). A `gov.coordinationSupply` override (scenario/test hook) is split by population by Administration, not here.
- **Pinned by tests (2026-11-15)** in `tests/economics_upkeep.test.js`: no committed units gives nothing; doubling committed units doubles every axis; the split across cells does not matter; a second pool adds without diluting the first; `poolUnmet[pool] = 0.5` halves that pool's contribution only.
- Upkeep degradation reads `gov.poolUnmet[pool]`; the writer is in `ledgerUpdate` (Resolution order below, implemented 2026-11-15).
- Targeting to cells: Control/Observation Allocation (`administration__spec.md`). Coefficients per pool are data (`envelope`), numbers pass.

### Consumption Tiers
Code: `step.js` (`cascade`, `dutyValue`), `ruleset.consumption[tier] = [{any:[good], perCapita}]`
```js
cascade (step 3, after pricePass): for keys sorted:
  cell.salesValue = Σ prod[g] × price(g, zone);  salesValueBase = Σ prod[g] × baseValue(g)
  cell.cash = salesValue + wealth × T('cash.wealthFraction');  cell.purchases = 0
for tier of subsistence → comfort → luxury (global per tier, so scarcity hits luxury first):
  for item of tier: for each cell: good = cheapest alternative ON THE MARKET (stock > 0), need = perCapita × population,
        q = min(need, cash / price);   no marketAccess(key) (polity Right) → q = 0 for the cell
    per (zone, good): fill = min(1, zoneStock / (Σ q + militaryDemand)) — the army is a participant in subsistence; its share stays in stock for War step 4
    buy: zoneTake, cash −= q × price, purchases += cost
  cell.satisfaction[tier] = mean over items of min(1, bought/need)
cell.shortfall = (1 − satisfaction.subsistence) × Σ subsistence need value (base values)         // credit demand
```
- Subsistence failure → grievance through the polity accumulator (`internal_politics__spec.md`); Comfort pressure only; Luxury status signal only.
- **Requisition** (below Resolution order) and **Government as buyer**: see there. Tier-first under a cash limit and goods conservation are tested.

### Non-Material Consumption Channel
Code: none in `economics/`; `cell.reliefDelivered` is read by `contribution` and written by the polity step (not verified)
- Target: Culture-pool output (`labour × rate`, minus the directed share) relieves Identity/Solidarity/Purpose by grievance × population weighting; never stockpiled; Culture/Print/Teaching output may instead be directed to propaganda/education (polity `propaganda`/`counterPropaganda`, zero-sum with ordinary use, `ctx.derive.polity.directedShare(key, pool)`).
- Teaching reads `directedShare` (code, below); Government propaganda draws on Coordination (`administration__spec.md`). Printed Goods consumption is also an awareness input (polity; **not in code**).

### Contribution valuation (supplies Internal Politics' Fairness bucket — settled 2026-11-02 except ritual catalogue)
Code: `derive.js` (`poolScarcity`, `contribution`)
```js
poolScarcity(pool) = (Σ all labour / Σ labour[pool]) ^ T('contrib.beta')          // (code-led) no division by mean scarcity
contribution(key)  = salesValueBase × poolScarcity(main pool of the cell) + (cell.reliefDelivered ?? 0) + T('teach.value') × (cell.flow?.teaching ?? 0)
```
- Market output valued at `baseValue`, not live price; non-market contribution = need satisfaction delivered (military scales with live war Questions; Culture/Clergy with relief) via `reliefDelivered` (polity); Teaching retraining credited as a flow; education/propaganda valued like Culture.
- **Meteomancy/Theurgy**: `ritualAuthoredPrice × ritualsPerformed` is **not in code** (no Ritual action); prices are authored relative multiples of the numeraire; character-scale rituals post-alpha; no scarcity market and no crisis-demand term.
- Landholding Estates add the Land layer through `landSplit` (output already includes the held share).

### Land (ownership share — settled 2026-11-02)
Code: `step.js` (`landSplit`)
```js
state.economy.land[p] = [{holder: CellKey, share}]          // Σ share ≤ 1; remainder stays with the producing cells; absentee holders allowed
landSplit(ctx): for each province p, holder h, producing cell k of p's Region (k ≠ h):  take = prod[k][g] × h.share × cellProvShare(k, p);  prod[k][g] −= take;  prod[h][g] += take
```
- Order: production → Land split → Requisition. Land applies to origin production; Estate-Tariffs to transit (no double dip). Transfers only through Events (grant/revoke a Right, sale, conquest) **(target: no transfer Event in code)**. `T`-free: numeric shares are scenario data.
- **(spec decision)** the holder takes the share from every producing cell of the Region in proportion to that cell's presence share in `p`.

### Money (settled 2026-11-02)
Code: `derive.js` (`priceLevel`); Mint: none
```js
priceLevel(ctx) = ((coinage.supply / coinage.lastVolume) / coinage.ratio0) ^ T('money.kappa')           // numeraire scarcity lives here only
coinage.lastVolume = max(1e-9, Σ cells salesValueBase)         // set at the end of step 3
mint {metal q, fineness f} (target, event): F = q × baseMetalValue / f;  coinage.supply += F;  issuers[issuer] = weightedAverage(its mint events);  seigniorage = F − q × baseMetalValue
```
- Single world-wide metallic standard; Refined Precious Metals are money; coins are legal tender at face value domestically and by fineness between issuers; loans stay nominal; debasement is a content parameter on `mint` (public or covert in the Decision Log; awareness × causal visibility, polity). Recoinage cost and fineness record shift speed: numbers pass.
- `mint` is State-only unless granted as a Right (`Minting`); not in code (also no seigniorage inflow in `ledgerUpdate`).

### Credit (obligation records — settled shape 2026-11-02)
Code: `step.js` (`debtService`, `creditClearing`), polity `step.js` (`readPolityQueue`)
```js
Obligation = {id: `o<n>.<turn>`, creditor: CellKey, debtor: CellKey, principal, arrears}     // (code-led) cells only; Government as debtor/creditor: target
netPosition(actor) = wealth + Σ claims − Σ obligations owed                                      // derived (polity Demotion reads it)
debtService (after taxation):  due = principal × (lastRate[zone] ?? credit.r0);  paid = min(due, debtor.wealth);  transfer;  arrears += due − paid
                               arrears > debt.arrearsLimit × principal → ctx.polityQueue.defaults.push({creditor, debtor, principal}), obligation removed (auto-default)
creditClearing (one pass per zone, cells sorted by key):
  lenders   = cells with polity.canLend(key) and wealth > population × credit.reservePerCap → supply (wealth − reserve) × credit.lendFraction, desc
  borrowers = cells with shortfall > 0 → demand shortfall, desc
  r = min(polity.legalCeiling?.(zone) ?? ∞, credit.r0 × (Σ demand / Σ supply)^credit.eta);  lastRate[zone] = r
  greedy match → Obligation records (no anonymous debts); wealth moves lender → borrower
```
- Debt service comes after the cascade and taxation. **Default consequences (kb rev 2, implemented 2026-11-15)**: polity step 5 consumes `polityQueue.defaults` (`readPolityQueue`, `internal_politics__spec.md`, Credit default consequences): the creditor cell takes an Opinion-toward-Government hit and a Fairness grievance, each `coefficient × loss`, `loss = principal / (wealth + principal)`; the debtor takes no extra hit (its net-position effect works through the removed obligation and Demotion's `netPosition`). The Rights-tier CB for a cross-Country default is Diplomacy's and is **not wired**.
- **Not in code**: the Government Borrow Event (`borrow`, `defaultDebt`; `gov.borrowedThisTurn` is read by `ledgerUpdate` but nothing sets it), cross-zone lending and the spread rule (`friction = f(min hub tradeInfra, Diplomacy gating)`), interest accrual beyond `principal × rate` per turn.
- **(spec decision)** `rate` per turn is `principal × zone rate`; principal does not amortise.
- Tests: `tests/econ_polity.test.js` (shortfall cells borrow through explicit obligations); `tests/polity_queue.test.js` (default removes the obligation and hits the creditor).

### Prices (settled shape 2026-11-02)
Code: `step.js` (`pricePass`), `derive.js` (`scarcity`, `priceLevel`)
```js
price(g, z) = baseValue(g) × scarcity(S[z][g], Dm[z][g]) × priceLevel          // derived at resolution, nothing stored (lastMarket is a re-derivable cache)
scarcity(S, D) = clamp((D + T('scar.eps')) / (S + T('scar.eps')), T('scar.min'), T('scar.max')) ^ T('scar.elasticity')
pricePass: S = zone stock;  Dm = cells' tier needs (best alternative by stock) + military demand; pre = base × scarcity × level
  for each zone edge, each good: cap = throughputCap(a,b) × (diplomacy.tradeFactor(a,b,g) ?? 1);  [lo, hi] by pre price
    if pre(hi) > pre(lo) × (1 + T('flow.friction')): q = min(cap, max(0, S[lo] − Dm[lo]) × T('flow.share'), stock(lo)) → move goods lo → hi, update S
  final price(g, z) recomputed once from post-flow balances (no equilibrium solver)
```
- **(code-led)** friction is a constant `flow.friction`, not `1 / max(eps.infra, minTradeInfra(edge))`; no tariffs inside the flow (Estate-Tariffs target); no stored `currentFlow` (kb edge record); price pass runs after production and Requisition. Open: scarcity shape (numbers pass).

### Resolution order within Economics (settled 2026-11-03)
Code: `step.js` (`step3`), `upkeep.js` (`poolUnmetFrom`)
```js
step3(ctx): ctx.scratch = {};  L0 = {country: gov.ledger}                      // start-of-turn balance: Government purchases fund from it
  production → landSplit → requisition → pricePass → cascade → taxation → debtService → creditClearing → stepTeaching → ledgerUpdate(L0)
  then lastOutput, trade infrastructure decay (tradeInfra −= T('infra.decay'), floor 0), coinage.lastVolume
requisition (pre-cascade): for each country's requisition entry e, covered cell k: have = prod[k][good];  claimed = fraction ? amount × have : amount
  delivered = min(have, claimed × polity.compliance(k).involuntary);  prod[k][good] −= delivered;  gov.inventory[good] += delivered
  ctx.polityQueue.requisitionHits.push({cell, country, target, claimed, delivered, value: delivered × baseValue(good), shortfall: claimed − delivered})
taxation (post-cascade): rate = polity.duty(key, 'Taxation', {market, wealth}) per cell;  due = rate.market × salesValue + rate.wealth × wealth
  paid = min(due × involuntary × (1 − defiance.tax), cash);  cash −= paid;  wealth = wealth + salesValue − purchases − paid (floored at 0);  tax[country] += paid
ledgerUpdate: r = resolveAllocation(g.spendingDial ?? {entries: []}, L0[country], scopeCtx);  spent = Σ grants;  mandatory = rows with `mandatory`
  g.upkeepFraction = need > 0 ? clamp01(1 − Σ mandatory grants / Σ mandatory floors) : 0
  g.poolUnmet = poolUnmetFrom(r.rows)                                                  // per-pool shortfall, see below
  g.ledger = max(0, L0 − spent + tax[country] + (g.borrowedThisTurn ?? 0));  g.borrowedThisTurn = 0           // this turn's taxes land for next turn's spending
```
- **Upkeep shortfall per pool (kb rev 2; implemented and tested 2026-11-15)** — in `ledgerUpdate`, after `resolveAllocation`:
```js
// spending-dial entries carry an optional `pool` tag on `mandatory` rows (data, set by the Government-needs generator or the player); resolveAllocation keeps it on the row
poolUnmetFrom(rows): for each pool tagged on mandatory rows:  unmet = clamp01(1 − Σ grant / Σ floor)      // pools whose floors are met, and pools with no tagged row, are absent (read as 0)
g.poolUnmet = that object          // replaces last turn's value every turn, never accumulated; upkeepFraction stays as the aggregate readout
```
  `produceCCO` reads it next turn (one-turn lag, like taxation landing). Defection of a deeply unmet pool (`administration__kb.md`, leaderless defection) is a target in `administration__spec.md`. A `Government needs` generator that emits the mandatory rows is **(spec decision)**: today a scenario must author rows with `mandatory: true` and a `pool`. **Since 2026-11-21 the same one-turn lag also reaches the assembly caps**: `produceCCOByRegion` reads `poolUnmet`, so a Region assembly's cap falls with unmet upkeep of the pools staffed from its cells.
- Requisition scope is enforced through Control (`administration__spec.md` `controlGrant`). **Hand-off consumed (2026-11-15)**: polity step 5 reads `polityQueue.requisitionHits` (`readPolityQueue`) and writes the direct Opinion-toward-Government hit (`req.opinionHit × burden`, `internal_politics__spec.md` Requisition Duty). **The structural hit (Extraction↔Investment alignment) is implemented since 2026-11-16 through the Government's action record, not in this module** (`placeRequisition.axisShift`, `internal_politics__spec.md`). Not implemented: essentialness weighting and crisis-acceptance softening of the direct hit.
- **(code-led)** the Ledger update only subtracts spending; it does **not** buy goods or labour at zone prices for Government items, nor add State tariffs, enterprises or seigniorage. (`persuade`, 2026-11-22, debits the Ledger from the Administration module's `apply`, not from `ledgerUpdate`; it is paid out of the start-of-turn-or-current balance in step 2 and `ledgerUpdate` then resolves the rest from `L0`: **not verified which balance `L0` reads**, to check when the Persuasion tests are run.)
- **Government as buyer / seller / grantor (target)**: absent Requisition the Government buys through the spending dial at zone prices from L0 (competing under the usual rules); selling from `gov.inventory` into a zone market at the derived price (proceeds to the Ledger, price pressure through scarcity) and granting goods in kind to a cell, scope filter or Nation (a benefit; no Ledger flow) are Event Drafts `{goods, quantity, province|zone, target}`: `governmentSell`, `governmentGrant` (new types; none in code).
- Tests: `tests/econ_polity.test.js` (turn purity and determinism; taxation delivered × involuntary compliance and Wealth never negative; Ledger never negative and `upkeepFraction`; requisition into inventory); `tests/economics_upkeep.test.js` (`poolUnmet` per pool from tagged rows, replaced every turn, degrades `produceCCO` for that pool only); `tests/polity_queue.test.js` (requisition and default hand-offs).

### Trade-Zone Network
Code: `derive.js` (`gravity`, `openness`, `hubOf`, `zoneOf`, `zones`, `cellZone`), `diplomacy/border.js` (`borderOpenness`)
```js
rawGravity(p) = (economy.lastOutput[p] ?? province.population) × (economy.tradeInfra[p] ?? 0)
gravity(p)    = rawGravity(p) + 0.5 × Σ neighbours rawGravity + tie(p)          // (code-led) smoothed, deterministic tie-break; cached per ctx in `_grav`, reset around step 3
pull(from p, to q) = gravity(q) × openness(owner(p), owner(q))
openness(a, b) = a === b ? 1 : (!a || !b) ? 0 : (o = diplomacy.borderOpenness?.(a, b) ?? 1) >= T('zone.openFloor') ? o : 0      // cached with the gravity cache
hubOf(p)      = hill-climb over ALL neighbours with pull > 0, strongest pull first, ties by id, max 64 steps; moves while pull(best) > gravity(cur) (gravity rises strictly: no cycles)
zone = provinces with the same hub;  cellZone(key) = zone of the Region province where the cell's Nation has the largest presence
borderOpenness(A, B) = mean over ruleset goods of ownerTradeFactor(A, B, good)       // 1 unrestricted / same owner / unowned; 0 under embargo or a ResourceExportBan on every good; symmetric
ownerTradeFactor(A, B, good) = 0 if a ResourceExportBan on `good` or a TradeAccess embargo binds the pair, else 1          // owner-level twin of treaties.tradeFactor (keyed by zone hubs); kept equal by a test
```
- Membership derived at read time, never stored (Rule 7); the slow `tradeInfra` stock damps hub switching.
- **Implemented 2026-11-15 (kb rev 4)**: zones are **not** bounded by Country borders; a border splits zones only where its openness is below `zone.openFloor` (placeholder 0.1; a half-closed border only scales the pull); unowned land and water never pull across an owner boundary. Single-owner worlds are unchanged. No Diplomacy module loaded means borders count as open. Tariffs do not lower openness yet (not in code). Post-alpha (not designed): an agreement opening the border for border provinces only. **Slice 3c note (2026-11-24)**: Sea provinces (World Map, 10th terrain) are water and "never pull across an owner boundary"; the rule for pull across Sea (sea lanes) is not defined and stays out of 3c unless the World Map kb defines it (`world_map__kb.md`).
- **Consequences to watch**: `zoneEdges` now has fewer cross-Country edges where borders are open, which lowers `tradeDependency` (Diplomacy leverage, overreach closeness) and gives War supply (`economics.draw`) cross-border zones. Existing Diplomacy/War tests that assumed per-Country zones may need updating; not verified.
- **(spec decision, confirmed 2026-11-15)** `borderOpenness` is the mean of per-good trade factors; `ownerTradeFactor` duplicates the matching in `treaties.tradeFactor` and should be folded onto it the next time `treaties.js` is touched.
- Tests: `tests/economics_zones.test.js` (open border one zone; single owner unchanged; embargo or all-goods ban splits; partial ban does not split; floor behaviour with 15 goods; unowned does not pull; `zoneEdges`; `borderOpenness` values; `ownerTradeFactor` agrees with `tradeFactor`).
- `tradeInfra[p]` is a per-province stock distinct from World Map `infrastructure_level`; built by `buildTradeInfra` (cell action, `polity/actions.js`) with Builders + Wealth by any cell including the Government unless forbidden (Right `Trade-infrastructure construction`, default permitted); decays by `infra.decay` per turn; no labour cap; no builder return. A Government construct Event is not in code.

### Trade-Zone Edges
Code: `derive.js` (`zoneEdges`, `throughputCap`)
```js
zoneEdges(ctx) = unique unordered zone pairs whose provinces are adjacent
throughputCap(a, b) = T('zone.capBase') × min(tradeInfra[a], tradeInfra[b]) / 100          // indexed by the hub provinces; then × diplomacy.tradeFactor(a, b, g) in pricePass
```
- kb edge `(zone_A, zone_B, throughput_cap, current_flow)`: `current_flow` is not stored in code (flows are applied directly). Cross-Empire edges are additionally gated by Diplomacy (`tradeFactor`: embargo/ResourceExportBan = 0; `diplomacy__spec.md` Axis Bundle).

### Estate-Tariffs
Code: none (target)
```js
realised(shipment) = baseValue − stateTariff(origin) − Σ estateTariff(transit provinces) − stateTariff(destination)          // value only; never throughput_cap
estateTariff(p) = rate set by the cell holding Local Jurisdiction over p (polity Right) ; stateTariff = Diplomacy action Impose Tariff / Tariff Exemption (diplomacy__spec.md)
```
- Applied to the flow in `pricePass` when implemented (the gap test `pre(hi) > pre(lo) × (1 + friction)` becomes `(1 + friction + tariffs)`); revenue to the holder cell / the Ledger (State tariffs are a Ledger inflow). `derive.economics.tariffAsymmetry` (readout for Diplomacy) depends on it. State tariffs will also lower `borderOpenness` (Trade-Zone Network).

### Warehousing (per province)
Code: `step.js` (`wh`, `zoneStock`, `zoneTake`, `zoneAdd`, `capOf`)
```js
warehouse(p) = {capacity: number|null, stock: {good: qty}}          // capacity null = unlimited; built_cost/upkeep_cost: target
zoneTake: draw pro rata from the zone's warehouses;  zoneAdd: into province warehouses by capacity headroom (finite capacity: overflow is lost); unlimited → first province
```
- Markets are zone-pooled; `drawFromZone(ctx, province, good, qty)` (service `economics.draw`) serves War supply. Capacity is a province stock independent of zone membership.
- **Not in code**: per-turn spoilage (`decayRate` for perishables, slower for non-perishables, theft/seizure in unrest), Builders + Wealth construction, upkeep cost. Overflow is only lost at `zoneAdd`.
- **Placeholder pools and extraction**:
```js
extract(ctx, p, good):  wasteland → 0;  y(g) = resourceYield(g) × (province.resourceOverrides?.[g] ?? 1);  resourceYield = good === 'Timber' ? T('yield.timberPerForest') × forestation : T('yield.baseline') + (terrain.favor[good] ?? 0)
   weight(g) = (y(g) × baseValue(g) × signal(p, g)) ^ T('prod.theta');   signal = live scarcity this turn
   L = labourAt(p, pool) × weight(good) / Σ weight over the raw goods of that pool;   output = T('prod.k') × y(good) × L ^ T('prod.alpha')
raw output is credited to the Region's cells by labour × presence; a hoarding cell withholds `hoardFrac` of it (polity `hoard` action) and releases it when it stops
```
  Extraction pools (`goods[g].extractPool`): Agriculture ← Grain, Livestock, Fine Horses, Fiber, Wool, Hides, Herbs · Mining ← Stone, Iron Ore, Precious Metal Ore, Coal, Sulfur, Salt · Woodcraft ← Timber · Fishing (placeholder) ← Fish · Reagent Gathering (placeholder) ← Magical Reagents. Placeholder pools carry `placeholder: true` in `ruleset.pools`.
- **Processing** (zone level, tier by tier semi → light → heavy → transport, so chains complete in a turn):
```js
need[z][g] = net units still to be produced: final consumption (cells' tier items by best alternative, military `upkeepBySource`) propagated backward through recipes, net of stock
for tier, zone, pool: budget = Σ labourAt(p, pool) over the zone (one ledger `labLeft[z|pool]` shared across tiers: no double counting)
  feasible = recipes of that tier and pool with need > 0 and every input available;  margin = max(1e-6, baseValue × scarcity(stock, need) × outQty − Σ cheapest input baseValue × qty)
  weights = margin ^ T('prod.theta');  caps = min(need/outQty, input stock/qty);  water-filling (≤ 8 passes) allocates runs;  inputs consumed, outputs added, credited to the zone's cells by pool labour
```
  **Planning posture** (`gov.planningPosture` blends weights toward `plannedWeights`) and Government inventory consumption by upkeep: **not in code** (inventory only accumulates). Military demand enters via `derive.war.upkeepBySource`.
- **Teaching** (the only conversion): `teaching.js` (`stepTeaching`, `teachCell`, `extinctPools`)
```js
capacity = max(0, free('Teaching') − directedShare(key, 'Teaching')) × T('teach.rate'), capped by uncommitted surplus above target;  target(pool) = laborProfile[pool] × population
deficits (pools below target, not extinct) weighted by deficit × nations.affinity[nation][pool] (default 1); water-filling, capped at each deficit; taken pro rata from pools above target
cell.flow.teaching = moved;   extinct = pools with zero labour country-wide (cannot be taught back; LaborMigrationBan gates importing teachers: Diplomacy)
```

## Rules
Code: per-rule notes
1. Only `teachCell` changes pool membership of labour (tested indirectly by determinism; no direct test).
2. `labourCommitted` is fully unavailable to production (`poolLabour`); no partial residual.
3. C/C/O is a linear sum over committed pool units × `ruleset.pools[].envelope`; no institution is hardcoded (`produceCCO`; linearity pinned by `tests/economics_upkeep.test.js`); `produceCCOByRegion` is the same sum per Region and adds up to the Country's.
4. Cascade order strictly subsistence → comfort → luxury; taxation after it (tested).
5. Non-material output is never stockpiled (target; no code).
6. One global `coinage` record; no exchange rate.
7. Zones derived every call (`zones(ctx)`, cached per ctx only inside step 3).
8. Tariffs change realised value only (target).
9. Warehouse capacity is a province stock (`wh(p).capacity`).
10. Requisition pre-cascade; taxation post-cascade (tested).
11. Government buys as an ordinary market participant (target; `ledgerUpdate` does not buy).
12. Directed propaganda/education output is zero-sum with ordinary use (`directedShare` read in Teaching; polity side).
13. Every debt is an `Obligation` with named creditor and debtor (tested); Government borrowing not in code.
14. Interest per zone `credit.r0 × (D/S)^eta`, optional ceiling; loans nominal (`creditClearing`).
15. Price = base × scarcity × level in one pass (`pricePass`); never stored; `lastMarket` is a cache.
16. Debasement as a `mint` parameter (target).
17. Land split before Requisition; Σ shares ≤ 1 (`landSplit`; sum constraint is scenario data, not asserted).
18. `tradeInfra` is a per-province stock decaying by `infra.decay`; `buildTradeInfra` by any permitted cell.
19. Permanent pool loss: `extinctPools` per Country.
20. `extractPool` per raw good; placeholder pools for Fish and Magical Reagents.
21. Processing labour by value added with water-filling; planning posture blend is a target.
22. `cellProvShare` spreads labour and population over a Region's provinces.
23. Government sells/grants (target).
24. Calibration target: numbers pass; no code.

## Status
- **Implemented and tested** (`tests/econ_polity.test.js`): extraction with diminishing returns and Wasteland zero, cascade tier-first under a cash limit with goods conservation, taxation delivered × involuntary compliance, Ledger/spending dial with `upkeepFraction` and never negative, Requisition into inventory scaled by compliance, credit through obligation records, turn purity and determinism.
- **Implemented 2026-11-15, tests written the same day and not yet run by the designer** (a code rev set below on this basis is to be lowered to `-` if they fail): `produceCCO` linearity and the `poolUnmet` factor, the `poolUnmet` writer (`tests/economics_upkeep.test.js`); the cross-border hub pull, `borderOpenness` and `zone.openFloor` (`tests/economics_zones.test.js`); consumption of `polityQueue.requisitionHits` and `.defaults` by polity (`tests/polity_queue.test.js`). **Run status unknown**: the suite of 2026-11-17/18 was green through slice 3a and covered these files; the run of 2026-11-20 (194 tests) passed 186 with eight failures (a `transfer.js` debt-record explosion, a `reorg.js` duplicate, tests assuming nothing migrates) fixed and not re-run.
- **Written 2026-11-21, not yet run**: `produceCCOByRegion` (`economics/derive.js`; described from `administration__spec.md`, not re-read), used by the assembly queue (`administration/queue.js`) and checked through `tests/queue.test.js`. **Run `npm run build:data` first** (24 new tuning keys since 2026-11-19; none of them is an Economics key), then `npm test`.
- **Implemented, no direct test**: zone gravity/hubs inside one Country, price pass and capped flows, derived demand and water-filling processing, Land split, debt service with auto-default, Teaching, trade infrastructure decay, Government inventory accumulation.
- **Not in code**: Mint and fineness records, Ritual and Meteomancy contribution, Government buy/sell/grant, `borrow`/`defaultDebt`, Estate-Tariffs and State tariffs (so tariffs do not lower border openness), Warehouse spoilage/theft/construction, planning posture, non-material channel delivery inside Economics, `currentFlow`, cross-zone lending, `setPoolSplit`, inventory consumption by upkeep, the essentialness weighting of the direct Requisition hit (polity), the cross-Country default CB (Diplomacy). (The structural Requisition hit is **in code since 2026-11-16**, on the polity side.)
- **(code-led)**: `poolScarcity` without a mean divisor; smoothed gravity with tie-break; constant flow friction; one-pass demand from cells and military; `cash = salesValue + wealth × cash.wealthFraction`; `cellZone` by Nation presence; `shortfall` as unmet subsistence value; obligations cells-only; arrears limit → removal; tuning keys `yield.baseline`, `yield.timberPerForest`, `cash.wealthFraction`, `credit.reservePerCap`, `infra.decay`, `teach.value`.
- **Decided and implemented (kb right)**: (1) 2026-11-13, shape confirmed 2026-11-14, aggregate and floor confirmed 2026-11-15: the cross-border pull scaled by border openness (kb rev 4); (2) 2026-11-14: `produceCCO` per committed unit and linear (kb rev 2); (3) 2026-11-13, tag confirmed 2026-11-14: `poolUnmet` written per pool by `ledgerUpdate` from `pool`-tagged mandatory rows (kb rev 2); (4) 2026-11-15: the creditor's Opinion and Fairness hits from a credit default (kb Credit rev 2, polity side).
- **Confirmed 2026-11-15 (were spec decisions)**: `polityQueue` hand-offs (requisition hits carry `claimed`/`delivered`/`value`; defaults `{creditor, debtor, principal}`), `zone.openFloor`, the `borderOpenness` aggregate, no pull from unowned land or water across an owner boundary.
- **(spec decision)** (pending confirmation): production planning rule, extraction pool per raw good, processing at zone level, greedy credit matching, auto-default after the arrears limit, `harmQueue` hand-off, Government inventory, `governmentSell`/`governmentGrant` type names, principal not amortising, Land share taken per presence share, a `Government needs` generator for the mandatory rows; **`produceCCOByRegion` as "the Country sum restricted to one Region's cells" and its additivity as the pinned property (2026-11-24; the Administration kb confirmed the Region assemblies' cap from "the Coordination produced by pools staffed from that Region's cells" on 2026-11-21, not the derive's exact form)**.
- **Open (kb)**: ritual catalogue and prices; envelope coefficients; Teaching retraining rate; trade-gravity formula; recoinage cost; scarcity shape; pool wiring audit; numbers pass.
- **Tuning keys** (placeholders; defaults in `tuning.defaults.json`): `prod.k` 1.0, `prod.alpha` 0.85, `prod.theta` 1.5, `yield.baseline`, `yield.timberPerForest`, `scar.eps` 1.0, `scar.min`/`scar.max` 0.25/4, `scar.elasticity` 0.8, `flow.share` 0.5, `flow.friction` 0.05, `zone.capBase` 100, `zone.openFloor` 0.1, `money.kappa` 1.0, `cash.wealthFraction`, `credit.lendFraction` 0.5, `credit.r0` 0.02, `credit.eta` 0.7, `credit.reservePerCap`, `debt.arrearsLimit` 0.5, `infra.decay`, `contrib.beta` 0.5, `teach.rate` 0.02, `teach.value`, `wh.slowFactor` 0.25 (target), `eps.infra` 0.05 (target). The hit coefficients `req.opinionHit`, `default.opinionHit`, `default.fairnessHit` belong to polity (`internal_politics__spec.md`).
- **Sync:** (`<section> = <kb rev> / <code rev>`; `-` = no or insufficient code+tests)
  - Data Structures > Resource Tiers (45 goods, 5 tiers) = 1 / -
  - Data Structures > Skilled Labor Pools (19, independent, non-fungible) = 1 / -
  - Data Structures > Administrative Capability Envelope (per pool — production side) = 2 / 2
  - Data Structures > Consumption Tiers = 1 / 1
  - Data Structures > Non-Material Consumption Channel = 1 / -
  - Data Structures > Contribution valuation (supplies Internal Politics' Fairness bucket — settled 2026-11-02 except ritual catalogue) = 1 / -
  - Data Structures > Land (ownership share — settled 2026-11-02) = 1 / -
  - Data Structures > Money (settled 2026-11-02) = 1 / -
  - Data Structures > Credit (obligation records — settled shape 2026-11-02) = 2 / 2
  - Data Structures > Prices (settled shape 2026-11-02) = 1 / -
  - Data Structures > Resolution order within Economics (settled 2026-11-03) = 2 / 2
  - Data Structures > Trade-Zone Network = 4 / 4
  - Data Structures > Trade-Zone Edges = 1 / -
  - Data Structures > Estate-Tariffs = 1 / -
  - Data Structures > Warehousing (per province) = 1 / -
  - Rules = 2 / -
