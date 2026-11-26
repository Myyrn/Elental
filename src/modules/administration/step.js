// administration/step.js — pipeline step 6: the Question active slate for NEXT turn (the slate lags one turn). Spec: administration__spec.md, Question Active Slate.
// The slate is the Government's ATTENTION only: Questions exist independent of it (polity). Routine Questions have no slate commitment (kb): standing administration handles them for a continuous overhead.
// Which listed Questions are actually DEBATED is decided by the assembly queue (queue.js) right after the slate.
import { parseCellKey } from '../../kernel/ids.js'
const TIER = { existential: 0, structural: 1, routine: 2 }
// = polity propaganda.propagandaDraw(country); not imported because propaganda.js imports this module (scopeCtx)
const propagandaDraw = (ctx, country) => ctx.state.commitments.filter(c => c.type === 'propaganda' && c.actor.kind === 'government' && c.actor.country === country).reduce((a, c) => a + c.params.amount, 0)
/** Order of Questions inside a tier (spec decision, the instantiation of polity's queue_priority): gap x Weight of the cell, times the Petition multiplier when the cell holds the Petition Right. */
export const questionPriority = (ctx, q) => q.gap * ctx.derive.polity.weight(q.cell) * (ctx.derive.polity.right(q.cell, 'Petition') ? ctx.T('queue.petitionMult') : 1)

export const regionOf = q => parseCellKey(q.cell).region
export const needOf = q => q.key.split('|').pop()
export const countryOf = (ctx, q) => ctx.derive.worldmap.regionOwner(regionOf(q))
/** The faction that raised a Question (kb 2026-11-22): the cells of the Country that hold a live Question on the same issue (the Question's own cell included), and the Regions they sit in. */
export function factionOf(ctx, q) {
  const owner = countryOf(ctx, q), issue = needOf(q), cells = new Set([q.cell])
  for (const x of ctx.derive.polity.questions()) if (needOf(x) === issue && countryOf(ctx, x) === owner) cells.add(x.cell)
  const list = [...cells].sort(); return { owner, cells: list, regions: new Set(list.map(k => parseCellKey(k).region)) } }
/** The scope of a Question is the scope of its faction (designer 2026-11-22): all its cells in one Region = 'region'; cells from more than half of the Country's Regions = 'empire' (country-wide); otherwise 'multi'. */
export function questionScope(ctx, q) {
  const f = factionOf(ctx, q); if (f.regions.size <= 1) return 'region'
  const total = new Set(Object.values(ctx.state.world.regionSnapshot.assignment).filter(r => ctx.derive.worldmap.regionOwner(r) === f.owner)).size || f.regions.size
  return f.regions.size > 0.5 * total ? 'empire' : 'multi' }
/** Length of a debate by the scope of the Question: question.turns.region / multi / empire (1 / 3 / 5, placeholders). */
export const durationOf = (ctx, scope) => ctx.T(`question.turns.${scope}`)
/** A Question of one Region is debated in that Region's assembly; a multi-Region or country-wide one in the Country's. */
export const assemblyOf = (ctx, q, scope) => (scope === 'region' ? `region:${regionOf(q)}` : `empire:${countryOf(ctx, q)}`)

/** Is the Question on the Government's slate (attention) or handled by standing administration? (what step 6 wrote last turn) */
export const isListed = (q, g) => !!g && ((g.attention ?? []).some(a => a.questionKey === q.key) || (g.standing ?? []).includes(q.key))

// ---------------------------------------------------------------- extending a debate (kb 2026-11-20; commitment `extendDebates`, see actions.js)
/** The `extendDebates` commitments of a Country: {id, params: {questionKey}}. */
export const extensions = (ctx, country) => (ctx.state.commitments ?? []).filter(c => c.type === 'extendDebates' && c.actor.kind === 'government' && c.actor.country === country)
/** The debate's natural length: the one recorded when it opened, else the placeholder for a single-Region Question. */
export const debateLength = (ctx, d) => d?.duration ?? ctx.T('question.turns.region')
/** k = the turns a debate has been prolonged beyond its natural timespan: 0 during it, 1 on the first extra turn, 2 on the next ... */
export function extensionTurns(ctx, key) {
  const d = ctx.state.polity.debate?.[key]; if (!d) return 0
  return Math.max(0, ctx.state.meta.turn - d.since - debateLength(ctx, d) + 1) }
/** The share of produced Control and of produced Coordination the Country's extensions hold: min(1, Σ s0 × k²) over its extended Questions. Both supplies are multiplied by (1 − share). */
export function extensionShare(ctx, country) {
  let s = 0; for (const c of extensions(ctx, country)) { const k = extensionTurns(ctx, c.params.questionKey); s += ctx.T('debate.extendBase') * k * k }
  return Math.min(1, s) }
/** The Government pays to keep this Question discussed: an extension names it, a debate record exists (not decided: a decided debate is over) and the share is still payable (< 1). */
export const extendedNow = (ctx, q) => { const country = countryOf(ctx, q), d = ctx.state.polity.debate?.[q.key]
  return !!d && !d.decided && extensions(ctx, country).some(c => c.params.questionKey === q.key) && extensionShare(ctx, country) < 1 }

/** ADDRESSED = the Question is being discussed: a debate is open (a record `polity.debate[key] = {since, duration, assembly?, holder?, scope?, conceded?, expired?, proposal?, decided?}`: opened by the assembly queue at step 6
 *  for a Question on the slate, or by polity the turn it first sees a routine Question in standing administration; it lasts its recorded length, or until it is DECIDED by the holders' vote, decision.js),
 *  or the Government extends it. A Question on the slate that the queue has not given a slot (`polity.waiting`) is NOT addressed. After the debate ends the Question is not addressed again until it stops being live (kb 2026-11-19/20). */
export function addressed(ctx, q, g) {
  const P = ctx.state.polity, d = P.debate?.[q.key]
  const open = d ? !d.decided && ctx.state.meta.turn - d.since < debateLength(ctx, d) : (isListed(q, g) && !P.waiting?.[q.key])
  return open || extendedNow(ctx, q) }

export function step6(ctx) {
  const byCountry = {}
  for (const q of ctx.derive.polity.questions()) (byCountry[ctx.derive.worldmap.regionOwner(parseCellKey(q.cell).region)] ??= []).push({ ...q, priority: questionPriority(ctx, q) })
  const overhead = ctx.T('admin.routineOverhead')
  for (const [country, g] of Object.entries(ctx.state.admin.governments)) {
    const qs = (byCountry[country] ?? []).sort((a, b) => TIER[a.tier] - TIER[b.tier] || b.priority - a.priority || a.key.localeCompare(b.key))
    let coord = ctx.derive.administration.coordinationSupply(country)
    const routine = qs.filter(q => q.tier === 'routine'), handled = overhead > 0 ? Math.min(routine.length, Math.floor(coord / overhead + 1e-9)) : routine.length
    g.standing = routine.slice(0, handled).map(q => q.key); coord -= overhead * handled      // the rest become unaddressed (never removed; their factions may escalate)
    coord -= propagandaDraw(ctx, country)                                                    // the Government's propaganda is paid from the Coordination pool
    g.attention = []
    for (const q of qs) { if (q.tier === 'routine') continue
      const th = ctx.T(`slate.${q.tier}`)                                                    // fixed Coordination threshold per tier: breadth, not depth
      if (coord >= th) { g.attention.push({ questionKey: q.key, coordinationCommitted: th }); coord -= th } } } }
