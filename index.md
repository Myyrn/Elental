# Elental — Project Index / Manifest

Last updated: 2026-11-25

This file lives in the repo root (`index.md`, authoritative). It is the map of what
exists, what's settled, and **how to reach exactly the chapter needed without
reading whole files**. Don't read file body, read only its headers first.

## Repository layout (GitHub, single monorepo)

```
index.md                    # this file (authoritative copy)
changelog.md                # changelog partition 2026-11-01 (see Changelog partitions)
changelog/ <YYYY-MM-DD>.md  # later changelog partitions, named by their first day (2026-11-16.md and 2026-11-19.md closed, 2026-11-22.md current)
kb/    <module>__kb.md      # ground truth, incl. cross_module_notes__kb.md
spec/  <module>__spec.md    # implementation-ready interfaces/schemas
src/   kernel/ engine/ modules/ ui/ editor/ worldgen/   # worldgen/ since 2026-11-25 (slice 3c: terrain.js)
scenarios/                  # demo and authored scenarios (alpha tuning: scenarios/alpha/tuning.defaults.json)
data/                       # GENERATED (npm run build:data): ruleset.json and the demo package; never edit by hand
tests/
tools/ outline.mjs  section.mjs  check-headers.mjs  worklist.mjs  lib/md.mjs  buildRuleset.mjs  makeDemo.mjs
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

## Task intake order (2026-11-09)

1. **Read first**: this file's module row and the top changelog entry only (of the **latest changelog partition**, see Changelog partitions).
2. **Then**: the module's kb Status block and heading list (`.outline/<file>.json`, or the first ~30 lines).
3. **Then only the needed `##/###` section** of that kb file. Where the host returns whole files (the GitHub connector does, for reads **and** writes: it has no patch operation, so every edit re-sends the whole file), keep chapters under ~15 KB; **split `internal_politics__kb.md` (about 77 KB on 2026-11-25) into chapter files** (planned, not yet done; the same pressure applies to `internal_politics__spec.md` (61 KB), `actions__spec.md` (49 KB), `administration__spec.md` (39 KB), `economics__spec.md` (38 KB), `world_map__spec.md` (37 KB), `administration__kb.md` (36 KB) and `ui__spec.md` (33 KB), all above 30 KB; the 2026-11-16 and 2026-11-19 changelog partitions are closed).
4. **Spec**: only the section the kb cross-reference names. **Code**: only the files that spec section lists; the matching `tests/<module>.test.js` last, for conventions.
5. **Skip** the doc layer, other modules' kb files unless a cross-reference names them, and `cross_module_notes__kb.md` unless the task is cross-cutting.
6. **Never trust README status** — confirm "implemented" from `src/` plus a test name.
7. **Edit flow**: always work in the same github branch; kb → spec → code → tests; changelog entry in the current changelog partition (see Changelog partitions), split into sections having headers as title and date;
8. **Tooling** (in the repo since 2026-11-15, run by the designer; the session host that cannot execute code writes its output by hand): `tools/outline.mjs`, `tools/section.mjs`, `tools/check-headers.mjs`, `tools/worklist.mjs` (kb Rev ↔ spec Sync ↔ code work list from the Status blocks only; flags `--summary`, `--module`, `--stage spec|code`; `-` code revs overstate the code work). `.outline/` is regenerated by `node tools/outline.mjs --all` and goes stale with every kb/spec edit (**not regenerated on 2026-11-25**).
9. **KB/Spec equality**: kb and spec files should have mostly the same structure to make the search of topics to the both sides easier.
10. **Generated data (2026-11-18)**: `data/ruleset.json` and the demo package are built from `scenarios/alpha/tuning.defaults.json` and the other sources by `npm run build:data`. **After any change to the tuning file run it and commit the result**: the tests that play a turn load the generated file and fail with `missing tuning key …` otherwise (`tests/fixtures.js` reads the tuning file directly, so fixture-based tests hide the problem). The full suite is `npm test` (an explicit file list in `package.json`; `node --test tests/` does not work on recent Node). `autotest.bat` runs `npm run build:data`, `npm test`, the outline and the header check, so it follows `package.json` by itself.

## Changelog partitions (2026-11-14)

The changelog is split in next partition whenever its size exceeds 32 kb so that no session has to rewrite or read a huge file. Every partition is named according to the date of split.

- **Files**: a partition is named by its first day. `changelog.md` (repo root) is the partition **2026-11-01** and also keeps every earlier entry. `changelog/2026-11-16.md` holds 2026-11-16 to 2026-11-18 and `changelog/2026-11-19.md` holds 2026-11-19 to 2026-11-21: both are **closed**; **from 2026-11-22 new entries go to `changelog/2026-11-22.md`** (the 32 kb rule applies; about 12 KB on 2026-11-25). A finished partition is never edited again except to fix an error.
- **Which partition a session writes to**: the one containing the day the session **started**. If its size will exceed 32 kb, the last message is written into the current partition and the next one is started.
- **Inside a partition**: newest entry first, one section per change with `## <title> — <date>`; the file opens with one line naming the partition and the rule.
- **Reading**: task intake reads only the top entry of the latest partition; older partitions only when a question points at them.
- **Creating a new partition**: add the file in the session that first needed it, update the layout above and the previous partition's header line (frozen: names its successor). 2026-11-19 and 2026-11-22: the header lines of the closed partitions were **not** updated (the whole file would be re-sent); the layout above is the pointer. Add the lines by hand if wanted.

## Working mode (GitHub)

- Always working with one branch /indev. Read from there and commit to there, unless explicitly told otherwise. 
- Commit order within a session: **kb → spec → code → tests**, small commits with
  the module name as prefix (`war: …`).
- Before the final commit: regenerate `.outline/`, run `check-headers`, run
  `tests/`, add a changelog entry in the current partition (see Changelog partitions).
- When something new is settled, edit the kb section in the repo (this replaces
  "output the updated section in chat"); summarise the diff at the end of the
  session.
- If GitHub is unreachable, interrupt execution and warn the user.

## KB ↔ Spec continuity (2026-11-12)

Spec is a section-wise projection of kb. Continuity = one integer **rev** per kb
section, mirrored in the spec. No hashes, no tooling; only two Status blocks are read.

- **Mirror**: spec uses the same `##/###` headings as kb under Data Structures and
  Rules (one spec section per kb section; address = heading path). Each spec section
  opens with `Code: <src path>`. Cross-references live in kb only.
- **`Rev:`** (kb Status): one line per tracked section, `<heading path> = <n>`.
  Tracked = every `##/###` under Data Structures and Rules. +1 in the same commit as
  any edit that changes meaning (not wording/typos). New section starts at 1; a
  deleted section loses its line.
- **`Sync:`** (spec Status): `<heading path> = <kb rev> / <code rev>`. kb rev = the kb
  rev the spec text reflects; code rev = kb rev implemented in code + tests (`-` if none).
- **Work list** = compare the two lists, never section bodies:
  kb rev > synced rev → revise that spec section; in `Rev:` but not `Sync:` → write it;
  in `Sync:` but not `Rev:` → delete it (orphan); synced rev > code rev → code + tests.
- **Revise in place**: read the kb section (+ pointers it names) and the old spec
  section; edit that spec section only; set its Sync kb rev. Never regenerate a whole
  spec, never open doc.
- **Commit chain**: kb (bump Rev) → spec (set Sync) → code/tests (set code rev). A
  session may stop after any link; the two lists show where it stopped.
- **Pointers**: mechanics live in one owning section (Access rule 4); only the
  owner's rev is bumped.
- **check-headers** also fails if: a tracked kb section lacks a `Rev:` line; a `Sync:`
  line has no kb section; a synced rev exceeds its kb rev.
- **Bootstrap**: existing specs are discarded. Per module: add `Rev:` (all = 1) to kb
  Status, then write spec section by section, filling `Sync:` as each lands. The
  module-table spec column turns ✅ when every `Sync:` kb rev equals its `Rev:`.
- **Kb-only files**: `cross_module_notes__kb.md` has no spec and therefore **no `Rev:` block** (decision 2026-11-14); its module row shows `n/a`.
- Supersedes Access rule 6's spec-headings clause and Task intake item 9.

## Module status

Code status as of 2026-11-25: the full suite (`npm test`) was **green on 2026-11-17/18** through slice 3a; **the run of 2026-11-20 (194 tests) passed 186**: its 8 failures (a debt-record explosion in `transfer.js`, a duplicate in `reorg.js`, and tests that assume nothing migrates) were fixed on 2026-11-20 and **have not been re-run**. **Written 2026-11-19/22 and not run**: the debate rules (`tests/debate.test.js`), the assembly queue with `economics.produceCCOByRegion`, the slate card and the forms (`tests/queue.test.js`), and **Question handling** (`tests/handling.test.js`: the scope of a Question by its faction, Persuasion, the petition clock). **Written 2026-11-25**: the terrain generator `src/worldgen/terrain.js` and `tests/worldgen_terrain.test.js` (8 tests), run only in the sandbox where they were written (with a reconstructed local copy of `hex.js`), not in the repository; the engine cannot load the world it generates yet. Run `npm run build:data` first (twenty-four new tuning keys since 2026-11-19), then `npm test`; the code revs of the sections concerned are provisional until then.

| # | Module | doc | kb | spec | Load for a session on this module (outline first) |
|---|---|---|---|---|---|
| 01 | World Map | ✅ populated | ✅ populated (2026-11-19) | ✅ (2026-11-19) | `world_map__kb.md`; 2026-11-02: population growth/migration/settlement shape, Region re-derivation timing; cataclysm post-alpha; 2026-11-09: administrative Regions + Reorganization Event, resettlement/expulsion, Sea provinces (10th terrain); 2026-11-10: lakes as playable water provinces, starting population anchors, stored Region capital; **2026-11-19: migration, settlement, resettlement and Expulsion details settled, free colonization a standing commitment (Population dynamics rev 2, Rules rev 2)**; spec `world_map__spec.md` (2026-11-19; code covers the odd-r grid, Mountain-edge rule, automatic Region derivation with split/merge by presence, natural population growth, the stored Region capital (`setRegionCapital`, a dial), the Reorganization Event (`reorganizeRegions`; capitals named inside the ops), **gradual migration (`stepMigration`), settlement (`moveCohort`, Wasteland → Frontier → Settled, the `settle` cell action), direct resettlement, Expulsion and free colonization (`directResettlement`, `expel`, `freeColonization`, `liftFreeColonization`; queued in `world.pendingMoves`, applied at step 8), green in the run of 2026-11-20**; **slice 3c started 2026-11-25: the terrain generator `src/worldgen/terrain.js` (every hex a province, Sea with lakes, ten terrains, forestation, water source, starting-population anchors; spec `worldgen__spec.md` rewritten) is written and tested in the sandbox only; the data-model half of 3c is still a target: `world.json` with every hex a province, `ruleset.terrain.Sea`, traversal and settlement-capability rows, loaders/validators, UI colours (`tools/makeDemo.mjs` still writes the old `surface: sea|lake|land` world)**; the 2026-11-19 decisions are confirmed except the free-colonization payment details, listed in the spec Status; UI forms for all of these since 2026-11-21) |
| 02 | World Map (Graphics) | — retired | — | — | **Merged into UI (2026-09-13)** — rendering/lens ownership now lives entirely in `ui__kb.md`; this module no longer exists separately. |
| 03 | Countries | ✅ populated | ✅ populated | ✅ (2026-11-14) | `countries__kb.md`; 2026-11-02: Dependency satisfaction readout, unified axis menu, Confederation, recognition route settled; spec `countries__spec.md` (2026-11-14; no module in code: `state.countries`, province ownership, treaties in `state.diplomacy`; code covers Dependency/Confederation treaty records, secession-formed Countries, recognition; `capital`, `opinion`, `satisfaction`, Merger, Government readout, titular setter are targets) |
| 04 | Economics | ✅ populated | ✅ populated | ✅ (2026-11-24) | `economics__kb.md` — overhaul pass 2026-11-01 (Requisition, contribution valuation, propaganda pools); contribution valuation settled 2026-11-02 (Teaching; Meteomancy rituals at authored relative prices); 2026-11-02 (later): credit as obligation records, prices, minting fineness, `trade_infrastructure_level`, Land share bookkeeping, Teaching permanent loss settled; 2026-11-09: Government sells/grants goods, calibration target, pool wiring audit (open); 2026-11-13: Trade-Zone Network and Resolution order rev 2 (per-pool unmet upkeep written by the Ledger step); 2026-11-14: Capability Envelope per committed unit and linear (rev 2); **2026-11-15: border openness = the share of goods that can cross, with a floor (Trade-Zone Network rev 4); the creditor's Opinion and Fairness hits on a credit default (Credit rev 2)**; spec `economics__spec.md` (2026-11-24 text, Sync revs as of kb 2026-11-15; split out of `economics_polity__spec.md`; code covers extraction, processing, price pass, cascade, taxation, credit, Land split, Teaching, the linear envelope, **the cross-border `hubOf` pull by openness, the `poolUnmet` writer and the requisition/default hand-offs to polity, and (written 2026-11-21, not yet run) `produceCCOByRegion`, the envelope of one Region's pools for the assembly queue, now described in this spec**; Mint, Ritual, Government buy/sell/grant, tariffs, warehouse spoilage, planning posture are targets; a Sea-crossing rule for trade-zone pull is not defined (3c note in the spec)) |
| 05 | Internal Politics | ✅ populated | ✅ populated (2026-11-24) | ✅ (2026-11-24) | `internal_politics__kb.md` (about 77 KB: read by `##/###` section only) — overhauled 2026-11-01 (Fairness bucket, acting issue-scoped Factions, Preference vector/propaganda, Requisition Duty, Government material needs); 2026-11-02: Government and Ledger merged and settled, faction escalation momentum, Region-level Convergence/Mobility/Demotion rules; Lending Right, no anonymous debts, net-position Demotion trigger; 2026-11-09: scope ladder + Precedence flag, administrative-Region laws, consultation/petition handling; 2026-11-15: Requisition Duty rev 2 (direct hit), Credit default consequences (new section); 2026-11-16: the Opinion-alignment channel (Cell Preferences & Propaganda rev 3), act direction, the stored Government Portrait reinforced by Government acts (rev 3), the structural requisition hit through the record (Requisition Duty rev 4); 2026-11-19/22: a discussed Question does not rise, an unresolved debate leaves a minor Fairness modifier (Faction escalation state rev 2); the faction that raised a Question and its scope (Grouping / Faction computation rev 2); **2026-11-24: the alpha shape of Question handling and Question-time Persuasion confirmed (Question handling rev 3, Compliance rev 3, Rules 37 and 40); `entitlement_loss_size` defined as the act's impact (`cost` = loss, `relief` = gain) and a Right granted during a debate counts as a concession (Entitlement loss rev 2; the concession's conversion is proposed)**; spec `internal_politics__spec.md` (renamed from `economics_polity__spec.md`; **synced to kb 2026-11-24, code revs of the 2026-11-19/22 sections provisional**; code covers grievance, compliance, Questions, momentum, gating, entitlement loss, cell actions, Mobility, Demotion, Convergence, propaganda, requisition and default consequences, the alignment channel, the Portrait, **and, written 2026-11-19/22 and not yet run, the discussed-Question freeze, the expiry and petition modifiers (`polity/step.js` `updateMomentum`)**; its Status lists what is outstanding: Portrait success/failure scaling and consumers, attribution tiers, acting factions, benefits, Foreign Standing, Borrow/Default actions, **the `entitlementSize` derive and a Right as a concession in code**; **its Decision Log section still shows the old entry schema (no `id`, no `loads`), as does the kb's Decision Log section: update at the chapter split**; `transferCohort` (`polity/transfer.js`) now joins debt shares into existing records) |
| 06 | Diplomacy | ✅ populated | ✅ populated | ✅ (2026-11-15) | `diplomacy__kb.md` — overhaul pass 2026-11-01 (foreign propaganda, Cultural Leverage, kin-state appeal); 2026-11-02: Observation vs. Espionage detection contest; detection = Observation + counter-intelligence Espionage with sender-attribution tier and false flags; 2026-11-02: CB persistence classes, per-observer overreach, binary target-scaled thresholds, DomainVeto axis; 2026-11-10: Negotiation Session (no fixed term, withdrawal, satisfaction meter, Reputational Leverage mark); Action Catalogue (Embargo/Tariffs, split positive/hostile actions, alliance chain, Improve Relations); spec `diplomacy__spec.md` (2026-11-15: border openness defined; split out of `admin_war_diplomacy__spec.md`; code covers CBs, treaties, axis hooks, recognition, Espionage, **`borderOpenness` (`diplomacy/border.js`)**; Negotiation Session, most of the catalogue, tariffs, Improve Relations, `opinion` are targets; `laborMigrationBanned` now has a World Map consumer (migration and Expulsion, 2026-11-19)) |
| 07 | Nations | ✅ populated | ✅ populated | ✅ (2026-11-14) | `nations__kb.md`; 2026-11-02: co-titular set, kin-state toolkit dissolved, pool affinity, assimilation transfers; 2026-11-09: five-Country placeholder world; spec `nations__spec.md` (2026-11-14; no module in code: `state.nations = {presence, affinity}`; code covers presence kept in step with population, Region split, Teaching affinity weights, titular set read by Diplomacy; Core, titular effects, Sympathy, Reaction Temperament, Assimilation Drift, Statehood readout and the five-Country scenario are targets) |
| 08 | War | ✅ populated | ✅ populated | ✅ (2026-11-12) | `war__kb.md` — overhaul pass 2026-11-01 (per-cell War Score, derived Exhaustion, internal armed conflict); 2026-11-02: alpha naval scope, soft garrison, rebel Peace Conference, scalar Retinue Right settled; 2026-11-10: levy vs. standing army, scoped Mobilization, Retinue military contribution, Peace Conference stacks, Battle Report, occupation/siege readouts, Show of Force (replaces Troop Training); 2026-11-10 (later): Contingents (one pool × one origin cell, 10% minimum share), army merge/split, detachment strategic roles; 2026-11-11: army composition settled (sorting templates, overflow, Balanced stance, derived lateral position); spec `war__spec.md` (2026-11-12, status refreshed 2026-11-13; split out of `admin_war_diplomacy__spec.md`; Contingents, standing forces, Show of Force, Battle Report etc. specified as targets) — code outstanding for everything tagged (target); internal armed conflict implemented; `cell.warHarm` kept as a cached derived value |
| 09 | Characters | 🟡 stub | ⬜ | ⬜ | `characters__doc.md` — **beyond alpha (2026-11-01)**; blocks Diplomacy's Succession/Common Ruler axes and War's named-commander/ransom hooks, all post-alpha |
| 10 | Administration | 🟡 outdated (superseded) | ✅ populated (2026-11-24) | ✅ (2026-11-24) | `administration__kb.md` (about 36 KB) — Control Allocation settled (shared scope syntax); active slate = Government attention (attention-threshold, no slot formula; the routine tier has no slate commitment, only a continuous overhead); proportional upkeep degradation, leaderless defection, Observation-as-detection; Emergency Powers cost derived; Faction spawn/Multiplicity/templates/corruption dissolved (see file's Status); 2026-11-03: Allocation Dial for Control/Observation; 2026-11-10/21: the assembly queue (Coordination-derived cap, agenda shares; the proposals confirmed 2026-11-21) and Question resolution time; 2026-11-19/20: a Question is addressed only while it is discussed; after the debate it fades or becomes pressing again with a minor decaying grievance modifier on the faction that asked; `extendDebates` (`s0 × k²`); consumer order of the slate settled; 2026-11-22: the scope of a Question is the scope of the faction that raised it (one Region 1 turn; several Regions 3; more than half of the Country's Regions 5; the last two in the Country's assembly); **2026-11-24: the Country's assembly and `persuade` confirmed; early resolution of a debate settled as a decision rule — any turn, two thirds of the voting Weight in favour (an absolute majority) and nothing gating it (no refusing Veto holder) (Assembly Queue rev 5, Administration actions rev 4, Rules rev 6); the decision object (`proposeAnswer`, voters, check at step 6, `decision.majority`) is proposed, awaiting OK**; spec `administration__spec.md` (2026-11-24; code covers the Control derives, the Observation dial, pipeline step 6 (the Question slate) **and, written 2026-11-19/22 (the slate readout green on 2026-11-20, the rest not yet run), the readout with scope and handling, the debate record `polity.debate`, the freeze and the expiry modifier, `extendDebates` / `liftExtendDebates`, the assembly queue (`queue.js`), the UI query `slate` and the Apparatus card, `persuade` (Question-time Persuasion, confirmed)**; **the decision check, `proposeAnswer` and the `entitlementSize` derive are specified and not coded**, Emergency Powers, upkeep defection, audits, planning posture, consumer 5 and 6 are targets; **next slate consumer: the decision object, or Emergency Powers**) |
| 11 | Events | 🟡 stub | ⬜ | ⬜ | `events__doc.md` — **beyond alpha (2026-11-01)**; alpha uses a decision-log proxy for causal provenance |
| 12 | UI | 🟡 stub doc | ✅ populated (2026-09-13) | ✅ (2026-11-24) | `ui__kb.md` — now includes former World Map (Graphics) lens/rendering content; 2026-11-03 design pass: shell + five workspaces, global Scope, Lens system, Allocation Dial widget, End Turn Preflight; 2026-11-09: Apparatus before Polity, Nations tab, Regions rendering, Message Feed + badges, Laws UI, Trade Zones lens; 2026-11-10: click-to-move, occupation hatch/siege display, map symbols and army markers, Battle Report, mobilization controls, Veto factors panel, negotiation meter; spec `ui__spec.md` (2026-11-24 text; **the UI in code is a debug shell**: five workspaces, global Scope filter with treemap, twelve flat lenses, docked cards, Orders tray with preview verdicts, Event Draft forms, Laws matrix; every code rev is `-`; Message Feed, badges, Preflight, Allocation Dial widget, Battle Report, markers, click-to-move and most of the 2026-11-09/10 design are targets; **29 forms in code (written 2026-11-21/22, not yet run), the query `slate` and the Question slate card in Apparatus are described in the spec; the kb has no section for the card yet (gap noted)**; the `SURFACE` land/sea/lake colouring is pre-Sea-terrain and changes with slice 3c) |
| 13 | AI — Diplomacy | — skipped by decision | ✅ populated (2026-11-11; Rules rev 2 on 2026-11-13) | ✅ first code pass (2026-11-11) | `ai_diplomacy__kb.md` (Leverage instrument selection and weighting per `diplomacy__kb.md`; Posture, Campaigns, CB fabrication; self-targeted false flag is post-alpha); spec `ai_diplomacy__spec.md`; code `src/modules/ai/diplomacyAgent.js` + `ai/diplomacy/*`, **opt-in** via `ruleset.aiDiplomacy.enabled`; tests `tests/ai_diplomacy.test.js` (green since 2026-11-17 after a fix in `ai/diplomacy/campaign.js`: `Support`'s "under pressure" check ignores the deciding Country; `candidates.js` has the same unfiltered check, to be fixed with the AI slice) |
| 14 | AI — War | — none | 🟡 minimal alpha (2026-11-11) | ✅ first pass (2026-11-11) | `ai_war__kb.md` (border deployment, tactic, reserved stance policy; most rules **proposed**); spec `ai_war__spec.md`; code `src/modules/ai/aiWar.js` (opt-in with AI-Diplomacy); tests not written |
| 15 | AI — Economics / Internal Politics | 🟡 stub | ⬜ | ⬜ | `ai_econ_politics__doc.md` — alpha: near-zero focus by decision (2026-11-11) |
| 16 | Actions | 🟡 stub doc | ✅ populated (2026-11-18) | ✅ (2026-11-24) | `actions__kb.md` — cross-cutting envelope, turn pipeline, Decision Log write path, Ledger priority dial/Borrow/Default; 2026-11-03: Allocation Dial subclass, spending dial with reserve floor, End Turn Preflight; 2026-11-12: Troop Training replaced by Show of Force, War actions aligned; **2026-11-16/18: an action's direction on the Portrait axes (`axisShift`, read before the act applies) and the log entry's `id` and `loads` (Action envelope rev 2, Decision Log write path rev 2, Rule 18), the Region capital dial and the Reorganization Event as World Map actions (Lifecycle classes rev 3, Existing actions rev 3), steps 5 and 8 of the pipeline (rev 2)**; spec `actions__spec.md` (2026-11-24; split out of `kernel_engine__spec.md`; **types table: `settle`, `directResettlement`, `expel`, `freeColonization`, `liftFreeColonization`, `extendDebates`, `liftExtendDebates` and, since 2026-11-24 (from the Administration spec, not re-read in `src/`), `persuade` are code rows; `proposeAnswer` is a target row; the pipeline text covers the scope assemblies in step 6 and the petition/expiry modifiers in step 5**; the **kb's** Existing actions row still lists `freeColonization` under Economics and lacks the three Administration debate types and `persuade`: correct at the next Actions kb edit (Existing actions rev 4); engine-level `preview`/`preflight` not in code, the client has `preview` and `catalog` readouts) |
| 99 | Cross-Module Notes | ✅ populated | ✅ populated | n/a (kb only, no spec and no `Rev:` block by decision 2026-11-14) | `cross_module_notes__kb.md` (always in Project knowledge) |

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
3. `kb`-only build sessions: kb sections + cross-module notes sections. Never `doc`.
   Code work additionally reads the matching `spec` section and its `Code:` target.
4. End of session: kb/spec/code committed on the session branch (see Working
   mode), `.outline/` regenerated, this file's status column and changelog
   updated; refresh the Project-knowledge copy of this file if it changed.
