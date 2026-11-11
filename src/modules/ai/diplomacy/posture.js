// ai/diplomacy/posture.js — weights, leverage edge, affinity, balance of power, Posture with hysteresis. Pure. Spec: ai_diplomacy__spec.md §2
import { reads } from './reads.js'
import { T } from './tuning.js'
export const CATS = ['economic', 'diplomatic', 'military', 'cultural']
export const sum = a => a.reduce((s, x) => s + x, 0)
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x)), clamp01 = x => clamp(x, 0, 1)

/** AI-independent snapshot of one ctx (power shares, per-category leverage scale, trade scale). Memoised per (ctx, reads) object. */
const SHARED = new WeakMap()
export function shared(ctx, rd = reads) {
  const hit = SHARED.get(ctx); if (hit && hit.rd === rd) return hit
  const countries = rd.countries(ctx), raw = Object.fromEntries(countries.map(c => [c, Math.max(0, rd.power(ctx, c))])), tot = sum(Object.values(raw)) || 1
  const power = Object.fromEntries(countries.map(c => [c, raw[c] / tot])), scale = Object.fromEntries(CATS.map(k => [k, 1e-9])); let maxTrade = 1e-9
  for (const x of countries) for (const y of countries) if (x !== y) { const l = rd.leverage(ctx, x, y); for (const k of CATS) scale[k] = Math.max(scale[k], Math.abs(l[k] ?? 0)); maxTrade = Math.max(maxTrade, rd.tradeDep(ctx, x, y)) }
  const S = { rd, countries, power, scale, maxTrade }; SHARED.set(ctx, S); return S }

/** Decision-time weights from the Portrait amalgam; never stored. */
export function weights(ctx, a, rd = reads) {
  const ruth = clamp(rd.portrait(ctx, a).ruthlessness_restraint ?? 0, -1, 1)
  return { economic: 1, diplomatic: 1, cultural: 1, military: Math.max(0.1, 1 + T(ctx, 'ai.dip.w.ruth') * ruth) } }

export const existential = (ctx, a, b, rd = reads) => rd.cbs(ctx, b, a).some(c => c.tier === 'Existential')
const threatOn = (ctx, x, b, S) => Math.max(0, S.power[b] - S.power[x] - T(ctx, 'ai.dip.bop.margin'))
export const bopPenalty = (ctx, a, b, S) => T(ctx, 'ai.dip.bop.gain') * threatOn(ctx, a, b, S)
export function sharedThreat(ctx, a, c, S) {
  let m = 0; for (const b of S.countries) if (b !== a && b !== c) m = Math.max(m, Math.min(threatOn(ctx, a, b, S), threatOn(ctx, c, b, S)))
  return clamp01(T(ctx, 'ai.dip.bop.gain') * m) }

/** a's weighted edge over b in -1..1. Scale-free per category; an Existential CB held by b promotes Military to the only weight. */
export function edge(ctx, a, b, S, W, rd = reads) {
  const ab = rd.leverage(ctx, a, b), ba = rd.leverage(ctx, b, a), w = existential(ctx, a, b, rd) ? { economic: 0, diplomatic: 0, cultural: 0, military: W.military } : W, tw = sum(CATS.map(k => w[k])) || 1
  return clamp(sum(CATS.map(k => w[k] * clamp(((ab[k] ?? 0) - (ba[k] ?? 0)) / (2 * S.scale[k]), -1, 1))) / tw, -1, 1) }
export const netEdge = (ctx, a, b, S, W, rd = reads) => edge(ctx, a, b, S, W, rd) - bopPenalty(ctx, a, b, S)

export function affinity(ctx, a, b, S, rd = reads) {
  return T(ctx, 'ai.dip.posture.w.opinion') * rd.opinion(ctx, a, b) / 100 + T(ctx, 'ai.dip.posture.w.rep') * Math.tanh(rd.reputation(ctx, a, b))
    + T(ctx, 'ai.dip.posture.w.shared') * sharedThreat(ctx, a, b, S) - T(ctx, 'ai.dip.posture.w.tariff') * Math.tanh(rd.tariffAsym(ctx, a, b))
    - T(ctx, 'ai.dip.posture.w.cb') * (rd.cbs(ctx, b, a).length ? 1 : 0) }

/** One function for every B, the player included (kb Rule 1). `cache.posture[`a|b`].value` is the hysteresis memory. */
export function derivePosture(ctx, a, b, S, cache, W, rd = reads) {
  const s = affinity(ctx, a, b, S, rd), e = netEdge(ctx, a, b, S, W, rd), prev = cache?.posture?.[`${a}|${b}`]?.value, band = T(ctx, 'ai.dip.posture.band')
  const sh = v => (prev === v ? -band : 0)
  if (s >= T(ctx, 'ai.dip.posture.tAlly') + sh('Ally')) return 'Ally'
  if (s >= T(ctx, 'ai.dip.posture.tPartner') + sh('Partner')) return 'Partner'
  return e >= T(ctx, 'ai.dip.posture.tDominate') + sh('Dominate') ? 'Dominate' : 'Wary' }

export const hasUsableCB = (ctx, a, b, rd = reads) => rd.cbs(ctx, a, b).some(cb => cb.recognised !== false) && !rd.warForbidden(ctx, a, b) && !rd.atWar(ctx, a, b)
export const underPressure = (ctx, b, S, rd = reads) => S.countries.some(o => o !== b && (rd.atWar(ctx, o, b) || rd.cbs(ctx, o, b).length > 0))
