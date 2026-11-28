// Opinion alignment and the stored Government Portrait (internal_politics__kb: Cell Preferences & Propaganda rev 3, Government Portrait rev 3; designer-confirmed 2026-11-16).
// Needs data/ruleset.json rebuilt after the new tuning keys (opinion.alignGain, portrait.reinforce): `npm run build:data`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeCtx, resolveTurn } from '../src/engine/engine.js'
import { parseCellKey } from '../src/kernel/ids.js'
import { registerPolityActions } from '../src/modules/polity/actions.js'
import { reinforcePortrait, tickPortrait } from '../src/modules/polity/portrait.js'
import { ruleset, modules, registry, makeState } from './fixtures.js'
registerPolityActions(registry)

const ctxOf = s => makeCtx(structuredClone(s), ruleset, { modules, registry, start: s })
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`)
const act = (type, o = {}) => ({ actor: { kind: 'government', country: 'A' }, action_type: type, visibility: 'public', turn: 0, affected_cells: [], ...o })
const AX = 'extraction_investment'
function world(log = []) {
  const s = makeState(), keys = Object.keys(s.polity.cells); s.polity.log = log
  for (const k of keys) s.polity.cells[k].labour = { Teaching: 100 }             // awareness 1 (aware.base + aware.k x share, clamped)
  return { s, keys }
}
const country = (ctx, k) => ctx.derive.worldmap.regionOwner(parseCellKey(k).region)
const taxOrder = (market, wealth = 0, id = 'o1') => ({ id, type: 'setTaxLaw', actor: { kind: 'government', country: 'A' }, params: { market, wealth } })
const withTax = (s, market, wealth = 0) => { s.polity.law.A.duties.Taxation = [{ scope: { kind: 'empire' }, value: { market, wealth }, declaredTurn: 0 }]; return s }

test('actionRecord: public Government acts of this Country, signed by their loads; covert, cell, other-Country and unknown acts are ignored', () => {
  const { s } = world([act('setTaxLaw'), act('placeRequisition'), act('setTaxLaw', { visibility: 'covert' }), act('setTaxLaw', { actor: { kind: 'cell', key: 'x' } }),
    act('setTaxLaw', { actor: { kind: 'government', country: 'B' } }), act('noSuchType')])
  const ctx = ctxOf(s); near(ctx.derive.polity.actionRecord('A')[AX], -2); near(ctx.derive.polity.actionRecord('B')[AX], -1)
})

test('actionRecord: the realized direction on the entry (loads) wins over the type\'s static load; empty loads are silent', () => {
  const { s } = world([act('setTaxLaw', { loads: { [AX]: 1 } }), act('placeRequisition', { loads: {} })])
  near(ctxOf(s).derive.polity.actionRecord('A')[AX], 1)                          // a tax cut is Investment; a requisition that changed nothing says nothing
})

test('actionRecord fades with age', () => {
  const { s } = world([act('setTaxLaw', { turn: 0 })]); s.meta.turn = 3
  const ctx = ctxOf(s); near(ctx.derive.polity.actionRecord('A')[AX], -((1 - ctx.T('opinion.modDecay')) ** 3))
})

test('observedPortrait: scaled by awareness, squashed into (-1,+1)', () => {
  const { s, keys } = world([act('setTaxLaw')]), [a, b] = keys
  s.polity.cells[b].labour = { Agriculture: 100 }
  const ctx = ctxOf(s); near(ctx.derive.polity.awareness(a), 1)
  near(ctx.derive.polity.observedPortrait(a)[AX], -0.5)                           // record -1 -> -1 / (1 + 1)
  near(ctx.derive.polity.observedPortrait(b)[AX], -0.5 * ctx.derive.polity.awareness(b))
  assert.ok(ctx.derive.polity.awareness(b) < 1)
})

test('alignment: an aligned cell gains (scaled by opinion.alignGain), an opposed one loses, a silent record changes nothing', () => {
  const { s, keys } = world([act('setTaxLaw')]), a = keys[0], ctx = ctxOf(s), pol = ctx.derive.polity, c = ctx.state.polity.cells[a], g = ctx.T('opinion.alignGain')
  const at = p => { c.pref = { [AX]: p }; ctx.bump(); return pol.alignment(a) }          // observed portrait = -0.5, |o| = 0.5
  near(at(-0.5), 0.5 * g * 1)                                                      // exactly at the Government's position: match 1
  near(at(-1), 0.5 * g * 0.5); near(at(0), 0.5 * g * 0.5)                          // half an axis away on either side: match 0.5
  near(at(1), 0.5 * -0.5)                                                          // opposite poles' side: match -0.5, a loss
  assert.ok(at(-0.5) > at(0) && at(0) > at(1))
  ctx.state.polity.log = []; c.pref = { [AX]: 1 }; ctx.bump(); near(pol.alignment(a), 0)       // silent Government: strong preferences alone cost nothing
})

test('opinionGov and compliance carry opinion.align x alignment: serving the cell\'s ideal raises them, opposing it lowers them', () => {
  const { s, keys } = world([act('setTaxLaw')]), a = keys[0], ctx = ctxOf(s), pol = ctx.derive.polity, c = ctx.state.polity.cells[a], g = ctx.T('opinion.alignGain')
  c.pref = { [AX]: -0.5 }; ctx.bump(); const aligned = pol.opinionGov(a), volAligned = pol.compliance(a).voluntary
  c.pref = { [AX]: 1 }; ctx.bump(); const opposed = pol.opinionGov(a)
  near(aligned - opposed, ctx.T('opinion.align') * (0.5 * g * 1 - 0.5 * -0.5))
  assert.ok(pol.compliance(a).voluntary < volAligned)
  ctx.state.polity.log = []; ctx.bump(); const silent = pol.opinionGov(a)         // same cell, no record
  assert.ok(aligned > silent && opposed < silent)
})

test('the structural requisition hit is this channel, and direction matters: raising the take hurts an Investment-leaning cell, lifting it pleases it', () => {
  const raise = world([act('placeRequisition')]), lift = world([act('placeRequisition', { loads: { [AX]: 1 } })])
  const og = (w, p) => { const ctx = ctxOf(w.s); ctx.state.polity.cells[w.keys[0]].pref = { [AX]: p }; ctx.bump(); return ctx.derive.polity.opinionGov(w.keys[0]) }
  assert.ok(og(raise, 1) < og(raise, -1))                                          // a bigger take: Extraction-leaning cells like it more
  assert.ok(og(lift, 1) > og(lift, -1))                                            // a lifted requisition: Investment-leaning cells like it more
})

test('axisShift: a tax rise is Extraction, a cut is Investment, no change is silent', () => {
  const type = registry.get('setTaxLaw')
  const none = ctxOf(makeState())                                                  // no law: rates 0
  assert.deepEqual(type.axisShift(none, taxOrder(0.1)), { [AX]: -1 })
  assert.deepEqual(type.axisShift(none, taxOrder(0)), {})
  const had = ctxOf(withTax(makeState(), 0.2))
  assert.deepEqual(type.axisShift(had, taxOrder(0.1)), { [AX]: 1 })
  assert.deepEqual(type.axisShift(had, taxOrder(0.3)), { [AX]: -1 })
  assert.deepEqual(type.axisShift(had, taxOrder(0.2)), {})
})

test('axisShift: a bigger requisition is Extraction, a smaller or lifted one is Investment', () => {
  const type = registry.get('placeRequisition'), s = makeState(); s.polity.law.A.requisitions = [{ scope: { kind: 'empire' }, target: { good: 'Grain' }, amount: 0.5, unit: 'fraction' }]
  const ctx = ctxOf(s), o = (good, amount) => ({ id: 'r', type: 'placeRequisition', actor: { kind: 'government', country: 'A' }, params: { good, amount } })
  assert.deepEqual(type.axisShift(ctx, o('Grain', 0.7)), { [AX]: -1 })
  assert.deepEqual(type.axisShift(ctx, o('Grain', 0.2)), { [AX]: 1 })
  assert.deepEqual(type.axisShift(ctx, o('Grain', 0)), { [AX]: 1 })
  assert.deepEqual(type.axisShift(ctx, o('Grain', 0.5)), {})
  assert.deepEqual(type.axisShift(ctx, o('Salt', 0.3)), { [AX]: -1 })              // a new requisition on another good
})

test('engine: the Decision Log entry carries the action id and the realized direction, taken before the law changed', () => {
  const up = resolveTurn(makeState(), ruleset, [taxOrder(0.1, 0, 'up')], { modules, registry }).state
  const cut = resolveTurn(withTax(makeState(), 0.2), ruleset, [taxOrder(0.1, 0, 'cut')], { modules, registry }).state
  const entry = (s, id) => s.polity.log.find(e => e.id === id)
  assert.deepEqual(entry(up, 'up').loads, { [AX]: -1 }); assert.deepEqual(entry(cut, 'cut').loads, { [AX]: 1 })
})

test('portrait: missing baseline reads as the amalgam, a stored baseline wins', () => {
  const { s, keys } = world(), ctx = ctxOf(s), pol = ctx.derive.polity, A = country(ctx, keys[0])
  for (const k of keys) ctx.state.polity.cells[k].pref = { [AX]: -0.4 }; ctx.bump()
  near(pol.portrait(A)[AX], -0.4)
  ctx.state.polity.portrait = { [A]: { [AX]: { baseline: 0.6, mods: [] } } }; ctx.bump(); near(pol.portrait(A)[AX], 0.6)
})

test('reinforcePortrait pushes onto the stack, the readout clamps to +-1, ticking decays the stack', () => {
  const { s, keys } = world(), ctx = ctxOf(s), pol = ctx.derive.polity, A = country(ctx, keys[0])
  ctx.state.polity.portrait = { [A]: { [AX]: { baseline: 0, mods: [] } } }; ctx.bump()
  reinforcePortrait(ctx, A, AX, 0.3); near(pol.portrait(A)[AX], 0.3)
  reinforcePortrait(ctx, A, AX, 5); near(pol.portrait(A)[AX], 1)
  const stack = () => ctx.state.polity.portrait[A][AX].mods.reduce((t, m) => t + m.value, 0), before = stack()
  ctx.state.meta.turn += 1; tickPortrait(ctx)
  assert.ok(stack() < before && stack() > 0)
})

test('a Government act reinforces its own Portrait toward the pole it acts on: a tax rise toward Extraction, a cut toward Investment (covert acts count too)', () => {
  const up = resolveTurn(makeState(), ruleset, [taxOrder(0.1)], { modules, registry }).state, T = ctxOf(makeState()).T
  const stackOf = s => (s.polity.portrait?.A?.[AX]?.mods ?? []).filter(m => m.source === 'reinforcement').reduce((t, m) => t + m.value, 0)
  near(stackOf(up), -T('portrait.reinforce'))
  const cut = resolveTurn(withTax(makeState(), 0.2), ruleset, [taxOrder(0.1)], { modules, registry }).state
  near(stackOf(cut), T('portrait.reinforce'))
  const quiet = resolveTurn(makeState(), ruleset, [], { modules, registry }).state
  near(stackOf(quiet), 0)
})
