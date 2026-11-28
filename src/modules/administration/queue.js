// administration/queue.js — the assembly queue (kb: Assembly Queue and Question Resolution Time; spec: administration__spec.md). Runs at step 6 right after the slate.
// A Question on the slate is DEBATED only if its assembly has a free slot for the holder who opens it; otherwise it WAITS (`polity.waiting`) and is not addressed (its faction may escalate).
// The assembly and the length of a debate follow the scope of the faction that raised the Question (kb 2026-11-22): one Region = that Region's assembly, 1 turn; several Regions = the Country's, 3; more than half of the Regions = the Country's, 5.
// Slate attention and queue slots are independent limits. Routine Questions in standing administration are not queued (spec decision). Debate state lives in `polity.debate[key]`.
import { parseCellKey } from '../../kernel/ids.js'
import { questionPriority, extendedNow, extensionShare, debateLength, questionScope, durationOf, assemblyOf, regionOf } from './step.js'
export { regionOf }
const sum = a => a.reduce((s, x) => s + x, 0), clamp01 = x => Math.min(1, Math.max(0, x))
const TIER = { existential: 0, structural: 1, routine: 2 }
/** 'region:r1' -> {kind: 'region', id: 'r1'};  'empire:A' -> {kind: 'empire', country: 'A'} */
export const parseAssembly = asm => { const i = asm.indexOf(':'), kind = asm.slice(0, i), id = asm.slice(i + 1); return kind === 'empire' ? { kind, country: id } : { kind, id } }

/** Coordination of an assembly: a Region's = the Coordination produced by pools staffed from its cells (`economics.produceCCOByRegion`; when the Country's `coordinationSupply` is overridden (scenario/test)
 *  the override is split by population); the Empire's = the Country's (the override as it is); less the share held by debate extensions. */
export function assemblyCoordination(ctx, scope) {
  const country = scope.kind === 'empire' ? scope.country : ctx.derive.worldmap.regionOwner(scope.id), g = ctx.state.admin.governments[country] ?? {}, held = 1 - extensionShare(ctx, country)
  if (scope.kind === 'empire') return Math.max(0, g.coordinationSupply ?? ctx.derive.economics.produceCCO(country).coordination) * held
  let base
  if (g.coordinationSupply !== undefined) { const cells = Object.values(ctx.state.polity.cells).filter(c => ctx.derive.worldmap.regionOwner(c.region) === country), tot = sum(cells.map(c => c.population)) || 1
    base = g.coordinationSupply * sum(cells.filter(c => c.region === scope.id).map(c => c.population)) / tot }
  else base = ctx.derive.economics.produceCCOByRegion(scope.id).coordination
  return Math.max(0, base) * held }
/** Maximum simultaneously open (debated) Questions of an assembly: derived, never stored. At least 1 (an assembly can always debate something). */
export const queueCap = (ctx, scope) => Math.max(1, Math.floor(ctx.T('assembly.k') * assemblyCoordination(ctx, scope) + 1e-9))
/** How much of the agenda a cell can claim: a Petition Right and each Council seat the cell holds. */
export function holderStrength(ctx, key) {
  const council = Object.keys(ctx.ruleset.rights ?? {}).filter(id => id.startsWith('Council') && ctx.derive.polity.right(key, id) === true).length
  return (ctx.derive.polity.right(key, 'Petition') ? 1 : 0) + council }
/** The agenda of one assembly (a Region's or the Country's): `cap`, the claimed `shares` and the `slots` {government, [cellKey]: n}. The Government keeps whatever the holders do not claim; a holder's share is
 *  assembly.agendaK × Weight × strength / Σ Weight of the assembly's cells (scaled down if the claims exceed 1). */
export function agendaOf(ctx, scope) {
  const cap = queueCap(ctx, scope), cells = Object.keys(ctx.state.polity.cells).filter(k => (scope.kind === 'empire' ? ctx.derive.worldmap.regionOwner(parseCellKey(k).region) === scope.country : parseCellKey(k).region === scope.id)).sort()
  const tot = sum(cells.map(k => ctx.derive.polity.weight(k))) || 1
  let shares = cells.map(k => [k, holderStrength(ctx, k) * ctx.derive.polity.weight(k)]).filter(([, r]) => r > 0).map(([k, r]) => [k, ctx.T('assembly.agendaK') * r / tot])
  const claimed = sum(shares.map(([, s]) => s)); if (claimed > 1) shares = shares.map(([k, s]) => [k, s / claimed])
  const slots = {}; for (const [k, s] of shares) slots[k] = Math.floor(cap * clamp01(s) + 1e-9)
  slots.government = cap - sum(Object.values(slots))
  return { cap, shares: Object.fromEntries(shares), slots } }
export const agenda = (ctx, region) => agendaOf(ctx, { kind: 'region', id: region })

/** Step 6, after the slate (and after `decideDebates`): give the listed Questions their slots. Open debates keep theirs (a debate occupies its slot until its natural length is over, an extension keeps it,
 *  an expired or a decided one frees it); the others are taken in order (tier, priority, key) and either start a debate (`since` = next turn: the turn polity first sees it; its length and assembly follow the scope
 *  of the Question's faction) or wait. The holder is the Question's own cell when it holds an agenda share, else the Government. Returns the keys that wait. */
export function openDebates(ctx) {
  const P = ctx.state.polity, D = (P.debate ??= {}), turn = ctx.state.meta.turn, waiting = (P.waiting = {}), live = ctx.derive.polity.questions(), byKey = Object.fromEntries(live.map(q => [q.key, q]))
  const agendas = {}, used = {}
  for (const [key, d] of Object.entries(D)) { const q = byKey[key]
    if (!q || !d.assembly || d.expired || d.decided || !(turn + 1 - d.since < debateLength(ctx, d) || extendedNow(ctx, q))) continue
    const u = (used[d.assembly] ??= {}); u[d.holder] = (u[d.holder] ?? 0) + 1 }
  for (const [country, g] of Object.entries(ctx.state.admin.governments)) {
    const listed = new Set((g.attention ?? []).map(a => a.questionKey))
    const cands = live.filter(q => listed.has(q.key) && !D[q.key] && ctx.derive.worldmap.regionOwner(regionOf(q)) === country).map(q => ({ q, pr: questionPriority(ctx, q) }))
      .sort((a, b) => TIER[a.q.tier] - TIER[b.q.tier] || b.pr - a.pr || (a.q.key < b.q.key ? -1 : 1))
    for (const { q } of cands) { const scope = questionScope(ctx, q), asm = assemblyOf(ctx, q, scope), a = (agendas[asm] ??= agendaOf(ctx, parseAssembly(asm))), u = (used[asm] ??= {}), holder = (a.slots[q.cell] ?? 0) > 0 ? q.cell : 'government'
      if ((u[holder] ?? 0) < a.slots[holder]) { D[q.key] = { since: turn + 1, duration: durationOf(ctx, scope), assembly: asm, holder, scope }; u[holder] = (u[holder] ?? 0) + 1 } else waiting[q.key] = true } }
  return Object.keys(waiting).sort() }
