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
Questions carry a continuous Coordination overhead; unmet upkeep
degrades C/C/O proportionally with a player-set cut order and a leaderless
defection rule; Observation is also the detection condition for foreign
covert action. Faction Multiplicity, rival branches, three-pool templates and corruption-as-
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
section lives here, beside the slate, rather than in the 51 KB Internal Politics file.
**Confirmed 2026-11-21** (the queue proposals).

**2026-11-19/22 designer input**: being addressed freezes a Question's escalation only while it is discussed; what follows the end of a debate (resolved, diminished, or expired with a minor grievance); the Government can prolong debates (`extendDebates`, shape confirmed 2026-11-20); the order in which the slate's consumers are built is settled; **the scope of a Question (and with it the length and the assembly of its debate) is the scope of the faction that raised it (2026-11-22)**; Question handling is the next slice (see Status).

**2026-11-24 designer input**: Question handling (petition and Persuasion) and the Country's assembly for multi-Region and country-wide Questions are **confirmed**; early resolution of a debate is settled as a **decision rule** (any turn, two thirds of the voting Weight in favour, nothing gating it; Assembly Queue, Resolution by decision); a Right granted during a debate counts as a concession (the size measure is defined in `internal_politics__kb.md`, Entitlement loss). **2026-11-25: the decision object (the answer that is voted on) is confirmed** and built (`administration/decision.js`).

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

**Addressed Questions do not escalate while they are discussed (settled 2026-11-19, refined 2026-11-20)**: a Question is **addressed** while it is on the slate (attention) **and has a debating slot** or, for a routine Question, in standing administration. Being addressed **freezes the rise** of its faction escalation momentum (momentum still decays); a Question the Government does not address — including one on the slate that waits for a slot — keeps rising as above. **The freeze lasts only while the Question is being discussed**: the length of its debate (Assembly Queue below), plus any turns the Government prolongs it (Extending a debate, below). When the debate ends:
- **Resolved in a way the involved actors accept**: the Question stops being pressing on its own, because the trigger (`grievance > compliance`, Internal Politics) no longer holds; if the way it was resolved made the matter less important to them, it **diminishes**. Nothing special is stored.
- **Not solved in an accepted way** (an **expired debate**): the Question becomes a **pressing issue again**; tension and grievance build again under the usual mechanics, and the **estates that asked and were not satisfied take a minor, decaying grievance modifier** — a Fairness-type modifier on every cell of the **faction that raised the Question** (the cells of the Country holding a live Question on the same issue; size at the numbers pass), applied once when the debate ends. After that nothing is special: the usual escalation mechanics continue, and it is not addressed again until it has stopped being live (a Question that has stopped being live and later returns starts afresh).
The rule is read by Internal Politics' escalation momentum (`internal_politics__kb.md`, Faction escalation state); the slate and the debate are this module's.

### Assembly Queue and Question Resolution Time (2026-11-10)
The slate is the Government's **attention**; the assembly queue is **debating capacity**. A Question exists whenever its grievance trigger holds; it occupies a queue slot only while it is **debated** (Internal Politics, handling `ignored | consulted | debated`).
```
Assembly(scope ∈ Region | Empire)       // one per administrative Region; one per Country
queue_cap(assembly) = g(Coordination)   // derived, never stored: the maximum number of
                                        // simultaneously open (debated) Questions
```
- **Scope of a Question (designer 2026-11-22)**: the scope of the **faction that raised it** — the cells of the Country that hold a live Question on the same issue. All its cells in one Region: a **Region** Question, debated in that Region's assembly. Cells from several Regions: a **multi-Region** Question. Cells from more than half of the Country's Regions: a **country-wide** Question. Multi-Region and country-wide Questions are debated in the Country's (Empire) assembly (**confirmed 2026-11-24**).
- **Cap is derived from Coordination** (confirmed 2026-11-21): a Region assembly's cap follows the Coordination produced by pools staffed from that Region's cells; the Empire assembly's cap follows the Country's total Coordination output. More Coordination, more Questions debated at once; the shape of `g` is a numbers-pass item. At least one Question can always be debated.
- **Agenda control follows Council rights** (confirmed 2026-11-21). By default the **Government controls the whole agenda** (it opens every debated Question). Cells holding a **Council seat** or **Petition Right** claim a **share of the assembly's slots**, and the Government keeps the remainder:
```
agenda_share(holder) — Government by default 100%;
  a cell with a Council seat or Petition Right takes a share ∝ Weight × right strength;
  unclaimed share reverts to the Government
```
  Within a holder's share, waiting Questions are ordered by the existing `queue_priority` (severity, Weight, Petition multiplier). A holder opens the Questions raised by its own cell; the others are opened by the Government. When the queue is full a new Question **waits** for a slot in the share of the holder who would open it (and is not addressed meanwhile). Petition is therefore both a priority multiplier and an agenda share.
- **Resolution time** depends on the scope of the Question (above):
```
duration(Question) = 1 turn    scope: a single Region
                   = 3 turns   scope: several Regions, not more than half of the Country's
                   = 5 turns   scope: cells from more than half of the Country's Regions
```
- **Resolution by decision — Quickening (designer 2026-11-24; supersedes the sketch of 2026-11-10; the object confirmed 2026-11-25)**: a debated Question can be **decided on any turn of its debate**, without waiting for its duration, when (a) **at least two thirds of the voting Weight is in favour** — an absolute majority of all the voters of the assembly, not of those who happen to take part — and (b) **nothing gates it**: no covering Veto holder, no faction that stands to lose by the proposed new configuration of Rights and Duties, refuses it. A faction that opposes the proposal can therefore stop an early decision only through a Veto it holds; without a Veto it can be outvoted. Otherwise the debate runs its full duration (plus any extension), then resolves under the existing gating rules (Veto holders; forcing it through Control with its entitlement-loss cost; Internal Politics).
  **The decision object (confirmed 2026-11-25)** — what is voted on is an **answer** of the Government to the Question:
```
answer = Government event proposeAnswer {questionKey, act}
  act      = a registered Government act that answers the Question (in practice a reformRightsDuties bundle: the "new configuration of Rights and Duties");
             not Persuasion and not a debate-management act (persuade, extendDebates, ...); it must be valid when proposed and when the vote is taken
  stored   = polity.debate[key].proposal = {act, turn}; one per debate, replaceable while the debate is open
voters(assembly) = cells of the assembly with agenda strength (Council seat, Petition Right) or a covering Veto of the act's domain
support(h)       = approves(stance(h, act))        // the stance skeleton (self-interest × Preference alignment), using the act's impact on h
decided          = Σ Weight(h: support) ≥ T('decision.majority') × Σ Weight(voters)    // 2/3
                   and the ordinary gating verdict of the act's domain is not blocked
check            = every turn, at step 6, for every open debate that has a proposal (before the queue opens new debates, so a freed slot is used at once)
on decided       = the act is queued and executes as a Government action at the next step 2; the debate ends RESOLVED: no expiry modifier, the freeze ends,
                   its slot is freed, its extension (if any) stops costing; the Question stays live only while the ordinary compliance trigger holds
```
  With no voters (no Council seat, Petition or Veto in the assembly) the Government answers alone: nothing is voted on, and the act is adopted at once if nothing gates it. Question-time Persuasion is **not** an answer (it is applied at once, Internal Politics); a Right granted by any act the Government takes during a debate counts as a **concession** for every debate whose faction gains from it (Internal Politics, Question handling). A routine Question in standing administration has no assembly and no vote.
  **Spec decisions made while building it (proposed, awaiting OK)**: the adopted act is judged once more by the ordinary gate when it executes at step 2 (the state may have changed since the vote), so it can still be refused then; a debate whose proposal is no longer valid or is gated simply goes on to its natural end (the proposal stays until it ends or is replaced).
- **Extending a debate (designer input 2026-11-20, shape confirmed the same day)**: the Government can prolong the debate of a Question beyond its natural timespan with the action **`extendDebates`** (one commitment per extended Question), which holds **a share of the Country's produced Control and the same share of its Coordination**:
```
k = turns the debate has been prolonged beyond its natural duration   // 1 on the first extra turn, 2 on the next, ...
share(Question, k) = s0 × k²          // quadratic: the first extra turn is the cheapest
held(Country)      = min(1, Σ share over its extended Questions)      // produced Control and Coordination are both multiplied by (1 − held)
```
  While it is held the Question stays discussed, so it stays addressed (the freeze above continues). When it is lifted, or when the share can no longer be paid (held reaches 1), or the Question stops being live, or the debate is decided, the debate ends; an unresolved one counts as expired. `s0` is a numbers-pass value. The extension is per Question and Country-level in its cost, for Region and Empire debates alike; an extended debate keeps its queue slot.
- The Question holds its queue slot until resolved or expired; debating also spends slate attention (Internal Politics). The two limits are independent and both Coordination-derived.

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
- **Extend debates (2026-11-20)** — commitment: holds the same share of Control and Coordination, growing quadratically per turn of prolongation (Assembly Queue).
- Deliberately escalate an external Question to bump lower-tier internal ones off the active slate — event.

**Question-time (2026-11-22, confirmed 2026-11-24; the mechanic is Internal Politics', Compliance and Question handling)**
- **Persuade** — event, on a Question that is being discussed: pays from the Ledger and gives the faction that raised it a decaying positive Opinion-toward-Government modifier; counts as a concession in the debate.
- **Propose an answer (2026-11-24, confirmed 2026-11-25)** — event, on a Question that is debated in an assembly: attaches the Government's answer (an act) to the debate for the holders to vote on (Assembly Queue, Resolution by decision).

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
5. Questions exist independent of the slate; unaddressed Questions' factions may escalate, while an addressed Question (on the slate with a debating slot, or routine and in standing administration) does not escalate only while it is discussed; a Question on the slate that waits for a slot is not addressed; after its debate it escalates again if still pressing (an unresolved debate also leaves a minor decaying grievance modifier on the cells of the faction that raised it), or fades if it was resolved acceptably (2026-11-19/22).
6. Requisition scope (cell/Estate/Nation/Region/Empire) is enforced via Control Allocation, additively and per covered cell.
7. The Government's propaganda is paid from the Coordination pool — it competes with the attention commitments above and other Coordination uses.
8. Observation governs visibility of off-slate escalation; routine-severity Questions are handled by standing administration at a continuous Coordination overhead scaling with their number.
9. Observation committed in a Region contributes additively with counter-intelligence Espionage to detection of foreign covert action there.
10. The default unit of an Allocation Dial is the cell; aggregate filters and groups are bulk shorthand expanding per covered cell, so total cost scales with the cells covered.
11. Surplus auto-fill of Control/Observation is free (no extra labour, Coordination or Wealth); surplus is split by ratio, floors by priority.
12. Each assembly (Region, Country) has a queue cap on simultaneously debated Questions, derived from Coordination — never a stored or fixed number, at least one (2026-11-10, confirmed 2026-11-21).
13. The Government controls the whole agenda by default; Council seat and Petition Right holders claim a share of the slots and open their own cell's Questions, and unclaimed share reverts to the Government (2026-11-10, confirmed 2026-11-21).
14. A debated Question runs 1 turn (the faction that raised it is in one Region), 3 turns (several Regions, not more than half of the Country's) or 5 turns (cells from more than half of the Country's Regions); it can be **decided on any turn** when two thirds of the voting Weight is in favour of the Government's proposed answer and nothing gates it (no refusing Veto holder); a decided debate ends resolved (no expiry modifier, freeze over, slot freed) (2026-11-10, scope by faction 2026-11-22, decision rule designer 2026-11-24, decision object confirmed 2026-11-25).
15. The assembly queue and the active slate are independent limits (debating capacity vs. Government attention), both derived from Coordination (2026-11-10).
16. The Government can prolong the debate of a Question beyond its natural timespan with `extendDebates`, holding the same share of Control and Coordination, `s0 × k²` per extended Question with k the turns of prolongation, summed and capped at 1 (2026-11-20, confirmed).
17. The scope of a Question is the scope of the faction that raised it (the cells of the Country with a live Question on the same issue): one Region, several Regions, or cells from more than half of the Country's Regions; multi-Region and country-wide Questions are debated in the Country's assembly (2026-11-22, assembly confirmed 2026-11-24).
18. `persuade` pays from the Ledger, gives the faction a decaying Opinion modifier and records a concession in the debate; it is not an answer to vote on (2026-11-22, confirmed 2026-11-24).

## Cross-references
- **Internal Politics** — owns all Actor-cell/Grievance/compliance/Prestige state; this module only produces (via Economics) and targets (via Control Allocation) the Control/Coordination/Observation that feeds `involuntary_compliance`. Defines Government upkeep, Requisition Duty and acting issue-scoped Factions (2026-11-01); this module executes (Control Allocation of Requisition scope; slate = Government attention). Question handling (`ignored | consulted | debated`), petition and Persuasion, the Council/Petition/Veto Rights and `queue_priority` are defined there; the Assembly Queue section above reads them (2026-11-10). **Escalation momentum** (the rise that an addressed Question does not get, the minor grievance modifier an expired debate leaves, the faction scope, 2026-11-19/22) is written in `internal_politics__kb.md` (Faction escalation state, Grouping / Faction computation, Question handling, Rules 38-40). The size measure of a Right as a concession is `entitlement_loss_size` (Entitlement loss, 2026-11-24).
- **Economics** — Administrative Capability Envelope production (`combined_envelope`) is defined there; this module consumes its output, per Country and, for the assemblies, per Region.
- **Countries** — the Government Triangle is retired (2026-11-01); Institutional↔Personalistic is now a derived readout, so neither scales lever effectiveness or C/C/O cost (those follow Rights/Control configuration directly).
- **World Map** — the administrative Region is the unit of a Region assembly (2026-11-10); the share of a Country's Regions that a faction spans fixes the scope of its Question (2026-11-22).
- **War** — Occupation's `martial law` Control cost and multi-origin-cell army stacking Coordination cost read this module's pools; War Exhaustion is now a derived readout of war-attributable grievance (Internal Politics), not a separate writeback; internal armed conflict (a faction's armed rung) is resolved by War.
- **Diplomacy** — border/customs-control policy is administered through this module's execution layer. Observation in a Region is the detection condition for covert influence there, contested against the sender's Espionage projection (2026-11-02).
- **Characters** — Faction-leadership replacement/reward dynamics deferred here (beyond alpha).
- **Actions** — class (dial/commitment/event) of each action above, and slate allocation as pipeline step 6, are defined in `actions__kb.md`; the adopted answer is run by the engine as a Government action at step 2 (`actions__kb.md`, Turn pipeline).

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
- **2026-11-10 — designer input (settled as answered)**: queue = number of simultaneously open Questions per Region and per Empire assembly; agenda controlled by Council rights (Government absolute by default, Council/Petition holders get a share); cap derived from Coordination; Question resolution time 1 / 3 / 5 turns by scope, quickened only by a majority with no strong veto, or by full consensus when a strong veto blocks (**the quickening rule superseded 2026-11-24**). The proposals of that day (the Coordination→cap mapping per assembly, the agenda-share formula with Petition carrying an agenda share, "strong veto" read as a covering Veto holder whose stance is against) were **confirmed 2026-11-21**. **Open**: whether existential Questions bypass the cap; `g(Coordination)` shape and the Weight × right-strength split (numbers pass).
- **2026-11-19 — designer input (settled as answered)**: an addressed Question (on the slate, or routine and in standing administration) freezes the rise of its escalation momentum; when the debate ends and the Question is still pressing, tension and grievance build again. **Consumer order of the slate (settled as proposed)**: (1) a readout of the slate; (2) the escalation freeze above in Internal Politics' momentum; (3) Question handling (petition handling, Persuasion) on addressed Questions; (4) the assembly queue (cap, agenda shares, duration); (5) Emergency Powers (it changes the Coordination the slate is paid from); (6) AI Governments last (near-zero focus in alpha).
- **2026-11-20 — designer input (settled as answered)**: the freeze length is the length of the discussion (the Question's resolution time once the queue exists); after the debate a Question either fades (resolved in a way the involved actors accept, or no longer important because of how it was resolved) or becomes a pressing issue again; an **expired debate** leaves a minor decaying grievance modifier on the estates that asked and were not satisfied, then the usual mechanics continue; the Government can **extend debates** (`extendDebates`: the same share of Control and Coordination, increasing quadratically each turn beyond the natural timespan).
- **2026-11-20 (later) — designer confirmed both proposals**: `share(k) = s0 × k²`, held per Question (summed per Country, capped at 1); "the estates that asked" = the cells of the faction that raised the Question (the cells of the Country with a live Question on the same issue). **Open**: the sizes of `s0` and of the expiry modifier (numbers pass); Fairness-type modifier is the working reading of "grievance modifier".
- **2026-11-21/22 — designer input (settled as answered)**: the queue proposals are confirmed; Question handling is the next slice; **whether a Question is of one Region, of several Regions or country-wide is decided by the scope of the faction that raised it** — cells in one Region; cells from several Regions; cells from more than 50% of the Country's Regions (Assembly Queue, Rules 14 and 17; the length and the assembly of a debate follow). The proposals of 2026-11-22 (multi-Region and country-wide Questions in the Country's assembly; the Empire assembly's cap from the Country's Coordination; the Persuade event) were **confirmed 2026-11-24** (below).
- **2026-11-24 — designer input (settled as answered)**: **confirmed** — the Petition and Persuasion shape (Internal Politics, Question handling and Compliance), the Country's assembly for multi-Region and country-wide Questions, and that a Right granted during a debate counts as a concession (the measure `entitlement_loss_size` is defined with it, Internal Politics, Entitlement loss); **decided** — a Question can be decided on any turn of its debate when two thirds of the voting Weight is in favour (an absolute majority) and nothing gates it, i.e. no Veto from the factions that oppose the proposed new configuration of Rights and Duties (Assembly Queue, Resolution by decision; Rules 14 and 18). **Open**: standing Persuasion; whether existential Questions bypass the cap; the size of `concession.rightK` (numbers pass).
- **2026-11-25 — designer confirmed (settled as answered)**: the decision object — the answer (`proposeAnswer {questionKey, act}`, one per debate, replaceable), who votes (cells with a Council seat, Petition Right or a covering Veto), support = the stance skeleton on the act's impact, the check at step 6, execution of the adopted act at the next step 2, `decision.majority` 2/3 — and the size shape of a Right as a concession (`concession.rightK` × the mean gain over the faction's cells, no subtraction of loss). Built the same day (`administration/decision.js`; tests written, not run). **Proposed while building (awaiting OK)**: the check runs before the queue opens new debates; the adopted act is gated once more at execution; a proposal that is invalid or gated stays until the debate's end; routine Questions in standing administration are not decided (no assembly). **Open**: standing Persuasion; the Government answering a Question that has no debate yet (alone, outside a debate: the ordinary gate).
- **Rev:** (tracked = every `###` under Data Structures; `Rules` as one section while it has no `###`; bootstrap 2026-11-12)
  - Data Structures > Control Allocation (settled; Allocation Dial semantics settled 2026-11-03) = 1
  - Data Structures > Observation Allocation (settled 2026-11-01; detection settled 2026-11-02) = 1
  - Data Structures > Question Active Slate (attention commitment — revised 2026-11-02) = 5
  - Data Structures > Assembly Queue and Question Resolution Time (2026-11-10) = 6
  - Data Structures > Government upkeep (execution side — settled 2026-11-02) = 1
  - Data Structures > Emergency Powers (settled 2026-11-02) = 1
  - Data Structures > Administration actions (execution layer; classes per `actions__kb.md`) = 5
  - Rules = 7
