// Opinion alignment and the stored Government Portrait (internal_politics__kb: Cell Preferences & Propaganda rev 2, Government Portrait rev 2; proposed 2026-11-16).
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeCtx } from '../src/engine/engine.js'
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

test('actionRecord: public Government acts of this Country, signed by axisLoads; covert, cell, other-Country and unknown acts are ignored', () => {
  const { s } = world([act('setTaxLaw'), act('placeRequisition'), act('setTaxLaw', { visibility: 'covert' }), act('setTaxLaw', { actor: { kind: 'cell', key: 'x' } }),
    act('setTaxLaw', { actor: { kind: 'government', country: 'B' } }), act('noSuchType')])
  const ctx = ctxOf(s); near(ctx.derive.polity.actionRecord('A')[AX], -2); assert.deepEqual(ctx.derive.polity.actionRecord('B')[AX], -1)
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

test('alignment: 0 when the preference sits at the observed portrait, negative when opposed, 0 when the record is silent', () => {
  const { s, keys } = world([act('setTaxLaw')]), a = keys[0], ctx = ctxOf(s), pol = ctx.derive.polity, c = ctx.state.polity.cells[a]
  c.pref = { [AX]: -0.5 }; ctx.bump(); near(pol.alignment(a), 0)                  // same position as the Government
  c.pref = { [AX]: 1 }; ctx.bump(); near(pol.alignment(a), -(0.5 * 1.5))          // |o| x |pref - o| = 0.5 x 1.5
  c.pref = { [AX]: 0 }; ctx.bump(); near(pol.alignment(a), -(0.5 * 0.5))          // a centrist loses a little
  ctx.state.polity.log = []; c.pref = { [AX]: 1 }; ctx.bump(); near(pol.alignment(a), 0)       // silent Government: strong preferences alone cost nothing
})

test('opinionGov and compliance carry opinion.align x alignment', () => {
  const { s, keys } = world([act('setTaxLaw')]), a = keys[0], ctx = ctxOf(s), pol = ctx.derive.polity, c = ctx.state.polity.cells[a]
  c.pref = { [AX]: -0.5 }; ctx.bump(); const aligned = pol.opinionGov(a), volAligned = pol.compliance(a).voluntary
  c.pref = { [AX]: 1 }; ctx.bump(); const opposed = pol.opinionGov(a)
  near(opposed - aligned, ctx.T('opinion.align') * (-(0.5 * 1.5)))
  assert.ok(pol.compliance(a).voluntary < volAligned)
})

test('the structural requisition hit is this channel: an Investment-leaning cell dislikes a requisition more than an Extraction-leaning one', () => {
  const { s, keys } = world([act('placeRequisition')]), a = keys[0], ctx = ctxOf(s), pol = ctx.derive.polity, c = ctx.state.polity.cells[a]
  c.pref = { [AX]: -1 }; ctx.bump(); const extractionLeaning = pol.opinionGov(a)
  c.pref = { [AX]: 1 }; ctx.bump(); const investmentLeaning = pol.opinionGov(a)
  assert.ok(investmentLeaning < extractionLeaning)
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
