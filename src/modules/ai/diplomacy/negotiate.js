// ai/diplomacy/negotiate.js — the Government's position on pending proposals: accept, reject, or stay silent (counter-steps wait for the Negotiation Session). Spec: §5
import { reads } from './reads.js'
import { T } from './tuning.js'
import { TIER_ROLE } from './config.js'
import { CATS, sum } from './posture.js'
const roleOf = p => (p.kind === 'Alliance' ? TIER_ROLE[p.tier] : p.kind === 'Confederation' ? 'treatyOff' : p.kind === 'Cooperation' ? 'treatyBN' : null)
function satisfaction(a, p, pf, W, cfg) {
  if (p.kind === 'Dependency') return p.subject === a ? -1 : pf * 0.8
  const role = roleOf(p), eff = role && cfg.effects[role]; return eff ? pf * sum(CATS.map(k => W[k] * (eff[k] ?? 0))) : 0 }
export function respond(ctx, a, posture, W, cfg, rd = reads) {
  const out = []
  for (const p of rd.inboundProposals(ctx, a)) {
    const pf = cfg.postureFactor[posture[p.from]]; if (pf === undefined) continue            // proposer not a Country we hold a posture toward
    const sat = satisfaction(a, p, pf, W, cfg), accept = sat >= T(ctx, 'ai.dip.neg.accept'), reject = sat < T(ctx, 'ai.dip.neg.walk'); if (!accept && !reject) continue
    const order = { id: `ai.${a}.answer.${p.id}.${rd.turn(ctx)}`, actor: { kind: 'government', country: a }, type: 'answerProposal', params: { id: p.id, accept } }
    if (rd.registered(ctx, 'answerProposal') && rd.validate(ctx, order)) out.push(order) }
  return out }
