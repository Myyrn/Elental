# UI — Knowledge Base

Status: **2026-11-03 design pass** — shell + five workspaces, one global Scope,
one Lens system, action-class controls (Allocation Dial, Threshold Meter,
Event Draft, Orders tray), analysis widgets, visibility stamps. Supersedes the
2026-09-13 screen enum. Fixed from the prior file: the retired Government
Triangle is gone from the Country Dashboard; Control Allocation is reachable
from any cell card; Population, Goods, Unrest and Claims lenses added.
Rendering of terrain/edges/habitability/resources/Debug Mode is carried over
unchanged. Exact wireframes, icon set, palette and numeric thresholds remain
open. The **Allocation Dial** semantics are confirmed (2026-11-03) and written into `administration__kb.md`, `actions__kb.md`, `internal_politics__kb.md` and `economics__kb.md`.
**2026-11-09 designer input** (see Status): Apparatus before Polity, Nations tab, Regions rendering, scope highlight, scope tree below the map, Message Feed and attention badges, Laws tab with predefined values / narrative text / pending lighting, Back/Forward scope history, bar breakdowns, 1–100 run-turns slider, Trade Zones lens.
**2026-11-10 designer input** (see Status): click-army-then-click-province movement, occupation hatch and occupation/siege display, map symbols (fortress triangle, city square, Region-capital circle) and army circle-with-arrow markers, Battle Report message, scoped mobilization controls and standing-share dial, Peace Conference stack editor and negotiation meter, Veto factors panel.

## Data Structures

### Shell (persistent across workspaces)
```
Shell = { TopBar, ScopePicker, OrdersTray, CommitmentsLedger, MessageFeed, DockedDetailPanel }
TopBar = { turn/phase, pool meters (Control, Coordination, Observation: produced vs committed),
           Ledger balance + net flow, alert counts (live Questions; unobserved-state notice),
           End Turn, RunTurns (slider 1–100, default 5) }
```
- **ScopePicker** is global: every workspace reads the current Scope.
- **OrdersTray** collects this turn's queued dial changes, commitments and
  event drafts (planning is simultaneous; Actions pipeline). End Turn submits.
- **CommitmentsLedger** (drawer) lists every standing commitment with the pool
  it draws on; release or renew in place.
- **MessageFeed** (2026-11-09; replaces the blocking Turn Report popup) is a dockable, **non-modal** panel; controls are never blocked. **Every event is its own message** with a kind tag: random event / shock, order executed (the player's own orders), order rejected or refused (with holders), Question considered (a lasting multi-turn consideration is one message updated each turn), entitlement loss, war/treaty events (a battle is one **Battle Report** message, below), Decision Log entries visible to the player. Messages follow the fixed pipeline order within a turn (shocks → gating → Economics → War → Internal Politics → Administration → Diplomacy → Region pass) and link to their source (province, cell, order).
- **Attention badges** (2026-11-09): a red badge with a count on each workspace tab (and sub-tab) for **new issues requiring the player's attention** — e.g. a new Question on Polity → `Polity (1)`; unmet upkeep on Apparatus; Ledger shortfall on Economy; an incoming proposal or war declaration on World. A badge counts items not yet opened; opening the item (or its message) clears it. Read markers are UI-local state; the badge count is derived from live readouts and the feed — nothing is stored in the engine.
- **RunTurns** (2026-11-09): the multi-turn button has a **slider 1–100** (default 5). Running stops early at the first turn that produces a message requiring attention (new existential Question, war declared on you, refused order) and says so. **(proposed early-stop)**
- **End Turn Preflight**: pressing End Turn first shows advisory warnings from
  `preview` (Actions); they never block. Warnings: **projected Ledger shortfall**
  ("planned spending exceeds the balance by X — these entries are truncated, Y%
  of upkeep unmet, C/C/O output degrades by Z%; Borrow?" — the Ledger itself
  never goes negative); Σ floors above produced output for any Allocation Dial;
  queued events that would be refused at gating; Threshold Meters below
  threshold (no effect, no refund); an empty Orders tray. Price-dependent
  figures are marked as estimates; shocks and unobserved state are excluded.

### Workspace (top-level enum, replaces Screen)
```
Workspace ∈ { Map, Apparatus, Polity, Economy, World }          // Apparatus before Polity
Map       — lens picker; renderings: map | regions | table | detail
Apparatus — C/C/O pools, Control/Observation Allocation, Emergency Powers, propaganda draws
Polity    — tabs: Questions | Estates | Nations | Laws | Government
Economy   — Pools | Goods & Prices | Trade Zones | Flow | Ledger & Credit | Money
World     — tabs: Relations | Treaties | Mirror | Military
```
Every non-Map workspace scrolls vertically; horizontal scroll is exclusive to
the Map canvas.
- **Nations tab** (Polity): per Nation, derived readouts — presence by Region, core strength, Sympathy toward each Country, titular status, Preference baseline vs. current, and a Nation-level Rights/Duties summary; it reads Nations' data, never stores any.

### Scope (one syntax, shared with Rights/Duties/Control/Requisition)
```
Scope = filter ∈ cell (Nation, Estate, Region) | (Nation, Region) | (Estate, Region)
                 | Estate | Nation | Region | Empire
SliceOrder = ordered permutation of {Region, Estate, Nation}   // player-reorderable
ScopeTree(country, SliceOrder) = nested groups of the actor-cell cube
```
(Region = administrative Region, World Map; Estate and Empire scopes exist only when the technology flag enables them — see `internal_politics__kb.md`.)
- **Realm view** (Map workspace, Statistics side): a **treemap** of the current
  scope, placed **below** the map box (not to its right). Tile area = any extensive readout (population, Wealth, output); tile
  colour = any intensive readout (grievance − compliance, Opinion-toward-
  Government, ...). Click drills down; breadcrumbs go up.
- **Back / Forward** (2026-11-09): arrows beside the ScopePicker on every screen that can descend to smaller scopes (treemap, Estates, Laws, Regions rendering). They walk the scope history like a browser; breadcrumbs still go up. History is UI-local state.
- **Scope highlight on the map**: whatever the global Scope covers is highlighted — a Region scope outlines and brightens its provinces; a Nation / Estate scope shades provinces by that group's presence share; a cell scope highlights its Region. Out-of-scope provinces are dimmed.
- **Aggregation**: extensive readouts sum; intensive readouts are
  Weight-weighted unless the readout declares otherwise. Every aggregate tile
  also shows a **hottest-child marker** (worst child), because cells act and an
  average can hide a cell at its armed rung.
- **Geography hierarchy** (Empire → Region → province) is separate from the
  cell cube: province is never an Internal Politics key, so province-level
  lenses aggregate into Regions only by World Map's own rules.
- **Foreign Countries** use the same tree (Empire = Country), filtered by
  visibility stamps. Dependents and Confederation members nest inside; ceded
  axes are marked on the nested node.

### Lens System (Map workspace — togglable, instant, non-destructive)
```
Lens = { domain, metric, parameter? }          // native resolution declared per lens
resolution ∈ province | Region | cell | edge | Country
render(lens, scope) ∈ map | regions | table(child scopes, sortable) | detail card
```
A lens **never invents data**: a Region- or cell-resolution lens is drawn at
that resolution, not smoothed to provinces; aggregation follows Scope rules.
| Domain | Metrics (parameter) | Native resolution |
|---|---|---|
| Terrain (default) | terrain_type (10 types incl. Sea — lakes are Sea-type water provinces), forestation, habitability, resources (threshold-gated icons) | province |
| Political | owning Country, Dependency/Alliance lines, capitals | province / Country |
| Population | population, density vs `max_population_density`, urbanization, sanitation, growth/migration pull | province |
| Cultural | plurality Nation, core strength, titular status, Nation presence share | province |
| Infrastructure | roads (`infrastructure_level`) **or** commerce (`trade_infrastructure_level`) — two separate lenses, distinct stocks | province |
| Economic | warehouse capacity + spoilage risk, pool output | province |
| Trade Zones | zone membership (colour per zone, hub marked), hub `trade_infrastructure_level`, edge `throughput_cap`/`current_flow` (edge weight), tariffs on zone edges; membership derived at read time (Economics Rule 7), never stored | province / edge |
| Goods | metric ∈ production, warehouse stock, price, scarcity, flow; parameter = one of 45 goods | province / zone |
| Military | Supply gradient (0-100%), armies/garrisons, siege progress, interdicted edges, concealment, War Score entries by cell | province / edge / cell |
| Unrest | grievance − compliance per need, escalation rung (where observed), Question count | Region / cell |
| Standing & Claims | claims, CBs held (tier + persistence class), Foreign Standing, Dependency satisfaction readout | Country pair / province |

Lens detail (carried over): Terrain fill + forestation stipple, rivers/passes/
sea-lanes, roads weighted by `infrastructure_level`, fortress icons;
**Borders: Country border bold, Region (administrative region) border thin, always both, in every lens**; Political adds capital
markers; Military adds warehouse food/ammo icons within Supply range and a
concealment overlay; Trade Zones weights edges by flow; Cultural uses opacity/
saturation toward core strength. Cataclysm hazard pattern is reserved
(post-alpha).
- **Regions rendering** (map workspace mode `regions`): the Country under the cursor/selection is drawn with its Regions separated and tinted individually; **every other Country is drawn in a pale tint of its own colour with no Region separation**.
- **Occupation hatch** (2026-11-10): a province controlled by a Country other than its owner during a war is drawn with **diagonal cross-hatching in the controller's colour** over the owner's fill. It is a lens-independent overlay, like borders **(proposed: all lenses)**; it reads War's `control_state`.

### Map Symbols and Army Markers (2026-11-10)
Province markers are drawn from readouts, never stored by the UI:
```
settlement class  fortress (fortification_level > 0, War)  -> triangle
                  city without a fortress                  -> square
                  Region capital (World Map capital_province) -> bold circle
army marker       circle in the owner's colour + an arrow pointing in the direction
                  the army moved into during the previous turn
```
- A **fortified Region capital** is drawn as the bold circle with a small triangle inside **(proposed)**. Fortress icons on a chokepoint **edge** keep their edge placement (Edge Rendering, unchanged).
- **Region capital** is the Region's stored `capital_province` (World Map, 2026-11-10): an administrative setting chosen by the player or AI when the Region is defined or redefined. The UI only draws it; the Region card and the reorganization draft expose the setting. The Country capital keeps its Political-lens marker.
- The army arrow is the side the army last advanced through (`route_side`); an army that did not move last turn shows the circle with no arrow **(proposed)**. A stack count badge appears when several armies share a province.
- Symbols obey the threshold-gated icon density rule (Rules 15, 22) and are drawn in every lens above that threshold.

### Army Orders (click-to-move — 2026-11-10)
```
left click army → army selected: Army card opens, reachable provinces highlight
left click target province → a move order is queued to the Orders tray with a route preview
```
This replaces the earlier movement control. An adjacent target is a single move; a non-adjacent target is a multi-turn route planned along the edge graph **(proposed)**. The preview shows each edge's `edge_quality`, blocked edges (non-pass Mountain edges, Sea and lake provinces, hard fortresses), the expected progress per turn from `army_speed` and the Supply state along the route. Clicking another province replaces the queued order; clicking empty map or pressing Esc deselects. Army Tactics, stances and the Vanguard/Center/Rearguard depths remain dials on the Army card (War, unchanged).

### Occupation and Siege Display (2026-11-10, confirmed)
Derived from War's `control_state`, `siege_readout` and `occupation_readout` (`war__kb.md`) — no new state; read-only, no occupation rule changes.
- **Map**: the occupation hatch above; a **siege ring** around the fortress triangle showing `siege_progress` against the capture threshold; the Military lens adds supply-cut marks.
- **Province card while besieged**: siege progress vs. capture threshold, besieger strength, garrison vs. maximum, both sides' Supply, an Assault action with its expected effect. Each figure links to what drives it.
- **Province card once occupied**: controller, occupation garrison required (derived) vs. present, martial-law Control cost, and per occupied cell Grievance: Occupation or liberator sympathy and the uprising threshold. A **two-ways-to-hold** line shows the garrison requirement met by troops or by Control (interchangeable, War).
- Visibility follows the stamp rule: foreign sieges show only what Observation/Espionage reveals.

### Battle Report message (2026-11-10)
Each battle is **one Message Feed message** rendered from War's `BattleReport` (`war__kb.md`):
- a header (province, turn, sides) and the totals for both sides;
- one row per round: step, the stance/tactic each side used, and casualties for both sides **per round**;
- **colour highlighting with a text/icon label** (never colour alone): **green "proper tactic"** for a stance that countered the enemy's choice, **red "bad counter"** for one the enemy's choice punished, neutral otherwise;
- the enemy side's casualties (total and per round) carry the visibility stamp — **exact in alpha**, `estimated` once fog-of-war exists.

### Mobilization and Standing Army controls (2026-11-10)
- **Region card**: the primary control is **"Mobilize Region"** (the main tooltip); beside it a separate **"Mobilize Empire"** button. A preview lists the covered cells and what each will contribute by its own Levy obligation × `involuntary_compliance`. **Demobilize** is the counterpart on each.
- **Actor-cell card**: **Mobilize this cell** for a single cell (War, `Mobilize(scope)`).
- **Military tab**: the **standing-share dial** per cell with bulk scope filters. Changing it is a political decision — a Government order goes through an Event Draft with the gating panel; a **cell petition** appears as a Question. The widget shows who pays the upkeep, the Government's compensation (spending dial) and the covered cells' compliance state.

### Veto Factors Panel (2026-11-10)
Part of the Event Draft **gating panel**. For each covering Veto/Council holder it lists, next to the stance estimate (self-interest × Preference alignment), the **factors that could keep it from using the Veto in this vote**: the acceptance factors (crisis severity, its own exposure, burden share, visible alternatives), concessions or benefits the Government could add (compensation, a Right granted, which offset an entitlement loss), its Opinion-toward-Government and the Control cost and entitlement loss it would face if the act is forced through; the factors pushing the other way are listed too. Each factor links to its source (Why? entry or stock); factors the player cannot observe show `unknown` under the visibility stamp, never a guess.

### Grid (rendering)
Pointy-top, odd-r offset hex, 25×20 at alpha; **every hex is a province** (Sea and lake hexes included, 2026-11-09/10 — 500 provinces), sourced from
World Map's 157×114 @16px/cell raw terrain grid by majority-vote/centroid
sampling. World Map owns the substrate; this is its render.

### Edge Rendering (structural, identical across lenses)
River/bridge: line on the shared hex edge, bridge marked distinctly · Mountain
pass: line through the edge, distinct from open terrain · Sea lane: route line
over water, distinct from river styling · Fortress: icon ON the chokepoint edge.

### Habitability Visual States / Resource Iconography
Wasteland: desaturated, no settlement iconography · Claimed/Frontier: sparse
marker/flag · Settled: full terrain + population. Dominant resource icon only
above a significance threshold.

### Visibility Stamp (on every political, covert or foreign readout)
```
stamp ∈ live | stale(turn) | estimated | unknown
```
Inside the player's Country the stamp is driven by Observation committed to the
Region/cell (off-slate escalation is `live` only where Observation is
committed; elsewhere `stale(turn)`); abroad it is driven by Espionage/
Observation detection. `preview` output never reveals state the actor cannot
observe, and the UI never fills an `unknown` readout with a guess.

### Allocation Dial (the generic dial widget — settled 2026-11-03)
A dial is an **auto-filling allocation**, not a fixed amount. Entries take what
they need in priority order against a per-entry **floor**, and whatever is left
over flows automatically by **surplus ratio** (rules: `administration__kb.md`
for Control/Observation, `actions__kb.md` for the generic subclass).
```
AllocationDial(pool) = { entries: [ { target, floor, priority, surplus_weight, cap? } ],
                         sink?, reserve? }     // reserve: Ledger spending dial only
resolve(amount)   // derived each turn, pure
  pass 1  entries by priority: grant min(floor, remaining); shortfall truncates the LOWEST priority
  pass 2  remaining -> entries with surplus_weight > 0, pro rata to weight, respecting cap
  leftover -> sink if set, else idle
```
- **Per cell by default** for cell-targeted dials (Control, Observation). An
  **aggregate entry** uses any scope filter (Nation, Estate, Region, Empire,
  (Nation, Region), (Estate, Region)) or a **group** (a player-named list of
  cells, allocation-local). Aggregates and groups are bulk shorthand: the entry
  expands per covered cell, and each row shows **"per cell × N cells = total"**.
  Overlapping entries add; to exempt a cell from an aggregate, split it into groups.
- **Floor** = the player's minimum ("no less than 100 per cell"); 0 means the
  entry only receives surplus. **Surplus auto-fill is free.**
- **Surplus ratio sliders** are **linked**: weights sum to 100%; dragging one
  rescales the rest proportionally; a lock icon pins an entry. A new dial
  defaults to equal weights, no floors.
- **Still a dial**: persists until changed, re-resolved every turn from live
  amounts; changing it costs nothing directly; gating by a covering Right still
  applies.
- **Widget** (priority stack with waterline): entries stack in priority order
  (drag to reorder); each bar shows floor (solid) plus received surplus
  (hatched); the **waterline** marks where pass 1 runs out — entries below it
  are drawn unfunded/truncated. A **headroom meter** shows produced − Σ floors,
  with a warning when production could fall below Σ floors. The expanded row of
  an aggregate lists its covered cells and each cell's actual grant.
- **Spending dial** (Government Ledger): upkeep items take floors by priority;
  discretionary entries take floors and an optional surplus share **only from
  balance above the reserve floor**; the **reserve floor** is a labelled line on
  the stack that discretionary bars cannot cross (upkeep bars may); **sink
  defaults to "keep"** (unspent balance stays in the Ledger). Warnings use the
  End Turn Preflight.
- **Applies to** Control Allocation, Observation Allocation, the Government's
  spending dial, and dual-claim pool splits (floors for administrative/Army
  claims, production as the natural sink). **Scalar dials stay plain sliders**:
  garrison priority (War, [0,1]), stances, planning posture.

### Threshold Meter (fixed-threshold actions)
```
meter = { committed, threshold(type, tier) × target_scale, state ∈ below | met }
```
Used for the Question slate (Coordination vs severity-tier threshold),
Espionage/Diplomacy actions and detection tiers, and Rituals. Below threshold
the action does nothing and is **not refunded**; the UI says so before commit.
Beyond the threshold the bar clamps visually — extra labour buys nothing.
Target scale is shown ("× Region population").

### Event Draft (staged pipeline for events)
```
draft → preview (pure; observation-bounded) → gating panel → commit (irreversible)
gating panel = covering Veto/Council cells, their stance estimate (self-interest ×
               Preference alignment), the Veto factors panel, and the "force through
               Control" option with an entitlement-loss warning on the holder cells
```
Rights/Duties config, tax law, Requisition place/lift, declare war, treaty,
Mint, Borrow/Default, audits, direct resettlement and expulsion, Region
reorganization (naming each resulting Region's capital province), Government sell/grant of goods, and a Government standing-share order are all drafts. A **reform
draft** bundles many Rights/Duties changes and previews gating, entitlement-
loss estimates and Control cost to enforce. Each queued draft shows its default
Decision Log visibility (public / covert).

### Analysis Widgets
- **Bullet bar**: grievance level against compliance (voluntary + involuntary
  stacked), per need, per cell — the Question trigger is grievance > compliance.
- **Bar breakdown dropdown** (2026-11-09): every bar (Opinion, Subsistence, Grievance, Compliance, ...) is a **dropdown** listing the **5 largest positive and 5 largest negative contributions** to the value, each labelled with its **source module** and linking to the Decision Log entry or stock behind it. Extends the Why? decomposition; the full breakdown stays one click deeper.
- **Why? decomposition**: any grievance or Opinion-toward-Government breaks into
  need shortfall (consumption cascade), Fairness gap, decaying entitlement-loss
  modifiers, attributed discontent (linked Decision Log entries × awareness),
  war harm and occupation. Entries link to their source action.
- **Preference radar**: five Portrait axes, cell Preference vs. the Government's
  observed Portrait; the gap is the alignment term.
- **Claimed vs. delivered**: every Duty shows claimed amount against
  `claimed × involuntary_compliance`.
- **Flow view**: the Economics resolution order as a flow diagram (production →
  Land split → Requisition → cascade → taxation → debt service → Ledger →
  upkeep shortfall), for the current scope.
- **Escalation chip**: per (cell, need), the banded rung with momentum and
  enter/exit thresholds; marked "acts next turn" where the one-turn lag applies.
- **Negotiation meter** (2026-11-10): during a diplomatic negotiation or a Peace Conference, a meter shows the **other side's satisfaction** with the current terms and a marker for its **walk-out threshold** (Diplomacy's Negotiation Session). Exact in alpha; stamped `estimated` once fog-of-war exists. A **Withdraw** button carries a tooltip warning that withdrawing ends the negotiation, that a new one must start from scratch, and, when the withdrawing Country is the stronger party, that it leaves a decaying Reputational Leverage mark.

### Workspace Specs
**Polity**
- *Questions*: all live Questions sorted by severity with an **attention line**
  at committed Coordination; above = on the slate (Threshold Meter per Question),
  below = neglected. Routine-tier Questions show as a count with the continuous
  Coordination overhead. Opening a Question shows its derived, Question-scoped
  groupings (blocs) with stance, momentum, rung and available actions — never
  presented as persistent entities.
- *Estates*: Nation × Estate × Region matrix (Scope-sliceable) of bullet bars
  and a Why? drill; Opinion-toward-Government, Prestige/Weight, awareness,
  Foreign Standing, Preference radar, Rights/Duties, Control Allocation
  affecting the cell.
- *Nations*: see the Workspace block (derived readouts only).
- *Laws*: matrix of Rights/Duties entries (rows) × scope columns. Each
  entry shows its effective value and whether it is inherited or overridden
  (per the scope ladder and Precedence flag, `internal_politics__kb.md`); silence is shown as "allowed (default)". Edits go
  through a reform draft. Convergence distance between cell pairs is a readout.
  - **Columns** follow the scope ladder: Cell, Nation, Regional-Estate, Region, plus Estate and Empire columns **only when the technology flag enables them** (hidden in alpha). Laws are set per administrative Region by default.
  - **Pending-law lighting**: a Laws cell whose entry has a queued reform lights up for the scope it was drafted against — **green** if the preview says it will apply next turn, **orange** if the preview says a Veto holder would refuse it (it only passes if forced through Control). **(proposed reading of green/orange)**
  - **Predefined value choices**: the Value control is generated from the entry's declared value type in the ruleset — boolean Rights → Granted / Forbidden / Inherit; enumerations → dropdown of the declared options; scalars → slider over the declared range; **Veto** → per-domain checkboxes from the Veto domain list. No free text; raw JSON only under Debug Mode. The offered choices and the scopes offered are exactly those the entry declares for its scope group. **(proposed reading of "same as the right/duty scope group has")**
  - **Narrative description**: the reform popup shows, for the selected Right/Duty, **one narrative paragraph, without mechanics**, saying what the entry changes in the world. Authored as `narrative` text on each `ruleset.rights[id]` / `ruleset.duties[id]` entry (content still to be written).
- *Government*: Ledger summary, observed Portrait (action record), amalgam
  readout (whose wishes the record serves), Emergency Powers status.

**Apparatus** — pool blend producing C/C/O (labour per pool), Allocation Dials
for Control and Observation, Emergency Powers commitment with its derived
per-turn cost, Government propaganda draw on Coordination, audit/investigation
events, border/customs policy.

**Economy** — Pools: 19 pools as stacked bars across production/admin/army with
the claim priority stack; Goods & Prices: 45 goods × zone (production,
consumption, stock, price = base × scarcity × `price_level`); Trade Zones:
zone map, edge `throughput_cap`/`current_flow`, tariffs; Flow: the flow view;
Ledger & Credit: spending Allocation Dial (floors = upkeep, surplus to discretionary, reserve floor, sink = keep), Borrow/Default drafts, obligation records, net position;
Money: `price_level`, fineness per issuer, Mint draft.

**World**
- *Relations*: ego-centred treaty graph; selecting a Country opens a pair
  sheet — Foreign Standing (`opinion`), Reputational Leverage stack, the four
  Leverage readouts (never summed), claims, CBs (tier + persistence class),
  Dependency satisfaction readout, great-power-backing predicate.
- *Treaties*: Sanction/Dependency/Alliance/Confederation as axis bundles, one
  shared axis menu, draft + ratification gating.
- *Mirror*: your Country as others see it — observed Portrait, Reputational
  stacks held toward you, CBs against you (incl. structural: militaristic
  disposition, nationalism claims).
- *Military*: Army roster/fielding queue (units marked levy or standing), Mobilization controls, the standing-share dial, Supply, garrison priority (scalar dial per Region, War), Tactics/stance dials, Troop Training commitment, War Score
  ledger by cell, Exhaustion readout, Peace Conference negotiation — a **stack editor** per side (each proposal marked obligatory or optional; obligatory proposals only accepted/refused, optional ones accepted or refused individually; no size limit) with the negotiation meter and Withdraw.

### Docked Detail Panel (live from owning module)
- **Province card** — terrain, population, habitability, owner, garrison, warehouse, both infrastructure stocks, linked cells; controller and siege/occupation display when contested (above).
- **Region card** — administrative Region summary: cells, hottest child, Observation committed, Control received; the Region's capital province (administrative setting); Mobilize Region / Mobilize Empire controls.
- **Army card** — composition, kind (levy or standing), cohesion, supply%, position/depth, stance, last-turn direction.
- **Actor-cell card** — bullet bars, compliance breakdown, **Control/Observation Allocation affecting the cell with each contributing filter**, Rights/Duties, Why? entry points, escalation chips, Mobilize this cell, its standing share.
- **Country card** — own or foreign; foreign data under visibility stamps.

### Debug Mode
```
DebugMode = boolean, global session toggle
```
Adds a **View Raw** control to every panel/card/dashboard element, exposing the
exact live object already rendering it as formatted JSON — never a separate
copy. Visibility-only, no gameplay effect. Free-text/raw-JSON value entry in the Laws UI exists only under Debug Mode.

## Rules
1. Every workspace obeys the global Scope; Scope uses the shared filter syntax.
2. Slice order is player-reorderable; aggregation: extensive sums, intensive Weight-weighted; aggregates always show the hottest child.
3. A Lens is `(domain, metric, parameter)` with a declared native resolution and never invents data below it; switching lenses is a pure rendering toggle that never mutates or re-derives underlying data.
4. All panel/card content is sourced live from the owning module; UI stores no duplicate state (no stored aggregates either).
5. Cell-targeted and spending dials are Allocation Dials: floors by priority, surplus by ratio, leftover to a sink or idle; changing one is free and applies without confirm. The default unit is the cell; aggregate filters and groups expand per covered cell and show per-cell and total.
6a. The Government spending dial has a reserve floor discretionary entries cannot cross; unspent balance is kept by default; scalar dials (garrison priority, stances) stay plain sliders.
6. Surplus ratio sliders are linked and sum to 100%; the waterline always marks where pass 1 runs out.
7. Commitments are managed in the Commitments ledger; events go through an Event Draft with preview and gating before commit.
8. Threshold Meters clamp beyond the threshold and warn that a below-threshold commit does nothing and is not refunded.
9. Every political, covert or foreign readout carries a visibility stamp; `unknown` is never filled with a guess; preview never exposes unobserved state.
10. No global tension meter, no aggregate Leverage number (the four readouts stay separate), no "Government mood" (Opinion-toward-Government is per cell).
11. Factions appear only as Question-scoped derived groupings; the Government is shown as a resource-holder with a record, never as a person.
12. Escalation and the Government's slate lag one turn; the UI telegraphs ("acts next turn").
13. Skin/skeleton modules (Administration, Diplomacy, War's Peace Conference) keep distinct vocabularies; the underlying shared mechanic is never named or explained in UI.
14. Any screen/panel exceeding viewport height scrolls vertically; the Map canvas alone also scrolls/pans horizontally.
15. Edges render identically across lenses; icon/overlay density is threshold-gated.
16. Debug Mode is a single global toggle; View Raw shows the exact object already rendering it.
17. End Turn Preflight is advisory and derived from `preview`; it never blocks, marks estimates, and excludes shocks and unobserved state.
18. Borders: Country bold + Region thin, in every lens; foreign Countries are pale and un-subdivided in the Regions rendering.
19. The Scope is always visible on the map (highlight); the scope tree sits under the map.
20. Turn results are a non-modal Message Feed; attention is shown as red badges on the owning tabs.
21. The Laws UI offers only ruleset-declared choices; free-text/JSON values exist only in Debug Mode.
22. Settlement and army markers are readouts: fortress = triangle, city without fortress = square, Region capital (its stored `capital_province`) = bold circle, army = circle with an arrow for the previous turn's direction; density is threshold-gated (2026-11-10).
23. Armies are ordered by left-clicking the army, then left-clicking the target province; the order is queued with a route preview (2026-11-10).
24. A province held by a Country that does not own it is cross-hatched in the controller's colour; occupation and siege state is shown from War's derived readouts, never stored in the UI (2026-11-10).
25. A battle is one Battle Report message; tactic matchups are highlighted green (proper) and red (bad counter) with a text/icon label, and the enemy side follows the visibility stamp (2026-11-10).
26. Mobilization is offered per Region (primary), per Empire and per cell; the standing-share dial changes through a draft with gating or arrives as a petition Question (2026-11-10).
27. The gating panel includes a Veto factors panel; unobservable factors show `unknown` (2026-11-10).
28. Withdrawing from a negotiation always shows the restart-from-scratch warning first (2026-11-10).

## Actions (UI-level)
Set Scope / SliceOrder · Scope Back / Forward · Toggle Lens (domain, metric, parameter) · Switch render
(map/regions/table/detail) · Click province/Region/army/cell/Country → Docked Detail
Panel · Select army → click target province (queue move order) · Mobilize / Demobilize (cell, Region, Empire) · Edit standing-share dial · Edit Allocation Dial (add per-cell/aggregate/group entry; floor, priority, surplus ratios, cap, sink; reserve floor on the spending dial) ·
Open/stage Event Draft · Queue to Orders tray · Release/renew in Commitments
ledger · Edit Peace Conference stack / Withdraw from negotiation · End Turn · Run N turns (slider 1–100) · Open Message Feed / message (incl. Battle Report) · Expand a bar's breakdown · Toggle Debug Mode · View Raw.

## Cross-references
- **World Map** — sole source of terrain/edge/Region/ownership ground truth, administrative Region partition (including each Region's stored capital province) and the grid substrate; both infrastructure stocks are rendered as separate lenses; sea and lake provinces render as water (2026-11-10).
- **Internal Politics** — Questions/Estates/Nations/Laws tabs read grievance, compliance, Rights/Duties, scope ladder and Precedence flag, Foreign Standing, Preference vectors, Decision Log live; Rights/Duties edits are Event Drafts. The Veto factors panel reads the stance function and the acceptance inputs (2026-11-10).
- **Administration** — Allocation Dial semantics (Control/Observation), slate as attention, Emergency Powers, upkeep degradation; the assembly queue (cap, agenda shares, Question durations) is shown on the Questions tab (2026-11-10).
- **Economics** — Economy workspace reads pools, goods, prices, zones, Ledger inputs, credit, money; flow view follows the resolution order; Trade Zones lens follows Economics Rule 7 (derived membership).
- **War** — Military lens, Army card, Military tab, garrison priority dial, Troop Training commitment; levy/standing units, Mobilize, standing-share dial, Peace Conference stacks, occupation/siege readouts and the Battle Report (2026-11-10).
- **Diplomacy** — Relations/Treaties/Mirror read Relations, CB, Leverage readouts, axis bundles; Threshold Meters follow its action model; detection/visibility stamps follow Observation + counter-intelligence Espionage; the negotiation meter and withdrawal warning follow the Negotiation Session (2026-11-10).
- **Nations** — Cultural lens, Nations tab, Nation presence, core strength, titular status.
- **Countries** — Scope tree for dependents/Confederation; Institutional↔Personalistic is a display-only readout.
- **Actions** — class (dial/commitment/event) drives control type; Allocation Dial subclass, spending dial/reserve floor and End Turn Preflight are defined there; Orders tray and Message Feed follow the pipeline; gating panel follows Actions' gating rules.

## Status
- Retained **settled**: Grid rendering, Edge rendering, Habitability states, Resource iconography, Docked Detail Panel principle, Debug Mode/View Raw.
- **2026-11-03 design pass — settled shape**: shell + five workspaces; global Scope with reorderable slice order, treemap and hottest-child marker; Lens system with ten domains (eleven after the 2026-11-09 Trade Zones split) and map/table/detail renderings; Visibility Stamp; Threshold Meter; Event Draft; Orders tray, Commitments ledger and Turn Report (replaced by the Message Feed 2026-11-09); analysis widgets; workspace specs; UI honesty rules (Rules 9-13).
- **Allocation Dial — settled 2026-11-03** (written into `administration__kb.md`, `actions__kb.md`, `internal_politics__kb.md`, `economics__kb.md`): floor + priority + surplus ratio (+ cap, sink); per-cell default with aggregate filters and player-named groups as bulk shorthand; surplus auto-fill free; Government spending dial is standing with a reserve floor and sink = keep; End Turn Preflight with a projected-Ledger-shortfall warning; garrison priority and other scalar dials stay plain dials.
- **2026-11-09 — designer input (settled as worded)**: Apparatus before Polity; Nations tab; Trade Zones lens split from Economic; Borders rule; Regions rendering; Scope highlight; Back/Forward scope history; treemap below the map; Message Feed replacing the Turn Report; attention badges; Laws columns on the scope ladder, predefined value choices, narrative text; bar breakdown dropdowns (5 + 5 contributions); 1–100 run-turns slider; Rules 18-21. **Proposed (awaiting OK)**: green/orange pending-law semantics, early-stop on multi-turn runs, "same as the right/duty scope group has" reading.
- **2026-11-10 — designer input (settled as worded)**: click army then click target province for movement; diagonal cross-hatch in the controller's colour for occupied provinces; fortress = triangle, city without fortress = square, Region capital = bold circle; army = circle with an arrow for the previous turn's direction; Battle Report message with per-round tactics (colour-highlighted proper / bad counters) and casualties for both sides, enemy side behind fog-of-war rules (exact in alpha); mobilization main control per Region plus an Empire button; Veto factors panel; Rules 22-28. **Proposed (awaiting OK)**: hatch in all lenses; fortified-capital drawing; no arrow for a stationary army; multi-turn route planning for a non-adjacent target; the Negotiation meter wording and the Withdraw tooltip. **Open**: army arrow vs. stack-count layout; which lenses draw symbols below the density threshold.
- **2026-11-10 (later) — designer input (settled as worded)**: the Region capital drawn as the bold circle is the Region's **stored** `capital_province`, set by the player or AI in the Region's administrative settings when the Region is defined or redefined (replaces the derived "most populous province" proposal; the Region card and the reorganization draft expose it); the **occupation and siege display model is confirmed** (read-only, no occupation rule change).
- **Open (kb)**: a "total-split" mode for aggregate filters (a fixed total divided across covered cells) is not adopted — per-cell only; shortfall within one entry is pro rata across its cells; group is allocation-local (not part of the shared Rights/Duties scope syntax).
- **Open (UI)**: wireframes/layout, icon set, colour palette, forestation stipple technique, significance threshold values, treemap default measures, table column sets per lens, End Turn confirmation behaviour with empty Orders tray; green/orange semantics; early-stop on multi-turn runs; whether the tech gate hides Estate/Empire columns or greys them; `narrative` content for each Right/Duty still to be written.
