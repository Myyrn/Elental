// worldmap/module.js — read services other modules use through ctx.derive.worldmap.*; step 8: growth, migration and queued moves, then the one end-of-turn Region pass.
import { parseCellKey } from '../../kernel/ids.js'
import { neighbors, parseId } from './hex.js'
import { deriveRegions, splitCell, mergeCells } from './regions.js'
import { applyReorg, retargetLaws, regionCapitalOf } from './reorg.js'
import { stepPopulation } from './population.js'
import { stepMigration, applyPendingMoves } from './migration.js'
const sum = a => a.reduce((s, x) => s + x, 0)
/** Re-key every polity cell when the province -> Region assignment changes (World Map Rule 7): per-cell stocks split/sum by the Nation's presence share over the old Region's provinces. */
function rekeyCells(ctx, oldAssignment, newAssignment) {
  const oldProvs = {}
  for (const [p, r] of Object.entries(oldAssignment)) (oldProvs[r] ??= []).push(p)
  const P = ctx.state.polity, out = {}, moves = {}
  for (const [key, cell] of Object.entries(P.cells)) {
    const [nation, estate, oldR] = key.split('|'), ps = oldProvs[oldR] ?? [], pres = p => ctx.state.nations.presence[p]?.[nation] ?? 0, tot = ps.reduce((s, p) => s + pres(p), 0)
    const shares = {}; for (const p of ps) { const nr = newAssignment[p]; if (!nr) continue; shares[nr] = (shares[nr] ?? 0) + (tot ? pres(p) / tot : 1 / ps.length) }
    const ids = Object.keys(shares); if (!ids.length) { out[key] = cell; continue }
    const tshare = ids.reduce((s, i) => s + shares[i], 0); for (const i of ids) shares[i] /= tshare
    const parts = ids.length === 1 && ids[0] === oldR ? { [oldR]: cell } : splitCell(cell, shares)
    for (const [nr, part] of Object.entries(parts)) { const nk = `${nation}|${estate}|${nr}`; part.key = nk; part.region = nr; (moves[key] ??= []).push([nk, shares[nr] ?? 1])
      out[nk] = out[nk] ? mergeCells([out[nk], part], nr) : part; out[nk].key = nk } }
  const mom = {}, rung = {}
  for (const [k, v] of Object.entries(P.momentum)) { const [ck, need] = [k.split('|').slice(0, 3).join('|'), k.split('|')[3]]; for (const [nk] of moves[ck] ?? [[ck]]) { mom[`${nk}|${need}`] = Math.max(mom[`${nk}|${need}`] ?? 0, v); rung[`${nk}|${need}`] = Math.max(rung[`${nk}|${need}`] ?? 0, P.rung[k] ?? 0) } }
  P.cells = out; P.momentum = mom; P.rung = rung
}
/** step 8: ONE end-of-turn pass — natural growth, gradual migration, queued settle / resettle / expel orders, then queued Reorganization Events, then re-derivation of Regions after ownership change;
 *  per-cell stocks split/sum by Nations' population share (World Map Rule 7). Population moves run BEFORE the Region pass so it splits the current stocks. */
export function step8(ctx) {
  stepPopulation(ctx)                                        // natural growth/decrease first, so the Region pass splits the current stocks
  stepMigration(ctx)                                         // derived pull between Regions and toward unsettled land (World Map: Population dynamics)
  applyPendingMoves(ctx)                                     // queued `settle`, `directResettlement` and `expel` orders, each re-validated
  const w = ctx.state.world
  for (const r of w.pendingReorg ?? []) {                    // each queued event applies once; one that no longer holds (re-validated against the current state) is dropped whole
    const res = applyReorg(w, r.country, r.ops); if (!res.ok) continue
    rekeyCells(ctx, w.regionSnapshot.assignment, res.assignment)
    const L = ctx.state.polity.law[r.country]; if (L) retargetLaws(L, res)
    const live = new Set(Object.values(res.assignment)); w.regions ??= {}
    for (const rid of Object.keys(res.gone)) delete w.regions[rid]
    for (const [rid, capital] of Object.entries(res.capitals)) if (live.has(rid)) (w.regions[rid] ??= {}).capital = capital
    w.regionSnapshot = { assignment: res.assignment, next: res.next, owners: res.owners }; ctx.bump?.() }
  if (w.pendingReorg) w.pendingReorg = []
  const prev = w.regionSnapshot, owners = Object.fromEntries(Object.entries(w.provinces).map(([id, p]) => [id, p.owner ?? null]))
  const changed = Object.entries(prev.assignment).some(([p, r]) => owners[p] !== prev.owners?.[r])
  if (!changed) return
  const next = deriveRegions({ w: w.grid.w, h: w.grid.h }, owners, prev)
  rekeyCells(ctx, prev.assignment, next.assignment)
  w.regionSnapshot = { assignment: next.assignment, next: next.next, owners: Object.fromEntries(Object.entries(next.regions).map(([r, v]) => [r, v.owner])) }
}
export const worldmapModule = { id: 'worldmap', steps: { 8: step8 }, derive: {
  regionProvinces: (ctx, region) => Object.entries(ctx.state.world.regionSnapshot.assignment).filter(([, r]) => r === region).map(([p]) => p).sort(),
  regionOwner: (ctx, region) => { const o = ctx.state.world.regionSnapshot.owners?.[region]; if (o !== undefined) return o; const p = ctx.derive.worldmap.regionProvinces(region)[0]; return p ? ctx.state.world.provinces[p].owner : null },
  regionCapital: (ctx, region) => regionCapitalOf(ctx.state.world, region),
  presence: (ctx, p, nation) => ctx.state.nations.presence[p]?.[nation] ?? 0,
  cellProvShare: (ctx, key, p) => {                            // labour/population spreads over the Region's provinces by presence share (confirmed)
    const { nation, region } = parseCellKey(key), ps = ctx.derive.worldmap.regionProvinces(region)
    const tot = sum(ps.map(q => ctx.derive.worldmap.presence(q, nation)))
    return tot ? ctx.derive.worldmap.presence(p, nation) / tot : (ps.includes(p) ? 1 / ps.length : 0)
  },
  neighbors: (ctx, p) => { const { x, y } = parseId(p), g = ctx.state.world.grid
    return neighbors(x, y, g.w, g.h).map(n => `p:${n.x},${n.y}`).filter(q => ctx.state.world.provinces[q]) },
} }
