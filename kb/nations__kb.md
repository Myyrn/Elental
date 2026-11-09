# Nations — Knowledge Base

Status: core cultural/demographic mechanics settled, incl. Region-fracture
population-split rule. Co-titular support, kin-state toolkit (dissolved), Nation pool affinity and
assimilation transfers settled 2026-11-02 (Triangle retired 2026-11-01; the
political Preference vector lives in Internal Politics).

## Data Structures

### Nation
Cultural/ethnic people defined by shared language/culture/religion/
tradition — not tied to territory or statehood.

### Population Presence
Per-province, per-Nation population share (minority/diaspora tracked
identically to majority, at lower share). Ground truth World Map's
Region-fracture split reads.

### Core (emergent, computed)
```
core_strength(nation, province) = f(population_count, concentration/share)
influence(nation, province) = core_strength × decay(distance_from_core)
```
Multiple simultaneous cores supported; drift with migration/growth/
colonization/assimilation — no fixed "homeland" stored. Divided-nation
scenarios are emergent.

### Titular Nation (set, settled 2026-11-02)
Country-level declared policy (owned by Countries), not automatic majority.
Live/changeable. **Several Nations may be titular; no cap.**
```
titular_effects(nation) = { Prestige+ on declaration (a decaying modifier on the Nation's cells' Prestige stack),
                            Identity+ only while the Nation's cultural need is actually met }
non_titular_cost(other_nation) ∝ size × concentration
```
No new cost rule: Culture, Teaching and Print output is zero-sum, so funding more languages spreads it thinner, and each remaining non-titular Nation still pays its size × concentration cost. A bare declaration gives Prestige only; the Identity bonus requires delivered cultural output (Economics' non-material consumption channel).

### Sympathy (computed, not stored)
```
sympathy(nation, country) = base_need_satisfaction(nation, country) + Σ standing_modifiers(decaying)
```
Independent per (Nation, Country) pair. Internal Politics' per-cell Foreign Standing reads this value as its base; nothing is aggregated back into Sympathy.

### Reaction Temperament
Per-Nation trait: reaction magnitude to treatment — independent of
distance-from-core (distance affects distinctiveness, not magnitude).

### Nation pool affinity (settled 2026-11-02)
Besides Reaction Temperament (magnitude) and the political Preference baseline
(Internal Politics), a Nation carries a **pool affinity**: per-pool multipliers
that bias Teaching conversion into that pool and the default labour profile
(e.g. a steppe people lean toward Cavalry). It is data on existing quantities,
not a new mechanic. No further non-political traits.

### Assimilation Drift
```
passive_drift = f(local_sympathy, distance_from_nearest_core, relative_cultural_weight_of_dominant_local_nation)
active_policy = suppress | accommodate | fund_culture | language_policy
```
Suppression carries a mandatory Identity/Autonomy cost — not a dominant
free strategy. **Transfer rule (settled 2026-11-02)**: assimilating population
moves into the dominant Nation's cell of the **same Estate and Region**, carrying
pro-rata stocks (as in the Region-split rule); its Preference baseline shifts
gradually through a decaying modifier. Funding a culture counteracts the drift.

### Statehood Pathway
Stateless Nation + concentrated population + low sympathy + internal
pressure → autonomy → independence. Feeds Countries' Formation-via-secession.

## Rules
1. Cores always computed at read-time, never stored as fixed homeland.
2. A Nation can hold multiple cores, independently strength/decay-computed.
3. Titular status is a ruler policy choice with symmetric trade-offs.
4. Sympathy is always Nation×Country-pair-specific.
5. Standing modifiers decay absent reinforcing events.
6. Reaction Temperament scales response magnitude only, not influence-decay.
7. Assimilation = passive drift + active policy; suppression's cost is mandatory.
8. Statehood Pathway and Internal Politics' Faction-rebellion are the same underlying event, viewed from different lenses; the international-recognition route (Countries) is its foreign-facing side.
9. **Region-fracture population-share rule**: Nations' population-presence data is the mandatory divisor when World Map splits Region-level actor stocks on partial conquest; Nations supplies the numbers, World Map computes the split.
10. Several Nations may be titular; the Identity bonus requires delivered cultural output, a bare declaration gives Prestige only.
11. Nation pool affinity biases Teaching conversion and default labour profile; no other non-political traits.
12. Assimilating population transfers to the dominant Nation's cell of the same Estate and Region with pro-rata stocks.

## Cross-references
- **World Map** — province substrate for presence/core computation; consumes this data for Region-fracture splitting.
- **Countries** — titular Nation is a Country-level policy; Statehood Pathway feeds Formation/secession lifecycle.
- **Internal Politics** — owns Identity/Autonomy/Solidarity need math; Nations supplies per-Nation disaggregation. Actor cells resolve at `(Nation, Estate, Region)` — Nations' data stays province-level regardless. Cell Preference vectors over Portrait axes (2026-11-01) are the first political trait/mentality vocabulary; Reaction Temperament stays magnitude-only.
- **Diplomacy** — kin-state toolkit has no separate mechanic (2026-11-02): it is covered by foreign propaganda, Cultural Leverage, Facilitation Grants, the kin-state appeal, the kin Sympathy baseline and migration (World Map).
- **Characters** — notable figures' Nation identity, not yet designed.

## Status
- Core/presence/sympathy/temperament/assimilation/statehood-pathway shape, Region-fracture divisor rule: **settled**.
- Core-strength/assimilation-drift formula coefficients, standing-modifier decay rate, (numbers pass).
- **2026-11-02 — settled**: co-titular support (set, no cap, Identity bonus conditional); kin-state toolkit dissolved; Nation pool affinity; assimilation transfer rule.
- **2026-11-03 — settled**: Sympathy is the base of Internal Politics' Foreign Standing (no reverse aggregation); titular declaration gives a Prestige modifier.
