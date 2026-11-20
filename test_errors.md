
> test
> node --test tests/kernel.test.js tests/worldmap.test.js tests/engine.test.js tests/econ_polity.test.js tests/client.test.js tests/behaviour.test.js tests/war.test.js tests/editor.test.js tests/politics_remaining.test.js tests/internal_conflict.test.js tests/diplomacy.test.js tests/population.test.js tests/ui.test.js tests/espionage.test.js tests/ai_diplomacy.test.js tests/economics_upkeep.test.js tests/economics_zones.test.js tests/polity_queue.test.js tests/portrait.test.js tests/administration.test.js tests/worldmap_reorg.test.js tests/worldmap_migration.test.js tests/slate_colonize.test.js

[32m✔ fixture: the Questions are the tiers the tests assume [90m(4.934431ms)[39m[39m
[32m✔ slate: a fixed Coordination threshold per tier, existential first, then structural by priority; routine overhead is paid first [90m(16.649034ms)[39m[39m
[32m✔ slate: within a tier the larger gap x Weight comes first; what does not fit is left off [90m(0.749792ms)[39m[39m
[32m✔ slate: a Question that does not fit is skipped, lower ones that still fit are taken (existential crowds out, never removes) [90m(0.943929ms)[39m[39m
[32m✔ slate: Government propaganda is paid from the same Coordination pool [90m(1.207695ms)[39m[39m
[32m✔ routine tier: no slate commitment, a continuous overhead per Question; when Coordination runs short the lowest priority drop out of standing administration [90m(2.039512ms)[39m[39m
[32m✔ step6 is deterministic and writes only attention and standing [90m(0.735629ms)[39m[39m
[32m✔ through a real turn the slate is written at step 6 for the next turn [90m(14.007946ms)[39m[39m
[32m✔ posture: the player is treated exactly like any other Country [90m(1.767874ms)[39m[39m
[32m✔ posture: hysteresis keeps the current Posture just under a boundary, a fresh one does not [90m(0.264156ms)[39m[39m
[32m✔ campaign: switching type needs a margin, so small value changes do not flip it [90m(1.222896ms)[39m[39m
[32m✔ campaign: a new CB bypasses the margin [90m(0.310598ms)[39m[39m
[32m✔ campaign: Strike needs a usable CB and finishes with a goal proportionate to its tier [90m(1.865241ms)[39m[39m
[32m✔ candidates: roles whose ActionType is not registered are skipped [90m(0.513997ms)[39m[39m
[32m✔ selection: binary thresholds, a candidate is funded fully or skipped, never partially [90m(0.328332ms)[39m[39m
[32m✔ false flag: a self-targeted one is priced when allowed and dropped when Diplomacy refuses it [90m(0.622417ms)[39m[39m
[32m✔ false flag: a frame is offered only inside the detection window [90m(0.600154ms)[39m[39m
[32m✔ negotiation: accept, silence or reject by posture toward the proposer [90m(0.686898ms)[39m[39m
[32m✔ agent: deterministic, does not mutate state, and persists only through the cache [90m(10.532124ms)[39m[39m
[32m✔ gating: a Veto holder refuses a costly law; forcing it through registers entitlement loss that decays [90m(2476.884834ms)[39m[39m
[32m✔ gating: no covering Right means the action simply executes; a relief (tax cut) is approved [90m(736.258114ms)[39m[39m
[32m✔ cell actions: below the rung nothing is available; at rung 2 an angry, uncoerced cell refuses tax; Control suppresses it [90m(97.94044ms)[39m[39m
[32m✔ taxRefusal reduces delivered tax; hoarding withholds goods and releases them when it stops [90m(2534.53264ms)[39m[39m
[32m✔ buildTradeInfra: rich cells invest unprompted; infrastructure decays without upkeep [90m(641.062327ms)[39m[39m
[32m✔ factions are derived per issue from live Questions and carry Weight-aggregated momentum [90m(125.083808ms)[39m[39m
[32m✔ long run (40 turns) with acting cells keeps invariants and stays deterministic [90m(57481.69764ms)[39m[39m
[32m✔ demo package loads: 118 provinces, sea/lake hexes are not provinces, regions 6-12 hexes, cells reference real regions [90m(39.896691ms)[39m[39m
[32m✔ real Action pipeline: setTaxLaw changes the law, placeRequisition fills Government inventory, bad order is rejected not thrown [90m(2931.308733ms)[39m[39m
[32m✔ 20 turns: invariants hold (Wealth >= 0, Ledger >= 0, grievance/satisfaction in [0,1], population within the 1%-per-turn growth bound) [90m(14333.841626ms)[39m[39m
[32m✔ determinism: two runs of the same scenario give identical state [90m(6465.361635ms)[39m[39m
[32m✔ state shape: no stored aggregate of Leverage; the four categories are readouts, scope = a Country or an alliance bloc [90m(288.220388ms)[39m[39m
[32m✔ Reputational Leverage: decaying per-(observer, subject) stack, separate from everything else; an active Alliance adds a standing bonus as a readout [90m(26.360083ms)[39m[39m
[32m✔ proposals: an AI recipient decides at once; a player recipient answers; Dependency burdens are refused; identical pending proposals are rejected [90m(3444.580899ms)[39m[39m
[32m✔ ratification consults the treaty Veto holders like any gated act: a cell holding Veto.treaty can refuse what the Government accepts [90m(1370.522723ms)[39m[39m
[32m✔ CBs: state-based while the fact holds (occupation, no timer); structural derived (claims, nationalism, militaristic); event-based decay and persistence scales with tier [90m(34.24078ms)[39m[39m
[32m✔ Sanctions: ad hoc ones give the target a Grievance CB, great-power-backed ones do not; stripsCB removes external recognition of the target's CBs [90m(1896.572561ms)[39m[39m
[32m✔ overreach is judged against the goals claimed and applied PER OBSERVER, scaled by closeness to the victim — never global [90m(1196.728727ms)[39m[39m
[32m✔ war chain = treaty-graph propagation: Guarantee and Defensive defend, StandingOffensive/Coalition follow the attacker, Defensive needs a recognised cause, treaties forbid wars between partners [90m(2968.735759ms)[39m[39m
[32m✔ denouncing a treaty is a broken promise: reputation loss with the other party, an event-based CB held by the wronged party; lifting a Sanction is no breach [90m(1762.54908ms)[39m[39m
[32m✔ axis hooks: MilitaryCap bounds fielding, ResourceExportBan/TradeAccess zero the edge, DomainVeto is a foreign Veto that cannot be forced, ForeignPolicy needs the grantee's consent [90m(4375.097777ms)[39m[39m
[32m✔ recognition route: rebels take it (independence goal / refused), a foreign Government recognises, backing secession is CB-generating against the parent, a Guarantee pulls the guarantor into the war [90m(9109.178465ms)[39m[39m
[32m✔ recognition is only open to rebels who took the route (a concession-seeking bloc is not recognisable until refused); AI kin-states recognise and guarantee on their own [90m(4488.223465ms)[39m[39m
[32m✔ FacilitationGrant: a real zero-sum transfer of a good from the grantor's warehouse to a bloc's held province [90m(1617.714179ms)[39m[39m
[32m✔ demo run: diplomacy orders mid-run keep the world consistent and deterministic [90m(25653.542193ms)[39m[39m
[32m✔ turn runs end-to-end; deterministic and pure [90m(17.516694ms)[39m[39m
[32m✔ production: extraction scales with labour (diminishing) and Wasteland yields nothing [90m(18.523608ms)[39m[39m
[32m✔ cascade: well supplied cells are fully satisfied; goods are conserved (no creation by buying) [90m(2.050456ms)[39m[39m
[32m✔ cascade is tier-first under a cash limit: subsistence is bought before comfort [90m(2.275587ms)[39m[39m
[32m✔ taxation: delivered = claimed x involuntary compliance; Wealth never negative [90m(3.754554ms)[39m[39m
[32m✔ Ledger: spending dial vs start-of-turn balance; never negative; unmet upkeep fraction [90m(2.055928ms)[39m[39m
[32m✔ requisition: delivered scaled by involuntary compliance, goods land in Government inventory [90m(3.039941ms)[39m[39m
[32m✔ polity: shortage accumulates existential grievance fast, then Question + momentum + rung; recovery decays slowly [90m(10.974883ms)[39m[39m
[32m✔ polity: Question exists iff grievance > compliance (independent of slate) [90m(0.820236ms)[39m[39m
[32m✔ credit: shortfall cells borrow from cash-rich cells via explicit obligation records (no anonymous debts) [90m(3.376197ms)[39m[39m
[32m✔ produceCCO: no committed units gives nothing [90m(2.389555ms)[39m[39m
[32m✔ produceCCO is linear in committed units (kb rev 2: no division by total units) [90m(1.179163ms)[39m[39m
[32m✔ produceCCO: poolUnmet[pool] = 0.5 halves that pool only [90m(0.359492ms)[39m[39m
[32m✔ Allocation Dial rows carry the entry pool tag [90m(0.477854ms)[39m[39m
[32m✔ poolUnmetFrom: only mandatory tagged rows, grants over floors per pool, met pools absent [90m(0.35251ms)[39m[39m
[32m✔ ledger: poolUnmet written per pool from tagged mandatory rows; replaced every turn; degrades produceCCO next turn [90m(16.481193ms)[39m[39m
[32m✔ ledger: no tagged rows leaves poolUnmet empty [90m(3.63467ms)[39m[39m
[32m✔ zones: an unrestricted border does not split a zone (zones are not bounded by Country borders) [90m(7.581715ms)[39m[39m
[32m✔ zones: a single-owner world is unchanged [90m(1.330894ms)[39m[39m
[32m✔ zones: an embargo or a ban on every good closes the border and splits the zone [90m(1.519637ms)[39m[39m
[32m✔ zones: partial restriction scales the pull but does not split above the floor [90m(0.528881ms)[39m[39m
[32m✔ zones: below zone.openFloor (0.1) a border counts as closed; above it, open [90m(0.878993ms)[39m[39m
[32m✔ zones: unowned land or water never pulls across an owner boundary [90m(0.39442ms)[39m[39m
[32m✔ zoneEdges: a split gives one edge between the two hubs; a merged zone has none [90m(0.678104ms)[39m[39m
[32m✔ borderOpenness: 1 unrestricted / same owner / unowned; 0 under embargo [90m(0.666264ms)[39m[39m
[32m✔ ownerTradeFactor agrees with treaties.tradeFactor for every good, in both directions [90m(1.032994ms)[39m[39m
[32m✔ the demo package validates without errors; the numbers-pass worklist lists placeholders [90m(38.375955ms)[39m[39m
[32m✔ patch engine: apply then inverse restores the documents exactly (objects and arrays) [90m(5.361473ms)[39m[39m
[32m✔ store: terrain painting clamps forestation, marks provinces manual, undo/redo, and a brush stroke (mergeKey) is ONE undo step [90m(181.92931ms)[39m[39m
[32m✔ validators catch broken data with a jump-to path [90m(218.602336ms)[39m[39m
[32m✔ setSurface to sea removes the province, its presence, warehouse and incident edges; the cell sums then need reseeding [90m(85.145059ms)[39m[39m
[32m✔ generators: seedCells satisfies the sum constraints; derivedWaterSource follows the precedence (river first); normalisePresence fixes sums [90m(101.248917ms)[39m[39m
[31m✖ editor -> game round trip: a blank scenario from the template is valid, can be edited, saved, bundled, loaded and played headless [90m(5028.030367ms)[39m[39m
[32m✔ resolveTurn is pure and deterministic; steps run in order; RNG only advances state [90m(3.180498ms)[39m[39m
[32m✔ gating: refusal blocks; forceThroughControl executes and registers entitlement loss [90m(0.788199ms)[39m[39m
[32m✔ scheduler: war declaration resolves at step 7 now and hostilities at step 4 next turn [90m(0.432457ms)[39m[39m
[32m✔ registry rejects threshold-bound types without targetScale [90m(0.292246ms)[39m[39m
[32m✔ the demo now carries Espionage labour, and the free pool is the labour not yet committed to operations or counter-intelligence [90m(36.58093ms)[39m[39m
[32m✔ threshold: binary, no refund, no benefit beyond it; scaled by the TARGET Region's population and never by the opponent's size [90m(262.335308ms)[39m[39m
[32m✔ overt propaganda exports the sender's Portrait into the target Region's cells, is open (no CB, sender known); covert pushes any point [90m(123.628963ms)[39m[39m
[32m✔ covert influence writes Opinion (target-agnostic) and injects Grievance into that Region only [90m(24.98454ms)[39m[39m
[32m✔ detection = Observation + counter-intelligence (additive); act detected at the concealment threshold, sender revealed only at the higher one [90m(18.452962ms)[39m[39m
[32m✔ revealing the sender gives the victim a CB (Rights for influence, Grievance for propaganda) and costs the sender Reputational Leverage; a merely detected act names nobody [90m(102.891292ms)[39m[39m
[32m✔ false flag: the blame lands on the apparent sender until detection reaches the false-flag threshold; seeing through it exposes the TRUE sender (Reputation + CB) [90m(18.328465ms)[39m[39m
[32m✔ actions: zero-sum Espionage labour, own-Region counter-intelligence, validation, lift; ops run each turn through the engine; Observation dial reallocates detection [90m(7075.974132ms)[39m[39m
[32m✔ whole run with standing operations is deterministic and keeps State sane [90m(16847.096627ms)[39m[39m
[32m✔ no Retinue Right -> no armed rung, however angry; with the Right the cell raises a bloc, a war side that is not a Country [90m(1624.638078ms)[39m[39m
[31m✖ rebel units fight on the same machinery: they are supplied from held territory and the Government can besiege/retake it [90m(51921.927178ms)[39m[39m
[31m✖ suppression: rebels destroyed -> war ends, held provinces released, retinue labour released, martial law on the member cells costs Control and expires [90m(24692.046389ms)[39m[39m
[32m✔ concession: the Government offers Rights/Duties terms at the Peace Conference; accepted -> entries applied, armies disbanded, war ended; an empty offer to independence-seekers is refused [90m(2318.969163ms)[39m[39m
[32m✔ concession by grievance addressed: if every member cell calms (rung 0) for civil.calm.turns the conflict ends without terms [90m(1827.606228ms)[39m[39m
[32m✔ secession: holding all home provinces free of Government armies for civil.secede.turns forms a new Country (Formation); armies and provinces pass to it; the world keeps running [90m(5630.82384ms)[39m[39m
[32m✔ peace terms that grant secession form the Country too (Formation is a peace-conference outcome) [90m(1458.891087ms)[39m[39m
[32m✔ an AI Government fights the bloc with the same Action API; whole run deterministic, no negative stocks [90m(26711.746539ms)[39m[39m
[32m✔ scope coverage and specificity (Region broader than Estate/Nation) [90m(1.707715ms)[39m[39m
[32m✔ Rights resolve by most specific scope; Estate vs Nation tie -> latest declared; silence undefined [90m(0.352089ms)[39m[39m
[32m✔ Control stacks additively [90m(0.195665ms)[39m[39m
[32m✔ ModifierStack decays, has no spend [90m(0.304581ms)[39m[39m
[32m✔ Allocation Dial: floors by priority, shortfall truncates lowest, surplus by ratio, cap overflow redistributes [90m(0.703648ms)[39m[39m
[32m✔ Spending dial: reserve floor protects balance from discretionary; mandatory may dip; sink keeps [90m(0.268567ms)[39m[39m
[32m✔ Threshold binary, no refund; types must declare targetScale [90m(0.35818ms)[39m[39m
[32m✔ ClaimLedger is zero-sum and all-or-nothing [90m(0.296257ms)[39m[39m
[32m✔ Rng deterministic and resumable [90m(0.507881ms)[39m[39m
[32m✔ schema: validates types/enums/refs, fills defaults, lists placeholders [90m(0.845355ms)[39m[39m
[32m✔ schema: 'any' type accepts anything [90m(0.187621ms)[39m[39m
[32m✔ Mobility: needs the Right AND a Government gap; moves pro-rata stocks; population conserved; reactions target the Government [90m(3.368445ms)[39m[39m
[32m✔ Mobility: a too-small prestige gap blocks; revoking the Right stops flow but never reverts movers [90m(1.753145ms)[39m[39m
[32m✔ Demotion: only on negative net position and with compliance; closest prestige below; debt follows; Control gain; heavy opinion hit [90m(2.27205ms)[39m[39m
[32m✔ Rights/Duties reform action: sets scoped entries, most specific wins, null removes; unknown ids rejected, not thrown [90m(25.086329ms)[39m[39m
[32m✔ pipeline: reform + gap orders drive Mobility end to end; population conserved; deterministic [90m(52.745334ms)[39m[39m
[32m✔ Convergence: trigger is checklist distance 0 (a Council seat blocks it); declared route merges at step 8 and conserves everything [90m(21.21877ms)[39m[39m
[32m✔ Convergence: estate-forced route (top rung, defiance) runs the same merge; a later reform reverses it by pro-rata split [90m(13.338855ms)[39m[39m
[32m✔ propaganda (fast): bounded, never overshoots the ideal, reversible past the baseline sign, competing pushes add [90m(2.675643ms)[39m[39m
[32m✔ propaganda commitment: zero-sum with ordinary Teaching/Culture use; Government draws on its amalgam; Teaching moves the baseline; lift ends it [90m(24.105725ms)[39m[39m
[32m✔ counterPropaganda: a pushed cell with free Culture labour pulls itself back toward its baseline [90m(1.64206ms)[39m[39m
[32m✔ Teaching: moves labour toward the Profile, conserves headcount, never past target, committed labour untouched, extinct pools unreachable [90m(34.700422ms)[39m[39m
[32m✔ Teaching: Nation affinity biases the split; directed Teaching removes retraining capacity [90m(0.493955ms)[39m[39m
[32m✔ demo scenario, 25 turns with Mobility + Demotion + propaganda ordered: invariants hold and runs are deterministic [90m(40029.907832ms)[39m[39m
[32m✔ readPolityQueue: requisition hit = req.opinionHit x burden (share of the cell's output taken); drained [90m(2.474511ms)[39m[39m
[32m✔ readPolityQueue: a requisition that took nothing is no hit [90m(0.393897ms)[39m[39m
[32m✔ readPolityQueue: a credit default hits the creditor (Opinion and Fairness grievance) by its loss share; drained [90m(0.371942ms)[39m[39m
[32m✔ readPolityQueue: empty or missing queues are fine [90m(0.346453ms)[39m[39m
[32m✔ turn: a delivered requisition lands an Opinion hit on every requisitioned cell; a bigger take hits harder [90m(15.93466ms)[39m[39m
[32m✔ turn: without Control nothing is delivered, so there is no requisition hit [90m(4.66586ms)[39m[39m
[32m✔ turn: an obligation past the arrears limit defaults and hits the creditor [90m(5.177ms)[39m[39m
[32m✔ the constant is 0.01 (authored) and f is the shortage of subsistence, else the abundance of comfort [90m(32.195249ms)[39m[39m
[32m✔ abundance: +1% x comfort satisfaction; the province stock and Nation presence grow by exactly the cell's change [90m(25.531213ms)[39m[39m
[32m✔ shortage: population falls by 1% x the subsistence shortfall, drawn from the Nation's presence [90m(30.33684ms)[39m[39m
[32m✔ growth is bounded by max_population_density; Wasteland takes nothing; decrease is never bounded [90m(69.274482ms)[39m[39m
[32m✔ committed labour (armies, retinues) neither breeds nor starves; free labour scales with the population [90m(21.870637ms)[39m[39m
[32m✔ 40 turns of the demo: density ceilings, presence <= population, and the Nation x Region population sums all keep holding [90m(30153.226793ms)[39m[39m
[31m✖ pop.growth = 0 switches it off exactly [90m(2940.206189ms)[39m[39m
[32m✔ actionRecord: public Government acts of this Country, signed by their loads; covert, cell, other-Country and unknown acts are ignored [90m(1.997568ms)[39m[39m
[32m✔ actionRecord: the realized direction on the entry (loads) wins over the type's static load; empty loads are silent [90m(0.375989ms)[39m[39m
[32m✔ actionRecord fades with age [90m(0.361113ms)[39m[39m
[32m✔ observedPortrait: scaled by awareness, squashed into (-1,+1) [90m(0.665369ms)[39m[39m
[32m✔ alignment: an aligned cell gains (scaled by opinion.alignGain), an opposed one loses, a silent record changes nothing [90m(0.97264ms)[39m[39m
[32m✔ opinionGov and compliance carry opinion.align x alignment: serving the cell's ideal raises them, opposing it lowers them [90m(0.849033ms)[39m[39m
[32m✔ the structural requisition hit is this channel, and direction matters: raising the take hurts an Investment-leaning cell, lifting it pleases it [90m(1.458449ms)[39m[39m
[32m✔ axisShift: a tax rise is Extraction, a cut is Investment, no change is silent [90m(1.575452ms)[39m[39m
[32m✔ axisShift: a bigger requisition is Extraction, a smaller or lifted one is Investment [90m(0.526637ms)[39m[39m
[32m✔ engine: the Decision Log entry carries the action id and the realized direction, taken before the law changed [90m(29.266706ms)[39m[39m
[32m✔ portrait: missing baseline reads as the amalgam, a stored baseline wins [90m(1.258011ms)[39m[39m
[32m✔ reinforcePortrait pushes onto the stack, the readout clamps to +-1, ticking decays the stack [90m(0.835623ms)[39m[39m
[32m✔ a Government act reinforces its own Portrait toward the pole it acts on: a tax rise toward Extraction, a cut toward Investment (covert acts count too) [90m(7.933586ms)[39m[39m
[32m✔ free colonization: without the commitment only the frontier pull acts; with it the pull rises and each arriving settler is paid from the Government ledger to the arriving cells [90m(3.430211ms)[39m[39m
[32m✔ free colonization lapses while the ledger is empty; arrivals in settled provinces are never paid [90m(0.54241ms)[39m[39m
[32m✔ free colonization: validate needs a Government order with a positive incentive; lifting removes only your own commitment [90m(0.981478ms)[39m[39m
[32m✔ momentum: an unaddressed Question rises as before [90m(1.118279ms)[39m[39m
[32m✔ momentum: listed on the slate (attention) the rise is frozen and a debate starts; when the debate ends the rise resumes although it is still listed [90m(0.981927ms)[39m[39m
[32m✔ momentum: a routine Question in standing administration counts as addressed; the momentum it already has still decays [90m(0.478017ms)[39m[39m
[32m✔ slate readout: an open debate that the slate no longer lists reads as debate; a Question nobody took up is unaddressed [90m(1.484206ms)[39m[39m
[32m✔ scope syntax: the six kinds + empire, and the impossible (Nation, Estate) pair is an error, not a guess [90m(5.221654ms)[39m[39m
[32m✔ forms: scope-aware drafts carry the chosen Scope; every form builds with its own defaults; JSON/number parsing; gating info [90m(95.797528ms)[39m[39m
[32m✔ queries are read-only, JSON-serialisable and consistent with State [90m(1193.683151ms)[39m[39m
[32m✔ Laws matrix: a scoped reform shows up as an override in exactly that column [90m(917.945812ms)[39m[39m
[32m✔ preview: validation, gating verdicts (who would refuse), foreign DomainVeto; orders can be queued and removed [90m(108.127723ms)[39m[39m
[32m✔ world readouts: pair sheet, mirror and treaties reflect Diplomacy State [90m(134.095713ms)[39m[39m
[32m✔ movement graph: Mountain interior blocked unless pass; paths exist elsewhere [90m(40.341392ms)[39m[39m
[32m✔ declareWar: executes (no Veto.war holder), schedules effects: active only after hostilitiesBegin; unknown target rejected [90m(2017.439206ms)[39m[39m
[31m✖ fieldUnits: commits labour, consumes weapons, creates an army; invalid orders are rejected with reasons [90m(667.968068ms)[39m[39m
[31m✖ battle: the larger, better-supplied army wins; casualties come out of origin cells; war harm and score are logged; loser retreats or dies [90m(4386.798027ms)[39m[39m
[32m✔ siege -> occupation -> peace: capture raises security grievance; ratified peace cedes the province and Regions re-derive with totals conserved [90m(8295.564339ms)[39m[39m
[32m✔ peace is refused when the other side is strong and not exhausted [90m(2527.618715ms)[39m[39m
[31m✖ war run (25 turns) is deterministic and keeps invariants [90m(29940.17716ms)[39m[39m
[32m✔ AI Government (same Action API) raises and marches an army once war is on; run stays deterministic [90m(15804.981178ms)[39m[39m
[32m✔ odd-r neighbours are symmetric and distance matches [90m(10.20081ms)[39m[39m
[32m✔ mountain interior edges blocked unless pass; mountain<->other open [90m(0.312993ms)[39m[39m
[32m✔ regions: contiguous, same owner, 6-8 hexes, deterministic, stable under unrelated change [90m(11.585395ms)[39m[39m
[32m✔ fracture split by Nations presence preserves extensive totals; merge sums [90m(0.845059ms)[39m[39m
[32m✔ migration: people move toward the Region with better satisfaction; stocks follow pro rata, nothing is created or lost [90m(4.186959ms)[39m[39m
[32m✔ migration: equal satisfaction means no flow; a Region never pulls from a better one [90m(2.200634ms)[39m[39m
[32m✔ migration: a Movement autonomy Right that is false blocks it; so does a LaborMigrationBan between the two owners [90m(1.995016ms)[39m[39m
[32m✔ migration into a Region without the Nation's cell creates it, keeping Nation and Estate [90m(0.512648ms)[39m[39m
[32m✔ moveCohort: capped by presence and room; a Wasteland province becomes Frontier and then Settled by the people living there; water needs the capability flag [90m(0.635322ms)[39m[39m
[32m✔ settle (cell action): proposes the frontier province of its own Country, utility needs crowding, validate respects the Settlement Right, apply queues and step 8 pays and moves [90m(1.387688ms)[39m[39m
[32m✔ direct resettlement: planned (preview), queued, applied; stocks follow, the source cell takes an opinion hit, bad orders are rejected with reasons [90m(1.252085ms)[39m[39m
[32m✔ Expulsion: needs a bordering province of another Country and no LaborMigrationBan; confiscates a share to the Government; the expelled cell takes the hit; kin states get a Rights CB [90m(1.043604ms)[39m[39m
[32m✔ a resettlement through a real turn: queued by the order, applied at step 8; a Reorganization-free turn keeps the books; a stale order is dropped whole [90m(20.27575ms)[39m[39m
[32m✔ step 8 runs migration after growth (and before queued moves); the whole pass is deterministic [90m(1.312935ms)[39m[39m
[32m✔ split: new ids for every part, capitals recorded, the old id replaced, the input untouched [90m(2.43802ms)[39m[39m
[32m✔ split: rejected unless the parts partition the Region, are contiguous, have a capital inside, and the Region is the actor's [90m(0.843117ms)[39m[39m
[32m✔ merge: adjacent Regions of the actor become one new Region with the named capital; non-adjacent, foreign or capital-less merges are rejected [90m(0.549499ms)[39m[39m
[32m✔ move: a province changes Region while both stay contiguous; the donor's stored capital cannot leave unannounced [90m(0.589199ms)[39m[39m
[31m✖ ops chain: a Region made by one op can be used by the next; targets() follows the chain [90m(1.413635ms)[39m[39m
[32m✔ retargetLaws: a removed Region's entries are copied to its successors (all scope kinds with a region); merges keep the later Duty and the larger Requisition [90m(0.837228ms)[39m[39m
[32m✔ regionCapitalOf: the stored capital while valid, else the most populous province (ties by id) [90m(0.356958ms)[39m[39m
[32m✔ a Reorganization through a real turn: queued by the order, applied at step 8; cells, laws and capitals follow; the next turn runs [90m(21.891502ms)[39m[39m
[32m✔ a bad Reorganization is rejected with its reasons, not thrown; an order that stops being valid before step 8 is dropped whole [90m(5.93627ms)[39m[39m
[32m✔ setRegionCapital: stored at once for a province of the actor's Region; anything else is rejected [90m(18.692542ms)[39m[39m
[34mℹ tests 194[39m
[34mℹ suites 0[39m
[34mℹ pass 186[39m
[34mℹ fail 8[39m
[34mℹ cancelled 0[39m
[34mℹ skipped 0[39m
[34mℹ todo 0[39m
[34mℹ duration_ms 434888.822253[39m

[31m✖ failing tests:[39m

test at tests/editor.test.js:52:1
[31m✖ editor -> game round trip: a blank scenario from the template is valid, can be edited, saved, bundled, loaded and played headless [90m(5028.030367ms)[39m[39m
  RangeError [Error]: Maximum call stack size exceeded
      at splitObligations (file:///workspaces/Elental/src/modules/polity/transfer.js:28:7)
      at transferCohort (file:///workspaces/Elental/src/modules/polity/transfer.js:14:3)
      at moveCohort (file:///workspaces/Elental/src/modules/worldmap/migration.js:63:27)
      at stepMigration (file:///workspaces/Elental/src/modules/worldmap/migration.js:107:34)
      at Object.step8 (file:///workspaces/Elental/src/modules/worldmap/module.js:30:3)
      at resolveTurn (file:///workspaces/Elental/src/engine/engine.js:88:49)
      at EngineClient.endTurn (file:///workspaces/Elental/src/client/engineClient.js:20:31)
      at EngineClient.runTurns (file:///workspaces/Elental/src/client/engineClient.js:22:62)
      at async TestContext.<anonymous> (file:///workspaces/Elental/tests/editor.test.js:57:88)
      at async Test.run (node:internal/test_runner/test:1409:7)

test at tests/internal_conflict.test.js:40:1
[31m✖ rebel units fight on the same machinery: they are supplied from held territory and the Government can besiege/retake it [90m(51921.927178ms)[39m[39m
  RangeError [Error]: Maximum call stack size exceeded
      at splitObligations (file:///workspaces/Elental/src/modules/polity/transfer.js:28:7)
      at transferCohort (file:///workspaces/Elental/src/modules/polity/transfer.js:14:3)
      at moveCohort (file:///workspaces/Elental/src/modules/worldmap/migration.js:63:27)
      at stepMigration (file:///workspaces/Elental/src/modules/worldmap/migration.js:107:34)
      at Object.step8 (file:///workspaces/Elental/src/modules/worldmap/module.js:30:3)
      at resolveTurn (file:///workspaces/Elental/src/engine/engine.js:88:49)
      at EngineClient.endTurn (file:///workspaces/Elental/src/client/engineClient.js:20:31)
      at TestContext.<anonymous> (file:///workspaces/Elental/tests/internal_conflict.test.js:46:77)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7)

test at tests/internal_conflict.test.js:49:1
[31m✖ suppression: rebels destroyed -> war ends, held provinces released, retinue labour released, martial law on the member cells costs Control and expires [90m(24692.046389ms)[39m[39m
  RangeError [Error]: Maximum call stack size exceeded
      at splitObligations (file:///workspaces/Elental/src/modules/polity/transfer.js:28:7)
      at transferCohort (file:///workspaces/Elental/src/modules/polity/transfer.js:14:3)
      at moveCohort (file:///workspaces/Elental/src/modules/worldmap/migration.js:63:27)
      at stepMigration (file:///workspaces/Elental/src/modules/worldmap/migration.js:107:34)
      at Object.step8 (file:///workspaces/Elental/src/modules/worldmap/module.js:30:3)
      at resolveTurn (file:///workspaces/Elental/src/engine/engine.js:88:49)
      at EngineClient.endTurn (file:///workspaces/Elental/src/client/engineClient.js:20:31)
      at TestContext.<anonymous> (file:///workspaces/Elental/tests/internal_conflict.test.js:57:13)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7)

test at tests/population.test.js:55:1
[31m✖ pop.growth = 0 switches it off exactly [90m(2940.206189ms)[39m[39m
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  
  + 41680.00000000001
  - 41680
         ^
  
      at TestContext.<anonymous> (file:///workspaces/Elental/tests/population.test.js:57:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 41680.00000000001,
    expected: 41680,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/war.test.js:25:1
[31m✖ fieldUnits: commits labour, consumes weapons, creates an army; invalid orders are rejected with reasons [90m(667.968068ms)[39m[39m
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  22.99425 !== 23
  
      at TestContext.<anonymous> (file:///workspaces/Elental/tests/war.test.js:28:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 22.99425,
    expected: 23,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/war.test.js:33:1
[31m✖ battle: the larger, better-supplied army wins; casualties come out of origin cells; war harm and score are logged; loser retreats or dies [90m(4386.798027ms)[39m[39m
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(c.state.polity.cells[a.cell.key].population <= popBefore)
  
      at TestContext.<anonymous> (file:///workspaces/Elental/tests/war.test.js:40:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/war.test.js:63:1
[31m✖ war run (25 turns) is deterministic and keeps invariants [90m(29940.17716ms)[39m[39m
  RangeError [Error]: Maximum call stack size exceeded
      at splitObligations (file:///workspaces/Elental/src/modules/polity/transfer.js:28:7)
      at transferCohort (file:///workspaces/Elental/src/modules/polity/transfer.js:14:3)
      at moveCohort (file:///workspaces/Elental/src/modules/worldmap/migration.js:63:27)
      at stepMigration (file:///workspaces/Elental/src/modules/worldmap/migration.js:107:34)
      at Object.step8 (file:///workspaces/Elental/src/modules/worldmap/module.js:30:3)
      at resolveTurn (file:///workspaces/Elental/src/engine/engine.js:88:49)
      at EngineClient.endTurn (file:///workspaces/Elental/src/client/engineClient.js:20:31)
      at EngineClient.runTurns (file:///workspaces/Elental/src/client/engineClient.js:22:62)
      at async run (file:///workspaces/Elental/tests/war.test.js:65:118)
      at async TestContext.<anonymous> (file:///workspaces/Elental/tests/war.test.js:66:13)

test at tests/worldmap_reorg.test.js:63:1
[31m✖ ops chain: a Region made by one op can be used by the next; targets() follows the chain [90m(1.413635ms)[39m[39m
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  
    [
      'r12',
  +   'r12'
    ]
  
      at TestContext.<anonymous> (file:///workspaces/Elental/tests/worldmap_reorg.test.js:65:36)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1402:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:974:18)
      at Test.postRun (node:internal/test_runner/test:1542:19)
      at Test.run (node:internal/test_runner/test:1467:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: [ 'r12', 'r12' ],
    expected: [ 'r12' ],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }
