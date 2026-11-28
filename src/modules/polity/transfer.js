// polity/transfer.js — pro-rata stock transfer between two cells (Mobility, Demotion; same rule as migration / Region split).
// Moves a fraction of the source's population, wealth, extensive records (labour, labourCommitted, hoard) and identified obligations.
// The arriving cohort's grievance blends into the target, population-weighted. Nothing is created or destroyed.
import { RECORDS } from './cellstate.js'
export function transferCohort(ctx, from, to, frac) {
  frac = Math.min(1, Math.max(0, frac)); if (frac === 0 || from.population <= 0) return 0
  const moved = from.population * frac, popAfter = to.population + moved
  for (const need of new Set([...Object.keys(from.grievance ?? {}), ...Object.keys(to.grievance ?? {})]))
    to.grievance[need] = ((to.grievance[need] ?? 0) * to.population + (from.grievance?.[need] ?? 0) * moved) / popAfter
  for (const rec of RECORDS) { from[rec] ??= {}; to[rec] ??= {}
    for (const k of Object.keys(from[rec])) { const q = from[rec][k] * frac; from[rec][k] -= q; to[rec][k] = (to[rec][k] ?? 0) + q } }
  const w = from.wealth * frac; from.wealth -= w; to.wealth += w
  from.population -= moved; to.population = popAfter
  splitObligations(ctx, from.key, to.key, frac)
  return moved
}
const IDENT = new Set(['id', 'principal', 'arrears'])
/** Same terms = every field but the id and the two amounts (debtor, creditor, rate, …) is equal. */
const sameTerms = (a, b) => { const ka = Object.keys(a).filter(k => !IDENT.has(k)), kb = Object.keys(b).filter(k => !IDENT.has(k)); return ka.length === kb.length && ka.every(k => JSON.stringify(a[k]) === JSON.stringify(b[k])) }
/** Debts follow the cohort (no anonymous debts): each obligation naming the source is split pro rata into a record naming the target.
 *  A share that would make a cell its own creditor is extinguished. **A share joins an existing record with the same terms** (debtor, creditor, rate, … equal; that record must not name the source)
 *  instead of becoming a new one, so repeated small transfers (gradual migration, every turn) do not multiply the records: their number stays bounded by the pairs of cells. */
export function splitObligations(ctx, fromKey, toKey, frac) {
  const obs = ctx.state.economy.obligations, added = []
  for (const o of obs.slice()) {
    if (o.debtor !== fromKey && o.creditor !== fromKey) continue
    const part = { ...o, id: `${o.id}~${toKey}`, principal: o.principal * frac, arrears: (o.arrears ?? 0) * frac }
    if (o.debtor === fromKey) part.debtor = toKey
    if (o.creditor === fromKey) part.creditor = toKey
    o.principal -= part.principal; o.arrears = (o.arrears ?? 0) - part.arrears
    if (part.debtor === part.creditor) continue
    const fits = x => x !== o && x.debtor === part.debtor && x.creditor === part.creditor && x.debtor !== fromKey && x.creditor !== fromKey && sameTerms(x, part)
    const twin = obs.find(fits) ?? added.find(fits)
    if (twin) { twin.principal += part.principal; twin.arrears = (twin.arrears ?? 0) + part.arrears } else added.push(part) }
  for (const p of added) obs.push(p)      // not push(...added): a long list overflows the argument stack
}
export const opinionModDecay = { kind: 'exp', rateKey: 'opinion.modDecay' }
