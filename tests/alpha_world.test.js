// The alpha world assembly (src/worldgen/assemble.js, worldgen__spec.md stages 5, 7, 8, 10-14, slice 3c). WRITTEN, NOT YET RUN IN THE REPO by the designer (a sandbox run used stand-ins for terrain.js, regions.js, seedCells).
// Needs data/ruleset.json (npm run build:data).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { assembleAlpha, assembleAlphaChecked, ALPHA_SEED, COUNTRIES } from '../src/worldgen/assemble.js'
import { generateTerrain } from '../src/worldgen/terrain.js'
import { validateAll } from '../src/data/validators/index.js'
import { EngineClient } from '../src/client/engineClient.js'
import { neighbors, edgeKey } from '../src/modules/worldmap/hex.js'
const ruleset = JSON.parse(readFileSync(new URL('../data/ruleset.json', import.meta.url)))
const built = assembleAlphaChecked(ALPHA_SEED), { docs, report } = built
const isLand = (P, id) => P[id].terrain !== 'Sea'
const nbs = (d, id) => { const P = d.world.provinces; return neighbors(P[id].x, P[id].y, d.world.grid.w, d.world.grid.h).map(n => `p:${n.x},${n.y}`) }
/** number of connected land components, optionally with Mountain-Mountain edges blocked unless they are passes (the movement rule) */
function components(d, blocked) {
  const P = d.world.provinces, et = new Map(d.world.edges.map(e => [edgeKey(e.a, e.b), e.type])), land = Object.keys(P).filter(id => isLand(P, id)), seen = new Set(); let n = 0
  for (const id of land) { if (seen.has(id)) continue; n++; const st = [id]; seen.add(id)
    while (st.length) { const x = st.pop(); for (const q of nbs(d, x)) { if (!isLand(P, q) || seen.has(q)) continue
      if (blocked && P[x].terrain === 'Mountain' && P[q].terrain === 'Mountain' && et.get(edgeKey(x, q)) !== 'mountain_pass') continue
      seen.add(q); st.push(q) } } }
  return n }

test('the assembled package is the five-Country world: 500 provinces (every hex), five Countries each with its titular Nation, water unowned and empty', () => {
  const P = docs.world.provinces, ids = Object.keys(P)
  assert.equal(ids.length, docs.world.grid.w * docs.world.grid.h); assert.equal(Object.keys(docs.world.hexes).length, ids.length)
  assert.deepEqual(Object.keys(docs.countries.countries).sort(), COUNTRIES.map(c => c.id).sort()); assert.equal(Object.keys(docs.nations.nations).length, 5)
  assert.equal(Object.values(docs.countries.countries).filter(c => c.isPlayer).length, 1); assert.equal(docs.scenario.playerCountry, 'venz')
  for (const id of ids) { const p = P[id]; if (p.terrain === 'Sea') { assert.equal(p.owner, null, id); assert.equal(p.population, 0, id); assert.equal(p.habitability, 'Wasteland', id); assert.deepEqual(docs.nations.presence[id], {}, id) } }
  for (const [cid, c] of Object.entries(docs.countries.countries)) { const mine = ids.filter(id => P[id].owner === cid), nat = c.titularNations[0], tot = {}
    assert.ok(mine.length >= 10, `${cid} owns ${mine.length}`)
    for (const id of mine) for (const [n, v] of Object.entries(docs.nations.presence[id])) tot[n] = (tot[n] ?? 0) + v
    assert.equal(Object.entries(tot).sort((a, b) => b[1] - a[1])[0][0], nat, `${cid}: the titular Nation is the plurality of its own provinces`) }
  assert.ok(report.pass, report.fails.join('; '))
})

test('the package validates against the shared ruleset without errors (schemas, referential, world, presence, cell sums vs the derived Regions)', () => {
  const issues = validateAll({ ...docs, ruleset }), errors = issues.filter(i => i.severity === 'error')
  assert.deepEqual(errors, [], JSON.stringify(errors.slice(0, 5)))
})

test('people: presence sums to the province population, Wasteland is empty, Settled/Frontier follow ownership, the anchors cap the population, cells hold all the Region\'s Nations', () => {
  const P = docs.world.provinces
  for (const [id, p] of Object.entries(P)) { assert.equal(Object.values(docs.nations.presence[id]).reduce((a, b) => a + b, 0), p.population, id)
    if (p.habitability === 'Wasteland') assert.equal(p.population, 0, id)
    if (p.owner) assert.notEqual(p.habitability, 'Wasteland', id); else assert.equal(p.habitability, 'Wasteland', id)
    assert.ok(p.population <= p.maxPopulationDensity * p.maxArea + 1e-9, id) }
  const cellPop = Object.values(docs.polity.cells).reduce((s, c) => s + c.population, 0), pop = Object.values(P).reduce((s, p) => s + p.population, 0)
  assert.ok(Math.abs(cellPop - pop) / pop < 0.02, `cells ${cellPop} vs provinces ${pop}`)
  assert.equal(Object.keys(docs.polity.estates).length, 4); assert.ok(Math.abs(Object.values(docs.polity.estates).reduce((s, e) => s + e.populationShare, 0) - 1) < 1e-9)
  for (const c of Object.keys(docs.countries.countries)) { assert.ok(docs.polity.lawTemplates[c]); assert.equal(docs.polity.countryLaws[c].template, c); assert.ok(docs.polity.governments[c].ledger >= 100) }
  assert.equal(docs.polity.countryLaws.yuku.overrides.estateLabels.peasants, 'Slaves')
})

test('edges: rivers and passes join adjacent land hexes, passes touch a Mountain, no river on a Mountain-Mountain edge, sea lanes join coastal provinces; passes keep every landmass connected', () => {
  const P = docs.world.provinces, E = docs.world.edges
  for (const e of E) { assert.ok(P[e.a] && P[e.b]); if (e.type !== 'sea_lane') { assert.ok(nbs(docs, e.a).includes(e.b), `${e.type} ${e.a}~${e.b}`); assert.ok(isLand(P, e.a) && isLand(P, e.b)) }
    if (e.type === 'mountain_pass') assert.ok(P[e.a].terrain === 'Mountain' || P[e.b].terrain === 'Mountain')
    if (e.type === 'river') assert.ok(!(P[e.a].terrain === 'Mountain' && P[e.b].terrain === 'Mountain'))
    if (e.type === 'sea_lane') for (const id of [e.a, e.b]) assert.ok(isLand(P, id) && nbs(docs, id).some(q => P[q].waterBody === 'sea'), `${id} is not coastal`) }
  assert.equal(new Set(E.map(e => edgeKey(e.a, e.b))).size, E.length, 'one edge per pair')
  assert.equal(components(docs, true), components(docs, false), 'the passes keep every landmass connected')
  assert.ok(report.edges.river > 0)
})

test('a solid mountain range: Kruskal passes keep the landmass connected; fortresses only on passes at a border and river crossings between owners', () => {
  const T = generateTerrain(5)
  for (let y = 4; y <= 14; y++) for (let x = 9; x <= 13; x++) { const p = T.provinces[`p:${x},${y}`]; if (p.terrain !== 'Sea') { p.terrain = 'Mountain'; p.forestation = 0; p.anchor = 1000 } }
  const { docs: d } = assembleAlpha(5, { terrain: T }), P = d.world.provinces
  assert.ok(d.world.edges.filter(e => e.type === 'mountain_pass').length > 0); assert.equal(components(d, true), components(d, false))
  for (const e of d.world.edges.filter(e => e.fortress)) assert.ok(e.type === 'mountain_pass' || (e.type === 'river' && P[e.a].owner && P[e.b].owner && P[e.a].owner !== P[e.b].owner))
})

test('deterministic per seed; a different seed gives a different world; the checked loop returns a passing seed (or says it failed)', () => {
  assert.deepEqual(assembleAlpha(7).docs, assembleAlpha(7).docs); assert.notDeepEqual(assembleAlpha(7).docs.world, assembleAlpha(8).docs.world)
  assert.equal(built.failed, false, `no seed passed: ${report.fails.join('; ')}`); assert.equal(built.seedUsed, ALPHA_SEED + built.attempt)
})

test('the alpha package plays: the engine starts on the 500-province world and resolves 2 turns (population-scale smoke; a failure here is the first headless finding, not a worldgen bug by itself)', async () => {
  const c = new EngineClient(); await c.init(structuredClone(docs), ruleset); await c.runTurns(2)
  const h = await c.query('history'); assert.equal(h.length, 2)
  for (const x of await c.query('cells')) { assert.ok(x.wealth >= 0); for (const v of Object.values(x.satisfaction)) assert.ok(v >= 0 && v <= 1) }
})
