# AI — War — Knowledge Base

Status: first pass, 2026-11-11. **Minimal alpha interface only** (designer input: AI-War keeps minimal hooks while AI-Diplomacy carries the alpha demonstration). Written from `kb/ai_diplomacy__kb.md` Rule 5 and the stance/tactic notes in `kb/war__kb.md`; there was no `ai_war` doc or kb before. **Everything beyond those two sources is tagged (proposed)** and awaits the designer's OK.

## Data Structures

### Principles
- **Same surface as the player.** The AI moves armies, fields units and sets tactics only through the War actions the player has (`fieldUnits`, `orderMove`, `setTactic`, `declareWar`). It owns no hidden numbers or privileged state.
- **Deterministic**, no LLM at runtime, no stored state of its own. Intent comes from AI-Diplomacy's cached Campaigns (read-only here).
- **Stance is not an AI-War output in alpha**: every Contingent is Balanced (`war__kb.md`). The interface for later stance rules is reserved (below).

### Inputs (read-only)
```
campaigns(A)  = AI-Diplomacy's cached Campaign list for Country A   // { target, type, since }
hostile(type) = type ∈ { Provoke, Strike, Squeeze }                 // (proposed) the types that justify visible force
war state, armies, border provinces, free Army labour per cell      // ordinary War/World Map readouts
```

### Reserved interface (post-alpha)
```
stancePolicy(contingent, army, campaign, war) -> stance            // owned here; alpha: always Balanced
```

## Rules
1. **Pre-war deployment (proposed).** A non-player Country holding a hostile Campaign toward a Country it is not at war with raises one army at a border province (an own province adjacent to the target's), using part of the free Army labour of the most populous peasant cell of that Region. Positioning armies is the action; Show of Force is derived from it (`war__kb.md`), no separate order.
2. **Army handling at war** stays exactly the existing minimal behaviour (`simpleWar.js`): raise one army near the enemy border if none exists; idle armies march on the nearest enemy army, else the nearest enemy province.
3. **Tactic (proposed).** An army whose owner holds a Strike Campaign against one of the Country's current enemies is set to `aggressive`; otherwise `balanced`. The tactic is set per army until per-detachment tactics exist in code (`war__kb.md` Rule 26), then per detachment with the same rule. It is a free dial; changing it emits an order only when the value differs.
4. **Composition.** The AI fields what the cell can give and uses the Default sorting template once sorting exists; it never reassigns Contingents manually in alpha.
5. **Merge / Split.** The AI does not merge or split in alpha (proposed); both stay available to the player.
6. **Reinforcement** is automatic once implemented; the AI issues no order for it.
7. **War declaration** belongs to AI-Diplomacy (Strike Campaign: Declare War with goals proportionate to the CB). AI-War only reacts to a war that exists.
8. **Peace.** The AI proposes no peace in alpha (open question below).

## Cross-references
- **AI — Diplomacy** — Campaigns drive Rules 1 and 3; Declare War is its action (`ai_diplomacy__kb.md`).
- **War** — actions, Show of Force, tactics, stances, Contingents, Reinforcement (`war__kb.md`).
- **Actions** — AI orders use the same envelope and validation (`actions__kb.md`).

## Status
- **Settled (designer input, 2026-11-11)**: AI-War is minimal in alpha; border deployment, Declare War and default army handling are its hooks; stance changes for AI armies are its future job (Balanced for now).
- **Proposed (awaiting OK)**: Rules 1, 3, 5, 8 as written; the hostile Campaign types.
- **Open**: when the AI proposes peace (exhaustion headroom, lost battles); stance rules per tactic; per-detachment tactic assignment; use of standing vs. levy forces and scoped Mobilization; merge/split heuristics; fog of war (post-alpha).
- **Not yet done**: `ui__kb.md` hooks, numbers pass, `.outline/`. Spec: `spec/ai_war__spec.md`. Code: `src/modules/ai/aiWar.js` (opt-in).
- **Rev:** (tracked = every `###` under Data Structures; `Rules` as one section while it has no `###`; bootstrap 2026-11-12)
  - Data Structures > Principles = 1
  - Data Structures > Inputs (read-only) = 1
  - Data Structures > Reserved interface (post-alpha) = 1
  - Rules = 1
