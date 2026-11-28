// Slice 3b follow-up (2026-11-19): free colonization (a standing commitment) and the first consumer of the Administration slate (a Question that is addressed does not escalate for the length of a debate).
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeCtx } from '../src/engine/engine.js'
import { stepMigration, colonizeIncentive } from '../src/modules/worldmap/migration.js'
import { registerWorldmapActions } from '../src/modules/worldmap/actions.js'
import { updateMomentum } from '../src/modules/polity/step.js'
import { tuning, ruleset, modules, registry, makeState } from './fixtures.js'
registerWorldmapActions(registry)
const mkCtx = s => makeCtx(s, ruleset, { modules, registry, start: s })
const close = (a, b, m = '') => assert.ok(Math.abs(a - b) < 1e-6, `${m} ${a} vs ${b}`)
const cell = (s, n) => s.polity.cells[`${n}|peasants|r1`]

// ------------------------------------------------------------------ free colonization
// one Region, p:0..2 settled with 250 v + 250 k each, p:3,0 an owned Wasteland province next to p:2,0 (the cells' populations agree with the presence)
function frontier() {
  const s = makeState({ pop: 750 })
  for (const p of ['p:0,0', 'p:1,0', 'p:2,0']) s.nations.presence[p] = { v: 250, k: 250 }
  s.nations.presence['p:3,0'] = {}; Object.assign(s.world.provinces['p:3,0'], { habitability: 'Wasteland', population: 0 })
  return s }
const order = (id, type, params) => ({ id, type, actor: { kind: 'government', country: 'A' }, params })
const commit = (ctx, incentive, id = 'c1') => registry.get('freeColonization').apply(ctx, order(id, 'freeColonization', { incentive }))

test('free colonization: without the commitment only the frontier pull acts; with it the pull rises and each arriving settler is paid from the Government ledger to the arriving cells', () => {
  const a = frontier(); stepMigration(mkCtx(a))
  close(a.world.provinces['p:3,0'].population, 1); close(a.admin.governments.A.ledger, 100)                    // 250 x 0.02 x 0.1 = 0.5 per Nation, nobody paid
  const s = frontier(), ctx = mkCtx(s); commit(ctx, 1); assert.equal(s.commitments.filter(c => c.type === 'freeColonization').length, 1); close(colonizeIncentive(ctx, 'A'), 1)
  const done = stepMigration(ctx); assert.ok(done.length >= 2 && done.every(f => f.to === 'p:3,0' && f.frontier))
  close(s.world.provinces['p:3,0'].population, 11); close(s.nations.presence['p:3,0'].v, 5.5)                     // 250 x 0.02 x (0.1 + 1 x 1) = 5.5 per Nation
  close(s.admin.governments.A.ledger, 89); close(cell(s, 'v').wealth, 55.5); close(cell(s, 'k').wealth, 55.5)    // 5.5 x incentive 1 x costPerSettler 1 per Nation
  close(s.admin.governments.A.ledger + cell(s, 'v').wealth + cell(s, 'k').wealth, 200)                          // money moves, nothing is created
})

test('free colonization lapses while the ledger is empty; arrivals in settled provinces are never paid', () => {
  const s = frontier(); s.admin.governments.A.ledger = 0; const ctx = mkCtx(s); commit(ctx, 1); close(colonizeIncentive(ctx, 'A'), 0)
  stepMigration(ctx); close(s.world.provinces['p:3,0'].population, 1); close(s.admin.governments.A.ledger, 0); close(cell(s, 'v').wealth, 50)
})

test('free colonization: validate needs a Government order with a positive incentive; lifting removes only your own commitment', () => {
  const s = frontier(), ctx = mkCtx(s), t = registry.get('freeColonization'), lift = registry.get('liftFreeColonization')
  assert.deepEqual(t.validate(ctx, order('x', 'freeColonization', { incentive: 1 })), { ok: true })
  assert.equal(t.validate(ctx, order('x', 'freeColonization', { incentive: 0 })).ok, false)
  assert.equal(t.validate(ctx, { ...order('x', 'freeColonization', { incentive: 1 }), actor: { kind: 'cell', key: 'v|peasants|r1' } }).ok, false)
  commit(ctx, 1); assert.equal(lift.validate(ctx, order('y', 'liftFreeColonization', { id: 'nope' })).ok, false)
  assert.equal(lift.validate(ctx, { ...order('y', 'liftFreeColonization', { id: 'c1' }), actor: { kind: 'government', country: 'B' } }).ok, false)
  assert.deepEqual(lift.validate(ctx, order('y', 'liftFreeColonization', { id: 'c1' })), { ok: true })
  lift.apply(ctx, order('y', 'liftFreeColonization', { id: 'c1' })); assert.equal(s.commitments.filter(c => c.type === 'freeColonization').length, 0)
})

// ------------------------------------------------------------------ the slate's first consumer: addressed Questions do not escalate
function pressed() {
  const s = makeState(), c = cell(s, 'v'); c.grievance = { subsistence: 0.9 }; c.satisfaction = { subsistence: 0, comfort: 0, luxury: 0 }
  const ctx = mkCtx(s), q = ctx.derive.polity.questions().find(x => x.cell === 'v|peasants|r1' && x.need === 'subsistence'); assert.ok(q, 'a live Question')
  return { s, ctx, q } }

test('momentum: an unaddressed Question rises as before', () => {
  const { s, ctx, q } = pressed(); updateMomentum(ctx, q)
  close(s.polity.momentum[q.key], tuning['mom.rise'].value * q.gap); assert.equal(s.polity.debate, undefined)
})

test('momentum: listed on the slate (attention) the rise is frozen and a debate starts; when the debate ends the rise resumes although it is still listed', () => {
  const { s, ctx, q } = pressed(); s.admin.governments.A.attention = [{ questionKey: q.key, coordinationCommitted: 10 }]
  updateMomentum(ctx, q); close(s.polity.momentum[q.key], 0); assert.equal(s.polity.debate[q.key].since, s.meta.turn)
  assert.equal(ctx.derive.administration.slate('A').questions.find(x => x.key === q.key).status, 'slate')
  s.meta.turn += 1; ctx.bump()                                                                         // the debate (question.turns.region = 1) is over, nothing resolved it
  assert.equal(ctx.derive.administration.slate('A').questions.find(x => x.key === q.key).status, 'unaddressed')
  updateMomentum(ctx, q); close(s.polity.momentum[q.key], tuning['mom.rise'].value * q.gap)
})

test('momentum: a routine Question in standing administration counts as addressed; the momentum it already has still decays', () => {
  const { s, ctx, q } = pressed(); s.polity.momentum[q.key] = 1; s.admin.governments.A.standing = [q.key]
  updateMomentum(ctx, q); close(s.polity.momentum[q.key], 1 * (1 - tuning['mom.decay'].value))
  assert.equal(ctx.derive.administration.slate('A').questions.find(x => x.key === q.key).status, 'standing')
})

test('slate readout: an open debate that the slate no longer lists reads as debate; a Question nobody took up is unaddressed', () => {
  const { s, ctx, q } = pressed(); s.polity.debate = { [q.key]: { since: s.meta.turn } }; ctx.bump()
  const r = ctx.derive.administration.slate('A'); assert.equal(r.questions.find(x => x.key === q.key).status, 'debate'); assert.ok(!r.unaddressed.includes(q.key))
  s.polity.debate = {}; ctx.bump(); assert.ok(ctx.derive.administration.slate('A').unaddressed.includes(q.key))
})
