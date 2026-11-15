import test from 'node:test'
import assert from 'node:assert/strict'
import { makeCtx } from '../src/engine/engine.js'
import { diplomacyModule, makeDiplomacyState } from '../src/modules/diplomacy/module.js'
import { ownerTradeFactor, borderOpenness } from '../src/modules/diplomacy/border.js'
import { tradeFactor } from '../src/modules/diplomacy/treaties.js'
import { ruleset, modules, registry, makeState } from './fixtures.js'

// Row of 4 provinces p:0,0 .. p:3,0. A owns 0-1, B owns 2-3. Gravity (tradeInfra 50 everywhere, lastOutput boosted at p:0,0):
//   g(0,0)=512500  g(1,0)=287500  g(2,0)=50000  g(3,0)=37500  -> with an open border everything climbs to p:0,0; closed, p:2,0 and p:3,0 form their own zone.
const GOODS4 = ['Grain', 'Wool', 'Wine', 'Cloth']
const many = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`X${i}`, { tier: 'raw', baseValue: 1, extractPool: 'Agriculture' }]))
const rs15 = { ...ruleset, goods: { ...ruleset.goods, ...many } }       // 15 goods, so openness can fall below the 0.1 floor
const GOODS15 = Object.keys(rs15.goods)

function world({ bans = [], embargo = false, owners = ['A', 'A', 'B', 'B'], rs = ruleset, withDiplomacy = true } = {}) {
  const s = makeState()
  ;['p:0,0', 'p:1,0', 'p:2,0', 'p:3,0'].forEach((id, i) => { s.world.provinces[id].owner = owners[i] })
  s.economy.lastOutput = { 'p:0,0': 10000 }
  s.countries = { A: {}, B: {} }
  s.diplomacy = makeDiplomacyState()
  const axes = bans.map(good => ({ axis: 'ResourceExportBan', terms: { good } }))
  if (embargo) axes.push({ axis: 'TradeAccess', terms: { embargo: 'A' } })
  if (axes.length) s.diplomacy.treaties.push({ id: 'tr0', kind: 'Sanction', status: 'active', since: 0, imposers: ['A'], target: 'B', axes })
  return makeCtx(structuredClone(s), rs, { modules: withDiplomacy ? [...modules, diplomacyModule] : modules, registry, start: s })
}
const zonesOf = ctx => Object.values(ctx.derive.economics.zones()).map(ps => [...ps].sort().join(' ')).sort()
const ONE = ['p:0,0 p:1,0 p:2,0 p:3,0'], SPLIT = ['p:0,0 p:1,0', 'p:2,0 p:3,0']

test('zones: an unrestricted border does not split a zone (zones are not bounded by Country borders)', () => {
  assert.deepEqual(zonesOf(world()), ONE)
  assert.equal(world().derive.economics.zoneOf('p:3,0'), 'p:0,0')
  assert.deepEqual(zonesOf(world({ withDiplomacy: false })), ONE, 'no Diplomacy module: borders count as open')
})
test('zones: a single-owner world is unchanged', () => {
  assert.deepEqual(zonesOf(world({ owners: ['A', 'A', 'A', 'A'] })), ONE)
})
test('zones: an embargo or a ban on every good closes the border and splits the zone', () => {
  assert.deepEqual(zonesOf(world({ embargo: true })), SPLIT)
  assert.deepEqual(zonesOf(world({ bans: GOODS4 })), SPLIT)
})
test('zones: partial restriction scales the pull but does not split above the floor', () => {
  const ctx = world({ bans: ['Grain', 'Wool'] })
  assert.equal(borderOpenness(ctx, 'A', 'B'), 0.5)
  assert.deepEqual(zonesOf(ctx), ONE)                                  // pull 0.5 x 287500 > 50000
})
test('zones: below zone.openFloor (0.1) a border counts as closed; above it, open', () => {
  const almost = world({ rs: rs15, bans: GOODS15.slice(0, 14) }), some = world({ rs: rs15, bans: GOODS15.slice(0, 12) })
  assert.ok(Math.abs(borderOpenness(almost, 'A', 'B') - 1 / 15) < 1e-12); assert.deepEqual(zonesOf(almost), SPLIT)
  assert.ok(Math.abs(borderOpenness(some, 'A', 'B') - 3 / 15) < 1e-12); assert.deepEqual(zonesOf(some), ONE)
})
test('zones: unowned land or water never pulls across an owner boundary', () => {
  assert.deepEqual(zonesOf(world({ owners: ['A', 'A', null, null] })), SPLIT)
})
test('zoneEdges: a split gives one edge between the two hubs; a merged zone has none', () => {
  const split = world({ embargo: true }), merged = world()
  assert.deepEqual(split.derive.economics.zones && Object.keys(split.derive.economics.zones()).sort(), ['p:0,0', 'p:2,0'])
  assert.deepEqual(merged.derive.economics.zones && Object.keys(merged.derive.economics.zones()), ['p:0,0'])
})
test('borderOpenness: 1 unrestricted / same owner / unowned; 0 under embargo', () => {
  const ctx = world()
  assert.equal(borderOpenness(ctx, 'A', 'B'), 1); assert.equal(borderOpenness(ctx, 'A', 'A'), 1); assert.equal(borderOpenness(ctx, 'A', null), 1)
  assert.equal(borderOpenness(world({ embargo: true }), 'A', 'B'), 0); assert.equal(borderOpenness(world({ embargo: true }), 'B', 'A'), 0, 'symmetric')
  assert.equal(world().derive.diplomacy.borderOpenness('A', 'B'), 1, 'registered as a derive')
})
test('ownerTradeFactor agrees with treaties.tradeFactor for every good, in both directions', () => {
  for (const opts of [{}, { embargo: true }, { bans: ['Grain'] }, { bans: ['Wool', 'Cloth'] }]) {
    const ctx = world(opts)
    for (const g of GOODS4) {
      assert.equal(ownerTradeFactor(ctx, 'A', 'B', g), tradeFactor(ctx, 'p:0,0', 'p:3,0', g), `${JSON.stringify(opts)} ${g}`)
      assert.equal(ownerTradeFactor(ctx, 'B', 'A', g), tradeFactor(ctx, 'p:3,0', 'p:0,0', g), `${JSON.stringify(opts)} ${g} reversed`)
    }
  }
})
