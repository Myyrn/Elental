// ai/diplomacy/reads.js — the ONLY file of the AI-Diplomacy agent that touches ctx.state / ctx.derive / other modules. Every function takes ctx first; tests inject a fake with the same keys.
// ctx.derive.<module>.<fn> is already bound to ctx by the engine (makeCtx), so it is called WITHOUT ctx here. Spec: ai_diplomacy__spec.md §3
import { atWar } from '../../war/step.js'
const zero = { economic: 0, diplomatic: 0, military: 0, cultural: 0 }, sum = a => a.reduce((s, x) => s + x, 0)
const dip = ctx => ctx.derive?.diplomacy, partiesOf = t => t.parties ?? [t.overlord, t.subject, t.target, ...(t.imposers ?? [])].filter(Boolean)
const TIER_RANK = { Grievance: 1, Rights: 2, Sovereignty: 3, Existential: 4 }
export const reads = {
  countries: ctx => Object.keys(ctx.state.countries).sort(),
  isPlayer: (ctx, c) => !!ctx.state.countries[c]?.isPlayer,
  turn: ctx => ctx.state.meta.turn,
  opinion: (ctx, a, b) => ctx.derive.countries?.opinion?.(a, b) ?? ctx.ruleset.aiDiplomacy?.initialOpinion?.[`${a}>${b}`] ?? 0,
  leverage: (ctx, a, b) => dip(ctx)?.leverage?.(a, b) ?? zero,                       // a's leverage over b, per category, never summed here
  reputation: (ctx, a, b) => dip(ctx)?.reputation?.(a, b) ?? 0,                      // observer a's belief about subject b
  cbs: (ctx, holder, target) => dip(ctx)?.activeCBs?.(holder, target) ?? [],
  bestCBRank: (ctx, a, b) => Math.max(0, ...reads.cbs(ctx, a, b).map(c => TIER_RANK[c.tier] ?? 0)),
  warForbidden: (ctx, a, b) => !!dip(ctx)?.warForbidden?.(a, b),
  treatyTier: (ctx, a, b) => dip(ctx)?.treatyTier?.(a, b) ?? null,
  tradeDep: (ctx, a, b) => dip(ctx)?.tradeDependency?.(a, b) ?? 0,
  power: (ctx, c) => dip(ctx)?.power?.(c) ?? 1,
  treaties: (ctx, c) => (dip(ctx)?.treaties?.() ?? []).filter(t => partiesOf(t).includes(c)),
  tariffAsym: (ctx, a, b) => ctx.derive.economics?.tariffAsymmetry?.(a, b) ?? 0,     // not implemented in Economics yet
  portrait: (ctx, c) => ctx.derive.polity?.amalgam?.(c) ?? {},
  atWar: (ctx, a, b) => atWar(ctx, a, b),
  regions: (ctx, c) => [...new Set(Object.values(ctx.state.polity.cells).map(x => x.region))].filter(r => ctx.derive.worldmap.regionOwner(r) === c).sort(),
  regionPop: (ctx, r) => sum(ctx.derive.worldmap.regionProvinces(r).map(p => ctx.state.world.provinces[p].population)),
  targetScale: (ctx, r) => dip(ctx)?.targetScale?.(r) ?? 1,
  opThreshold: (ctx, p) => dip(ctx)?.opThreshold?.(p) ?? Infinity,
  detection: (ctx, c, r) => dip(ctx)?.detectionStrength?.(c, r) ?? 0,                // exact in alpha (kb Rule 11)
  espionageFree: (ctx, c) => dip(ctx)?.espionageFree?.(c) ?? 0,
  conceal: (ctx, which, level) => ctx.T(level ? `conceal.${which}.${level}` : `conceal.${which}`),
  hasCommitment: (ctx, a, type, match) => (ctx.state.commitments ?? []).some(c => c.actor?.country === a && c.type === type && Object.entries(match).every(([k, v]) => c.params?.[k] === v)),
  inboundProposals: (ctx, c) => (ctx.state.diplomacy?.proposals ?? []).filter(p => p.to === c && p.status === 'pending' && !p.accepted),
  registered: (ctx, type) => !!ctx.registry?.types?.has(type),
  validate: (ctx, order) => { const t = ctx.registry?.types?.get(order.type); if (!t) return false; try { return (t.validate?.(ctx, order) ?? { ok: true }).ok !== false } catch { return false } },
}
