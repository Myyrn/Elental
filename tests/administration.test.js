// Administration step 6: the Question active slate (administration__kb: Question Active Slate; spec: administration__spec.md).
// Needs data/ruleset.json rebuilt for the new key queue.petitionMult: `npm run build:data`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeCtx, resolveTurn } from '../src/engine/engine.js'
import { step6 } from '../src/modules/administration/step.js'
import { tuning, ruleset, modules, registry, makeState } from './fixtures.js'

const T = k => tuning[k].value, E = T('slate.existential'), S = T('slate.structural'), OH = T('admin.routineOverhead')
const ctxOf = s => makeCtx(structuredClone(s), ruleset, { modules, registry, start: s })
const lowOpinion = { id: 't', value: -3, decay: { kind: 'exp', rateKey: 'opinion.modDecay' }, turn: 0, source: 't' }      // voluntary compliance ~ 0, so a Question's gap ~ its grievance
/** Two cells (a, b). Questions: existential a|subsistence (.9); structural a|comfort (.4), b|comfort (.3); routine a|fairness, b|fairness, b|subsistence (.1 each). */
function world(coordination) {
  const s = makeState(), [a, b] = Object.keys(s.polity.cells)
  Object.assign(s.polity.cells[a], { grievance: { subsistence: 0.9, comfort: 0.4, fairness: 0.1 }, opinionGovMods: [{ ...lowOpinion }] })
  Object.assign(s.polity.cells[b], { grievance: { subsistence: 0.1, comfort: 0.3, fairness: 0.1 }, opinionGovMods: [{ ...lowOpinion }] })
  s.admin.governments.A.coordinationSupply = coordination
  return { s, a, b, routine: [`${a}|fairness`, `${b}|fairness`, `${b}|subsistence`] }
}
const run = s => { const ctx = ctxOf(s); step6(ctx); return ctx.state.admin.governments.A }
const keys = g => g.attention.map(x => x.questionKey)

test('fixture: the Questions are the tiers the tests assume', () => {
  const { s, a, b } = world(0), qs = ctxOf(s).derive.polity.questions(), tier = k => qs.find(q => q.key === k)?.tier
  assert.equal(qs.length, 6)
  assert.equal(tier(`${a}|subsistence`), 'existential'); assert.equal(tier(`${a}|comfort`), 'structural'); assert.equal(tier(`${b}|comfort`), 'structural')
  assert.equal(tier(`${a}|fairness`), 'routine'); assert.equal(tier(`${b}|fairness`), 'routine'); assert.equal(tier(`${b}|subsistence`), 'routine')
})

test('slate: a fixed Coordination threshold per tier, existential first, then structural by priority; routine overhead is paid first', () => {
  const { s, a, b } = world(E + 2 * S + 3 * OH + 1e-9), g = run(s)
  assert.deepEqual(keys(g), [`${a}|subsistence`, `${a}|comfort`, `${b}|comfort`])
  assert.deepEqual(g.attention.map(x => x.coordinationCommitted), [E, S, S])
})

test('slate: within a tier the larger gap x Weight comes first; what does not fit is left off', () => {
  const { s, a } = world(E + S + 3 * OH + 1e-9), g = run(s)
  assert.deepEqual(keys(g), [`${a}|subsistence`, `${a}|comfort`])
})

test('slate: a Question that does not fit is skipped, lower ones that still fit are taken (existential crowds out, never removes)', () => {
  const { s, a } = world(E - 0.01 + 3 * OH), g = run(s)
  assert.deepEqual(keys(g), [`${a}|comfort`])
  assert.equal(ctxOf(s).derive.polity.questions().length, 6)                      // the existential Question still exists, only off the slate
})

test('slate: Government propaganda is paid from the same Coordination pool', () => {
  const { s } = world(E + 2 * S + 3 * OH + 1e-9)
  assert.equal(run(s).attention.length, 3)
  s.commitments.push({ id: 'p1', type: 'propaganda', actor: { kind: 'government', country: 'A' }, params: { amount: S } })
  assert.equal(run(s).attention.length, 2)
  s.commitments[0].actor = { kind: 'government', country: 'B' }
  assert.equal(run(s).attention.length, 3, 'another Country\'s propaganda draws nothing')
})

test('routine tier: no slate commitment, a continuous overhead per Question; when Coordination runs short the lowest priority drop out of standing administration', () => {
  const { s, routine } = world(10), g = run(s)
  assert.deepEqual([...g.standing].sort(), [...routine].sort())
  assert.ok(g.attention.every(x => !routine.includes(x.questionKey)))
  const short = run(world(2 * OH + 1e-9).s)
  assert.equal(short.standing.length, 2); assert.ok(short.standing.every(k => routine.includes(k)))
  assert.deepEqual(short.attention, [])
  const none = run(world(0).s); assert.deepEqual(none.standing, []); assert.deepEqual(none.attention, [])
})

test('step6 is deterministic and writes only attention and standing', () => {
  const { s } = world(E + S + 3 * OH + 1e-9), before = JSON.stringify({ ...s, admin: undefined }), g1 = run(s), g2 = run(s)
  assert.deepEqual(g1, g2); assert.equal(JSON.stringify({ ...s, admin: undefined }), before)
  const { attention, standing, ...rest } = g1; assert.deepEqual(Object.keys(rest).sort(), Object.keys(s.admin.governments.A).sort())
})

test('through a real turn the slate is written at step 6 for the next turn', () => {
  const { s } = world(100)
  assert.equal(s.admin.governments.A.attention, undefined)
  const r = resolveTurn(s, ruleset, [], { modules, registry }).state.admin.governments.A
  assert.ok(Array.isArray(r.attention) && r.attention.length > 0); assert.ok(r.attention.every(x => /\|/.test(x.questionKey) && x.coordinationCommitted > 0))
  assert.ok(Array.isArray(r.standing))
})
