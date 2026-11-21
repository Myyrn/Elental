// administration/queue.js — the assembly queue (kb: Assembly Queue and Question Resolution Time; spec: administration__spec.md). Runs at step 6 right after the slate.
// A Question on the slate is DEBATED only if its Region assembly has a free slot for the holder who opens it; otherwise it WAITS (`polity.waiting`) and is not addressed (its faction may escalate).
// Slate attention and queue slots are independent limits. Routine Questions in standing administration are not queued (spec decision). Debate state lives in `polity.debate[key]`.
import { parseCellKey } from '../../kernel/ids.js'
import { questionPriority, extendedNow, extensionShare, debateLength } from './step.js'
const sum = a => a.reduce((s, x) => s + x, 0), clamp01 = x => Math.min(1, Math.max(0, x))
const TIER = { existential: 0, structural: 1, routine: 2 }
export const regionOf = q => parseCellKey(q.cell).region

/** Coordination of an assembly: a Region's = the Coordination produced by pools staffed from its cells (`economics.produceCCOByRegion`; when the Country's `coordinationSupply` is overridden (scenario/test)
 *  the override is split by population); the Empire's = the Country's; less the share held by debate extensions. */
export function assemblyCoordination(ctx, scope) {
  if (scope.kind === 'empire') return ctx.derive.economics.produceCCO(scope.country).coordination * (1 - extensionShare(ctx, scope.country))
  const country = ctx.derive.worldmap.regionOwner(scope.id), g = ctx.state.admin.governments[country] ?? {}
  let base
  if (g.coordinationSupply !== undefined) { const cells = Object.values(ctx.state.polity.cells).filter(c => ctx.derive.worldmap.regionOwner(c.region) === country), tot = sum(cells.map(c => c.population)) || 1
    base = g.coordinationSupply * sum(cells.filter(c => c.region === scope.id).map(c => c.population)) / tot }
  else base = ctx.derive.economics.produceCCOByRegion(scope.id).coordination
  return Math.max(0, base) * (1 - extensionShare(ctx, country)) }
/** Maximum simultaneously open (debated) Questions of an assembly: derived, never stored. At least 1 (an assembly can always debate something). */
export const queueCap = (ctx, scope) => Math.max(1, Math.floor(ctx.T('assembly.k') * assemblyCoordination(ctx, scope) + 1e-9))
/** How much of the agenda a cell can claim: a Petition Right and each Council seat the cell holds. */
export function holderStrength(ctx, key) {
  const council = Object.keys(ctx.ruleset.rights ?? {}).filter(id => id.startsWith('Council') && ctx.derive.polity.right(key, id) === true).length
  return (ctx.derive.polity.right(key, 'Petition') ? 1 : 0) + council }
/** The agenda of one Region assembly: `cap`, the claimed `shares` and the `slots` {government, [cellKey]: n}. The Government keeps whatever the holders do not claim; a holder's share is
 *  assembly.agendaK × Weight × strength / Σ Weight of the Region's cells (scaled down if the claims exceed 1). */
export function agenda(ctx, region) {
  const cap = queueCap(ctx, { kind: 'region', id: region }), cells = Object.keys(ctx.state.polity.cells).filter(k => parseCellKey(k).region === region).sort()
  const tot = sum(cells.map(k => ctx.derive.polity.weight(k))) || 1
  let shares = cells.map(k => [k, holderStrength(ctx, k) * ctx.derive.polity.weight(k)]).filter(([, r]) => r > 0).map(([k, r]) => [k, ctx.T('assembly.agendaK') * r / tot])
  const claimed = sum(shares.map(([, s]) => s)); if (claimed > 1) shares = shares.map(([k, s]) => [k, s / claimed])
  const slots = {}; for (const [k, s] of shares) slots[k] = Math.floor(cap * clamp01(s) + 1e-9)
  slots.government = cap - sum(Object.values(slots))
  return { cap, shares: Object.fromEntries(shares), slots } }

/** Step 6, after the slate: give the listed Questions their slots. Open debates keep theirs (a debate occupies its slot until its natural length is over, an extension keeps it, an expired one frees it);
 *  the others are taken in order (tier, priority, key) and either start a debate (`since` = next turn: the turn polity first sees it) or wait. The holder is the Question's own cell when it holds an
 *  agenda share, else the Government. Returns the keys that wait. */
export function openDebates(ctx) {
  const P = ctx.state.polity, D = (P.debate ??= {}), turn = ctx.state.meta.turn, waiting = (P.waiting = {}), live = ctx.derive.polity.questions(), byKey = Object.fromEntries(live.map(q => [q.key, q])), dur = ctx.T('question.turns.region')
  const agendas = {}, ag = r => (agendas[r] ??= agenda(ctx, r)), used = {}
  for (const [key, d] of Object.entries(D)) { const q = byKey[key]
    if (!q || !d.assembly || d.expired || !(turn + 1 - d.since < debateLength(ctx, d) || extendedNow(ctx, q))) continue
    const u = (used[d.assembly] ??= {}); u[d.holder] = (u[d.holder] ?? 0) + 1 }
  for (const [country, g] of Object.entries(ctx.state.admin.governments)) {
    const listed = new Set((g.attention ?? []).map(a => a.questionKey))
    const cands = live.filter(q => listed.has(q.key) && !D[q.key] && ctx.derive.worldmap.regionOwner(regionOf(q)) === country).map(q => ({ q, pr: questionPriority(ctx, q) }))
      .sort((a, b) => TIER[a.q.tier] - TIER[b.q.tier] || b.pr - a.pr || (a.q.key < b.q.key ? -1 : 1))
    for (const { q } of cands) { const region = regionOf(q), a = ag(region), asm = `region:${region}`, u = (used[asm] ??= {}), holder = (a.slots[q.cell] ?? 0) > 0 ? q.cell : 'government'
      if ((u[holder] ?? 0) < a.slots[holder]) { D[q.key] = { since: turn + 1, duration: dur, assembly: asm, holder }; u[holder] = (u[holder] ?? 0) + 1 } else waiting[q.key] = true } }
  return Object.keys(waiting).sort() }
