// administration/module.js — Control dial -> involuntary compliance; Observation; the Question slate and the assembly queue (step 6); debate extensions; resolution of a debate by decision.
import { resolveAllocation, grantFor } from '../../kernel/allocation.js'
import { parseCellKey } from '../../kernel/ids.js'
import { covers } from '../../kernel/scope.js'
import { step6, questionPriority, addressed, extensionShare, questionScope, countryOf } from './step.js'
import { openDebates, agendaOf, parseAssembly, regionOf } from './queue.js'
import { decideDebates, onAct as concede } from './decision.js'
export function scopeCtx(ctx, country) {
  const keys = Object.keys(ctx.state.polity.cells).filter(k => ctx.derive.worldmap.regionOwner(parseCellKey(k).region) === country)
  return { country, cellKeys: () => keys, cellCountry: k => ctx.derive.worldmap.regionOwner(parseCellKey(k).region), T: ctx.T }
}
const gov = (ctx, c) => ctx.state.admin.governments[c]
const TIER = { existential: 0, structural: 1, routine: 2 }
/** Readout of the Government's slate and assemblies (derived, nothing stored): every live Question of the Country with its tier, priority, scope, HANDLING (ignored | consulted | debated, Internal Politics) and STATUS —
 *  'slate' (on attention and debated), 'standing' (routine, handled by standing administration), 'debate' (the debate is open or extended though the slate no longer lists it),
 *  'waiting' (on the slate but its assembly has no free slot: not addressed), 'unaddressed' (its faction may escalate); and the assemblies in play: cap, slots, open debates.
 *  A row's `debate` is the debate record, including the Government's proposed answer (`proposal`) and, once adopted, `decided`. */
export function slateReadout(ctx, country) {
  const g = gov(ctx, country) ?? {}, att = new Set((g.attention ?? []).map(a => a.questionKey)), std = new Set(g.standing ?? []), D = ctx.state.polity.debate ?? {}, Wt = ctx.state.polity.waiting ?? {}
  const questions = ctx.derive.polity.questions().filter(q => countryOf(ctx, q) === country).map(q => { const on = addressed(ctx, q, g), petition = !!ctx.derive.polity.right(q.cell, 'Petition')
    return { key: q.key, cell: q.cell, need: q.need, tier: q.tier, gap: q.gap, priority: questionPriority(ctx, q), scope: questionScope(ctx, q), petition, handling: !on ? 'ignored' : petition ? 'debated' : 'consulted',
      status: !on ? (Wt[q.key] ? 'waiting' : 'unaddressed') : att.has(q.key) ? 'slate' : std.has(q.key) ? 'standing' : 'debate', debate: D[q.key] ?? null } })
    .sort((a, b) => TIER[a.tier] - TIER[b.tier] || b.priority - a.priority || a.key.localeCompare(b.key))
  const asms = [...new Set([...questions.map(q => (q.scope === 'region' ? `region:${regionOf(q)}` : `empire:${country}`)), ...Object.values(D).map(d => d.assembly).filter(a => a && a.endsWith(`:${country}`))])].sort()
  return { attention: g.attention ?? [], standing: g.standing ?? [], questions, unaddressed: questions.filter(q => q.status === 'unaddressed').map(q => q.key), waiting: questions.filter(q => q.status === 'waiting').map(q => q.key),
    assemblies: asms.map(asm => { const a = agendaOf(ctx, parseAssembly(asm)); return { assembly: asm, cap: a.cap, slots: a.slots, open: Object.values(D).filter(d => d.assembly === asm && !d.expired && !d.decided).length } }) } }
export const administrationModule = { id: 'administration', steps: { 6: ctx => { step6(ctx); decideDebates(ctx); openDebates(ctx) } },      // slate, then the votes of open debates (a decided debate frees its slot), then the queue
  onAct: (ctx, a, t) => concede(ctx, a, t),                                                                                          // engine hook before an action applies: a Right granted during a debate is a concession
  derive: {
  controlSupply: (ctx, country) => Math.max(0, (gov(ctx, country).controlSupply ?? ctx.derive.economics.produceCCO(country).control) + (gov(ctx, country).controlBonus ?? 0) - (ctx.derive.war?.martialCost?.(country) ?? 0)) * (1 - extensionShare(ctx, country)),   // minus the martial-law Control cost of held cells; controlBonus: coercion gains (Demotion Duty); the share held by debate extensions is taken off
  controlResult: (ctx, country) => resolveAllocation(gov(ctx, country).controlDial ?? { entries: [] }, ctx.derive.administration.controlSupply(country), scopeCtx(ctx, country)),
  controlGrant: (ctx, key) => { const c = ctx.derive.worldmap.regionOwner(parseCellKey(key).region)
    return grantFor(ctx.derive.administration.controlResult(c), key) },
  coordinationSupply: (ctx, country) => Math.max(0, gov(ctx, country).coordinationSupply ?? ctx.derive.economics.produceCCO(country).coordination) * (1 - extensionShare(ctx, country)),   // the slate's budget; the share held by debate extensions is taken off; Emergency Powers' cost will be subtracted here
  extensionShare: (ctx, country) => extensionShare(ctx, country),
  slate: slateReadout,
} }
