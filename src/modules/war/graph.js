// war/graph.js — land movement graph: World Map edges only (not trade edges).
import { edgePassable, edgeKey } from '../worldmap/hex.js'
export const hasTrait = (army, t) => (army?.traits ?? []).includes(t)
/** Water provinces (terrain Sea, an open sea or a lake: `waterBody`) are not land: `ruleset.traversal.Sea|Lake.land === false` keeps armies on foot out of them (kb 2026-11-09/10; ships and sea lanes are naval movement, not in code). */
export const landBlocked = (ctx, province) => { if (!province || province.terrain !== 'Sea') return false
  return ctx.ruleset.traversal?.[province.waterBody === 'lake' ? 'Lake' : 'Sea']?.land === false }
/** false | {cost} — water blocked; Mountain interior blocked unless pass; forest hard-block (forest_movement overrides); Fortress edges blocked until reduced; river crossing costs extra. */
export function stepAllowed(ctx, a, b, army) {
  const P = ctx.state.world.provinces; if (!P[a] || !P[b]) return false
  if (landBlocked(ctx, P[a]) || landBlocked(ctx, P[b])) return false
  if (!edgePassable(a, b, ctx.state.world.edges, p => P[p].terrain)) return false
  if (P[b].forestation >= ctx.T('war.forest.block') && !hasTrait(army, 'forest_movement')) return false
  const e = ctx.state.world.edges[edgeKey(a, b)]; if (e?.fortress && !e.reduced) return false
  return { cost: e?.type === 'river' && !e.bridge ? ctx.T('war.river.cost') : 1 } }
export function findPath(ctx, from, to, army) {                         // Dijkstra over passable edges; returns provinces after `from`
  if (from === to) return []
  const dist = { [from]: 0 }, prev = {}, open = [from], seen = new Set()
  while (open.length) { open.sort((x, y) => dist[x] - dist[y] || (x < y ? -1 : 1)); const cur = open.shift(); if (seen.has(cur)) continue; seen.add(cur); if (cur === to) break
    for (const n of ctx.derive.worldmap.neighbors(cur)) { const s = stepAllowed(ctx, cur, n, army); if (!s) continue; const d = dist[cur] + s.cost
      if (dist[n] === undefined || d < dist[n]) { dist[n] = d; prev[n] = cur; open.push(n) } } }
  if (dist[to] === undefined) return null
  const path = []; for (let c = to; c !== from; c = prev[c]) path.unshift(c); return path }
export const bfsDistance = (ctx, from, isGoal, canEnter = () => true) => { const d = { [from]: 0 }, q = [from], P = ctx.state.world.provinces
  while (q.length) { const c = q.shift(); if (isGoal(c)) return { province: c, distance: d[c] }
    for (const n of ctx.derive.worldmap.neighbors(c)) if (d[n] === undefined && !landBlocked(ctx, P[n]) && canEnter(n)) { d[n] = d[c] + 1; q.push(n) } }
  return null }
