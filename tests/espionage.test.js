// Espionage, foreign propaganda, covert influence, detection (diplomacy__kb): fixed thresholds scaled by the target Region's population, binary, no refund; detection = Observation + counter-intelligence.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readPackage } from '../src/data/loaders/readPackage.js'
import { EngineClient } from '../src/client/engineClient.js'
import { makeCtx } from '../src/engine/engine.js'
import { resolveCovert, detect, opThreshold, targetScale, observationAt, counterIntel, detectionStrength, espionageFree, espionageTotal } from '../src/modules/diplomacy/covert.js'
import { activeCBs, reputation } from '../src/modules/diplomacy/readouts.js'
import { effectivePref } from '../src/modules/polity/cellstate.js'
const readJson = async path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)))
const boot = async () => { const c = new EngineClient(); await c.init(await readPackage(readJson, 'scenarios/demo'), await readJson('data/ruleset.json')); return c }
const X = c => makeCtx(c.state, c.ruleset, { modules: c.modules, registry: c.registry, start: c.state })
const V = { kind: 'government', country: 'vantiria' }, K = { kind: 'government', country: 'kerinia' }
const tune = (c, k, v) => { c.ruleset.tuning[k] = { value: v, status: 'placeholder' } }
const regionOf = (c, country) => Object.values(c.state.polity.cells).find(x => X(c).derive.worldmap.regionOwner(x.region) === country).region
const cellsOf = (c, region) => Object.values(c.state.polity.cells).filter(x => x.region === region)
const covert = (c, id, actor, p) => c.state.commitments.push({ id, actor, type: 'covert', claims: [], since: 0, renew: true, params: p })
const intel = (c, id, country, region, labour) => c.state.commitments.push({ id, actor: { kind: 'government', country }, type: 'counterIntel', claims: [], since: 0, renew: true, params: { region, labour } })
const last = c => c.state.diplomacy.covert.at(-1)
async function setup() { const c = await boot(); tune(c, 'obs.defaultSpread', 0); const region = regionOf(c, 'kerinia'); return { c, region, th: kind => opThreshold(X(c), { kind: kind ?? 'propaganda', tier: 'overt', region }) } }

test('the demo now carries Espionage labour, and the free pool is the labour not yet committed to operations or counter-intelligence', async () => {
  const c = await boot(), x = X(c); assert.ok(espionageTotal(x, 'vantiria') > 20, `Espionage labour ${espionageTotal(x, 'vantiria')}`); assert.equal(espionageFree(x, 'vantiria'), espionageTotal(x, 'vantiria'))
  intel(c, 'ci1', 'vantiria', regionOf(c, 'vantiria'), 10); assert.equal(espionageFree(X(c), 'vantiria'), espionageTotal(X(c), 'vantiria') - 10)
})
test('threshold: binary, no refund, no benefit beyond it; scaled by the TARGET Region\'s population and never by the opponent\'s size', async () => {
  const { c, region } = await setup(), p = { kind: 'propaganda', tier: 'overt', target: 'kerinia', region }, th = opThreshold(X(c), p)
  assert.ok(Math.abs(th - 4 * targetScale(X(c), region)) < 1e-9, 'base(overt) x population(region)')
  const prefOf = () => cellsOf(c, region).map(x => effectivePref(x, 'extraction_investment'))
  const pre = prefOf(); covert(c, 'c1', V, { ...p, labour: th * 0.9 }); resolveCovert(X(c)); assert.deepEqual(prefOf(), pre, 'below threshold nothing happens'); assert.equal(last(c).met, false); assert.equal(last(c).reason, 'below threshold')
  c.state.commitments = []; const a = await boot(); tune(a, 'obs.defaultSpread', 0); const b = await boot(); tune(b, 'obs.defaultSpread', 0)
  covert(a, 'c1', V, { ...p, labour: th }); resolveCovert(X(a)); covert(b, 'c1', V, { ...p, labour: th * 3 }); resolveCovert(X(b))
  assert.deepEqual(cellsOf(a, region).map(x => effectivePref(x, 'conservatism_reformism')), cellsOf(b, region).map(x => effectivePref(x, 'conservatism_reformism')), 'investing beyond the threshold buys nothing more'); assert.equal(last(a).met, true)
  const o = await boot(); const th0 = opThreshold(X(o), p); for (const arm of Object.values(o.state.war.armies)) arm.owner = 'kerinia'; o.state.countries.kerinia.titularNations = ['x', 'y', 'z']; for (const q of Object.values(o.state.polity.cells)) if (q.region !== region) q.population *= 10
  assert.equal(opThreshold(X(o), p), th0, 'unchanged by the opponent\'s armies, size or other Regions')
  const d = await boot(); for (const pr of X(d).derive.worldmap.regionProvinces(region)) d.state.world.provinces[pr].population *= 2; assert.ok(Math.abs(opThreshold(X(d), p) - 2 * th0) < 1e-9, 'scales with the Region\'s own population')
})
test('overt propaganda exports the sender\'s Portrait into the target Region\'s cells, is open (no CB, sender known); covert pushes any point', async () => {
  const { c, region, th } = await setup(), p = { kind: 'propaganda', tier: 'overt', target: 'kerinia', region }; for (const x of Object.values(c.state.polity.cells)) if (x.region === region) x.pref = { ...x.pref, extraction_investment: -0.9 }
  for (const x of Object.values(c.state.polity.cells)) if (c.ruleset && X(c).derive.worldmap.regionOwner(x.region) === 'vantiria') x.pref = { ...x.pref, extraction_investment: 0.8 }
  const before = cellsOf(c, region).map(x => effectivePref(x, 'extraction_investment')); covert(c, 'c1', V, { ...p, labour: th() }); resolveCovert(X(c))
  cellsOf(c, region).forEach((x, i) => assert.ok(effectivePref(x, 'extraction_investment') > before[i], 'moved toward the sender\'s amalgam')); assert.equal(last(c).detection, 'senderRevealed'); assert.equal(activeCBs(X(c), 'kerinia', 'vantiria').filter(b => b.class === 'event').length, 0, 'open propaganda grants no CB')
  const c2 = (await setup()).c; covert(c2, 'c2', V, { kind: 'propaganda', tier: 'covert', target: 'kerinia', region, ideal: { fervor_secular: 1 }, labour: opThreshold(X(c2), { kind: 'propaganda', tier: 'covert', region }), concealment: 'low' }); const f0 = cellsOf(c2, region).map(x => effectivePref(x, 'fervor_secular')); resolveCovert(X(c2))
  cellsOf(c2, region).forEach((x, i) => assert.ok(effectivePref(x, 'fervor_secular') >= f0[i])); assert.ok(cellsOf(c2, region).some((x, i) => effectivePref(x, 'fervor_secular') > f0[i]))
})
test('covert influence writes Opinion (target-agnostic) and injects Grievance into that Region only', async () => {
  const { c, region } = await setup(), other = regionOf(c, 'vantiria'), p = { kind: 'influence', tier: 'covert', concealment: 'low', target: 'kerinia', region, opinion: -1, grievanceNeed: 'fairness' }
  const g0 = cellsOf(c, region).map(x => x.grievance.fairness ?? 0), n0 = cellsOf(c, other).map(x => x.opinionGovMods.length); covert(c, 'c1', V, { ...p, labour: opThreshold(X(c), p) }); resolveCovert(X(c))
  cellsOf(c, region).forEach((x, i) => { assert.ok((x.grievance.fairness ?? 0) > g0[i]); assert.ok(x.opinionGovMods.some(m => m.id.startsWith('infl.') && m.value < 0)) }); assert.deepEqual(cellsOf(c, other).map(x => x.opinionGovMods.length), n0, 'no other Region touched')
})
test('detection = Observation + counter-intelligence (additive); act detected at the concealment threshold, sender revealed only at the higher one', async () => {
  const { c, region } = await setup(), p = { kind: 'influence', tier: 'covert', concealment: 'medium', target: 'kerinia', region, grievanceNeed: 'fairness' }, s = () => targetScale(X(c), region)
  const op = { id: 'op', sender: 'vantiria', apparentSender: 'vantiria', target: 'kerinia', region, kind: 'influence', concealment: 'medium', falseFlag: false }
  assert.equal(detectionStrength(X(c), 'kerinia', region), 0); assert.equal(detect(X(c), op).tier, 'undetected')
  intel(c, 'ci', 'kerinia', region, 5 * s() - 0.01); assert.equal(detect(X(c), op).tier, 'undetected', 'just under the act threshold'); c.state.commitments.pop(); intel(c, 'ci', 'kerinia', region, 5 * s()); assert.equal(detect(X(c), op).tier, 'actDetected')
  c.state.commitments.pop(); intel(c, 'ci', 'kerinia', region, 9 * s()); assert.deepEqual(detect(X(c), op), { tier: 'senderRevealed', sender: 'vantiria', falseFlagExposed: false })
  // additive: half from Observation, half from counter-intel
  c.state.commitments.pop(); tune(c, 'obs.defaultSpread', 1); const obs = observationAt(X(c), 'kerinia', region); assert.ok(obs > 0); const need = 9 * s(); intel(c, 'ci', 'kerinia', region, Math.max(0, need - obs) + 1e-6)
  assert.ok(Math.abs(detectionStrength(X(c), 'kerinia', region) - (obs + counterIntel(X(c), 'kerinia', region))) < 1e-9); assert.equal(detect(X(c), op).tier, 'senderRevealed', 'Observation and counter-intel stack')
  assert.equal(detect(X(c), { ...op, concealment: 'overt' }).open, true)
})
test('revealing the sender gives the victim a CB (Rights for influence, Grievance for propaganda) and costs the sender Reputational Leverage; a merely detected act names nobody', async () => {
  const { c, region } = await setup(), s = targetScale(X(c), region), p = { kind: 'influence', tier: 'covert', concealment: 'low', target: 'kerinia', region, grievanceNeed: 'fairness', labour: 0 }; p.labour = opThreshold(X(c), p)
  intel(c, 'ci', 'kerinia', region, 2 * s); covert(c, 'c1', V, p); resolveCovert(X(c)); assert.equal(last(c).detection, 'actDetected'); assert.equal(activeCBs(X(c), 'kerinia', 'vantiria').filter(b => b.class === 'event').length, 0); assert.equal(last(c).revealed, null)
  c.state.commitments = []; intel(c, 'ci', 'kerinia', region, 4 * s); covert(c, 'c1', V, p); resolveCovert(X(c)); assert.equal(last(c).detection, 'senderRevealed')
  const cb = activeCBs(X(c), 'kerinia', 'vantiria').find(b => b.reason === 'covert-influence'); assert.ok(cb && cb.tier === 'Rights'); assert.ok(reputation(X(c), 'kerinia', 'vantiria') < 0)
  const q = await setup(), pp = { kind: 'propaganda', tier: 'covert', concealment: 'low', target: 'kerinia', region: q.region, labour: opThreshold(X(q.c), { kind: 'propaganda', tier: 'covert', region: q.region }) }
  intel(q.c, 'ci', 'kerinia', q.region, 4 * targetScale(X(q.c), q.region)); covert(q.c, 'c1', V, pp); resolveCovert(X(q.c)); assert.equal(activeCBs(X(q.c), 'kerinia', 'vantiria').find(b => b.reason === 'covert-influence').tier, 'Grievance')
})
test('false flag: the blame lands on the apparent sender until detection reaches the false-flag threshold; seeing through it exposes the TRUE sender (Reputation + CB)', async () => {
  const { c, region } = await setup(); c.state.countries.dorn = { name: 'dorn', color: '#999', titularNations: ['d'], isPlayer: true }; c.state.admin.governments.dorn = structuredClone(c.state.admin.governments.vantiria)
  const s = targetScale(X(c), region), p = { kind: 'influence', tier: 'covert', concealment: 'low', target: 'kerinia', region, grievanceNeed: 'fairness', falseFlag: 'dorn' }; p.labour = opThreshold(X(c), p)
  assert.ok(p.labour > opThreshold(X(c), { ...p, falseFlag: undefined }), 'a false flag costs an extra Espionage threshold')
  intel(c, 'ci', 'kerinia', region, 4 * s); covert(c, 'c1', V, p); resolveCovert(X(c)); assert.equal(last(c).revealed, 'dorn'); assert.ok(activeCBs(X(c), 'kerinia', 'dorn').some(b => b.reason === 'covert-influence'), 'the innocent apparent sender is blamed'); assert.ok(!activeCBs(X(c), 'kerinia', 'vantiria').some(b => b.class === 'event'))
  c.state.commitments = []; c.state.diplomacy.cbs = []; intel(c, 'ci', 'kerinia', region, 20 * s); covert(c, 'c1', V, p); resolveCovert(X(c)); assert.equal(last(c).revealed, 'vantiria'); assert.equal(last(c).falseFlagExposed, true)
  assert.ok(activeCBs(X(c), 'kerinia', 'vantiria').some(b => b.reason === 'false-flag-exposed' && b.tier === 'Rights')); assert.ok(reputation(X(c), 'kerinia', 'vantiria') < -1)
})
test('actions: zero-sum Espionage labour, own-Region counter-intelligence, validation, lift; ops run each turn through the engine; Observation dial reallocates detection', async () => {
  const c = await boot(), region = regionOf(c, 'kerinia'), mine = regionOf(c, 'vantiria'), free = espionageFree(X(c), 'vantiria'), th = opThreshold(X(c), { kind: 'propaganda', tier: 'overt', region })
  const sub = async o => { await c.submit(o); return (await c.endTurn()).report }
  let r = await sub({ actor: V, type: 'foreignPropaganda', params: { target: 'kerinia', region: mine, tier: 'overt', labour: th } }); assert.match(r.rejected[0].reasons[0], /must belong to the target/)
  r = await sub({ actor: V, type: 'foreignPropaganda', params: { target: 'kerinia', region, tier: 'overt', labour: free + 5 } }); assert.match(r.rejected[0].reasons[0], /free Espionage labour/)
  r = await sub({ actor: V, type: 'foreignPropaganda', params: { target: 'kerinia', region, tier: 'overt', falseFlag: 'kerinia', labour: th } }); assert.equal(r.rejected.length, 1)
  r = await sub({ actor: V, type: 'foreignPropaganda', params: { target: 'kerinia', region, tier: 'overt', labour: Math.ceil(th) } }); assert.equal(r.rejected.length, 0); assert.ok(c.state.diplomacy.covert.some(o => o.met && o.kind === 'propaganda'))
  const n = c.state.diplomacy.covert.length; await c.endTurn(); assert.ok(c.state.diplomacy.covert.length > n, 'standing commitments run every turn')
  r = await sub({ actor: V, type: 'counterIntelligence', params: { region: mine, labour: espionageFree(X(c), 'vantiria') + 1 } }); assert.equal(r.rejected.length, 1, 'counter-intel draws on the same pool (zero-sum)')
  await c.submit({ actor: V, type: 'counterIntelligence', params: { region: mine, labour: 3 } }); await c.endTurn(); assert.equal(counterIntel(X(c), 'vantiria', mine), 3)
  const id = c.state.commitments.find(x => x.type === 'covert').id; await c.submit({ actor: V, type: 'liftCovert', params: { id } }); await c.endTurn(); assert.ok(!c.state.commitments.some(x => x.id === id))
  const before = observationAt(X(c), 'vantiria', mine); await c.submit({ actor: V, type: 'setObservationAllocation', params: { entries: [{ target: { kind: 'region', region: mine }, floor: 0, priority: 1, surplusWeight: 1 }] } }); await c.endTurn()
  assert.ok(observationAt(X(c), 'vantiria', mine) >= before, 'the dial concentrates Observation where you point it'); assert.equal(c.state.admin.governments.vantiria.observationDial.entries.length, 1)
})
test('whole run with standing operations is deterministic and keeps State sane', async () => {
  const play = async () => { const c = await boot(), region = regionOf(c, 'kerinia'); await c.submit({ actor: V, type: 'covertInfluence', params: { target: 'kerinia', region, concealment: 'low', opinion: -1, grievanceNeed: 'fairness', labour: Math.ceil(opThreshold(X(c), { kind: 'influence', tier: 'covert', region })) } })
    for (let i = 0; i < 12; i++) { await c.endTurn(); for (const x of Object.values(c.state.polity.cells)) { assert.ok(x.wealth >= 0 && x.population >= 0); for (const v of Object.values(x.grievance)) assert.ok(v >= 0 && v <= 1) } } return c }
  const a = await play(), b = await play(); assert.equal(JSON.stringify(a.state), JSON.stringify(b.state)); assert.ok(a.state.diplomacy.covert.length > 0)
})
