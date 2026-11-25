# UI — Specification

KB: `kb/ui__kb.md`. Mirror of its `##/###` headings; cross-references live in kb only. Bootstrapped 2026-11-15 from kb rev 1 and `src/`; **refreshed 2026-11-24 for the forms and the Question slate card added 2026-11-21/22 (taken from `administration__spec.md`, `world_map__spec.md` and the changelogs of 2026-11-19 to 2026-11-22; `src/ui/*` was not re-read, so those rows are tagged accordingly)**. **The UI in code is a working debug shell, not the designed UI**: five workspaces over `EngineClient` readouts with tables, bars and a canvas map; most of the 2026-11-03/09/10 designs (Message Feed, badges, treemap below the map, Regions rendering, Allocation Dial widget, Preflight, Battle Report, army markers, click-to-move) are not built, so every code rev below is `-`. Sources read (2026-11-15): `src/ui/{app,scope,forms}.js`, `src/ui/views/{map,polity,world,apparatus,dock}.js`, `src/client/{engineClient,readouts}.js`; **not read**: `src/ui/{dom,hexmap,debugShell}.js`, `src/ui/views/economy.js`, `style.css`, and (2026-11-24) none of `src/` again; tests `tests/ui.test.js`, `tests/client.test.js` (files only, names not verified; the 2026-11-22 tests `tests/queue.test.js` and `tests/handling.test.js` also check the forms of `extendDebates` and `persuade`). Where code and the old `modules__spec.md` text disagree, **code wins** (**code-led**). Anything the kb does not state is **(spec decision)** (pending OK); not-yet-written code is **(target)**.

## Data Structures

State and conventions:
```js
app = { client: EngineClient, q: (name, args) => client.query(name, args), pkg, rules,
        ui: {workspace, tab: Record<workspace, string>, filter: {nation?, estate?, region?}, sliceOrder: 0..5, lens, lensParam, mapMode: 'Map'|'Table'|'Detail', selected: {kind, id}|null, debug: boolean, country, report, trayOpen, ledgerOpen} }
// UI-local state only (Rule 4). The UI never touches State or the engine: every read is a named JSON readout (client/readouts.js), every change is client.submit(order).
EngineClient.query(name, args): builds a fresh read-only ctx per call (structuredClone of state) and returns plain JSON (readouts via viewCtx, one clone per state version)
queries (readouts): cells, zones, map, armies, wars, diplomacy, blocs, occupations, government, law, history (raw) · estates, questions, laws, govCard, economy, world, pair, mirror, treaties, military, commitments, provinceCard, cellCard, lens, scopeTree, rules, orders, catalog, preview · slate (2026-11-21, `client/readoutsAdmin.js`)
```

### Shell (persistent across workspaces)
Code: `ui/app.js` (`boot`, `buildTop`, `run`, `showReport`, `renderTray`), `client/engineClient.js`
```js
TopBar (code): scenario name, turn, Country selector (debug switcher for the player Country — not in kb), workspace buttons, Draft menu (FORM_GROUPS), Orders (n) toggle, Commitments toggle, End Turn (run 1), Run 5, Debug checkbox
OrdersTray: orders = client.orders; each row = actor + describeOrder + preview verdict badge (Veto: holders | gate domain: clear | invalid: reasons) + ✕; "Clear all"
CommitmentsLedger: readout `commitments(country)` → armies + standing commitments from state.commitments; only a propaganda commitment has a release button
Turn report: modal `sheet` (executed, rejected + reasons, refused by Veto, entitlement-loss count) with Close; shown only if something happened
```
- **(code-led)** pool meters, Ledger/net flow, alert counts, Message Feed (non-modal, one message per event), attention badges, the 1–100 RunTurns slider with early stop and the End Turn Preflight are **not in code**; the multi-turn button is fixed at 5, `run(n)` calls `client.endTurn()` n times and shows the last report. The report modal is the pre-2026-11-09 Turn Report.
- **(target, spec decisions)**: `messages(country)` readout built from `TurnReport` plus Decision Log entries visible to the player (kind tag, pipeline order, link to source); `badges(country)` readout (counts of unopened items, read markers UI-local); `preflight(orders)` readout = engine `preview` over queued orders (see `actions__spec.md`); slider with `runTurns` stopping at the first message that requires attention.
- **(code-led, 2026-11-21)** the Commitments ledger reads `state.commitments`, so the Government's `extendDebates` and `freeColonization` commitments appear as rows; only a propaganda commitment has a release button (the debate extension is lifted from the slate card's form `liftExtendDebates`, the free colonization from `liftFreeColonization`; **not re-read in code**).
- Tests: `tests/client.test.js` (client API); `tests/ui.test.js` (forms and scope helpers, Node-only) — names not verified.

### Workspace (top-level enum, replaces Screen)
Code: `ui/app.js` (`WORKSPACES`), views in `ui/views/*.js`
```js
WORKSPACES = {Map, Polity, Apparatus, Economy, World}      // code order; kb order puts Apparatus before Polity
Map: lens picker + modes Map | Table | Detail (no `regions` mode)      Apparatus: one page (pool bars, Control/Observation dial tables, Spending, propaganda, and since 2026-11-21 the Question slate and debates card)
Polity: Questions | Estates | Laws | Government (no Nations tab)       Economy: view `views/economy.js` over the `economy` readout (tab set not re-read)
World: Relations | Treaties | Mirror | Military                        every view = render(app, {ests}) → DOM node; errors render as a <pre class="err">
```
- **(code-led)** order Map, Polity, Apparatus, Economy, World; no Nations tab, no Regions mode, Region card absent. Every non-Map view scrolls vertically; the canvas map sits in its own card.
- **(target)**: Nations tab readout `nations(country)` — presence by Region, core strength, Sympathy, titular status, Preference baseline vs current, Nation-level Rights/Duties summary — needs `derive.nations` (`nations__spec.md`, target).

### Scope (one syntax, shared with Rights/Duties/Control/Requisition)
Code: `ui/scope.js` (`scopeOf`, `scopeLabel`, `matchesFilter`, `SLICE_ORDERS`), `ui/app.js` (`renderScopePicker`), `client/readouts.js` (`scopeTree`)
```js
scopeOf({nation, estate, region}) = cell | nationRegion | estateRegion | nation | estate | region | empire           // kinds are those of kernel/scope.js; (nation, estate) without a Region is an error
SLICE_ORDERS = the six permutations of ['nation','estate','region'];  filter per picker: Nation, Estate, Region selects + Empire reset + slice-order select
scopeTree(country, order, measure: 'population'|'wealth') = nested [{key, level, value, heat: max grievance, children, hottest}]       // hottest = child with max heat at every level
map.js treemap(): slice-and-dice flex boxes, area = population, 🔥 on the hottest child, placed in a side column RIGHT of the map
```
- **(code-led)** the treemap is beside the map (kb: below), tile colour is a fixed grievance ramp at the top level (no choice of intensive readout), click does not drill down, no breadcrumbs, **no Back/Forward history, no scope highlight on the map** (the picker only filters tables, Laws and drafts), and the Estate and Empire scopes are always offered (no technology flag).
- Foreign Countries do not use the tree (readouts take the player's `country`).

### Lens System (Map workspace — togglable, instant, non-destructive)
Code: `ui/views/map.js` (`LENSES`, canvas drawing), `client/readouts.js` (`lens`)
```js
LENSES = {Terrain, Owner, Population, Subsistence, Unrest, Grievance(param: need), Goods(param: good), Roads, Commerce, Claims, Military, Cultural}
lens(lens, param) -> {values: Record<provId, number|nation>, max}        // per province; cell-resolution metrics are the Region's cells' population-weighted average (never smoothed beyond the Region), unrest = max cell rung in the Region
  population = province.population;  subsistence = 1 − wavg satisfaction.subsistence;  grievance[param];  goods = warehouse stock[param];  roads = infrastructureLevel;  commerce = state.economy.tradeInfra
  claims = claims on the province + (occupied ? 1 : 0);  military = men of armies in the province;  cultural = Nation with the largest presence
render: hex fill (terrain colour | owner colour | ramp(value/max) | Nation hue); selected hex white outline; armies = filled circle in the owner colour at the army's position; edges via drawEdges(hexmap.js)
```
- Switching lens re-renders from a fresh readout; nothing is stored. Table mode lists provinces (id, owner, terrain, region, population, lens value); Detail mode points at the docked card.
- **(code-led)** twelve flat lenses instead of the kb's domains (no Political with Dependency/Alliance lines and capitals, Economic, Trade Zones, Standing & Claims beyond the claim count; Goods has stock only, no production/price/scarcity/flow; Military has no Supply gradient, siege or concealment); hexes with `surface !== 'land'` use fixed `SURFACE` colours (the pre-2026-11-09 land/sea/lake model; there is no Sea terrain in data — `world_map__spec.md`; **Sea terrain and its lens colour are slice 3c**); **borders (Country bold, Region thin), the Regions rendering and the occupation hatch are not drawn** (`hexmap.js` not read: only `drawEdges` for edges was seen used).

### Map Symbols and Army Markers (2026-11-10)
Code: `ui/views/map.js` (army circles only)
- In code: a filled circle (r = 7) in the owner's colour with a white outline per army position; **no arrow, no stack badge, no fortress triangle, city square or Region-capital circle** (no `capital_province` or `fortification_level` data exists yet: `world_map__spec.md`, `war__spec.md`; the stored Region capital exists since 2026-11-17 as `regions[r].capital` (`setRegionCapital`) but the map does not draw it). **(target)**: marker readout `markers(country)` = settlement class from War fortification level and province data, Region capital from `regions[r].capital`, army arrow from `army.routeSide`, threshold-gated density (placeholder thresholds open).

### Army Orders (click-to-move — 2026-11-10)
Code: `ui/views/map.js` (`cv.onclick`), `ui/forms.js` (`orderMove`), `ui/views/dock.js`
- In code a canvas click only **selects a province** (docked province card); an army is moved by the `orderMove` draft (army and destination fields; the destination defaults to the selected province; dock buttons "Move army here"/"Order move"). **(target)**: click an army (select, highlight reachable provinces), click a province (queue `orderMove` with a route preview from War's pathing readout: `edge_quality`, blocked edges, progress per turn, Supply); Esc/empty click deselects; multi-turn routes along the edge graph **(proposed)**. No route preview or reachability readout exists.

### Occupation and Siege Display (2026-11-10, confirmed)
Code: `client/readouts.js` (`provinceCard.controller`, `military.occupations`), `ui/views/world.js` (Occupations chips)
- Shown: the province card lists Owner and Controller (the occupier from `state.war.occupations`); the Military tab lists occupations as chips; the Claims lens counts an occupation as 1. **Not in code**: hatch, siege ring, siege/garrison figures, martial-law and occupied-cell readouts, two-ways-to-hold line (War's `siege_readout`/`occupation_readout` do not exist: `war__spec.md`).

### Battle Report message (2026-11-10)
Code: none (no Message Feed; the turn report has no battle data; `state.war.score` entries appear only in the `military` readout's `score`)
- **(target)**: one message per battle from War's `BattleReport` (not in code), rows per round with green/red labelled tactics and casualties, enemy side stamped.

### Mobilization and Standing Army controls (2026-11-10)
Code: none — no `mobilize`, `demobilize` or standing-share type exists in War (`actions__spec.md`); the only army form is `fieldUnits` (origin cell, pool, men, muster province)
- **(target)**: "Mobilize Region" (primary), "Mobilize Empire", "Mobilize this cell" with a preview of covered cells × Levy × `involuntary_compliance`; standing-share dial on the Military tab (draft with gating, or a petition Question).

### Veto Factors Panel (2026-11-10)
Code: `client/readouts.js` (`preview`), `ui/app.js` (`openDraft`, `renderTray`)
- Shown: after Preview the sheet lists `valid`/`invalid` reasons, the action class, gate domain with `refused by <holders>` or `Veto: clear`, the visibility, and per covering holder `cell (stance)`; a blocked order shows a line that forcing it through Control means entitlement loss. **Not in code**: the factor list (acceptance factors, concessions, Opinion, Control cost), the force-through option (`forceThroughControl` is never set by the UI), `unknown` stamps.

### Grid (rendering)
Code: `ui/hexmap.js` (`geometry`, `hexPath`, `pickHex`, `drawEdges`, `TERRAIN`, `SURFACE`; not read this session), `client` `map` readout (`grid`, `hexes`, `provinces`, `regions` = `regionSnapshot.assignment`, `countries`, `edges`)
- Pointy-top odd-r canvas of the scenario grid; click picks the nearest hex. "Every hex a province, 500" is scenario/data (`world_map__spec.md`), not a UI assumption.

### Edge Rendering (structural, identical across lenses)
Code: `ui/hexmap.js` (`drawEdges`; not read) — called once per render, independent of the lens; river/bridge/pass/sea-lane/fortress styling **not verified**.

### Habitability Visual States / Resource Iconography
Code: not verified (`TERRAIN` colours only; no habitability desaturation or resource icons were seen in `map.js`).

### Visibility Stamp (on every political, covert or foreign readout)
Code: none
- All readouts are exact; several return `note` strings instead of data ("Dependency satisfaction readout: not modelled yet", "Government slate/attention line: not modelled yet" (**the Polity Questions tab; since 2026-11-21 the slate itself has the Apparatus card below, so this note may be stale: to check in code**), `portrait.observed: 'not modelled'`). `preview` is not observation-bounded (it validates against the full state). **(target)**: `stamp` field on political, covert and foreign readouts from Observation/Espionage (`administration__spec.md`, `diplomacy__spec.md`); the UI never fills `unknown`.

### Allocation Dial (the generic dial widget — settled 2026-11-03)
Code: `ui/views/apparatus.js` (`dial` tables), `ui/forms.js` (`setControlAllocation`, `setSpendingDial`), `client/readouts.js` (`govCard`: `controlDial`, `observationDial`, `spendingDial`)
- In code: dial entries are listed as read-only tables (scope, floor, priority, surplus weight); `setControlAllocation` adds or replaces **one** entry (floor, priority, surplus weight, mode add|replace) for the global Scope; `setSpendingDial` edits only the reserve (entries and sink are carried over). The Observation dial has **no form** (read-only table). **Not in code**: the priority stack with waterline, floor/surplus bars, linked surplus sliders with locks, headroom meter, group targets, per-cell expansion rows (`per cell × N = total`; `cellCard.controlFilters` shows the filters reaching one cell), reserve-floor line.

### Threshold Meter (fixed-threshold actions)
Code: none (threshold-bound Diplomacy types are plain forms; `preview` does not report thresholds or `target_scale`). The slate's fixed Coordination thresholds are shown as numbers in the slate card, not as a meter.

### Event Draft (staged pipeline for events)
Code: `ui/forms.js` (`FORMS`, `FORM_GROUPS`, `buildOrder`, `defaults`, `describeOrder`; pure, Node-tested), `ui/app.js` (`openDraft`, `draftOptions`), `client/readouts.js` (`preview`, `catalog`)
```js
draft: sheet from FORMS[type].fields(options) → buildOrder(type, values, options) = {order: {actor: {kind:'government', country: me}, type, params}} | {error}
preview: app.q('preview', {order}) → {valid, class, gateDomain, blocked, holders, foreign, verdicts: [{cell, stance}], visibility} | {valid: false, reasons}      // validate(ctx, a) + gate(ctx, a), nothing executed
queue: client.submit(order) → Orders tray
FORMS (29 in code since 2026-11-22; groups Government | Apparatus | War | Diplomacy, and the new forms in their module's group — grouping of the new ones not re-read):
  setTaxLaw, reformRightsDuties, placeRequisition, setMobilityGap, declareConvergence | setControlAllocation, setSpendingDial, propaganda, liftPropaganda | fieldUnits, orderMove, setTactic, declareWar, proposePeace | proposeTreaty, answerProposal, imposeSanction, denounceTreaty, recognizeBloc, grantFacilitation      // the 20 of 2026-11-15
  + 9 new (2026-11-21/22): directResettlement, expel, freeColonization, liftFreeColonization, setRegionCapital, reorganizeRegions (World Map) | extendDebates, liftExtendDebates, persuade (Administration)
scoped forms (tax, reform, requisition, control entry, propaganda; and the forced-move forms `directResettlement`, `expel`, which take a scope) take the global Scope as `params.scope`; a scope error blocks the build
```
- A `preview` readout exists in the client (validation plus gating verdict) — **the engine-level pure `preview(state, ruleset, orders, viewer)` of `actions__spec.md` still does not** (corrects that spec's "not in code" list, which should read: engine preview and Preflight not in code; client `preview` readout and `catalog` readout (≈ `listActions`) exist).
- **The `persuade` form (2026-11-22; `tests/queue.test.js` checks it, not yet run)**: fields `questionKey` (a Question being discussed, from the `slate` readout) and `amount`; `buildOrder` makes a Government order `{type: 'persuade', params: {questionKey, amount}}`; Preview shows the validation (live, discussed, Ledger can pay), the cost is the engine's (`persuade.costK × amount × faction population / persuade.popUnit`), not computed in the form. The slate card has a **Persuade** button per discussed Question that opens this draft with the key filled in. **Not in code**: a cost preview line in the form, standing Persuasion.
- **(code-led)** the gating panel is a text line; no force-through control; every draft is gov-actor; value entry for Laws is free text (`parseValue`: true/false/number/JSON/"remove"). **Not in code** (no ActionType yet): Mint, Borrow/Default, audits, Government sell/grant, standing-share, Emergency Powers, border policy, planning posture, **`proposeAnswer`** (the answer a debate votes on: `administration__kb.md` 2026-11-24, proposed, so no form is planned until the type exists).

### Analysis Widgets
Code: `ui/dom.js` (`bar`, `radar`, `table`, `badge`, `kv`, `rawView`; not read), `ui/views/dock.js`, `ui/views/polity.js`
- In code: **bars** (satisfaction, grievance, compliance voluntary/involuntary/total, Opinion signed bar), **Preference radar** (cell `pref` only; no observed-Portrait overlay), **escalation badges** on the cell card (`need: rung n`) and the Questions table (momentum, rung). **Not in code**: bullet bar with stacked compliance against grievance, bar breakdown dropdown (5+5 contributions with source module and log link), Why? decomposition, claimed-vs-delivered, Flow view, "acts next turn" marker, Negotiation meter and Withdraw tooltip.

### Workspace Specs
Code: `ui/views/{polity,apparatus,economy,world}.js`
- **Polity — Questions**: all live Questions of the Country, sorted existential > structural > routine then gap; columns tier, need, cell, gap bar, momentum, rung, population; routine count; the blocs (`factions`, first 40, raw JSON) card. The `note` says the slate/attention line is **not modelled** (no Threshold Meter, no above/below line); **since 2026-11-21 the slate, the debates and the assembly queue are shown in the Apparatus workspace instead (below)**. **Estates**: scope-filtered flat table (not a matrix) with Opinion, Subsistence, Grievance (max), Compliance bars and rung; row click opens the cell card. **Laws**: matrix rows = every ruleset Right and Duty, columns = **Empire, each Estate, each Nation** (`laws` readout; no Cell, Regional-Estate or Region columns, no tech gate), each cell = effective value or `mixed`, highlighted when set at exactly that scope; clicking a cell sets the filter and opens a prefilled `reformRightsDuties` draft; a card shows Convergence candidates and Mobility gaps with the `setMobilityGap`/`declareConvergence` drafts. **No** pending-law lighting, predefined value controls (ruleset-declared choices) or `narrative`. **Government**: Ledger, upkeep unmet, Control supply and bonus, martial-law cost, Coordination, Observation, tax-law table with a tax draft, amalgam bars, requisitions. No Emergency Powers or observed Portrait.
- **Apparatus**: C/C/O stacked bars with Control supply/bonus, martial-law cost and propaganda draw; Control and Observation dial tables; Spending card (Ledger, reserve, sink); propaganda table with start/lift drafts; **the Question slate and debates card (2026-11-21, handling/scope/concession 2026-11-22; not re-read in `src/ui/views/apparatus.js`)**, below. Emergency Powers, audits and border policy absent.
- **Apparatus — Question slate and debates card** (kb `administration__kb.md` Question Active Slate, Assembly Queue; query `slate(country)` from `client/readoutsAdmin.js`):
```js
slate(country) = derive.administration.slate(country) + {heldShare, supplies: {control, coordination}, extensions: [{id, questionKey, k, share}], freeColonization: [commitments]}
  derive part   = {attention, standing, questions: [{key, cell, need, tier, gap, priority, scope, petition, handling, status, debate}], unaddressed: key[], waiting: key[], assemblies: [{assembly, cap, slots, open}]}
  card rows     = one per Question: tier, need, cell, gap, priority, status ('slate'|'standing'|'debate'|'waiting'|'unaddressed'), handling ('debated'|'consulted'|'ignored'), scope ('region'|'multi'|'empire'),
                  the debate (turns left of its length, extension k, `conceded`), and the buttons: Persuade (a discussed Question), Extend debate (`extendDebates` draft) / Lift (`liftExtendDebates`, one's own extension)
  card header   = the supplies (Control, Coordination) with the share held by extensions (`heldShare`), the assemblies with cap, slots and open debates (the Country's assembly appears only when a multi-Region or country-wide Question exists)
```
  Every number comes from the `slate` readout (Rule 4); the card computes nothing. **Not in code**: a Threshold Meter or above/below line drawn for the slate, the agenda holders' shares per assembly as bars, the answer a debate votes on and its vote tally (kb 2026-11-24, target: they need `proposeAnswer`, `administration__spec.md`), a cost preview for Persuade, the Emergency Powers cost line.
- **Economy**: `economy` readout (pools total/committed/free, goods × zones with stock/demand/price, zones, zone edges with cap and `cross`, price level, coinage, obligations, Ledger) rendered by `views/economy.js` (**not read**; the kb's six tabs and the Flow diagram are not verified).
- **World**: Relations (ego graph SVG with node radius by power, edge colour by treaty kind; Countries table with reputation both ways, power), Treaties (active, proposals with answer, axis menu, grants, drafts), Mirror (reputation held toward you, CBs against you, amalgam), Military (armies table, wars table, rebel blocs with recognise, occupations chips, drafts). Pair sheet = docked Country card (Reputation both ways, four Leverage readouts, CBs both directions, treaties). No War Score ledger by cell, no Exhaustion bar beyond the title, no Peace Conference stack editor (a single `proposePeace` draft with cede/secede/concessions/treaties JSON), no mobilization, no `opinion`. **Population-move forms (2026-11-21, `directResettlement`, `expel`, `freeColonization` and its lift, `setRegionCapital`, `reorganizeRegions`) are drafts in the Draft menu; the province card's Region (stored capital, ownership) is shown, the Region card is not** (`world_map__spec.md`).

### Docked Detail Panel (live from owning module)
Code: `ui/views/dock.js` (`dockContent`), readouts `provinceCard`, `cellCard`, `pair`, `military`
- Cards for **province** (terrain, forest, habitability, water, Region, population, owner, controller, roads, commerce, stock chips, Nation presence, cells in the Region, armies; drafts Field/Move/Grant), **cell** (needs table, Opinion, compliance, escalation badges, Preference radar, Control allocation filters reaching the cell, Rights/Duties chips, flags; buttons Scope to this cell, Reform for this cell), **country** (pair sheet) and **army** (owner, position, men, cohesion, supply, tactic, composition; Order move/Tactic). **No Region card** (Mobilize, capital, hottest child) and no Mobilize this cell; Observation committed is not shown. **(not re-read 2026-11-24)** the 2026-11-21 forms may have added drafts to the province card (resettle / expel to this province); the cell card does not show whether a Question of the cell is discussed.

### Debug Mode
Code: `ui/app.js` (`app.ui.debug`, `#debug` checkbox), `ui/dom.js` (`rawView(obj, debug)`; not read), `ui/debugShell.js` (a separate debug shell; not read)
- A global checkbox toggles a raw JSON view in cards (`rawView`), which shows the exact readout object that rendered the card (no copy). **(code-led)** free-text value entry exists in every Laws/reform draft regardless of Debug Mode (kb: Debug-only).

### Actions (UI-level)
Code: `ui/app.js` and the views above
- In code: set Scope (filters, slice order), toggle lens and parameter, switch Map/Table/Detail, click province/row/node → docked card, open and queue drafts, remove/clear orders, Commitments ledger (release for propaganda), End Turn, Run 5, Debug toggle; **Persuade / Extend debate / Lift from the slate card (2026-11-21/22)**. **Not in code**: Scope Back/Forward, army-then-province click, Mobilize, standing-share dial, group/aggregate dial editing, Peace Conference stack editor, Withdraw, Run N slider, Message Feed, bar breakdown, View Raw per element (only per card), voting on or proposing an answer in a debate.

## Rules
Code: per-rule notes
1. Scope is global: the filter is read by Polity tables, Laws, Estates, drafts and `scopeTree`; the Map lens ignores it (no highlight).
2. Slice order is reorderable (six permutations); aggregation: extensive sums, intensive by max grievance for heat (not Weight-weighted); hottest child marked.
3. Lenses are pure re-renders from readouts at Region resolution for cell data (`lens`).
4. All content comes from `app.q` readouts; the UI keeps only `app.ui` (the slate card included: it reads the `slate` query).
5. Allocation Dial: no widget; entries added through drafts; surplus/floor semantics are the kernel's.
6. Linked surplus sliders and waterline: not in code. 6a. Spending reserve editable via `setSpendingDial`.
7. Commitments listed in the ledger; events go through Draft → Preview → Queue (the Persuade button opens a draft, it does not act at once).
8. Threshold Meters: not in code.
9. Visibility stamps: not in code; `unknown` never invented but also never produced.
10. No global tension meter or summed Leverage in code (the four readouts are shown separately in the pair card).
11. Factions only as the derived `factions` readout (and the faction fields of the `slate` readout); the Government is a card of numbers.
12. One-turn lag telegraph: not in code (the slate is written at step 6 for next turn; the card shows the state as of the last turn, without a "next turn" marker).
13. Skin/skeleton vocabularies kept separate by workspace (code follows).
14. Non-map views scroll vertically (CSS, not verified).
15. Edges identical across lenses (`drawEdges` once); density gating not in code.
16. Debug toggle global; `rawView` shows the rendering object.
17. Preflight: not in code.
18. Borders and Regions rendering: not in code.
19. Scope highlight and treemap below map: not in code (treemap at the side).
20. Message Feed and badges: not in code; a modal report instead.
21. Laws UI offers only declared choices: not in code (free text).
22–28. Symbols, click-to-move, occupation hatch, Battle Report, Mobilization, Veto factors, Withdraw warning: not in code (see sections).

## Status
- **Implemented (debug shell)**: five workspaces, global Scope filter with six slice orders and the population treemap with hottest-child marker, twelve lenses over a canvas hex map with armies as circles, table and detail modes, docked province/cell/country/army cards, Orders tray with preview verdicts, Commitments ledger, 20 Event Draft forms with Preview and Queue, Laws matrix with override highlighting, Questions/Estates/Government tables, World workspace (relations graph, treaties, mirror, military), Debug raw view. Tests: `tests/ui.test.js`, `tests/client.test.js` (files checked, names not).
- **Written 2026-11-21/22, not yet run (from the changelogs; `src/ui/*` not re-read)**: nine more forms (29 in all: `directResettlement`, `expel`, `freeColonization`, `liftFreeColonization`, `setRegionCapital`, `reorganizeRegions`, `extendDebates`, `liftExtendDebates`, `persuade`), the `slate` query and the Question slate and debates card in Apparatus with the Persuade button. The form checks in `tests/queue.test.js` and `tests/handling.test.js` have not been run; run `npm run build:data` and `npm test` first (24 new tuning keys since 2026-11-19).
- **Not in code**: everything listed as not in code above — Message Feed, attention badges, RunTurns slider and early stop, Preflight, Nations tab, Regions rendering, borders, Scope Back/Forward and highlight, treemap below the map, Allocation Dial widget, Threshold Meter, visibility stamps, Battle Report, army markers and click-to-move, occupation hatch and siege display, mobilization and standing-share, Veto factors list and force-through, bar breakdowns, Why?, Flow view, negotiation meter, Peace Conference stack editor, pending-law lighting, predefined Laws controls and narratives, Region card; **the debate's answer and vote display, a Persuade cost preview**.
- **(code-led)**: Turn Report modal; Country switcher; lens list; `SURFACE` land/sea/lake colouring; fixed Run 5; Laws columns Empire/Estate/Nation; Estates as a flat table; treemap at the side with population area and grievance heat; free-text Laws values; client `preview` and `catalog` readouts; **the Question slate lives in the Apparatus workspace as a card, not in the Polity Questions tab; the `slate` readout belongs to the Administration module (`client/readoutsAdmin.js`)**.
- **(spec decision)**: `messages`, `badges`, `preflight`, `nations`, `markers` readouts; slider with early stop; none confirmed. **(spec decision, 2026-11-24, follows the Administration kb)**: the slate card computes nothing and offers Persuade, Extend and Lift as drafts that go through Preview and the Orders tray; the answer and vote display waits for `proposeAnswer`.
- **kb gap (to close at the next `ui__kb.md` edit; it was not edited on 2026-11-24)**: the UI kb has no section for the Question slate and debates card, the `slate` readout or the Persuade draft; add them (Rev bump) when the kb is next touched. Until then this spec's slate card text has no kb mirror.
- **Corrections to other specs found here**: `actions__spec.md` says `preview`, `listActions` are not in code — the client `preview` and `catalog` readouts exist (the engine-level pure `preview` and Preflight do not). `economics__spec.md`/`countries__spec.md` list `opinion`, `satisfaction` and the observed Portrait as not in code: the UI readouts confirm it (`note: 'not modelled yet'`).
- **Open (kb/UI)**: wireframes, icon set, palette, stipple technique, density thresholds, treemap default measures, table column sets per lens, End Turn behaviour with an empty tray, green/orange semantics, tech-gate hiding vs greying, `narrative` content.
- **Sync:** (`<section> = <kb rev> / <code rev>`; `-` = no or insufficient code+tests)
  - Data Structures > Shell (persistent across workspaces) = 1 / -
  - Data Structures > Workspace (top-level enum, replaces Screen) = 1 / -
  - Data Structures > Scope (one syntax, shared with Rights/Duties/Control/Requisition) = 1 / -
  - Data Structures > Lens System (Map workspace — togglable, instant, non-destructive) = 1 / -
  - Data Structures > Map Symbols and Army Markers (2026-11-10) = 1 / -
  - Data Structures > Army Orders (click-to-move — 2026-11-10) = 1 / -
  - Data Structures > Occupation and Siege Display (2026-11-10, confirmed) = 1 / -
  - Data Structures > Battle Report message (2026-11-10) = 1 / -
  - Data Structures > Mobilization and Standing Army controls (2026-11-10) = 1 / -
  - Data Structures > Veto Factors Panel (2026-11-10) = 1 / -
  - Data Structures > Grid (rendering) = 1 / -
  - Data Structures > Edge Rendering (structural, identical across lenses) = 1 / -
  - Data Structures > Habitability Visual States / Resource Iconography = 1 / -
  - Data Structures > Visibility Stamp (on every political, covert or foreign readout) = 1 / -
  - Data Structures > Allocation Dial (the generic dial widget — settled 2026-11-03) = 1 / -
  - Data Structures > Threshold Meter (fixed-threshold actions) = 1 / -
  - Data Structures > Event Draft (staged pipeline for events) = 1 / -
  - Data Structures > Analysis Widgets = 1 / -
  - Data Structures > Workspace Specs = 1 / -
  - Data Structures > Docked Detail Panel (live from owning module) = 1 / -
  - Data Structures > Debug Mode = 1 / -
  - Data Structures > Actions (UI-level) = 1 / -
  - Rules = 1 / -
