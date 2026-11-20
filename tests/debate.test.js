// Debates (kb administration 2026-11-20): the expired-debate grievance modifier and the Government action `extendDebates` (a share of Control and Coordination, s0 x k^2 per turn of prolongation).
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeCtx } from '../src/engine/engine.js'
import { registerAdministrationActions } from '../src/modules/administration/actions.js'
import { extensionTurns, extensionShare } from '../src/modules/administration/step.js'
import { updateMomentum, step5 } from '../src/modules/polity/step.js'
import { tuning, ruleset, modules, registry, makeState } from './fixtures.js'
registerAdministrationActions(registry)
const mkCtx = s => makeCtx(s, ruleset, { modules, registry, start: s })
const close = (a, b, m = '') => assert.ok(Math.abs(a - b) < 1e-9, `${m} ${a} vs ${b}`)
const T = k => tuning[k].value
const cell = (s, n) => s.polity.cells[`${n}|peasants|r1`]
const gov = { kind: 'government', country: 'A' }
const order = (id, type, params, actor = gov) => ({ id, type, actor, params })

// v and k both press on subsistence (the same issue, so one faction); only v's Question is taken up by the Government
function pressed() {
  const s = makeState(); for (const n of ['v', 'k']) { const c = cell(s, n); c.grievance = { subsistence: 0.9 }; c.satisfaction = { subsistence: 0, comfort: 0, luxury: 0 } }
  s.admin.governments.A.controlSupply = 100; s.admin.governments.A.coordinationSupply = 100
  const ctx = mkCtx(s), qs = ctx.derive.polity.questions(), qv = qs.find(x => x.cell === 'v|peasants|r1' && x.need === 'subsistence'), qk = qs.find(x => x.cell === 'k|peasants|r1' && x.need === 'subsistence')
  assert.ok(qv && qk, 'two live Questions on one issue')
  s.admin.governments.A.attention = [{ questionKey: qv.key, coordinationCommitted: 10 }]
  return { s, ctx, qv, qk } }
const later = (s, ctx, n = 1) => { s.meta.turn += n; ctx.bump() }
const fair = (s, n) => (cell(s, n).fairnessMods ?? []).filter(m => m.source === 'debate')

test('an expired debate leaves a minor decaying Fairness modifier ONCE on every cell of the faction that raised the Question, then the usual mechanics continue', () => {
  const { s, ctx, qv } = pressed()
  updateMomentum(ctx, qv); close(s.polity.momentum[qv.key], 0); assert.equal(fair(s, 'v').length, 0); assert.equal(fair(s, 'k').length, 0)       // discussed: frozen, nothing yet
  later(s, ctx); updateMomentum(ctx, qv)
  assert.equal(s.polity.debate[qv.key].expired, true); close(s.polity.momentum[qv.key], T('mom.rise') * qv.gap, 'the rise resumes')
  for (const n of ['v', 'k']) { const m = fair(s, n); assert.equal(m.length, 1, `${n} takes it`); close(m[0].value, T('debate.expiryGrievance')); assert.equal(m[0].decay.rateKey, 'opinion.modDecay') }
  later(s, ctx); updateMomentum(ctx, qv); assert.equal(fair(s, 'v').length, 1, 'once'); assert.equal(fair(s, 'k').length, 1, 'once')
})

test('a Question that was never taken up has no debate to expire: no modifier', () => {
  const { s, ctx, qk } = pressed(); updateMomentum(ctx, qk); later(s, ctx); updateMomentum(ctx, qk)
  assert.equal(fair(s, 'k').length, 0); assert.equal(s.polity.debate, undefined)
})

test('extendDebates: validate needs a Government order for a live Question of your Country that is being debated; one extension per Question; liftExtendDebates needs your own', () => {
  const { s, ctx, qv, qk } = pressed(), t = registry.get('extendDebates'), lift = registry.get('liftExtendDebates')
  assert.deepEqual(t.validate(ctx, order('x', 'extendDebates', { questionKey: qv.key })), { ok: true })                      // listed on the slate
  assert.equal(t.validate(ctx, order('x', 'extendDebates', { questionKey: qk.key })).ok, false)                              // nobody debates it
  assert.equal(t.validate(ctx, order('x', 'extendDebates', { questionKey: 'nope|x|y|z' })).ok, false)
  assert.equal(t.validate(ctx, order('x', 'extendDebates', { questionKey: qv.key }, { kind: 'government', country: 'B' })).ok, false)
  assert.equal(t.validate(ctx, order('x', 'extendDebates', { questionKey: qv.key }, { kind: 'cell', key: 'v|peasants|r1' })).ok, false)
  t.apply(ctx, order('e1', 'extendDebates', { questionKey: qv.key })); assert.equal(s.commitments.filter(c => c.type === 'extendDebates').length, 1)
  assert.match(t.validate(ctx, order('y', 'extendDebates', { questionKey: qv.key })).reasons[0], /already/)
  assert.equal(lift.validate(ctx, order('z', 'liftExtendDebates', { id: 'nope' })).ok, false)
  assert.equal(lift.validate(ctx, order('z', 'liftExtendDebates', { id: 'e1' }, { kind: 'government', country: 'B' })).ok, false)
  assert.deepEqual(lift.validate(ctx, order('z', 'liftExtendDebates', { id: 'e1' })), { ok: true })
})

test('extendDebates: the freeze goes on, and the same share of Control and Coordination is taken: s0 x k^2, growing each turn beyond the natural timespan; lifting it ends the debate (expired)', () => {
  const { s, ctx, qv } = pressed(), t = registry.get('extendDebates'), lift = registry.get('liftExtendDebates'), s0 = T('debate.extendBase'), start = s.meta.turn
  updateMomentum(ctx, qv); t.apply(ctx, order('e1', 'extendDebates', { questionKey: qv.key }))
  close(extensionShare(ctx, 'A'), 0, 'natural timespan: nothing held'); close(ctx.derive.administration.coordinationSupply('A'), 100)
  for (const k of [1, 2, 3]) {
    later(s, ctx); assert.equal(extensionTurns(ctx, qv.key), k)
    close(extensionShare(ctx, 'A'), s0 * k * k, `k=${k}`); close(ctx.derive.administration.coordinationSupply('A'), 100 * (1 - s0 * k * k)); close(ctx.derive.administration.controlSupply('A'), 100 * (1 - s0 * k * k))
    updateMomentum(ctx, qv); close(s.polity.momentum[qv.key], 0, 'still frozen'); assert.equal(fair(s, 'v').length, 0, 'no expiry while extended') }
  assert.equal(s.meta.turn, start + 3)
  lift.apply(ctx, order('l1', 'liftExtendDebates', { id: 'e1' })); ctx.bump(); close(ctx.derive.administration.coordinationSupply('A'), 100)
  updateMomentum(ctx, qv); assert.equal(fair(s, 'v').length, 1, 'the debate ends, unresolved: expired'); assert.ok(s.polity.momentum[qv.key] > 0, 'and the rise resumes')
})

test('extendDebates lapses when the share can no longer be paid; several extensions add up, capped at 1', () => {
  const { s, ctx, qv, qk } = pressed(), t = registry.get('extendDebates'); s.admin.governments.A.attention.push({ questionKey: qk.key, coordinationCommitted: 10 })
  updateMomentum(ctx, qv); updateMomentum(ctx, qk); t.apply(ctx, order('e1', 'extendDebates', { questionKey: qv.key })); t.apply(ctx, order('e2', 'extendDebates', { questionKey: qk.key }))
  later(s, ctx, 2); close(extensionShare(ctx, 'A'), 2 * T('debate.extendBase') * 4, 'two extensions at k=2')
  later(s, ctx, 100); close(extensionShare(ctx, 'A'), 1); close(ctx.derive.administration.coordinationSupply('A'), 0)
  updateMomentum(ctx, qv); assert.equal(s.polity.debate[qv.key].expired, true, 'not payable any more: the debate ends')
})

test('step 5 drops the debate record and the extension of a Question that is no longer live (resolved or faded: no modifier)', () => {
  const { s, ctx } = pressed(), t = registry.get('extendDebates'), ghost = 'x|y|z|subsistence'
  s.polity.debate = { [ghost]: { since: s.meta.turn } }; s.commitments.push({ id: 'g1', actor: gov, type: 'extendDebates', claims: [], since: 0, renew: true, params: { questionKey: ghost } }); ctx.bump()
  step5(ctx); assert.equal(s.polity.debate[ghost], undefined); assert.equal(s.commitments.some(c => c.id === 'g1'), false)
  assert.equal(fair(s, 'v').length + fair(s, 'k').length, 0)
})
