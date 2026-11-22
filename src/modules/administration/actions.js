// administration/actions.js — `extendDebates` (commitment), `liftExtendDebates` (event) and `persuade` (event). Kb: administration__kb.md, Assembly Queue (Extending a debate, 2026-11-20); internal_politics__kb.md, Compliance and Question handling (2026-11-22).
// The extension's cost is a SHARE taken off the produced Control and Coordination (`derive.administration.{controlSupply, coordinationSupply}` multiply by 1 − extensionShare), not a claim, so `costs()` is [].
import { parseCellKey } from '../../kernel/ids.js'
import { addOpinionMod } from '../polity/cellstate.js'
import { opinionModDecay } from '../polity/transfer.js'
import { extensions, isListed, addressed, factionOf, countryOf } from './step.js'
const no = m => ({ ok: false, reasons: [m] })
const liveQuestion = (ctx, key) => ctx.derive.polity.questions().find(x => x.key === key)
/** What Question-time Persuasion costs the Ledger: persuade.costK × amount × the population of the faction that raised the Question / persuade.popUnit. */
export function persuasionCost(ctx, q, amount) {
  return ctx.T('persuade.costK') * amount * factionOf(ctx, q).cells.reduce((s, k) => s + (ctx.state.polity.cells[k]?.population ?? 0), 0) / ctx.T('persuade.popUnit') }
export function registerAdministrationActions(reg) {
  reg.register({ id: 'extendDebates', module: 'administration', class: 'commitment', gateDomain: () => null, defaultVisibility: 'public', costs: () => [], axisLoads: {},
    validate: (ctx, a) => {
      const key = a.params?.questionKey, q = liveQuestion(ctx, key)
      if (a.actor.kind !== 'government') return no('a Government order is required')
      if (!q) return no('unknown Question, or it is no longer live')
      if (countryOf(ctx, q) !== a.actor.country) return no('not a Question of your Country')
      const P = ctx.state.polity, d = P.debate?.[key]
      if (!(d ? !d.expired : (isListed(q, ctx.state.admin?.governments?.[a.actor.country]) && !P.waiting?.[key]))) return no('the Question is not being debated')
      if (extensions(ctx, a.actor.country).some(c => c.params.questionKey === key)) return no('this debate is already extended')
      return { ok: true } },
    apply: (ctx, a) => { ctx.state.commitments.push({ id: a.id, actor: a.actor, type: 'extendDebates', claims: [], since: ctx.state.meta.turn, renew: true, params: { questionKey: a.params.questionKey } }) },
    affectedCells: () => [] })
  reg.register({ id: 'liftExtendDebates', module: 'administration', class: 'event', gateDomain: () => null, defaultVisibility: 'public', costs: () => [], axisLoads: {},
    validate: (ctx, a) => (ctx.state.commitments.some(c => c.id === a.params?.id && c.type === 'extendDebates' && c.actor.country === a.actor.country) ? { ok: true } : no('no such extension of yours')),
    apply: (ctx, a) => { ctx.state.commitments = ctx.state.commitments.filter(c => c.id !== a.params.id) } })
  // Question-time Persuasion (Internal Politics, Compliance; proposed 2026-11-22): the Ledger pays, every cell of the faction that raised the Question gets a decaying positive Opinion-toward-Government modifier,
  // and the amount counts as a concession in the Question's debate (Question handling).
  reg.register({ id: 'persuade', module: 'administration', class: 'event', gateDomain: () => null, defaultVisibility: 'public', costs: () => [], axisLoads: {},
    validate: (ctx, a) => {
      const key = a.params?.questionKey, amount = a.params?.amount, q = liveQuestion(ctx, key)
      if (a.actor.kind !== 'government') return no('a Government order is required')
      if (!q) return no('unknown Question, or it is no longer live')
      if (countryOf(ctx, q) !== a.actor.country) return no('not a Question of your Country')
      if (!(amount > 0)) return no('the amount must be above 0')
      const g = ctx.state.admin?.governments?.[a.actor.country]
      if (!addressed(ctx, q, g)) return no('the Question is not being discussed')
      if (!((g?.ledger ?? 0) >= persuasionCost(ctx, q, amount) - 1e-9)) return no('the Ledger cannot pay')
      return { ok: true } },
    apply: (ctx, a) => {
      const key = a.params.questionKey, q = liveQuestion(ctx, key), turn = ctx.state.meta.turn, g = ctx.state.admin.governments[a.actor.country]; if (!q) return
      g.ledger -= persuasionCost(ctx, q, a.params.amount)
      for (const k of factionOf(ctx, q).cells) { const c = ctx.state.polity.cells[k]; if (c) addOpinionMod(c, { id: `persuade.${turn}.${key}`, value: a.params.amount, decay: opinionModDecay, turn, source: 'persuasion' }) }
      const d = ctx.state.polity.debate?.[key]; if (d) d.conceded = (d.conceded ?? 0) + a.params.amount },
    affectedCells: (ctx, a) => { const q = liveQuestion(ctx, a.params?.questionKey); return q ? factionOf(ctx, q).cells : [] } })
}
