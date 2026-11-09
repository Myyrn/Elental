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
- **State-based**: persists while the grounding fact holds, with no timer (an unremedied breach, occupied territory, a blocked edge).
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
compliance (±), rejecting a coalition-backed demand (− only vs. that coalition's supporters, never global)
```
Never a freely-spent independent currency.

### Great-power backing (derived — replaces "Concert", 2026-11-03)
"Concert" is a metaphor: no body, no vote, no entity. International order is the web of lateral treaties plus the weight of the strongest Countries.
A Sanction or Coalition is **great-power-backed** when its imposers include a sufficient share of the strongest Countries, ranked by the Military and Economic
Leverage readouts. "Great-War-chain" means propagation through the alliance/treaty graph only — no global tension metric (cross-module notes).

### Government-to-Government standing (settled 2026-11-03)
`RelationState.opinion` = Government-to-Government Foreign Standing (Internal Politics, derived: the Weight-aggregate of the powerful cells' Foreign Standing toward the other Country + alignment between this Government's amalgam and the other's observed Portrait). It is distinct from Reputational Leverage (external belief about conduct) and from Sympathy (Nation × Country).

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
- **Military category feed**: fed in part by War's Troop Training action
  (see `war__kb.md`) — a decaying modifier from border-adjacent exercises
  vs. a specific Country/Bloc. Stacks with War Exhaustion and other
  active-war Military Leverage penalties; does not replace them.
- **Cultural category (derived — settled 2026-11-01)**: sourced from the
  Country's culture-associated labour pools (Teaching, Culture — printing/
  distribution, cultural propaganda) directed at the target; realized as the
  Weight-aggregated alignment of the target's cell Preference vectors to this
  Country's observed Portrait. The other categories likewise read existing
  data: Economic from trade dependency (throughput), Military from War
  (Troop Training, exhaustion readout), Diplomatic = the Reputational stack.
- Aggregation formula, per-category computation (beyond Military's War-kb
  feed), country-profile-driven weighting, threshold trigger condition:
  **open, implementation-deferred**.

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
| Trade access | forced tariff-exemption or embargo vs. third party |
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

## Cross-references
- **Internal Politics** — Ratification/Veto reads IP's `treaty` Veto domain directly; Foreign Standing is a per-(cell, foreign Country) derived value (Nation Sympathy + cell-specific terms); propaganda and covert influence write into the cell-specific terms; nothing aggregates back into Sympathy.
- **Nations** — kin-state Sympathy baseline (non-decaying, live-recomputed off titular declaration); spent-resource soft power is a decaying standing-modifier. The kin-state toolkit has no separate mechanic (2026-11-02).
- **Economics** — TradeAccess/ResourceExportBan read `throughput_cap` directly; LaborMigrationBan exposes the open "external pool recruitment" question.
- **Administration** — Covert Faction Influence targets the settled Actor-cell model (`administration__kb.md` + `internal_politics__kb.md`) — re-verified 2026-11-01; Observation there contributes additively with counter-intelligence Espionage to detection (2026-11-02).
- **War** — Troop Training feeds this file's Military Leverage category; see `war__kb.md`.
- **Characters** — Succession axis, Common Ruler axis, ruler-deposition event: post-alpha (Characters beyond alpha).
- **AI — Diplomacy** — owns Leverage instrument selection/combination, weighting from the Portrait, coalition-backing relevance.
- **Fog of war** — deliberately deferred as a separate turn-flow layer.

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
