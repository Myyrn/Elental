// ai/diplomacy/campaign.js — Campaign values, selection, free switching with a margin and bypass. Pure. Spec: ai_diplomacy__spec.md §3
import { reads } from './reads.js'
import { T } from './tuning.js'
import { config } from './config.js'
import { CATS, sum, clamp01, affinity, netEdge, bopPenalty, existential, hasUsableCB, underPressure } from './posture.js'

function networkGain(ctx, a, b, posture, S, rd) {
  const deps = S.countries.filter(c => c !== a && c !== b).map(c => [c, rd.tradeDep(ctx, b, c)]), tot = sum(deps.map(d => d[1])); if (!tot) return 0
  return sum(deps.filter(([c]) => ['Ally', 'Partner'].includes(posture[c])).map(d => d[1])) / tot }

/** 0..1, derived from readouts only. Secure's value is a placeholder for the open Contested Asset formula (trade dependency share). */
export function typeValue(ctx, a, b, type, posture, S, W, rd = reads) {
  const aff = clamp01(affinity(ctx, a, b, S, rd)), ne = netEdge(ctx, a, b, S, W, rd)
  switch (type) {
    case 'Court': return aff
    case 'Support': return underPressure(ctx, b, S, rd) && ['Ally', 'Partner'].includes(posture[b]) ? 1 : aff
    case 'Secure': return clamp01(rd.tradeDep(ctx, a, b) / S.maxTrade)
    case 'Squeeze': return clamp01(ne + networkGain(ctx, a, b, posture, S, rd))
    case 'Provoke': return hasUsableCB(ctx, a, b, rd) ? 0 : clamp01(ne)
    case 'Strike': return hasUsableCB(ctx, a, b, rd) && ne > T(ctx, 'ai.dip.strike.edge') ? clamp01(ne) : 0
    default: return 0 } }

export const snapOf = (ctx, a, b, S, rd = reads) => ({ cbs: rd.cbs(ctx, a, b).length, allies: rd.treaties(ctx, b).filter(t => t.kind === 'Alliance' || t.kind === 'Confederation').length, power: S.power[b] })
const newOpportunity = (ctx, cur, a, b, S, rd) => { const s = cur.snap, now = snapOf(ctx, a, b, S, rd)
  return !!s && (now.cbs > s.cbs || now.allies < s.allies || now.power - s.power > T(ctx, 'ai.dip.bop.growth')) }

export function updateCampaigns(ctx, a, posture, S, cache, W, rd = reads) {
  const cfg = config(ctx), turn = rd.turn(ctx), prev = cache?.campaigns?.[a] ?? [], out = []
  const val = (b, t) => typeValue(ctx, a, b, t, posture, S, W, rd)
  const ranked = Object.keys(posture).map(b => [b, Math.max(...cfg.postureGate[posture[b]].map(t => val(b, t)))]).filter(([, v]) => v > T(ctx, 'ai.dip.minValue')).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
  for (const [b] of ranked.slice(0, T(ctx, 'ai.dip.maxCampaigns'))) {
    const allowed = cfg.postureGate[posture[b]], cur = prev.find(c => c.target === b), vals = allowed.map(t => [t, val(b, t)])
    const best = vals.reduce((m, v) => (v[1] > m[1] ? v : m))                                           // first maximum wins: gate order breaks ties
    const bypass = !!cur && (existential(ctx, a, b, rd) || newOpportunity(ctx, cur, a, b, S, rd)), margin = bypass ? 0 : T(ctx, 'ai.dip.switchMargin')
    const keep = cur && allowed.includes(cur.type) && val(b, cur.type) + margin >= best[1]
    out.push(keep ? { ...cur, snap: snapOf(ctx, a, b, S, rd) } : { id: `cmp.${a}.${b}.${turn}`, target: b, type: best[0], since: turn, snap: snapOf(ctx, a, b, S, rd) }) }
  return out }
