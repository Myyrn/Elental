// ai/aiWar.js — AI-War alpha hooks (ai_war__kb / ai_war__spec): pre-war border deployment under hostile Campaigns, per-army tactic. Army handling at war stays in simpleWar.js.
import { atWar } from '../war/step.js'
const HOSTILE = ['Provoke', 'Strike', 'Squeeze'], me = cid => ({ kind: 'government', country: cid })
const valid = (ctx, order) => { try { return ctx.registry.get(order.type).validate(ctx, order).ok !== false } catch { return false } }
export function aiWarOrders(ctx) {
  const out = [], W = ctx.state.war, turn = ctx.state.meta.turn, camps = ctx.state.ai?.diplomacy?.campaigns ?? {}, P = ctx.state.world.provinces
  for (const [cid, c] of Object.entries(ctx.state.countries).sort(([x], [y]) => x.localeCompare(y))) {
    if (c.isPlayer) continue
    const mine = Object.values(W.armies).filter(a => a.owner === cid).sort((x, y) => x.id.localeCompare(y.id)), mineCamps = camps[cid] ?? []
    const enemies = Object.keys(ctx.state.countries).filter(o => o !== cid && atWar(ctx, cid, o))
    if (!mine.length) {                                                                                   // 1. deployment toward a hostile-campaign target we are not at war with
      const t = mineCamps.filter(k => HOSTILE.includes(k.type) && ctx.state.countries[k.target]).map(k => k.target).find(x => !atWar(ctx, cid, x))
      const at = t && Object.entries(P).filter(([, p]) => p.owner === cid).map(([id]) => id).filter(id => ctx.derive.worldmap.neighbors(id).some(n => P[n]?.owner === t)).sort()[0]
      const region = at && ctx.state.world.regionSnapshot.assignment[at]
      const cell = region && Object.values(ctx.state.polity.cells).filter(x => x.region === region && x.estate === 'peasants').sort((x, y) => y.population - x.population)[0]
      if (cell) { const n = Math.floor(((cell.labour['Shock Infantry'] ?? 0) - (cell.labourCommitted['Shock Infantry'] ?? 0)) * 0.3)
        const order = { id: `ai.${cid}.deploy.${turn}`, actor: me(cid), type: 'fieldUnits', params: { originCell: cell.key, composition: { 'Shock Infantry': n }, at } }
        if (n > 0 && valid(ctx, order)) out.push(order) } }
    const want = mineCamps.some(k => k.type === 'Strike' && enemies.includes(k.target)) ? 'aggressive' : 'balanced'      // 2. tactic
    for (const ar of mine) if (ar.tactic !== want) out.push({ id: `ai.${cid}.tactic.${ar.id}.${turn}`, actor: me(cid), type: 'setTactic', params: { armyId: ar.id, tactic: want } }) }
  return out }
