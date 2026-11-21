// client/readoutsAdmin.js — the Government's slate, debates and assemblies as UI queries (UI Rule 4: derived readouts only). Merged into the query table by EngineClient.
import { readouts } from './readouts.js'
import { extensions, extensionTurns, extensionShare } from '../modules/administration/step.js'
const r2 = x => Math.round(x * 100) / 100
export const adminReadouts = {
  /** The Question list by severity (see readouts.questions); the slate and the debates live in `slate`. */
  questions(client, ctx, args) { const r = readouts.questions(client, ctx, args); r.note = 'Questions by severity; the Government slate, debates and assemblies: query `slate`'; return r },
  /** The Government's slate: every live Question with its status (slate | standing | debate | waiting | unaddressed), the Region assemblies (cap, slots, open debates), the debate extensions with their k and the held share,
   *  and the free-colonization commitments (ids for the lift forms). */
  slate(client, ctx, { country }) {
    const s = ctx.derive.administration.slate(country)
    return { ...s, turn: ctx.state.meta.turn, heldShare: r2(extensionShare(ctx, country)), controlSupply: r2(ctx.derive.administration.controlSupply(country)), coordinationSupply: r2(ctx.derive.administration.coordinationSupply(country)),
      extensions: extensions(ctx, country).map(c => ({ id: c.id, questionKey: c.params.questionKey, turns: extensionTurns(ctx, c.params.questionKey) })),
      colonization: ctx.state.commitments.filter(c => c.type === 'freeColonization' && c.actor.kind === 'government' && c.actor.country === country).map(c => ({ id: c.id, incentive: c.params.incentive })) } },
}
