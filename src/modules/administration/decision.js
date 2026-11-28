// administration/decision.js — resolution of a debate by decision (kb administration__kb.md, Assembly Queue, "Resolution by decision", designer 2026-11-24; the object confirmed 2026-11-25)
// and the entitlement size measure (kb internal_politics__kb.md, Entitlement loss: `entitlement_loss_size` / `entitlement_gain_size` = the cost / relief of an act's `impact` on a cell).
//
// A debated Question can be decided on ANY turn of its debate when (a) two thirds of the voting Weight (`decision.majority`) supports the Government's answer and (b) nothing gates it (no covering Veto holder refuses).
// The answer is `polity.debate[key].proposal = {act: {type, params}, turn}` (event `proposeAnswer`, actions.js). Checked at step 6 for every open debate that has one; an adopted act is queued in
// `state.admin.answers` and the engine runs it as an ordinary Government action at the NEXT step 2 (resolveTurn); the debate ends RESOLVED (`decided`): no expiry modifier, the freeze ends, the slot frees.
import { gate } from '../../engine/engine.js'
import { stance, approves } from '../../kernel/stance.js'
import { parseCellKey } from '../../kernel/ids.js'
import { addressed, factionOf, countryOf } from './step.js'
import { parseAssembly, holderStrength } from './queue.js'
const sum = a => a.reduce((s, x) => s + x, 0)

/** Acts that cannot be an answer to vote on: Persuasion is applied at once; the others manage the debate itself. */
export const NOT_ANSWERS = new Set(['proposeAnswer', 'persuade', 'extendDebates', 'liftExtendDebates'])

/** The size of what an act takes from / gives to each of `keys`, read from the act type's `impact` hook (`cost` = loss, `relief` = gain; both >= 0, one scale). Derived, never stored. */
export function entitlementSize(ctx, a, keys) {
  const t = ctx.registry.get(a.type), loss = {}, gain = {}
  for (const k of keys) { const { cost = 0, relief = 0 } = t.impact?.(ctx, a, k) ?? {}; loss[k] = cost; gain[k] = relief }
  return { loss, gain } }
/** The concession a Rights/Duties act makes to a faction: concession.rightK × the mean gain over the faction's cells. A loss the same act imposes on them is not subtracted (it takes its own path as an entitlement loss). */
export function rightConcession(ctx, a, keys) {
  if (!keys.length) return 0
  const { gain } = entitlementSize(ctx, a, keys)
  return ctx.T('concession.rightK') * sum(keys.map(k => gain[k])) / keys.length }

/** The voters of a debate: the cells of its assembly with agenda strength (Council seat or Petition Right) plus the covering Veto holders of the act's domain. */
export function votersOf(ctx, d, act) {
  const asm = parseAssembly(d.assembly), cells = Object.keys(ctx.state.polity.cells).filter(k => (asm.kind === 'empire' ? ctx.derive.worldmap.regionOwner(parseCellKey(k).region) === asm.country : parseCellKey(k).region === asm.id))
  const domain = ctx.registry.get(act.type).gateDomain?.(ctx, act) ?? null, vetoes = domain ? ctx.module('polity').gateHolders(ctx, act.actor, domain) : []
  return [...new Set([...cells.filter(k => holderStrength(ctx, k) > 0), ...vetoes])].sort() }

/** Step 6 (before the queue opens new debates, so a freed slot is used at once). Returns the keys of the debates decided this turn. */
export function decideDebates(ctx) {
  const P = ctx.state.polity, byKey = Object.fromEntries(ctx.derive.polity.questions().map(q => [q.key, q])), decided = []
  for (const [key, d] of Object.entries(P.debate ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const q = byKey[key]; if (!q || !d.proposal || !d.assembly || d.decided || d.expired) continue
    const act = { actor: { kind: 'government', country: countryOf(ctx, q) }, type: d.proposal.act.type, params: d.proposal.act.params ?? {}, visibility: 'public', answerOf: key }
    const t = ctx.registry.get(act.type); if (t.validate && t.validate(ctx, act).ok === false) continue          // the answer is no longer valid: it stays a proposal until the debate ends
    if (gate(ctx, act).blocked) continue                                                                           // a covering Veto holder (or a foreign Veto) refuses
    const voters = votersOf(ctx, d, act), W = k => ctx.derive.polity.weight(k)
    if (voters.length) {                                                                                           // with no voters the Government answers alone: nothing to vote on
      const fns = ctx.module('polity').stanceFns(ctx, act.type), total = sum(voters.map(W)), yes = sum(voters.filter(k => approves(stance(k, act, ctx, fns), ctx)).map(W))
      if (yes < ctx.T('decision.majority') * total - 1e-9) continue }
    const id = ctx.nextId('ans'); ;(ctx.state.admin.answers ??= []).push({ ...act, id })
    d.decided = { turn: ctx.state.meta.turn, type: act.type, id }
    ctx.state.commitments = ctx.state.commitments.filter(c => !(c.type === 'extendDebates' && c.params.questionKey === key))      // the debate is over: its extension stops costing
    ctx.bump(); decided.push(key) }
  return decided }

/** Module hook, called by the engine before an action is applied: a Rights/Duties act taken by the Government while a Question of its Country is being debated counts as a concession
 *  for every such debate whose faction gains from it (kb internal politics, Question handling: "a Right granted during a debate counts"). */
export function onAct(ctx, a, t) {
  if (a.actor?.kind !== 'government' || !t.impact || NOT_ANSWERS.has(a.type)) return
  const P = ctx.state.polity, g = ctx.state.admin?.governments?.[a.actor.country]
  for (const q of ctx.derive.polity.questions()) { const d = P.debate?.[q.key]
    if (!d || d.decided || d.expired || countryOf(ctx, q) !== a.actor.country || !addressed(ctx, q, g)) continue
    const c = rightConcession(ctx, a, factionOf(ctx, q).cells); if (c > 0) d.conceded = (d.conceded ?? 0) + c } }
