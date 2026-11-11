# Elental — Changelog

New entries go here (one section per change, header = title and date), per the edit flow in `index.md`. Earlier entries still live in the `index.md` Changelog section.

## Army composition, second pass — 2026-11-11
Committed directly to `main` at the designer's request. Files touched: `kb/war__kb.md`.

**Settled (designer input)**
- **Sorting templates**: player-authored, any number of them, chosen whenever the player deploys or changes an army's composition. Rule vocabulary: `take_all(pool)`, `take_share_of_remaining(pool, f)`, `fill_ratio({pool: weight})`.
- **Default template**: 20% Vanguard / 60% Center / 20% Rearguard. Vanguard takes all Cavalry, then Skirmishers : Shock Infantry 2 : 1 until full. Rearguard takes 30% of the remaining Cavalry, then Skirmishers : Shock Infantry : Pike Infantry 3 : 1 : 1 until full. Center takes everything left.
- **Contingent generation**: a pool under 10% of the cell's total troops is not deployed; Artillery, Siege Corps and Mages are exempt. The Retinue boost raises pool generation, so it feeds the pool share indirectly.
- **Merge**: same owner, same province, and every detachment's depth within a speed-based tolerance (quicker troops, larger tolerance; terrain and obstacles post-alpha). **Split**: new army starts at the same position with the parent's depths. Both are Commitments.
- **Reassign** Contingents between detachments while their depths are within tolerance.
- **Stance** is set automatically per Contingent; **tactic** is set per detachment.
- **Rearguard duties**: intercepts Vanguard raids on supply routes, prevents encirclement, keeps broken or retreating main forces in order.

**Proposed (awaiting the designer's OK)**: cutting a Contingent at a capacity boundary when sorting; behaviour when a pool in a ratio runs out; the speed basis of the tolerance; troop-weighted average depths after a merge; the Rearguard interception contest reusing `screening_strength`.

**Open**: the rule that picks a Contingent's automatic stance; whether `entry_side`/`route_side` must match for a merge; whether choosing a template again overrides manual reassignments; whether templates belong to the Country or the player; numbers for Rearguard encirclement prevention and Rout ordering; `tol_base`.

**Not yet done**: spec (`admin_war_diplomacy__spec.md`), code (`fieldUnits` still takes an explicit composition; `fight()` ignores detachments; tactic is per army), tests, `ui__kb.md`, `.outline/`.
