// ai/diplomacy/score.js — budget, score, greedy selection under binary thresholds. Pure. Spec: ai_diplomacy__spec.md §4
import { reads } from './reads.js'
import { T } from './tuning.js'
import { CATS, sum } from './posture.js'

export const labourBudget = (ctx, a, rd = reads) => ({ espionage: Math.max(0, rd.espionageFree(ctx, a)) * (1 - T(ctx, 'ai.dip.budget.reserve')), proposals: T(ctx, 'ai.dip.budget.proposals'), war: 1 })

export function score(ctx, camp, cand, W, cfg, budget0) {
  const eff = cfg.effects[cand.role] ?? {}, gain = (cand.magnitude ?? 1) * sum(CATS.map(k => W[k] * (eff[k] ?? 0)))
  const focus = (cfg.campaignFocus[camp.type] ?? []).some(f => f === cand.role || f === cand.tag) ? T(ctx, 'ai.dip.focus') : 0      // a bonus, never a prohibition
  const lab = T(ctx, 'ai.dip.cost.labour') * cand.labour / Math.max(1, budget0[cand.pool] ?? 1)
  return gain + focus - lab - (cand.risk ?? 0) - (cand.harm ?? 0) }

/** Fund fully or skip: a candidate whose labour exceeds what is left in its pool is never partially funded. Best score per labour first; ties by key. */
export function select(ctx, scored, budget) {
  const sorted = scored.filter(x => x.s > 0).sort((p, q) => q.s / q.labour - p.s / p.labour || p.key.localeCompare(q.key)), used = new Set(), out = []
  for (const x of sorted) { if (x.labour > (budget[x.pool] ?? 0) + 1e-9 || used.has(x.exclusive)) continue; budget[x.pool] -= x.labour; used.add(x.exclusive); out.push(x) }
  return out }
