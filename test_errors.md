
> test
> node --test tests/kernel.test.js tests/worldmap.test.js tests/engine.test.js tests/econ_polity.test.js tests/client.test.js tests/behaviour.test.js tests/war.test.js tests/editor.test.js tests/politics_remaining.test.js tests/internal_conflict.test.js tests/diplomacy.test.js tests/population.test.js tests/ui.test.js tests/espionage.test.js tests/ai_diplomacy.test.js tests/economics_upkeep.test.js tests/economics_zones.test.js tests/polity_queue.test.js tests/portrait.test.js tests/administration.test.js tests/worldmap_reorg.test.js tests/worldmap_migration.test.js tests/slate_colonize.test.js tests/debate.test.js tests/queue.test.js tests/handling.test.js

[32m✔ fixture: the Questions are the tiers the tests assume [90m(2.768964ms)[39m[39m
[32m✔ slate: a fixed Coordination threshold per tier, existential first, then structural by priority; routine overhead is paid first [90m(9.058497ms)[39m[39m
[32m✔ slate: within a tier the larger gap x Weight comes first; what does not fit is left off [90m(1.650673ms)[39m[39m
[32m✔ slate: a Question that does not fit is skipped, lower ones that still fit are taken (existential crowds out, never removes) [90m(0.950213ms)[39m[39m
[32m✔ slate: Government propaganda is paid from the same Coordination pool [90m(2.744704ms)[39m[39m
[32m✔ routine tier: no slate commitment, a continuous overhead per Question; when Coordination runs short the lowest priority drop out of standing administration [90m(1.407792ms)[39m[39m
[32m✔ step6 is deterministic and writes only attention and standing [90m(1.133521ms)[39m[39m
[32m✔ through a real turn the slate is written at step 6 for the next turn [90m(21.580826ms)[39m[39m
[32m✔ posture: the player is treated exactly like any other Country [90m(2.172977ms)[39m[39m
[32m✔ posture: hysteresis keeps the current Posture just under a boundary, a fresh one does not [90m(0.361623ms)[39m[39m
[32m✔ campaign: switching type needs a margin, so small value changes do not flip it [90m(1.463855ms)[39m[39m
[32m✔ campaign: a new CB bypasses the margin [90m(0.45129ms)[39m[39m
[32m✔ campaign: Strike needs a usable CB and finishes with a goal proportionate to its tier [90m(5.313942ms)[39m[39m
[32m✔ candidates: roles whose ActionType is not registered are skipped [90m(0.642184ms)[39m[39m
[32m✔ selection: binary thresholds, a candidate is funded fully or skipped, never partially [90m(0.434356ms)[39m[39m
[32m✔ false flag: a self-targeted one is priced when allowed and dropped when Diplomacy refuses it [90m(0.673032ms)[39m[39m
[32m✔ false flag: a frame is offered only inside the detection window [90m(0.636523ms)[39m[39m
[32m✔ negotiation: accept, silence or reject by posture toward the proposer [90m(0.630762ms)[39m[39m
[32m✔ agent: deterministic, does not mutate state, and persists only through the cache [90m(10.56283ms)[39m[39m
