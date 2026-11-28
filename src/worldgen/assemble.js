// worldgen/assemble.js — slice 3c, the alpha world assembly: generated terrain (terrain.js, world.js) -> a complete Scenario Package (worldgen__spec.md stages 5, 7, 8, 10-14).
// Pure and deterministic: (seed, over) -> {docs, report}. Docs are the package documents (manifest, world, nations, countries, polity, relations, scenario); the ruleset is NOT part of it.
// The people are the five-Country placeholder world of nations__kb.md (designer 2026-11-09): Family, Alatyr, Yuku, Venz, Retlaytiland, one Nation each, Preference baselines on the Portrait axes (+ = Pole A).
// Every number below is a placeholder (spec decision) until the numbers pass; `over` replaces top-level keys of ALPHA (shallow).
import { neighbors, provId, edgeKey, distance } from '../modules/worldmap/hex.js'
import { generateTerrain, makeRng } from './terrain.js'
import { worldFromTerrain } from './world.js'
import { terrain as TERRAIN_RULES } from '../data/terrainRules.js'
import { seedCells } from '../editor/generators.js'

export const ALPHA_SEED = 20261128
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x)), sum = a => a.reduce((s, x) => s + x, 0), byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const AXES = ['ruthlessness_restraint', 'conservatism_reformism', 'extraction_investment', 'homogenizing_pluralist', 'fervor_secular']
const pref = v => Object.fromEntries(AXES.map((a, i) => [a, v[i]]))

/** The five Countries. `at` = target position on the grid (fractions of w, h: "north", "centre"...), `weight` = size pull (Venz is the mega-country), `hint` = terrain preferred for the capital,
 *  `grant` / `deny` = Rights (to / from Estates), `corvee` = per Estate duty, `labels` = the relabelled Estates (two of the four per Country, nations__kb.md). */
export const COUNTRIES = [
  { id: 'family', name: 'Family', color: '#1e5b2e', at: [0.5, 0.1], weight: 1, hint: ['Arctic', 'Hill', 'Jungle'], nation: { id: 'family', name: 'Family', temperament: 0.4, affinity: { 'Shock Infantry': 1.1, Woodcraft: 1.2 } }, pref: pref([0.2, 0.8, 0.5, 0, 0.3]),
    labels: { nobility: 'Nobility', peasants: 'Peasantry (serfs)' }, grant: { Council: ['nobility'], 'Veto.taxLaw': ['nobility'], 'Veto.market': ['nobility'], 'Veto.war': ['nobility'], LegalImmunity: ['nobility'] },
    deny: { MovementAutonomy: ['peasants'], MarriageAutonomy: ['peasants'], Petition: ['peasants'] }, corvee: { peasants: 0.4 }, tax: 0.05 },
  { id: 'alatyr', name: 'Alatyr', color: '#f4f1ea', at: [0.5, 0.9], weight: 1, hint: [], nation: { id: 'gospels', name: 'Gospels', temperament: 0.5, affinity: { Culture: 1.2, Teaching: 1.2 } }, pref: pref([-0.2, 0.5, 0, 0.2, 0.9]),
    labels: { clergy: 'Clergy', peasants: 'Peasantry' }, grant: { Council: ['clergy'], 'Veto.taxLaw': ['clergy'], LegalImmunity: ['clergy'] }, deny: { MarriageAutonomy: ['peasants'] }, corvee: { peasants: 0.15 }, tax: 0.06 },
  { id: 'yuku', name: 'Yuku', color: '#b5651d', at: [0.9, 0.5], weight: 1, hint: ['Desert', 'Jungle', 'Steppe'], nation: { id: 'yukan', name: 'Yukan', temperament: 0.8, affinity: { Cavalry: 1.3 } }, pref: pref([1, 0.2, 1, -0.5, 0.5]),
    labels: { nobility: 'Overlords', peasants: 'Slaves' }, grant: { 'Veto.war': ['nobility'], 'Veto.market': ['nobility'], LegalImmunity: ['nobility'] },
    deny: { MovementAutonomy: ['peasants'], MarriageAutonomy: ['peasants'], Petition: ['peasants'], Lending: ['peasants'] }, corvee: { peasants: 0.6 }, tax: 0.08 },
  { id: 'venz', name: 'Venz', color: '#c0392b', at: [0.5, 0.5], weight: 2.5, hint: [], nation: { id: 'venzs', name: 'Venzs', temperament: 0.5, affinity: { Bureaucrats: 1.1 } }, pref: pref([0.2, 0.4, 0.5, -0.2, 0.5]),
    labels: { nobility: 'Nobility', peasants: 'Peasantry (serfs)' }, grant: { Council: ['nobility'], 'Veto.taxLaw': ['nobility'], 'Veto.market': ['nobility'] }, deny: { MovementAutonomy: ['peasants'] }, corvee: { peasants: 0.2 }, tax: 0.05 },
  { id: 'retlaytiland', name: 'Retlaytiland', color: '#1abc9c', at: [0.08, 0.5], weight: 1, hint: ['Wetland', 'Grassland', 'Jungle'], coastal: true,
    nation: { id: 'retlay', name: 'Retlays', temperament: 0.6, affinity: { 'Trade/Commerce': 1.2, Fishing: 1.2 } }, pref: pref([-0.5, 0, -0.2, -0.2, 0.15]),     // the kb names no Nation for Retlaytiland: 'Retlays' is a placeholder
    labels: { burghers: 'Burghers', peasants: 'Peasantry (free)' }, grant: { Council: ['burghers'], 'Veto.taxLaw': ['burghers'], 'Veto.market': ['burghers'] }, deny: {}, corvee: {}, tax: 0.04 },
]

const ESTATES = {      // four Estates everywhere (alpha scope); population shares sum to 1; every number a placeholder
  peasants: { label: 'Peasantry', populationShare: 0.86, wealthPerCap: 0.5, prefBaseline: { extraction_investment: 0.3, conservatism_reformism: -0.2 },
    labourShare: { Agriculture: 0.4, Mining: 0.04, Woodcraft: 0.04, Fishing: 0.01, 'Crafting/Industry': 0.2, 'Trade/Commerce': 0.02, Medicine: 0.01, Builders: 0.01, Teaching: 0.005, Culture: 0.005, 'Shock Infantry': 0.02, 'Pike Infantry': 0.01, Skirmishers: 0.01 } },
  nobility: { label: 'Nobility', populationShare: 0.04, wealthPerCap: 6, prefBaseline: { extraction_investment: -0.5, conservatism_reformism: -0.6 },
    labourShare: { Bureaucrats: 0.25, Cavalry: 0.15, Diplomacy: 0.05, Espionage: 0.04, Culture: 0.05, Teaching: 0.05 } },
  clergy: { label: 'Clergy', populationShare: 0.04, wealthPerCap: 3, prefBaseline: { conservatism_reformism: -0.4, fervor_secular: 0.5 },
    labourShare: { Culture: 0.25, Teaching: 0.25, Medicine: 0.1, 'Meteomancy/Theurgy': 0.1, Bureaucrats: 0.1, Diplomacy: 0.03 } },
  burghers: { label: 'Burghers', populationShare: 0.06, wealthPerCap: 3, prefBaseline: { extraction_investment: -0.3, homogenizing_pluralist: -0.2 },
    labourShare: { 'Crafting/Industry': 0.3, 'Trade/Commerce': 0.3, Builders: 0.05, Bureaucrats: 0.08, Culture: 0.04, Teaching: 0.04, Medicine: 0.03, Diplomacy: 0.03 } },
}

export const ALPHA = {
  countries: COUNTRIES, playerCountry: 'venz',                                    // the player Country is a placeholder choice
  rivers: { count: 8, minLen: 3 }, passes: { extraPerRange: 1, minRange: 4 }, lanes: { degree: 2, maxDist: 6 }, fortress: { pass: 0.6, river: 0.15 },
  terrainCost: { Grassland: 1, Steppe: 1, Hill: 1.5, Taiga: 1.5, Wetland: 1.8, Jungle: 2, Desert: 2, Arctic: 2.5, Mountain: 3 }, riverFriction: 1.3, overseas: { base: 8, perHex: 2.5 },
  capital: { minSpacing: 4, minArable: 0.3 }, radii: { settled: 4, frontierMult: 2.2 },                       // path-cost radii, scaled by sqrt(Country weight)
  presence: { lambda: 3, ownerBoost: 4, floor: 0.06 }, population: { noise: 0.2, frontier: 0.1, capital: 1.5, maturityFloor: 0.5 },
  ledgerPerCapita: 0.018, stock: { Bread: 0.5, 'Cold Weapons': 0.15 }, cellNoise: 0.1,
  targets: { minProvinces: 10, minOwnedShare: 0.5 }, maxAttempts: 20,
}

/** Law template of one Country: Rights granted to / denied from Estates, Corvée on Estates, the Taxation rate (declaredTurn 0). */
export function lawTemplate(c) {
  const rights = {}, ent = (estate, value) => ({ scope: { kind: 'estate', estate }, value, declaredTurn: 0 })
  for (const [id, es] of Object.entries(c.grant)) rights[id] = es.map(e => ent(e, true))
  for (const [id, es] of Object.entries(c.deny)) rights[id] = [...(rights[id] ?? []), ...es.map(e => ent(e, false))]
  const duties = { Taxation: [{ scope: { kind: 'empire' }, value: { market: c.tax, wealth: 0 }, declaredTurn: 0 }] }
  if (Object.keys(c.corvee).length) duties.Corvee = Object.entries(c.corvee).map(([e, v]) => ent(e, v))
  return { rights, duties, requisitions: [] }
}

export function assembleAlpha(seed = ALPHA_SEED, over = {}) {
  const A = { ...ALPHA, ...over }, T = A.terrain ?? generateTerrain(seed, A.terrainParams ?? {}), world = worldFromTerrain(T), P = world.provinces, { w, h } = world.grid
  const ids = Object.keys(P).sort(byId), isLand = id => P[id].terrain !== 'Sea', land = ids.filter(isLand), nbc = new Map()
  const nb = id => { let r = nbc.get(id); if (!r) { r = neighbors(P[id].x, P[id].y, w, h).map(n => provId(n.x, n.y)); nbc.set(id, r) } return r }
  const edges = new Map(), addEdge = (a, b, type) => { const k = edgeKey(a, b); if (edges.has(k)) return false; edges.set(k, { a: a < b ? a : b, b: a < b ? b : a, type, fortress: false, bridge: false }); return true }
  const etype = (a, b) => edges.get(edgeKey(a, b))?.type, isMt = id => P[id].terrain === 'Mountain'

  // ---- stage 5: rivers on hex EDGES. Elevation = terrain base + distance to water + jitter; a source flows to its lowest neighbour that is not farther from the water, until it meets water.
  const dw = new Map(), q0 = ids.filter(id => !isLand(id)); q0.forEach(id => dw.set(id, 0))
  for (let k = 0; k < q0.length; k++) for (const m of nb(q0[k])) if (!dw.has(m)) { dw.set(m, dw.get(q0[k]) + 1); q0.push(m) }
  const rr = makeRng(`${seed}:rivers`), BASE = { Mountain: 1, Hill: 0.7, Wetland: 0.15, Desert: 0.35, Arctic: 0.4, Taiga: 0.45, Steppe: 0.4, Grassland: 0.3, Jungle: 0.3 }, elev = {}
  for (const id of land) elev[id] = BASE[P[id].terrain] + 0.06 * (dw.get(id) ?? 0) + 0.1 * rr()
  const sources = []
  for (const id of [...land].sort((a, b) => elev[b] - elev[a] || byId(a, b))) { if (sources.length >= A.rivers.count) break
    if ((dw.get(id) ?? 0) >= 3 && sources.every(s => distance(P[s], P[id]) >= 3)) sources.push(id) }
  for (const s of sources) { const seen = new Set([s]), path = [s]; let cur = s
    for (;;) { const cand = nb(cur).filter(q => !seen.has(q)); if (cand.some(q => !isLand(q))) break
      const down = cand.filter(q => dw.get(q) <= dw.get(cur)).sort((a, b) => elev[a] - elev[b] || byId(a, b))[0]; if (!down) break
      seen.add(down); path.push(down); cur = down }
    if (path.length - 1 < A.rivers.minLen) continue
    for (let i = 0; i + 1 < path.length; i++) if (!(isMt(path[i]) && isMt(path[i + 1]))) addEdge(path[i], path[i + 1], 'river') }          // never across a Mountain-Mountain edge (those are blocked unless a pass)

  // ---- stage 7: mountain passes. Mountain-Mountain edges are blocked unless passes: Kruskal over them keeps every landmass connected, plus `extraPerRange` per large range.
  const rp = makeRng(`${seed}:passes`), uf = new Map(land.map(id => [id, id])), find = x => { while (uf.get(x) !== x) { uf.set(x, uf.get(uf.get(x))); x = uf.get(x) } return x }, join = (a, b) => uf.set(find(a), find(b))
  for (const a of land) for (const q of nb(a)) if (isLand(q) && a < q && !(isMt(a) && isMt(q))) join(a, q)
  const mm = []; for (const a of land) if (isMt(a)) for (const q of nb(a)) if (a < q && isMt(q)) mm.push([a, q])
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rp() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]] } return arr }
  for (const [a, q] of shuffle([...mm])) if (find(a) !== find(q)) { join(a, q); addEdge(a, q, 'mountain_pass') }
  const seenM = new Set()
  for (const s of land.filter(isMt)) { if (seenM.has(s)) continue; const comp = [s], st = [s]; seenM.add(s)
    while (st.length) { const c = st.pop(); for (const q of nb(c)) if (isMt(q) && !seenM.has(q)) { seenM.add(q); comp.push(q); st.push(q) } }
    if (comp.length < A.passes.minRange) continue
    const cs = new Set(comp); let n = A.passes.extraPerRange
    for (const [a, q] of shuffle(mm.filter(([a, q]) => cs.has(a) && cs.has(q)))) { if (n <= 0) break; if (addEdge(a, q, 'mountain_pass')) n-- } }

  // ---- stage 8: sea lanes (kb 2026-11-25: they still exist and speed up coastal sea travel): between coastal land provinces on the same sea whose land route is much longer than the sea hop.
  const body = new Map(); let nBody = 0
  for (const id of ids) if (!isLand(id) && P[id].waterBody === 'sea' && !body.has(id)) { const st = [id]; body.set(id, nBody); while (st.length) { const c = st.pop(); for (const q of nb(c)) if (!isLand(q) && P[q].waterBody === 'sea' && !body.has(q)) { body.set(q, nBody); st.push(q) } } nBody++ }
  const coastal = land.filter(id => nb(id).some(q => body.has(q))), bodiesOf = id => new Set(nb(id).filter(q => body.has(q)).map(q => body.get(q)))
  const landDist = src => { const d = new Map([[src, 0]]), q = [src]; for (let k = 0; k < q.length; k++) for (const m of nb(q[k])) if (isLand(m) && !d.has(m)) { d.set(m, d.get(q[k]) + 1); q.push(m) } return d }
  for (const a of coastal) { const ba = bodiesOf(a), ld = landDist(a)
    const cand = coastal.filter(b => b !== a && distance(P[a], P[b]) >= 2 && distance(P[a], P[b]) <= A.lanes.maxDist && [...bodiesOf(b)].some(x => ba.has(x)) && (!ld.has(b) || ld.get(b) > 2 * distance(P[a], P[b]) + 2))
      .sort((x, y) => distance(P[a], P[x]) - distance(P[a], P[y]) || byId(x, y))
    for (const b of cand.slice(0, A.lanes.degree)) addEdge(a, b, 'sea_lane') }

  // ---- stage 10-11: Country capitals, ownership by weighted path cost over LAND (blocked Mountain edges respected), Nations' cores = their Country's capital.
  const C = A.countries, caps = [], arable = id => TERRAIN_RULES[P[id].terrain].arableCeiling
  for (const c of C) { const ax = Math.round(c.at[0] * (w - 1)), ay = Math.round(c.at[1] * (h - 1)); let best = null
    for (const relax of [false, true]) { for (const id of land) { if (!relax && arable(id) < A.capital.minArable) continue; if (caps.some(k => distance(P[id], P[k]) < A.capital.minSpacing)) continue
        const sc = distance(P[id], { x: ax, y: ay }) - (c.hint?.includes(P[id].terrain) ? 1.5 : 0) - (c.coastal && coastal.includes(id) ? 2 : 0); if (!best || sc < best.sc - 1e-9 || (Math.abs(sc - best.sc) <= 1e-9 && id < best.id)) best = { id, sc } }
      if (best) break }
    if (!best) throw new Error('assembleAlpha: no land province for a capital'); caps.push(best.id) }
  const costField = src => { const cost = new Map([[src, 0]]), done = new Set(), open = [src]
    while (open.length) { open.sort((a, b) => cost.get(a) - cost.get(b) || byId(a, b)); const c = open.shift(); if (done.has(c)) continue; done.add(c)
      for (const q of nb(c)) { if (!isLand(q)) continue; const e = etype(c, q); if (isMt(c) && isMt(q) && e !== 'mountain_pass') continue
        const v = cost.get(c) + A.terrainCost[P[q].terrain] * (e === 'river' ? A.riverFriction : 1); if (!cost.has(q) || v < cost.get(q) - 1e-9) { cost.set(q, v); open.push(q) } } }
    return cost }
  const fields = caps.map(costField), eff = (ci, id) => fields[ci].get(id) ?? distance(P[id], P[caps[ci]]) * A.overseas.perHex + A.overseas.base       // another landmass: straight distance + a sea penalty
  const settledR = ci => A.radii.settled * Math.sqrt(C[ci].weight), frontierR = ci => settledR(ci) * A.radii.frontierMult, ownerIdx = {}
  for (const id of land) { let best = -1, bs = Infinity
    for (let ci = 0; ci < C.length; ci++) { const e = eff(ci, id); if (e > frontierR(ci)) continue; const s = e / C[ci].weight; if (s < bs - 1e-9) { bs = s; best = ci } }
    ownerIdx[id] = best }

  // ---- stage 12: habitability and starting population (kb 2026-11-10 anchors); Settled within the settled radius, Frontier in the ring, the rest unowned Wasteland.
  const rpop = makeRng(`${seed}:population`), P0 = A.population, rivers = new Set([...edges.values()].filter(e => e.type === 'river').flatMap(e => [e.a, e.b]))
  for (const id of land) { const p = P[id], ci = ownerIdx[id], n = 1 + P0.noise * (2 * rpop() - 1), isCap = caps.includes(id); if (rivers.has(id)) p.waterSource = 'river_adjacent'
    if (ci < 0) continue
    const e = eff(ci, id), settled = e <= settledR(ci) || isCap, cap = p.maxPopulationDensity * p.maxArea, anchor = T.provinces[id].anchor
    p.owner = C[ci].id; p.habitability = settled ? 'Settled' : 'Claimed/Frontier'
    p.population = Math.round(Math.min(cap, isCap ? anchor * P0.capital : settled ? anchor * clamp(1 - 0.5 * e / settledR(ci), P0.maturityFloor, 1) * n : anchor * P0.frontier * n))
    Object.assign(p, settled ? { urbanization: isCap ? 0.3 : 0.1, sanitation: isCap ? 0.6 : 0.5, infrastructureLevel: isCap ? 50 : 30, tradeInfrastructureLevel: isCap ? 60 : 40 } : { urbanization: 0.02, sanitation: 0.3, infrastructureLevel: 10, tradeInfrastructureLevel: 10 }) }

  // ---- stage 13: fortresses on chokepoint edges only: passes at a border, river crossings between two different owners.
  const rf = makeRng(`${seed}:fortress`), border = id => nb(id).some(q => isLand(q) && P[q].owner !== P[id].owner)
  for (const k of [...edges.keys()].sort()) { const e = edges.get(k), r = rf()
    if (e.type === 'mountain_pass' && (border(e.a) || border(e.b)) && r < A.fortress.pass) e.fortress = true
    if (e.type === 'river' && P[e.a].owner && P[e.b].owner && P[e.a].owner !== P[e.b].owner && r < A.fortress.river) e.fortress = true }
  world.edges = [...edges.keys()].sort().map(k => edges.get(k))

  // ---- stage 10 (presence): share of Nation n in a province ~ exp(-cost / (lambda sqrt(weight))), the owner's titular Nation boosted; small shares are dropped (the floor), the rest rounded to the population.
  const presence = {}, nations = {}
  for (const c of C) nations[c.nation.id] = { name: c.nation.name, color: c.color, reactionTemperament: c.nation.temperament, poolAffinity: { ...c.nation.affinity }, prefTraits: { ...c.pref } }
  for (const id of ids) { presence[id] = {}; const p = P[id]; if (!isLand(id) || p.population < 1) continue
    let sh = C.map((c, ci) => Math.exp(-eff(ci, id) / (A.presence.lambda * Math.sqrt(c.weight))) * (p.owner === c.id ? A.presence.ownerBoost : 1)); let tot = sum(sh); sh = sh.map(x => x / tot)
    sh = sh.map(x => (x < A.presence.floor ? 0 : x)); tot = sum(sh); sh = sh.map(x => x / tot)
    const raw = sh.map(x => x * p.population), fl = raw.map(Math.floor); let rest = p.population - sum(fl)
    for (const i of raw.map((x, i) => [x - fl[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(x => x[1])) { if (rest <= 0) break; if (sh[i] > 0) { fl[i]++; rest-- } }
    C.forEach((c, ci) => { if (fl[ci] > 0) presence[id][c.nation.id] = fl[ci] }) }

  // ---- documents
  const countries = Object.fromEntries(C.map(c => [c.id, { name: c.name, color: c.color, titularNations: [c.nation.id], isPlayer: c.id === A.playerCountry, aiProfile: c.id === A.playerCountry ? null : 'default' }]))
  const warehouses = Object.fromEntries(land.map(id => [id, { capacity: null, stock: Object.fromEntries(Object.entries(A.stock).map(([g, k]) => [g, Math.round(P[id].population * k)]).filter(([, v]) => v > 0)) }]))
  world.warehouses = warehouses
  const popOf = cid => sum(land.filter(id => P[id].owner === cid).map(id => P[id].population))
  const polity = { estates: structuredClone(ESTATES), lawTemplates: Object.fromEntries(C.map(c => [c.id, lawTemplate(c)])), countryLaws: Object.fromEntries(C.map(c => [c.id, { template: c.id, overrides: { estateLabels: { ...c.labels } } }])), cells: {},
    governments: Object.fromEntries(C.map(c => [c.id, { ledger: Math.max(100, Math.round(popOf(c.id) * A.ledgerPerCapita)), commitBureaucrats: 1 }])) }
  const docs = { manifest: { schemaVersion: 1, id: 'alpha', name: 'Alpha — five Countries', description: `Generated alpha world (seed ${seed}); worldgen__spec.md stages 1-14, placeholder numbers`, seed },
    world, nations: { nations, presence }, countries: { countries }, polity, relations: { claims: [], treaties: [], confederations: [] }, scenario: { startTurn: 0, playerCountry: A.playerCountry, options: { fogOfWar: false } } }
  docs.polity.cells = seedCells(docs, { noise: A.cellNoise, seed })[0].value                                      // stage 14: the same generator the Editor uses (sums hold by construction)

  // ---- stage 15 (the part that exists): report and constraints
  const owned = land.filter(id => P[id].owner), perCountry = Object.fromEntries(C.map((c, ci) => { const mine = land.filter(id => P[id].owner === c.id)
    return [c.id, { capital: caps[ci], provinces: mine.length, population: popOf(c.id), settled: mine.filter(id => P[id].habitability === 'Settled').length, terrain: Object.fromEntries([...new Set(mine.map(id => P[id].terrain))].sort().map(t => [t, mine.filter(id => P[id].terrain === t).length])) }] }))
  const kinds = t => world.edges.filter(e => e.type === t).length, fails = []
  for (const [id, r] of Object.entries(perCountry)) if (r.provinces < A.targets.minProvinces) fails.push(`${id} owns ${r.provinces} provinces (< ${A.targets.minProvinces})`)
  if (owned.length < A.targets.minOwnedShare * land.length) fails.push(`only ${owned.length} of ${land.length} land provinces are owned`)
  const report = { seed, land: land.length, owned: owned.length, population: sum(owned.map(id => P[id].population)), countries: perCountry, edges: { river: kinds('river'), mountain_pass: kinds('mountain_pass'), sea_lane: kinds('sea_lane'), fortress: world.edges.filter(e => e.fortress).length },
    cells: Object.keys(docs.polity.cells).length, pass: fails.length === 0, fails }
  return { docs, report }
}

/** Rejection loop (stage 15): seed, seed + 1, ... until the constraints pass; the best attempt (most provinces for the smallest Country) is returned with `failed` when none does. */
export function assembleAlphaChecked(seed = ALPHA_SEED, over = {}) {
  const max = over.maxAttempts ?? ALPHA.maxAttempts; let best = null
  for (let i = 0; i < max; i++) { const r = assembleAlpha(seed + i, over), small = Math.min(...Object.values(r.report.countries).map(c => c.provinces))
    if (r.report.pass) return { ...r, seedUsed: seed + i, attempt: i, failed: false }
    if (!best || small > best.small) best = { ...r, small, seedUsed: seed + i, attempt: i } }
  return { ...best, failed: true }
}
