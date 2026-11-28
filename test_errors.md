
> test
> node --test tests/kernel.test.js tests/worldmap.test.js tests/engine.test.js tests/econ_polity.test.js tests/client.test.js tests/behaviour.test.js tests/war.test.js tests/editor.test.js tests/politics_remaining.test.js tests/internal_conflict.test.js tests/diplomacy.test.js tests/population.test.js tests/ui.test.js tests/espionage.test.js tests/ai_diplomacy.test.js tests/economics_upkeep.test.js tests/economics_zones.test.js tests/polity_queue.test.js tests/portrait.test.js tests/administration.test.js tests/worldmap_reorg.test.js tests/worldmap_migration.test.js tests/slate_colonize.test.js tests/debate.test.js tests/queue.test.js tests/handling.test.js tests/decision.test.js tests/worldgen_terrain.test.js tests/worldmap_sea.test.js

[32m✔ fixture: the Questions are the tiers the tests assume [90m(2.871005ms)[39m[39m
[32m✔ slate: a fixed Coordination threshold per tier, existential first, then structural by priority; routine overhead is paid first [90m(8.553901ms)[39m[39m
[32m✔ slate: within a tier the larger gap x Weight comes first; what does not fit is left off [90m(0.685708ms)[39m[39m
[32m✔ slate: a Question that does not fit is skipped, lower ones that still fit are taken (existential crowds out, never removes) [90m(0.888072ms)[39m[39m
[32m✔ slate: Government propaganda is paid from the same Coordination pool [90m(1.788283ms)[39m[39m
[32m✔ routine tier: no slate commitment, a continuous overhead per Question; when Coordination runs short the lowest priority drop out of standing administration [90m(1.41572ms)[39m[39m
[32m✔ step6 is deterministic and writes only attention and standing [90m(0.843316ms)[39m[39m
[32m✔ through a real turn the slate is written at step 6 for the next turn [90m(12.640947ms)[39m[39m
[32m✔ posture: the player is treated exactly like any other Country [90m(1.788883ms)[39m[39m
[32m✔ posture: hysteresis keeps the current Posture just under a boundary, a fresh one does not [90m(0.275202ms)[39m[39m
[32m✔ campaign: switching type needs a margin, so small value changes do not flip it [90m(1.156819ms)[39m[39m
[32m✔ campaign: a new CB bypasses the margin [90m(0.348969ms)[39m[39m
[32m✔ campaign: Strike needs a usable CB and finishes with a goal proportionate to its tier [90m(2.471064ms)[39m[39m
[32m✔ candidates: roles whose ActionType is not registered are skipped [90m(0.734407ms)[39m[39m
[32m✔ selection: binary thresholds, a candidate is funded fully or skipped, never partially [90m(0.475956ms)[39m[39m
[32m✔ false flag: a self-targeted one is priced when allowed and dropped when Diplomacy refuses it [90m(0.816348ms)[39m[39m
[32m✔ false flag: a frame is offered only inside the detection window [90m(0.569012ms)[39m[39m
[32m✔ negotiation: accept, silence or reject by posture toward the proposer [90m(0.660227ms)[39m[39m
[32m✔ agent: deterministic, does not mutate state, and persists only through the cache [90m(8.843314ms)[39m[39m
[32m✔ gating: a Veto holder refuses a costly law; forcing it through registers entitlement loss that decays [90m(2665.216884ms)[39m[39m
[32m✔ gating: no covering Right means the action simply executes; a relief (tax cut) is approved [90m(680.97196ms)[39m[39m
[32m✔ cell actions: below the rung nothing is available; at rung 2 an angry, uncoerced cell refuses tax; Control suppresses it [90m(104.287986ms)[39m[39m
[32m✔ taxRefusal reduces delivered tax; hoarding withholds goods and releases them when it stops [90m(2709.614398ms)[39m[39m
[32m✔ buildTradeInfra: rich cells invest unprompted; infrastructure decays without upkeep [90m(599.140978ms)[39m[39m
[32m✔ factions are derived per issue from live Questions and carry Weight-aggregated momentum [90m(155.378037ms)[39m[39m
[32m✔ long run (40 turns) with acting cells keeps invariants and stays deterministic [90m(60557.90286ms)[39m[39m
[31m✖ demo package loads: 118 provinces, sea/lake hexes are not provinces, regions 6-12 hexes, cells reference real regions [90m(34.932112ms)[39m[39m
[32m✔ real Action pipeline: setTaxLaw changes the law, placeRequisition fills Government inventory, bad order is rejected not thrown [90m(2925.740364ms)[39m[39m
[32m✔ 20 turns: invariants hold (Wealth >= 0, Ledger >= 0, grievance/satisfaction in [0,1], population within the 1%-per-turn growth bound) [90m(14235.988017ms)[39m[39m
[32m✔ determinism: two runs of the same scenario give identical state [90m(6427.429484ms)[39m[39m
[32m✔ an expired debate leaves a minor decaying Fairness modifier ONCE on every cell of the faction that raised the Question, then the usual mechanics continue [90m(3.26839ms)[39m[39m
[32m✔ a Question that was never taken up has no debate to expire: no modifier [90m(0.441369ms)[39m[39m
[32m✔ extendDebates: validate needs a Government order for a live Question of your Country that is being debated; one extension per Question; liftExtendDebates needs your own [90m(1.412218ms)[39m[39m
[32m✔ extendDebates: the freeze goes on, and the same share of Control and Coordination is taken: s0 x k^2, growing each turn beyond the natural timespan; lifting it ends the debate (expired) [90m(1.03044ms)[39m[39m
[32m✔ extendDebates lapses when the share can no longer be paid; several extensions add up, capped at 1 [90m(0.590138ms)[39m[39m
[32m✔ step 5 drops the debate record and the extension of a Question that is no longer live (resolved or faded: no modifier) [90m(2.682403ms)[39m[39m
[32m✔ proposeAnswer: a Government order on a Question that is debated in an assembly; one answer per debate, replaceable; not Persuasion; the act must be valid [90m(4.925545ms)[39m[39m
[32m✔ two thirds of the voting Weight decide a debate; half does not; the act is queued as an answer and the debate ends RESOLVED (freeze over, no modifier, slot freed, extension dropped) [90m(12.906537ms)[39m[39m
[31m✖ nothing may gate it: a covering Veto holder who refuses blocks the decision even above the bar; one who approves does not [90m(1.679793ms)[39m[39m
[32m✔ with no voters the Government answers alone: the act is adopted at once if nothing gates it [90m(0.762903ms)[39m[39m
[32m✔ an adopted answer runs as an ordinary Government action at the NEXT step 2 and the queue of answers is emptied [90m(11.500279ms)[39m[39m
[32m✔ the entitlement size measure is the act's impact: loss = cost, gain = relief; a Right as a concession = concession.rightK × the mean gain over the faction, loss not subtracted [90m(1.553846ms)[39m[39m
[32m✔ a Right granted during a debate counts as a concession (module hook before the act applies); Persuasion and acts outside a debate do not; a comparable concession leaves no expiry modifier [90m(1.223837ms)[39m[39m
[32m✔ the proposeAnswer form builds an order; the Action type is registered; both new tuning keys exist [90m(0.334554ms)[39m[39m
[32m✔ state shape: no stored aggregate of Leverage; the four categories are readouts, scope = a Country or an alliance bloc [90m(251.999678ms)[39m[39m
[32m✔ Reputational Leverage: decaying per-(observer, subject) stack, separate from everything else; an active Alliance adds a standing bonus as a readout [90m(42.144434ms)[39m[39m
[32m✔ proposals: an AI recipient decides at once; a player recipient answers; Dependency burdens are refused; identical pending proposals are rejected [90m(3552.512905ms)[39m[39m
[32m✔ ratification consults the treaty Veto holders like any gated act: a cell holding Veto.treaty can refuse what the Government accepts [90m(1201.578138ms)[39m[39m
[32m✔ CBs: state-based while the fact holds (occupation, no timer); structural derived (claims, nationalism, militaristic); event-based decay and persistence scales with tier [90m(33.516181ms)[39m[39m
[32m✔ Sanctions: ad hoc ones give the target a Grievance CB, great-power-backed ones do not; stripsCB removes external recognition of the target's CBs [90m(1841.417613ms)[39m[39m
[32m✔ overreach is judged against the goals claimed and applied PER OBSERVER, scaled by closeness to the victim — never global [90m(1335.868978ms)[39m[39m
[32m✔ war chain = treaty-graph propagation: Guarantee and Defensive defend, StandingOffensive/Coalition follow the attacker, Defensive needs a recognised cause, treaties forbid wars between partners [90m(3001.363175ms)[39m[39m
[32m✔ denouncing a treaty is a broken promise: reputation loss with the other party, an event-based CB held by the wronged party; lifting a Sanction is no breach [90m(1922.929282ms)[39m[39m
[32m✔ axis hooks: MilitaryCap bounds fielding, ResourceExportBan/TradeAccess zero the edge, DomainVeto is a foreign Veto that cannot be forced, ForeignPolicy needs the grantee's consent [90m(4318.474588ms)[39m[39m
[32m✔ recognition route: rebels take it (independence goal / refused), a foreign Government recognises, backing secession is CB-generating against the parent, a Guarantee pulls the guarantor into the war [90m(9500.467988ms)[39m[39m
[32m✔ recognition is only open to rebels who took the route (a concession-seeking bloc is not recognisable until refused); AI kin-states recognise and guarantee on their own [90m(4410.378966ms)[39m[39m
[32m✔ FacilitationGrant: a real zero-sum transfer of a good from the grantor's warehouse to a bloc's held province [90m(1344.750839ms)[39m[39m
[32m✔ demo run: diplomacy orders mid-run keep the world consistent and deterministic [90m(19789.121937ms)[39m[39m
[32m✔ turn runs end-to-end; deterministic and pure [90m(17.696625ms)[39m[39m
[32m✔ production: extraction scales with labour (diminishing) and Wasteland yields nothing [90m(20.233079ms)[39m[39m
[32m✔ cascade: well supplied cells are fully satisfied; goods are conserved (no creation by buying) [90m(3.194441ms)[39m[39m
[32m✔ cascade is tier-first under a cash limit: subsistence is bought before comfort [90m(1.75925ms)[39m[39m
[32m✔ taxation: delivered = claimed x involuntary compliance; Wealth never negative [90m(4.122245ms)[39m[39m
[32m✔ Ledger: spending dial vs start-of-turn balance; never negative; unmet upkeep fraction [90m(2.04747ms)[39m[39m
[32m✔ requisition: delivered scaled by involuntary compliance, goods land in Government inventory [90m(3.153975ms)[39m[39m
[32m✔ polity: shortage accumulates existential grievance fast, then Question + momentum + rung; recovery decays slowly [90m(13.347933ms)[39m[39m
[32m✔ polity: Question exists iff grievance > compliance (independent of slate) [90m(1.056687ms)[39m[39m
[32m✔ credit: shortfall cells borrow from cash-rich cells via explicit obligation records (no anonymous debts) [90m(1.963027ms)[39m[39m
[32m✔ produceCCO: no committed units gives nothing [90m(2.630661ms)[39m[39m
[32m✔ produceCCO is linear in committed units (kb rev 2: no division by total units) [90m(1.63627ms)[39m[39m
[32m✔ produceCCO: poolUnmet[pool] = 0.5 halves that pool only [90m(0.542317ms)[39m[39m
[32m✔ Allocation Dial rows carry the entry pool tag [90m(0.694656ms)[39m[39m
[32m✔ poolUnmetFrom: only mandatory tagged rows, grants over floors per pool, met pools absent [90m(0.304303ms)[39m[39m
[32m✔ ledger: poolUnmet written per pool from tagged mandatory rows; replaced every turn; degrades produceCCO next turn [90m(15.422267ms)[39m[39m
[32m✔ ledger: no tagged rows leaves poolUnmet empty [90m(3.660677ms)[39m[39m
[32m✔ zones: an unrestricted border does not split a zone (zones are not bounded by Country borders) [90m(4.648756ms)[39m[39m
[32m✔ zones: a single-owner world is unchanged [90m(1.704673ms)[39m[39m
[32m✔ zones: an embargo or a ban on every good closes the border and splits the zone [90m(0.98289ms)[39m[39m
[32m✔ zones: partial restriction scales the pull but does not split above the floor [90m(0.438054ms)[39m[39m
[32m✔ zones: below zone.openFloor (0.1) a border counts as closed; above it, open [90m(0.916476ms)[39m[39m
[32m✔ zones: unowned land or water never pulls across an owner boundary [90m(0.403004ms)[39m[39m
[32m✔ zoneEdges: a split gives one edge between the two hubs; a merged zone has none [90m(0.562111ms)[39m[39m
[32m✔ borderOpenness: 1 unrestricted / same owner / unowned; 0 under embargo [90m(0.674107ms)[39m[39m
[32m✔ ownerTradeFactor agrees with treaties.tradeFactor for every good, in both directions [90m(1.702772ms)[39m[39m
[32m✔ the demo package validates without errors; the numbers-pass worklist lists placeholders [90m(41.672522ms)[39m[39m
[32m✔ patch engine: apply then inverse restores the documents exactly (objects and arrays) [90m(4.770353ms)[39m[39m
[32m✔ store: terrain painting clamps forestation, marks provinces manual, undo/redo, and a brush stroke (mergeKey) is ONE undo step [90m(234.470557ms)[39m[39m
[31m✖ validators catch broken data with a jump-to path [90m(302.870822ms)[39m[39m
[31m✖ setSurface to sea removes the province, its presence, warehouse and incident edges; the cell sums then need reseeding [90m(59.105622ms)[39m[39m
[32m✔ generators: seedCells satisfies the sum constraints; derivedWaterSource follows the precedence (river first); normalisePresence fixes sums [90m(90.264697ms)[39m[39m
[32m✔ editor -> game round trip: a blank scenario from the template is valid, can be edited, saved, bundled, loaded and played headless [90m(882.536699ms)[39m[39m
[32m✔ resolveTurn is pure and deterministic; steps run in order; RNG only advances state [90m(3.459781ms)[39m[39m
[32m✔ gating: refusal blocks; forceThroughControl executes and registers entitlement loss [90m(0.750348ms)[39m[39m
[32m✔ scheduler: war declaration resolves at step 7 now and hostilities at step 4 next turn [90m(0.43257ms)[39m[39m
[32m✔ registry rejects threshold-bound types without targetScale [90m(0.277881ms)[39m[39m
[32m✔ the demo now carries Espionage labour, and the free pool is the labour not yet committed to operations or counter-intelligence [90m(38.655108ms)[39m[39m
[32m✔ threshold: binary, no refund, no benefit beyond it; scaled by the TARGET Region's population and never by the opponent's size [90m(268.887972ms)[39m[39m
[32m✔ overt propaganda exports the sender's Portrait into the target Region's cells, is open (no CB, sender known); covert pushes any point [90m(104.297128ms)[39m[39m
[32m✔ covert influence writes Opinion (target-agnostic) and injects Grievance into that Region only [90m(29.220659ms)[39m[39m
[32m✔ detection = Observation + counter-intelligence (additive); act detected at the concealment threshold, sender revealed only at the higher one [90m(18.274035ms)[39m[39m
[32m✔ revealing the sender gives the victim a CB (Rights for influence, Grievance for propaganda) and costs the sender Reputational Leverage; a merely detected act names nobody [90m(81.895602ms)[39m[39m
[32m✔ false flag: the blame lands on the apparent sender until detection reaches the false-flag threshold; seeing through it exposes the TRUE sender (Reputation + CB) [90m(18.055183ms)[39m[39m
[32m✔ actions: zero-sum Espionage labour, own-Region counter-intelligence, validation, lift; ops run each turn through the engine; Observation dial reallocates detection [90m(6758.877428ms)[39m[39m
[32m✔ whole run with standing operations is deterministic and keeps State sane [90m(16060.412156ms)[39m[39m
[32m✔ the scope of a Question is the scope of its faction: one Region, several Regions, or cells from more than half of the Country's Regions [90m(3.732332ms)[39m[39m
[32m✔ the length and the assembly of a debate follow that scope: Region 1 turn in its Region's assembly; several Regions 3 and country-wide 5 turns in the Country's assembly [90m(12.79312ms)[39m[39m
[32m✔ handling is derived: debated (a petitioning cell, discussed), consulted (no Petition, discussed), ignored (not discussed) [90m(1.834707ms)[39m[39m
[32m✔ petition: a Question of a petitioning cell that nobody discusses takes a large, slowly decaying Fairness modifier on that cell ONCE after the grace; a cell without Petition has no clock [90m(1.229049ms)[39m[39m
[32m✔ an expired debate leaves the minor modifier, and a MODERATE one (petition.expiryMult) on a petitioning cell; a concession of comparable size leaves none [90m(1.654151ms)[39m[39m
[32m✔ persuade: needs a Question that is being discussed, a positive amount and a Ledger that can pay; the Ledger pays, the faction gets a decaying Opinion modifier, the debate records the concession [90m(0.807007ms)[39m[39m
[32m✔ the persuade form builds an order and is a registered Action type [90m(0.235738ms)[39m[39m
[32m✔ no Retinue Right -> no armed rung, however angry; with the Right the cell raises a bloc, a war side that is not a Country [90m(1774.111612ms)[39m[39m
[32m✔ rebel units fight on the same machinery: they are supplied from held territory and the Government can besiege/retake it [90m(28039.313856ms)[39m[39m
[32m✔ suppression: rebels destroyed -> war ends, held provinces released, retinue labour released, martial law on the member cells costs Control and expires [90m(47634.836938ms)[39m[39m
[32m✔ concession: the Government offers Rights/Duties terms at the Peace Conference; accepted -> entries applied, armies disbanded, war ended; an empty offer to independence-seekers is refused [90m(2196.502267ms)[39m[39m
[32m✔ concession by grievance addressed: if every member cell calms (rung 0) for civil.calm.turns the conflict ends without terms [90m(1943.619157ms)[39m[39m
[32m✔ secession: holding all home provinces free of Government armies for civil.secede.turns forms a new Country (Formation); armies and provinces pass to it; the world keeps running [90m(5998.44135ms)[39m[39m
[32m✔ peace terms that grant secession form the Country too (Formation is a peace-conference outcome) [90m(1467.173707ms)[39m[39m
[32m✔ an AI Government fights the bloc with the same Action API; whole run deterministic, no negative stocks [90m(28047.945693ms)[39m[39m
[32m✔ scope coverage and specificity (Region broader than Estate/Nation) [90m(1.69695ms)[39m[39m
[32m✔ Rights resolve by most specific scope; Estate vs Nation tie -> latest declared; silence undefined [90m(0.32336ms)[39m[39m
[32m✔ Control stacks additively [90m(0.193124ms)[39m[39m
[32m✔ ModifierStack decays, has no spend [90m(0.33571ms)[39m[39m
[32m✔ Allocation Dial: floors by priority, shortfall truncates lowest, surplus by ratio, cap overflow redistributes [90m(0.691815ms)[39m[39m
[32m✔ Spending dial: reserve floor protects balance from discretionary; mandatory may dip; sink keeps [90m(0.270983ms)[39m[39m
[32m✔ Threshold binary, no refund; types must declare targetScale [90m(0.317948ms)[39m[39m
[32m✔ ClaimLedger is zero-sum and all-or-nothing [90m(0.311448ms)[39m[39m
[32m✔ Rng deterministic and resumable [90m(0.360492ms)[39m[39m
[32m✔ schema: validates types/enums/refs, fills defaults, lists placeholders [90m(0.917637ms)[39m[39m
[32m✔ schema: 'any' type accepts anything [90m(0.183082ms)[39m[39m
[32m✔ Mobility: needs the Right AND a Government gap; moves pro-rata stocks; population conserved; reactions target the Government [90m(4.437481ms)[39m[39m
[32m✔ Mobility: a too-small prestige gap blocks; revoking the Right stops flow but never reverts movers [90m(0.832364ms)[39m[39m
[32m✔ Demotion: only on negative net position and with compliance; closest prestige below; debt follows; Control gain; heavy opinion hit [90m(2.378795ms)[39m[39m
[32m✔ Rights/Duties reform action: sets scoped entries, most specific wins, null removes; unknown ids rejected, not thrown [90m(21.644971ms)[39m[39m
[32m✔ pipeline: reform + gap orders drive Mobility end to end; population conserved; deterministic [90m(28.740793ms)[39m[39m
[32m✔ Convergence: trigger is checklist distance 0 (a Council seat blocks it); declared route merges at step 8 and conserves everything [90m(10.264521ms)[39m[39m
[32m✔ Convergence: estate-forced route (top rung, defiance) runs the same merge; a later reform reverses it by pro-rata split [90m(6.522985ms)[39m[39m
[32m✔ propaganda (fast): bounded, never overshoots the ideal, reversible past the baseline sign, competing pushes add [90m(1.603414ms)[39m[39m
[32m✔ propaganda commitment: zero-sum with ordinary Teaching/Culture use; Government draws on its amalgam; Teaching moves the baseline; lift ends it [90m(12.891543ms)[39m[39m
[32m✔ counterPropaganda: a pushed cell with free Culture labour pulls itself back toward its baseline [90m(0.898553ms)[39m[39m
[32m✔ Teaching: moves labour toward the Profile, conserves headcount, never past target, committed labour untouched, extinct pools unreachable [90m(26.706653ms)[39m[39m
[32m✔ Teaching: Nation affinity biases the split; directed Teaching removes retraining capacity [90m(0.492205ms)[39m[39m
[32m✔ demo scenario, 25 turns with Mobility + Demotion + propaganda ordered: invariants hold and runs are deterministic [90m(40268.713236ms)[39m[39m
[32m✔ readPolityQueue: requisition hit = req.opinionHit x burden (share of the cell's output taken); drained [90m(2.471146ms)[39m[39m
[32m✔ readPolityQueue: a requisition that took nothing is no hit [90m(0.398663ms)[39m[39m
[32m✔ readPolityQueue: a credit default hits the creditor (Opinion and Fairness grievance) by its loss share; drained [90m(0.388688ms)[39m[39m
[32m✔ readPolityQueue: empty or missing queues are fine [90m(0.340075ms)[39m[39m
[32m✔ turn: a delivered requisition lands an Opinion hit on every requisitioned cell; a bigger take hits harder [90m(16.590576ms)[39m[39m
[32m✔ turn: without Control nothing is delivered, so there is no requisition hit [90m(3.862148ms)[39m[39m
[32m✔ turn: an obligation past the arrears limit defaults and hits the creditor [90m(3.415908ms)[39m[39m
[32m✔ the constant is 0.01 (authored) and f is the shortage of subsistence, else the abundance of comfort [90m(33.170859ms)[39m[39m
[32m✔ abundance: +1% x comfort satisfaction; the province stock and Nation presence grow by exactly the cell's change [90m(25.56718ms)[39m[39m
[32m✔ shortage: population falls by 1% x the subsistence shortfall, drawn from the Nation's presence [90m(29.803813ms)[39m[39m
[32m✔ growth is bounded by max_population_density; Wasteland takes nothing; decrease is never bounded [90m(55.904094ms)[39m[39m
[32m✔ committed labour (armies, retinues) neither breeds nor starves; free labour scales with the population [90m(34.988276ms)[39m[39m
[32m✔ 40 turns of the demo: density ceilings, presence <= population, and the Nation x Region population sums all keep holding [90m(30099.393421ms)[39m[39m
[32m✔ pop.growth = 0 switches it off exactly [90m(2708.027496ms)[39m[39m
[32m✔ migration keeps the total: growth off, migration on, 20 turns of the demo [90m(13210.755897ms)[39m[39m
[32m✔ actionRecord: public Government acts of this Country, signed by their loads; covert, cell, other-Country and unknown acts are ignored [90m(2.127811ms)[39m[39m
[32m✔ actionRecord: the realized direction on the entry (loads) wins over the type's static load; empty loads are silent [90m(0.372172ms)[39m[39m
[32m✔ actionRecord fades with age [90m(0.336325ms)[39m[39m
[32m✔ observedPortrait: scaled by awareness, squashed into (-1,+1) [90m(0.682155ms)[39m[39m
[32m✔ alignment: an aligned cell gains (scaled by opinion.alignGain), an opposed one loses, a silent record changes nothing [90m(0.938733ms)[39m[39m
[32m✔ opinionGov and compliance carry opinion.align x alignment: serving the cell's ideal raises them, opposing it lowers them [90m(0.871394ms)[39m[39m
[32m✔ the structural requisition hit is this channel, and direction matters: raising the take hurts an Investment-leaning cell, lifting it pleases it [90m(1.406404ms)[39m[39m
[32m✔ axisShift: a tax rise is Extraction, a cut is Investment, no change is silent [90m(1.575596ms)[39m[39m
[32m✔ axisShift: a bigger requisition is Extraction, a smaller or lifted one is Investment [90m(0.537299ms)[39m[39m
[32m✔ engine: the Decision Log entry carries the action id and the realized direction, taken before the law changed [90m(15.732708ms)[39m[39m
[32m✔ portrait: missing baseline reads as the amalgam, a stored baseline wins [90m(0.741ms)[39m[39m
[32m✔ reinforcePortrait pushes onto the stack, the readout clamps to +-1, ticking decays the stack [90m(0.59276ms)[39m[39m
[32m✔ a Government act reinforces its own Portrait toward the pole it acts on: a tax rise toward Extraction, a cut toward Investment (covert acts count too) [90m(7.587563ms)[39m[39m
[32m✔ cap 1: one listed Question is debated (a slot of the Government), the other WAITS and is not addressed, so its momentum keeps rising [90m(11.633849ms)[39m[39m
[32m✔ cap 2 (from Coordination): both are debated; the cap follows the Region's Coordination and is at least 1 [90m(1.760319ms)[39m[39m
[32m✔ agenda: a Petition holder claims a share of the slots and opens its own Questions; the Government keeps the rest; with a cap of 1 the ordering (Petition multiplier) decides [90m(1.389015ms)[39m[39m
[32m✔ an extension keeps the slot; lifting it ends the debate (expired) and frees the slot for the waiting Question [90m(1.738333ms)[39m[39m
[32m✔ economics.produceCCOByRegion: the Regions of a Country add up to the Country's envelope, per axis [90m(4214.45988ms)[39m[39m
[32m✔ the slate query: plain JSON, with statuses, assemblies, extensions and colonization; a real run keeps the books [90m(4077.488247ms)[39m[39m
[32m✔ forms: resettlement, expulsion, free colonization, capital, reorganization and the debate extensions build orders; every one is a registered Action type [90m(24.281481ms)[39m[39m
[32m✔ free colonization: without the commitment only the frontier pull acts; with it the pull rises and each arriving settler is paid from the Government ledger to the arriving cells [90m(3.574252ms)[39m[39m
[32m✔ free colonization lapses while the ledger is empty; arrivals in settled provinces are never paid [90m(0.553127ms)[39m[39m
[32m✔ free colonization: validate needs a Government order with a positive incentive; lifting removes only your own commitment [90m(1.00524ms)[39m[39m
[32m✔ momentum: an unaddressed Question rises as before [90m(1.216679ms)[39m[39m
[32m✔ momentum: listed on the slate (attention) the rise is frozen and a debate starts; when the debate ends the rise resumes although it is still listed [90m(2.795421ms)[39m[39m
[32m✔ momentum: a routine Question in standing administration counts as addressed; the momentum it already has still decays [90m(0.70828ms)[39m[39m
[32m✔ slate readout: an open debate that the slate no longer lists reads as debate; a Question nobody took up is unaddressed [90m(1.164046ms)[39m[39m
[32m✔ scope syntax: the six kinds + empire, and the impossible (Nation, Estate) pair is an error, not a guess [90m(1.759978ms)[39m[39m
[32m✔ forms: scope-aware drafts carry the chosen Scope; every form builds with its own defaults; JSON/number parsing; gating info [90m(96.18574ms)[39m[39m
[32m✔ queries are read-only, JSON-serialisable and consistent with State [90m(1081.073943ms)[39m[39m
[32m✔ Laws matrix: a scoped reform shows up as an override in exactly that column [90m(1039.537756ms)[39m[39m
[32m✔ preview: validation, gating verdicts (who would refuse), foreign DomainVeto; orders can be queued and removed [90m(101.278113ms)[39m[39m
[32m✔ world readouts: pair sheet, mirror and treaties reflect Diplomacy State [90m(132.657455ms)[39m[39m
[32m✔ movement graph: Mountain interior blocked unless pass; paths exist elsewhere [90m(36.30436ms)[39m[39m
[32m✔ declareWar: executes (no Veto.war holder), schedules effects: active only after hostilitiesBegin; unknown target rejected [90m(1798.635865ms)[39m[39m
[32m✔ fieldUnits: commits labour, consumes weapons, creates an army; invalid orders are rejected with reasons [90m(1674.175693ms)[39m[39m
[32m✔ battle: the larger, better-supplied army wins; casualties come out of origin cells; war harm and score are logged; loser retreats or dies [90m(3863.383171ms)[39m[39m
[32m✔ siege -> occupation -> peace: capture raises security grievance; ratified peace cedes the province and Regions re-derive with totals conserved [90m(5328.010884ms)[39m[39m
[32m✔ peace is refused when the other side is strong and not exhausted [90m(2216.42628ms)[39m[39m
[32m✔ war run (25 turns) is deterministic and keeps invariants [90m(29566.815705ms)[39m[39m
[32m✔ AI Government (same Action API) raises and marches an army once war is on; run stays deterministic [90m(12343.966503ms)[39m[39m
[32m✔ every hex is a province: 25 x 20 = 500, terrain from the ten-terrain set [90m(1.141402ms)[39m[39m
[32m✔ deterministic per seed, different between seeds [90m(82.190253ms)[39m[39m
[32m✔ Sea provinces: no forestation, no anchor, a waterBody kind; land provinces have none [90m(0.615183ms)[39m[39m
[32m✔ forestation stays inside the kb ceiling of its terrain [90m(0.540298ms)[39m[39m
[32m✔ lakes are small and enclosed; seas are the rest [90m(0.288398ms)[39m[39m
[32m✔ water source: land next to a lake is river-adjacent (river first), else next to a sea is coastal [90m(1.245186ms)[39m[39m
[32m✔ starting-population anchors: Grassland 10,000, Taiga and Mountain 1,000, the rest scaled, never below the floor [90m(0.405721ms)[39m[39m
[32m✔ balance sanity (placeholder bounds): land share, several landmasses, most terrains present, no isolated land specks [90m(2.938075ms)[39m[39m
[32m✔ odd-r neighbours are symmetric and distance matches [90m(9.138093ms)[39m[39m
[32m✔ mountain interior edges blocked unless pass; mountain<->other open [90m(0.285618ms)[39m[39m
[32m✔ regions: contiguous, same owner, 6-8 hexes, deterministic, stable under unrelated change [90m(15.283993ms)[39m[39m
[32m✔ fracture split by Nations presence preserves extensive totals; merge sums [90m(0.8566ms)[39m[39m
[32m✔ migration: people move toward the Region with better satisfaction; stocks follow pro rata, nothing is created or lost [90m(3.698824ms)[39m[39m
[32m✔ migration: equal satisfaction means no flow; a Region never pulls from a better one [90m(1.800378ms)[39m[39m
[32m✔ migration: a Movement autonomy Right that is false blocks it; so does a LaborMigrationBan between the two owners [90m(3.161469ms)[39m[39m
[32m✔ migration into a Region without the Nation's cell creates it, keeping Nation and Estate [90m(0.551323ms)[39m[39m
[32m✔ moveCohort: capped by presence and room; a Wasteland province becomes Frontier and then Settled by the people living there; water needs the capability flag [90m(0.722452ms)[39m[39m
[32m✔ settle (cell action): proposes the frontier province of its own Country, utility needs crowding, validate respects the Settlement Right, apply queues and step 8 pays and moves [90m(1.417617ms)[39m[39m
[32m✔ direct resettlement: planned (preview), queued, applied; stocks follow, the source cell takes an opinion hit, bad orders are rejected with reasons [90m(1.15655ms)[39m[39m
[32m✔ Expulsion: needs a bordering province of another Country and no LaborMigrationBan; confiscates a share to the Government; the expelled cell takes the hit; kin states get a Rights CB [90m(1.073792ms)[39m[39m
[32m✔ a resettlement through a real turn: queued by the order, applied at step 8; a Reorganization-free turn keeps the books; a stale order is dropped whole [90m(20.652783ms)[39m[39m
[32m✔ step 8 runs migration after growth (and before queued moves); the whole pass is deterministic [90m(1.746915ms)[39m[39m
[32m✔ split: new ids for every part, capitals recorded, the old id replaced, the input untouched [90m(2.436682ms)[39m[39m
[32m✔ split: rejected unless the parts partition the Region, are contiguous, have a capital inside, and the Region is the actor's [90m(0.828403ms)[39m[39m
[32m✔ merge: adjacent Regions of the actor become one new Region with the named capital; non-adjacent, foreign or capital-less merges are rejected [90m(0.530342ms)[39m[39m
[32m✔ move: a province changes Region while both stay contiguous; the donor's stored capital cannot leave unannounced [90m(0.463767ms)[39m[39m
[32m✔ ops chain: a Region made by one op can be used by the next; targets() follows the chain [90m(0.438136ms)[39m[39m
[32m✔ retargetLaws: a removed Region's entries are copied to its successors (all scope kinds with a region); merges keep the later Duty and the larger Requisition [90m(1.497122ms)[39m[39m
[32m✔ regionCapitalOf: the stored capital while valid, else the most populous province (ties by id) [90m(0.450751ms)[39m[39m
[32m✔ a Reorganization through a real turn: queued by the order, applied at step 8; cells, laws and capitals follow; the next turn runs [90m(18.767907ms)[39m[39m
[32m✔ a bad Reorganization is rejected with its reasons, not thrown; an order that stops being valid before step 8 is dropped whole [90m(5.960904ms)[39m[39m
[32m✔ setRegionCapital: stored at once for a province of the actor's Region; anything else is rejected [90m(11.227285ms)[39m[39m
[32m✔ the ruleset has ten terrains with Sea (a water terrain), water capability and traversal; Grassland carries 10x the people of Taiga [90m(2.874354ms)[39m[39m
[32m✔ the generated terrain becomes a world document with every hex a province; water provinces are unowned Wasteland with a waterBody and a derived hex surface [90m(93.653953ms)[39m[39m
[32m✔ the schema accepts the world document (waterBody, Sea terrain) and the validators find no water problem in it [90m(14.599079ms)[39m[39m
[32m✔ validators: a hex without a province, a wrong surface, a Sea province without waterBody, an owned or inhabited water province, a land province with a waterBody, a ruleset without Sea [90m(27.269072ms)[39m[39m
[32m✔ war graph: armies on foot cannot enter or cross a Sea or lake province; land steps cost 1; without the traversal data nothing changes [90m(1.189371ms)[39m[39m
[34mℹ tests 236[39m
[34mℹ suites 0[39m
[34mℹ pass 232[39m
[34mℹ fail 4[39m
[34mℹ cancelled 0[39m
[34mℹ skipped 0[39m
[34mℹ todo 0[39m
[34mℹ duration_ms 443563.801607[39m

[31m✖ failing tests:[39m

test at tests/client.test.js:9:1
[31m✖ demo package loads: 118 provinces, sea/lake hexes are not provinces, regions 6-12 hexes, cells reference real regions [90m(34.932112ms)[39m[39m
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  140 !== 118
  
      at TestContext.<anonymous> (file:///workspaces/Elental/tests/client.test.js:11:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 140,
    expected: 118,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/decision.test.js:71:1
[31m✖ nothing may gate it: a covering Veto holder who refuses blocks the decision even above the bar; one who approves does not [90m(1.679793ms)[39m[39m
  AssertionError [ERR_ASSERTION]: agenda holders plus the Veto holders of the domain
  + actual - expected
  
    [
  -   'k|peasants|r1',
      'v|peasants|r1'
    ]
  
      at file:///workspaces/Elental/tests/decision.test.js:75:12
      at withMajority (file:///workspaces/Elental/tests/decision.test.js:37:149)
      at TestContext.<anonymous> (file:///workspaces/Elental/tests/decision.test.js:73:3)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1402:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:974:18)
      at Test.postRun (node:internal/test_runner/test:1542:19)
      at Test.run (node:internal/test_runner/test:1467:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: [ 'v|peasants|r1' ],
    expected: [ 'k|peasants|r1', 'v|peasants|r1' ],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }

test at tests/editor.test.js:31:1
[31m✖ validators catch broken data with a jump-to path [90m(302.870822ms)[39m[39m
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(s.errors.some(i => i.id === 'waterProvince'))
  
      at TestContext.<anonymous> (file:///workspaces/Elental/tests/editor.test.js:38:118)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/editor.test.js:40:1
[31m✖ setSurface to sea removes the province, its presence, warehouse and incident edges; the cell sums then need reseeding [90m(59.105622ms)[39m[39m
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  
  + [
  +   {
  +     id: 'hexNoProvince',
  +     message: 'hex h:9,3 has no province (every hex is a province, water included)',
  +     path: '/world/hexes/h:9,3',
  +     severity: 'error'
  +   }
  + ]
  - []
  
      at TestContext.<anonymous> (file:///workspaces/Elental/tests/editor.test.js:43:129)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: [ { id: 'hexNoProvince', severity: 'error', path: '/world/hexes/h:9,3', message: 'hex h:9,3 has no province (every hex is a province, water included)' } ],
    expected: [],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }
