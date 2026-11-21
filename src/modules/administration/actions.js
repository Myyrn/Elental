// administration/actions.js — `extendDebates` (commitment) and `liftExtendDebates` (event). Kb: administration__kb.md, Assembly Queue (Extending a debate, 2026-11-20); spec: administration__spec.md.
// The cost is a SHARE taken off the produced Control and Coordination (`derive.administration.{controlSupply, coordinationSupply}` multiply by 1 − extensionShare), not a claim, so `costs()` is [].
import { parseCellKey } from '../../kernel/ids.js'
import { extensions, isListed } from './step.js'
const no = m => ({ ok: false, reasons: [m] })
export function registerAdministrationActions(reg) {
  reg.register({ id: 'extendDebates', module: 'administration', class: 'commitment', gateDomain: () => null, defaultVisibility: 'public', costs: () => [], axisLoads: {},
    validate: (ctx, a) => {
      const key = a.params?.questionKey, q = ctx.derive.polity.questions().find(x => x.key === key)
      if (a.actor.kind !== 'government') return no('a Government order is required')
      if (!q) return no('unknown Question, or it is no longer live')
      if (ctx.derive.worldmap.regionOwner(parseCellKey(q.cell).region) !== a.actor.country) return no('not a Question of your Country')
      const P = ctx.state.polity, d = P.debate?.[key]
      if (!(d ? !d.expired : (isListed(q, ctx.state.admin?.governments?.[a.actor.country]) && !P.waiting?.[key]))) return no('the Question is not being debated')
      if (extensions(ctx, a.actor.country).some(c => c.params.questionKey === key)) return no('this debate is already extended')
      return { ok: true } },
    apply: (ctx, a) => { ctx.state.commitments.push({ id: a.id, actor: a.actor, type: 'extendDebates', claims: [], since: ctx.state.meta.turn, renew: true, params: { questionKey: a.params.questionKey } }) },
    affectedCells: () => [] })
  reg.register({ id: 'liftExtendDebates', module: 'administration', class: 'event', gateDomain: () => null, defaultVisibility: 'public', costs: () => [], axisLoads: {},
    validate: (ctx, a) => (ctx.state.commitments.some(c => c.id === a.params?.id && c.type === 'extendDebates' && c.actor.country === a.actor.country) ? { ok: true } : no('no such extension of yours')),
    apply: (ctx, a) => { ctx.state.commitments = ctx.state.commitments.filter(c => c.id !== a.params.id) } })
}
