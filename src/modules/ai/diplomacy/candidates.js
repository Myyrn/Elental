// ai/diplomacy/candidates.js — candidate actions per Campaign type. Every candidate is validated against the real ActionRegistry; unregistered or invalid ones are dropped.
// Spec: ai_diplomacy__spec.md §4
import { reads } from './reads.js'
import { T } from './tuning.js'
import { TIER_ROLE } from './config.js'
import { sum, netEdge, underPressure } from './posture.js'
const LADDER = ['BenevolentNeutrality', 'Defensive', 'StandingOffensive'], GOALS = ['tribute', 'cede', 'dependency', 'annex']
const actor = a => ({ kind: 'government', country: a })

export function generate(ctx, a, c, posture, S, W, rd = reads) {
  const turn = rd.turn(ctx), b = c.target, out = []
  const nextTier = (x, y) => { if (rd.atWar(ctx, x, y)) return null; const cur = rd.treatyTier(ctx, x, y), i = LADDER.indexOf(cur); return cur === 'Confederation' ? null : i < 0 ? LADDER[0] : (LADDER[i + 1] ?? null) }
  const treaty = (to, tier, tag, magnitude = 1) => { if (!tier) return; const role = TIER_ROLE[tier]
    out.push({ key: `${role}|${to}|${tag}`, role, tag: tag ? `${role}:${tag}` : role, pool: 'proposals', labour: 1, magnitude, exclusive: `treaty|${to}`,
      order: { id: `ai.${a}.${role}.${to}.${turn}`, actor: actor(a), type: 'proposeTreaty', params: { to, kind: 'Alliance', tier, ...(tier === 'Guarantee' ? { guarantor: a } : {}) } } }) }
  const regionsByPop = y => rd.regions(ctx, y).map(r => [r, rd.regionPop(ctx, r)]).sort((p, q) => q[1] - p[1] || p[0].localeCompare(q[0]))
  const popTotal = y => sum(regionsByPop(y).map(r => r[1])) || 1
  const exposure = (y, region, level) => { const d = rd.detection(ctx, y, region), s = rd.targetScale(ctx, region), full = T(ctx, 'ai.dip.cost.exposure')
    if (d < rd.conceal(ctx, 'act', level) * s) return 0; return d < rd.conceal(ctx, 'sender', level) * s ? 0.3 * full : full }
  // one Espionage-pool operation: binary threshold, labour = the threshold exactly (no partial funding, no refund)
  const covert = (type, kind, y, region, params, role, tag, magnitude, extra = {}) => {
    const need = rd.opThreshold(ctx, { kind, tier: params.tier ?? 'covert', region, falseFlag: params.falseFlag }); if (!Number.isFinite(need)) return
    if (rd.hasCommitment(ctx, a, 'covert', { target: y, region, kind })) return
    const labour = Math.ceil(need * 1000) / 1000
    out.push({ key: `${role}|${y}|${region}`, role, tag: tag ? `${role}:${tag}` : role, pool: 'espionage', labour, magnitude, exclusive: `cov|${y}|${region}`, ...extra,
      order: { id: `ai.${a}.${role}.${y}.${region}.${turn}`, actor: actor(a), type, params: { target: y, region, labour, ...params } } }) }
  // CB fabrication by false flag: offered only when the victim would notice the act yet still attribute it to the apparent sender (exact detection read)
  const frame = (victim, region, role, harm) => { const d = rd.detection(ctx, victim, region), s = rd.targetScale(ctx, region)
    if (!(d >= rd.conceal(ctx, 'sender', 'low') * s && d < rd.conceal(ctx, 'falseFlag') * s)) return
    covert('covertInfluence', 'influence', victim, region, { concealment: 'low', falseFlag: b, grievanceNeed: 'subsistence' }, role, '', 0.5, { harm, risk: 0 }) }
  const coalitionRequests = () => { for (const x of S.countries) if (x !== a && x !== b && ['Ally', 'Partner'].includes(posture[x]) && rd.cbs(ctx, x, b).length) treaty(x, 'Coalition', 'request', 0.5) }

  switch (c.type) {
    case 'Court': treaty(b, nextTier(a, b), '')
      for (const [r, pop] of regionsByPop(b).slice(0, 2)) covert('foreignPropaganda', 'propaganda', b, r, { tier: 'overt' }, 'propaganda', 'overt', pop / popTotal(b), { risk: 0 })
      break
    case 'Support': treaty(b, nextTier(a, b), '')
      if (underPressure(ctx, b, S, rd) && rd.treatyTier(ctx, a, b) !== 'Guarantee') treaty(b, 'Guarantee', '')
      if (S.countries.some(x => x !== a && x !== b && rd.atWar(ctx, b, x))) treaty(b, 'Coalition', 'offer', 0.5)
      break
    case 'Secure': treaty(b, nextTier(a, b), ''); break
    case 'Squeeze': {
      const deps = S.countries.filter(x => x !== a && x !== b).map(x => [x, rd.tradeDep(ctx, b, x)]).filter(([, d]) => d > 0).sort((p, q) => q[1] - p[1] || p[0].localeCompare(q[0])), tot = sum(deps.map(d => d[1])) || 1
      for (const [x, d] of deps.slice(0, 3)) if (posture[x] !== 'Dominate') treaty(x, nextTier(a, x), 'neighbours', d / tot)
      for (const [r, pop] of regionsByPop(b).slice(0, 1)) {
        covert('foreignPropaganda', 'propaganda', b, r, { tier: 'covert', concealment: 'high' }, 'propaganda', 'covert', pop / popTotal(b), { risk: exposure(b, r, 'high') })
        covert('covertInfluence', 'influence', b, r, { concealment: 'high', opinion: -1, grievanceNeed: 'subsistence' }, 'influence', '', pop / popTotal(b), { risk: exposure(b, r, 'high') }) }
      break }
    case 'Provoke':
      for (const x of S.countries) { if (x === a || x === b) continue; const reg = regionsByPop(x).slice(-1)[0]; if (reg) frame(x, reg[0], 'frame', ['Ally', 'Partner'].includes(posture[x]) ? T(ctx, 'ai.dip.cost.harmAlly') : 0) }
      { const own = regionsByPop(a).slice(-1)[0]; if (own) frame(a, own[0], 'selfFlag', T(ctx, 'ai.dip.selfFlag.harm') * own[1]) }     // dropped by validation until Diplomacy allows a self-targeted false flag
      coalitionRequests(); break
    case 'Strike': { const rank = rd.bestCBRank(ctx, a, b)
      if (rank > 0 && !rd.warForbidden(ctx, a, b) && !rd.atWar(ctx, a, b))
        out.push({ key: `declareWar|${b}`, role: 'declareWar', tag: 'declareWar', pool: 'war', labour: 1, magnitude: Math.max(0, netEdge(ctx, a, b, S, W, rd)), exclusive: `war|${b}`,
          order: { id: `ai.${a}.declareWar.${b}.${turn}`, actor: actor(a), type: 'declareWar', params: { target: b, goals: [{ type: GOALS[rank - 1] }] } } })
      coalitionRequests(); break }
  }
  return out.filter(x => rd.registered(ctx, x.order.type) && rd.validate(ctx, x.order)) }
