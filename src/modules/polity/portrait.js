// polity/portrait.js — Government Portrait (Country-level root trait bundle) and the Opinion-alignment channel.
// kb: internal_politics__kb.md (Government Portrait rev 2, Cell Preferences & Propaganda rev 2; both PROPOSED 2026-11-16). All derives are pure reads (Rule 1), memoised per bump.
import { parseCellKey } from '../../kernel/ids.js'
import { value as stackValue, tick } from '../../kernel/modifiers.js'
import { amalgam } from './propaganda.js'
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
const sat = x => x / (1 + Math.abs(x))              // one fresh act's worth of record = half saturation (structural, not a tuning number)
const countryOf = (ctx, k) => ctx.derive.worldmap.regionOwner(parseCellKey(k).region)
const prefOf = (c, ax) => clamp((c.pref?.[ax] ?? 0) + (c.prefMods?.[ax] ? stackValue({ baseline: 0, mods: c.prefMods[ax] }) : 0), -1, 1)      // same shape as cellstate.effectivePref

/** What a Country's Government has visibly done, per Portrait axis: the PUBLIC Government acts in the Decision Log, signed by the act type's axisLoads, fading with age.
 *  Cell acts are not the Government's record; covert acts are invisible; unknown action types or types without loads are skipped. Not stored. */
export function actionRecord(ctx, country) {
  const turn = ctx.state.meta.turn, keep = 1 - ctx.T('opinion.modDecay'), out = {}
  for (const e of ctx.state.polity.log ?? []) {
    if (e.visibility !== 'public' || e.actor?.kind !== 'government' || e.actor.country !== country) continue
    const loads = ctx.registry?.types?.get(e.action_type)?.axisLoads; if (!loads) continue
    const w = keep ** Math.max(0, turn - e.turn)
    for (const [ax, l] of Object.entries(loads)) if (l) out[ax] = (out[ax] ?? 0) + Math.sign(l) * w }
  return out }
/** The Portrait a cell perceives: the action record scaled by the cell's awareness and squashed into (-1,+1). */
export function observedPortrait(ctx, key) {
  const aw = ctx.derive.polity.awareness(key), rec = ctx.derive.polity.actionRecord(countryOf(ctx, key))
  return Object.fromEntries(Object.entries(rec).map(([ax, r]) => [ax, aw * sat(r)])) }
/** alignment = -distance(effective_pref, observed_portrait), each axis weighted by how visible the Government's lean on it is (a silent record costs nothing). <= 0. */
export function alignment(ctx, key) {
  const c = ctx.state.polity.cells[key], obs = ctx.derive.polity.observedPortrait(key); let d = 0
  for (const [ax, o] of Object.entries(obs)) d += Math.abs(o) * Math.abs(prefOf(c, ax) - o)
  return -d }
/** Portrait(Country)[axis] = clamp(baseline + stack): a missing stored baseline reads as the Country's amalgam (AI-run Countries follow their cells; a worldgen baseline overrides). */
export function portrait(ctx, country) {
  const st = ctx.state.polity.portrait?.[country] ?? {}, am = amalgam(ctx, country), axes = new Set([...Object.keys(st), ...Object.keys(am)])
  return Object.fromEntries([...axes].map(ax => [ax, clamp((st[ax]?.baseline ?? am[ax] ?? 0) + stackValue({ baseline: 0, mods: st[ax]?.mods ?? [] }), -1, 1)])) }
/** REINFORCEMENT primitive: push a decaying entry onto the Portrait stack. Size and the success/failure trigger are open in the kb; nothing calls this yet. */
export function reinforcePortrait(ctx, country, axis, value) {
  const P = ctx.state.polity, turn = ctx.state.meta.turn, st = (((P.portrait ??= {})[country] ??= {})[axis] ??= { mods: [] })
  st.mods.push({ id: `portrait.${turn}.${axis}`, value, decay: { kind: 'exp', rateKey: 'pref.modDecay' }, turn, source: 'reinforcement' }); ctx.bump() }
export function tickPortrait(ctx) {
  for (const byAxis of Object.values(ctx.state.polity.portrait ?? {})) for (const st of Object.values(byAxis)) { const s = { baseline: 0, mods: st.mods ?? [] }; tick(s, ctx); st.mods = s.mods } }
export const portraitDerive = { actionRecord, observedPortrait, alignment, portrait }
