// Slice 3c, data model: Sea as a terrain (every hex a province), water capability and traversal, the world document written from generated terrain, the validators' water invariants, land movement stopped at water.
import test from 'node:test'
import assert from 'node:assert/strict'
import { terrain, capability, traversal, hexArea, densityScale } from '../src/data/terrainRules.js'
import { generateTerrain, TERRAINS } from '../src/worldgen/terrain.js'
import { worldFromTerrain, anchorsOf } from '../src/worldgen/world.js'
import { invariants, refsOf, structural } from '../src/data/validators/index.js'
import { stepAllowed, findPath, bfsDistance, landBlocked } from '../src/modules/war/graph.js'

const T = generateTerrain(20261125), world = worldFromTerrain(T)
const ruleset = { terrain, capability, traversal, goods: {}, pools: {}, consumption: {}, worldgen: { hexArea, densityScale } }
const docs = (w = world) => ({ world: w, ruleset, nations: { nations: {}, presence: {} }, countries: { countries: {} }, polity: { estates: {}, cells: {}, countryLaws: {} } })
const WORLD_IDS = new Set(['hexNoProvince', 'surfaceMismatch', 'provinceCount', 'waterBody', 'waterOwner', 'waterSource', 'waterPop', 'lakeEdge', 'waterBodyLand', 'noHex', 'forestCeiling', 'wastelandPop', 'popOverDensity', 'seaTerrain'])
const worldIssues = d => invariants(d, refsOf(d)).filter(i => WORLD_IDS.has(i.id))
const clone = () => structuredClone(world), firstOf = (w, f) => Object.entries(w.provinces).find(([, p]) => f(p))

test('the ruleset has ten terrains with Sea (a water terrain), water capability and traversal; Grassland carries 10x the people of Taiga', () => {
  assert.deepEqual(Object.keys(terrain).sort(), [...TERRAINS].sort())
  assert.equal(terrain.Sea.water, true); assert.equal(terrain.Sea.popDensityCeiling, 0); assert.equal(terrain.Sea.forestMax, 0)
  assert.equal(capability.settleSea, false); assert.equal(capability.settleLake, true)
  assert.equal(traversal.Sea.land, false); assert.equal(traversal.Lake.land, false); assert.equal(traversal.Sea.sea, true)
  assert.ok(Math.abs(terrain.Grassland.popDensityCeiling / terrain.Taiga.popDensityCeiling - 10) < 1e-9)
  const a = anchorsOf(T), by = {}; for (const [id, p] of Object.entries(T.provinces)) by[p.terrain] = a[id]
  assert.equal(by.Grassland, 10 * by.Taiga); assert.equal(by.Mountain, by.Taiga); assert.equal(by.Sea, 0)
})

test('the generated terrain becomes a world document with every hex a province; water provinces are unowned Wasteland with a waterBody and a derived hex surface', () => {
  assert.equal(Object.keys(world.provinces).length, 500); assert.equal(Object.keys(world.hexes).length, 500); assert.deepEqual(world.edges, []); assert.equal(world.grid.w * world.grid.h, 500)
  for (const [id, p] of Object.entries(world.provinces)) {
    assert.equal(world.hexes[`h:${p.x},${p.y}`].surface, p.terrain === 'Sea' ? p.waterBody : 'land', id)
    assert.equal(p.habitability, 'Wasteland'); assert.equal(p.population, 0); assert.equal(p.owner, null)
    if (p.terrain === 'Sea') { assert.ok(['sea', 'lake'].includes(p.waterBody)); assert.equal(p.maxPopulationDensity, 0); assert.equal(p.maxArableArea, 0); assert.equal(p.forestation, 0) }
    else { assert.equal(p.waterBody, undefined); assert.equal(p.maxArea, hexArea); assert.equal(p.maxPopulationDensity, terrain[p.terrain].popDensityCeiling * densityScale) } }
  assert.deepEqual(worldFromTerrain(generateTerrain(20261125)), world, 'deterministic')
  assert.ok(Object.values(world.provinces).some(p => p.waterBody === 'lake')); assert.ok(Object.values(world.provinces).some(p => p.waterBody === 'sea'))
})

test('the schema accepts the world document (waterBody, Sea terrain) and the validators find no water problem in it', () => {
  const d = docs(); const sIssues = structural({ world, ruleset: d.ruleset }, refsOf(d)).filter(i => i.path.startsWith('/world'))
  assert.deepEqual(sIssues.filter(i => i.severity === 'error'), [], JSON.stringify(sIssues.slice(0, 3)))
  assert.deepEqual(worldIssues(d), [], JSON.stringify(worldIssues(d).slice(0, 3)))
})

test('validators: a hex without a province, a wrong surface, a Sea province without waterBody, an owned or inhabited water province, a land province with a waterBody, a ruleset without Sea', () => {
  const ids = f => worldIssues(docs(f)).map(i => i.id)
  let w = clone(); const [landId, land] = firstOf(w, p => p.terrain !== 'Sea'), [seaId, sea] = firstOf(w, p => p.waterBody === 'sea')
  delete w.provinces[landId]; assert.ok(ids(w).includes('hexNoProvince')); assert.ok(ids(w).includes('provinceCount'))
  w = clone(); w.hexes[`h:${land.x},${land.y}`].surface = 'sea'; assert.ok(ids(w).includes('surfaceMismatch'))
  w = clone(); delete w.provinces[seaId].waterBody; assert.ok(ids(w).includes('waterBody'))
  w = clone(); w.provinces[seaId].owner = 'x'; assert.ok(worldIssues(docs(w)).some(i => i.id === 'waterOwner' && i.severity === 'warn'))
  w = clone(); w.provinces[seaId].population = 10; assert.ok(ids(w).includes('waterPop'))
  w = clone(); const [lakeId] = firstOf(w, p => p.waterBody === 'lake'); w.provinces[lakeId].population = 10; assert.equal(ids(w).includes('waterPop'), false, 'a lake may be settled (settleLake)')
  w = clone(); w.provinces[landId].waterBody = 'lake'; assert.ok(ids(w).includes('waterBodyLand'))
  const noSea = docs(); noSea.ruleset = { ...ruleset, terrain: Object.fromEntries(Object.entries(terrain).filter(([k]) => k !== 'Sea')) }; assert.ok(worldIssues(noSea).some(i => i.id === 'seaTerrain'))
})

// ---- war graph: a strait of water between two land provinces on a line
const line = (kinds, tr = traversal) => { const provinces = {}, adj = {}; kinds.forEach((k, x) => { provinces[`p:${x},0`] = { x, y: 0, terrain: k === 'L' ? 'Grassland' : 'Sea', ...(k === 'S' ? { waterBody: 'sea' } : k === 'W' ? { waterBody: 'lake' } : {}), forestation: 0 } })
  kinds.forEach((k, x) => { adj[`p:${x},0`] = [x - 1, x + 1].filter(i => i >= 0 && i < kinds.length).map(i => `p:${i},0`) })
  return { ruleset: { traversal: tr }, T: k => ({ 'war.forest.block': 80, 'war.river.cost': 1.5 })[k], state: { world: { provinces, edges: {} } }, derive: { worldmap: { neighbors: p => adj[p] } } } }

test('war graph: armies on foot cannot enter or cross a Sea or lake province; land steps cost 1; without the traversal data nothing changes', () => {
  const sea = line(['L', 'L', 'S', 'L']), lake = line(['L', 'W', 'L'])
  assert.deepEqual(stepAllowed(sea, 'p:0,0', 'p:1,0'), { cost: 1 }); assert.equal(stepAllowed(sea, 'p:1,0', 'p:2,0'), false); assert.equal(stepAllowed(sea, 'p:2,0', 'p:3,0'), false)
  assert.equal(stepAllowed(lake, 'p:0,0', 'p:1,0'), false)
  assert.equal(findPath(sea, 'p:0,0', 'p:3,0'), null, 'no route over the strait'); assert.deepEqual(findPath(sea, 'p:0,0', 'p:1,0'), ['p:1,0'])
  assert.equal(findPath(lake, 'p:0,0', 'p:2,0'), null)
  assert.equal(bfsDistance(sea, 'p:0,0', p => p === 'p:3,0'), null); assert.deepEqual(bfsDistance(sea, 'p:0,0', p => p === 'p:1,0'), { province: 'p:1,0', distance: 1 })
  assert.equal(landBlocked(sea, sea.state.world.provinces['p:2,0']), true); assert.equal(landBlocked(sea, sea.state.world.provinces['p:0,0']), false); assert.equal(landBlocked(sea, undefined), false)
  const old = line(['L', 'S', 'L'], null); assert.deepEqual(stepAllowed(old, 'p:0,0', 'p:1,0'), { cost: 1 }, 'no traversal flags: the old behaviour')
})
