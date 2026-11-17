// worldmap/reorg.js — Region capital and the Reorganization Event (kb World Map: Region; spec: world_map__spec.md). Pure functions over `state.world`.
import { neighbors, parseId } from './hex.js'

const adjOf = grid => p => { const { x, y } = parseId(p); return neighbors(x, y, grid.w, grid.h).map(n => `p:${n.x},${n.y}`) }
const groupBy = a => { const o = {}; for (const [p, r] of Object.entries(a)) (o[r] ??= []).push(p); for (const v of Object.values(o)) v.sort(); return o }
const contiguous = (ps, adj) => { if (!ps.length) return false; const set = new Set(ps), seen = new Set([ps[0]]), st = [ps[0]]
  while (st.length) { const c = st.pop(); for (const m of adj(c)) if (set.has(m) && !seen.has(m)) { seen.add(m); st.push(m) } } return seen.size === set.size }
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

/** The Region's capital: the stored administrative setting while it is still a province of the Region, else the most populous province (ties by id) — the kb's proposed fallback. */
export function regionCapitalOf(w, region) {
  const ps = Object.entries(w.regionSnapshot.assignment).filter(([, r]) => r === region).map(([p]) => p).sort(), c = w.regions?.[region]?.capital
  if (c && ps.includes(c)) return c
  return ps.slice().sort((a, b) => (w.provinces[b]?.population ?? 0) - (w.provinces[a]?.population ?? 0) || (a < b ? -1 : 1))[0] ?? null }

/** Dry-run (and the application step) of a Reorganization Event on a copy of `w.regionSnapshot`. ops, in order (later ops may use ids made by earlier ones):
 *  {kind:'split', region, parts:[{provinces, capital}, ...>=2]}   the parts partition the Region exactly, each contiguous, capital inside its part; every part gets a new id
 *  {kind:'merge', regions:[a, b], capital}                         adjacent, same owner; one new id
 *  {kind:'move', province, to, fromCapital?, toCapital?}           the province leaves its Region for the adjacent Region `to`; the donor keeps >= 1 province and stays contiguous; ids unchanged
 *  Every Region touched must belong to `country`. Returns {ok, reasons} or {ok, assignment, next, owners, capitals, gone, targets}; targets(oldRegion) = the live Regions that took its place. */
export function applyReorg(w, country, ops) {
  if (!Array.isArray(ops) || !ops.length) return { ok: false, reasons: ['ops required'] }
  const adj = adjOf(w.grid), snap = w.regionSnapshot, assignment = { ...snap.assignment }, owners = { ...(snap.owners ?? {}) }, gone = {}, capitals = {}, reasons = []
  let next = snap.next
  const ownerOf = rid => owners[rid] ?? w.provinces[Object.keys(assignment).find(p => assignment[p] === rid)]?.owner ?? null
  for (const [i, op] of ops.entries()) {
    const by = groupBy(assignment), n0 = reasons.length, no = m => { reasons.push(`op ${i + 1}: ${m}`) }
    const mine = rid => { if (!by[rid]) { no(`unknown Region ${rid}`); return false } if (ownerOf(rid) !== country) { no(`Region ${rid} is not yours`); return false } return true }
    if (op?.kind === 'split') {
      if (!mine(op.region)) continue
      const ps = by[op.region], parts = op.parts
      if (!Array.isArray(parts) || parts.length < 2 || parts.some(x => !Array.isArray(x?.provinces))) { no('a split needs at least two parts, each with provinces'); continue }
      if (!same(parts.flatMap(x => x.provinces).sort(), ps)) { no('the parts must partition the Region exactly'); continue }
      for (const [j, part] of parts.entries()) { if (!contiguous(part.provinces, adj)) no(`part ${j + 1} is not contiguous`); if (!part.provinces.includes(part.capital)) no(`part ${j + 1} needs a capital inside it`) }
      if (reasons.length > n0) continue
      const ids = parts.map(() => `r${next++}`)
      parts.forEach((part, j) => { for (const p of part.provinces) assignment[p] = ids[j]; owners[ids[j]] = country; capitals[ids[j]] = part.capital })
      gone[op.region] = ids; delete owners[op.region]; delete capitals[op.region]
    } else if (op?.kind === 'merge') {
      const [a, b] = op.regions ?? []
      if (!a || !b || a === b) { no('a merge names two different Regions'); continue }
      const okA = mine(a), okB = mine(b); if (!okA || !okB) continue
      const pa = by[a], pb = by[b]
      if (!pa.some(p => adj(p).some(q => pb.includes(q)))) { no('the Regions are not adjacent'); continue }
      if (![...pa, ...pb].includes(op.capital)) { no('the merged Region needs a capital inside it'); continue }
      const id = `r${next++}`; for (const p of [...pa, ...pb]) assignment[p] = id
      owners[id] = country; capitals[id] = op.capital; gone[a] = [id]; gone[b] = [id]
      for (const r of [a, b]) { delete owners[r]; delete capitals[r] }
    } else if (op?.kind === 'move') {
      const p = op.province, from = assignment[p], to = op.to
      if (!from) { no(`${p} is in no Region`); continue }
      const okF = mine(from), okT = mine(to); if (!okF || !okT) continue
      if (from === to) { no('the province is already in that Region'); continue }
      if (!adj(p).some(q => assignment[q] === to)) { no('the province does not border the target Region'); continue }
      const rest = by[from].filter(q => q !== p)
      if (!rest.length || !contiguous(rest, adj)) { no('the donor Region must keep at least one province and stay contiguous'); continue }
      if ((capitals[from] ?? w.regions?.[from]?.capital) === p && !op.fromCapital) { no('the capital leaves with this province: name fromCapital'); continue }
      if (op.fromCapital && !rest.includes(op.fromCapital)) { no('fromCapital must stay in the donor Region'); continue }
      if (op.toCapital && ![...by[to], p].includes(op.toCapital)) { no('toCapital must be in the target Region'); continue }
      assignment[p] = to; if (op.fromCapital) capitals[from] = op.fromCapital; if (op.toCapital) capitals[to] = op.toCapital
    } else no(`unknown op kind ${op?.kind}`)
  }
  if (reasons.length) return { ok: false, reasons }
  const live = new Set(Object.values(assignment)), targets = rid => (live.has(rid) ? [rid] : (gone[rid] ?? []).flatMap(targets))
  return { ok: true, reasons: [], assignment, next, owners, capitals, gone, targets }
}

/** Laws are scoped entries per Country. An entry whose scope names a Region that no longer exists is copied to every Region that took its place; entries that then collide on the same scope
 *  keep the later declaredTurn (Rights, Duties) or the larger amount (Requisitions). Scope kinds with a region: cell, nationRegion, estateRegion, region. (Dial and propaganda targets are not re-pointed.) */
export function retargetLaws(L, res) {
  const live = new Set(Object.values(res.assignment)), scopeKey = e => JSON.stringify(e.scope)
  const remap = (entries, keyOf, better) => { const out = new Map()
    for (const e of entries ?? []) { const r = e.scope?.region, ts = r === undefined || live.has(r) ? [r] : res.targets(r)
      for (const t of ts) { const ne = r === undefined || t === r ? e : { ...e, scope: { ...e.scope, region: t } }, k = keyOf(ne), old = out.get(k); if (!old || better(ne, old)) out.set(k, ne) } }
    return [...out.values()] }
  for (const kind of ['rights', 'duties']) for (const id of Object.keys(L[kind] ?? {})) L[kind][id] = remap(L[kind][id], scopeKey, (n, o) => (n.declaredTurn ?? 0) >= (o.declaredTurn ?? 0))
  if (L.requisitions) L.requisitions = remap(L.requisitions, e => `${scopeKey(e)}|${e.target?.good}`, (n, o) => n.amount > o.amount) }
