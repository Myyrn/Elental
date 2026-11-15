import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTurn, makeCtx } from '../src/engine/engine.js'
import { resolveAllocation } from '../src/kernel/allocation.js'
import { poolUnmetFrom } from '../src/modules/economics/upkeep.js'
import { ruleset, modules, registry, makeState } from './fixtures.js'

// Pools: Bureaucrats envelope {control 2, coordination 1, observation 1} (fixtures); Scribes {control 1} added here.
const rs = { ...ruleset, pools: { ...ruleset.pools, Scribes: { envelope: { control: 1, coordination: 0, observation: 0 } } } }
const cco = s => makeCtx(structuredClone(s), rs, { modules, registry, start: s }).derive.economics.produceCCO('A')
const withCommitted = (...perCell) => { const s = makeState(); Object.keys(s.polity.cells).forEach((k, i) => { if (perCell[i]) s.polity.cells[k].labourCommitted = perCell[i] }); return s }
const turn = s => resolveTurn(s, rs, [], { modules, registry }).state

test('produceCCO: no committed units gives nothing', () => {
  assert.deepEqual(cco(withCommitted()), { control: 0, coordination: 0, observation: 0 })
})
test('produceCCO is linear in committed units (kb rev 2: no division by total units)', () => {
  const one = cco(withCommitted({ Bureaucrats: 10 }))
  assert.deepEqual(one, { control: 20, coordination: 10, observation: 10 })
  const two = cco(withCommitted({ Bureaucrats: 20 }))
  for (const ax of Object.keys(one)) assert.ok(Math.abs(two[ax] - 2 * one[ax]) < 1e-9, `${ax}: doubling units doubles output`)
  assert.deepEqual(cco(withCommitted({ Bureaucrats: 10 }, { Bureaucrats: 10 })), two, 'the split across cells does not matter')
  const mixed = cco(withCommitted({ Bureaucrats: 10, Scribes: 10 }))
  assert.deepEqual(mixed, { control: 30, coordination: 10, observation: 10 }, 'pools add; a second pool does not dilute the first')
})
test('produceCCO: poolUnmet[pool] = 0.5 halves that pool only', () => {
  const s = withCommitted({ Bureaucrats: 10, Scribes: 10 }); s.admin.governments.A.poolUnmet = { Bureaucrats: 0.5 }
  assert.deepEqual(cco(s), { control: 20, coordination: 5, observation: 5 })   // Bureaucrats {20,10,10} x 0.5 + Scribes {10,0,0}
})
test('Allocation Dial rows carry the entry pool tag', () => {
  const r = resolveAllocation({ entries: [{ target: { kind: 'item', id: 'x' }, floor: 5, priority: 1, mandatory: true, pool: 'Scribes' }, { target: { kind: 'item', id: 'y' }, floor: 5, priority: 2 }] }, 10, {})
  assert.equal(r.rows[0].pool, 'Scribes'); assert.equal(r.rows[1].pool, undefined)
})
test('poolUnmetFrom: only mandatory tagged rows, grants over floors per pool, met pools absent', () => {
  const rows = [
    { pool: 'A', mandatory: true, floor: 30, grant: 30 },
    { pool: 'B', mandatory: true, floor: 40, grant: 10 }, { pool: 'B', mandatory: true, floor: 40, grant: 30 },
    { pool: 'C', mandatory: false, floor: 10, grant: 0 },
    { mandatory: true, floor: 10, grant: 0 },
    { pool: 'D', mandatory: true, floor: 0, grant: 0 },
  ]
  assert.deepEqual(poolUnmetFrom(rows), { B: 0.5 })
  assert.deepEqual(poolUnmetFrom([]), {})
})
test('ledger: poolUnmet written per pool from tagged mandatory rows; replaced every turn; degrades produceCCO next turn', () => {
  const s = makeState({ labour: 400 }); const g = s.admin.governments.A; g.ledger = 50
  g.spendingDial = { reserve: 0, sink: 'keep', entries: [
    { target: { kind: 'item', id: 'bureau' }, floor: 30, priority: 1, mandatory: true, pool: 'Bureaucrats' },   // fully funded
    { target: { kind: 'item', id: 'scribes' }, floor: 40, priority: 2, mandatory: true, pool: 'Scribes' },     // gets 20 of 40
    { target: { kind: 'item', id: 'plain' }, floor: 10, priority: 3, mandatory: true },                        // untagged: aggregate readout only
  ] }
  const s1 = turn(s), g1 = s1.admin.governments.A
  assert.deepEqual(g1.poolUnmet, { Scribes: 0.5 })
  assert.ok(Math.abs(g1.upkeepFraction - 0.375) < 1e-9, `upkeepFraction ${g1.upkeepFraction}`)
  const probe = structuredClone(s1); Object.values(probe.polity.cells)[0].labourCommitted = { Bureaucrats: 10, Scribes: 10 }
  assert.deepEqual(cco(probe), { control: 25, coordination: 10, observation: 10 }, 'Scribes halved, Bureaucrats untouched')
  const s2 = structuredClone(s1); s2.admin.governments.A.ledger = 1000                                         // floors now met
  assert.deepEqual(turn(s2).admin.governments.A.poolUnmet, {}, 'replaced, not accumulated')
})
test('ledger: no tagged rows leaves poolUnmet empty', () => {
  const s = makeState({ labour: 400 }); s.admin.governments.A.ledger = 30
  s.admin.governments.A.spendingDial = { reserve: 0, sink: 'keep', entries: [{ target: { kind: 'item', id: 'upkeep' }, floor: 60, priority: 1, mandatory: true }] }
  assert.deepEqual(turn(s).admin.governments.A.poolUnmet, {})
})
