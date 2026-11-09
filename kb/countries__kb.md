# Countries — Knowledge Base

Status (2026-11-02 pass: Dependency satisfaction readout, unified axis menu,
Confederation, recognition route): core entity/relations/dependency/lifecycle/government model
settled, incl. Empire=Country equivalence and titular-survives-dependency
default. Dependency satisfaction is a settled derived readout; CB details live in Diplomacy. (Government
Triangle retired; Institutional↔Personalistic is a derived readout — 2026-11-01.)

## Data Structures

### Country
```
country = {
  territory: set<province>, capital,        // capital = highest-gravity province
  government: (derived readout only; nothing stored),   // Triangle retired 2026-11-01
  standing: (derived readout only; nothing stored — Reputational Leverage and Leverage Categories per pair (Diplomacy), Prestige per cell (Internal Politics)),
  population: aggregate (identity breakdown owned by Nations),
  relations: { other_country: RelationState }
}
```
Countries owns statehood, not peoplehood. **Empire = Country**: no
scale-based governance tier exists — Government/Rights/Duties/etc. apply
identically regardless of size.

### RelationState (per country-pair, bilateral, no global tension metric)
```
RelationState = { opinion, claims: set<claim>, goals: set<goal>, casus_belli: set<CB> }
```
Deeper resolution mechanics owned by Diplomacy; Countries holds the data structure. `opinion` = Government-to-Government Foreign Standing (derived, Internal Politics; settled 2026-11-03). `goals` = the war goals declared in an active or pending conflict between the pair (War declaration), judged against the CB tier for overreach (settled 2026-11-03). "How close to war" is a distributed relationship-graph
property, never a single global number.

### Sovereignty & Dependency (freeform social-contract model)
```
dependency(subject, overlord) = { axes: AxisGrants }     // Diplomacy's Axis Bundle — one shared menu
satisfaction(subject, overlord) = derived readout, never stored:
    the subject's cells' Foreign Standing toward the overlord, Weight-aggregated   (Internal Politics; already contains the Nations' Sympathy)
  + material balance: benefits − burden of the ceded axes        (trade, protection, Duties)
  + visible rival offers
```
Renegotiable at any time, not fixed at creation. **`satisfaction` is a derived
readout (settled 2026-11-02)** that feeds the dependent's factions and Questions
(notably the Identity/Autonomy bucket) and its own player/AI decisions — it is
**never an automatic exit trigger**. Exit happens through the usual acts:
renegotiate, rebel (Statehood Pathway), or declare independence. A dependent
Country remains a full entity, constrained only on ceded axes.

**Axis menu (settled 2026-11-02)**: Countries uses Diplomacy's Axis Bundle; no
separate list. `government_form` is replaced by the **DomainVeto** axis (the
overlord holds a Veto over named Rights/Duties domains of the subject, reusing
Internal Politics' consent gating). `religion` is deferred until Faith/
Cosmology is designed; `legal_system` is dropped.

**Titular-survives-dependency**: a Country's titular Nation declaration
survives entering dependency by default; overlord can force a change only
if `culture/language` is a ceded axis.

### Confederation (settled 2026-11-02)
Treaty-bound alliance of nominal equals, **no shared central authority** —
distinct from Dependency. It is a **symmetric axis bundle**: each member grants
the same axes and changes need mutual consent; there is no overlord. **It has
no teeth** beyond the axes' own effects (a broken promise costs Reputational
Leverage like any other).

### Country Lifecycle
```
Formation      ∈ { settlement-reaches-statehood, secession, Nation-independence }
Dissolution    ∈ { collapse, absorption }
Merger         — unification of two or more Countries
Dependency     — enter / renegotiate / exit
Confederation  — join / leave
```
- **Collapse** has no timer or trigger of its own: it is an outcome of internal armed conflict (War) or a Peace Conference result. **Merger** is an Event gated by the members' Rights (the `treaty` Veto) and by the Nations present (settled shape 2026-11-02).
- **International recognition route (settled shape 2026-11-02)**: rebels (a faction or bloc) may appeal to foreign Countries for recognition as a polity. They take this route when (a) their goal is independence (Formation-via-secession) — arising as an initial goal when a cultural-identity grievance (Identity/Autonomy bucket) is too large for cultural autonomy alone to settle, or (b) they conclude the Government will not meet their requirements — read from live state (the Question stays unaddressed or refused), never from intent. Foreign Countries decide whether to recognize (Event). Recognition gives rebels external legitimacy and Foreign Standing among recognizers, enables support (Facilitation Grants, Coalition) and is CB-generating against the parent Country (Rule 8). Unrecognized rebels fight alone. Open: what recognition changes mechanically and the criteria for Formation to complete.

### Government (Triangle retired; Institutional↔Personalistic derived — 2026-11-01)
The Republic/Feudal/Theocracy Triangle is **retired**: a real-world analogy,
not a game rule. Legitimacy-like effects emerge instead from Estate
world-view baselines (Internal Politics Preference vectors) and Fairness.
Institutional↔Personalistic is no longer a stored axis: it is a **derived
readout** of Rights/Control configuration (Council and Veto Rights held,
Control spending) that nothing reads back as an input. Countries exposes it
for display only.

## Rules
1. Countries owns statehood; Nations owns peoplehood — never conflate.
2. Escalation is never a global meter — the emergent sum of bilateral RelationState entries.
3. Dependency is a freeform renegotiable axis bundle, never a fixed tier; `satisfaction` is a derived readout feeding the dependent's factions and decisions, never an automatic exit trigger.
4. Confederation retains full sovereignty, bound only by treaty, no central authority; a symmetric axis bundle with no teeth beyond the axes' own effects.
5. The Government Triangle is retired (an analogy, not a game rule); Institutional↔Personalistic is a derived readout of Rights/Control configuration, never stored or read as an input (2026-11-01).
6. Empire and Country are the same entity.
7. Titular Nation status survives dependency by default; only ceding culture/language permits forced change.
8. Supporting a foreign Nation's secession bid is CB-generating against the Country losing territory; alliance/confederation obligations can chain it wider via the treaty graph. Recognizing a rebel polity is such support.
9. Countries use Diplomacy's single Axis Bundle; `government_form` is replaced by the DomainVeto axis.
10. Collapse is an outcome of internal armed conflict or a Peace Conference, never a timer; rebels may take the international-recognition route.

## Cross-references
- **World Map** — territory is a province set; expansion gated by settlement/habitability.
- **Nations** — titular Nation is a Country-level policy; sympathy feeds `satisfaction` via Foreign Standing; Statehood Pathway feeds Formation-via-secession.
- **Internal Politics** — legitimacy-like effects emerge from Estate world-view baselines (Preference vectors) and Fairness, not from a Country-level Triangle (retired 2026-11-01); IP supplies stability/legitimacy back.
- **Diplomacy** — owns deeper Opinion/Claims/CB resolution; Countries holds only RelationState.
- **Administration** — governs how effectively stated policy implements across territory, especially for dependents.
- **War** — consumes CB/RelationState as prerequisites; Annexation/occupation-removal are Countries-level state changes.
- **Economics** — reads territory/population; feeds back leverage/wealth.

## Status
- Country entity, RelationState, Sovereignty & Dependency, Confederation-vs-Dependency distinction, Lifecycle, Triangle retirement and derived Institutional↔Personalistic readout (2026-11-01), Empire=Country, titular-survives-dependency: **settled**.
- **2026-11-02 — settled**: Dependency `satisfaction` as a derived readout (no exit trigger); unified axis menu with DomainVeto replacing `government_form`; Confederation as a symmetric bundle with no teeth; collapse as an outcome of armed conflict/Peace Conference; Merger as a gated Event; international-recognition route for rebels (shape).
- **2026-11-02 — open**: what recognition changes mechanically and Formation completion criteria; CB generation details (see `diplomacy__kb.md`); `religion` axis (after Faith/Cosmology).
- **2026-11-03 — settled**: `standing` is a derived readout; `satisfaction` uses Foreign Standing only; recognition triggers (initial independence goal from a too-large cultural-identity grievance, or Government refusal read from live state); `opinion` = Government-to-Government Foreign Standing; `goals` = declared war goals.
