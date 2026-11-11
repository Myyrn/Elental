// ai/diplomacyAgent.js — AI-Diplomacy (ai_diplomacy__kb / ai_diplomacy__spec): deterministic utility AI, same Action API as the player, no LLM at runtime.
// Opt-in: runs only when ruleset.aiDiplomacy.enabled === true (see ai/index.js).
import { reads } from './diplomacy/reads.js'
import { config } from './diplomacy/config.js'
import { shared, weights, derivePosture } from './diplomacy/posture.js'
import { updateCampaigns } from './diplomacy/campaign.js'
import { generate } from './diplomacy/candidates.js'
import { labourBudget, score, select } from './diplomacy/score.js'
import { respond } from './diplomacy/negotiate.js'

export function planDiplomacy(ctx, a, rd = reads, cache = ctx.state.ai?.diplomacy ?? { posture: {}, campaigns: {} }) {
  const cfg = config(ctx), S = shared(ctx, rd), W = weights(ctx, a, rd), turn = rd.turn(ctx), others = S.countries.filter(c => c !== a)
  const posture = Object.fromEntries(others.map(b => [b, derivePosture(ctx, a, b, S, cache, W, rd)]))
  const campaigns = updateCampaigns(ctx, a, posture, S, cache, W, rd)
  const budget = labourBudget(ctx, a, rd), budget0 = { ...budget }
  const scored = campaigns.flatMap(c => generate(ctx, a, c, posture, S, W, rd).map(x => ({ ...x, s: score(ctx, c, x, W, cfg, budget0) })))
  const orders = [...respond(ctx, a, posture, W, cfg, rd), ...select(ctx, scored, budget).map(x => x.order)]
  const packed = Object.fromEntries(others.map(b => { const k = `${a}|${b}`, prev = cache.posture?.[k]; return [k, { value: posture[b], since: prev?.value === posture[b] ? prev.since : turn, powerShare: S.power[b] }] }))
  return { orders, cache: { posture: packed, campaigns }, posture, campaigns } }

/** Orders for every non-player Country, each followed by its cache memo. Empty when the agent is not enabled. */
export function diplomacyOrders(ctx, rd = reads) {
  if (ctx.ruleset?.aiDiplomacy?.enabled !== true) return []
  const out = [], turn = rd.turn(ctx)
  for (const a of rd.countries(ctx)) { if (rd.isPlayer(ctx, a)) continue
    const { orders, cache } = planDiplomacy(ctx, a, rd)
    out.push(...orders, { id: `ai.${a}.memo.${turn}`, actor: { kind: 'government', country: a }, type: 'aiMemo', params: { country: a, cache } }) }
  return out }
