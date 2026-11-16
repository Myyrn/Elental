// diplomacy/border.js — border openness for Economics' cross-border zone pull (economics kb rev 3; spec: Trade-Zone Network).
import { axisGrants } from './readouts.js'

/** Owner-level twin of treaties.tradeFactor (which is keyed by zone hubs): 0 when a ResourceExportBan on `good` or a TradeAccess embargo binds the pair, else 1.
 *  tests/economics_zones.test.js keeps the two equal; fold tradeFactor onto this when treaties.js is next touched. */
export function ownerTradeFactor(ctx, a, b, good, grants = axisGrants(ctx)) {
  if (!a || !b || a === b) return 1
  for (const g of grants) {
    if (g.axis === 'ResourceExportBan' && g.terms.good === good && ((g.grantor === a && g.grantee === b) || (g.grantor === b && g.grantee === a))) return 0
    if (g.axis === 'TradeAccess' && g.terms.embargo && ((g.grantor === a && g.terms.embargo === b) || (g.grantor === b && g.terms.embargo === a))) return 0 }
  return 1 }

/** Goods-independent trade openness of the border between two Countries, in [0,1]: the mean of ownerTradeFactor over the ruleset goods.
 *  1 unrestricted; 0 under an embargo or when every good is banned. Tariffs are not in code yet (Estate-/State tariffs), so they do not lower it. */
export function borderOpenness(ctx, a, b) {
  if (!a || !b || a === b) return 1
  const goods = Object.keys(ctx.ruleset.goods ?? {}); if (!goods.length) return 1
  const grants = axisGrants(ctx)
  return goods.reduce((s, g) => s + ownerTradeFactor(ctx, a, b, g, grants), 0) / goods.length }
