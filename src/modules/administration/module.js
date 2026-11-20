// administration/module.js — Control dial -> involuntary compliance; Observation; the Question slate (step 6); debate extensions.
import { resolveAllocation, grantFor } from '../../kernel/allocation.js'
import { parseCellKey } from '../../kernel/ids.js'
import { covers } from '../../kernel/scope.js'
import { step6, questionPriority, addressed, extensionShare } from './step.js'
export function scopeCtx(ctx, country) {
  const keys = Object.keys(ctx.state.polity.cells).filter(k => ctx.derive.worldmap.regionOwner(parseCellKey(k).region) === country)
  return { country, cellKeys: () => keys, cellCountry: k => ctx.derive.worldmap.regionOwner(parseCellKey(k).region), T: ctx.T }
}
const gov = (ctx, c) => ctx.state.admin.governments[c]
const TIER = { existential: 0, structural: 1, routine: 2 }
/** Readout of the Government's slate (derived, nothing stored): every live Question of the Country with its tier, priority and STATUS —
 *  'slate' (on attention), 'standing' (routine, handled by standing administration), 'debate' (the debate is open or extended though the slate no longer lists it), 'unaddressed' (its faction may escalate). */
export function slateReadout(ctx, country) {
  const g = gov(ctx, country) ?? {}, att = new Set((g.attention ?? []).map(a => a.questionKey)), std = new Set(g.standing ?? []), D = ctx.state.polity.debate ?? {}
  const questions = ctx.derive.polity.questions().filter(q => ctx.derive.worldmap.regionOwner(parseCellKey(q.cell).region) === country).map(q => ({ key: q.key, cell: q.cell, need: q.need, tier: q.tier, gap: q.gap, priority: questionPriority(ctx, q),
    status: !addressed(ctx, q, g) ? 'unaddressed' : att.has(q.key) ? 'slate' : std.has(q.key) ? 'standing' : 'debate', debate: D[q.key] ?? null }))
    .sort((a, b) => TIER[a.tier] - TIER[b.tier] || b.priority - a.priority || a.key.localeCompare(b.key))
  return { attention: g.attention ?? [], standing: g.standing ?? [], questions, unaddressed: questions.filter(q => q.status === 'unaddressed').map(q => q.key) } }
export const administrationModule = { id: 'administration', steps: { 6: step6 }, derive: {
  controlSupply: (ctx, country) => Math.max(0, (gov(ctx, country).controlSupply ?? ctx.derive.economics.produceCCO(country).control) + (gov(ctx, country).controlBonus ?? 0) - (ctx.derive.war?.martialCost?.(country) ?? 0)) * (1 - extensionShare(ctx, country)),   // minus the martial-law Control cost of held cells; controlBonus: coercion gains (Demotion Duty); the share held by debate extensions is taken off
  controlResult: (ctx, country) => resolveAllocation(gov(ctx, country).controlDial ?? { entries: [] }, ctx.derive.administration.controlSupply(country), scopeCtx(ctx, country)),
  controlGrant: (ctx, key) => { const c = ctx.derive.worldmap.regionOwner(parseCellKey(key).region)
    return grantFor(ctx.derive.administration.controlResult(c), key) },
  coordinationSupply: (ctx, country) => Math.max(0, gov(ctx, country).coordinationSupply ?? ctx.derive.economics.produceCCO(country).coordination) * (1 - extensionShare(ctx, country)),   // the slate's budget; the share held by debate extensions is taken off; Emergency Powers' cost will be subtracted here
  extensionShare: (ctx, country) => extensionShare(ctx, country),
  slate: slateReadout,
} }
