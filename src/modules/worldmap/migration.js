// worldmap/migration.js — gradual migration, settlement, direct resettlement and Expulsion (world_map__kb: Population dynamics; spec: world_map__spec.md, 2026-11-19).
// Everything here moves PEOPLE of one Nation between provinces. The Estate cells follow by the Region-split rule (polity/transfer.js `transferCohort`: pro-rata stocks, debts follow the cohort);
// the province stock and the Nation's presence are mirrored as in `stepPopulation`. step8 order (module.js): growth -> stepMigration (derived pull) -> applyPendingMoves (queued settle / resettle / expel)
// -> queued Reorganizations -> ownership re-derivation. Only provinces that already belong to a Region can receive people (unowned land has no cell to hold them).
import { cellKey, parseCellKey } from '../../kernel/ids.js'
import { covers } from '../../kernel/scope.js'
import { transferCohort, opinionModDecay } from '../polity/transfer.js'
import { addOpinionMod } from '../polity/cellstate.js'
import { neighbors, parseId } from './hex.js'
import { growthFactor } from './population.js'
const sum = a => a.reduce((s, x) => s + x, 0), clamp01 = x => Math.min(1, Math.max(0, x))
const ceilingOf = p => (p.maxPopulationDensity !== undefined && p.maxArea !== undefined ? p.maxPopulationDensity * p.maxArea : Infinity)
const nbrs = (ctx, p) => { const { x, y } = parseId(p), g = ctx.state.world.grid, P = ctx.state.world.provinces; return neighbors(x, y, g.w, g.h).map(n => `p:${n.x},${n.y}`).filter(q => P[q]) }
const cellCountry = (ctx, key) => ctx.derive.worldmap.regionOwner(parseCellKey(key).region)
const regionProvinces = (ctx, r) => Object.entries(ctx.state.world.regionSnapshot.assignment).filter(([, x]) => x === r).map(([p]) => p).sort()

/** The scope context `covers` needs (same as administration.scopeCtx; fold the two when it moves to a shared file, as with propaganda.js). */
export function scopeFor(ctx, country) {
  const owner = k => cellCountry(ctx, k), keys = Object.keys(ctx.state.polity.cells).filter(k => owner(k) === country)
  return { country, cellKeys: () => keys, cellCountry: owner, T: ctx.T } }

/** Water needs the capability flag (kb: `capability.settleSea` / `settleLake`, not in the data yet); every land province can be settled. */
export function canSettle(ctx, p) {
  const pr = ctx.state.world.provinces[p]; if (!pr) return false
  if (pr.terrain === 'Sea') return !!ctx.ruleset.capability?.[pr.waterBody === 'lake' ? 'settleLake' : 'settleSea']
  return true }
const canReceive = (ctx, p) => !!ctx.state.world.regionSnapshot.assignment[p] && canSettle(ctx, p)
const openForSettling = (ctx, q) => { const pr = ctx.state.world.provinces[q]; return !!pr && pr.habitability !== 'Settled' && canReceive(ctx, q) }

/** Wasteland -> Claimed/Frontier -> Settled by the people living there (absolute counts; no reverse step yet). */
function promote(ctx, q) {
  const pr = ctx.state.world.provinces[q]; if (!pr || pr.habitability === 'Settled') return
  if (pr.habitability === 'Wasteland' && pr.population >= ctx.T('settle.frontierMin')) pr.habitability = 'Claimed/Frontier'
  if (pr.habitability === 'Claimed/Frontier' && pr.population >= ctx.T('settle.settledMin')) pr.habitability = 'Settled' }

/** The cell `nation|estate|region`, created when missing: zero stocks, preferences and labour profile copied from `like`, so migrants keep their Nation and Estate. */
function ensureCell(ctx, like, region) {
  const key = cellKey(like.nation, like.estate, region), cells = ctx.state.polity.cells
  return (cells[key] ??= { key, nation: like.nation, estate: like.estate, region, population: 0, wealth: 0, labour: {}, labourCommitted: {}, grievance: {},
    satisfaction: structuredClone(like.satisfaction ?? { subsistence: 1, comfort: 1, luxury: 1 }), target: {}, delivered: {}, opinionGovMods: [], prestigeMods: [], fairnessMods: [], cash: 0,
    pref: { ...(like.pref ?? {}) }, defiance: {}, hoard: {}, hoardFrac: 0, laborProfile: { ...(like.laborProfile ?? {}) }, prefMods: {}, flags: {} }) }

function shiftPresence(ctx, nation, alloc, q, moved) {
  const P = ctx.state.world.provinces, pres = (ctx.state.nations.presence ??= {})
  for (const [p, a] of Object.entries(alloc)) { pres[p][nation] -= a; P[p].population = Math.max(0, P[p].population - a) }
  ;(pres[q] ??= {})[nation] = (pres[q][nation] ?? 0) + moved; P[q].population += moved }

/** THE move primitive. Moves up to `amount` people of the cell's Nation into province `q`: capped by the cell's population and the room at `q` (density ceiling), taken from `take` ({prov: weight})
 *  or from the cell's Region by the Nation's presence (never from `q`). Another Region receives its Estate cell's share through transferCohort. `confiscate` first hands that share of the moving
 *  cohort's wealth and hoard goods to `gov` (ledger / inventory). Returns {moved, from, to}; moved 0 = nothing happened. */
export function moveCohort(ctx, cell, amount, q, { take = null, confiscate = 0, gov = null } = {}) {
  const st = ctx.state, P = st.world.provinces, asg = st.world.regionSnapshot.assignment, pres = (st.nations.presence ??= {}), nation = cell.nation, dest = P[q]
  if (!dest || !canReceive(ctx, q)) return { moved: 0 }
  amount = Math.min(amount, cell.population, ceilingOf(dest) - dest.population); if (!(amount > 1e-9)) return { moved: 0 }
  const ps = take ? Object.keys(take) : Object.keys(asg).filter(p => p !== q && asg[p] === cell.region && (pres[p]?.[nation] ?? 0) > 0).sort()
  const w = p => (take ? take[p] : pres[p][nation]), W = sum(ps.map(w)); if (!(W > 0)) return { moved: 0 }
  const alloc = {}; let moved = 0
  for (const p of ps) { const a = Math.min(amount * w(p) / W, pres[p]?.[nation] ?? 0); if (a > 0) { alloc[p] = a; moved += a } }
  if (!(moved > 1e-9)) return { moved: 0 }
  const frac = Math.min(1, moved / cell.population), to = asg[q]
  if (confiscate > 0 && gov) { const cc = clamp01(confiscate) * frac, wl = cell.wealth * cc; cell.wealth -= wl; gov.ledger = (gov.ledger ?? 0) + wl
    for (const [g, v] of Object.entries(cell.hoard ?? {})) { const t = v * cc; cell.hoard[g] -= t; (gov.inventory ??= {})[g] = (gov.inventory[g] ?? 0) + t } }
  if (to !== cell.region) transferCohort(ctx, cell, ensureCell(ctx, cell, to), frac)
  shiftPresence(ctx, nation, alloc, q, moved); promote(ctx, q); ctx.bump?.()
  return { moved, from: cell.region, to } }

// ---------------------------------------------------------------- free colonization (Government standing commitment; kb 2026-11-19)
/** The incentive a Country's Government currently pays: the sum of its `freeColonization` commitments, 0 when its ledger is empty (the policy lapses when it cannot pay). */
export function colonizeIncentive(ctx, country) {
  const g = ctx.state.admin?.governments?.[country]; if (!g || !(g.ledger > 0)) return 0
  return ctx.state.commitments.filter(c => c.type === 'freeColonization' && c.actor.kind === 'government' && c.actor.country === country).reduce((s, c) => s + (c.params.incentive ?? 0), 0) }
/** Pay `amount` from the Government's ledger to the Nation's cells in the arrival Region, by population; false (nothing taken) when no cell can receive it. */
function payArrivals(ctx, g, region, nation, amount) {
  const cs = Object.values(ctx.state.polity.cells).filter(c => c.region === region && c.nation === nation), tot = sum(cs.map(c => c.population)); if (!(tot > 0)) return false
  g.ledger -= amount; for (const c of cs) c.wealth += amount * c.population / tot
  return true }

// ---------------------------------------------------------------- gradual migration (derived; nothing stored)
/** pull(p->q, n) = regionSat(q, n) + (q not Settled ? mig.frontierPull + colonize.pullK x incentive(owner q) : 0) - regionSat(p, n);  flow = presence[p][n] x mig.rate x pull x autonomy(p's Region, n).
 *  A LaborMigrationBan between different owners blocks the pair. Computed from the state at the start of the pass, applied in sorted order; arrivals in unsettled provinces are paid the incentive
 *  from the Government's ledger (to the arriving Nation's cells there). Returns the flows that happened. */
export function stepMigration(ctx) {
  const rate = ctx.T('mig.rate'); if (!(rate > 0)) return []
  const st = ctx.state, P = st.world.provinces, asg = st.world.regionSnapshot.assignment, pres = st.nations.presence ?? {}
  const byRegion = {}; for (const c of Object.values(st.polity.cells)) (byRegion[c.region] ??= []).push(c)
  const memo = {}, cellsOf = (r, n) => (byRegion[r] ?? []).filter(c => c.nation === n)
  const sat = (r, n) => (memo[`s|${r}|${n}`] ??= (() => { const all = byRegion[r] ?? [], mine = all.filter(c => c.nation === n), use = mine.length ? mine : all, tot = sum(use.map(c => c.population))
    return tot > 0 ? sum(use.map(c => growthFactor(c) * c.population)) / tot : 0 })())
  const free = (r, n) => (memo[`a|${r}|${n}`] ??= (() => { const cs = cellsOf(r, n), tot = sum(cs.map(c => c.population))
    return tot > 0 ? sum(cs.filter(c => ctx.derive.polity?.right?.(c.key, 'MovementAutonomy') !== false).map(c => c.population)) / tot : 1 })())
  const inc = o => (memo[`i|${o}`] ??= colonizeIncentive(ctx, o))
  const flows = []
  for (const p of Object.keys(pres).sort()) { const rp = asg[p]; if (!rp || !P[p]) continue
    for (const nation of Object.keys(pres[p]).sort()) { const here = pres[p][nation]; if (!(here > 0)) continue
      for (const q of nbrs(ctx, p)) { const rq = asg[q]; if (!rq || !canSettle(ctx, q)) continue
        if (P[p].owner !== P[q].owner && ctx.derive.diplomacy?.laborMigrationBanned?.(P[p].owner, P[q].owner)) continue
        const frontier = P[q].habitability !== 'Settled'
        const pull = sat(rq, nation) + (frontier ? ctx.T('mig.frontierPull') + ctx.T('colonize.pullK') * inc(P[q].owner) : 0) - sat(rp, nation), amount = here * rate * pull * free(rp, nation)
        if (amount > 1e-9) flows.push({ nation, from: p, to: q, amount, frontier }) } } }
  const byOrigin = {}; for (const f of flows) (byOrigin[`${f.from}|${f.nation}`] ??= []).push(f)
  for (const fs of Object.values(byOrigin)) { const tot = sum(fs.map(f => f.amount)), have = pres[fs[0].from][fs[0].nation]; if (tot > have) for (const f of fs) f.amount *= have / tot }      // a province never gives more than it has
  const done = []
  for (const f of flows) {
    const rp = asg[f.from], rq = asg[f.to], have = pres[f.from]?.[f.nation] ?? 0, a0 = Math.min(f.amount, have, ceilingOf(P[f.to]) - P[f.to].population); if (!(a0 > 1e-9)) continue
    if (rp === rq) { shiftPresence(ctx, f.nation, { [f.from]: a0 }, f.to, a0); promote(ctx, f.to); done.push({ ...f, amount: a0 }); continue }      // one Region: the cells stay whole, only the provinces change
    const cs = cellsOf(rp, f.nation).filter(c => c.population > 0).sort((a, b) => (a.key < b.key ? -1 : 1)), tot = sum(cs.map(c => c.population)); let moved = 0
    for (const c of cs) moved += moveCohort(ctx, c, a0 * c.population / tot, f.to, { take: { [f.from]: 1 } }).moved
    if (moved > 0) done.push({ ...f, amount: moved }) }
  for (const f of done) { if (!f.frontier) continue                                                                                    // the standing commitment pays each settler who arrived in unsettled land
    const owner = P[f.to].owner, g = st.admin?.governments?.[owner], incentive = colonizeIncentive(ctx, owner); if (!g || !(incentive > 0)) continue
    const pay = Math.min(g.ledger, f.amount * incentive * ctx.T('colonize.costPerSettler')); if (pay > 0) payArrivals(ctx, g, asg[f.to], f.nation, pay) }
  if (done.length) ctx.bump?.()
  return done }

// ---------------------------------------------------------------- settlement by a cell (route 2)
export function settleProposal(ctx, key) {
  const c = ctx.state.polity.cells[key]; if (!c || !(c.population > 0) || ctx.derive.polity.right(key, 'Settlement') === false) return null
  const country = cellCountry(ctx, key), P = ctx.state.world.provinces, cand = new Set(), ok = q => P[q]?.owner === country && openForSettling(ctx, q)
  for (const p of regionProvinces(ctx, c.region)) { if (ok(p)) cand.add(p); for (const q of nbrs(ctx, p)) if (ok(q)) cand.add(q) }
  const pick = [...cand].sort((a, b) => ((P[a].habitability === 'Wasteland') - (P[b].habitability === 'Wasteland')) || (a < b ? -1 : 1))[0]      // Frontier before Wasteland
  return pick ? { province: pick, amount: c.population * ctx.T('settle.cohort') } : null }
export function settleUtility(ctx, key, p) {
  const c = ctx.state.polity.cells[key], P = ctx.state.world.provinces, ps = regionProvinces(ctx, c.region).filter(x => P[x].habitability !== 'Wasteland')
  const cap = sum(ps.map(x => ceilingOf(P[x]))), crowd = Number.isFinite(cap) && cap > 0 ? clamp01(sum(ps.map(x => P[x].population)) / cap) : 0
  return ctx.T('settle.crowdK') * crowd - ctx.T('settle.costPerCap') * p.amount / Math.max(1, c.wealth) }
export function checkSettle(ctx, key, params) {
  const c = ctx.state.polity.cells[key], q = params?.province; if (!c) return { ok: false, reasons: ['unknown cell'] }
  if (!(params?.amount > 0)) return { ok: false, reasons: ['amount must be > 0'] }
  if (ctx.derive.polity.right(key, 'Settlement') === false) return { ok: false, reasons: ['Settlement is forbidden for this cell'] }
  const P = ctx.state.world.provinces
  if (!P[q] || P[q].owner !== cellCountry(ctx, key)) return { ok: false, reasons: ['the province is not in your Country'] }
  return openForSettling(ctx, q) ? { ok: true } : { ok: false, reasons: ['the province is already Settled or cannot be settled'] } }

// ---------------------------------------------------------------- forced moves: direct resettlement (kind 'resettle') and Expulsion (kind 'expel')
/** Pure dry run = the preview. params {scope, province, share? = 1, confiscate? = 0 (expel only)} -> {ok, reasons, moves: [{cell, amount}], total, capped}. */
export function planForcedMove(ctx, country, kind, params) {
  const st = ctx.state, P = st.world.provinces, p = params ?? {}, q = p.province, pr = P[q], reasons = []
  if (!pr) return { ok: false, reasons: ['unknown province'] }
  const share = p.share ?? 1, conf = kind === 'expel' ? (p.confiscate ?? 0) : 0
  if (!(share > 0 && share <= 1)) reasons.push('share must be in (0, 1]')
  if (!(conf >= 0 && conf <= 1)) reasons.push('confiscate must be in [0, 1]')
  if (!p.scope || typeof p.scope.kind !== 'string') reasons.push('scope required')
  if (!canReceive(ctx, q)) reasons.push('the target province is not part of a Region or cannot be settled')
  const owner = pr.owner ?? null
  if (kind === 'resettle' && owner !== country) reasons.push('the target province is not yours')
  if (kind === 'expel') {
    if (!owner || owner === country) reasons.push('expulsion needs a province of another Country')
    else { if (!nbrs(ctx, q).some(n => P[n].owner === country)) reasons.push('the target province does not border your territory')
      if (ctx.derive.diplomacy?.laborMigrationBanned?.(country, owner)) reasons.push('a LaborMigrationBan binds the two Countries') } }
  if (reasons.length) return { ok: false, reasons }
  let keys; try { const sc = scopeFor(ctx, country); keys = Object.keys(st.polity.cells).sort().filter(k => st.polity.cells[k].population > 0 && sc.cellCountry(k) === country && covers(p.scope, k, sc)) }
  catch { return { ok: false, reasons: ['invalid scope'] } }
  let room = ceilingOf(pr) - pr.population, total = 0, want = 0; const moves = []
  for (const k of keys) { const w = share * st.polity.cells[k].population; want += w; const a = Math.min(w, room); if (a > 1e-9) { moves.push({ cell: k, amount: a }); room -= a; total += a } }
  if (!moves.length) return { ok: false, reasons: [keys.length ? 'no room in the target province' : 'the scope covers nobody'] }
  return { ok: true, moves, total, capped: total < want - 1e-9 } }
export const queueMove = (ctx, m) => { (ctx.state.world.pendingMoves ??= []).push(structuredClone(m)) }

function runSettle(ctx, m) {
  const c = ctx.state.polity.cells[m.cell]; if (!c || !checkSettle(ctx, m.cell, m).ok) return null
  const amount = Math.min(m.amount, c.population), cost = Math.min(c.wealth, ctx.T('settle.costPerCap') * amount); c.wealth -= cost
  const r = moveCohort(ctx, c, amount, m.province); if (!(r.moved > 0)) { c.wealth += cost; return null }
  return { kind: 'settle', cell: m.cell, province: m.province, moved: r.moved, cost } }
function runForced(ctx, m) {
  const plan = planForcedMove(ctx, m.country, m.kind, m.params); if (!plan.ok) return null
  const st = ctx.state, gov = st.admin?.governments?.[m.country], share = m.params.share ?? 1, conf = m.kind === 'expel' ? (m.params.confiscate ?? 0) : 0, moved = []
  for (const mv of plan.moves) { const c = st.polity.cells[mv.cell]; if (!c) continue
    const hit = m.kind === 'expel' || ctx.derive.polity?.right?.(mv.cell, 'MovementAutonomy') !== false      // read before the move
    const r = moveCohort(ctx, c, mv.amount, m.params.province, { confiscate: conf, gov }); if (!(r.moved > 0)) continue
    if (hit) addOpinionMod(c, { id: `force.${st.meta.turn}`, value: -ctx.T('force.opinionHit') * share, decay: opinionModDecay, turn: st.meta.turn })      // the cell's own entitlement loss
    moved.push({ cell: mv.cell, nation: c.nation, moved: r.moved }) }
  if (m.kind === 'expel') for (const nation of new Set(moved.map(x => x.nation)))      // kin-state appeal: a Country whose titular Nations include the expelled Nation holds a Rights CB
    for (const [cid, co] of Object.entries(st.countries ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)))
      if (cid !== m.country && (co.titularNations ?? []).includes(nation)) ctx.services.diplomacy?.grantCB?.(cid, m.country, 'Rights', 'expulsion-of-kin', ctx.T('cb.mag.expel'))
  return moved.length ? { kind: m.kind, country: m.country, province: m.params.province, moved } : null }

/** step 8: apply the queued orders once, each re-validated against the current state (one that no longer holds is dropped whole). */
export function applyPendingMoves(ctx) {
  const w = ctx.state.world, queue = w.pendingMoves; if (!queue) return []
  w.pendingMoves = []; const out = []
  for (const m of queue) { const r = m.kind === 'settle' ? runSettle(ctx, m) : runForced(ctx, m); if (r) out.push(r) }
  if (out.length) ctx.bump?.()
  return out }
