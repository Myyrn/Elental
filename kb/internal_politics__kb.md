# Internal Politics — Knowledge Base

Status: Actor model, Rights/Duties, Prestige/Wealth, Estate Labor Profile,
Estate Convergence/Mobility/Demotion Duty, compliance model, and
Government Portrait settled. **Control Allocation moved to
`administration__kb.md`** (this session) — Administration owns targeting
of Control output; IP owns the Actor-cell state it's targeted at. The
former embedded "outdated Administration" draft (Faction-as-spawned-actor,
Loyalty, three-pool templates) is removed from this file — see
`administration__kb.md` for its reconciled remnant and open items.
Occupation's IP-side consequences are recorded once, in `war__kb.md`
(War-triggered state) — not duplicated here. **Government Ledger**
settled 2026-11-02 and merged with the Government section (see "Government and Ledger" below).

**2026-11-01 overhaul pass** (core-mechanics reformulation around cell
needs, contribution vs. entitlement, a resource-holding Government, and
active issue-scoped Factions): Fairness bucket + entitlement-loss modifier;
Awareness + attributed discontent; Government as resource-holder with
material needs only; acting Factions; per-cell Preference vector over the
Portrait axes with pool-gated propaganda; Requisition Duty; Questions
independent of Administration's active slate; Portrait split into
AI-behaviour driver / player-observed record. Items tagged **(proposed)**
were put forward in-session and not yet confirmed; untagged additions were
confirmed by the designer. See Status.

**2026-11-09 designer input**: Region is now the stored administrative Region (World Map); laws are set per Region; the scope ladder (with a Precedence flag) fixes Rights/Duties precedence; Estate/Empire scopes exist only when technology enables them; Question handling gains consultation and petition. Items tagged **(proposed)** await the designer's OK.

**Resolution note**: Actor resolution is `(Nation, Estate, Region)`, not
per-Country. Estate Convergence/Mobility/Demotion Duty are written below
(Region-level rules settled 2026-11-02 — see "Scope syntax and Region-level
Convergence/Mobility/Demotion" below).

## Data Structures

### Actor (base unit)
`Actor = (Nation, Estate, Region)`. Region is the **administrative Region** owned by World Map (a stored, player-reorganizable partition of a Country's provinces; see `world_map__kb.md`, updated 2026-11-09); no coarser or finer actor key
exists — province is never an IP key directly. Laws are therefore set per Region rather than by Nation/Estate alone.

**Constraint**: `Σ Estate.population(Nation_i, Region_j) = Estate.total_population`
and `Σ Nation.population(Estate_i, Region_j) = Nation.total_population_in_region`.

**Region fracture/merger/reorganization**: on partial Region conquest or a player Reorganization Event (World Map), an Actor cell's
stocks split proportionally by population share (Nations' data), each
fragment re-entering the new Region partition. Merger reverses. A moved cell's effective Rights/Duties are re-resolved under the new Region's laws; any worsening is an **entitlement loss** (existing decaying Fairness modifier).

**Reorganization gating (2026-11-09, proposed: "empire-wide question" read as Country-wide gating)**: a Region reorganization is an Event Draft. Gating consults **every Veto/Council holder (domain: administration) in the whole Country** — it is an empire-wide decision — then the affected cells' stance is self-interest × Preference alignment. If refused, forcing it through Control costs entitlement loss; cells strong enough take the existing escalation ladder (grievance → momentum → rung → armed revolt, War). **Rebellion is not a new mechanic.**

**Attributes per Actor cell:**
| Attribute | Type | Notes |
|---|---|---|
| Population | scalar | headcount |
| Weight | derived | `Population × Prestige` |
| Prestige | derived/turn | structural baseline (Rights/Duties balance) + decaying modifier stack |
| Grievance buckets | 8 psych + material + Fairness, per-need | leaky accumulator; existential fast-accumulate/slow-decay, secondary slow-accumulate/fast-decay |
| Opinion | scalar, signed, per (this Estate, other Nation) | decays toward 0 |
| Opinion-toward-Government | scalar, signed | separate channel; carries Estate Mobility/Demotion reactions; also the stock underlying `voluntary_compliance`; also receives attributed discontent and preference-alignment effects (below) |
| Preference vector | per Portrait axis: baseline + decaying modifier stack, ∈ [-1,+1] | see Cell Preferences & Propaganda |
| Awareness | derived | see Awareness and attributed discontent |
| Foreign Standing | scalar, per (this cell, foreign Country) | derived: the cell's Nation's Sympathy toward that Country + cell-specific terms (the Estate's own treatment, trade interest, propaganda, Preference alignment to that Country's observed Portrait); nothing aggregates back into Sympathy |
| Wealth | real stock; debt exists only as identified obligation records (Economics, Credit) | see Wealth Flow |
| Skilled Labor distribution | vector, per Economics pool | actual trained split; drifts toward Estate Labor Profile via Teaching |
| Rights checklist / Duties checklist | universal shape, per-cell configured | see below |
| Character-leader | optional | present when a fractured sub-faction acquires a leader |

### Government and Ledger (resource-holder, not a will — settled 2026-11-02)
```
Government = { Ledger Wealth: real stock, never negative,
               Control/Coordination/Observation pools (Administration) }
```
- **Not an Actor**: no `(Nation, Estate, Region)` key, no will, no Grievance/Opinion/Prestige of its own. Agency belongs to the Country's player or AI; the Government has material needs only.
- **The Ledger is only what the Government actually has.** It cannot spend beyond its balance. The sole way to spend more is **Borrowing** (an Event, see `actions__kb.md`), which adds to the balance and creates a repayment obligation to the lender(s).
- **Inflows**: Taxation (per active tax law), Government-owned enterprises (if/where configured), State tariffs (Economics), minting (State-only unless granted as a Right; price-level consequence, Economics), war indemnities (Peace Conference), Borrowing (obligation-creating).
- **Material needs (mandatory outflow)**: upkeep of the pools behind C/C/O — wages/rations for committed labour, army supply, maintenance. Acquired by Requisition (in-kind) or ordinary market purchase with Ledger Wealth (tariffs, throughput, prices).
- **Discretionary outflow**:
  - **Direct intervention**: spend Ledger Wealth unilaterally on a single cell/Region (gift, subsidy) — fast, targeted, bypasses broad-based economic participation.
  - **Restructuring**: route Ledger Wealth through a policy engaging several/all Estates' participation (e.g. funding a Profile shift's Incentive channel across a Nation) — slower, compounds into a stronger aggregate economy.
  - **Debt forgiveness**: void the obligation records a cell owes (Wealth never goes negative) without the Ledger paying anything out; cost is Opinion/Grievance from the creditor-side Estate(s), not Ledger Wealth.
- **Spending priority** is a standing **Allocation Dial** (Actions) over the combined list of upkeep items and discretionary actions, re-resolved every turn against the live balance; the player/AI may change it at any time. Upkeep items take floors by priority; discretionary actions (direct intervention, restructuring) take floors and an optional surplus share **only from balance above the reserve floor** (a player-set minimum balance; mandatory upkeep may dip into it). Unspent balance is kept by default. A shortfall truncates the lowest priority. The reserve is unspent Wealth the cells can see, so it feeds the acceptance function's `visible_alternatives`.
- **Unmet upkeep** degrades the affected pools' C/C/O output in proportion to the unmet fraction (Administration executes); it never spawns Questions. A repressive pool whose upkeep goes unmet follows Administration's leaderless defection rule.
- **Labour**: not a separate stock — labour owed (Levy, Corvée, Skilled-labour Duty, Requisition) or bought (see make-vs-buy).
- **Scope rule**: an action draws on the Ledger only when it does **not** draw on another Actor's resources; anything that spends or redirects another Actor's Wealth/Skilled Labor/goods is an ordinary Control/Duty/Rights interaction already covered by existing mechanics.
- **No hardcoded institution (Economics Rule 3)**: the Ledger is a stock/rulebook entry, not a persisted Actor with behaviour of its own.
- **Lenders** are any cells permitted to lend (Rights checklist: Lending, default permitted), including cells in other trade zones within the credit range (Economics, Credit); the Government borrows from them like any debtor. Default or repudiation is an Event whose cost is creditor Opinion/Grievance through the normal Wealth Flow channels. Interest is derived per trade zone with an optional legal ceiling (Economics, Credit).
- Open (numbers pass): tax-law → inflow formula, enterprise shape, spend costs, Direct-vs-Restructuring payoff curve.

### Government values and Government-to-Government standing (settled 2026-11-03)
```
amalgam(axis)  = Σ_cells [ representation_weight(cell) × effective_pref(cell, axis) ] / Σ representation_weight
representation_weight(cell) = Weight (Population × Prestige) by default → the most powerful cells dominate
```
Derived, never stored. It is the value source of an **AI-run** Government (replacing the worldgen-assigned Portrait baseline; the
reinforcement modifier stack stays). For a **player-run** Government it is only a readout of whose wishes the action record currently serves —
the player's actions are the values. It is not a second will: agency stays with the player/AI. Cells far from the amalgam dislike the
Government through the existing alignment channel, so elite-serving rule has an emergent cost.
**Government-to-Government Foreign Standing** = Weight-aggregate of the powerful cells' Foreign Standing toward the other Country + alignment
between this Government's amalgam and the other's observed Portrait. This is `RelationState.opinion` (Countries). It is distinct from
Reputational Leverage (external belief about conduct, Diplomacy) and from Sympathy (Nation × Country).

### Estate Labor Profile (per (Nation, Estate, Region) cell)
```
LaborProfile = { pool: preference_weight } across Economics' 19 pools
```
Not shared across a Nation's cells of the same Estate, or across Regions.
A **target**, not actual distribution — pulls Teaching's direction, moves
at Teaching's normal slow rate. Two change channels:
1. **Structural reform** — Control-routed, immediate Grievance spike sized to shift magnitude.
2. **Incentive/inspiration** — Wealth/Persuasion-funded, gradual, low/no Grievance cost.

Example starting leans (configuration, not hardcoded type):
| Estate | Leans toward | Leans away |
|---|---|---|
| Nobility | Bureaucrats, Diplomacy, Cavalry/Shock Infantry | Agriculture, Mining, Woodcraft |
| Clergy | Bureaucrats, Diplomacy, Culture, Medicine, Teaching | heavy material extraction |
| Peasantry | Agriculture, Mining, Woodcraft, Builders | Bureaucrats, Diplomacy, Trade/Commerce |
| Citizens/Burghers | Crafting/Industry, Trade/Commerce | Agriculture, Mining, Woodcraft |

### Estate Convergence (structural, top-down; per (Nation, Region) cell pair — 2026-11-02)
```
Trigger: Rights AND Duties checklist distance → 0 between two same-Nation cells
Activation: ruler-declared (Control-gated) OR estate-forced (stalls into an
  ordinary Question, resolved via Outcome Asymmetry — no bespoke penalty)
Effect: cells merge; Labor Profile homogenizes to population-weighted blend
Reversible: yes, via later reform/drift
```
Seed mechanic for a possible future medieval→modern class-transition system
— out of Alpha scope, not designed further.

### Scope syntax and Region-level Convergence/Mobility/Demotion (settled 2026-11-02; ladder 2026-11-09)
- **Scope syntax and ladder**: Rights/Duties, Requisition and Control share one scope filter. Control and Requisition stack additively. Rights and Duties are states, so conflicts resolve by the **scope ladder**, narrowest first:
```
Cell (Nation,Estate,Region)  <  Nation  <  Regional-Estate (Estate,Region)  <  Region  <  Estate  <  Empire
```
  *Reading (proposed):* the **Nation** rung covers a Nation inside a Region and a Nation-wide declaration; **Estate** and **Empire** scopes exist **only when technology allows** them — in alpha (single tech era) the ruleset flag is off and laws are set per Region or finer. Two entries at the same rung: latest declared wins (supersedes the 2026-11-04 tie line "Region broader than Estate/Nation"). Silence is "allowed (default)", not a scope.
  Default precedence is **Autonomy** (narrower wins); the **Precedence flag** (Rights checklist) can reverse it per entry (Unitarism).
- **Convergence** is evaluated per (Nation, Region) cell pair; a Nation-wide declaration is the same act applied at wider scope. A merged cell carries a combined Estate label, preserving the population-sum constraint. Trigger unchanged: Rights **and** Duties checklist distance → 0. **Rarity must emerge, never be flagged**: closing the distance takes many gated, entitlement-loss-generating changes, so Convergence is a very unlikely outcome unless the player grinds centralization hard.
- **Estate Mobility** moves population between Estate-cells inside the same (Nation, Region). Movement between Regions is migration (World Map, Population dynamics). Movers carry their source cell's labour distribution and drift toward the target Profile via Teaching (the Profile stays a target only).
- **Demotion Duty** follows the same rule; the Prestige gap compares neighbouring cells in the same (Nation, Region).
- **Region split/merge** splits/sums all per-cell state by population share, including merged-cell flags and escalation state.
- **New Estate category mid-game**: post-alpha (alpha fixes four Estates).

### Existential vs. Secondary needs
Functional, not a fixed list: existential = sustained failure unlocks
state-changing action; secondary = accumulates Pressure only.
Identity/Autonomy and Solidarity are existential everywhere (every actor
carries a live Nation tag).

### Fairness bucket (contribution vs. entitlement — settled 2026-11-01)
A Grievance bucket in its own right. The old vocabulary (Identity/
Autonomy, Solidarity, Purpose/Meaning, Faith/Cosmology open) is retained;
"fairness/security/prestige/autonomy" were broad-picture synonyms, not a
new need list. Prestige stays a derived standing, not a need.
```
entitlement_share(cell)  = cell's share of Prestige-weighted standing
                           (Rights/Duties structural baseline)
contribution_share(cell) = cell's share of current value to the common
                           pool — derived, never stored (Economics supplies
                           the valuation)
gap(cell) = contribution_share − entitlement_share   // shares normalized
                                                     // across the Country
gap > 0 (under-rewarded) → Fairness grievance accumulates
```
Over-rewarded cells accumulate nothing from the gap; their stake shows as
resistance when a held entitlement is cut (next section). Standing thus
tracks objective contribution against legacy law: laws once fair turn into
misuse as contribution shifts. Shifts come from events (plague, war, trade
boom, migration; cataclysm is post-alpha) — alpha has a single tech era, no tech-driven
shift.
**Settled 2026-11-01**: Fairness is secondary by default (existential only
via the general functional rule — sustained failure unlocking state-changing
action; no per-cell special-casing). Non-market contribution = **need
satisfaction delivered**: military pools scale with live war Questions,
Culture/Clergy with the grievance their output relieves. The Government
Triangle is **retired** (2026-11-01), so it plays no role in gap tolerance — any tolerance emerges from
per-cell world-view baselines (Preference vector) set during numbers design.
**Open**: accumulation/decay rates (pacing pass).

```
psychological needs (8): Identity/Autonomy, Solidarity, Purpose/Meaning, Faith/Cosmology,
                         Security, Excellence, Superiority, Pleasure
+ material tiers (Subsistence, Comfort, Luxury) + Fairness (contribution vs. entitlement)
```
Open: which Portrait axes and which delivered non-material channels feed Security, Excellence, Superiority, Pleasure (spec default pairings are data in `ruleset.needs`: Security ← Ruthlessness↔Restraint & Conservatism; Excellence ← Extraction↔Investment & Reformism; Superiority ← Homogenizing↔Pluralist & Ruthlessness; Pleasure ← Luxury-tier satisfaction).


### Entitlement loss (decaying modifier on Fairness — settled shape)
Loss of a held entitlement (Right removed, Duty raised, Prestige baseline
cut) enters the Fairness bucket as a decaying modifier — not as part of the
static gap, and not as a fixed value from contribution/Prestige:
```
loss_modifier = entitlement_loss_size × (1 − acceptance)
acceptance    = f(crisis_severity, faction_exposure, burden_share,
                  visible_alternatives)                    // settled 2026-11-01
```
- crisis_severity — severity of the live existential Question the decision
  addresses (read from live Question state, never a stored global)
- faction_exposure — this faction's OWN exposure to that crisis
- burden_share — this cell's cost relative to others' sacrifice
- visible_alternatives — unspent Ledger Wealth / untouched cheaper levers
  the cell can see

Acceptance is judged from the faction's own exposure, never from Government
framing alone. A decision gravely unpopular in abundance is accepted almost
without resistance in disaster; the player may be forced to push an
unpopular decision onto a key faction and the faction understands it as the
lesser evil. Decay rate is read from the *current* crisis state (never from how long a
crisis has lasted): faster when the crisis is no longer live and the
entitlement is restored, slower while an emergency measure remains in force
without a live crisis (cf. Administration's Emergency Powers).

### Government benefits (settled shape 2026-11-01)
Two kinds: benefits that **alleviate pain** (relieve a Grievance bucket —
goods, Culture provision, a Right granted to close a Fairness gap) and
benefits that **give joy** (positive Opinion-toward-Government modifier —
favors, privileges, compensation after a loss). Granting a Right/entitlement
is also a benefit (raises entitlement_share). A benefit following a
requisition offsets its direct Opinion hit (see Requisition Duty). Payoff
curves and unit costs (incl. Direct-vs-Restructuring): numbers pass.

### Awareness and attributed discontent (settled shape 2026-11-01)
```
awareness(cell) = f(labour share in Teaching/Culture/Bureaucrats/Diplomacy/
                    Trade, Printed Goods consumption, urbanization_rate
                    (World Map), political Rights held: Council seat/
                    Petition/Veto)                // derived, never stored
attributed_discontent = harm × attributability(awareness,
                                  causal visibility of Government's role)
  → decaying modifier on Opinion-toward-Government
```
- Awareness gates **attribution, not suffering**: direct effects on needs
  hit every cell through the existing buckets regardless.
- Intent is never modeled — only causal provenance. Unintended blunders
  and engineered crises use the same path. A fabricated emergency works
  only while the Government's causal role is low-visibility; when obvious,
  it surfaces as an "incompetent government" modifier on
  Opinion-toward-Government.
- One decision can yield two separate effects: need/Fairness grievance
  (what the cell wants fixed) and an Opinion-toward-Government hit (how
  willing it is to comply). Both feed the Question trigger.
- War harm is attributed to the enemy by default; the Government is blamed
  only when its causal role is very obviously incompetent (steep: near zero
  until causal visibility is very high). Declaring war is a public causal
  action, so a diversionary war gets no special rally effect (no bespoke rule).
- Low-awareness cells may attribute harm to the nearest
  visible authority (a Local Jurisdiction holder) or Faith/fate instead of
  the Government.
- **Dependency**: needs event provenance (which crisis traces to which
  decision) — Events is beyond alpha, so the alpha mechanism is a decision log, with public
  (state-level) vs. covert (Espionage) causal action as the visibility
  proxy. Fog-of-war remains deferred.

### Decision Log (alpha causal-provenance mechanism — settled shape 2026-11-01)
```
entry = { actor, action_type, visibility: public | covert, turn, affected_cells }
```
Owned by Internal Politics (attribution reads it); every module writes
through the Actions write path (`actions__kb.md`). Events is beyond alpha, so this
is the alpha mechanism; attributability reads `visibility` and recency.

### Rights checklist (universal, per-cell configurable)
Council/Parliament seat · Veto (war/autonomy-titular/market/skilled-labour/
administration/retinue/treaty/tax-law, independently grantable) · Local Jurisdiction
(incl. estate-tariff levy) · Petition (Weight-multiplier in queue only,
not a bypass) · Land ownership (per-cell share of a province's output; Economics, settled 2026-11-02) · Armed retinue (scalar: maximum fraction of the cell's own armed pools that can serve as retinue; settled 2026-11-02) · Marriage/movement autonomy · Legal immunity ·
Skilled Labor permissions (bitmask) · Market access · Foreign trade
access · Minting (State-only default; fineness is a parameter of the Mint Event) · Lending (default permitted, forbiddable per scope) · Trade-infrastructure construction (default permitted, forbiddable per scope) · Settlement (default permitted, forbiddable per scope) · Internal/Foreign tariff rate ·
Tariff-exemption · Corvée (right) · **Estate Mobility** (scalar 0-100%) · **Precedence (Autonomy ↔ Unitarism)** (below)

**Precedence (Autonomy ↔ Unitarism) — 2026-11-09 (proposed shape)**: a flag attached to any other Right/Duty entry, declared at a scope. *Autonomy*: the narrower scope's entry wins over wider ones (the ladder as written — the default). *Unitarism*: the wider scope's entry wins over narrower ones. Local = cell, Nation, Estate; the scope at which the flag is declared is the level of autonomy it grants. Changing the flag changes effective Rights/Duties, so holders who lose from it register entitlement loss as usual.

### Estate Mobility (bottom-up, gradual, individual/family-scale)
```
Eligibility: Prestige(destination) − Prestige(origin) ≤ max_coverable_gap
  (Government-set, per Estate-pair per direction)
Scalar (0-100%, per-cell): fraction of eligible population converted/turn
Effect: origin Opinion-toward-Government↑; destination Opinion-toward-
  Government↓ ("upstart" resentment) — both target Government, not each other
Permanence: PERMANENT once executed; revoking the Right blocks further
  conversion only, doesn't revert
```

### Duties checklist (universal, per-cell configurable)
Taxation rate (market + Wealth-stock, independently) · Levy obligation ·
Skilled-labour duty · Requisition (in-kind goods or labour pool; see below) · Corvée (duty) · Hospitality/billeting · Loyalty oath
· **Demotion Duty** (scalar, net-position-triggered (Wealth + claims − obligations) downward demotion,
shares Prestige-gap derivation with Estate Mobility but is an independent
checklist entry; coercive, real Control gain for Government, heavy/
permanent-feeling Opinion cost)

### Wealth flow (per Actor, per turn)
```
Skilled Labor → resources → Country market (tariffs/restrictions/privileges)
  → sold → cell buys back unsatisfied necessities → remainder → Wealth stock
```
Minting State-only unless granted. Wealth tax and market tax independent,
both may apply. Blocked goods stock as unsold surplus (no forced purchase).
**No anonymous debts (2026-11-02)**: debt exists only as identified obligation records with a named creditor (Economics, Credit). The Wealth stock itself never goes negative (as with the Ledger; confirmed 2026-11-02); `net_position = Wealth + claims − obligations owed` is derived, and a negative net position is Demotion Duty's trigger.

### Prestige (derived, recomputed/turn)
```
Prestige(Actor) = structural_baseline(Rights/Duties balance) + decaying_modifier_stack
```
Two channels: structural reform (Control-routed) and Character-driven standing action (post-alpha; distinct from Persuasion, which moves Opinion) that moves the modifier stack directly.

### Duty compliance
```
actual_duty_delivered = claimed_duty × involuntary_compliance(cell)
```
`involuntary_compliance` is produced by Administration's Control
Allocation (see `administration__kb.md`) — no fixed "Bureaucrats/Army/
Secret Police trio." Gates Rights-restriction enforcement and all Duty
extraction identically.

### Skilled-labour Duty — make vs. buy
| Channel | Cost | Control | Effect |
|---|---|---|---|
| Conscript via Duty | cheap/free | consumes | none direct |
| Purchase on market | money | none | tariffs partially claw back as tax |

### Requisition Duty (settled 2026-11-01)
In-kind claim on a specific good or Skilled Labor pool.
```
scope ∈ (Nation, Estate, Region) cell | Estate | Nation | Region | Empire
        // coarser scopes = bulk shorthand across all covered cells
```
- **Enforcement**: via `involuntary_compliance` — Control commits additively
  per Control Allocation (`administration__kb.md`), so wide scope scales
  Control cost.
- Resolution: **pre-cascade** claim, ahead of the cell's
  Subsistence→Comfort→Luxury cascade; shortfall produces subsistence
  Grievance through normal channels. Taxation stays post-cascade.
- **Effects**: (a) the subject cell loses the goods for free (economic
  loss); (b) it bypasses the existing Prestige/market structure, disrupting
  structural ties — shortage propagates through the normal cascade and
  prices to the wider society, except where the good is abundant (no
  shortage, no propagation); (c) **two Opinion-toward-Government hits**: (i) a
  *direct* hit on every requisition, abundant goods included — perceived as
  theft; scaled by how essential the good is (subsistence above luxury),
  softened by crisis acceptance but never to zero; it can be offset by
  follow-up benefits (compensation, investment, privileges) that raise
  loyalty — this simulates "we shared in your time of need and expect reward
  later" without any debt stock; (ii) a *structural* hit through the
  alignment channel: requisition is an Extraction act, so Investment-leaning
  (free-capitalism) cells feel it as breaking their expectation of
  government investment, while Extraction-leaning cells comply more easily.
  Hit sizes: numbers pass.
- Absent a Requisition Duty the Government competes as an ordinary market
  buyer (Ledger Wealth, tariffs, throughput, prices). Planned-economy and
  exploitation play use this plus Administration's planning-posture dial;
  nothing is special-cased.

### Subinfeudation
Actor A holds Local Jurisdiction over B:
```
A provides Control to enforce B's Duty-compliance — free, no Opinion cost
A receives proportional share of B's Corvée/labour-duty output
```
A also collects estate-tariffs on trade-zone edges transiting its territory.

### Grouping / Faction computation (Question-time only, never persisted)
```
per (Estate, Question): default all-Nations-merge; fractures into
  Nation-specific sub-factions if Opinion(Estate, NationPair) crosses
  fracture_threshold on this Question's conflict axis
  sub-faction Weight = proportional split of parent Weight (+ external
  bonuses layered after)
per Nation, per Question: Estate-cells of that Nation with sufficiently
  aligned stance form a cross-Estate bloc (e.g. Vantirian Nobility +
  Peasants, Clergy excluded); the bloc counts as the FULL Nation only when
  every Estate-cell of the Nation (four at alpha) shares the same goal
```
A given Estate may be merged on one Question and fractured on another,
same turn. Estate Convergence changes the underlying cell set feeding this
computation, not the computation itself.

**Stance and agency (2026-11-01).** A faction's stance on a Question =
material self-interest × alignment of the cell's Preference vector with the
axes the issue loads on (same stance-times-modifier skeleton as
Administration/Diplomacy/War). Factions are **issue-scoped** — every issue
has its own faction set (nobles of two Nations may ally on serfdom and be
rivals on national autonomy) — and live as long as their Question lives
(`grievance > compliance`), independent of Administration's active slate.
Factions are **active**: while their Question stays unaddressed they
escalate on the existing ladder (petition → Duty-withholding → revolt/
secession-adjacent behavior → Estate-forced Convergence), the cells choosing the rung. Shape stays derived, never persisted.
**Bloc coordination (settled 2026-11-01)**: forming/maintaining a bloc costs
Coordination spent by the relevant Nation×Estate cells themselves, never by
the Government; cheaper for small concentrated groups, costlier for large
diffuse ones. A cell's Coordination capacity must be derived from existing
attributes: awareness inputs, Council/Petition Rights and organizing pools
(settled 2026-11-01; weights in the numbers pass). Faction attention: cells
allocate finite Coordination across live Questions by severity (a mirror of
the Government's active slate), so a bloc absorbed in a severe Question has
little left for a lesser one.
**Faction action set (settled 2026-11-01)**: petition; strike / Duty-withholding;
tax refusal; hoarding; armed retinue / revolt (handed off to War,
`war__kb.md`); appeal to a foreign kin-state
(CB-generating, `countries__kb.md` Rule 8); seek international recognition (any foreign
Country; the rebels' route when the goal is independence or the Government will not
meet requirements — `countries__kb.md`); counter-propaganda (pool-gated).
Availability (settled 2026-11-03): permitted-by-default (no law forbids; Government silence = allowed), granted (needs a Right), or defiance (no Right needed, effect scaled down by involuntary_compliance) — see `actions__kb.md`, Cell actions. A cell with no available action only accumulates grievance and migrates. Rung ordering: numbers pass.
**Settled 2026-11-02**: momentum/hysteresis so factions don't flicker
(see Faction escalation state below). **Open**: the alignment threshold that defines "sufficiently
aligned" for cross-Estate/cross-Nation blocs (partial coalitions settled
2026-11-01, replacing strict unanimity).

### Faction escalation state (settled 2026-11-02)
```
momentum(cell, need) = decaying accumulation of max(0, grievance − compliance)
rung(cell, need)     = banded function of momentum, with distinct enter/exit
                       thresholds (hysteresis)
```
- Cached and always re-derivable from event history; never spendable (cross-module caching principle). Carried per (cell, need), **not** on a faction — factions stay derived and unpersisted.
- **Asymmetric**: momentum rises fast, decays slowly.
- **Existential shocks can skip rungs** (existential buckets already accumulate fast).
- **Bloc**: acts at the Weight-aggregated momentum of its members; cells below the bloc's rung do not participate (partial participation, consistent with partial coalitions). Joining/leaving a bloc uses the same banded thresholds.
- **Attention**: finite Coordination affects rise, not decay — a bloc absorbed in a severe Question cannot climb on a lesser one, but its lesser momentum persists.
- **Repression does not erase grievance**: Control can lapse a Question while the grievance bucket persists; if Control weakens the faction re-climbs quickly. Momentum decays while the Question is lapsed.
- **Which action at a rung**: the cell chooses among the actions it is able to take, by self-interest.
- Thresholds, band widths, rung ordering, decay rates: numbers pass.

### Compliance (per Actor cell, per need)
```
compliance(cell, need) = voluntary_compliance(cell) + involuntary_compliance(cell)
voluntary_compliance(cell)   = f(Opinion-toward-Government(cell))
involuntary_compliance(cell) = Control allocated to cell (Administration)
```
**Persuasion** raises `voluntary_compliance` (Opinion-toward-Government's
modifier stack) — applied standing/proactive or Question-time. Never
touches `involuntary_compliance`.

### Pressure and Question queue
```
Pressure(Country) = Σ over actors [grievance_bucket_severity × Population × Weight]
Question generated per (actor/faction, need) once:
  grievance_bucket_severity(need) > compliance(cell, need)
queue_priority = f(severity [existential > secondary], Weight) × Petition_multiplier
unaddressed existential Questions escalate → drastic action (Duty-shirking,
  revolt eligibility, secession-adjacent behavior, Estate-forced Convergence)
```
"Covering" a Question means raising `compliance` back above the Grievance
bucket via Question-time Persuasion and/or Control reallocation.

Questions exist whenever the trigger holds, **independent of the
Administration active slate** (the slate is the Government's attention
only — `administration__kb.md`). Off-slate Questions keep accumulating and
their factions may escalate. Observation — the Government's committed awareness of a
Region/cell — governs visibility of off-slate escalation: it is visible
where Observation is committed (settled 2026-11-01).

**Minor issues and slipping acts past attention (2026-11-01).** Aside from
big debates the Government can fix minor (routine-severity) issues on its
own, without a slate slot or coalition debate (routine tier
handled by standing administration; cost open). Because bloc attention is
finite (Bloc coordination, above), a medium-importance act can pass while
the relevant blocs are absorbed in a more severe Question. Where
institutions are developed this is blocked by the Rights checklist: a
Council/Parliament seat or Veto covering the act's domain forces approval
regardless of attention. **Veto strength is not a separate parameter (settled 2026-11-02)**: it is defined by the cell's privileges — the Rights it holds (Veto domain, Council seat, Petition) together with its existing Weight/Control/Pressure state. Nobles holding a Veto can block; a cell with consultation-type rights only, or none (e.g. peasants in a strongly feudal state), can be almost freely ignored, the Government paying only the existing Outcome Asymmetry costs. "Developed institutions" is a Rights
configuration, not a Country type (derived; no new flag).

### Question handling — consultation and petition (2026-11-09, proposed: modifiers land on the Fairness bucket)
```
handling ∈ ignored | consulted | debated
petition      (cells holding the Petition Right): the Question carries a standing claim to be heard
  refuse to debate                                  -> large Fairness modifier, slow decay
  debate, then refuse without concessions of
  comparable weight                                  -> moderate Fairness modifier, decays
  concede comparable weight (benefit; a Right counts) -> no modifier
consultation  (cells WITHOUT Petition, but an existential need): Government-opened hearing;
  free of refusal penalty; ignoring costs only the existing Outcome Asymmetry
```
Debating spends the Government's slate attention (Administration). Both modifiers decay like entitlement loss and never become a stored currency. "Comparable weight" uses the same size measure as `entitlement_loss_size`. Sizes and decay: numbers pass.

### Government Portrait (Country-level root trait bundle)
```
Portrait(Country) = { axis: {baseline, modifier_stack} }, value ∈ [-1, +1]
```
Baseline: for AI-run Countries derived from the Government's amalgam (settled 2026-11-03); otherwise world-gen assigned; changes only on succession-type triggers
(exact list open, pending Characters). Modifier stack: decaying, fed by
REINFORCEMENT events (policy aligned to a pole + success → nudge toward
that pole; failure → nudge opposite), magnitude scaled by stakes (open).

| Axis | Pole A | Pole B |
|---|---|---|
| Extraction ↔ Investment | Duty-enforcement/Levy/Demotion default | Builders/Teaching/Incentive default |
| Homogenizing ↔ Pluralist | privilege-widening/suppression | accommodation/Rights-parity |
| Fervor ↔ Secular | Theurgy/Culture spend, religious-Veto assertiveness | low doctrinal weight |
| Ruthlessness ↔ Restraint | CB-overreach/Veto-break tolerance | conservative treaty compliance |
| Conservatism ↔ Reformism | status-quo default | reform/Convergence-seeking default |

Read (not written) by Administration by design — no automatic feedback
loop from sustained Control/Persuasion use (open to revisiting).

**Revision (2026-11-01):** AI-run Countries — the Portrait drives default
behaviour. Player-run Countries — the Portrait does not constrain; the
Country's action record (Rights/Duties configuration, requisitions,
repression, decisions) is derived and is what subjects see (gated by
awareness) and what other Countries see. The Portrait axes double as the
vocabulary for cell Preference vectors (below). Overlap with the regime
choice (accommodate ↔ exploit) is intentional: Extraction↔Investment and
Homogenizing↔Pluralist are positions on it.

### Cell Preferences & Propaganda (settled shape 2026-11-01; mechanics partly proposed)
```
pref(cell, axis) = { baseline, modifier_stack } ∈ [-1,+1]
  over the Government Portrait axes — same baseline + decaying-modifier
  shape as Prestige and Portrait. Baseline generated at worldgen, outside
  player control (generation rule settled: seeded from Estate profile + Nation
  traits plus noise; exact world-view values are set in the numbers pass).

Opinion-toward-Government driver:
  performance (needs met / compliance)
  + alignment = −distance(effective_pref(cell), observed_portrait(cell))
  observed_portrait(cell) = Country's action record filtered by awareness
```
Cells love the Government both when it does a good job and when it acts
according to their ideals.
- **Propaganda** = directing Culture / Printed Goods / Teaching pool output
  to push a target cell's preference (directed use of that output,
  zero-sum with its ordinary use). Non-Government actors (Church, nobles,
  factions, foreign powers) draw only on these pools; the Government's
  propaganda draws on Administration's Coordination pool instead (it
  competes with the active slate and other Coordination uses).
  Capability is **gated by those pools,
  not by a tech unlock** — a medieval Church can do it; later tech eras are
  intended to amplify it greatly (post-alpha, not designed). Preferences
  can be changed and even reversed.
- Propaganda is fast and writes the decaying modifier stack
  (needs sustained spend); Education via Teaching is slow and moves the
  baseline (durable). The message pushed is the producer's own ideal point;
  for the Government it is its current observed Portrait (justification).
  Church, nobles, factions and foreign powers each push their own
  positions → competing propaganda. Reversal needs a modifier range able to
  cross the baseline sign; cost ∝ distance moved.
- **Persuasion is separate**: moves Opinion directly (how much they like
  the Government now); propaganda moves preference (what they want from it).
- **Orientation ≠ awareness**: abundant printed goods raise capacity, not
  alignment — what is written decides. Orientation traces to the provenance
  of Culture/Teaching/Print production (which cell produced it, who funded
  or censored it) and lands in existing stocks (Preference vector, Opinion,
  Faith/Cosmology, Identity) — no free-floating "liberalism" value.
  Institutions that cultivate or censor are candidate Rights-checklist
  entries (open-ended per Rule 6).
**Settled**: the five Portrait axes are kept as the preference vocabulary
for alpha (revisit after the pacing pass; Ruthlessness↔Restraint is mostly
foreign-policy and Fervor↔Secular overlaps the open Faith/Cosmology bucket).
**Open**: resistance to propaganda (Faith/Identity, awareness).

## Rules
1. No derived value (Prestige, Weight, Pressure, faction shape, Opinion, Foreign Standing) is stored as a free number — always recomputable.
2. Faction/bloc shape is never persisted; recomputed at Question-time (factions are nonetheless active — Rule 21).
3. Existential/secondary status is a function of actor+need, not a fixed list (but resolves existential-everywhere for Identity/Autonomy/Solidarity).
4. Duty compliance scales with Control; never a unilateral actor choice.
5. Rights/Duties categories are universal; an Estate's identity is its checklist configuration + label, not a hardcoded type ("recostuming" is a legitimate reform).
6. Subsection categories (Veto, etc.) are open-ended.
7. Estate Labor Profile is a target only; actual distribution moves via Teaching at its normal slow rate.
8. Estate Labor Profile and Duties checklist are independent axes.
9. Changing Profile always costs something real (Grievance spike or sustained incentive spend) — never free.
10. Estate Labor Profile is per-cell, never shared across a Nation's same-Estate cells.
11. **Outcome Asymmetry**: ruler-initiated vs. actor-forced escalation must differ only via existing timing/Weight/Control/Pressure state — never a bespoke penalty/bonus.
12. Estate Mobility and Demotion Duty share the Prestige-gap derivation but are independent checklist entries: for Demotion, net position is the trigger and the Prestige gap decides the destination cell.
13. Government Portrait axes are root causal traits (feed policy defaults); outcomes feed back via the same decaying-modifier channel as Prestige/Sympathy — both directions must trace to real events.
14. A Question spawns per (actor, need) once Grievance severity exceeds `compliance(cell, need)`.
15. The Ledger is a stock, never negative, not an Actor — it has no will, spawns no Questions, and holds no Grievance/Opinion/Prestige of its own.
16. Debt forgiveness via the Ledger costs the creditor Estate(s) Opinion/Grievance, not Ledger Wealth — nothing is actually paid out.
17. An action only draws on the Ledger when it spends no other Actor's resources; any action touching another Actor's Wealth/Labor/goods is an ordinary Control/Duty/Rights interaction, not a Ledger action.
18. **Fairness** is a Grievance bucket fed by the derived gap `contribution_share − entitlement_share` (normalized shares, never stored).
19. Entitlement loss is a decaying modifier on Fairness; acceptance is judged from the faction's own exposure — Government framing alone never raises it.
20. Awareness is derived and gates attribution only; discontent follows causal provenance × awareness; intent is never modeled.
21. Factions are issue-scoped, derived, never persisted, and active (they escalate on their own); lifetime = their Question's.
22. Questions exist independent of Administration's active slate; the slate is the Government's attention only.
23. The Government has material needs only; unmet upkeep degrades C/C/O proportionally (cut order set by the player's standing spending priority) and never spawns Questions.
24. A Requisition Duty may be scoped to a cell, Estate, Nation, Region or Empire; absent it the Government competes under ordinary market rules. Requisition resolves pre-cascade.
25. Cell preference = baseline + decaying modifier over the Portrait axes; propaganda capability is pool-gated (Culture/Print/Teaching for Estates and other actors; Administration's Coordination for the Government); preferences can be reversed.
26. Portrait drives AI behaviour; for a player Country only the observable action record exists.
27. Bloc formation costs Coordination spent by the relevant Nation×Estate cells, never by the Government; cheaper for small concentrated groups.
28. Spending beyond the Ledger balance is possible only via Borrowing; spending priority is a standing dial re-resolved every turn, with a reserve floor protecting the balance from discretionary spending.
29. Faction escalation is cached momentum per (cell, need) with banded hysteresis — never stored on a faction; repression lapses the Question but does not erase grievance.
30. Rights/Duties, Requisition and Control share one scope filter; Control/Requisition stack additively, Rights/Duties resolve by the scope ladder (narrowest first; a Precedence flag may reverse it per entry).
31. Convergence, Mobility and Demotion resolve per (Nation, Region) cell pair; Convergence rarity must emerge from the cost of closing the Rights/Duties gap, never from a flag.
32. No anonymous debts: every debt is an obligation record with a named creditor; lending is a permission (default allowed), not an action.
33. Cells are actors; a faction is a derived grouping, never an actor (2026-11-03).
34. The Government is not a will: an AI Government's values are the amalgam of the most powerful cells' preferences; Government-to-Government standing is derived from the same weights.
35. Laws are set per administrative Region; the scope ladder fixes precedence; a Precedence flag may reverse it per entry (2026-11-09).
36. Estate-wide and Empire-wide laws exist only when technology enables them (2026-11-09).
37. Refusing a petition to be heard is penalized; refusing after a debate without comparable concessions is penalized less; consultation carries no refusal penalty (2026-11-09, proposed).

## Cross-references
- **World Map** — Region (administrative Region, stored partition, 2026-11-09) is the geographic-clustering source for Actor-cell resolution; fracture/merger/reorganization triggers proportional stock-split and sum (Rule above); Nations' population data is the divisor. `urbanization_rate` is an awareness input (2026-11-01).
- **Economics** — Skilled Labor pool/Duty vocabulary; Estate Labor Profile reads it as ground truth; land ownership is a per-cell Land Right (Economics, 2026-11-01); Local Jurisdiction enables estate-tariffs. Supplies the contribution valuation (Fairness), pre-cascade Requisition resolution, and the Culture/Print/Teaching pools propaganda draws on. Ledger inflows read Economics' Taxation, State tariffs and minting (2026-11-02).
- **Administration** — produces and targets Control/Coordination/Observation (Control Allocation lives there); gates Rights-enforcement and Duty-compliance. Active slate = Government attention only; Control Allocation enforces Requisition scope; unmet Government upkeep degrades C/C/O proportionally; leaderless defection rule (2026-11-02); debating a petitioned Question spends slate attention (2026-11-09).
- **Nations** — Nation tag on every actor; per-Country Sympathy feeds Foreign Standing; titular status survives dependency unless the culture/language axis is ceded. The Preference vector over Portrait axes is the first instance of the open political trait/mentality vocabulary; Reaction Temperament stays magnitude-only.
- **Countries** — "Empire"="Country"; the Government Triangle is retired (an analogy, not a game rule) and Institutional↔Personalistic is a derived readout, not an input. Supporting another Country's Nation secession bid is CB-generating (bridges to War's escalation pathway).
- **Diplomacy** — Foreign Standing is a direct input; Questions feed Diplomacy's execution layer. Foreign propaganda writes into cell Preference modifier stacks (Covert Faction Influence re-verified 2026-11-01); Observation vs. the sender's Espionage projection decides detection (2026-11-02).
- **Characters** — Character-driven standing actions (post-alpha) move Prestige's modifier stack; the alpha Persuasion Event moves Opinion; Character-leaders attach to fractured sub-factions (deferred); acting factions plausibly need leaders (beyond alpha).
- **War** — Occupation's Actor-cell consequences are recorded in `war__kb.md`, not here. Internal armed conflict (a faction's armed rung) is resolved by War.
- **Actions** — every executed action writes the Decision Log through the Actions write path (`actions__kb.md`); Borrow/Default Events and the spending Allocation Dial (reserve floor) live there.
- **UI** — Laws tab columns follow the scope ladder (Estate/Empire columns hidden unless the technology flag enables them); the Value control is generated from ruleset-declared choices (`ui__kb.md`, 2026-11-09).
- **Events** — causal provenance for attribution (beyond alpha; the Decision Log is the alpha mechanism).

## Status
- Actor model, Rights/Duties, Prestige/Weight, Wealth flow, Opinion (both channels), Foreign Standing, subinfeudation, grouping/fracture, Pressure/Question shape, Estate Labor Profile, Estate Convergence, Estate Mobility, Demotion Duty, Outcome Asymmetry, compliance model, Government Portrait: **settled**.
- Grievance-bucket accumulation/decay formulas, Opinion fracture-threshold values, exact Prestige weighting, Profile weight normalization, Estate Convergence/Mobility/Demotion numeric thresholds, Portrait reinforcement magnitude/decay functions, full event→axis mapping: **open, deferred pending pacing pass**.
- Land-ownership Economics integration: **settled** (per-cell ownership share, Economics 2026-11-02).
- Medieval→modern class-transition system: **flagged for post-Alpha**.
- Actor resolution at `(Nation, Estate, Region)`: **settled**; Estate Convergence/Mobility/Demotion Duty's multi-Region scope: **settled 2026-11-02** (see Scope syntax section).
- **Government and Ledger: settled 2026-11-02** (Ledger never negative, Borrowing the only way past balance, per-turn spending priority, inflow list). Tax-inflow formula, enterprise shape, spend costs, Direct-vs-Restructuring payoff curve: open (numbers pass).
- **2026-11-01 overhaul — settled**: Fairness bucket (contribution vs. entitlement), entitlement loss as decaying Fairness modifier (context-dependent acceptance from the faction's own exposure), Awareness + attributed discontent (existing attributes only; blunders trigger discontent), issue-scoped acting Factions, Questions independent of the active slate, Government as material-needs-only resource-holder, Requisition Duty scope and market fallback, Portrait = AI behaviour / player-observed record, per-cell Preference vector with pool-gated propaganda (reversible).
- **2026-11-01 — open**: bloc alignment threshold; faction action set + hysteresis; minor-issue handling cost; Fairness accumulation/decay rates (pacing); Requisition hit sizes and faction rung ordering (numbers pass); initial Estate world-view values (numbers pass); causal provenance (Events is beyond alpha; decision-log proxy in alpha).
- **2026-11-01 (later) — settled**: partial cross-Estate coalitions replace strict unanimity (a bloc is the full Nation only when all Estate-cells share the goal); Government propaganda draws on Administration's Coordination pool, other actors' on Culture/Print/Teaching only.
- **2026-11-01 (confirmed) — settled**: Triangle has no Fairness role; pre-cascade Requisition with its three effects; Fairness secondary by default; non-market contribution = need satisfaction delivered; low-awareness blame displacement; acceptance inputs + decay asymmetry; propaganda fast/slow split; Preference baselines seeded from Estate profile + Nation traits + noise; five Portrait axes kept for alpha; Observation governs off-slate visibility; bloc coordination spent by cells; repressive-pool defection deferred to a dedicated Administration session.
- **2026-11-01 (second confirmation) — settled**: Government Triangle retired; routine-tier minor-issue handling, faction attention as a slate mirror on cell Coordination, and institutional blocking via Veto/Council Rights; cell Coordination capacity from awareness inputs + Council/Petition Rights + organizing pools; Observation = the Government's committed awareness of a Region/cell; Requisition's two Opinion hits (direct/offsettable, structural via Extraction↔Investment alignment); faction action set (petition, strike/Duty-withholding, tax refusal, hoarding, armed retinue, kin-state appeal, counter-propaganda).
- **2026-11-01 (third confirmation) — settled**: Institutional↔Personalistic is a derived readout (not stored, not an input); benefits = pain-alleviating or joy-giving, Rights grants included; armed faction rung handed to War; Events and Characters beyond alpha (decision-log proxy for provenance, leaderless factions in alpha).
- **2026-11-01 (fourth confirmation) — settled**: war harm attributed to the enemy by default; Decision Log schema and ownership; war/diplomacy overhaul hooks (see `war__kb.md`, `diplomacy__kb.md`).
- **2026-11-02 — settled**: Government and Ledger merged and promoted (inflow channels; Ledger never negative; Borrowing only; per-turn priority over upkeep and discretionary actions); faction escalation momentum/hysteresis (supersedes the open "momentum/hysteresis" item); scope syntax and Region-level Convergence/Mobility/Demotion rules; Convergence rarity must emerge from cost.
- **2026-11-02 (later) — settled**: no anonymous debts; any cell may lend unless forbidden (Lending Right); Government borrows from permitted cells; Emergency Powers cost derived from the entitlement-loss acceptance function (no duration term).
- **2026-11-02 — open**: band widths and rung ordering (numbers pass). (Wealth never negative with derived net position: confirmed.)
- **2026-11-02 (War pass) — settled**: Retinue is a scalar Right; Veto strength is defined by cell privileges, not a separate parameter.
- **2026-11-03 (dial pass) — settled**: spending priority is a standing Allocation Dial (floors by priority, optional surplus share for discretionary entries, sink = keep) with a reserve floor protecting the balance from discretionary spending; the reserve counts as visible unspent Wealth for `visible_alternatives`.
- **2026-11-03 — settled**: Foreign Standing is Nation Sympathy + cell terms (no reverse aggregation); cells are actors with permitted/granted/defiance action classes; Government values as a Weight-weighted amalgam (AI value source, player readout); Government-to-Government standing (= `RelationState.opinion`); deniability per observer.
- **2026-11-04 — settled**: the eight psychological needs; scale of grievance severity, compliance and need satisfaction is a shared per-cell 0..1; covert-action concealment tier lives on a `CovertOp` record referenced from the Decision Log entry (log schema unchanged); scope ties (Region broader than Estate/Nation; Estate vs Nation latest-declared-wins) — **tie line superseded 2026-11-09 by the scope ladder** (same-rung ties: latest declared wins).
- **2026-11-09 — designer input**: scope ladder (Cell < Nation < Regional-Estate < Region < Estate < Empire), Precedence flag (Autonomy ↔ Unitarism), administrative-Region laws, Region reorganization gating, consultation/petition handling, Rules 35-37. Tagged **(proposed)** in the text and awaiting the designer's OK: Nation-rung reading, Precedence shape, Country-wide gating reading of "empire-wide question", modifiers landing on the Fairness bucket. **Open**: whether the tech gate also applies to tax law and Requisition scopes (assumed it applies to Rights/Duties states only; tax is a Duty, so tax law would also be Region-level in alpha).
- **2026-11-13 — designer decisions (cross-module)**: unmet upkeep reaches Administration per pool — the Ledger step writes `unmet(pool)` from the Government's mandatory upkeep rows (`economics__kb.md`, Resolution order); this file's Unmet-upkeep rule is unchanged.
- **Rev:** (tracked = every `###` under Data Structures; `Rules` as one section while it has no `###`; bootstrap 2026-11-13)
  - Data Structures > Actor (base unit) = 1
  - Data Structures > Government and Ledger (resource-holder, not a will — settled 2026-11-02) = 1
  - Data Structures > Government values and Government-to-Government standing (settled 2026-11-03) = 1
  - Data Structures > Estate Labor Profile (per (Nation, Estate, Region) cell) = 1
  - Data Structures > Estate Convergence (structural, top-down; per (Nation, Region) cell pair — 2026-11-02) = 1
  - Data Structures > Scope syntax and Region-level Convergence/Mobility/Demotion (settled 2026-11-02; ladder 2026-11-09) = 1
  - Data Structures > Existential vs. Secondary needs = 1
  - Data Structures > Fairness bucket (contribution vs. entitlement — settled 2026-11-01) = 1
  - Data Structures > Entitlement loss (decaying modifier on Fairness — settled shape) = 1
  - Data Structures > Government benefits (settled shape 2026-11-01) = 1
  - Data Structures > Awareness and attributed discontent (settled shape 2026-11-01) = 1
  - Data Structures > Decision Log (alpha causal-provenance mechanism — settled shape 2026-11-01) = 1
  - Data Structures > Rights checklist (universal, per-cell configurable) = 1
  - Data Structures > Estate Mobility (bottom-up, gradual, individual/family-scale) = 1
  - Data Structures > Duties checklist (universal, per-cell configurable) = 1
  - Data Structures > Wealth flow (per Actor, per turn) = 1
  - Data Structures > Prestige (derived, recomputed/turn) = 1
  - Data Structures > Duty compliance = 1
  - Data Structures > Skilled-labour Duty — make vs. buy = 1
  - Data Structures > Requisition Duty (settled 2026-11-01) = 1
  - Data Structures > Subinfeudation = 1
  - Data Structures > Grouping / Faction computation (Question-time only, never persisted) = 1
  - Data Structures > Faction escalation state (settled 2026-11-02) = 1
  - Data Structures > Compliance (per Actor cell, per need) = 1
  - Data Structures > Pressure and Question queue = 1
  - Data Structures > Question handling — consultation and petition (2026-11-09, proposed: modifiers land on the Fairness bucket) = 1
  - Data Structures > Government Portrait (Country-level root trait bundle) = 1
  - Data Structures > Cell Preferences & Propaganda (settled shape 2026-11-01; mechanics partly proposed) = 1
  - Rules = 1
