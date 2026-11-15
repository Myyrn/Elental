import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTurn, makeCtx } from '../src/engine/engine.js'
import { readPolityQueue } from '../src/modules/polity/step.js'
import { ruleset, modules, registry, makeState } from './fixtures.js'

const turn = s => resolveTurn(s, ruleset, [], { modules, registry }).state
const ctxOf = s => makeCtx(structuredClone(s), ruleset, { modules, registry, start: s })
const withControl = s => { s.admin.governments.A.controlSupply = 1e9; s.admin.governments.A.controlDial = { entries: [{ target: { kind: 'empire' }, floor: 0, priority: 1, surplusWeight: 1 }] }; return s }
const requisitioned = (amount, { control = true } = {}) => {
  const s = makeState({ labour: 400 }); s.polity.law.A.requisitions = [{ scope: { kind: 'empire' }, target: { good: 'Grain' }, amount, unit: 'fraction' }]
  return control ? withControl(s) : s }
const mods = (c, prefix, key = 'opinionGovMods') => (c[key] ?? []).filter(m => String(m.id).startsWith(prefix))

test('readPolityQueue: requisition hit = req.opinionHit x burden (share of the cell\'s output taken); drained', () => {
  const s = makeState(); const [a] = Object.keys(s.polity.cells); s.polity.cells[a].salesValueBase = 30
  const ctx = ctxOf(s); ctx.polityQueue = { requisitionHits: [{ cell: a, target: 'Grain', claimed: 10, delivered: 10, value: 10, shortfall: 0 }, { cell: 'gone|x|r9', target: 'Grain', value: 5 }] }
  readPolityQueue(ctx)
  const m = mods(ctx.state.polity.cells[a], 'req.'); assert.equal(m.length, 1)
  assert.ok(Math.abs(m[0].value + ctx.T('req.opinionHit') * 0.25) < 1e-12, `value ${m[0].value}`)       // 10 / (30 + 10)
  assert.deepEqual(m[0].decay, { kind: 'exp', rateKey: 'opinion.modDecay' })
  assert.equal(ctx.polityQueue.requisitionHits.length, 0)
})
test('readPolityQueue: a requisition that took nothing is no hit', () => {
  const s = makeState(); const [a] = Object.keys(s.polity.cells), ctx = ctxOf(s)
  ctx.polityQueue = { requisitionHits: [{ cell: a, target: 'Grain', claimed: 10, delivered: 0, value: 0, shortfall: 10 }] }
  readPolityQueue(ctx); assert.equal(mods(ctx.state.polity.cells[a], 'req.').length, 0)
})
test('readPolityQueue: a credit default hits the creditor (Opinion and Fairness grievance) by its loss share; drained', () => {
  const s = makeState(); const [a, b] = Object.keys(s.polity.cells); s.polity.cells[a].wealth = 300
  const ctx = ctxOf(s); ctx.polityQueue = { requisitionHits: [], defaults: [{ creditor: a, debtor: b, principal: 100 }] }
  readPolityQueue(ctx)
  const c = ctx.state.polity.cells[a], op = mods(c, 'default.'), fm = mods(c, 'default.', 'fairnessMods')    // loss = 100 / (300 + 100)
  assert.equal(op.length, 1); assert.ok(Math.abs(op[0].value + ctx.T('default.opinionHit') * 0.25) < 1e-12)
  assert.equal(fm.length, 1); assert.ok(Math.abs(fm[0].value - ctx.T('default.fairnessHit') * 0.25) < 1e-12)
  assert.equal(mods(ctx.state.polity.cells[b], 'default.').length, 0, 'the debtor takes no Opinion hit here (its net position is Demotion\'s)')
  assert.equal(ctx.polityQueue.defaults.length, 0)
})
test('readPolityQueue: empty or missing queues are fine', () => {
  const ctx = ctxOf(makeState()); ctx.polityQueue = {}; readPolityQueue(ctx)
  ctx.polityQueue = { requisitionHits: [] }; readPolityQueue(ctx)
})
test('turn: a delivered requisition lands an Opinion hit on every requisitioned cell; a bigger take hits harder', () => {
  const small = turn(requisitioned(0.2)), big = turn(requisitioned(0.5))
  for (const s of [small, big]) for (const c of Object.values(s.polity.cells)) { const m = mods(c, 'req.'); assert.equal(m.length, 1); assert.ok(m[0].value < 0) }
  const hit = s => Math.abs(mods(Object.values(s.polity.cells)[0], 'req.')[0].value)
  assert.ok(hit(big) > hit(small), `big ${hit(big)} vs small ${hit(small)}`)
})
test('turn: without Control nothing is delivered, so there is no requisition hit', () => {
  const s = turn(requisitioned(0.5, { control: false }))
  for (const c of Object.values(s.polity.cells)) assert.equal(mods(c, 'req.').length, 0)
})
test('turn: an obligation past the arrears limit defaults and hits the creditor', () => {
  const s = makeState({ labour: 0.2 }); const [a, b] = Object.keys(s.polity.cells)
  s.polity.cells[a].wealth = 1000; s.polity.cells[b].wealth = 0
  s.economy.obligations = [{ id: 'o-test', creditor: a, debtor: b, principal: 100, arrears: 49.9 }]      // limit 0.5 x principal = 50; one turn of interest (2) crosses it
  const r = turn(s)
  assert.ok(!r.economy.obligations.some(o => o.id === 'o-test'), 'defaulted obligation removed')
  const c = r.polity.cells[a]; assert.equal(mods(c, 'default.').length, 1); assert.ok(mods(c, 'default.')[0].value < 0)
  assert.equal(mods(c, 'default.', 'fairnessMods').length, 1); assert.ok(mods(c, 'default.', 'fairnessMods')[0].value > 0)
})
