# Administration — Knowledge Base

Status: **new file** — Control Allocation (moved from `internal_politics__kb.md`,
settled 2026-08-16) is this module's first properly-owned settled content.
Everything else below is the pre-Region Administration draft, reconciled
against Internal Politics' newer Actor-cell/compliance model where
possible; items that don't reconcile cleanly are flagged open rather than
asserted. Consult `internal_politics__doc.md` / the old `administration__doc.md`
only for rationale — both are superseded as ground truth by this file plus
`internal_politics__kb.md`.

**2026-11-01 overhaul pass**: the active slate is now the Government's
*attention* only (Questions exist independent of it); Requisition Duty
scope is enforced through Control Allocation; unmet Government upkeep
degrades C/C/O output; Faction spawn/despawn is dissolved into Internal
Politics' issue-scoped, derived Factions. See Status.

**2026-11-02 rules pass**: the active slate is now an attention commitment
(fixed Coordination threshold per severity tier, no slot formula); routine
Questions carry a continuous Coordination overhead; unmet upkeep degrades
C/C/O proportionally with a player-set cut order and a leaderless defection
rule; Observation is also the detection condition for foreign covert action.
Faction Multiplicity, rival branches, three-pool templates and corruption-as-
stock are dissolved (see Status). Emergency Powers' cost rule stays
settled. Numbers are deferred to the numbers pass.

**Layout note (2026-11-03)**: the former "Actions" and "Open Questions"
sections were folded into Data Structures ("Administration actions") and
Status respectively, to match the project's four-section kb convention.
Content is unchanged.

**2026-11-03 dial pass**: Control and Observation Allocation are now
**Allocation Dials** — per-entry floor + priority + surplus ratio (+ cap, sink).
The default unit is the cell; aggregate filters (Nation, Estate, Region, Empire,
(Nation, Region), (Estate, Region)) and player-named groups are bulk shorthand
that expand per covered cell, so total cost scales with the cells covered.
Surplus auto-fill is free. The standing spending priority is now a standing
dial with a reserve floor (Internal Politics / Actions).

**2026-11-10 designer input**: assembly queue (maximum simultaneously open debated
Questions per Region and per Country, derived from Coordination), agenda control by
Council/Petition Rights, and Question resolution time by scope (1 / 3 / 5 turns). The
section lives here, beside the slate, rather than in the 51 KB Internal Politics file;
its pointer in Internal Politics is still to be added when that file is split. Items
tagged **(proposed)** await the designer's OK.

## Data Structures

### Control Allocation (settled; Allocation Dial semantics settled 2026-11-03)
Targets Economics' Administrative Capability Envelope output to specific
Internal Politics Actor cells — distinct from envelope *production*
(Economics' concern). It is an **Allocation Dial** (`actions__kb.md`): each
entry takes what it needs by priority against a player-set **floor**, and
whatever is left over flows automatically by **surplus ratio**.
```
AllocationDial(Control) = { entries: [ { filter, floor, priority, surplus_weight, cap? } ], sink? }
filter  = cell (Nation, Estate, Region)                  // the default unit — works per cell
        | aggregate: (Nation, Region) | (Estate, Region) | Estate | Nation | Region | Empire
                                                         // shared scope syntax (Internal Politics)
        | group: a player-named explicit list of cells   // allocation-local; union of its cells
// An aggregate or group filter is bulk shorthand: it expands to one per-cell entry for
// every covered cell, each carrying the entry's floor, priority, weight and cap.

resolve(produced Control)     // derived each turn, pure; no new pipeline step
  pass 1  per-cell entries in priority order: grant min(floor, remaining);
          a shortfall truncates the LOWEST priority first (pro rata across the cells of one entry)
  pass 2  remaining -> per-cell entries with surplus_weight > 0, pro rata to weight,
          respecting cap; overflow from capped entries redistributes
  leftover -> sink if set, else idle ("unallocated")

involuntary_compliance(cell) = Σ [granted(entry) for every entry covering cell]   // additive stacking
```
- **Per cell by default.** A floor or weight is per covered cell; an aggregate
  filter's total cost is the per-cell amount × covered cells, so wide scope
  scales Control cost. Control and Requisition stack additively; Rights and
  Duties resolve to the most specific scope (shared scope syntax, Internal Politics).
- **Standing dial** — persists until changed and is re-resolved every turn from
  live produced output, so a change in production never needs a re-commit
  (unlike the underlying envelope production, a live per-turn zero-sum draw).
- **Floor** is the player's minimum ("no less than 100 Control" per cell); floor
  0 means the entry only receives surplus. **Surplus auto-fill is free**: no extra
  labour, Coordination or Wealth — the dial only targets output already produced.
  Surplus weights are per covered cell; the UI presents them as linked ratio
  sliders summing to 100%.
- **Priority** orders pass 1 only (floors); surplus is split by weight, not priority.
- Overlap stacks additively; to exempt a cell from an aggregate, split the
  aggregate into groups (there is no override, only addition).
- **Reallocation is free** — no Wealth/Grievance/Prestige cost; the only
  consequence is the resulting shift in `involuntary_compliance`.
- **Requisition scope** — an Internal Politics Requisition Duty scoped to an
  Estate, Nation or the Empire is a bulk filter across every covered cell;
  enforcement stacks additively like any other filter, per covered cell, so
  wide scope scales Control cost.

### Observation Allocation (settled 2026-11-01; detection settled 2026-11-02)
Observation = the Government's **committed awareness** of a Region/cell,
allocated with the same Allocation Dial shape as Control Allocation (floors, priority, surplus ratios, per-cell default, aggregate and group filters). Off-slate
escalation is visible where Observation is committed. Committed Observation
in a Region is also one of two additive contributors to **detection of foreign
covert action there**, alongside counter-intelligence Espionage (two ways of
noticing: official observation vs. counterintelligence). Tiers, sender
attribution and false flags: `diplomacy__kb.md`.

### Question Active Slate (attention commitment — revised 2026-11-02)
```
Question.severity ∈ { existential, structural, routine }   // roughly:
  war/famine/plague > estate privileges/succession > minor policy
handling(Question) requires committed Coordination ≥ threshold(severity tier)
```
The slate is the **Government's attention**, not the set of live Questions.
Questions exist whenever `grievance_bucket_severity > compliance`
(Internal Politics). Handling one requires committing a **fixed Coordination
threshold per severity tier** — the same fixed-threshold shape as
Diplomacy/Espionage actions (breadth, not depth: more Coordination than the
threshold buys nothing extra). The number of Questions handled at once
**emerges** from available Coordination; there is no slot-count formula.
Existential Questions can crowd lower tiers out of attention entirely — but
never out of existence. Off-slate Questions keep accumulating and their
factions may escalate on their own (Internal Politics, Faction escalation
state). This is the module's core pacing mechanism, and makes "escalate an
external Question to bump weaker internal ones" a legible but risky tool:
neglected factions act. Observation (above) governs visibility of off-slate
escalation.

**Routine tier (settled 2026-11-02)**: routine-severity Questions are handled
by standing administration without a slate commitment, at a continuous
Coordination overhead that scales with the number of live routine Questions.
If Coordination runs short, routine Questions drop out of standing
administration and become unaddressed (their factions may then escalate).

### Assembly Queue and Question Resolution Time (2026-11-10)
The slate is the Government's **attention**; the assembly queue is **debating capacity**. A Question exists whenever its grievance trigger holds; it occupies a queue slot only while it is **debated** (Internal Politics, handling `ignored | consulted | debated`).
```
Assembly(scope ∈ Region | Empire)       // one per administrative Region; one per Country
queue_cap(assembly) = g(Coordination)   // derived, never stored: the maximum number of
                                        // simultaneously open (debated) Questions
```
- **Cap is derived from Coordination** **(proposed mapping)**: a Region assembly's cap follows the Coordination produced by pools staffed from that Region's cells; the Empire assembly's cap follows the Country's total Coordination output. More Coordination, more Questions debated at once; the shape of `g` is a numbers-pass item.
- **Agenda control follows Council rights.** By default the **Government controls the whole agenda** (it opens every debated Question). Cells holding a **Council seat** or **Petition Right** claim a **share of the assembly's slots**, and the Government keeps the remainder:
```
agenda_share(holder) — Government by default 100%;
  a cell with a Council seat or Petition Right takes a share ∝ Weight × right strength;
  unclaimed share reverts to the Government
```
  Within a holder's share, waiting Questions are ordered by the existing `queue_priority` (severity, Weight, Petition multiplier). When the queue is full a new Question waits for a slot in the share of the holder who would open it. **(proposed)** This extends Petition from a priority multiplier alone to also carrying an agenda share; the multiplier stays as the ordering rule within a share.
- **Resolution time** depends on the Question's scope:
```
duration(Question) = 1 turn    scope: a single Region
                   = 3 turns   scope: touches more than one Region but not the whole Country
                   = 5 turns   scope: a decision of the entire Country (Empire)
```
- **Quickening** — a debate may resolve before its duration only when (a) a **majority is in favour** and no strong veto blocks it, or (b) a **strong veto** (a covering Veto holder whose stance is against) blocks it, in which case only **full consensus** (every covering holder in favour) resolves it early. Otherwise it runs its full duration, then resolves under the existing gating rules (Veto holders, forcing it through Control with its entitlement-loss cost; Internal Politics). Majority and stance use the Weight-weighted stance estimate (self-interest × Preference alignment).
- The Question holds its queue slot until resolved; debating also spends slate attention (Internal Politics). The two limits are independent and both Coordination-derived.

### Government upkeep (execution side — settled 2026-11-02)
The Government's material needs (defined in `internal_politics__kb.md`) are
met by Requisition or market purchase with Ledger Wealth. Unmet upkeep
degrades each affected pool's Control/Coordination/Observation output **in
proportion to the unmet fraction**; the **cut order** is the player/AI's standing spending priority (an Allocation Dial with a reserve floor, re-resolved every turn; Internal Politics, Government and Ledger). It
spawns no Questions. Degraded Control lowers `involuntary_compliance`
(promoted from proposed 2026-11-02). Degradation curve shape beyond
proportional: numbers pass.

**Defection without Characters (leaderless, alpha)**: a pool whose upkeep is
deeply unmet returns its labour to its origin cells (the dual-claim reverses:
that labour goes back to production). Optionally, where a cell's faction is
already at the armed rung and the cell holds the Retinue Right, that labour
may contribute to the rebels (War resolves). Characters-driven coups are
post-alpha.

### Emergency Powers (settled 2026-11-02)
Standing commitment: temporary Control boost at Coordination/Observation expense. Its legitimacy cost is **derived each turn from current circumstances — never from duration**:
```
cost(turn) = magnitude(Control boost) × (1 − acceptance)
acceptance = the entitlement-loss acceptance function (Internal Politics):
             live crisis severity read from current Question state, the faction's
             own exposure, burden share, visible alternatives
```
The cost lands as the usual decaying Opinion/Fairness modifier. When crisis severity falls, the same powers become costly automatically; in a spike they cost almost nothing. The only time-dependence is the decay of modifiers already applied — no term counts how long a crisis or the powers have lasted.

### Administration actions (execution layer; classes per `actions__kb.md`)
**Standing / proactive**
- Set/adjust Control and Observation Allocation Dials: per-cell entries, aggregate/group entries, floors, priority, surplus ratios, caps, sink. Free (dial).
- Declare emergency powers (temporary Control↑, Coordination/Observation↓, standing legitimacy cost) — commitment.
- Deliberately escalate an external Question to bump lower-tier internal ones off the active slate — event.

**Structural** (via Internal Politics' own action list — Administration is the execution layer)
- Intervene in Economics' planning posture (centrally-planned ↔ decentralized), a standing dial.
- Set border-control/customs-control policy (adjacent to Diplomacy/External Economics).
- Place or lift a Requisition Duty at any scope (the Duty itself is Internal Politics' Rights/Duties config; enforcement via Control Allocation).

**Informational**
- Commission a general audit (region/cell-targeted) or investigate a specific rumor — both consume Observation, surface hidden Grievance/compliance state.

## Rules
1. Control Allocation is an Allocation Dial: per-cell floors by priority, surplus by ratio; entries stack additively across overlapping filters; a shortfall truncates the lowest priority.
2. Reallocating Control carries no direct cost — only the resulting compliance-exposure shift.
3. Handling a Question requires a fixed Coordination threshold per severity tier; existential Questions can displace lower tiers from the Government's attention — never from existence (Rule 5).
4. Unmet Government upkeep degrades C/C/O output proportionally (cut order set by the player's standing spending priority), never spawns Questions; a deeply unmet pool's labour returns to its origin cells (leaderless defection).
5. Questions exist independent of the slate; off-slate factions may escalate.
6. Requisition scope (cell/Estate/Nation/Region/Empire) is enforced via Control Allocation, additively and per covered cell.
7. The Government's propaganda is paid from the Coordination pool — it competes with the attention commitments above and other Coordination uses.
8. Observation governs visibility of off-slate escalation; routine-severity Questions are handled by standing administration at a continuous Coordination overhead scaling with their number.
9. Observation committed in a Region contributes additively with counter-intelligence Espionage to detection of foreign covert action there.
10. The default unit of an Allocation Dial is the cell; aggregate filters and groups are bulk shorthand expanding per covered cell, so total cost scales with the cells covered.
11. Surplus auto-fill of Control/Observation is free (no extra labour, Coordination or Wealth); surplus is split by ratio, floors by priority.
12. Each assembly (Region, Country) has a queue cap on simultaneously debated Questions, derived from Coordination — never a stored or fixed number (2026-11-10).
13. The Government controls the whole agenda by default; Council seat and Petition Right holders claim a share of the slots, and unclaimed share reverts to the Government (2026-11-10, proposed).
14. A debated Question runs 1 turn (one Region), 3 turns (several Regions, not the whole Country) or 5 turns (Country-wide); it resolves early only on a majority in favour with no strong veto, or on full consensus when a strong veto blocks it (2026-11-10).
15. The assembly queue and the active slate are independent limits (debating capacity vs. Government attention), both derived from Coordination (2026-11-10).

## Cross-references
- **Internal Politics** — owns all Actor-cell/Grievance/compliance/Prestige state; this module only produces (via Economics) and targets (via Control Allocation) the Control/Coordination/Observation that feeds `involuntary_compliance`. Defines Government upkeep, Requisition Duty and acting issue-scoped Factions (2026-11-01); this module executes (Control Allocation of Requisition scope; slate = Government attention). Question handling (`ignored | consulted | debated`), the Council/Petition/Veto Rights and `queue_priority` are defined there; the Assembly Queue section above reads them (2026-11-10).
- **Economics** — Administrative Capability Envelope production (`combined_envelope`) is defined there; this module consumes its output.
- **Countries** — the Government Triangle is retired (2026-11-01); Institutional↔Personalistic is now a derived readout, so neither scales lever effectiveness or C/C/O cost (those follow Rights/Control configuration directly).
- **World Map** — the administrative Region is the unit of a Region assembly (2026-11-10).
- **War** — Occupation's `martial law` Control cost and multi-origin-cell army stacking Coordination cost read this module's pools; War Exhaustion is now a derived readout of war-attributable grievance (Internal Politics), not a separate writeback; internal armed conflict (a faction's armed rung) is resolved by War.
- **Diplomacy** — border/customs-control policy is administered through this module's execution layer. Observation in a Region is the detection condition for covert influence there, contested against the sender's Espionage projection (2026-11-02).
- **Characters** — Faction-leadership replacement/reward dynamics deferred here (beyond alpha).
- **Actions** — class (dial/commitment/event) of each action above, and slate allocation as pipeline step 6, are defined in `actions__kb.md`.

## Status
- Control Allocation: **settled**.
- Question Active Slate: **settled** as an attention commitment (fixed Coordination threshold per severity tier; no slot formula needed, 2026-11-02).
- Emergency Powers: **settled** (cost derived from the acceptance function, 2026-11-02).
- **2026-11-01 — settled**: active slate = Government attention only; Questions independent of the slate; Requisition scope enforced via Control Allocation; unmet upkeep degrades C/C/O without Questions; Faction spawn/despawn dissolved into Internal Politics' derived Factions.
- **2026-11-01 (later) — settled**: Government propaganda draws on the Coordination pool. **Open**: its Coordination cost curve (numbers pass).
- **2026-11-02 — settled**: attention-threshold slate (no slot formula); routine-tier Coordination overhead; proportional upkeep degradation with player-set cut order; Control→compliance weakening; leaderless defection; Observation as detection.
- **2026-11-02 (later) — settled**: Emergency Powers cost derived each turn as magnitude × (1 − acceptance), no duration term; detection = Observation + counter-intelligence Espionage (additive).
- **Dissolved or moved (2026-11-02)**:
  - Faction spawn/despawn — dissolved 2026-11-01: Factions are issue-scoped, derived and never spawned (Internal Politics).
  - Faction Multiplicity, coup-proofing, rival-branch dynamics — emergent: pools are staffed from cells' own labour and C/C/O is already a blend of pools, so diversifying across pools and cells gives resilience without a separate mechanic.
  - Three-pool default templates — moved to Economics' numbers pass (worldgen coefficients); not a persisted institution.
  - Corruption as unobserved gap — dropped (flavour; would be a new stock).
  - New Estate-like category mid-game — post-alpha (alpha fixes four Estates; Internal Politics).
- **Open**: numeric thresholds, overheads and degradation curve beyond proportional — numbers pass.
- **2026-11-03 (dial pass) — settled**: Control and Observation Allocation are Allocation Dials (floor + priority + surplus ratio, optional cap and sink); per-cell default with aggregate filters and player-named groups as bulk shorthand; surplus auto-fill is free; priority orders floors only; standing spending priority replaces the per-turn re-chosen order. **Open**: a "total-split" mode for aggregate filters (a fixed total divided across covered cells) is not adopted — per-cell only; shortfall inside one entry is pro rata across its cells (numbers pass may refine).
- **2026-11-03 — mechanical**: Control Allocation filters use the shared scope syntax (cell / Estate / Nation / Region / Empire), matching Requisition scope enforcement.
- **2026-11-10 — designer input (settled as answered)**: queue = number of simultaneously open Questions per Region and per Empire assembly; agenda controlled by Council rights (Government absolute by default, Council/Petition holders get a share); cap derived from Coordination; Question resolution time 1 / 3 / 5 turns by scope (Region / more than one Region but not the whole Country / Country), quickened only by a majority with no strong veto, or by full consensus when a strong veto blocks. **Proposed (awaiting OK)**: the Coordination→cap mapping per assembly, the agenda-share formula (and Petition gaining an agenda share), and "strong veto" read as a covering Veto holder whose stance is against. **Open**: whether existential Questions bypass the cap; `g(Coordination)` shape and the Weight × right-strength split (numbers pass); the pointer line in `internal_politics__kb.md` (pending that file's split).
- **Rev:** (tracked = every `###` under Data Structures; `Rules` as one section while it has no `###`; bootstrap 2026-11-12)
  - Data Structures > Control Allocation (settled; Allocation Dial semantics settled 2026-11-03) = 1
  - Data Structures > Observation Allocation (settled 2026-11-01; detection settled 2026-11-02) = 1
  - Data Structures > Question Active Slate (attention commitment — revised 2026-11-02) = 1
  - Data Structures > Assembly Queue and Question Resolution Time (2026-11-10) = 1
  - Data Structures > Government upkeep (execution side — settled 2026-11-02) = 1
  - Data Structures > Emergency Powers (settled 2026-11-02) = 1
  - Data Structures > Administration actions (execution layer; classes per `actions__kb.md`) = 1
  - Rules = 1
