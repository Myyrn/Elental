// diplomacy/covert.js — Espionage, foreign propaganda, covert faction influence and detection (diplomacy__kb "Covert Faction Influence & Foreign Propaganda").
//  * Espionage-threshold actions per target Region: threshold = base(type, tier) x targetScale(population of the Region); committed >= threshold -> full effect, else NOTHING
//    and the labour is NOT refunded (it stays a zero-sum claim on the Espionage pool). The threshold never depends on the opposing empire's size.
//  * Detection (per defender, per Region) = committed Observation + committed counter-intelligence Espionage, ADDITIVE; the act is detected at the concealment tier's act threshold, the
//    sender is revealed only at a higher separate threshold; a false flag points the blame at a chosen apparent sender until detection reaches the false-flag threshold.
//  * Effects write into foreign (Nation, Estate, Region) cells' existing Internal-Politics fields: Opinion-toward-Government, Grievance, Preference modifiers.
import { threshold, applyThreshold } from '../../kernel/threshold.js'
import { resolveAllocation, grantFor } from '../../kernel/allocation.js'
import { scopeCtx } from '../administration/module.js'
import { pushPreference, amalgam } from '../polity/propaganda.js'
import { D, isCountry, sum } from './common.js'
import { addReputation, grantCB } from './readouts.js'
const clamp01 = x => Math.min(1, Math.max(0, x)), cellsIn = (ctx, region, country) => Object.values(ctx.state.polity.cells).filter(c => c.region === region && ctx.derive.worldmap.regionOwner(c.region) === country)
const covertCommitments = (ctx, type) => ctx.state.commitments.filter(c => c.type === type).sort((a, b) => (a.id < b.id ? -1 : 1))

// ---- target scale (each Espionage/propaganda type declares its own: Region-targeted -> population(region) in units of espionage.popUnit)
export const regionPopulation = (ctx, region) => sum(ctx.derive.worldmap.regionProvinces(region).map(p => ctx.state.world.provinces[p].population))
export const targetScale = (ctx, region) => regionPopulation(ctx, region) / ctx.T('espionage.popUnit')
const TYPE = { propaganda: { id: 'foreignPropaganda', targetScale: (ctx, t) => targetScale(ctx, t.region) }, influence: { id: 'espionage', targetScale: (ctx, t) => targetScale(ctx, t.region) } }
export const opThreshold = (ctx, p) => { const t = TYPE[p.kind]; return threshold(t, p.kind === 'propaganda' ? (p.tier === 'overt' ? 'overt' : 'covert') : 'influence', { region: p.region }, ctx) + (p.falseFlag ? ctx.T('thresholds.falseFlag') * targetScale(ctx, p.region) : 0) }

// ---- Observation (Administration): the Government's Observation pool, spread by its Observation Dial (even by population when the dial is empty)
export const observationSupply = (ctx, country) => ctx.derive.economics.produceCCO(country).observation
export const observationResult = (ctx, country) => resolveAllocation(ctx.state.admin.governments[country].observationDial ?? { entries: [] }, observationSupply(ctx, country), scopeCtx(ctx, country))
export function observationAt(ctx, country, region) {
  const g = ctx.state.admin.governments[country], mine = cellsIn(ctx, region, country); if (!mine.length) return 0
  if (!g.observationDial?.entries?.length) { const all = Object.values(ctx.state.polity.cells).filter(c => ctx.derive.worldmap.regionOwner(c.region) === country), tp = sum(all.map(c => c.population)) || 1
    return ctx.T('obs.defaultSpread') * observationSupply(ctx, country) * sum(mine.map(c => c.population)) / tp }
  const r = observationResult(ctx, country); return sum(mine.map(c => grantFor(r, c.key))) }
export const counterIntel = (ctx, country, region) => sum(covertCommitments(ctx, 'counterIntel').filter(c => c.actor.country === country && c.params.region === region).map(c => c.params.labour))
export const detectionStrength = (ctx, country, region) => observationAt(ctx, country, region) + counterIntel(ctx, country, region)       // additive: two ways of noticing
export const espionageTotal = (ctx, country) => sum(Object.values(ctx.state.polity.cells).filter(c => ctx.derive.worldmap.regionOwner(c.region) === country).map(c => Math.max(0, (c.labour.Espionage ?? 0) - (c.labourCommitted?.Espionage ?? 0))))
export const espionageCommitted = (ctx, country) => sum([...covertCommitments(ctx, 'covert'), ...covertCommitments(ctx, 'counterIntel')].filter(c => c.actor.country === country).map(c => c.params.labour))
export const espionageFree = (ctx, country) => espionageTotal(ctx, country) - espionageCommitted(ctx, country)

// ---- effects (writeIntoCells)
function writeIntoCells(ctx, op, p) {
  const cells = cellsIn(ctx, op.region, op.target)
  if (op.kind === 'propaganda') { const ideal = op.tier !== 'overt' && p.ideal ? p.ideal : amalgam(ctx, op.sender)                              // overt exports the sender's Portrait (amalgam stands in); covert may push any point
    for (const c of cells) pushPreference(ctx, c, ideal, ctx.T('fprop.magnitude'), { source: op.id }) }
  else for (const c of cells) {
    if (p.opinion) c.opinionGovMods.push({ id: `infl.${op.id}`, value: Math.max(-1, Math.min(1, p.opinion)) * ctx.T('infl.opinion'), decay: { kind: 'exp', rateKey: 'opinion.modDecay' }, turn: ctx.state.meta.turn })   // target-agnostic: may favour a third party
    if (p.grievanceNeed) c.grievance[p.grievanceNeed] = clamp01((c.grievance[p.grievanceNeed] ?? 0) + ctx.T('infl.grievance')) } }

/** Detection result for one op. Overt actions are open by definition. */
export function detect(ctx, op) {
  if (op.concealment === 'overt') return { tier: 'senderRevealed', sender: op.sender, open: true }
  const d = detectionStrength(ctx, op.target, op.region), s = targetScale(ctx, op.region), tAct = ctx.T(`conceal.act.${op.concealment}`) * s, tSender = ctx.T(`conceal.sender.${op.concealment}`) * s
  if (d < tAct) return { tier: 'undetected' }
  if (d < tSender) return { tier: 'actDetected' }
  if (op.falseFlag && d < ctx.T('conceal.falseFlag') * s) return { tier: 'senderRevealed', sender: op.apparentSender }                                // the blame lands on the apparent sender
  return { tier: 'senderRevealed', sender: op.sender, falseFlagExposed: op.falseFlag }
}
function consequences(ctx, op, r) {
  if (r.open || r.tier !== 'senderRevealed') return
  const tier = op.kind === 'influence' ? 'Rights' : 'Grievance'
  grantCB(ctx, op.target, r.sender, tier, 'covert-influence', ctx.T('cb.mag.covert')); addReputation(ctx, op.target, r.sender, -ctx.T('rep.covert'), 'covert')   // a CB only against the sender the victim attributes
  if (r.falseFlagExposed) { grantCB(ctx, op.target, op.sender, 'Rights', 'false-flag-exposed', ctx.T('cb.mag.covert')); addReputation(ctx, op.target, op.sender, -ctx.T('rep.falseFlag'), 'false-flag') } }

/** Step 7, before decay: run every standing covert commitment in id order against the sender's Espionage pool. */
export function resolveCovert(ctx) {
  const left = {}, turn = ctx.state.meta.turn
  for (const c of covertCommitments(ctx, 'covert')) {
    const p = c.params, sender = c.actor.country; left[sender] ??= espionageTotal(ctx, sender) - sum(covertCommitments(ctx, 'counterIntel').filter(x => x.actor.country === sender).map(x => x.params.labour))
    const rec = { id: ctx.nextId('cv'), commitment: c.id, sender, apparentSender: p.falseFlag ?? sender, target: p.target, region: p.region, kind: p.kind, tier: p.tier, concealment: p.tier === 'overt' ? 'overt' : (p.concealment ?? 'low'), falseFlag: !!p.falseFlag, turn }
    if (p.labour > left[sender] + 1e-9) { D(ctx).covert.push({ ...rec, met: false, reason: 'no free Espionage labour' }); continue }
    left[sender] -= p.labour                                                                                           // committed for the turn whether or not the threshold is met (no refund)
    const need = opThreshold(ctx, p), r = applyThreshold(p.labour, need)
    if (!r.met) { D(ctx).covert.push({ ...rec, met: false, reason: 'below threshold', need }); continue }                 // binary: nothing happens
    writeIntoCells(ctx, rec, p); const det = detect(ctx, rec); consequences(ctx, rec, det); D(ctx).covert.push({ ...rec, met: true, need, detection: det.tier, revealed: det.tier === 'senderRevealed' ? det.sender : null, falseFlagExposed: !!det.falseFlagExposed }) }
  D(ctx).covert = D(ctx).covert.slice(-80) }

// ---- actions
const regionOk = (ctx, region, country) => ctx.derive.worldmap.regionProvinces(region).length > 0 && ctx.derive.worldmap.regionOwner(region) === country
export function registerCovertActions(reg) {
  const base = { module: 'diplomacy', class: 'commitment', gateDomain: () => null, defaultVisibility: 'covert', costs: () => [], axisLoads: { ruthlessness_restraint: -1 } }
  const validate = kind => (ctx, a) => { const p = a.params ?? {}, me = a.actor.country
    if (!isCountry(ctx, p.target) || p.target === me) return { ok: false, reasons: ['unknown target Country'] }
    if (!regionOk(ctx, p.region, p.target)) return { ok: false, reasons: ['the Region must belong to the target Country'] }
    if (p.falseFlag && (!isCountry(ctx, p.falseFlag) || p.falseFlag === me)) return { ok: false, reasons: ['false flag must name another Country'] }
    if (p.falseFlag && p.tier === 'overt') return { ok: false, reasons: ['a false flag needs a covert tier'] }
    if (!(p.labour > 0)) return { ok: false, reasons: ['labour must be > 0'] }
    return p.labour <= espionageFree(ctx, me) + 1e-9 ? { ok: true } : { ok: false, reasons: [`only ${Math.floor(espionageFree(ctx, me))} free Espionage labour (zero-sum with other operations and counter-intelligence)`] } }
  const apply = kind => (ctx, a) => ctx.state.commitments.push({ id: a.id, actor: a.actor, type: 'covert', claims: [], since: ctx.state.meta.turn, renew: true, params: { ...a.params, kind, tier: kind === 'propaganda' ? (a.params.tier ?? 'overt') : (a.params.tier ?? 'covert') } })
  reg.register({ ...base, id: 'foreignPropaganda', validate: (ctx, a) => (['overt', 'covert'].includes(a.params?.tier ?? 'overt') ? validate('propaganda')(ctx, a) : { ok: false, reasons: ['tier must be overt or covert'] }), apply: apply('propaganda'), defaultVisibility: 'public' })
  reg.register({ ...base, id: 'covertInfluence', validate: (ctx, a) => (['low', 'medium', 'high'].includes(a.params?.concealment ?? 'low') ? validate('influence')(ctx, a) : { ok: false, reasons: ['concealment must be low, medium or high'] }), apply: apply('influence') })
  reg.register({ ...base, id: 'counterIntelligence', defaultVisibility: 'covert', axisLoads: {},
    validate: (ctx, a) => { const p = a.params ?? {}; if (!regionOk(ctx, p.region, a.actor.country)) return { ok: false, reasons: ['counter-intelligence guards one of your own Regions'] }; if (!(p.labour > 0)) return { ok: false, reasons: ['labour must be > 0'] }
      return p.labour <= espionageFree(ctx, a.actor.country) + 1e-9 ? { ok: true } : { ok: false, reasons: ['not enough free Espionage labour'] } },
    apply: (ctx, a) => ctx.state.commitments.push({ id: a.id, actor: a.actor, type: 'counterIntel', claims: [], since: ctx.state.meta.turn, renew: true, params: { ...a.params } }) })
  reg.register({ ...base, id: 'liftCovert', class: 'event', axisLoads: {}, validate: (ctx, a) => (ctx.state.commitments.some(c => c.id === a.params?.id && ['covert', 'counterIntel'].includes(c.type) && c.actor.country === a.actor.country) ? { ok: true } : { ok: false, reasons: ['no such operation of yours'] }),
    apply: (ctx, a) => { ctx.state.commitments = ctx.state.commitments.filter(c => c.id !== a.params.id) } })
  reg.register({ ...base, id: 'setObservationAllocation', module: 'administration', class: 'event', defaultVisibility: 'public', axisLoads: {}, validate: (ctx, a) => (Array.isArray(a.params?.entries) ? { ok: true } : { ok: false, reasons: ['entries required'] }),
    apply: (ctx, a) => { ctx.state.admin.governments[a.actor.country].observationDial = { entries: a.params.entries } } })
}
