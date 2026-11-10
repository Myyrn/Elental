# Diplomacy — Knowledge Base

Status: structural shape settled — CB tiers, Sanctions/Dependency/Alliance
shared axis-bundle, Reputational Leverage, Diplomacy/Espionage
fixed-threshold action model. Leverage instrument selection and weighting live in AI-Diplomacy, not here. Covert Faction
Influence re-verified against the Actor-cell model (2026-11-01, see Status).
**Leverage Categories** (Economic/Diplomatic/Military/Cultural split) settled as derived readouts (2026-11-03) — see below.

**2026-11-01 overhaul pass**: Covert Faction Influence now includes foreign
propaganda into cell Preference stacks (Espionage-threshold, per target
Region); Cultural Leverage derived from culture-associated pools and
preference alignment; kin-state appeal opens the Oppression-of-a-Nation CB;
CB wording no longer reads the Portrait as a motive; Succession/Common Ruler
axes are post-alpha (Characters beyond alpha).

**2026-11-02 rules pass**: detection of covert influence = Observation +
counter-intelligence Espionage (additive) against the sender's concealment
tier; sender revealed at a higher threshold; false flags possible.

**2026-11-02 (Countries/Diplomacy pass)**: CB persistence classes (state-based /
event-based / structural), per-observer overreach penalty, binary below-threshold
actions with thresholds scaled by the target object, DomainVeto axis, Confederation
as a symmetric bundle, Leverage Categories as readouts.

**2026-11-10 designer input**: a Negotiation Session model — no fixed term, either side may withdraw at any time (restart from scratch), a satisfaction meter for the other side, and a decaying Reputational Leverage mark when the stronger Country withdraws. **The Diplomacy action catalogue is now written (Action Catalogue, below)**: one direction per action, grouped by axis, with Embargo (strength / Country or Regions / goods) and Tariffs replacing Trade Sanctions, separate alliance actions with a Benevolent Neutrality → Defensive Pact → Standing Offensive chain, and Improve Relations as a decaying opinion modifier. Show of Force is not a diplomatic action — it is derived from border deployment (`war__kb.md`). Items tagged **(proposed)** await the designer's OK.

## Data Structures

### Casus Belli (CB)
Four tiers by grievance severity — NOT a war-goal license table; every
tier is diplomatically resolvable, tier only sets resistance-to-resolution.
```
CB.tier ∈ { Grievance, Rights, Sovereignty, Existential }
```
| Tier | Trigger examples |
|---|---|
| Grievance | insult, minor tariff breach, small unpaid tribute |
| Rights | broken treaty clause, Local Jurisdiction abuse, blocked trade edge |
| Sovereignty | Veto break, forced-annexation attempt, backing a Nation's secession bid |
| Existential | Great-War-chain trigger, coalition action backed by the great powers (derived predicate, see Great-power backing) |

**Oppression-of-a-Nation CB** — tier derived per intervening Country:
```
IF oppressed Nation is intervener's own titular/kin population: tier → Sovereignty
ELSE (no kin/titular link): tier → Rights at most
```
**Kin-state appeal (2026-11-01)**: a faction's appeal to a foreign kin-state
(Internal Politics' faction action set) opens the Oppression-of-a-Nation CB
for that kin-state (Sovereignty tier for its kin population) plus optional
support as Facilitation Grants.

**CB overreach**: `overreach_magnitude = f(gap between CB tier and actual war goals claimed)`. The penalty is applied **per observer** (settled 2026-11-02): each Country's Reputational Leverage stack toward the overreacher takes a hit scaled by the magnitude and by that observer's closeness to the victim (alliance tier, kin ties, trade dependence) — never global. Curve shape: numbers pass. Unilateral Annexation of occupied territory is a forced-annexation act: Sovereignty-tier CB for the victim plus the per-observer overreach penalty — no separate penalty stack (settled 2026-11-03).

**CB persistence classes (settled 2026-11-02)** — all remain diplomatically resolvable:
- **State-based**: persists while the grounding fact holds, with no timer (an unremedied breach, occupied territory, a blocked edge, an uneven tariff relationship).
- **Event-based**: a decaying modifier stack like Sympathy; **persistence scales with tier** — a Veto break or forced-annexation attempt is event-based but outlasts minor insults (e.g. lingering border tension); Grievance-tier CBs fade fastest.
- **Structural**: standing and derived, **needing no prior justification**: (a) nationalism / long-lasting claims — derived from a titular or kin Nation's core or presence in foreign provinces (Nations data; `claims` in RelationState); (b) a **militaristic disposition** — an empire that is essentially militaristic, with a tradition of warring against everyone, holds a standing CB against any target. The disposition is derived from the Portrait (Ruthlessness) and the war record in the Decision Log, never stored, and observers already price it through Reputational Leverage.


**CB external recognition** (boolean, independent of tier): a Sanction can
strip external legitimacy. Target's own population still recognizes it
fully — internal Great-War-chain math, Defensive-alliance triggers, etc.
still read it normally; externally it scores full overreach and does NOT
pull in Defensive-tier allies.

### Reputational Leverage
Per-(Country, Country) decaying-modifier stack (like Nations' Sympathy) —
**not** the same stack as Government Portrait's Ruthlessness↔Restraint
(AI Countries: that axis drives behaviour; player Countries: the Portrait is
the observed action record; this stack is external belief about it, laggable
under poor intelligence).
```
fed by: CB overreach (−), promise fulfilled/broken (±), Veto/treaty
compliance (±), rejecting a coalition-backed demand (− only vs. that coalition's supporters, never global),
withdrawing from a negotiation as the stronger party (−, decaying; see Negotiation Session)
```
Never a freely-spent independent currency.

### Great-power backing (derived — replaces "Concert", 2026-11-03)
"Concert" is a metaphor: no body, no vote, no entity. International order is the web of lateral treaties plus the weight of the strongest Countries.
A Sanction or Coalition is **great-power-backed** when its imposers include a sufficient share of the strongest Countries, ranked by the Military and Economic
Leverage readouts. "Great-War-chain" means propagation through the alliance/treaty graph only — no global tension metric (cross-module notes).

### Government-to-Government standing (settled 2026-11-03)
`RelationState.opinion` = Government-to-Government Foreign Standing (Internal Politics, derived: the Weight-aggregate of the powerful cells' Foreign Standing toward the other Country + alignment between this Government's amalgam and the other's observed Portrait). It is distinct from Reputational Leverage (external belief about conduct) and from Sympathy (Nation × Country). **Improve Relations** (2026-11-10) adds a decaying modifier term to it — the same baseline-plus-decaying-modifier shape, cached and re-derivable, never spendable.

### Leverage (general)
NOT a scalar, not modeled here — a set of typed, granular instruments
(e.g. a specific-commodity embargo threat). Instrument selection is an
AI-behavior concern (AI-Diplomacy).

### Leverage Categories (readouts settled 2026-11-02; weights by AI-Diplomacy from the Portrait, settled 2026-11-03)
**Settled boundary**: the categories are derived per-(Country, Country) readouts with no stored aggregate; any weighting is applied only at an AI decision (AI-Diplomacy).
Splits Leverage into weighted subscores, evaluated per diplomatic decision
rather than as one aggregate:
```
Leverage(A, B or Bloc) = { Economic, Diplomatic(Reputational), Military, Cultural }
```
- **Scope**: bilateral per Country-pair, OR per Alliance-bloc-pair (e.g.
  A vs. B+B's allies combined) — resolved at negotiation/decision time,
  not stored continuously.
- **Weighting**: per-decision, weights vary by country profile and
  challenge/situation type — not a fixed global weighting. Weighting is owned by AI-Diplomacy and seeded from the Portrait (e.g. Ruthlessness raises the Military weight); player-run Countries see only the readouts.
- **Threshold override**: an existential-threat state can promote a
  single category (typically Military) above its normal weight, enough
  to override an otherwise-unfavorable aggregate — e.g. a country with
  poor Economic leverage still goes to war rather than accept erasure.
  Trigger: a core province occupied, or an Existential CB held against the Country (settled 2026-11-03); the threshold value is a numbers-pass item.
- **Military category feed**: fed in part by War's **Show of Force** (formerly Troop Training, see `war__kb.md`) — a decaying modifier derived from troops deployed in border Regions adjacent to a specific Country/Bloc while no war is ongoing between them. Stacks with War Exhaustion and other
  active-war Military Leverage penalties; does not replace them.
- **Cultural category (derived — settled 2026-11-01)**: sourced from the
  Country's culture-associated labour pools (Teaching, Culture — printing/
  distribution, cultural propaganda) directed at the target; realized as the
  Weight-aggregated alignment of the target's cell Preference vectors to this
  Country's observed Portrait. The other categories likewise read existing
  data: Economic from trade dependency (throughput), Military from War
  (Show of Force, exhaustion readout), Diplomatic = the Reputational stack.
- Aggregation formula, per-category computation (beyond Military's War-kb
  feed), country-profile-driven weighting, threshold trigger condition:
  **open, implementation-deferred**.

### Negotiation Session (2026-11-10)
```
Negotiation(A, B) = { terms (each side's proposals; the Peace Conference's are stacks, war__kb.md),
                      state ∈ open | concluded | withdrawn,
                      satisfaction(A), satisfaction(B), walkout_threshold(A), walkout_threshold(B) }
```
- **No fixed term.** A negotiation stays open until it concludes or a party withdraws — it has no turn limit.
- **Withdrawal at any time.** Either Country may withdraw whenever it judges necessary. A withdrawn negotiation is closed; a later negotiation **starts completely from scratch** (no proposals, concessions or progress carry over). The UI warns before a withdrawal (`ui__kb.md`).
- **Satisfaction** of a side is a derived readout of how well the terms on the table serve its stance (the same stance-times-modifier shape as the rest of the skeleton; in a war it is the side's `peace_evaluation`, `war__kb.md`). When it falls below the side's walk-out threshold that side ends the negotiation. The other side's satisfaction and its walk-out threshold are shown as a **meter**: **exact in alpha**; a **fog-of-war estimate** (stamp `estimated`) once fog-of-war exists (post-alpha).
- **Withdrawal leaves a decaying mark** when the withdrawing Country is the **stronger** party — stronger by the Leverage-readout comparison at negotiation time (bilateral or bloc-pair scoping, as in Leverage Categories). The mark is a decaying negative modifier on that Country's Reputational Leverage stack toward the other party **(proposed reading: sign negative, on the stronger Country's own stack)**. A weaker Country that withdraws leaves no mark. The mark is cached and re-derivable like any modifier — never a spendable currency.
- **Scope (proposed reading)**: the session applies to every bilateral diplomatic negotiation, including the Peace Conference (war and internal-conflict terms alike).
- **Alliance negotiation (2026-11-10)**: a higher link in the alliance chain automatically covers the lower links; the lower actions are **disabled** (greyed out) in that negotiation.

### Axis Bundle (shared substrate — Sanctions/Dependency/Alliance)
```
Axis ∈ { CultureLanguageSovereignty, MilitaryCap, ForeignPolicy,
         TradeAccess, Succession, Fortification, ResourceExportBan,
         LaborMigrationBan, DomainVeto, ... extensible }
AxisGrant = { axis, terms, scope }
```
| Axis | Effect |
|---|---|
| Culture/language sovereignty | forces titular-Nation status |
| Military cap | Levy Duty / Army sub-pool ceiling; breach = CB for neighbors |
| Foreign policy | target can't ratify treaties without grantee consent |
| Trade access | forced tariff-exemption or embargo vs third party |
| Succession | approval/veto over ruler selection — post-alpha (Characters beyond alpha) |
| Fortification | region-set or whole-Country ban-new-construction / forced-dismantlement |
| Resource export ban | single-good embargo, `throughput_cap → 0` on that edge |
| Labor migration ban | blocks cross-Country Teaching-recruitment |
| Domain Veto (2026-11-02) | grantee holds a Veto over named Rights/Duties domains of the grantor (reuses Internal Politics' consent gating); replaces Countries' `government_form` |

### Sanction / Dependency / Alliance
```
Sanction   = { imposers: Set<Country> (≥1, ad hoc or great-power-backed), target, axes }
Dependency = { overlord, dependent, axes }   // imposed, persistent, asymmetric
AllianceTier(A,B) ∈ { Guarantee, BenevolentNeutrality, Defensive,
                       Coalition, StandingOffensive, Confederation }
```
| Tier | Shape |
|---|---|
| Guarantee | asymmetric: guarantor defends, no reciprocal obligation |
| Benevolent Neutrality | mutual non-aggression + CB-suppression |
| Defensive | + mutual defense trigger, feeds Great-War chain; gated by CB external recognition |
| Coalition | situational offensive, expires with named conflict |
| Standing Offensive | open-ended mutual offensive commitment |
| Confederation | symmetric Dependency-style bundle: each member grants the same axes (any axes of the shared menu — e.g. ForeignPolicy, MilitaryCap, TradeAccess, DomainVeto — granted symmetrically; optional Common Ruler — post-alpha, Characters beyond alpha); changes need mutual consent; no overlord and **no teeth** beyond the axes' own effects |

Dependency's dependent titular status survives by default unless
CultureLanguageSovereignty is bundled. Active Alliance (≥Benevolent
Neutrality) adds a standing Reputational Leverage bonus between parties.

### Cooperation / Facilitation Grant
```
Cooperation(A,B) = Set<axis>, axis ∈ { Trade, Scientific, LegalJustice, ... }
FacilitationGrant = { grantor, grantee, specific_asset, terms }   // lightest tier, scoped micro-Right
```
Cooperation can exist with zero political alliance.

### Diplomacy/Espionage Action Threshold (settled 2026-11-02)
```
Action(type, tier) requires labor_threshold = base(type, tier) × target_scale(target object)
committed ≥ threshold → full effect; committed < threshold → nothing happens (binary)
Investing beyond threshold: no additional benefit.
```
- **Binary below threshold**: the action fails and the committed labour is **not refunded** (it stays a zero-sum claim for that turn).
- **Fixed per action type and tier, scaled by the targeted object's own parameters** — e.g. Region-targeted Espionage cost is multiplied by that Region's population — but it **never depends on the opposing empire's size**.
- The concealment-tier threshold of a covert action carries the same target scale, so detection thresholds follow it.
Balance lever is breadth (many simultaneous actions), not depth. Actions with no Region target (settled 2026-11-03): there is no general rule — each action type declares its own target-scale parameter, a derived property of the targeted object, when it is designed. An action type without one is incomplete.

### Action Catalogue (2026-11-10)
The player-facing list of Diplomacy actions, grouped by axis and phrased in common strategy-game and political language. Conventions:
- **One direction per action.** Positive and negative actions that affect the same parameter are separate actions (a Trade Agreement is not an Embargo). A positive action takes **0 to 100**, a hostile action **−100 to 0**; some actions use named tiers, and any action may carry a **duration** where one makes sense. Each action follows its own parameter rules.
- Each action declares its **parameter type, its own target-scale (Rule 20, Action Threshold), a default visibility** and a **narrative paragraph without mechanics** (`narrative` text, content still to be written, as for Laws).
- **Kinds (proposed)**: an *agreement* needs the counterpart's ratification (Negotiation Session); a *unilateral act* takes effect by itself (it may carry a CB for the target); a *demand* is put to the target, which accepts it, rejects it (Reputational and CB consequences) or is pushed into it by Leverage.
- Every action writes ordinary state (axes, modifier stacks, treaties); the catalogue adds no new stock.

**Trade (TradeAccess, ResourceExportBan)**
| Action | Kind | Parameters |
|---|---|---|
| Trade Agreement | agreement | access 0–100; duration |
| Tariff Exemption | agreement | exemption 0–100; goods (all or chosen); duration |
| Impose Tariff | unilateral | tariff −100–0 (0 none, −100 prohibitive); goods (all or chosen); duration |
| **Embargo** | unilateral, one or more imposers | strength −100–0; target scope: the **entire Country** or **chosen Regions**; goods: **all of the market** or **chosen goods**; duration |

- **Embargo replaces "Trade Sanctions"** (they were the same thing). It writes a `Sanction` with the TradeAccess or ResourceExportBan axis: strength scales `throughput_cap` toward 0 on the affected edges and goods; a single chosen good at full strength is the old ResourceExportBan. Imposers are ad hoc or great-power-backed as before. Region-targeted embargoes scale their threshold by those Regions' own parameters.
- **Tariffs replace the Sanction tiers.** Tariff mechanics (rates on goods crossing the border) are Economics' (`economics__kb.md`); this action only sets them diplomatically **(proposed alignment with Economics' Estate-Tariffs/zone tolls)**.
- **Tariff asymmetry (derived, proposed)**: `tariff_asymmetry(A, B)` is a readout comparing the tariffs each Country imposes on the other, weighted by trade dependency. Uneven tariffs give the disadvantaged side a **Grievance-tier, state-based CB while the asymmetry holds** and an opinion modifier, so mutual tariffs the parties feel are uneven can harm relations; **Embargo is the escalation** the disadvantaged side may choose.

**People (LaborMigrationBan)**
| Action | Kind | Parameters |
|---|---|---|
| Migration Treaty | agreement | freedom 0–100; duration |
| Migration Ban | unilateral | strictness −100–0; duration |

**Military (MilitaryCap, Fortification, Alliance)**
| Action | Kind | Parameters |
|---|---|---|
| Military Access | agreement | scope (Regions or Country); duration |
| Demand Disarmament | demand | cap as a share of the target's Levy/Army ceiling; duration |
| Ban Fortification | demand | scope (chosen Regions or whole Country); mode: ban new construction / force dismantling |
| *Alliance actions* | agreement | see below |

- **Alliance actions** (a subsection of Military): **Benevolent Neutrality**, **Guarantee**, **Defensive Pact**, **Standing Offensive** and **Coalition** are five separate actions.
  - **Chain**: Benevolent Neutrality → Defensive Pact → Standing Offensive. Agreeing a higher link automatically covers the lower ones, which are **disabled during that negotiation**.
  - **Independent** (settled 2026-11-10): **Coalition** (situational offensive for one named conflict; it imitates a Defensive Pact or Standing Offensive but only for that conflict, expires with it, requires and disables nothing) and, taken the same way, **Guarantee** (one-sided; no reciprocal obligation) **(Guarantee's independence is my reading — not stated)**.
  - **Confederation** is a symmetric Sovereignty bundle (below), not an alliance link.
- **Declare War** and **Propose Peace** belong to War (`war__kb.md`; peace terms are the Peace Conference stacks); they are listed here only for completeness.
- **Show of Force is not a diplomatic action** (confirmed 2026-11-10): troops deployed in border Regions adjacent to a Country with no war between the two produce a decaying Military Leverage modifier, derived from the deployment (`war__kb.md`).

**Sovereignty (CultureLanguageSovereignty, ForeignPolicy, DomainVeto)**
| Action | Kind | Parameters |
|---|---|---|
| Impose Cultural Autonomy | demand | option: titular status for Nation X; duration or permanent |
| Take Over Foreign Policy | demand | option: treaty consent only / consent and veto |
| Demand a Say in Domestic Law | demand | Veto domain checklist (Internal Politics' domain list); duration |
| Establish Dependency | demand | bundle of axes chosen from the shared menu |
| Confederation | agreement | symmetric bundle of the same axes; mutual consent |

**Cooperation**
| Action | Kind | Parameters |
|---|---|---|
| Scientific / Legal Exchange | agreement | cooperation axis; duration |
| Gift / Facilitation Grant | agreement | specific asset; terms |

**Intelligence (Espionage threshold)**
| Action | Kind | Parameters |
|---|---|---|
| Propaganda (overt) | unilateral | target Region; exports the sender's Portrait |
| Covert Influence | unilateral | target Region; Portrait axis or chosen point; concealment tier; optional false flag |

**Relations**
| Action | Kind | Parameters |
|---|---|---|
| **Improve Relations** (confirmed 2026-11-10) | unilateral | none beyond the target; the effect decays |

- **Improve Relations** adds a **decaying modifier to the Government-to-Government `opinion`** (talking and showing respect matters as much as direct action). It is a fixed-threshold Diplomacy action, binary below threshold, and it does not touch cells' Foreign Standing (that is propaganda). **Repeating it while a modifier is active refreshes the modifier to full instead of stacking**, so the benefit has a ceiling. It cannot be bought in bulk; the modifier is cached and re-derivable.
- **Open**: a hostile counterpart (a Denounce / Insult action — the Grievance tier already lists insult as a trigger); whether Improve Relations needs a distinct target-scale (Rule 20); parameters and thresholds for every action (numbers pass).

### Covert Faction Influence & Foreign Propaganda (settled shape 2026-11-01)
Espionage-threshold actions per target Region (fixed threshold — breadth,
not depth, per the Action Threshold model above); fixed magnitude per action,
sustained by recommitting each turn (decaying modifier). Writes into a
foreign (Nation, Estate, Region) cell's existing IP fields:
```
- Opinion-toward-Government adjustment — target-agnostic (may benefit a
  third party, proxy-pull)
- Grievance-bucket injection
- Preference-modifier push (foreign propaganda) into the target cells'
  Preference stacks
```
**Message**: overt propaganda exports the sender's own Portrait (its observed
ideal point); covert influence may push toward any chosen point at a
deniability cost.
**Attribution/deniability**: reuses awareness × causal visibility (Internal Politics), evaluated per observer: the observer's detection strength against the concealment tier decides undetected / act detected / sender revealed (settled 2026-11-03); detection gives the victim a Grievance- or Rights-tier CB.
**Detection (settled 2026-11-02)**: the defender's detection strength in a target Region = committed Observation (`administration__kb.md`) + committed counter-intelligence Espionage, which **stack additively** (two ways of noticing: official observation vs. counterintelligence measures). Fixed-threshold tiers, no benefit beyond a threshold: (1) the **act** is detected at or above the concealment threshold of the sender's chosen tier; (2) the **sender is revealed** only at a separate, higher attribution threshold. Counter-intelligence Espionage comes from the same pool as outbound Espionage actions (zero-sum).
**False flag**: a country with strong Espionage may add a false-flag option to a covert action at an extra Espionage threshold; attribution then points at the chosen apparent sender, and seeing through it requires detection strength at or above the false-flag threshold. A CB is granted only against the sender the victim attributes, so a false flag exposes the apparent sender until it is seen through; seeing through reveals the true sender. **Exposure costs the true sender both Reputational Leverage and a CB against it. There are no limits on whom a false flag may implicate** — the player/Portrait decides whether to risk relations, even with a friendly country. Open: exact thresholds (numbers pass).

## Rules
1. No CB tier grants a war-goal license by itself.
2. CB overreach judged against actual goals claimed vs. citing CB's proportionate tier.
3. CB external recognition is independent of tier and of the target's own internal recognition.
4. Sanctions/Dependency/Alliance-Confederation share one axis menu — differ only in symmetry/compulsion/bundling.
5. Reputational Leverage and Portrait's Ruthlessness↔Restraint are separate stacks — never merged.
6. Rejecting a demand backed by a coalition costs Reputational Leverage only with that coalition's supporters, never globally.
7. Labor beyond an action's threshold produces no additional effect.
8. Defensive-tier mutual-defense only triggers if the attacked party's CB is still externally recognized.
9. Leverage Categories are evaluated per-decision, not summed into one number; an existential-threat threshold can let one category override an unfavorable aggregate.
10. Military Leverage category stacks with War Exhaustion / active-war penalties — it does not substitute for them.
11. Foreign propaganda is an Espionage-threshold action per target Region; overt propaganda exports the sender's Portrait, covert may push any point at a deniability cost.
12. Detected covert influence gives the victim a Grievance- or Rights-tier CB; deniability = low causal visibility.
13. Cultural Leverage is derived from culture-associated pools and realized as preference alignment to the sender's observed Portrait.
14. Detection strength in a Region = committed Observation + counter-intelligence Espionage (additive); act-detection and sender-attribution are separate fixed thresholds; false-flag operations are an optional higher-threshold concealment.
15. CB persistence classes: state-based (while the grounding fact holds), event-based (decaying, persistence scales with tier — a Veto break outlasts minor insults), structural (standing, no prior justification: nationalism/long-lasting claims, militaristic disposition).
16. CB overreach is a per-observer Reputational Leverage penalty scaled by the observer's closeness to the victim — never global.
17. Below-threshold Diplomacy/Espionage actions are binary with no refund; thresholds are fixed per type/tier and scaled by the target object's parameters, never by the opponent's empire size.
18. DomainVeto is an axis in the shared menu; Confederation is a symmetric bundle with mutual consent and no teeth beyond the axes' own effects.
19. Leverage Categories are derived readouts with no stored aggregate; weighting happens only at an AI decision.
20. Every Diplomacy/Espionage action type declares its own target-scale parameter.
21. A negotiation has no fixed term; either side may withdraw at any time, and a later negotiation starts completely from scratch (2026-11-10).
22. The other side's satisfaction and walk-out threshold are shown as a meter — exact in alpha, a fog-of-war estimate once fog-of-war exists (2026-11-10).
23. Withdrawing leaves a decaying Reputational Leverage mark only when the withdrawing Country is the stronger party by the Leverage-readout comparison; the mark is cached and re-derivable, never spendable (2026-11-10, sign and holder proposed).
24. Every action in the catalogue has one direction: positive 0–100, hostile −100–0, or named tiers, with optional duration; a positive and a negative action on the same parameter are separate actions (2026-11-10).
25. Embargo is the single trade-sanction action: strength −100–0, target the entire Country or chosen Regions, goods all or chosen; Tariffs replace the Sanction tiers, and uneven mutual tariffs are a derived relationship readout that can open a Grievance-tier CB (2026-11-10; tariff-asymmetry details proposed).
26. Alliance actions are separate: Benevolent Neutrality → Defensive Pact → Standing Offensive form a chain in which a higher link covers and disables the lower ones during negotiation; Coalition (and Guarantee) are independent (2026-11-10).
27. Improve Relations adds a decaying modifier to the Government-to-Government `opinion`; repeating it refreshes the modifier to full and never stacks; it is not propaganda (2026-11-10).
28. Show of Force is not a diplomatic action; it is derived from troop deployment (`war__kb.md`, 2026-11-10).

## Cross-references
- **Internal Politics** — Ratification/Veto reads IP's `treaty` Veto domain directly; Foreign Standing is a per-(cell, foreign Country) derived value (Nation Sympathy + cell-specific terms); propaganda and covert influence write into the cell-specific terms; nothing aggregates back into Sympathy. The Domain checklist of Demand a Say in Domestic Law reads IP's Veto domain list.
- **Nations** — kin-state Sympathy baseline (non-decaying, live-recomputed off titular declaration); spent-resource soft power is a decaying standing-modifier. The kin-state toolkit has no separate mechanic (2026-11-02).
- **Economics** — TradeAccess/ResourceExportBan read `throughput_cap` directly (Embargo scales it); Impose Tariff / Tariff Exemption set tariff rates whose mechanics Economics owns (alignment proposed); LaborMigrationBan exposes the open "external pool recruitment" question.
- **Administration** — Covert Faction Influence targets the settled Actor-cell model (`administration__kb.md` + `internal_politics__kb.md`) — re-verified 2026-11-01; Observation there contributes additively with counter-intelligence Espionage to detection (2026-11-02).
- **War** — Show of Force (formerly Troop Training) feeds this file's Military Leverage category; the Peace Conference reuses the Negotiation Session and builds proposal stacks inside it; Declare War / Propose Peace are War's; see `war__kb.md`.
- **UI** — the negotiation meter and the Withdraw warning render this file's Negotiation Session; the action catalogue renders in the Treaties tab (`ui__kb.md`, 2026-11-10).
- **Characters** — Succession axis, Common Ruler axis, ruler-deposition event: post-alpha (Characters beyond alpha).
- **AI — Diplomacy** — owns Leverage instrument selection/combination, weighting from the Portrait, coalition-backing relevance.
- **Fog of war** — deliberately deferred as a separate turn-flow layer; the negotiation meter is its first consumer here (exact in alpha).

## Status
- CB tiers, overreach concept, external-recognition flag, Reputational Leverage, Axis-Bundle system, Cooperation, Facilitation grants, fixed-threshold action model: **settled**.
- Leverage weighting, coalition-backing relevance: **owned by AI-Diplomacy, not this file**.
- CB overreach penalty curve shape, oppression-CB severity scaling: **open, deferred** (numbers pass). Below-threshold behavior, threshold scaling, Confederation's national-politics axis (now DomainVeto): **settled 2026-11-02**.
- Covert Faction Influence & Foreign Propaganda: **settled shape 2026-11-01**.
- Succession axis, Common Ruler axis, ruler-deposition event: **post-alpha (Characters beyond alpha)**.
- **Leverage Categories (Economic/Diplomatic/Military/Cultural split)**: readouts and weight source settled 2026-11-03; weighting function owned by AI-Diplomacy.
- **2026-11-01 overhaul — settled**: foreign propaganda as Espionage-threshold per Region; overt exports sender's Portrait, covert any point; attribution via awareness × causal visibility with CB on detection; Cultural Leverage derived from culture pools + preference alignment; kin-state appeal opens the Oppression-of-a-Nation CB; CB wording drops the Portrait motive.
- **2026-11-01 — open**: whether Cultural Leverage scores from pool output (input side) or realized alignment (output side); foreign-propaganda magnitude/threshold values (numbers pass).
- **2026-11-02 — settled**: detection = Observation + counter-intelligence Espionage (additive); sender revealed at a higher separate threshold; false flags possible for strong-Espionage countries. False-flag exposure costs Reputational Leverage and a CB; no limits on the implicated party (confirmed). **Open**: thresholds (numbers pass).
- **2026-11-02 (Countries/Diplomacy pass) — settled**: CB persistence classes; per-observer overreach penalty; binary below-threshold with target-scaled thresholds; DomainVeto axis; Confederation as a symmetric bundle with no teeth; Leverage Categories as readouts.
- **2026-11-03 — settled**: Concert as a derived great-power-backing predicate; Government-to-Government standing (`opinion`); Leverage weights from the Portrait with the override trigger; militaristic-disposition derivation; per-action target-scale parameter; Annexation as a forced-annexation CB; per-observer attribution.
- **2026-11-10 — designer input (settled as answered)**: negotiations have no fixed term and either side may withdraw at any time, after which negotiation restarts from scratch; the other side's satisfaction is shown as a meter (exact now, fog-of-war estimate post-alpha); withdrawal leaves a decaying mark that feeds Reputational Leverage of the stronger Country when it is the one that withdraws. **Proposed (awaiting OK)**: the mark's sign (negative) and holder (the stronger Country's own stack toward the other party); the session covering the Peace Conference too. **Open**: satisfaction function details and walk-out threshold values (numbers pass).
- **2026-11-10 (later) — Action Catalogue, designer input (settled as answered)**: one direction per action (positive 0–100, hostile −100–0, tiers, duration), positive and negative split into separate actions; **Embargo** (strength, entire Country or chosen Regions, all goods or chosen goods) replaces Trade Sanctions; **Tariffs** replace the Sanction tiers and uneven mutual tariffs can turn into grievances; Alliance actions as a Military subsection, five separate actions with the Benevolent Neutrality → Defensive Pact → Standing Offensive chain (higher covers and disables lower in negotiation) and **Coalition independent**; **Improve Relations** confirmed (decaying opinion modifier; repeating refreshes, never stacks); **Show of Force** confirmed as non-diplomatic (derived from deployment). **Proposed (awaiting OK)**: the agreement / unilateral / demand kinds; Guarantee as independent; the tariff-asymmetry readout and its state-based Grievance CB; alignment of Impose Tariff / Tariff Exemption with Economics' tariff mechanics; Embargo and tariffs as the same Sanction record. **Open**: a hostile counterpart to Improve Relations; Improve Relations' target-scale; every parameter value and threshold (numbers pass); `narrative` text for each action.
