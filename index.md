# Elental — Project Index / Manifest

Last updated: 2026-11-10

This file lives in **two places**: the Project knowledge (always available, slim
working copy) and the repo root (`index.md`, authoritative). It is the map of what
exists, what's settled, and **how to reach exactly the chapter needed without
reading whole files**. Nothing else needs to be in Project knowledge except this
file and `cross_module_notes__kb.md`.

## Repository layout (GitHub, single monorepo)

```
index.md                    # this file (authoritative copy)
kb/    <module>__kb.md      # ground truth, incl. cross_module_notes__kb.md
doc/   <module>__doc.md     # design-doc prose, rarely loaded
spec/  <module>__spec.md    # implementation-ready interfaces/schemas
src/   kernel/ engine/ modules/ ui/ editor/
scenarios/                  # demo and authored scenarios
tests/
tools/ outline.mjs  section.mjs  check-headers.mjs
.outline/                   # generated + committed: heading → line-range map per file
```

Filenames elsewhere in this index (e.g. `war__kb.md`) resolve to their directory by
layer: `kb/war__kb.md`, `doc/…`, `spec/…`.

## Naming convention

`<module>__<layer>.md`

| Layer | Meaning | When to load it |
|---|---|---|
| `doc` | Design-doc prose — Purpose / Core Concepts / Player Interactions / Systems & Rules / Dependencies / Open Questions. Rationale and intent. | Once, to extract a `kb` file. Rarely reloaded after. |
| `kb`  | Knowledge base — settled data structures, formulas, enums, state machines. Terse, structured. Ground truth. | Every session touching that module (by section, see Access rules). |
| `spec` | Implementation-ready interfaces/schemas, generated from `kb`. | When actually building that part of the SPA. |

## Access rules (how to read the repo cheaply)

1. **Never open a kb/spec/doc file in full.** Get its outline first:
   `node tools/outline.mjs kb/war__kb.md` (headings, levels, line ranges; also
   readable from `.outline/war__kb.md.json`).
2. **Read only the needed chapter:**
   `node tools/section.mjs kb/war__kb.md "Rules"` or with a heading path,
   `"Data Structures > Occupation"`. Matching is case-insensitive on heading text;
   a section runs to the next heading of the same or higher level.
3. **Start from the module table** below to pick the owning file, then outline it.
   Do not scan the whole repo or grep bodies when an outline answers the question.
4. **Cross-module questions:** outline `kb/cross_module_notes__kb.md` first, read
   the matching section, then follow its pointer to the owning file's section.
   Mechanics live in one owning file only; others carry pointers.
5. **Code navigation:** every spec section starts with a `Code:` line naming its
   `src/` path; every module file carries a `Spec:` JSDoc tag naming its spec
   section. Go kb section → spec section → code file, never the reverse by search.
6. **Header discipline:** kb files keep the section headers
   `Data Structures / Rules / Cross-references / Status`; spec files keep
   their own stable top-level headings. Heading text is an address — renaming a
   heading means updating every pointer to it. `node tools/check-headers.mjs`
   fails on missing sections, duplicate headings in one file, or stale `.outline/`.
7. **Reading budget:** read in this order — index row → outline → one section →
   (only if needed) neighbouring section. Quote line ranges in notes, not content.
8. **Secrets:** access tokens are never written into any file, commit message,
   remote URL stored in the repo, or memory. Use them only for the session's
   git operations.

## Task intake order (host-neutral, GitHub or GitLab — 2026-11-09)

1. **Read first**: this file's module row and the top changelog entry only.
2. **Then**: the module's kb Status block and heading list (`.outline/<file>.json`, or the first ~30 lines).
3. **Then only the needed `##/###` section** of that kb file. Where the host returns whole files (the GitHub connector does), keep chapters under ~15 KB; **split `internal_politics__kb.md` (51 KB at the time of writing) into chapter files** (planned, not yet done).
4. **Spec**: only the section the kb cross-reference names. **Code**: only the files that spec section lists; the matching `tests/<module>.test.js` last, for conventions.
5. **Skip** the doc layer, other modules' kb files unless a cross-reference names them, and `cross_module_notes__kb.md` unless the task is cross-cutting.
6. **Never trust README status** — confirm "implemented" from `src/` plus a test name.
7. **Edit flow**: always work in the same github branch; kb → spec → code → tests; changelog entry in `changelog.md` split into sections having headers as title and date;
8. **Tooling to build**: `tools/outline.mjs`, `tools/section.mjs`, `tools/check-headers.mjs` (named in the layout and Access rules above, not present in the repo yet; until they exist, use the kb Status block and the connector's file reads).
9. **KB/Spec equality**: kb and spec files should have mostly the same structure to make the search of topics to the both sides easier.

## Working mode (GitHub)

- Always working with one branch /indev. Read from there and commit to there, unless explicitly told otherwise. 
- Commit order within a session: **kb → spec → code → tests**, small commits with
  the module name as prefix (`war: …`).
- Before the final commit: regenerate `.outline/`, run `check-headers`, run
  `tests/`, add a changelog entry here.
- When something new is settled, edit the kb section in the repo (this replaces
  "output the updated section in chat"); summarise the diff at the end of the
  session.
- If GitHub is unreachable, fall back to attaching only the files for the module
  and returning updated files as downloads; the access rules above still apply
  (outline, then section).

## Module status

| # | Module | doc | kb | spec | Load for a session on this module (outline first) |
|---|---|---|---|---|---|
| 01 | World Map | ✅ populated | ✅ populated | ⬜ | `world_map__kb.md`; 2026-11-02: population growth/migration/settlement shape, Region re-derivation timing; cataclysm post-alpha; 2026-11-09: administrative Regions + Reorganization Event, resettlement/expulsion, Sea provinces (10th terrain); 2026-11-10: lakes as playable water provinces, starting population anchors, stored Region capital |
| 02 | World Map (Graphics) | — retired | — | — | **Merged into UI (2026-09-13)** — rendering/lens ownership now lives entirely in `ui__kb.md`; this module no longer exists separately. |
| 03 | Countries | ✅ populated | ✅ populated | ⬜ | `countries__kb.md`; 2026-11-02: Dependency satisfaction readout, unified axis menu, Confederation, recognition route settled |
| 04 | Economics | ✅ populated | ✅ populated | ⬜ | `economics__kb.md` — overhaul pass 2026-11-01 (Requisition, contribution valuation, propaganda pools); contribution valuation settled 2026-11-02 (Teaching; Meteomancy rituals at authored relative prices); 2026-11-02 (later): credit as obligation records, prices, minting fineness, `trade_infrastructure_level`, Land share bookkeeping, Teaching permanent loss settled; 2026-11-09: Government sells/grants goods, calibration target, pool wiring audit (open) |
| 05 | Internal Politics | ✅ populated | ✅ populated | ⬜ | `internal_politics__kb.md` — overhauled 2026-11-01 (Fairness bucket, acting issue-scoped Factions, Preference vector/propaganda, Requisition Duty, Government material needs); 2026-11-02: Government and Ledger merged and settled, faction escalation momentum, Region-level Convergence/Mobility/Demotion rules; Lending Right, no anonymous debts, net-position Demotion trigger; 2026-11-09: scope ladder + Precedence flag, administrative-Region laws, consultation/petition handling |
| 06 | Diplomacy | ✅ populated | ✅ populated | ⬜ | `diplomacy__kb.md` — overhaul pass 2026-11-01 (foreign propaganda, Cultural Leverage, kin-state appeal); 2026-11-02: Observation vs. Espionage detection contest; detection = Observation + counter-intelligence Espionage with sender-attribution tier and false flags; 2026-11-02: CB persistence classes, per-observer overreach, binary target-scaled thresholds, DomainVeto axis; 2026-11-10: Negotiation Session (no fixed term, withdrawal, satisfaction meter, Reputational Leverage mark); Action Catalogue (Embargo/Tariffs, split positive/hostile actions, alliance chain, Improve Relations) |
| 07 | Nations | ✅ populated | ✅ populated | ⬜ | `nations__kb.md`; 2026-11-02: co-titular set, kin-state toolkit dissolved, pool affinity, assimilation transfers; 2026-11-09: five-Country placeholder world |
| 08 | War | ✅ populated | ✅ populated | ⬜ | `war__kb.md` — overhaul pass 2026-11-01 (per-cell War Score, derived Exhaustion, internal armed conflict); 2026-11-02: alpha naval scope, soft garrison, rebel Peace Conference, scalar Retinue Right settled; 2026-11-10: levy vs. standing army, scoped Mobilization, Retinue military contribution, Peace Conference stacks, Battle Report, occupation/siege readouts, Show of Force (replaces Troop Training); 2026-11-10 (later): Contingents (one pool × one origin cell, 10% minimum share), army merge/split, detachment strategic roles |
| 09 | Characters | 🟡 stub | ⬜ | ⬜ | `characters__doc.md` — **beyond alpha (2026-11-01)**; blocks Diplomacy's Succession/Common Ruler axes and War's named-commander/ransom hooks, all post-alpha |
| 10 | Administration | 🟡 outdated (superseded) | ✅ populated (2026-09-13) | ⬜ | `administration__kb.md` — Control Allocation settled (shared scope syntax); active slate = Government attention (attention-threshold, no slot formula); proportional upkeep degradation, leaderless defection, Observation-as-detection; Emergency Powers cost derived; Faction spawn/Multiplicity/templates/corruption dissolved (see file's Status); 2026-11-03: Allocation Dial for Control/Observation (floor + priority + surplus ratio; per-cell default, aggregate/group filters); 2026-11-10: assembly queue (Coordination-derived cap, agenda shares) and Question resolution time 1/3/5 turns |
| 11 | Events | 🟡 stub | ⬜ | ⬜ | `events__doc.md` — **beyond alpha (2026-11-01)**; alpha uses a decision-log proxy for causal provenance |
| 12 | UI | 🟡 stub doc | ✅ populated (2026-09-13) | ⬜ | `ui__kb.md` — now includes former World Map (Graphics) lens/rendering content; 2026-11-03 design pass: shell + five workspaces, global Scope, Lens system, Allocation Dial widget, End Turn Preflight; 2026-11-09: Apparatus before Polity, Nations tab, Regions rendering, Message Feed + badges, Laws UI, Trade Zones lens; 2026-11-10: click-to-move, occupation hatch/siege display, map symbols and army markers, Battle Report, mobilization controls, Veto factors panel, negotiation meter |
| 13 | AI — Diplomacy | 🟡 stub | ⬜ | ⬜ | `ai_diplomacy__doc.md` — owns Leverage instrument selection and weighting (seeded from the Portrait) per `diplomacy__kb.md`; "Concert" is a metaphor, not an entity |
| 14 | AI — War | 🟡 stub | ⬜ | ⬜ | `ai_war__doc.md` |
| 15 | AI — Economics / Internal Politics | 🟡 stub | ⬜ | ⬜ | `ai_econ_politics__doc.md` |
| 16 | Actions | 🟡 stub doc | ✅ populated (2026-11-02) | ⬜ | `actions__kb.md` — cross-cutting envelope, turn pipeline, Decision Log write path, Ledger priority dial/Borrow/Default; 2026-11-03: Allocation Dial subclass, spending dial with reserve floor, End Turn Preflight |
| 99 | Cross-Module Notes | ✅ populated | ✅ populated | n/a | `cross_module_notes__kb.md` (always in Project knowledge) |

Legend: ✅ populated/designed · 🟡 stub or outdated · ⬜ not created yet

## Alpha scope constraints (apply across all modules)

- 500 provinces, 10 empires, 4 estates, single tech era
- Backend (game logic) is designed to completion first; UI is a separate frontend pass afterwards. Events, Characters, cataclysm and character-scale rituals are beyond alpha
- Hosting: GitHub Pages (primary) / Firebase Hosting (alternative)
- Pure HTML + ES modules, no bundler
- Hex grid: pointy-top, odd-r offset, 25×20 (gameplay grid — separate from
  the 157×114 @16px/cell raw terrain grid used for map generation); every hex is a province (Sea and lake included, 2026-11-09/10)

## Design principles to preserve across all modules

- Larger political structures are harder to maintain (balance-of-power over
  conquest is the core design thesis)
- Skin/skeleton pattern: different modules may reuse the same underlying
  mechanic under different vocabulary (Administration's Actor-cell
  negotiation shape, Diplomacy's Leverage/Goals/Opinion/Casus Belli, and
  War's Peace Conference all sit on the same skeleton) — intentional, not
  to be "simplified" into one shared UI
- Faction shape is computed per issue (Question-time) and never persisted — but factions are ACTIVE: they pursue goals and escalate on their own
- War Score is a ledger of per-cell harm in existing stocks, not an invented
  currency; war weariness is derived from war-attributable grievance, never a
  separate stock
- Supply is a direct combat modifier, not merely a logistics gate
- Diplomacy and Espionage are independent Skilled Labor categories, not
  derived from domestic administrative capacity
- Mages reuse the Meteomancy/Theurgy Skilled Labor pool rather than a new
  category
- No free-floating abstractions: every value traces to a ground-truth
  stock or derived calculation
- No hardcoded entity types ("recostuming"): changing an actor's profile
  is a parameter change, not a structural one
- Government is a resource-holder with material needs only; agency belongs
  to the player/AI, never to a second will inside the Government
- Cells are actors; factions are derived groupings, never actors; an AI Government's values are the Weight-weighted amalgam of its most powerful cells
- Standing = objective contribution vs. legacy entitlement (Fairness);
  loss of a held entitlement is a decaying modifier whose size depends on
  the faction's own exposure to the crisis
- Attribution, not intent: discontent follows causal provenance × awareness
- Cells hold preferences over Portrait axes (baseline + decaying modifier);
  propaganda is pool-gated, not tech-gated; later tech amplifies it

- Design rules first; exact numbers wait for a dedicated numbers pass, and authored values are relative (e.g. Meteomancy ritual prices as multiples of a numeraire (a unit of Refined Precious Metals, the money metal))

## Session workflow reminder

1. Read this file's module table before starting; pick the owning kb file(s).
2. Follow the Access rules: outline → one section → (if needed) neighbour. Do not
   load whole files, and do not load `doc` files unless extracting.
3. `doc` → `kb` extraction sessions: read `doc` (+ existing `kb` if any) section by
   section, plus the relevant `cross_module_notes__kb.md` sections.
4. `kb`-only build sessions: kb sections + cross-module notes sections. Never `doc`.
   Code work additionally reads the matching `spec` section and its `Code:` target.
5. End of session: kb/spec/code committed on the session branch (see Working
   mode), `.outline/` regenerated, this file's status column and changelog
   updated; refresh the Project-knowledge copy of this file if it changed.
  `infrastructure_level` vs. Economics' `trade_infrastructure_level` (now
  explicitly distinct stocks).
