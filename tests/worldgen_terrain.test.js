// Slice 3c: the terrain stages of the generator (every hex a province, Sea incl. lakes). Placeholder numbers; these tests pin structure, not balance.
import test from 'node:test'
import assert from 'node:assert/strict'
import { generateTerrain, terrainReport, TERRAINS, DEFAULTS } from '../src/worldgen/terrain.js'
import { neighbors } from '../src/modules/worldmap/hex.js'

const T = generateTerrain(20261125), ps = Object.values(T.provinces), { w, h } = T.params.grid

test('every hex is a province: 25 x 20 = 500, terrain from the ten-terrain set', () => {
  assert.equal(ps.length, w * h)
  assert.equal(ps.length, 500)
  for (const p of ps) assert.ok(TERRAINS.includes(p.terrain), p.terrain)
})

test('deterministic per seed, different between seeds', () => {
  assert.deepEqual(generateTerrain(20261125).provinces, T.provinces)
  assert.notDeepEqual(generateTerrain(1).provinces, T.provinces)
})

test('Sea provinces: no forestation, no anchor, a waterBody kind; land provinces have none', () => {
  for (const p of ps) {
    if (p.terrain === 'Sea') { assert.equal(p.forestation, 0); assert.equal(p.anchor, 0); assert.ok(['sea', 'lake'].includes(p.waterBody)); assert.equal(p.waterSource, 'none') }
    else assert.equal(p.waterBody, undefined)
  }
})

test('forestation stays inside the kb ceiling of its terrain', () => {
  for (const p of ps) { const [lo, hi] = DEFAULTS.forest[p.terrain]; assert.ok(p.forestation >= lo && p.forestation <= hi, `${p.terrain} ${p.forestation}`) }
})

test('lakes are small and enclosed; seas are the rest', () => {
  const lakes = T.bodies.filter(b => b.kind === 'lake')
  assert.ok(lakes.length >= 1)
  for (const b of lakes) { assert.ok(b.size <= T.params.lakeMaxHexes); assert.equal(b.edge, false) }
  for (const b of T.bodies.filter(b => b.kind === 'sea')) assert.ok(b.edge || b.size > T.params.lakeMaxHexes)
})

test('water source: land next to a lake is river-adjacent (river first), else next to a sea is coastal', () => {
  let lakeShore = 0, coastal = 0
  for (const p of ps) { if (p.terrain === 'Sea') continue
    const nb = neighbors(p.x, p.y, w, h).map(n => T.provinces[`p:${n.x},${n.y}`]).filter(q => q.terrain === 'Sea')
    const lake = nb.some(q => q.waterBody === 'lake'), sea = nb.some(q => q.waterBody === 'sea')
    assert.equal(p.waterSource, lake ? 'river_adjacent' : sea ? 'coastal' : 'none')
    if (lake) lakeShore++; else if (sea) coastal++ }
  assert.ok(lakeShore > 0 && coastal > 0)
})

test('starting-population anchors: Grassland 10,000, Taiga and Mountain 1,000, the rest scaled, never below the floor', () => {
  const by = {}; for (const p of ps) by[p.terrain] = p.anchor
  assert.equal(by.Grassland, 10000); assert.equal(by.Taiga, 1000); assert.equal(by.Mountain, 1000)
  for (const t of TERRAINS.filter(t => t !== 'Sea' && by[t] !== undefined)) assert.ok(by[t] >= DEFAULTS.anchors.floor && by[t] <= 10000, t)
  assert.ok(by.Hill > by.Mountain && by.Hill < by.Grassland)
})

test('balance sanity (placeholder bounds): land share, several landmasses, most terrains present, no isolated land specks', () => {
  const r = terrainReport(T)
  assert.ok(r.landFraction > 0.35 && r.landFraction < 0.6, r.landFraction)
  assert.ok(r.landmasses.length >= 2)
  assert.ok(Object.values(r.share).filter(n => n > 0).length >= 8)
  assert.equal(r.isolatedLand, 0)
})
