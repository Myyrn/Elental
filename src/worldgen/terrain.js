// worldgen/terrain.js — slice 3c, stages 1-4 of worldgen__spec.md at the 10-terrain model (Sea incl. lakes).
// Pure and deterministic: (seed, params) -> {provinces}. Every hex of the grid is a province, water included.
// Stages: raw fields (157x114) -> land/sea mask -> terrain classification -> hex sampling (majority vote) -> water bodies -> forestation -> water source -> anchors.
// Rivers, passes, sea lanes, Nations, Countries, fortresses and cell seeding are later stages (not here).
import { neighbors, provId } from '../modules/worldmap/hex.js'

export const TERRAINS = ['Mountain', 'Hill', 'Desert', 'Steppe', 'Grassland', 'Wetland', 'Jungle', 'Arctic', 'Taiga', 'Sea']

// All numbers are placeholders (worldgen__spec.md: ruleset.worldgen.*, status placeholder).
export const DEFAULTS = {
  grid: { w: 25, h: 20, rawW: 157, rawH: 114 },
  landFraction: 0.5, minLandCells: 40, minLakeCells: 8,
  lakeMaxHexes: 3, lakes: { count: 6, maxSize: 3 },                 // a water body of at most this many hexes that does not touch the grid edge is a lake
  noise: { octaves: 4, frequency: 3, persistence: 0.5, continents: 6, coastBonus: 0.3, latGradient: 0.8, lapse: 0.55 },
  terrainRules: { T_mountain: 0.7, T_hill: 0.52, T_arctic: 0.24, T_taiga: 0.42, M_taiga: 0.35, M_desert: 0.36, T_desertMin: 0.5,
                  M_steppe: 0.42, M_jungle: 0.7, T_jungle: 0.6, M_wet: 0.68, T_lowland: 0.5 },
  // forestation ceilings from the kb table (percent); Grassland 10-70 is flagged open in the kb
  forest: { Desert: [0, 10], Arctic: [0, 15], Steppe: [0, 40], Mountain: [0, 40], Taiga: [50, 90], Wetland: [20, 70], Hill: [10, 70], Grassland: [10, 70], Jungle: [60, 100], Sea: [0, 0] },
  // numeric stand-ins for the kb's qualitative density ceilings (very low ... high); only used to interpolate the starting anchors
  densityCeiling: { Desert: 0.5, Arctic: 0.5, Steppe: 3, Mountain: 2, Taiga: 2, Wetland: 5, Hill: 4, Grassland: 8, Jungle: 3, Sea: 0 },
  anchors: { Grassland: 10000, low: 1000, floor: 250 },   // kb 2026-11-10: Grassland ~10,000; Taiga and Mountain ~1,000; others scaled by the density ceiling
  coastFraction: 0.001,
}

const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
const seedFrom = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
export const makeRng = s => mulberry(seedFrom(s))
const smooth = t => t * t * (3 - 2 * t)

function valueNoise(rng, gw, gh) {                       // lattice of random values, bilinear + smoothstep
  const lat = Float32Array.from({ length: gw * gh }, () => rng())
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi)
    const g = (i, j) => lat[(((j % gh) + gh) % gh) * gw + (((i % gw) + gw) % gw)]
    return (g(xi, yi) * (1 - fx) + g(xi + 1, yi) * fx) * (1 - fy) + (g(xi, yi + 1) * (1 - fx) + g(xi + 1, yi + 1) * fx) * fy }
}
function normalize(a) { let lo = Infinity, hi = -Infinity; for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v } for (let i = 0; i < a.length; i++) a[i] = (a[i] - lo) / (hi - lo || 1); return a }
const quantile = (a, q) => { const s = Float32Array.from(a).sort(); return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))] }

/** Stage 1: raw fields on the rawW x rawH grid. */
export function rawFields(seed, P) {
  const { rawW: W, rawH: H } = P.grid, n = P.noise
  const rng = makeRng(`${seed}:raw`), height = new Float32Array(W * H), moist = new Float32Array(W * H), temp = new Float32Array(W * H)
  const layers = Array.from({ length: n.octaves }, () => valueNoise(rng, 64, 64)), mLayers = Array.from({ length: n.octaves }, () => valueNoise(rng, 64, 64))
  const cols = 3, rows = Math.ceil(n.continents / cols)   // stratified centres so land spreads over the grid
  const blobs = Array.from({ length: n.continents }, (_, i) => ({ x: ((i % cols) + 0.2 + 0.6 * rng()) / cols * W, y: ((Math.floor(i / cols)) + 0.2 + 0.6 * rng()) / rows * H, r: (0.11 + 0.08 * rng()) * W }))
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let h = 0, m = 0, amp = 1, f = n.frequency / W
    for (let o = 0; o < n.octaves; o++) { h += amp * layers[o](x * f * 2 ** o * 10, y * f * 2 ** o * 10 * (W / H)); m += amp * mLayers[o](x * f * 2 ** o * 10, y * f * 2 ** o * 10 * (W / H)); amp *= n.persistence }
    let mask = 0; for (const b of blobs) { const d = Math.hypot(x - b.x, (y - b.y) * 1.2); mask = Math.max(mask, 1 - smooth(Math.min(1, Math.max(0, (d - b.r * 0.5) / (b.r * 1.1))))) }
    height[y * W + x] = h * (0.35 + 0.65 * mask) + mask * 0.5; moist[y * W + x] = m
  }
  normalize(height); normalize(moist)
  return { height, moist, temp, W, H }
}

/** Stages 2-3: land/sea mask by quantile, temperature from latitude and altitude, terrain by the rule table (first match wins). */
export function classifyRaw(F, P) {
  const { W, H, height, moist, temp } = F, seaLevel = quantile(height, 1 - P.landFraction), R = P.terrainRules, n = P.noise
  const isWater = new Uint8Array(W * H), terr = new Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, lat = Math.abs(y / (H - 1) - 0.5) * 2
    isWater[i] = height[i] <= seaLevel ? 1 : 0
    temp[i] = Math.min(1, Math.max(0, 1 - lat * n.latGradient - n.lapse * Math.max(0, height[i] - seaLevel)))
  }
  // moisture gets a coast bonus (distance to water, 6 cells)
  const near = new Float32Array(W * H).fill(99); const q = []; for (let i = 0; i < W * H; i++) if (isWater[i]) { near[i] = 0; q.push(i) }
  for (let k = 0; k < q.length; k++) { const i = q[k], x = i % W, y = (i / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (near[j] > near[i] + 1) { near[j] = near[i] + 1; q.push(j) } } }
  for (let i = 0; i < W * H; i++) {
    if (isWater[i]) { terr[i] = 'Sea'; continue }
    const h = (height[i] - seaLevel) / (1 - seaLevel), m = Math.min(1, moist[i] + n.coastBonus * Math.max(0, 1 - near[i] / 6)), t = temp[i]
    terr[i] = h > R.T_mountain ? 'Mountain' : h > R.T_hill ? 'Hill' : t < R.T_arctic ? 'Arctic' : (t < R.T_taiga && m >= R.M_taiga) ? 'Taiga'
      : (m < R.M_desert && t >= R.T_desertMin) ? 'Desert' : m < R.M_steppe ? 'Steppe' : (m > R.M_jungle && t > R.T_jungle) ? 'Jungle'
      : (m > R.M_wet && h < R.T_lowland) ? 'Wetland' : 'Grassland'
  }
  return { terr, isWater, seaLevel }
}

/** Stage 4: hex sampling. Each raw cell votes for the nearest hex centre (pointy-top odd-r); majority terrain wins, ties go to the cell nearest the centre. */
export function sampleHexes(R, P) {
  const { w, h } = P.grid, { W, H } = { W: P.grid.rawW, H: P.grid.rawH }, votes = Array.from({ length: w * h }, () => ({})), nearest = new Array(w * h).fill(null)
  const cx = x => (x + 0.5) / W * (w + 0.5), cy = y => (y + 0.5) / H * (h * 0.866 + 0.134)    // raw cell -> hex space (x in hex widths, y in rows * 0.866)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px = cx(x), py = cy(y); let best = -1, bd = Infinity
    const r0 = Math.round((py - 0.5) / 0.866)
    for (let r = Math.max(0, r0 - 1); r <= Math.min(h - 1, r0 + 1); r++) { const c0 = Math.round(px - 0.5 - 0.5 * (r & 1)); for (let c = Math.max(0, c0 - 1); c <= Math.min(w - 1, c0 + 1); c++) {
      const hx = c + 0.5 + 0.5 * (r & 1), hy = 0.5 + r * 0.866, d = (px - hx) ** 2 + (py - hy) ** 2; if (d < bd) { bd = d; best = r * w + c } } }
    const t = R.terr[y * W + x], v = votes[best]; v[t] = (v[t] ?? 0) + 1
    if (!nearest[best] || bd < nearest[best].d) nearest[best] = { d: bd, t }
  }
  return votes.map((v, i) => { let top = null, tv = -1, tie = false; for (const t of TERRAINS) { const c = v[t] ?? 0; if (c > tv) { tv = c; top = t; tie = false } else if (c === tv && c > 0) tie = true }
    return tie ? (nearest[i]?.t ?? top) : top })
}

/** Stage 4b-12 (subset): water bodies, forestation, water source, habitability and starting population for every hex. */
export function buildProvinces(seed, hexTerrain, P) {
  const { w, h } = P.grid, rng = makeRng(`${seed}:provinces`), at = (x, y) => y * w + x, terr = hexTerrain.slice()
  // lake carving (a design choice, spec decision): a few small inland basins, >= 2 hexes from any Sea hex
  const dist = c => { const cx = c % w, cy = (c / w) | 0; let best = 9; for (let r = 1; r <= 2; r++) { for (let yy = cy - r; yy <= cy + r; yy++) for (let xx = cx - r; xx <= cx + r; xx++) if (xx >= 0 && yy >= 0 && xx < w && yy < h && terr[at(xx, yy)] === 'Sea') best = Math.min(best, r) } return best }
  for (let k = 0, tries = 0; k < P.lakes.count && tries < 400; tries++) { const c = Math.floor(rng() * w * h), cx = c % w, cy = (c / w) | 0
    if (terr[c] === 'Sea' || terr[c] === 'Mountain' || cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1 || dist(c) < 3 && dist(c) !== 9) continue
    if (dist(c) <= 2) continue
    const size = 1 + Math.floor(rng() * P.lakes.maxSize), cells = [c]; terr[c] = 'Sea'
    while (cells.length < size) { const from = cells[Math.floor(rng() * cells.length)], nb = neighbors(from % w, (from / w) | 0, w, h).map(n => at(n.x, n.y)).filter(j => terr[j] !== 'Sea' && dist(j) > 2 && terr[j] !== 'Mountain'); if (!nb.length) break; const j = nb[Math.floor(rng() * nb.length)]; terr[j] = 'Sea'; cells.push(j) }
    k++ }
  // water bodies: connected Sea hexes; a body of <= lakeMaxHexes hexes that does not touch the grid edge is a lake (fresh water)
  const body = new Array(w * h).fill(-1), bodies = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (terr[at(x, y)] !== 'Sea' || body[at(x, y)] >= 0) continue
    const id = bodies.length, cells = [at(x, y)]; body[at(x, y)] = id; let edge = false
    for (let k = 0; k < cells.length; k++) { const c = cells[k], cx = c % w, cy = (c / w) | 0; if (cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1) edge = true
      for (const n of neighbors(cx, cy, w, h)) { const j = at(n.x, n.y); if (terr[j] === 'Sea' && body[j] < 0) { body[j] = id; cells.push(j) } } }
    bodies.push({ cells, edge, kind: !edge && cells.length <= P.lakeMaxHexes ? 'lake' : 'sea' }) }
  const provinces = {}, D = P.densityCeiling, A = P.anchors
  const anchor = t => t === 'Sea' ? 0 : Math.round(Math.max(A.floor, A.low + (A.Grassland - A.low) * (D[t] - D.Taiga) / (D.Grassland - D.Taiga)))
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = at(x, y), t = terr[i], water = t === 'Sea', nb = neighbors(x, y, w, h).map(n => at(n.x, n.y))
    const [fmin, fmax] = P.forest[t], forestation = water ? 0 : Math.round(fmin + (fmax - fmin) * rng())
    // water source (kb, river first): lake shore counts as river_adjacent; touching a Sea-body province = coastal; (river edges are a later stage)
    const lakeNear = nb.some(j => terr[j] === 'Sea' && bodies[body[j]].kind === 'lake'), seaNear = nb.some(j => terr[j] === 'Sea' && bodies[body[j]].kind === 'sea')
    const waterSource = water ? 'none' : lakeNear ? 'river_adjacent' : seaNear ? 'coastal' : 'none'
    provinces[provId(x, y)] = { x, y, terrain: t, ...(water ? { waterBody: bodies[body[i]].kind } : {}), forestation, waterSource,
      habitability: 'Wasteland', population: 0, anchor: anchor(t), provenance: 'generated' }
  }
  return { provinces, bodies: bodies.map(b => ({ kind: b.kind, size: b.cells.length, edge: b.edge })) }
}

/** The whole terrain slice. Habitability and population are NOT set here (they need Countries: stage 11-12); `anchor` is the seed a Settled province will get. */
export function generateTerrain(seed = 20261125, over = {}) {
  const P = { ...DEFAULTS, ...over, grid: { ...DEFAULTS.grid, ...(over.grid ?? {}) } }
  const F = rawFields(seed, P), R = classifyRaw(F, P), hexT = sampleHexes(R, P)
  return { params: P, ...buildProvinces(seed, hexT, P) }
}

/** Metrics for the balance report (stage 15, the subset that exists). */
export function terrainReport(T) {
  const { w, h } = T.params.grid, ps = Object.values(T.provinces), share = {}
  for (const t of TERRAINS) share[t] = 0; for (const p of ps) share[p.terrain]++
  const land = ps.filter(p => p.terrain !== 'Sea'), key = (x, y) => provId(x, y), seen = new Set(); let comps = []
  for (const p of land) { const k = key(p.x, p.y); if (seen.has(k)) continue; let n = 0; const q = [p]; seen.add(k)
    while (q.length) { const c = q.pop(); n++; for (const nb of neighbors(c.x, c.y, w, h)) { const nk = key(nb.x, nb.y), np = T.provinces[nk]; if (np.terrain !== 'Sea' && !seen.has(nk)) { seen.add(nk); q.push(np) } } }
    comps.push(n) }
  comps.sort((a, b) => b - a)
  return { provinces: ps.length, land: land.length, landFraction: land.length / ps.length, share, landmasses: comps, lakes: T.bodies.filter(b => b.kind === 'lake').length, seas: T.bodies.filter(b => b.kind === 'sea').length,
    isolatedLand: comps.filter(c => c < 3).length }
}
