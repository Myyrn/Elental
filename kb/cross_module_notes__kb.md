# Cross-Module Notes — Knowledge Base

Status: updated 2026-11-03 (consistency audit pass — see `index.md` changelog); previously 2026-11-02 (rules pass: Ledger, faction escalation, Actions,
Administration — see `index.md` changelog); prior pass 2026-11-01
(core-mechanics overhaul), then 2026-09-13 following the full kb restructuring pass (see
`index.md` changelog). Per this file's own convention, items already
formally assigned to a single module are listed here only as pointers;
this file retains only items that are genuinely cross-cutting (no single
owning module) or still awaiting assignment.

---

## Data Structures

### Escalation / "Great Wars" Pathway (no owner — emergent, by design)
No global tension metric exists anywhere in the data model. Large-scale
war is the emergent sum of: broken treaties, forced annexations, ignored
claims (Countries/Diplomacy; cataclysm use is post-alpha) — filtered through population
will (Nations/Internal Politics) — plus the concrete bridge already
settled: supporting a stateless Nation's secession bid is a CB-generating
act (see `countries__kb.md` Rule 8). No module computes "global tension"
directly; this remains a designed emergent property to monitor once War/
Diplomacy AI exist, not a data structure to build.
Corollary (2026-11-01): crisis severity used by acceptance/attribution
mechanics (see `internal_politics__kb.md`) is read from live Question
state, never stored as a global.

### Reputation-like Value Caching (cross-module principle)
```
cached_value = f(underlying_material/event_history)   // always re-derivable
```
Trust, prestige-equivalents, and similar soft values may be cached for
performance but must never become a freely-spent independent currency —
applies wherever such values appear (Internal Politics' Prestige and Foreign Standing, Diplomacy's Reputational Leverage; Countries' `standing` is a derived readout). Cell Preference modifier stacks
and the entitlement-loss / "incompetent government" modifiers follow the
same shape (baseline + decaying modifier, re-derivable from event history).

### Meteomancy (setting-wide magic system definition)
The world's magical tradition as a whole (not weather-magic specifically):
slow, ritual-based, reagent-consuming (Magical Reagents → Processed
Reagents → ritual action), performed at population scale via Economics'
Meteomancy/Theurgy Skilled Labor pool. Immediate/personal magic exists only
for rare named Archmages — a Characters-module concern, not yet designed.
No single module "owns" this definition; it's shared vocabulary Economics,
Internal Politics, War (Mage units), and Characters all read.
Pricing convention (2026-11-02): every ritual (population-scale in alpha; character-scale is post-alpha) has a manually authored relative price — a multiple of a
numeraire (a unit of Refined Precious Metals, the money metal), never absolute (see `economics__kb.md`). Rituals are preconditions for special actions that directly resolve, alleviate or change a crisis; the authored price is the ritual's value, not a market price — no scarcity market and no crisis-demand term (2026-11-03).

### Cells as Actors; the Government is Not a Will (2026-11-03)
Cells are actors in their own right (Actions, Cell actions); factions stay derived groupings. The Government is a resource-holder, not a second will;
for AI-run Countries its values are the Weight-weighted amalgam of the most powerful cells' preferences (Internal Politics). International order has no body:
the lateral treaty graph plus the weight of the strongest Countries (derived predicate in Diplomacy, replacing "Concert").

### Characters as a Live, Deferred Dependency
Faction leadership (named nobles, bishops, a Secret Police chief),
individual envoys/spymasters, and named commanders are explicitly where
Administration, Diplomacy, and War's formulas will eventually need
Characters' data. Now also blocking two named Diplomacy axes (Succession,
Common Ruler — see `diplomacy__kb.md`) and War's named-commander bonus/
ransom hooks. Flagged so the future Characters module (currently a stub —
see `index.md`, beyond alpha, 2026-11-01) doesn't have to retrofit hooks
into four already-settled modules. Acting, issue-scoped Factions
(2026-11-01) add faction leadership (Internal Politics' optional
Character-leader) to this dependency. Characters is beyond alpha (2026-11-01):
alpha factions are leaderless and the dependent hooks (Succession, Common
Ruler, named commanders/ransom, envoys) are post-alpha.

### Administration/Diplomacy/War Skin-Skeleton Pattern
Administration (Actor-cell negotiation, via Control Allocation and the
Question queue), Diplomacy (Opinion/Leverage/Goals/CB), and War's Peace
Conference all resolve through the same underlying shape — a party's
stance (material self-interest × modifier) weighed against accumulated
relationship history, resolved via Persuasion/Control-equivalent
mechanics — presented through entirely different player-facing
vocabularies. Diplomatic ratification is gated by Administration's
Control Allocation/Question machinery underneath but this is never
surfaced in UI — a player who works out the connection independently is
meant to be rewarded with better play, not taught it directly.
Faction stance (2026-11-01) = material self-interest × Preference-vector
alignment — the same stance-times-modifier shape.

### Portrait-Axis Vocabulary (shared; state owned by Internal Politics)
The Government Portrait axes (Extraction↔Investment, Homogenizing↔Pluralist,
Fervor↔Secular, Ruthlessness↔Restraint, Conservatism↔Reformism) are shared
vocabulary: Internal Politics holds cell Preference vectors and the
Portrait; Nations reads it as its first political trait/mentality
vocabulary; Diplomacy's foreign propaganda/Covert Faction Influence targets
cell Preference modifier stacks; Economics supplies the pools propaganda
draws on. Five axes kept for alpha (2026-11-01); revisit after the pacing pass.

### Exogenous Shocks (emergent in alpha — settled shape 2026-11-01)
With Events beyond alpha, exogenous shocks are emergent only: harvest variance
(Economics yields), epidemic from `sanitation_level` × `urbanization_rate` ×
Medicine pool (World Map risk drivers, Economics pool), cataclysm is post-alpha.
No scripted events. These are the sources of contribution shifts (plague, war,
trade boom) for the Fairness bucket.

### Causal Provenance (deferred dependency on Events)
Attributed discontent (Awareness × causal visibility) and the
fabricated-emergency rule need to know which crisis traces to which
Government decision. No module owns this; the Events stub is the likely
home, but Events is beyond alpha — so the alpha mechanism is a decision log
with public vs. covert causal action (schema owned by Internal Politics, written
via Actions — settled 2026-11-01/02).
Intent is never modeled. Fog-of-war remains a separate deferred layer.

## Rules

1. No module may introduce a free-floating global metric to short-circuit
   an emergent cross-module property (see Escalation Pathway) — this
   applies even under performance pressure; use cached-and-rederivable
   values (see Reputation-like Value Caching) instead.
2. Any new "soft" tracked value (reputation, standing, trust-equivalent)
   introduced by any module must follow the Reputation-like Value Caching
   shape — cacheable, never independently spendable.
3. A skin/skeleton pattern match (same resolution shape, different player
   vocabulary) is not to be "simplified" into one shared UI — distinct
   vocabularies are intentional per module.
4. When two modules' kb files describe the same mechanic, the mechanic is
   moved to a single owning file and the other cross-references it — never
   duplicated verbatim (applied 2026-09-13 to Control Allocation, moved
   from Internal Politics to Administration, and Occupation, deduplicated
   into War as sole source).
5. Attribution follows causal provenance × awareness; intent is never modeled — no module adds an "intent" flag to short-circuit it (2026-11-01).
6. Cells act; factions do not. No module gives the Government a will of its own (2026-11-03).

## Cross-references — items already assigned, now settled elsewhere

- **Region/Megaregion player-attention clustering, Region-fracture
  population-split rule** → `world_map__kb.md` (World Map-owned, computed
  from Nations' province population data).
- **Estate economic profile** (per-Estate default labor-allocation pull) →
  `internal_politics__kb.md`.
- **Administrative institutions as player-directed Skilled Labor blends
  (no hardcoded Bureaucrats/Secret Police/Army-Administrative types)** →
  `economics__kb.md` (envelope production) + `administration__kb.md`
  (Control Allocation targeting layer, settled — moved from Internal
  Politics 2026-09-13).
- **Question-generation / compliance model** (Grievance vs. voluntary +
  involuntary compliance) → `internal_politics__kb.md`; the Coordination-
  gated **active Question slate** (severity-prioritized, limited slots) →
  `administration__kb.md`.
- **World Map terrain/edge model** (9 terrain types, forestation as
  independent scalar, edges not hex attributes) → `world_map__kb.md`.
- **Hex grid retained; square grid and full province-graph declined for
  now** → `world_map__kb.md` (grid substrate) / `ui__kb.md` (rendering) —
  **`world_map_graphics__kb.md` is retired**, merged into `ui__kb.md`
  2026-09-13; province-graph remains a flagged real open architectural
  question for a future World Map session, not a closed decision.
- **Trade-zone tolls / subinfeudation double-dip** → `economics__kb.md`
  (Estate-Tariffs) cross-referencing `internal_politics__kb.md` (Local
  Jurisdiction Right).
- **Administration/Internal Politics ownership hierarchy** (Internal
  Politics owns all Actor-cell state; Administration owns only the
  Control/Coordination/Observation targeting layer) → **resolved
  2026-09-13**: `administration__kb.md` now exists. Its Control Allocation
  section is settled; the remainder (Faction spawn/despawn beyond the four
  base Estates, Faction Multiplicity/coup-proofing, three-pool default
  institution templates) is carried over from the old
  `administration__doc.md` draft but explicitly **not** asserted as
  reconciled against Internal Politics' newer Actor-cell model — see that
  file's own Open Questions / Status sections.
- **"Empire" = "Country"; titular status survives dependency by default**
  → `countries__kb.md`.
- **Supporting a Nation's secession bid is CB-generating** →
  `countries__kb.md` Rule 8, `internal_politics__kb.md` cross-references.
- **Faction rebellion = Nations' Statehood Pathway, same event two
  lenses** → `nations__kb.md` Rule 8.
- **Occupation** (province-capture state: Grievance/sympathy, martial law,
  Faction-eligibility exclusion, removal on peace/annexation) → `war__kb.md`
  (single source of truth as of 2026-09-13; was previously duplicated
  verbatim in `internal_politics__kb.md`, now removed there).
- **`infrastructure_level` vs. `trade_infrastructure_level`** → confirmed
  as two distinct stocks (roads/logistics, World Map-owned, vs. commercial
  institutions/markets/banks, Economics-owned) — `world_map__kb.md` Rule 9,
  correcting a prior direct contradiction between that file's Rule and
  Cross-references sections.
- **Issue-scoped, acting Factions; Fairness bucket; entitlement-loss modifier; Awareness; cell Preference vector + propaganda; Requisition Duty; Government material needs; Portrait AI/player split** (2026-11-01) → `internal_politics__kb.md`.
- **Active slate = Government attention only; unmet-upkeep C/C/O degradation; Requisition enforcement via Control Allocation** → `administration__kb.md`.
- **Contribution valuation; Requisition pre-cascade ordering (settled in the Actions pipeline); Government as market buyer; propaganda pool draw** → `economics__kb.md`.

- **Credit/Prices/Money/Land/trade infrastructure (2026-11-02, later)** → `economics__kb.md` (obligation records, derived credit market, authored base × scarcity prices with the money metal as numeraire, Mint fineness parameter, Land share bookkeeping, per-province `trade_infrastructure_level`); Lending and trade-infrastructure construction as Rights, net-position Demotion trigger → `internal_politics__kb.md`; detection tiers, sender attribution, false flags → `diplomacy__kb.md`; Emergency Powers cost → `administration__kb.md`.
- **Countries/Diplomacy pass pointers (2026-11-02)**: Dependency satisfaction readout, unified axis menu (DomainVeto), Confederation, collapse/merger, international-recognition route → `countries__kb.md`; CB persistence classes, per-observer overreach, binary thresholds scaled by target, DomainVeto, Leverage readouts → `diplomacy__kb.md`; faction recognition appeal → `internal_politics__kb.md`.
- **War pass pointers (2026-11-02)**: alpha naval scope, soft garrison, rebel Peace Conference, civil-war martial law, Troop Training, Army Tactics as dials → `war__kb.md`; scalar Retinue Right and Veto strength from cell privileges → `internal_politics__kb.md`; war-declaration timing → `actions__kb.md`.
- **Population/Nations/World Map pass pointers (2026-11-02)**: population growth, migration, settlement, Region re-derivation timing, cataclysm post-alpha → `world_map__kb.md`; co-titular set, kin-state toolkit dissolved, pool affinity, assimilation transfers → `nations__kb.md`; Settlement Right → `internal_politics__kb.md`; pipeline step 8 → `actions__kb.md`.
- **Rules pass pointers (2026-11-02)**: Government/Ledger merged and settled, faction escalation momentum, scope syntax and Region-level Convergence/Mobility/Demotion → `internal_politics__kb.md`; slate-as-attention, proportional upkeep degradation, leaderless defection, Observation-as-detection → `administration__kb.md`; Observation vs. Espionage detection contest → `diplomacy__kb.md`; Teaching and Meteomancy/Theurgy valuation → `economics__kb.md`; Ledger priority dial, Borrow/Default Events → `actions__kb.md`.
- **Dial pass pointers (2026-11-03)**: Allocation Dial (floor + priority + surplus ratio, cap, sink; per-cell default with aggregate/group filters; free surplus auto-fill) → `administration__kb.md` (Control/Observation) and `actions__kb.md` (generic subclass, spending dial with reserve floor, pool-claim splits, End Turn Preflight); standing spending priority and reserve as visible alternatives → `internal_politics__kb.md`; pool-claim split → `economics__kb.md`; widgets and workspaces → `ui__kb.md`.

## Status
- Items above with a target-file pointer: **settled, moved**.
- Escalation Pathway (no-owner, emergent-by-design), Reputation-caching
  principle, Meteomancy definition, Characters-as-deferred-dependency flag,
  Administration/Diplomacy/War skin-skeleton pattern: **settled as
  cross-cutting, intentionally unowned by a single module**.
- **Land ownership / Estate-held land layer** (raised 2026-08-13): Internal
  Politics' Rights checklist includes Land ownership for Nation×Estate
  actors, implying a new Economics-side land-allocation layer distinct from
  World Map's province-level terrain/resource data. Needs an owner (likely
  Economics) and a decision on whether it requires its own stock separate
  from Wealth, and how it interacts with province-level production
  ownership: **settled shape 2026-11-01** — a Land Right as a per-cell
  ownership share of a province's output, no stock separate from Wealth
  (`economics__kb.md`); also the prerequisite for landholding Estates'
  contribution (Fairness). Share bookkeeping settled 2026-11-02 (shares total at most 1, absentee holders allowed, Land split precedes Requisition).
- **Secret-Police-shaped directives** — **dissolved 2026-11-02** in `administration__kb.md` (pools blend; no bespoke institution rules).
- **Covert Faction Influence** (Diplomacy's Espionage writing into a
  foreign Actor cell's Opinion/Grievance fields) — targets now exist (the
  Actor-cell model is settled) but Diplomacy's own kb flags this as **not
  yet re-verified** against it — **settled 2026-11-01**: re-verified; targets
  include cell Preference modifier stacks (foreign propaganda), see
  `diplomacy__kb.md`.
- **`trade_infrastructure_level`** — **settled 2026-11-02**: per-province Economics stock, built by any permitted cell including the Government, decays without upkeep, no labour cap, no separate hysteresis (`economics__kb.md`).
- **2026-11-02 — settled**: causal-provenance alpha home = Decision Log (schema in Internal Politics, writes via Actions); Events is post-alpha.
