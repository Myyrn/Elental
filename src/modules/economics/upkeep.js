// economics/upkeep.js — per-pool upkeep shortfall (kb economics rev 2; spec: Resolution order within Economics).
// Pure: reads the rows of one Allocation Dial resolution, returns the shortfall per pool.
const clamp01 = x => Math.min(1, Math.max(0, x))

/** rows: resolveAllocation(...).rows. Only mandatory rows carrying a `pool` tag count (the tag is data, set by the Government-needs generator or the player).
 *  Returns {pool: unmet} with unmet = clamp01(1 - Σ grant / Σ floor) over that pool's rows. Pools whose floors are met (and pools with no tagged row)
 *  are absent, which `produceCCO` reads as 0. The caller replaces last turn's value with this object every turn; it is never accumulated. */
export function poolUnmetFrom(rows) {
  const floor = {}, grant = {}
  for (const r of rows) {
    if (!r.mandatory || !r.pool) continue
    floor[r.pool] = (floor[r.pool] ?? 0) + r.floor; grant[r.pool] = (grant[r.pool] ?? 0) + r.grant
  }
  const out = {}
  for (const pool of Object.keys(floor).sort()) {
    if (floor[pool] <= 1e-9) continue
    const u = clamp01(1 - grant[pool] / floor[pool]); if (u > 1e-9) out[pool] = u
  }
  return out
}
