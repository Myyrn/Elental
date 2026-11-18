
> test
> node --test tests/kernel.test.js tests/worldmap.test.js tests/engine.test.js tests/econ_polity.test.js tests/client.test.js tests/behaviour.test.js tests/war.test.js tests/editor.test.js tests/politics_remaining.test.js tests/internal_conflict.test.js tests/diplomacy.test.js tests/population.test.js tests/ui.test.js tests/espionage.test.js tests/ai_diplomacy.test.js tests/economics_upkeep.test.js tests/economics_zones.test.js tests/polity_queue.test.js tests/portrait.test.js tests/administration.test.js tests/worldmap_reorg.test.js

[32m✔ fixture: the Questions are the tiers the tests assume [90m(9.650887ms)[39m[39m
[32m✔ slate: a fixed Coordination threshold per tier, existential first, then structural by priority; routine overhead is paid first [90m(35.369901ms)[39m[39m
[32m✔ slate: within a tier the larger gap x Weight comes first; what does not fit is left off [90m(1.281699ms)[39m[39m
[32m✔ slate: a Question that does not fit is skipped, lower ones that still fit are taken (existential crowds out, never removes) [90m(1.178089ms)[39m[39m
[32m✔ slate: Government propaganda is paid from the same Coordination pool [90m(2.71275ms)[39m[39m
[32m✔ routine tier: no slate commitment, a continuous overhead per Question; when Coordination runs short the lowest priority drop out of standing administration [90m(7.226534ms)[39m[39m
[32m✔ step6 is deterministic and writes only attention and standing [90m(2.845349ms)[39m[39m
[32m✔ through a real turn the slate is written at step 6 for the next turn [90m(38.095381ms)[39m[39m
[32m✔ posture: the player is treated exactly like any other Country [90m(14.64531ms)[39m[39m
[32m✔ posture: hysteresis keeps the current Posture just under a boundary, a fresh one does not [90m(0.429091ms)[39m[39m
[32m✔ campaign: switching type needs a margin, so small value changes do not flip it [90m(7.60886ms)[39m[39m
[32m✔ campaign: a new CB bypasses the margin [90m(0.530488ms)[39m[39m
[32m✔ campaign: Strike needs a usable CB and finishes with a goal proportionate to its tier [90m(11.549334ms)[39m[39m
[32m✔ candidates: roles whose ActionType is not registered are skipped [90m(2.254486ms)[39m[39m
[32m✔ selection: binary thresholds, a candidate is funded fully or skipped, never partially [90m(6.700615ms)[39m[39m
[32m✔ false flag: a self-targeted one is priced when allowed and dropped when Diplomacy refuses it [90m(1.432102ms)[39m[39m
[32m✔ false flag: a frame is offered only inside the detection window [90m(4.680312ms)[39m[39m
[32m✔ negotiation: accept, silence or reject by posture toward the proposer [90m(1.222441ms)[39m[39m
[32m✔ agent: deterministic, does not mutate state, and persists only through the cache [90m(40.360013ms)[39m[39m
[32m✔ gating: a Veto holder refuses a costly law; forcing it through registers entitlement loss that decays [90m(5023.490905ms)[39m[39m
[32m✔ gating: no covering Right means the action simply executes; a relief (tax cut) is approved [90m(1145.416415ms)[39m[39m
[32m✔ cell actions: below the rung nothing is available; at rung 2 an angry, uncoerced cell refuses tax; Control suppresses it [90m(143.89464ms)[39m[39m
[32m✔ taxRefusal reduces delivered tax; hoarding withholds goods and releases them when it stops [90m(3678.122236ms)[39m[39m
[32m✔ buildTradeInfra: rich cells invest unprompted; infrastructure decays without upkeep [90m(716.435435ms)[39m[39m
[32m✔ factions are derived per issue from live Questions and carry Weight-aggregated momentum [90m(180.770923ms)[39m[39m
[32m✔ long run (40 turns) with acting cells keeps invariants and stays deterministic [90m(52128.600545ms)[39m[39m
[32m✔ demo package loads: 118 provinces, sea/lake hexes are not provinces, regions 6-12 hexes, cells reference real regions [90m(39.36697ms)[39m[39m
[32m✔ real Action pipeline: setTaxLaw changes the law, placeRequisition fills Government inventory, bad order is rejected not thrown [90m(2456.150018ms)[39m[39m
[32m✔ 20 turns: invariants hold (Wealth >= 0, Ledger >= 0, grievance/satisfaction in [0,1], population within the 1%-per-turn growth bound) [90m(10474.466849ms)[39m[39m
[32m✔ determinism: two runs of the same scenario give identical state [90m(4908.099106ms)[39m[39m
[32m✔ state shape: no stored aggregate of Leverage; the four categories are readouts, scope = a Country or an alliance bloc [90m(246.042832ms)[39m[39m
[32m✔ Reputational Leverage: decaying per-(observer, subject) stack, separate from everything else; an active Alliance adds a standing bonus as a readout [90m(26.323738ms)[39m[39m
[32m✔ proposals: an AI recipient decides at once; a player recipient answers; Dependency burdens are refused; identical pending proposals are rejected [90m(2761.689852ms)[39m[39m
[32m✔ ratification consults the treaty Veto holders like any gated act: a cell holding Veto.treaty can refuse what the Government accepts [90m(1258.559555ms)[39m[39m
[32m✔ CBs: state-based while the fact holds (occupation, no timer); structural derived (claims, nationalism, militaristic); event-based decay and persistence scales with tier [90m(35.344399ms)[39m[39m
[32m✔ Sanctions: ad hoc ones give the target a Grievance CB, great-power-backed ones do not; stripsCB removes external recognition of the target's CBs [90m(1776.501019ms)[39m[39m
[32m✔ overreach is judged against the goals claimed and applied PER OBSERVER, scaled by closeness to the victim — never global [90m(1260.010698ms)[39m[39m
[32m✔ war chain = treaty-graph propagation: Guarantee and Defensive defend, StandingOffensive/Coalition follow the attacker, Defensive needs a recognised cause, treaties forbid wars between partners [90m(2585.089649ms)[39m[39m
[32m✔ denouncing a treaty is a broken promise: reputation loss with the other party, an event-based CB held by the wronged party; lifting a Sanction is no breach [90m(1700.746767ms)[39m[39m
[32m✔ axis hooks: MilitaryCap bounds fielding, ResourceExportBan/TradeAccess zero the edge, DomainVeto is a foreign Veto that cannot be forced, ForeignPolicy needs the grantee's consent [90m(3863.720694ms)[39m[39m
[32m✔ recognition route: rebels take it (independence goal / refused), a foreign Government recognises, backing secession is CB-generating against the parent, a Guarantee pulls the guarantor into the war [90m(6482.32991ms)[39m[39m
[32m✔ recognition is only open to rebels who took the route (a concession-seeking bloc is not recognisable until refused); AI kin-states recognise and guarantee on their own [90m(3553.821389ms)[39m[39m
[32m✔ FacilitationGrant: a real zero-sum transfer of a good from the grantor's warehouse to a bloc's held province [90m(1196.242984ms)[39m[39m
[32m✔ demo run: diplomacy orders mid-run keep the world consistent and deterministic [90m(14155.782077ms)[39m[39m
[32m✔ turn runs end-to-end; deterministic and pure [90m(16.975465ms)[39m[39m
[32m✔ production: extraction scales with labour (diminishing) and Wasteland yields nothing [90m(17.632197ms)[39m[39m
[32m✔ cascade: well supplied cells are fully satisfied; goods are conserved (no creation by buying) [90m(2.112441ms)[39m[39m
[32m✔ cascade is tier-first under a cash limit: subsistence is bought before comfort [90m(1.915774ms)[39m[39m
[32m✔ taxation: delivered = claimed x involuntary compliance; Wealth never negative [90m(5.262386ms)[39m[39m
[32m✔ Ledger: spending dial vs start-of-turn balance; never negative; unmet upkeep fraction [90m(4.246453ms)[39m[39m
[32m✔ requisition: delivered scaled by involuntary compliance, goods land in Government inventory [90m(2.717817ms)[39m[39m
[32m✔ polity: shortage accumulates existential grievance fast, then Question + momentum + rung; recovery decays slowly [90m(11.210393ms)[39m[39m
[32m✔ polity: Question exists iff grievance > compliance (independent of slate) [90m(0.735784ms)[39m[39m
[32m✔ credit: shortfall cells borrow from cash-rich cells via explicit obligation records (no anonymous debts) [90m(2.755546ms)[39m[39m
[32m✔ produceCCO: no committed units gives nothing [90m(2.340153ms)[39m[39m
[32m✔ produceCCO is linear in committed units (kb rev 2: no division by total units) [90m(1.184517ms)[39m[39m
[32m✔ produceCCO: poolUnmet[pool] = 0.5 halves that pool only [90m(0.353979ms)[39m[39m
[32m✔ Allocation Dial rows carry the entry pool tag [90m(0.454194ms)[39m[39m
[32m✔ poolUnmetFrom: only mandatory tagged rows, grants over floors per pool, met pools absent [90m(0.355627ms)[39m[39m
[32m✔ ledger: poolUnmet written per pool from tagged mandatory rows; replaced every turn; degrades produceCCO next turn [90m(19.244043ms)[39m[39m
[32m✔ ledger: no tagged rows leaves poolUnmet empty [90m(3.852044ms)[39m[39m
[32m✔ zones: an unrestricted border does not split a zone (zones are not bounded by Country borders) [90m(4.010956ms)[39m[39m
[32m✔ zones: a single-owner world is unchanged [90m(0.41215ms)[39m[39m
[32m✔ zones: an embargo or a ban on every good closes the border and splits the zone [90m(1.570092ms)[39m[39m
[32m✔ zones: partial restriction scales the pull but does not split above the floor [90m(2.706492ms)[39m[39m
[32m✔ zones: below zone.openFloor (0.1) a border counts as closed; above it, open [90m(0.881328ms)[39m[39m
[32m✔ zones: unowned land or water never pulls across an owner boundary [90m(0.35593ms)[39m[39m
[32m✔ zoneEdges: a split gives one edge between the two hubs; a merged zone has none [90m(0.621981ms)[39m[39m
[32m✔ borderOpenness: 1 unrestricted / same owner / unowned; 0 under embargo [90m(0.602678ms)[39m[39m
[32m✔ ownerTradeFactor agrees with treaties.tradeFactor for every good, in both directions [90m(1.052489ms)[39m[39m
[32m✔ the demo package validates without errors; the numbers-pass worklist lists placeholders [90m(38.523707ms)[39m[39m
[32m✔ patch engine: apply then inverse restores the documents exactly (objects and arrays) [90m(5.465645ms)[39m[39m
[32m✔ store: terrain painting clamps forestation, marks provinces manual, undo/redo, and a brush stroke (mergeKey) is ONE undo step [90m(159.761178ms)[39m[39m
[32m✔ validators catch broken data with a jump-to path [90m(226.256115ms)[39m[39m
[32m✔ setSurface to sea removes the province, its presence, warehouse and incident edges; the cell sums then need reseeding [90m(110.150581ms)[39m[39m
[32m✔ generators: seedCells satisfies the sum constraints; derivedWaterSource follows the precedence (river first); normalisePresence fixes sums [90m(85.326451ms)[39m[39m
[32m✔ editor -> game round trip: a blank scenario from the template is valid, can be edited, saved, bundled, loaded and played headless [90m(752.843495ms)[39m[39m
[32m✔ resolveTurn is pure and deterministic; steps run in order; RNG only advances state [90m(3.258462ms)[39m[39m
[32m✔ gating: refusal blocks; forceThroughControl executes and registers entitlement loss [90m(0.799112ms)[39m[39m
[32m✔ scheduler: war declaration resolves at step 7 now and hostilities at step 4 next turn [90m(0.450188ms)[39m[39m
[32m✔ registry rejects threshold-bound types without targetScale [90m(0.310361ms)[39m[39m
[32m✔ the demo now carries Espionage labour, and the free pool is the labour not yet committed to operations or counter-intelligence [90m(35.764019ms)[39m[39m
[32m✔ threshold: binary, no refund, no benefit beyond it; scaled by the TARGET Region's population and never by the opponent's size [90m(265.862377ms)[39m[39m
[32m✔ overt propaganda exports the sender's Portrait into the target Region's cells, is open (no CB, sender known); covert pushes any point [90m(112.392387ms)[39m[39m
[32m✔ covert influence writes Opinion (target-agnostic) and injects Grievance into that Region only [90m(24.330285ms)[39m[39m
[32m✔ detection = Observation + counter-intelligence (additive); act detected at the concealment threshold, sender revealed only at the higher one [90m(18.486225ms)[39m[39m
[32m✔ revealing the sender gives the victim a CB (Rights for influence, Grievance for propaganda) and costs the sender Reputational Leverage; a merely detected act names nobody [90m(81.831755ms)[39m[39m
[32m✔ false flag: the blame lands on the apparent sender until detection reaches the false-flag threshold; seeing through it exposes the TRUE sender (Reputation + CB) [90m(20.469115ms)[39m[39m
[32m✔ actions: zero-sum Espionage labour, own-Region counter-intelligence, validation, lift; ops run each turn through the engine; Observation dial reallocates detection [90m(5145.060199ms)[39m[39m
[32m✔ whole run with standing operations is deterministic and keeps State sane [90m(12283.738332ms)[39m[39m
[32m✔ no Retinue Right -> no armed rung, however angry; with the Right the cell raises a bloc, a war side that is not a Country [90m(1696.569578ms)[39m[39m
[32m✔ rebel units fight on the same machinery: they are supplied from held territory and the Government can besiege/retake it [90m(21035.945942ms)[39m[39m
[32m✔ suppression: rebels destroyed -> war ends, held provinces released, retinue labour released, martial law on the member cells costs Control and expires [90m(26614.755484ms)[39m[39m
[32m✔ concession: the Government offers Rights/Duties terms at the Peace Conference; accepted -> entries applied, armies disbanded, war ended; an empty offer to independence-seekers is refused [90m(1997.176584ms)[39m[39m
[32m✔ concession by grievance addressed: if every member cell calms (rung 0) for civil.calm.turns the conflict ends without terms [90m(1630.53861ms)[39m[39m
[32m✔ secession: holding all home provinces free of Government armies for civil.secede.turns forms a new Country (Formation); armies and provinces pass to it; the world keeps running [90m(4772.149984ms)[39m[39m
[32m✔ peace terms that grant secession form the Country too (Formation is a peace-conference outcome) [90m(1263.778227ms)[39m[39m
[32m✔ an AI Government fights the bloc with the same Action API; whole run deterministic, no negative stocks [90m(20542.762333ms)[39m[39m
[32m✔ scope coverage and specificity (Region broader than Estate/Nation) [90m(1.742336ms)[39m[39m
[32m✔ Rights resolve by most specific scope; Estate vs Nation tie -> latest declared; silence undefined [90m(0.356236ms)[39m[39m
[32m✔ Control stacks additively [90m(0.195217ms)[39m[39m
[32m✔ ModifierStack decays, has no spend [90m(0.304478ms)[39m[39m
[32m✔ Allocation Dial: floors by priority, shortfall truncates lowest, surplus by ratio, cap overflow redistributes [90m(0.704533ms)[39m[39m
[32m✔ Spending dial: reserve floor protects balance from discretionary; mandatory may dip; sink keeps [90m(0.264728ms)[39m[39m
[32m✔ Threshold binary, no refund; types must declare targetScale [90m(0.347227ms)[39m[39m
[32m✔ ClaimLedger is zero-sum and all-or-nothing [90m(0.294602ms)[39m[39m
[32m✔ Rng deterministic and resumable [90m(0.403835ms)[39m[39m
[32m✔ schema: validates types/enums/refs, fills defaults, lists placeholders [90m(0.870611ms)[39m[39m
[32m✔ schema: 'any' type accepts anything [90m(0.186727ms)[39m[39m
[32m✔ Mobility: needs the Right AND a Government gap; moves pro-rata stocks; population conserved; reactions target the Government [90m(3.478922ms)[39m[39m
[32m✔ Mobility: a too-small prestige gap blocks; revoking the Right stops flow but never reverts movers [90m(0.98332ms)[39m[39m
[32m✔ Demotion: only on negative net position and with compliance; closest prestige below; debt follows; Control gain; heavy opinion hit [90m(3.138666ms)[39m[39m
[32m✔ Rights/Duties reform action: sets scoped entries, most specific wins, null removes; unknown ids rejected, not thrown [90m(18.957885ms)[39m[39m
[32m✔ pipeline: reform + gap orders drive Mobility end to end; population conserved; deterministic [90m(27.203567ms)[39m[39m
[32m✔ Convergence: trigger is checklist distance 0 (a Council seat blocks it); declared route merges at step 8 and conserves everything [90m(10.005833ms)[39m[39m
[32m✔ Convergence: estate-forced route (top rung, defiance) runs the same merge; a later reform reverses it by pro-rata split [90m(6.069424ms)[39m[39m
[32m✔ propaganda (fast): bounded, never overshoots the ideal, reversible past the baseline sign, competing pushes add [90m(3.135337ms)[39m[39m
[32m✔ propaganda commitment: zero-sum with ordinary Teaching/Culture use; Government draws on its amalgam; Teaching moves the baseline; lift ends it [90m(11.690954ms)[39m[39m
[32m✔ counterPropaganda: a pushed cell with free Culture labour pulls itself back toward its baseline [90m(0.774249ms)[39m[39m
[32m✔ Teaching: moves labour toward the Profile, conserves headcount, never past target, committed labour untouched, extinct pools unreachable [90m(26.495451ms)[39m[39m
[32m✔ Teaching: Nation affinity biases the split; directed Teaching removes retraining capacity [90m(0.476697ms)[39m[39m
[32m✔ demo scenario, 25 turns with Mobility + Demotion + propaganda ordered: invariants hold and runs are deterministic [90m(28359.305807ms)[39m[39m
[32m✔ readPolityQueue: requisition hit = req.opinionHit x burden (share of the cell's output taken); drained [90m(2.374746ms)[39m[39m
[32m✔ readPolityQueue: a requisition that took nothing is no hit [90m(0.350611ms)[39m[39m
[32m✔ readPolityQueue: a credit default hits the creditor (Opinion and Fairness grievance) by its loss share; drained [90m(0.418087ms)[39m[39m
[32m✔ readPolityQueue: empty or missing queues are fine [90m(0.277119ms)[39m[39m
[32m✔ turn: a delivered requisition lands an Opinion hit on every requisitioned cell; a bigger take hits harder [90m(15.920922ms)[39m[39m
[32m✔ turn: without Control nothing is delivered, so there is no requisition hit [90m(4.972331ms)[39m[39m
[32m✔ turn: an obligation past the arrears limit defaults and hits the creditor [90m(6.387528ms)[39m[39m
[32m✔ the constant is 0.01 (authored) and f is the shortage of subsistence, else the abundance of comfort [90m(31.892685ms)[39m[39m
[32m✔ abundance: +1% x comfort satisfaction; the province stock and Nation presence grow by exactly the cell's change [90m(23.709504ms)[39m[39m
[32m✔ shortage: population falls by 1% x the subsistence shortfall, drawn from the Nation's presence [90m(36.927115ms)[39m[39m
[32m✔ growth is bounded by max_population_density; Wasteland takes nothing; decrease is never bounded [90m(68.840597ms)[39m[39m
[32m✔ committed labour (armies, retinues) neither breeds nor starves; free labour scales with the population [90m(30.916811ms)[39m[39m
[32m✔ 40 turns of the demo: density ceilings, presence <= population, and the Nation x Region population sums all keep holding [90m(21500.507059ms)[39m[39m
[32m✔ pop.growth = 0 switches it off exactly [90m(2686.696379ms)[39m[39m
[32m✔ actionRecord: public Government acts of this Country, signed by their loads; covert, cell, other-Country and unknown acts are ignored [90m(2.182074ms)[39m[39m
[32m✔ actionRecord: the realized direction on the entry (loads) wins over the type's static load; empty loads are silent [90m(0.405386ms)[39m[39m
[32m✔ actionRecord fades with age [90m(0.325288ms)[39m[39m
[32m✔ observedPortrait: scaled by awareness, squashed into (-1,+1) [90m(0.681163ms)[39m[39m
[32m✔ alignment: an aligned cell gains (scaled by opinion.alignGain), an opposed one loses, a silent record changes nothing [90m(0.983664ms)[39m[39m
[32m✔ opinionGov and compliance carry opinion.align x alignment: serving the cell's ideal raises them, opposing it lowers them [90m(0.846351ms)[39m[39m
[32m✔ the structural requisition hit is this channel, and direction matters: raising the take hurts an Investment-leaning cell, lifting it pleases it [90m(0.842868ms)[39m[39m
[32m✔ axisShift: a tax rise is Extraction, a cut is Investment, no change is silent [90m(2.327121ms)[39m[39m
[32m✔ axisShift: a bigger requisition is Extraction, a smaller or lifted one is Investment [90m(0.543644ms)[39m[39m
[32m✔ engine: the Decision Log entry carries the action id and the realized direction, taken before the law changed [90m(14.663759ms)[39m[39m
[32m✔ portrait: missing baseline reads as the amalgam, a stored baseline wins [90m(0.79814ms)[39m[39m
[32m✔ reinforcePortrait pushes onto the stack, the readout clamps to +-1, ticking decays the stack [90m(0.464678ms)[39m[39m
[32m✔ a Government act reinforces its own Portrait toward the pole it acts on: a tax rise toward Extraction, a cut toward Investment (covert acts count too) [90m(6.91279ms)[39m[39m
[32m✔ scope syntax: the six kinds + empire, and the impossible (Nation, Estate) pair is an error, not a guess [90m(2.84638ms)[39m[39m
[32m✔ forms: scope-aware drafts carry the chosen Scope; every form builds with its own defaults; JSON/number parsing; gating info [90m(96.025991ms)[39m[39m
[32m✔ queries are read-only, JSON-serialisable and consistent with State [90m(965.237801ms)[39m[39m
[32m✔ Laws matrix: a scoped reform shows up as an override in exactly that column [90m(919.405291ms)[39m[39m
[32m✔ preview: validation, gating verdicts (who would refuse), foreign DomainVeto; orders can be queued and removed [90m(104.334745ms)[39m[39m
[32m✔ world readouts: pair sheet, mirror and treaties reflect Diplomacy State [90m(129.42338ms)[39m[39m
[32m✔ movement graph: Mountain interior blocked unless pass; paths exist elsewhere [90m(36.042587ms)[39m[39m
[32m✔ declareWar: executes (no Veto.war holder), schedules effects: active only after hostilitiesBegin; unknown target rejected [90m(1899.296097ms)[39m[39m
[32m✔ fieldUnits: commits labour, consumes weapons, creates an army; invalid orders are rejected with reasons [90m(1721.168371ms)[39m[39m
[32m✔ battle: the larger, better-supplied army wins; casualties come out of origin cells; war harm and score are logged; loser retreats or dies [90m(3577.938379ms)[39m[39m
[32m✔ siege -> occupation -> peace: capture raises security grievance; ratified peace cedes the province and Regions re-derive with totals conserved [90m(5412.85107ms)[39m[39m
[32m✔ peace is refused when the other side is strong and not exhausted [90m(2198.077111ms)[39m[39m
[32m✔ war run (25 turns) is deterministic and keeps invariants [90m(30741.762296ms)[39m[39m
[32m✔ AI Government (same Action API) raises and marches an army once war is on; run stays deterministic [90m(12874.822631ms)[39m[39m
[32m✔ odd-r neighbours are symmetric and distance matches [90m(11.260996ms)[39m[39m
[32m✔ mountain interior edges blocked unless pass; mountain<->other open [90m(0.286561ms)[39m[39m
[32m✔ regions: contiguous, same owner, 6-8 hexes, deterministic, stable under unrelated change [90m(11.209509ms)[39m[39m
[32m✔ fracture split by Nations presence preserves extensive totals; merge sums [90m(0.842003ms)[39m[39m
[32m✔ split: new ids for every part, capitals recorded, the old id replaced, the input untouched [90m(2.438102ms)[39m[39m
[32m✔ split: rejected unless the parts partition the Region, are contiguous, have a capital inside, and the Region is the actor's [90m(0.868501ms)[39m[39m
[32m✔ merge: adjacent Regions of the actor become one new Region with the named capital; non-adjacent, foreign or capital-less merges are rejected [90m(0.540144ms)[39m[39m
[32m✔ move: a province changes Region while both stay contiguous; the donor's stored capital cannot leave unannounced [90m(0.468125ms)[39m[39m
[31m✖ ops chain: a Region made by one op can be used by the next; targets() follows the chain [90m(1.357444ms)[39m[39m
[32m✔ retargetLaws: a removed Region's entries are copied to its successors (all scope kinds with a region); merges keep the later Duty and the larger Requisition [90m(0.794979ms)[39m[39m
[32m✔ regionCapitalOf: the stored capital while valid, else the most populous province (ties by id) [90m(0.360898ms)[39m[39m
[32m✔ a Reorganization through a real turn: queued by the order, applied at step 8; cells, laws and capitals follow; the next turn runs [90m(17.91993ms)[39m[39m
[32m✔ a bad Reorganization is rejected with its reasons, not thrown; an order that stops being valid before step 8 is dropped whole [90m(5.147103ms)[39m[39m
[32m✔ setRegionCapital: stored at once for a province of the actor's Region; anything else is rejected [90m(11.143279ms)[39m[39m
[34mℹ tests 177[39m
[34mℹ suites 0[39m
[34mℹ pass 176[39m
[34mℹ fail 1[39m
[34mℹ cancelled 0[39m
[34mℹ skipped 0[39m
[34mℹ todo 0[39m
[34mℹ duration_ms 337836.440302[39m

[31m✖ failing tests:[39m

test at tests/worldmap_reorg.test.js:63:1
[31m✖ ops chain: a Region made by one op can be used by the next; targets() follows the chain [90m(1.357444ms)[39m[39m
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
