# Actions — Knowledge Base

Status: **new file** (2026-11-01 overhaul, Actions pass). Actions is a thin
cross-cutting spec, not a simulation module: it owns the action envelope,
lifecycle classes, cost/consent plumbing, the turn pipeline, the Decision Log
write path and the API the player, AI and factions all use. Each module keeps
ownership of its own actions' *effects*. Built from the actions already
scattered across the kb files; `actions__doc.md` (stub) was not consulted —
if it says something different, reconcile in a dedicated pass.

## Data Structures

### Action envelope
```
Action = { actor, type, owner_module, target, params,
           class: dial | commitment | event,
           costs: claims on pools/stocks,
           gate: consent domain (Rights/Veto/Council) | none,
           visibility: public | covert }
```
`actor` ∈ Government (player or AI), Country (diplomatic proposals), or a
cell (see Cell actions). One envelope serves all three —
AI parity — and every executed action writes the same Decision Log.

### Lifecycle classes
- **Dial** — persists until changed; changing it carries **no direct cost**
  (consequences come only from the resulting state shift, as with Control
  Allocation). Consent gating still applies where a Right covers the domain.
  Free dials: Control Allocation, Observation Allocation, planning posture,
  garrison priority, Army Tactics (per detachment), standing share (War),
  border/customs policy (gated). War stances are not dials: stance is automatic per Contingent (`war__kb.md`, 2026-11-11).
- **Commitment** — a persistent claim on labour or stock until released, or
  renewed every turn (fielded units, Mobilization, army Merge/Split, garrisons, Emergency Powers, propaganda,
  Espionage). Releasable at will; renewal lapses it. Show of Force is not a commitment and not an action: it is derived from border deployment (`war__kb.md`, 2026-11-10; it replaced Troop Training).
- **Event** — one-shot, irreversible (declare war, grant/revoke a Right, set
  tax law, place/lift a Requisition Duty, ratify a treaty, Persuasion, audits).

**Rights/Duties configuration and tax law are Events, not dials**: changing
them is gated (Veto/Council), costs something real (IP Rule 9) and triggers
entitlement-loss on affected cells.

### Allocation Dial (dial subclass — settled 2026-11-03)
The common shape of every dial that divides a produced or held amount among
claimants. Each entry takes what it needs by priority against a player-set
**floor**; whatever is left over flows automatically by **surplus ratio**:
```
AllocationDial(pool) = { entries: [ { target, floor, priority, surplus_weight, cap? } ], sink? }
resolve(amount)   // derived each turn, pure; no new pipeline step
  pass 1  entries by priority: grant min(floor, remaining); shortfall truncates the LOWEST priority
  pass 2  remaining -> entries with surplus_weight > 0, pro rata to weight, respecting cap
  leftover -> sink if set, else idle
```
- **Per cell by default** where the target is cells (Control, Observation): an
  entry's floor, weight and cap apply per covered cell; aggregate filters (any
  scope-syntax filter) and player-named groups are bulk shorthand expanding per
  covered cell (Administration).
- Persists until changed; re-resolved every turn from live amounts; changing it
  costs nothing directly (the dial rule above); consent gating still applies.
- **Users**: Control and Observation Allocation (Administration); the
  Government's spending dial, with a reserve floor (below); dual-claim pool
  splits (below). Not used for scalar dials (garrison priority, stances,
  planning posture), which stay plain dials.

### Cell actions (cells are actors — settled 2026-11-03)
Cells `(Nation, Estate, Region)` are actors in their own right with the same envelope and Decision Log. A **faction** stays a derived,
issue-scoped, never-persisted grouping (IP Rules 2, 21) used for stance and bloc coordination; commitments belong to the cells
themselves and are paid from the cell's own Wealth and pools. Persistent escalation (hoarding, tax refusal, Duty-withholding) is cached
per (cell, need) as momentum with a banded rung and hysteresis (IP, Faction escalation state) and read back at turn start (step 2).
A cell chooses among the actions available to it by the stance function (self-interest × Preference alignment); the decision rule is
owned by AI-Econ/Internal Politics. Three availability classes:
1. **Permitted by default** — acts no law forbids (lend, build trade infrastructure, settle, petition, counter-propaganda from its own pools).
   **Government silence means allowed.** A forbidding law is a Rights/Duties Event; it bites only through `involuntary_compliance`:
   the forbidden act is still attempted, scaled down by compliance (IP Rule 4 — enforcement is never a unilateral choice).
2. **Granted** — needs a held Right (armed rung needs the Retinue Right; minting; Local Jurisdiction acts).
3. **Defiance** — acts against a Duty or law (strike/Duty-withholding, tax refusal, hoarding, armed rung). No Right is needed, only the
   capability (labour in the pool, goods, a Duty to withhold, retinue scale); the effect is scaled down by `involuntary_compliance`.
   Defiance is neither approved nor gated; its costs arrive through attribution and the Decision Log.

A cell with no available action only accumulates grievance and migrates (derived pull, World Map) — migration is the always-available exit.
Default log visibility for cell acts (settled 2026-11-03): hoarding covert; strike, tax refusal and the armed rung public.

### Turn pipeline (simultaneous planning, fixed resolution order)
All actors plan against the same start-of-turn state, then resolve:
```
1 Exogenous shocks        harvest variance, epidemic (seeded RNG; cataclysm is post-alpha)
2 Validate + consent gating + resource locking; factions act from LAST turn's
  state; executed actions write the Decision Log
3 Economics               production → Land split → Requisition (pre-cascade) →
                          consumption cascade → taxation → debt service (existing
                          obligations) → credit clearing (new loans, Borrow) → Ledger →
                          Government upkeep shortfall
4 War                     movement, supply, battles, sieges; internal armed conflict
5 Internal Politics       grievance update, Decision Log read (attribution),
                          modifier decay, Question trigger, faction recompute,
                          escalation rungs; compliance reads the upkeep-degraded
                          C/C/O computed in step 3
6 Administration          active-slate allocation for NEXT turn
7 Diplomacy               proposal resolution, propaganda, Leverage
8 Region re-derivation    single end-of-turn pass: splits/sums of per-cell state
```
Rationale: Requisition precedes the cascade; reactions follow all state
changes so attribution sees this turn's actions; faction decisions and the
Government's slate both lag one turn, which telegraphs escalation (it shows up
a turn after it begins). Upkeep degradation is computed at step 3 (shortfall
known after Economics) so step 5 reads it the same turn. Government market purchases are funded from the start-of-turn Ledger balance; this turn's taxation lands for next turn.

### War declaration timing (settled 2026-11-02)
A declaration is validated and consent-gated at step 2 and logged publicly at once; its diplomatic effects (CB, alliance triggers) resolve at step 7; hostilities begin on the next turn's step 4.

### Gating (derived, never stored)
```
gate(action) = cells whose Veto or Council seat covers the action's domain
```
- No covering Right → the action executes (the "slip past attention" path,
  incl. blocs absorbed in a more severe Question).
- Covering Right → approval is a stance check: material self-interest ×
  Preference-vector alignment (the shared stance-times-modifier skeleton).
- **Strength comes from privileges, not a parameter** (settled 2026-11-02): which Rights a cell holds (Veto domain, Council seat, Petition) with its Weight/Control/Pressure state. A Veto-holding cell (e.g. nobles) can block; a consultation-only or rightless cell (e.g. peasants in a strongly feudal state) can be almost freely ignored. The same stance function governs Veto-to-declare and Veto-to-continue war.
- Refusal blocks the action. The ruler may **force it through Control**: this
  overrides a held Right, so it registers as an **entitlement-loss event** on
  the holder cell(s) (decaying Fairness modifier, IP) — asymmetric costs arise
  only from existing timing/Weight/Control/Pressure state (IP Outcome
  Asymmetry), never a bespoke penalty.

### Shared pools
Dual-claim pools (production vs. administrative C/C/O vs. Army) resolve by an **Allocation Dial** (floors for administrative and Army claims by priority, production as the natural sink), as Control Allocation does; a shortfall truncates the lowest priority. Market competition stays Economics' job. Propaganda is not a labour claim: non-Government propaganda directs a pool's finished Culture/Print/Teaching output (zero-sum with its ordinary use, Economics); the Government's draws on Coordination output.

### Decision Log write path
Schema and ownership are Internal Politics' (`entry = {actor, action_type,
visibility, turn, affected_cells}`). Actions owns **writing**: every executed
action appends an entry with a default visibility by type:
- **public**: laws, war declarations, requisitions, treaties, state-level acts
- **covert**: Espionage, covert influence, covert propaganda

Attribution reads `visibility` and recency (IP, Awareness). Deniability is not a log field (settled 2026-11-03). Attribution is derived **per observer at read time**: the observer's detection strength (Observation + counter-intelligence Espionage) against the action's concealment tier yields undetected / act detected (sender unknown) / sender revealed (Diplomacy). Deniability = low causal visibility for that observer. The log schema is unchanged.

### Government spending: spending dial, Borrow, Default (settled 2026-11-02; dial revised 2026-11-03)
- **Spending dial** (an Allocation Dial, standing, re-resolved every turn against the live balance; the player/AI may change it any time at no direct cost): upkeep items and discretionary actions take **floors by priority**, discretionary entries may also take a **surplus share**, and unspent balance is **kept by default** (sink = keep). Shortfall truncates the lowest priority (pipeline step 3).
- **Reserve floor**: a player-set minimum Ledger balance that **discretionary** entries cannot draw below; mandatory upkeep may dip into it. The reserve is unspent Wealth the cells can see, so it feeds the acceptance function's `visible_alternatives` (Internal Politics).
- **The Ledger is never negative.** **Borrow** (Event) is the only way past balance: it adds to Ledger Wealth and creates a repayment obligation to the lender(s). **Default/Repudiate** (Event) costs creditor Opinion/Grievance through the normal Wealth Flow channels. Both are gated by any covering Right. No anonymous debts: lenders are any cells permitted to lend (credit is a derived market in Economics); interest is derived per trade zone with an optional legal ceiling; loans stay nominal.

### Determinism and preview
```
validate(state, action)          pure
preview(state, action)           pure; bounded by what the actor can observe
resolve_turn(state, actions)     pure; seeded randomness only for shocks
```
Preview is free but limited to state visible to the actor (Observation
governs hidden Grievance/compliance state — preview never reveals what audits
are meant to surface). Commits are irreversible except dials and releasable commitments.

**Preflight (settled 2026-11-03)**: before End Turn, `preview(resolve_turn)` over the actor's own visible state yields **advisory warnings**, never a block: projected Ledger shortfall (planned spending exceeds the balance — the Ledger itself never goes negative, so the warning gives the unfunded amount, which entries are truncated, the unmet upkeep fraction and the resulting C/C/O degradation, and offers Borrow); Σ floors exceeding produced output for any Allocation Dial; queued events that would be refused at gating; Threshold Meters below threshold (the action would do nothing, no refund); an empty Orders tray. It excludes step-1 shocks and unobserved state, and price-dependent figures are estimates.

### Existing actions by module (class shown)
| Module | Dials | Commitments | Events |
|---|---|---|---|
| Administration | Control/Observation Allocation, planning posture, border policy (gated) | Emergency Powers | audits, escalate external Question |
| Internal Politics | — | propaganda/education | Rights/Duties config, tax law, Requisition place/lift, Profile shift, benefits, Persuasion, Debt forgiveness, Borrow, Default (Ledger), Estate Convergence declaration, Mobility-gap setting |
| War | garrison priority, Army Tactics (per detachment), standing share | fielded units, Mobilization, army Merge/Split | declare war, peace |
| Diplomacy | — | Espionage, foreign propaganda | Sanction/Dependency/Alliance, Facilitation Grant, Recognize a rebel polity |
| Economics | — | construction (Builders + Wealth: trade infrastructure, roads, warehouses); free-colonization incentive spend | Mint/recoin (fineness parameter); direct resettlement of specific cells |
| Cells (actors) | — | hoarding, tax refusal, Duty-withholding, counter-propaganda, trade-infrastructure construction (own Wealth), lending (cleared by the derived credit market) | petition, settle, revolt/armed rung, kin-state appeal, international-recognition appeal |
| Meteomancy (Government or any cell holding the pool) | — | Ritual: Meteomancy/Theurgy labour above a fixed threshold + Processed Reagents (consumed), sustained for the ritual's authored duration | on completion, an authored one-shot effect on a named crisis state (epidemic burden, harvest variance, ...) |

## Rules
1. One envelope for Government, Country and cell actions; AI uses the same API as the player.
2. Every action is exactly one class: dial (free to change), commitment (persistent claim), event (one-shot).
3. Free means no direct cost, not no consequences and not no consent gating.
4. Rights/Duties config and tax law are gated Events with real costs — never dials.
5. No global action-point cap; limits come from existing pools, Coordination (the slate) and Diplomacy/Espionage thresholds (no free-floating metric).
6. Planning is simultaneous; resolution order is fixed (pipeline above).
7. Cell commitments are owned by the cells (paid from their own Wealth and pools); persistent escalation is cached per (cell, need) as momentum, never on a persisted faction.
8. Gating is derived from the Rights checklist; no covering Right means the action executes.
9. Forcing a refused action through Control overrides a Right and triggers entitlement-loss on the holder; no bespoke penalty.
10. Every executed action writes the Decision Log; default visibility by type; intent is never modeled or recorded.
11. Dual-claim pools and Government spending are Allocation Dials: floors by priority (shortfall truncates the lowest), surplus by ratio, optional cap and sink.
12. `validate`/`preview`/`resolve_turn` are pure; randomness only in step 1; preview never exposes unobserved state.
13. Upkeep degradation is computed after Economics and read by Internal Politics the same turn; the Government's slate lags one turn.
14. The Ledger is never negative; Borrowing is the only way past balance.
15. Spending priority is a standing dial re-resolved every turn; unmet upkeep truncates from the bottom; discretionary entries cannot draw below the reserve floor; unspent balance is kept by default.
16. An Allocation Dial's default unit is the cell; aggregate filters and groups expand per covered cell; surplus auto-fill is free.
17. Preflight warnings are advisory and derived from `preview`; End Turn is never blocked.

## Cross-references
- **Internal Politics** — owns the Decision Log schema, Rights/Duties, faction action set, attribution, entitlement-loss, Outcome Asymmetry; Actions only writes and gates.
- **Administration** — Control/Observation Allocation are the model dials; slate allocation is pipeline step 6; Emergency Powers, audits.
- **Economics** — pipeline step 3 (Requisition pre-cascade, Taxation post-cascade); dual-claim pool resolution; exogenous shocks (harvest).
- **War** — step 4; declare war, peace, per-detachment Army Tactics, standing share, garrison priority, Mobilization, Merge/Split; internal armed conflict; Show of Force is derived from deployment and is not an action (replaced Troop Training).
- **Diplomacy** — step 7; Espionage/propaganda thresholds, treaties, Sanctions, Facilitation Grants; deniability = low causal visibility.
- **World Map** — exogenous shocks (epidemic) in step 1; Region re-derivation in step 8; cataclysm is post-alpha.
- **Characters / Events** — beyond alpha; alpha uses the Decision Log and leaderless factions.
- **AI modules** — consume this API; Leverage instrument selection and enumeration of action sets are deferred to them.

## Status
- Envelope, three classes, simultaneous planning, pipeline order (incl. upkeep move to step 3), gating and force-through-Control semantics, no global action cap, default visibility by type, pure/preview-bounded API, faction commitments as cell-carried escalation state: **settled 2026-11-01**.
- **Open**: rung ordering and band widths (numbers pass); exact form of observation-bounded preview; action-set enumeration for AI parity (deferred to AI modules).
- **2026-11-02 — settled**: Ledger priority dial; Borrow and Default Events; Ledger never negative; faction escalation momentum as defined in Internal Politics.
- **2026-11-02 (later) — settled**: Emergency Powers is a commitment whose cost is derived each turn (Administration); lending is a permitted-by-default cell act cleared by the derived credit market (no per-loan action), Borrow is the Government's demand-side Event; Mint carries a fineness parameter; pipeline step 3 order includes Land split and debt service (debt-service position settled 2026-11-03).
- **2026-11-02 (War pass) — settled**: war-declaration timing; Army Tactics are dials; Veto strength comes from cell privileges and one stance function covers declare/continue. (Troop Training as a commitment: superseded 2026-11-10 by Show of Force, derived and not an action.)
- **2026-11-02 (World Map pass) — settled**: pipeline gains step 8 (Region re-derivation, end of turn); Government-directed settlement is a Builders + Wealth commitment; cataclysm is post-alpha.
- **2026-11-03 (dial pass) — settled**: Allocation Dial subclass (floor + priority + surplus ratio, cap, sink); per-cell default with aggregate/group shorthand; Government spending dial is standing with a reserve floor and sink = keep (replaces "re-chosen every turn"); pool-claim splits use the same dial; End Turn Preflight (advisory warnings, incl. projected Ledger shortfall).
- **2026-11-03 — settled**: cells are actors (actor classes Government / Country / cell) with permitted/granted/defiance action classes and default log visibility by act type; deniability as a per-observer read-time scaler; propaganda is directed output, not a labour claim; Government purchases funded from the start-of-turn Ledger; Rituals are commitments gated by the Meteomancy pool (population-scale only in alpha).
- **2026-11-12 — settled (designer confirmation)**: Troop Training removed from the lifecycle classes and the War row (Show of Force replaces it); War actions follow `war__kb.md` 2026-11-10/11: per-detachment Army Tactics and the standing share are dials, Mobilization and army Merge/Split are commitments, stance is automatic per Contingent and no longer a dial.
- **Rev:** (tracked = every `###` under Data Structures; `Rules` as one section while it has no `###`; bootstrap 2026-11-12)
  - Data Structures > Action envelope = 1
  - Data Structures > Lifecycle classes = 2
  - Data Structures > Allocation Dial (dial subclass — settled 2026-11-03) = 1
  - Data Structures > Cell actions (cells are actors — settled 2026-11-03) = 1
  - Data Structures > Turn pipeline (simultaneous planning, fixed resolution order) = 1
  - Data Structures > War declaration timing (settled 2026-11-02) = 1
  - Data Structures > Gating (derived, never stored) = 1
  - Data Structures > Shared pools = 1
  - Data Structures > Decision Log write path = 1
  - Data Structures > Government spending: spending dial, Borrow, Default (settled 2026-11-02; dial revised 2026-11-03) = 1
  - Data Structures > Determinism and preview = 1
  - Data Structures > Existing actions by module (class shown) = 2
  - Rules = 1
