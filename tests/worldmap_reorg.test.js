// Region capital and the Reorganization Event (world_map__kb: Region; spec: world_map__spec.md, 2026-11-17).
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTurn } from '../src/engine/engine.js'
import { applyReorg, retargetLaws, regionCapitalOf } from '../src/modules/worldmap/reorg.js'
import { registerWorldmapActions } from '../src/modules/worldmap/actions.js'
import { tuning, ruleset, modules, registry, makeState } from './fixtures.js'
registerWorldmapActions(registry)

// odd-r grid: rows y=0 (A) and y=1 (B) border each other, X (owned by 'B') borders B from below, C is far away
const row = (y, x0, n) => Array.from({ length: n }, (_, i) => `p:${x0 + i},${y}`)
const A = row(0, 0, 4), B = row(1, 0, 4), C = row(10, 10, 4), X = row(2, 0, 2)
const world = (regions) => {
  const provinces = {}, assignment = {}
  for (const [ps, owner, rid] of [[A, 'A', 'rA'], [B, 'A', 'rB'], [C, 'A', 'rC'], [X, 'B', 'rX']]) for (const p of ps) { provinces[p] = { owner, population: 100 }; assignment[p] = rid }
  return { grid: { w: 25, h: 20 }, provinces, regionSnapshot: { assignment, next: 10, owners: { rA: 'A', rB: 'A', rC: 'A', rX: 'B' } }, ...(regions ? { regions } : {}) }
}
const splitA = { kind: 'split', region: 'rA', parts: [{ provinces: [A[0], A[1]], capital: A[0] }, { provinces: [A[2], A[3]], capital: A[3] }] }
const bad = (ops, re, w = world()) => { const r = applyReorg(w, 'A', ops); assert.equal(r.ok, false); assert.match(r.reasons.join(' | '), re) }

test('split: new ids for every part, capitals recorded, the old id replaced, the input untouched', () => {
  const w = world(), r = applyReorg(w, 'A', [splitA])
  assert.equal(r.ok, true)
  assert.equal(r.assignment[A[0]], 'r10'); assert.equal(r.assignment[A[1]], 'r10'); assert.equal(r.assignment[A[2]], 'r11'); assert.equal(r.assignment[A[3]], 'r11'); assert.equal(r.next, 12)
  assert.deepEqual(r.capitals, { r10: A[0], r11: A[3] }); assert.deepEqual(r.gone.rA, ['r10', 'r11']); assert.equal(r.owners.r10, 'A'); assert.equal(r.owners.rA, undefined)
  assert.deepEqual(r.targets('rA'), ['r10', 'r11']); assert.deepEqual(r.targets('rB'), ['rB'])
  assert.equal(w.regionSnapshot.assignment[A[0]], 'rA'); assert.equal(w.regionSnapshot.next, 10)          // pure
})

test('split: rejected unless the parts partition the Region, are contiguous, have a capital inside, and the Region is the actor\'s', () => {
  bad([{ kind: 'split', region: 'rA', parts: [{ provinces: [A[0], A[1]], capital: A[0] }, { provinces: [A[2]], capital: A[2] }] }], /partition/)
  bad([{ kind: 'split', region: 'rA', parts: [{ provinces: [A[0], A[3]], capital: A[0] }, { provinces: [A[1], A[2]], capital: A[1] }] }], /not contiguous/)
  bad([{ kind: 'split', region: 'rA', parts: [{ provinces: [A[0], A[1]], capital: A[3] }, { provinces: [A[2], A[3]], capital: A[3] }] }], /capital inside/)
  bad([{ kind: 'split', region: 'rA', parts: [{ provinces: A, capital: A[0] }] }], /at least two/)
  bad([{ kind: 'split', region: 'rX', parts: [{ provinces: [X[0]], capital: X[0] }, { provinces: [X[1]], capital: X[1] }] }], /not yours/)
  bad([{ kind: 'split', region: 'rZ', parts: [] }], /unknown Region/)
  bad([], /ops required/)
  bad([{ kind: 'explode' }], /unknown op kind/)
})

test('merge: adjacent Regions of the actor become one new Region with the named capital; non-adjacent, foreign or capital-less merges are rejected', () => {
  const r = applyReorg(world(), 'A', [{ kind: 'merge', regions: ['rA', 'rB'], capital: A[1] }])
  assert.equal(r.ok, true); assert.equal(new Set([...A, ...B].map(p => r.assignment[p])).size, 1)
  const id = r.assignment[A[0]]; assert.equal(r.capitals[id], A[1]); assert.deepEqual(r.gone.rA, [id]); assert.deepEqual(r.gone.rB, [id]); assert.equal(r.owners[id], 'A')
  bad([{ kind: 'merge', regions: ['rA', 'rC'], capital: A[0] }], /not adjacent/)
  bad([{ kind: 'merge', regions: ['rB', 'rX'], capital: B[0] }], /not yours/)
  bad([{ kind: 'merge', regions: ['rA', 'rB'], capital: C[0] }], /capital inside/)
  bad([{ kind: 'merge', regions: ['rA', 'rA'], capital: A[0] }], /two different/)
})

test('move: a province changes Region while both stay contiguous; the donor\'s stored capital cannot leave unannounced', () => {
  const r = applyReorg(world(), 'A', [{ kind: 'move', province: B[0], to: 'rA' }])
  assert.equal(r.ok, true); assert.equal(r.assignment[B[0]], 'rA'); assert.equal(r.assignment[B[1]], 'rB'); assert.deepEqual(r.gone, {})
  bad([{ kind: 'move', province: C[0], to: 'rA' }], /does not border/)
  bad([{ kind: 'move', province: B[1], to: 'rA' }], /contiguous/)                    // B[1] borders rA but removing it cuts rB in two
  bad([{ kind: 'move', province: A[0], to: 'rA' }], /already/)
  const w = world({ rB: { capital: B[0] } })
  bad([{ kind: 'move', province: B[0], to: 'rA' }], /fromCapital/, w)
  const ok = applyReorg(w, 'A', [{ kind: 'move', province: B[0], to: 'rA', fromCapital: B[1] }]); assert.equal(ok.ok, true); assert.equal(ok.capitals.rB, B[1])
  bad([{ kind: 'move', province: B[0], to: 'rA', fromCapital: A[0] }], /fromCapital must stay/, w)
})

test('ops chain: a Region made by one op can be used by the next; targets() follows the chain', () => {
  const r = applyReorg(world(), 'A', [splitA, { kind: 'merge', regions: ['r10', 'r11'], capital: A[1] }])
  assert.equal(r.ok, true); assert.deepEqual(r.targets('rA'), ['r12']); assert.equal(new Set(A.map(p => r.assignment[p])).size, 1)
  assert.deepEqual(r.capitals, { r12: A[1] })                                         // the capitals of the intermediate Regions are gone with them
})

test('retargetLaws: a removed Region\'s entries are copied to its successors (all scope kinds with a region); merges keep the later Duty and the larger Requisition', () => {
  const mk = () => ({ rights: {}, duties: { Taxation: [
    { scope: { kind: 'region', region: 'rA' }, value: { market: 0.1 }, declaredTurn: 1 }, { scope: { kind: 'region', region: 'rB' }, value: { market: 0.3 }, declaredTurn: 2 },
    { scope: { kind: 'empire' }, value: { market: 0.05 }, declaredTurn: 0 }, { scope: { kind: 'nationRegion', nation: 'v', region: 'rA' }, value: { market: 0.2 }, declaredTurn: 1 }] },
    requisitions: [{ scope: { kind: 'region', region: 'rA' }, target: { good: 'Grain' }, amount: 0.3 }, { scope: { kind: 'region', region: 'rB' }, target: { good: 'Grain' }, amount: 0.5 }] })
  const L = mk(); retargetLaws(L, applyReorg(world(), 'A', [splitA]))
  const regs = e => e.scope.region, d = L.duties.Taxation
  assert.deepEqual(d.filter(e => e.scope.kind === 'region').map(regs).sort(), ['r10', 'r11', 'rB'])
  assert.deepEqual(d.filter(e => e.scope.kind === 'nationRegion').map(regs).sort(), ['r10', 'r11'])
  assert.equal(d.filter(e => e.scope.kind === 'empire').length, 1)
  assert.deepEqual(L.requisitions.map(regs).sort(), ['r10', 'r11', 'rB'])
  const M = mk(); retargetLaws(M, applyReorg(world(), 'A', [{ kind: 'merge', regions: ['rA', 'rB'], capital: A[1] }]))
  const merged = M.duties.Taxation.filter(e => e.scope.kind === 'region'); assert.equal(merged.length, 1); assert.equal(merged[0].value.market, 0.3)      // rB's entry is later
  assert.equal(M.requisitions.length, 1); assert.equal(M.requisitions[0].amount, 0.5)
})

test('regionCapitalOf: the stored capital while valid, else the most populous province (ties by id)', () => {
  const w = world(); w.provinces[A[2]].population = 500
  assert.equal(regionCapitalOf(w, 'rA'), A[2])
  w.regions = { rA: { capital: A[1] } }; assert.equal(regionCapitalOf(w, 'rA'), A[1])
  w.regions = { rA: { capital: B[0] } }; assert.equal(regionCapitalOf(w, 'rA'), A[2])             // not a province of the Region: the fallback
  assert.equal(regionCapitalOf(world(), 'rA'), A[0]); assert.equal(regionCapitalOf(world(), 'rNone'), null)
})

const opsSplit = [{ kind: 'split', region: 'r1', parts: [{ provinces: ['p:0,0', 'p:1,0'], capital: 'p:0,0' }, { provinces: ['p:2,0', 'p:3,0'], capital: 'p:3,0' }] }]
const order = (id, type, params) => ({ id, type, actor: { kind: 'government', country: 'A' }, params })

test('a Reorganization through a real turn: queued by the order, applied at step 8; cells, laws and capitals follow; the next turn runs', () => {
  const s = makeState(); s.polity.law.A.duties.Taxation = [{ scope: { kind: 'region', region: 'r1' }, value: { market: 0.1, wealth: 0 }, declaredTurn: 0 }]
  const r1 = resolveTurn(s, ruleset, [order('o1', 'reorganizeRegions', { ops: opsSplit })], { modules, registry })
  assert.deepEqual(r1.report.executed, ['o1'])
  const w = r1.state.world, a = w.regionSnapshot.assignment
  assert.equal(a['p:0,0'], 'r2'); assert.equal(a['p:1,0'], 'r2'); assert.equal(a['p:2,0'], 'r3'); assert.equal(a['p:3,0'], 'r3'); assert.equal(w.regionSnapshot.next, 4)
  assert.deepEqual(w.regionSnapshot.owners, { r2: 'A', r3: 'A' }); assert.deepEqual(w.regions, { r2: { capital: 'p:0,0' }, r3: { capital: 'p:3,0' } }); assert.deepEqual(w.pendingReorg, [])
  const keys = Object.keys(r1.state.polity.cells).sort()
  assert.deepEqual(keys, ['k|peasants|r2', 'k|peasants|r3', 'v|peasants|r2', 'v|peasants|r3'])
  const total = Object.values(r1.state.polity.cells).reduce((t, c) => t + c.population, 0)
  assert.ok(Math.abs(total - 2000 * (1 + tuning['pop.growth'].value)) < 1e-6, `population ${total}`)          // split by presence share conserves the stock (after this turn's growth)
  for (const c of Object.values(r1.state.polity.cells)) assert.ok(Math.abs(c.population - total / 4) < 1e-6)
  assert.deepEqual(r1.state.polity.law.A.duties.Taxation.map(e => e.scope.region).sort(), ['r2', 'r3'])
  const r2 = resolveTurn(r1.state, ruleset, [], { modules, registry })                                                  // the world keeps running on the new Regions
  assert.deepEqual(r2.state.world.regionSnapshot.assignment, a)
})

test('a bad Reorganization is rejected with its reasons, not thrown; an order that stops being valid before step 8 is dropped whole', () => {
  const s = makeState(), badOps = [{ kind: 'split', region: 'r1', parts: [{ provinces: ['p:0,0', 'p:1,0'], capital: 'p:3,0' }, { provinces: ['p:2,0', 'p:3,0'], capital: 'p:3,0' }] }]
  const r = resolveTurn(s, ruleset, [order('o1', 'reorganizeRegions', { ops: badOps })], { modules, registry })
  assert.equal(r.report.rejected.length, 1); assert.match(r.report.rejected[0].reasons.join(' '), /capital inside/); assert.equal(r.state.world.regionSnapshot.assignment['p:0,0'], 'r1')
  const t = makeState(); t.world.pendingReorg = [{ country: 'A', ops: [{ kind: 'split', region: 'gone', parts: [] }] }]
  const d = resolveTurn(t, ruleset, [], { modules, registry }).state
  assert.equal(d.world.regionSnapshot.assignment['p:0,0'], 'r1'); assert.deepEqual(d.world.pendingReorg, [])
})

test('setRegionCapital: stored at once for a province of the actor\'s Region; anything else is rejected', () => {
  const s = makeState(), ok = resolveTurn(s, ruleset, [order('c1', 'setRegionCapital', { region: 'r1', province: 'p:2,0' })], { modules, registry })
  assert.deepEqual(ok.report.executed, ['c1']); assert.equal(ok.state.world.regions.r1.capital, 'p:2,0')
  const no = resolveTurn(s, ruleset, [order('c2', 'setRegionCapital', { region: 'r1', province: 'p:9,9' }), order('c3', 'setRegionCapital', { region: 'r7', province: 'p:2,0' })], { modules, registry })
  assert.equal(no.report.rejected.length, 2); assert.equal(no.state.world.regions, undefined)
})
