// data/terrainRules.js — the terrain part of the shared ruleset, in ONE place: tools/buildRuleset.mjs writes it into data/ruleset.json; worldgen and the tests import it directly
// (so they do not depend on the generated file). Ten terrain types, Sea included (kb world_map 2026-11-09/10: every hex is a province, water too; a lake is a small enclosed Sea body, `province.waterBody`).
// All numbers are placeholders (numbers pass). forest ceilings and the favor table are the kb's; arable and density ceilings are placeholders from the kb's qualitative levels.
export const terrain = {
  Mountain: { forestMin: 0, forestMax: 40, arableCeiling: 0.15, popDensityCeiling: 0.1, favor: { 'Iron Ore': 8, 'Precious Metal Ore': 8, Coal: 6, Stone: 8, Sulfur: 5 } },
  Hill: { forestMin: 10, forestMax: 70, arableCeiling: 0.5, popDensityCeiling: 0.5, favor: { Stone: 4, 'Iron Ore': 3, Coal: 3, 'Fine Horses': 2, Wool: 2 } },
  Desert: { forestMin: 0, forestMax: 10, arableCeiling: 0.05, popDensityCeiling: 0.03, favor: { Salt: 6, Sulfur: 4, 'Precious Metal Ore': 2 } },
  Steppe: { forestMin: 0, forestMax: 40, arableCeiling: 0.5, popDensityCeiling: 0.4, favor: { 'Fine Horses': 8, Livestock: 5, Wool: 3 } },
  Grassland: { forestMin: 10, forestMax: 70, arableCeiling: 0.9, popDensityCeiling: 1.0, favor: { Grain: 6, Livestock: 5, Wool: 2 } },   // forest ceiling: kb flags for correction
  Wetland: { forestMin: 20, forestMax: 70, arableCeiling: 0.4, popDensityCeiling: 0.6, favor: { Fish: 5, Fiber: 5, Salt: 3, Herbs: 3, 'Iron Ore': 2 } },
  Jungle: { forestMin: 60, forestMax: 100, arableCeiling: 0.2, popDensityCeiling: 0.3, favor: { Herbs: 8, 'Magical Reagents': 5, Fiber: 4 } },
  Arctic: { forestMin: 0, forestMax: 15, arableCeiling: 0.02, popDensityCeiling: 0.03, favor: { Fish: 4, Hides: 3, 'Precious Metal Ore': 2 } },
  Taiga: { forestMin: 50, forestMax: 90, arableCeiling: 0.2, popDensityCeiling: 0.1, favor: { Hides: 5, Fish: 3 } },    // designer 2026-11-25: Grassland carries 10x the people of Taiga (ceilings 1.0 vs 0.1; starting anchors 10,000 vs 1,000)
  Sea: { forestMin: 0, forestMax: 0, arableCeiling: 0, popDensityCeiling: 0, water: true, favor: { Fish: 4 } },           // Sea and lake hexes; Fish yield is open in the kb (placeholder)
}
// kb world_map 2026-11-09/10: in alpha no Nation can settle water — neither open sea nor lakes (post-alpha technologies); lakes are playable water provinces that simply stay unsettled. `canSettle` (worldmap/migration.js) reads these.
export const capability = { settleSea: false, settleLake: false }
// what may move through a water province. `land: false` = armies on foot cannot enter (war/graph.js); `sea: true` is for ships and sea lanes (naval movement is not in code yet).
export const traversal = { Sea: { land: false, sea: true }, Lake: { land: false, sea: true } }
export const hexArea = 100          // the area of one hex province (maxArea); the demo used 100
export const densityScale = 200     // maxPopulationDensity = popDensityCeiling × densityScale (Grassland 200 × 100 = 20,000 room for a 10,000 anchor)
