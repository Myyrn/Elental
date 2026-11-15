# Countries — Specification

KB: `kb/countries__kb.md`. Mirror of its `##/###` headings; cross-references live in kb only. Bootstrapped 2026-11-14 from kb rev 1 and `src/` (there is **no Countries module**: a Country is a record in `state.countries`, ownership lives on provinces, relations live in `state.diplomacy` and `state.war`, so this spec mostly points at the owning files). Sources: `src/data/loaders/buildState.js`, `src/modules/diplomacy/{common,readouts,treaties,actions,module}.js`, `src/modules/war/internal.js`, `src/modules/worldmap/module.js`, `src/modules/ai/diplomacy/reads.js`, `tests/diplomacy.test.js`, `tests/internal_conflict.test.js`; Diplomacy details in `diplomacy__spec.md`, scenario schema in `scenario_schemas__spec.md`. Where code and the old `modules__spec.md` text disagree, **code wins** (**code-led**; the Countries text there is superseded). Anything the kb does not state is **(spec decision)** (pending OK); not-yet-written code is **(target)**.

## Data Structures

State and conventions:
```js
state.countries = Record<CountryId, {name, color, titularNations: NationId[], isPlayer: boolean, aiProfile: string|null, formedFrom?: CountryId, formedTurn?: number}>
state.world.provinces[p].owner = CountryId | null            // single source of truth for territory; Regions are derived from it (worldmap, step 8)
state.admin.governments[country], state.polity.law[country]  // one record each, created with the Country (internal.js on secession; scenario for the rest)
state.diplomacy = {treaties, cbs, leverage, covert, grants, proposals, recognition, claims}       // diplomacy/common.js makeDiplomacyState
state.war = {units, armies, wars: [{a, b, goals, internal?, chained?...}], score, sieges, occupations, blocs, seq}
countryIds(ctx) = Object.keys(state.countries);   regionOwner(region) = state.world.regionSnapshot.owners[region] (worldmap derive)
T = ctx.T            // every number is a tuning key
```

### Country
Code: `state.countries`, `state.world.provinces[p].owner`, `worldmap/module.js` (`regionOwner`, `regionProvinces`), `diplomacy/readouts.js` (`power`)
```js
territory(c)  = { p : state.world.provinces[p].owner === c }                          // derived by filtering; no stored set (no helper in code yet)
population(c) = Σ cell.population over cells with regionOwner(cell.region) === c       // as in diplomacy `power`; identity breakdown = Nations presence
capital(c)    = highest-gravity province of c   // target — no capital derive in src (grep: none); Region capitals are a separate stored setting (World Map)
government(c) = derived readout only (see Government); standing(c) = derived readouts only (Diplomacy `reputation`, `leverage`; Prestige per cell: Internal Politics)
relations(c)  = RelationState entries keyed by pair (below)
```
- Empire = Country: no code distinguishes sizes; Rights/Duties, Government and Ledger records are per Country id.
- `isPlayer` (exactly one in alpha, a warning otherwise: `scenario_schemas__spec.md`) and `aiProfile` are scenario data read by the AI (`ai/diplomacy/reads.js`); `formedFrom`/`formedTurn` are written by secession only.
- Countries own statehood, never peoplehood: Nations data stays in `state.nations` (`nations__spec.md`).

### RelationState (per country-pair, bilateral, no global tension metric)
Code: no stored pair object — the pieces live in `state.diplomacy` (`claims`, `cbs`, `leverage`) and `state.war.wars[].goals`; derived readouts in `diplomacy/readouts.js`
```js
claims:  state.diplomacy.claims = [{holder, target, province}]                                   // long-lasting; a structural 'claim' CB while target still owns the province
cbs:     state.diplomacy.cbs = [{id, holder, target, tier, reason, mods}]  +  derived state/structural CBs (activeCBs)       // Diplomacy owns resolution
goals:   state.war.wars[i].goals = [{type: 'tribute'|'cede'|'dependency'|'annex', ...}]          // declared war goals of the pair, judged against the best CB (overreach)
opinion: Government-to-Government Foreign Standing — NOT in code (the AI reads ctx.derive.countries?.opinion, which no module provides, then falls back to ruleset.aiDiplomacy.initialOpinion[`a>b`])
relationState(a, b) = { opinion, claims: claims where holder a / target b (and reverse), goals: wars between the pair, casus_belli: activeCBs(a, b) }       // target accessor (spec decision), derived, never stored
```
- **(code-led)** the kb's `RelationState` is a conceptual view; no per-pair record exists. Escalation is never a global meter: it is the emergent sum of bilateral entries (Rule 2); `closeness(observer, victim)` (`readouts.js`) is a per-observer readout, not a stored number.
- Pair keys for stacks: `pairKey(observer, subject) = 'observer>subject'` (`diplomacy/common.js`).

### Sovereignty & Dependency (freeform social-contract model)
Code: `state.diplomacy.treaties` with `kind: 'Dependency'` `{id, subject, overlord, axes: AxisGrant[], status, since}`; `diplomacy/readouts.js` (`axisGrants`, `grantsOver`), `diplomacy/treaties.js`, `diplomacy/actions.js` (`proposeTreaty`, `answerProposal`, `denounceTreaty`); gating hook `diplomacy.foreignVetoes` (engine `gate()`)
```js
dependency(subject, overlord) = the active treaty of kind 'Dependency'; axes = Diplomacy's single Axis Bundle (diplomacy__spec.md)
axisGrants(ctx): Dependency → grantor subject, grantee overlord, per axis;  DomainVeto axis → overlord holds a Veto over named Rights/Duties domains of the subject
// target readout (derived, never stored; spec decision for the aggregation):
satisfaction(subject, overlord) = weightAggregate(subject's cells' Foreign Standing toward the overlord) + (benefits − burden of the ceded axes) + visibleRivalOffers
```
- Renegotiable any time (proposals), never a fixed tier; the dependent is a full entity, constrained only on ceded axes.
- **Not in code**: `satisfaction` (feeds the dependent's factions and Questions, notably Identity/Autonomy; **never an automatic exit trigger**), Foreign Standing it reads, rival offers, and the religion axis (deferred; `legal_system` dropped, `government_form` replaced by DomainVeto — in code the axis menu is Diplomacy's).
- **Titular-survives-dependency**: no code path changes `titularNations` at all, so the default holds trivially; the forced change when `culture/language` is a ceded axis needs the titular setter (`nations__spec.md`, target).

### Confederation (settled 2026-11-02)
Code: `state.diplomacy.treaties` with `kind: 'Confederation'` `{parties, axes}`; `readouts.js` (`treatyTier` = 'Confederation', `warForbidden`, symmetric `axisGrants`); `treaties.js`
- Symmetric bundle: each member grants the same axes to every other member, changes need mutual consent (proposal flow), no overlord, no central authority. War between members is forbidden (`warForbidden`, same as non-aggression alliances). No teeth beyond the axes' own effects: a broken promise costs Reputational Leverage (`addReputation`, a breach on the treaty).
- Scenario seeding: `relations.confederations[]` in the scenario (`makeDiplomacyState`). Tested in `tests/diplomacy.test.js` (test names not re-verified).

### Country Lifecycle
Code: partial — secession in `war/internal.js`; recognition in `diplomacy/actions.js` (`recognizeBloc`, `state.diplomacy.recognition`); treaty-based Dependency/Confederation moves in `diplomacy/treaties.js`
```js
Formation:   secession (code)  — a winning rebel bloc → state.countries['free-<bloc.id>'] = {name: `Free ${nation}`, titularNations: [largest Nation of the bloc], formedFrom: parent, formedTurn};  governments[id] fresh;  law[id] = copy of the parent's;  held provinces change owner;  Regions re-derive at step 8
             settlement-reaches-statehood, Nation-independence (target): the same event seen from the Statehood Pathway (nations__spec.md); criteria for Formation to complete are open in kb
Dissolution: collapse = outcome of internal armed conflict or a Peace Conference result (no timer); absorption = annexation goals in a Peace Conference (War)        // no code path deletes a Country: none found in src (the only write to `state.countries` is the secession above)
Merger:      event gated by the members' `treaty` Veto and the Nations present — NOT in code (target: `mergeCountries`, event, gate `treaty`; spec decision)
Dependency:  enter/renegotiate/exit = proposeTreaty / answerProposal / denounceTreaty (code)        Confederation: join/leave = the same proposal flow (code)
Recognition: recognizeBloc(rebels) by a foreign Country → state.diplomacy.recognition, CB against the parent (cb.mag.recognize), enables Facilitation Grants/Coalition (code); what recognition changes mechanically beyond that is open in kb
```
- **(code-led)** an emptied Country (all provinces lost) is not removed, merged or flagged; `countryIds` still lists it.
- Triggers of the recognition route (an independence goal from a too-large cultural-identity grievance, or Government refusal read from live state) are **not** checked in code: any Country may recognize a bloc.

### Government (Triangle retired; Institutional↔Personalistic derived — 2026-11-01)
Code: none (the Government *record* — Ledger, dials — is Administration's, `state.admin.governments`); no readout service
```js
// target — display only, never stored, never read back as an input (Rule 5); formula is (spec decision), coefficients numbers pass
institutionalIndex(c) = weightedShare of cells holding Council or Veto Rights (polity `right`) + share of Control spending on the Country's cells vs Government-only items       // derived from existing Rights/Control state
```
- The Republic/Feudal/Theocracy Triangle is retired (an analogy, not a game rule); legitimacy-like effects come from Preference baselines and Fairness (Internal Politics). No service named `derive.countries` exists; when written it would also host `opinion` and `satisfaction`.

## Rules
Code: per-rule notes
1. Statehood in `state.countries`/ownership, peoplehood in `state.nations`; no cross-writing.
2. No global tension meter exists (none in code); pair data stays bilateral.
3. Dependency is a treaty record with an axis list, renegotiable; `satisfaction` is a target readout, never an exit trigger.
4. Confederation is a symmetric treaty without authority (`kind: 'Confederation'`, tested).
5. Government readout: not in code; must stay derived and unread.
6. Empire = Country: no size tier anywhere in code.
7. Titular status unchanged by Dependency (trivially true: no setter exists).
8. Recognizing or supporting a rebel polity is CB-generating (`recognizeBloc` → CB; chaining through the treaty graph in Diplomacy).
9. One Axis Bundle (Diplomacy); DomainVeto via `foreignVetoes`.
10. Collapse as outcome of armed conflict/Peace Conference: secession is the only implemented outcome; recognition route exists without its triggers.

## Status
- **Implemented**: `state.countries` records; ownership as the territory source; Dependency/Confederation as treaty records with axis grants and the proposal flow; claims and CBs in `state.diplomacy`; war goals in `state.war.wars`; secession-formed Countries; recognition of rebel blocs.
- **Not in code**: `capital`, `opinion`, `satisfaction`, `relationState` accessor, Government readout, Merger, Dissolution/absorption cleanup of emptied Countries, titular setter and forced-change rule, recognition triggers, `derive.countries` service, the religion axis.
- **(code-led)**: no per-pair RelationState record; emptied Countries persist; any Country may recognize a bloc; the Axis menu is Diplomacy's.
- **(spec decision)**: `relationState` as a derived accessor; `satisfaction` aggregation as the kb states it (weights = polity `weight`); `mergeCountries` event name and gate; `institutionalIndex` formula; `derive.countries` as the home of `opinion`, `satisfaction`, `relationState`, `governmentReadout`.
- **Open (kb)**: what recognition changes mechanically; Formation completion criteria; CB generation details (`diplomacy__kb.md`); religion axis (after Faith/Cosmology).
- **Tuning keys** (existing): `cb.mag.recognize`, `closeness.*`, `overreach.*`; none new.
- **Sync:** (`<section> = <kb rev> / <code rev>`; `-` = no or insufficient code+tests; `1` = code and a test file present, names not re-verified)
  - Data Structures > Country = 1 / -
  - Data Structures > RelationState (per country-pair, bilateral, no global tension metric) = 1 / -
  - Data Structures > Sovereignty & Dependency (freeform social-contract model) = 1 / -
  - Data Structures > Confederation (settled 2026-11-02) = 1 / 1
  - Data Structures > Country Lifecycle = 1 / -
  - Data Structures > Government (Triangle retired; Institutional↔Personalistic derived — 2026-11-01) = 1 / -
  - Rules = 1 / -
