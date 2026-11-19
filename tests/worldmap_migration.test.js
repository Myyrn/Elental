// Migration, settlement, direct resettlement and Expulsion (world_map__kb: Population dynamics; spec: world_map__spec.md, 2026-11-19).
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeCtx, resolveTurn } from '../src/engine/engine.js'
import { worldmapModule } from '../src/modules/worldmap/module.js'
import { stepMigration, applyPendingMoves, planForcedMove, moveCohort, queueMove, canSettle, settleProposal, settleUtility, checkSettle } from '../src/modules/worldmap/migration.js'
import { registerWorldmapActions } from '../src/modules/worldmap/actions.js'
import { tuning, ruleset, modules, registry, makeState } from './fixtures.js'
registerWorldmapActions(registry)

const fakeDip = (ban, calls = []) => ({ id: 'diplomacy', derive: { laborMigrationBanned: () => ban }, services: { grantCB: (ctx, ...a) => calls.push(a) } })
const mkCtx = (s, extra = [], rs = ruleset) => makeCtx(s, rs, { modules: [...modules, ...extra], registry, start: s })
const rs0 = { ...ruleset, tuning: { ...tuning, 'mig.rate': { value: 0, status: 'test' } } }      // migration off: isolates the plumbing tests
const cell = (s, n, r) => s.polity.cells[`${n}|peasants|${r}`]

// two Regions in a row: r1 = p:0,0 p:1,0 and r2 = p:2,0 p:3,0 (p:1,0 borders p:2,0); each province 500 people (250 v + 250 k) so presence, province and cell stocks agree
function world2({ ownerB = false } = {}) {
  const s = makeState({ pop: 500 })
  for (const p of Object.keys(s.world.provinces)) s.nations.presence[p] = { v: 250, k: 250 }
  for (const p of ['p:2,0', 'p:3,0']) { s.world.regionSnapshot.assignment[p] = 'r2'; if (ownerB) s.world.provinces[p].owner = 'B' }
  s.world.regionSnapshot.owners = { r1: 'A', r2: ownerB ? 'B' : 'A' }
  for (const n of ['v', 'k']) { const c = structuredClone(cell(s, n, 'r1')); c.key = `${n}|peasants|r2`; c.region = 'r2'; s.polity.cells[c.key] = c }
  s.polity.law.B = { rights: {}, duties: {}, requisitions: [] }
  return s }
const setSat = (s, region, sub) => { for (const c of Object.values(s.polity.cells)) if (c.region === region) c.satisfaction = { subsistence: sub, comfort: 1, luxury: 1 } }
const close = (a, b, m = '') => assert.ok(Math.abs(a - b) < 1e-6, `${m} ${a} vs ${b}`)
function invariants(s) {
  for (const [p, pr] of Object.entries(s.world.provinces)) close(pr.population, Object.values(s.nations.presence[p] ?? {}).reduce((a, b) => a + b, 0), `province ${p}`)
  for (const r of ['r1', 'r2']) for (const n of ['v', 'k']) {
    const presence = Object.entries(s.world.regionSnapshot.assignment).filter(([, x]) => x === r).reduce((t, [p]) => t + (s.nations.presence[p]?.[n] ?? 0), 0)
    close(cell(s, n, r).population, presence, `${n} in ${r}`) } }
const total = s => Object.values(s.polity.cells).reduce((t, c) => t + c.population, 0)

test('migration: people move toward the Region with better satisfaction; stocks follow pro rata, nothing is created or lost', () => {
  const s = world2(); setSat(s, 'r1', 0.5); const before = total(s)
  const done = stepMigration(mkCtx(s))
  assert.equal(done.length, 2)                                                              // v and k, both across p:1,0 -> p:2,0
  assert.ok(done.every(f => f.from === 'p:1,0' && f.to === 'p:2,0'))
  close(s.world.provinces['p:1,0'].population, 485); close(s.world.provinces['p:2,0'].population, 515)      // 250 x 0.02 x (1 - (-0.5)) = 7.5 per Nation
  close(s.nations.presence['p:1,0'].v, 242.5); close(s.nations.presence['p:2,0'].v, 257.5)
  close(cell(s, 'v', 'r1').population, 492.5); close(cell(s, 'v', 'r2').population, 507.5)
  close(cell(s, 'v', 'r1').wealth, 50 * (1 - 0.015)); close(cell(s, 'v', 'r1').wealth + cell(s, 'v', 'r2').wealth, 100)
  close(total(s), before); invariants(s)
})

test('migration: equal satisfaction means no flow; a Region never pulls from a better one', () => {
  const s = world2(); assert.deepEqual(stepMigration(mkCtx(s)), [])
  setSat(s, 'r2', 0.5); const done = stepMigration(mkCtx(s)); assert.ok(done.every(f => f.from === 'p:2,0' && f.to === 'p:1,0')); invariants(s)
})

test('migration: a Movement autonomy Right that is false blocks it; so does a LaborMigrationBan between the two owners', () => {
  const a = world2(); setSat(a, 'r1', 0.5); a.polity.law.A.rights.MovementAutonomy = [{ scope: { kind: 'empire' }, value: false, declaredTurn: 0 }]
  assert.deepEqual(stepMigration(mkCtx(a)), [])
  const b = world2({ ownerB: true }); setSat(b, 'r1', 0.5)
  assert.deepEqual(stepMigration(mkCtx(b, [fakeDip(true)])), [])
  const c = world2({ ownerB: true }); setSat(c, 'r1', 0.5)
  assert.equal(stepMigration(mkCtx(c, [fakeDip(false)])).length, 2); invariants(c)                // across the border, no ban: the migrants settle in the other Country's cells
})

test('migration into a Region without the Nation\'s cell creates it, keeping Nation and Estate', () => {
  const s = world2(); setSat(s, 'r1', 0.5); delete s.polity.cells['v|peasants|r2']; s.nations.presence['p:2,0'].v = 0; s.nations.presence['p:3,0'].v = 0
  s.world.provinces['p:2,0'].population = 250; s.world.provinces['p:3,0'].population = 250
  stepMigration(mkCtx(s)); const c = s.polity.cells['v|peasants|r2']
  assert.ok(c); assert.equal(c.nation, 'v'); assert.equal(c.estate, 'peasants'); assert.equal(c.region, 'r2'); assert.equal(c.key, 'v|peasants|r2'); assert.ok(c.population > 0)
})

test('moveCohort: capped by presence and room; a Wasteland province becomes Frontier and then Settled by the people living there; water needs the capability flag', () => {
  const s = makeState({ pop: 750 })
  for (const p of ['p:0,0', 'p:1,0', 'p:2,0']) s.nations.presence[p] = { v: 250, k: 250 }
  s.nations.presence['p:3,0'] = {}; Object.assign(s.world.provinces['p:3,0'], { habitability: 'Wasteland', population: 0 })
  const ctx = mkCtx(s), v = cell(s, 'v', 'r1')
  assert.equal(moveCohort(ctx, v, 30, 'p:3,0').moved, 30)
  assert.equal(s.world.provinces['p:3,0'].habitability, 'Claimed/Frontier'); close(s.world.provinces['p:0,0'].population, 490); close(s.nations.presence['p:0,0'].v, 240); close(v.population, 750)
  moveCohort(ctx, v, 500, 'p:3,0'); assert.equal(s.world.provinces['p:3,0'].habitability, 'Settled'); close(s.world.provinces['p:3,0'].population, 530)
  const w = makeState(); w.world.provinces['p:3,0'].terrain = 'Sea'
  assert.equal(canSettle(mkCtx(w), 'p:3,0'), false); assert.equal(moveCohort(mkCtx(w), cell(w, 'v', 'r1'), 10, 'p:3,0').moved, 0)
  assert.equal(canSettle(mkCtx(w, [], { ...ruleset, capability: { settleSea: true } }), 'p:3,0'), true)
  const cap = makeState(); cap.world.provinces['p:3,0'].maxPopulationDensity = 1; cap.world.provinces['p:3,0'].maxArea = 520      // room: 520 - 500 = 20
  close(moveCohort(mkCtx(cap), cell(cap, 'v', 'r1'), 300, 'p:3,0').moved, 20)
})

test('settle (cell action): proposes the frontier province of its own Country, utility needs crowding, validate respects the Settlement Right, apply queues and step 8 pays and moves', () => {
  const s = makeState(); Object.assign(s.world.provinces['p:3,0'], { habitability: 'Wasteland', population: 0 }); s.nations.presence['p:3,0'] = {}
  const ctx = mkCtx(s), key = 'v|peasants|r1', p = settleProposal(ctx, key)
  assert.deepEqual(p, { province: 'p:3,0', amount: 50 })
  assert.ok(settleUtility(ctx, key, p) < 0)                                                  // ceilings unbounded: no crowding, only the cost
  for (const id of ['p:0,0', 'p:1,0', 'p:2,0']) Object.assign(s.world.provinces[id], { maxPopulationDensity: 1, maxArea: 600 })
  assert.ok(settleUtility(mkCtx(s), key, p) > 0.3)                                           // 1500/1800 crowding - cost 25/50
  const t = registry.get('settle'); assert.equal(t.cellAvailability, 'permitted')
  assert.deepEqual(t.validate(ctx, { actor: { key }, params: p }), { ok: true })
  t.apply(ctx, { actor: { key }, params: p }); assert.equal(s.world.pendingMoves.length, 1)
  const out = applyPendingMoves(ctx); assert.equal(out.length, 1); assert.deepEqual(s.world.pendingMoves, [])
  close(s.world.provinces['p:3,0'].population, 50); assert.equal(s.world.provinces['p:3,0'].habitability, 'Claimed/Frontier'); close(cell(s, 'v', 'r1').wealth, 25)
  const f = makeState(); Object.assign(f.world.provinces['p:3,0'], { habitability: 'Wasteland', population: 0 }); f.polity.law.A.rights.Settlement = [{ scope: { kind: 'empire' }, value: false, declaredTurn: 0 }]
  assert.equal(settleProposal(mkCtx(f), key), null); assert.match(checkSettle(mkCtx(f), key, p).reasons.join(' '), /forbidden/)
})

test('direct resettlement: planned (preview), queued, applied; stocks follow, the source cell takes an opinion hit, bad orders are rejected with reasons', () => {
  const s = world2(), ctx = mkCtx(s), scope = { kind: 'cell', nation: 'v', estate: 'peasants', region: 'r1' }
  const plan = planForcedMove(ctx, 'A', 'resettle', { scope, province: 'p:3,0', share: 0.5 })
  assert.equal(plan.ok, true); assert.deepEqual(plan.moves, [{ cell: 'v|peasants|r1', amount: 250 }]); close(plan.total, 250); assert.equal(plan.capped, false)
  queueMove(ctx, { kind: 'resettle', country: 'A', params: { scope, province: 'p:3,0', share: 0.5 } })
  const out = applyPendingMoves(ctx); assert.equal(out.length, 1)
  close(cell(s, 'v', 'r1').population, 250); close(cell(s, 'v', 'r2').population, 750); close(s.world.provinces['p:3,0'].population, 750)
  close(s.nations.presence['p:0,0'].v, 125); close(s.nations.presence['p:1,0'].v, 125); close(s.nations.presence['p:3,0'].v, 500); invariants(s); close(total(s), 2000)
  close(cell(s, 'v', 'r1').wealth + cell(s, 'v', 'r2').wealth, 100)
  assert.equal(cell(s, 'v', 'r1').opinionGovMods.at(-1).value, -tuning['force.opinionHit'].value * 0.5)
  const bad = (params, re, c = ctx) => { const r = planForcedMove(c, 'A', 'resettle', params); assert.equal(r.ok, false); assert.match(r.reasons.join(' | '), re) }
  bad({ scope, province: 'p:9,9' }, /unknown province/); bad({ scope, province: 'p:3,0', share: 0 }, /share/); bad({ province: 'p:3,0' }, /scope required/)
  bad({ scope: { kind: 'zzz' }, province: 'p:3,0' }, /invalid scope/); bad({ scope: { kind: 'nation', nation: 'nobody' }, province: 'p:3,0' }, /covers nobody/)
  const o = world2({ ownerB: true }); bad({ scope, province: 'p:2,0' }, /not yours/, mkCtx(o))
})

test('Expulsion: needs a bordering province of another Country and no LaborMigrationBan; confiscates a share to the Government; the expelled cell takes the hit; kin states get a Rights CB', () => {
  const s = world2({ ownerB: true }), calls = []; s.countries = { A: { titularNations: ['k'] }, B: { titularNations: ['v'] } }; cell(s, 'v', 'r1').hoard = { Grain: 10 }
  const ctx = mkCtx(s, [fakeDip(false, calls)]), params = { scope: { kind: 'nation', nation: 'v' }, province: 'p:2,0', confiscate: 0.5 }
  const plan = planForcedMove(ctx, 'A', 'expel', params); assert.equal(plan.ok, true); assert.deepEqual(plan.moves.map(m => m.cell), ['v|peasants|r1']); close(plan.total, 500)
  const no = (p, re, c = ctx) => { const r = planForcedMove(c, 'A', 'expel', p); assert.equal(r.ok, false); assert.match(r.reasons.join(' | '), re) }
  no({ ...params, province: 'p:3,0' }, /border/); no({ ...params, province: 'p:0,0' }, /another Country/); no({ ...params, confiscate: 2 }, /confiscate/)
  no(params, /LaborMigrationBan/, mkCtx(s, [fakeDip(true)]))
  queueMove(ctx, { kind: 'expel', country: 'A', params }); const out = applyPendingMoves(ctx); assert.equal(out.length, 1)
  close(cell(s, 'v', 'r1').population, 0); close(cell(s, 'v', 'r2').population, 1000); close(s.world.provinces['p:2,0'].population, 1000); close(s.nations.presence['p:2,0'].v, 750)
  close(s.admin.governments.A.ledger, 125); close(s.admin.governments.A.inventory.Grain, 5)
  close(cell(s, 'v', 'r2').wealth, 75); close(cell(s, 'v', 'r2').hoard.Grain, 5)             // 50 + the 25 that was not confiscated
  assert.equal(cell(s, 'v', 'r1').opinionGovMods.at(-1).value, -tuning['force.opinionHit'].value)
  assert.deepEqual(calls, [['B', 'A', 'Rights', 'expulsion-of-kin', tuning['cb.mag.expel'].value]]); invariants(s)
})

const order = (id, type, params) => ({ id, type, actor: { kind: 'government', country: 'A' }, params })
test('a resettlement through a real turn: queued by the order, applied at step 8; a Reorganization-free turn keeps the books; a stale order is dropped whole', () => {
  const s = world2(), scope = { kind: 'cell', nation: 'v', estate: 'peasants', region: 'r1' }
  const r = resolveTurn(s, rs0, [order('m1', 'directResettlement', { scope, province: 'p:3,0', share: 0.5 })], { modules, registry })
  assert.deepEqual(r.report.executed, ['m1']); assert.deepEqual(r.state.world.pendingMoves, [])
  const v1 = cell(r.state, 'v', 'r1').population, v2 = cell(r.state, 'v', 'r2').population, k1 = cell(r.state, 'k', 'r1').population, k2 = cell(r.state, 'k', 'r2').population
  close(v1, 0.5 * k1); close(v1 + v2, k1 + k2)                                               // half of v's r1 cell moved to r2, nothing lost (growth is equal for all)
  const bad = resolveTurn(world2(), rs0, [order('m2', 'expel', { scope, province: 'p:3,0' })], { modules, registry })
  assert.equal(bad.report.rejected.length, 1); assert.match(bad.report.rejected[0].reasons.join(' '), /another Country/)
  const t = world2(); t.world.pendingMoves = [{ kind: 'resettle', country: 'A', params: { scope, province: 'p:9,9' } }]
  const d = resolveTurn(t, rs0, [], { modules, registry }).state; assert.deepEqual(d.world.pendingMoves, []); close(total(d), total(resolveTurn(world2(), rs0, [], { modules, registry }).state))
})

test('step 8 runs migration after growth (and before queued moves); the whole pass is deterministic', () => {
  const rs = { ...ruleset, tuning: { ...tuning, 'pop.growth': { value: 0, status: 'test' } } }      // growth off, migration on
  const run = () => { const s = world2(); setSat(s, 'r1', 0.5); worldmapModule.steps[8](mkCtx(s, [], rs)); return s }
  const a = run(), b = run()
  close(a.world.provinces['p:2,0'].population, 515); close(cell(a, 'v', 'r2').population, 507.5); invariants(a)
  assert.deepEqual(a, b)
})
