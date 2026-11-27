// worldgen/world.js — the generated terrain (terrain.js) as the `world.json` document of a Scenario Package (slice 3c, data model).
// EVERY hex is a province, water included (kb world_map 2026-11-09/10): a Sea province is terrain 'Sea' with `waterBody` 'sea' | 'lake'; the hex `surface` ('land' | 'sea' | 'lake') is derived from it.
// Capacities come from the ruleset terrain table (src/data/terrainRules.js): maxArea = one hex, maxArableArea = arableCeiling × maxArea, maxPopulationDensity = popDensityCeiling × densityScale.
// Not here (later stages): owners, Nations and presence, Countries, edges (rivers, passes, sea lanes), warehouses, settlement. All provinces start Wasteland with no population and no owner;
// `anchorsOf` gives the starting population a Settled province of each terrain will get (kb 2026-11-10) for the stage that settles them.
import { hexId } from '../modules/worldmap/hex.js'
import { terrain as TERRAIN_RULES, hexArea as HEX_AREA, densityScale as DENSITY_SCALE } from '../data/terrainRules.js'

export function worldFromTerrain(T, ruleset = { terrain: TERRAIN_RULES, worldgen: { hexArea: HEX_AREA, densityScale: DENSITY_SCALE } }) {
  const { w, h } = T.params.grid, rules = ruleset.terrain, area = ruleset.worldgen?.hexArea ?? HEX_AREA, scale = ruleset.worldgen?.densityScale ?? DENSITY_SCALE, hexes = {}, provinces = {}
  const ids = Object.keys(T.provinces).sort((a, b) => T.provinces[a].y - T.provinces[b].y || T.provinces[a].x - T.provinces[b].x)
  for (const id of ids) { const g = T.provinces[id], r = rules[g.terrain], water = g.terrain === 'Sea'
    hexes[hexId(g.x, g.y)] = { x: g.x, y: g.y, surface: water ? g.waterBody : 'land' }
    provinces[id] = { x: g.x, y: g.y, terrain: g.terrain, ...(water ? { waterBody: g.waterBody } : {}), forestation: g.forestation, habitability: 'Wasteland', waterSource: g.waterSource,
      maxArea: area, maxArableArea: Math.round(r.arableCeiling * area * 100) / 100, maxPopulationDensity: r.popDensityCeiling * scale, population: 0, urbanization: 0, sanitation: 0,
      infrastructureLevel: 0, tradeInfrastructureLevel: 0, owner: null, provenance: g.provenance ?? 'generated' } }
  return { grid: { w, h, orientation: 'pointy-top-odd-r' }, hexes, provinces, edges: [], warehouses: {} }
}
/** province id -> the starting population a Settled province of its terrain gets (0 for water); applied by the stage that settles provinces (needs Countries). */
export const anchorsOf = T => Object.fromEntries(Object.entries(T.provinces).map(([id, p]) => [id, p.anchor]))
