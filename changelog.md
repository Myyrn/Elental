# Elental — Changelog

New entries go here (one section per change, header = title and date), per the edit flow in `index.md`. Earlier entries still live in the `index.md` Changelog section.

## AI — Diplomacy, first pass — 2026-11-11
Committed directly to `main` at the designer's request. Files touched: `kb/ai_diplomacy__kb.md` (new; the doc layer is skipped by decision), `spec/ai_diplomacy__spec.md` (new).

**Settled (designer input)**
- **Scope**: alpha AI focuses on international diplomacy and alliances; internal politics runs on autopilot using only actions the player also has — no artificial stability floor.
- **Symmetry**: the player is an ordinary Country; Posture toward any Country is one function of opinion, Leverage readouts, CBs and the rest. The initial opinion seeds the posture and sustained behaviour can flip it. Four-value Posture enum with a hysteresis cache.
- **Parallel actions**, not a strict ladder: the AI strengthens itself and secures contested assets first, provokes or fabricates a CB, finishes with war, and builds an alliance network to squeeze rivals. Balance-of-power term included.
- **Campaign**: a stored record of the AI's current intent per target; it adds a focus bonus to aligned actions but forbids nothing. Switching types is free (no action, no labour) with a small switch margin as hysteresis; existential threats and sudden opportunities bypass the margin.
- **CB fabrication**: goading, framing a third Country by false flag, or a false flag against the AI's own Region.
- **Implementation**: deterministic utility AI, one module, no LLM at runtime; AI-War keeps minimal hooks (border deployment, Declare War, default army handling).

**Spec written (`ai_diplomacy__spec.md`)**: agent `planDiplomacy` returning orders plus a cache written through an `ai` module service; a single `reads.js` adapter so the agent runs before the Diplomacy module exists (roles whose ActionType is not registered are skipped); posture, balance-of-power, campaign selection with margin and bypass, greedy value-per-labour selection under binary thresholds, covert risk pricing, CB fabrication plays, proposal responses, `ai.dip.*` tuning keys. Items tagged **(spec decision)** there await the designer's OK, notably that "strengthen first" is not implemented by this agent in alpha (it is limited to scenario default dials, `simpleWar.js` and the diplomatic half of Secure).

**Proposed (awaiting the designer's OK)**: the Campaign type list (Court, Secure, Squeeze, Provoke, Strike, Support), the focus-bonus mechanism, and the bypass rule.

**Open**: how the AI estimates a target's detection strength (spec reads exact data in alpha); the Contested Asset formula; Portrait → appetite mapping; the `effects` table; all numbers (switch margin, Posture band).

**Not yet done**: check the `diplomacy__kb.md` false-flag wording against a self-targeted false flag; code, tests, `modules__spec.md` pointer, `index.md` module row 13 (still lists a stub doc), `.outline/`. The Diplomacy module itself is still unimplemented.

## Army composition, third pass — 2026-11-11
Committed directly to `main` at the designer's request. Files touched: `kb/war__kb.md`.

**Settled (designer answers)**
- **Overflow**: Contingents are never divided (not by sorting, not by Split). A Contingent that does not fit in a detachment's remaining capacity, and any other excess, goes to the detachment lower in priority (Vanguard → Rearguard → Center). Center may exceed its share; a detachment may stay under capacity.
- **Tolerance speed**: the lower `army_speed` of the two armies for Merge; the lower speed of the moved Contingent and the receiving detachment for Reassign.
- **Rearguard raid interception**: the same `screening_strength` contest as Compel.
- **Stance**: automatic per Contingent and always **Balanced** for now (a new neutral entry in the stance list); AI — War will later change stances for AI armies according to its tactics and strategic goals.
- **Lateral position**: not stored; derived from `entry_side` and depth. Merge compares the derived positions per detachment.
- **Templates**: choosing a template again overrides manual reassignments; templates are a technical convenience for routine, with no in-game mechanic and no Country ownership.
- **Numbers pass**: Rearguard encirclement prevention and Rout ordering, `tol_base`.

**Proposed (awaiting the designer's OK)**
- **Reinforcement**: while a Contingent's supply path is unbroken it regains lost strength each turn, up to its `mustered_count`, at the cost of its origin cell's Army pool (new field `mustered_count`; `reinforce_rate` and any goods cost per head open).
- Merge distance measured along the line from the entry edge through the province center; the merged army keeps B's `entry_side` and takes the troop-weighted average of the derived positions.
- **Consequence to confirm**: a single Contingent larger than a detachment's remaining capacity goes down whole, so Vanguard or Rearguard can end up empty.

**Not yet done**: spec (`admin_war_diplomacy__spec.md`), code (`fieldUnits` still takes an explicit composition; `fight()` ignores detachments; tactic is per army; no Balanced stance; no reinforcement), tests, `ui__kb.md`, `ai_war__doc.md`, `.outline/`.

## Army composition, second pass — 2026-11-11
Committed directly to `main` at the designer's request. Files touched: `kb/war__kb.md`.

**Settled (designer input)**
- **Sorting templates**: player-authored, any number of them, chosen whenever the player deploys or changes an army's composition. Rule vocabulary: `take_all(pool)`, `take_share_of_remaining(pool, f)`, `fill_ratio({pool: weight})`.
- **Default template**: 20% Vanguard / 60% Center / 20% Rearguard. Vanguard takes all Cavalry, then Skirmishers : Shock Infantry 2 : 1 until full. Rearguard takes 30% of the remaining Cavalry, then Skirmishers : Shock Infantry : Pike Infantry 3 : 1 : 1 until full. Center takes everything left.
- **Contingent generation**: a pool under 10% of the cell's total troops is not deployed; Artillery, Siege Corps and Mages are exempt. The Retinue boost raises pool generation, so it feeds the pool share indirectly.
- **Merge**: same owner, same province, and every detachment's depth within a speed-based tolerance (quicker troops, larger tolerance; terrain and obstacles post-alpha). **Split**: new army starts at the same position with the parent's depths. Both are Commitments.
- **Reassign** Contingents between detachments while their depths are within tolerance.
- **Stance** is set automatically per Contingent; **tactic** is set per detachment.
- **Rearguard duties**: intercepts Vanguard raids on supply routes, prevents encirclement, keeps broken or retreating main forces in order.

**Proposed (awaiting the designer's OK)**: cutting a Contingent at a capacity boundary when sorting; behaviour when a pool in a ratio runs out; the speed basis of the tolerance; troop-weighted average depths after a merge; the Rearguard interception contest reusing `screening_strength`.

**Open**: the rule that picks a Contingent's automatic stance; whether `entry_side`/`route_side` must match for a merge; whether choosing a template again overrides manual reassignments; whether templates belong to the Country or the player; numbers for Rearguard encirclement prevention and Rout ordering; `tol_base`.

**Not yet done**: spec (`admin_war_diplomacy__spec.md`), code (`fieldUnits` still takes an explicit composition; `fight()` ignores detachments; tactic is per army), tests, `ui__kb.md`, `.outline/`.

- **2026-11-10 (army composition; committed directly to `main` at the designer's request)**: `war__kb.md` — **Contingent** (the wording for the designer's "individual stack"; also the new shape of the Fielded Unit): the troops of one Army pool from one origin cell; a cell contributes its total Duty troops divided across the Army pools it generates, and a pool under a **10% minimum share** produces no Contingent; **army merge** (all three detachment depths equal, detachments combined separately) and **split** (whole Contingents only); detachments are **strategic roles** (Vanguard scouts/harasses/screens/forages and can be caught alone; Center fights and sieges; Rearguard protects supply lines and can be scattered and caught away from the main body); Contingents are sorted into detachments automatically. **Supersedes** the "no change" note on vanguard/centre/rearguard in the entry below. Items tagged **(proposed)** await the designer's OK: the default pool → detachment sorting table, merge conditions of same owner and province, a split army inheriting the parent's province and depths; open questions are listed in the file's Status. **Not yet done**: spec (`admin_war_diplomacy__spec.md`), code (`fieldUnits` still takes an explicit composition; `fight()` ignores detachments), tests, `ui__kb.md`, `.outline/`.
- **2026-11-10 (later, Diplomacy catalogue; committed directly to `main` at the designer's request)**: `diplomacy__kb.md` — **Action Catalogue** written: one direction per action (positive 0–100, hostile −100–0, tiers, duration), positive and negative actions split; Embargo (strength, entire Country or chosen Regions, all goods or chosen goods) replaces Trade Sanctions; Tariffs replace the Sanction tiers with a derived tariff-asymmetry readout that can open a Grievance-tier CB; alliance actions as a Military subsection (Benevolent Neutrality → Defensive Pact → Standing Offensive chain, higher covers and disables lower in negotiation; Coalition independent); Improve Relations (decaying opinion modifier, refresh never stacks). `war__kb.md` — **Show of Force replaces Troop Training** (derived from border deployment, not a commitment or a diplomatic action); occupation/siege readouts confirmed. `world_map__kb.md` / `ui__kb.md` — a Region's capital is a stored administrative setting (`capital_province`) chosen by the player or AI when the Region is defined or redefined; occupation/siege display confirmed. **Known stale references**: `ui__kb.md` (Military tab, cross-references) and possibly other kb files still say "Troop Training"; read it as Show of Force. **Not yet done**: spec/code/data/tests, `.outline/`, `cross_module_notes__kb.md`, the `narrative` text of each catalogue action, the pointer line in `internal_politics__kb.md`. Items tagged **(proposed)** in those files await the designer's OK.
- **2026-11-10 (designer input, committed directly to `main` at the designer's request)**: `war__kb.md` — levy vs. standing forces with a per-cell `standing_share` dial set as a political decision (cells pay the higher upkeep, Government may compensate), scoped Mobilization (cell / Region / Empire), Retinue scalar boosting military-pool contribution except Artillery and Meteomancy/Theurgy (pool output only, not Fairness), Peace Conference proposal stacks (obligatory/optional), Battle Report trace, occupation/siege readouts (proposed). `administration__kb.md` — assembly queue (Coordination-derived cap per Region and Country, agenda shares by Council/Petition Rights) and Question resolution time (1 / 3 / 5 turns by scope, early only by majority or full consensus against a strong veto); the pointer in `internal_politics__kb.md` is pending that file's split. `diplomacy__kb.md` — Negotiation Session (no fixed term, withdrawal restarts from scratch, satisfaction meter, decaying Reputational Leverage mark for a stronger withdrawing Country). `world_map__kb.md` — lakes as playable, unsettled water provinces; starting population anchors (Grassland ≈ 10,000; Taiga/Mountain ≈ 1,000). `ui__kb.md` — click-to-move, occupation hatch and siege display, fortress triangle / city square / Region-capital circle, army circle-with-arrow, Battle Report message, mobilization controls, Veto factors panel, negotiation meter. **No change** by designer decision: vanguard/centre/rearguard (existing detachment model stands), coalitions/blocs (per-issue partial coalitions stay as written). **Not yet done**: occupation rule revisions (to be discussed with the designer), spec/code/data/tests, `.outline/` and `cross_module_notes__kb.md`. Items tagged **(proposed)** in those files await the designer's OK.
- **2026-11-09 (designer input)**: scope ladder with tech-gated Estate/Empire scopes and a Precedence flag; laws per administrative Region; Region reorganization; forced resettlement and expulsion; consultation/petition handling; sea provinces playable; five-Country placeholder world; Government sells/grants goods; calibration target; UI: Apparatus before Polity, Nations tab, Regions rendering, scope highlight, scope tree below map, Message Feed and badges, predefined law values with narrative text, Back/Forward, 1-100 run slider, bar breakdowns, Trade Zones lens, pending-law lighting; editor Nation lens. Files touched: `internal_politics__kb.md`, `world_map__kb.md`, `economics__kb.md`, `nations__kb.md`, `ui__kb.md`, `spec/scenario_editor__spec.md`, `index.md`. Items tagged **(proposed)** in those files await the designer's OK. Task intake order added.
- **2026-11-09 (repo mode)**: GitHub monorepo layout (`kb/ doc/ spec/ src/ scenarios/ tests/ tools/ .outline/`); Access rules (outline → section, `Code:`/`Spec:` links, header discipline enforced by `check-headers`); Working mode (session branches, kb → spec → code → tests commit order); session workflow rewritten for repo access; secrets never stored.
- **2026-11-03 (UI / dial pass)**: `ui__kb.md` rewritten (shell + five workspaces: Map, Polity, Apparatus, Economy, World; global Scope with reorderable slice order and treemap; Lens system with ten domains and map/table/detail renderings; visibility stamps; Threshold Meter; Event Draft; Orders tray, Commitments ledger, Turn Report, End Turn Preflight). **Allocation Dial settled**: floor + priority + surplus ratio (+ cap, sink); per-cell default with aggregate filters and player-named groups as bulk shorthand; surplus auto-fill free; applies to Control, Observation, Government spending (standing dial with reserve floor, sink = keep, replacing "re-chosen every turn") and dual-claim pool splits; garrison priority and other scalar dials stay plain dials. Preflight warnings are advisory (projected Ledger shortfall, floors above produced output, refused events, below-threshold actions). Files touched: `administration__kb.md`, `actions__kb.md`, `internal_politics__kb.md`, `economics__kb.md`, `cross_module_notes__kb.md`, `index.md`, `ui__kb.md`.

- **2026-11-03 (audit)**: consistency audit across all kb files. Cells are actors with permitted/granted/defiance action classes; Foreign Standing = Nation Sympathy + cell terms, plus Government-to-Government standing (Government values as a Weight-weighted amalgam of the most powerful cells); Concert replaced by a derived great-power-backing predicate; Meteomancy revised (rituals are preconditions for crisis-resolving actions, authored relative price survives but no scarcity market; character-scale rituals post-alpha); Fuel is flexible sourcing (45 goods); debt service, numeraire scarcity (`price_level` in the price formula), cross-zone friction, per-observer deniability, propaganda as directed output settled; Annexation as a forced-annexation CB; Country.standing derived; Administration sections aligned to the four-section layout and Control Allocation scope unified; stale text corrected.

- **2026-11-02 (Nations/World Map pass)**: population dynamics (derived growth, migration, settlement as migration plus direct action by cell or Government); Region re-derivation once at end of turn with banded trigger; cataclysm moved beyond alpha; co-titular Nations as a set; kin-state toolkit dissolved; Nation pool affinity; assimilation transfer rule.
- **2026-11-02 (War pass)**: alpha naval scope (transport/supply only, no fleets); soft substitutable occupation garrison; rebel Peace Conference reuse; scalar Retinue Right; civil-war martial law; Troop Training as a commitment; Army Tactics as dials; war-declaration timing; Veto strength defined by cell privileges.
- **2026-11-02 (Countries/Diplomacy pass)**: Dependency satisfaction as a derived readout; one axis menu (DomainVeto replaces `government_form`); Confederation as a symmetric bundle with no teeth; CB persistence classes (state-based/event-based/structural); per-observer overreach; binary below-threshold actions with target-scaled thresholds; rebels' international-recognition route; collapse as outcome of armed conflict/Peace Conference.
- **2026-11-02 (later)**: Credit settled (no anonymous debts, obligation records, derived interest with optional legal ceiling, range follows trade zones); `trade_infrastructure_level` as a per-province stock; Land share bookkeeping; Prices = authored base × derived scarcity with the money metal as numeraire; minting fineness parameter and per-issuer record; Teaching permanent loss; detection = Observation + counter-intelligence Espionage with sender-attribution tier and false flags; Emergency Powers cost derived (no duration term).
- **2026-11-02**: Actions module drafted (`actions__kb.md`: envelope, dial/commitment/event classes, turn pipeline, gating, Decision Log write path). Rules pass: Government and Ledger merged (Ledger never negative, Borrowing the only way past balance, per-turn spending priority); faction escalation momentum/hysteresis; scope syntax and Region-level Convergence/Mobility/Demotion (rarity must emerge from cost); Teaching and Meteomancy/Theurgy valuation (authored relative ritual prices); Administration slate-as-attention, proportional upkeep degradation, leaderless defection, Observation-as-detection with Diplomacy; Faction Multiplicity/rival branches/three-pool templates/corruption dissolved. Convention: rules first, numbers pass later.
- **2026-11-01 (later)**: Triangle retired; Institutional↔Personalistic
  derived readout; Land layer shape settled; benefits (pain/joy) and armed
  faction rung → War settled; Events/Characters beyond alpha; backend-first.
  `war__kb.md` and `diplomacy__kb.md` updated for the overhaul (per-cell War
  Score, derived Exhaustion, internal armed conflict → War; foreign
  propaganda, Cultural Leverage, kin-state appeal → Diplomacy).
- **2026-11-01**: Core-mechanics overhaul pass. `internal_politics__kb.md`:
  Fairness bucket (contribution vs. entitlement) + entitlement-loss
  decaying modifier; Awareness + attributed discontent; Government as
  material-needs-only resource-holder; issue-scoped *acting* Factions;
  per-cell Preference vector over Portrait axes with pool-gated propaganda;
  Requisition Duty; Portrait = AI behaviour / player-observed record.
  `administration__kb.md`: active slate = Government attention only
  (Questions independent of it); Faction spawn/despawn dissolved; upkeep
  degradation + Requisition enforcement. `economics__kb.md`: Requisition,
  Government as market buyer, contribution valuation (open), propaganda
  pools. Nation-bloc strict unanimity replaced by partial cross-Estate
  coalitions (full-Nation bloc only when all Estate-cells share the goal);
  Government propaganda draws on the Coordination pool. Government Triangle retired; Nations, Countries and World Map got
  pointer-only updates; War/Diplomacy/UI kb not audited this pass.
- **2026-09-13**: Full kb restructuring pass. `administration__kb.md`
  created (previously did not exist — Control Allocation moved here from
  `internal_politics__kb.md`; old Administration draft's Faction-spawn/
  Loyalty/three-pool content flagged as open reconciliation debt rather
  than carried forward as settled). `world_map_graphics__kb.md` retired,
  merged into `ui__kb.md`. `war__kb.md`'s Occupation section deduplicated
  (single source of truth, was previously also in `internal_politics__kb.md`).
  Fixed a direct contradiction in `world_map__kb.md` Rule 9 regarding
  `infrastructure_level` vs. Economics' `trade_infrastructure_level` (now
  explicitly distinct stocks).
