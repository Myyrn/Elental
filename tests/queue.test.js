// The assembly queue (kb administration: Assembly Queue and Question Resolution Time; spec: administration__spec.md), economics.produceCCOByRegion, the slate query and the new Event Draft forms.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readPackage } from '../src/data/loaders/readPackage.js'
import { EngineClient } from '../src/client/engineClient.js'
import { makeCtx } from '../src/engine/engine.js'
import { registerAdministrationActions } from '../src/modules/administration/actions.js'
import { openDebates, agenda, queueCap } from '../src/modules/administration/queue.js'
import { addressed } from '../src/modules/administration/step.js'
import { updateMomentum } from '../src/modules/polity/step.js'
import { FORMS, buildOrder, defaults } from '../src/ui/forms.js'
import { tuning, ruleset, modules, registry, makeState } from './fixtures.js'
registerAdministrationActions(registry)
const T = k => tuning[k].value, close = (a, b, m = '') => assert.ok(Math.abs(a - b) < 1e-6, `${m} ${a} vs ${b}`)
const mkCtx = s => makeCtx(s, ruleset, { modules, registry, start: s }), gov = { kind: 'government', country: 'A' }, order = (id, type, params) => ({ id, type, actor: gov, params })
const coordFor = n => n / T('assembly.k')                                       // Coordination that gives a queue cap of n
const VKEY = 'v|peasants|r1', REGION = { kind: 'region', id: 'r1' }
const readJson = async path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)))
const boot = async () => { const c = new EngineClient(); await c.init(await readPackage(readJson, 'scenarios/demo'), await readJson('data/ruleset.json')); return c }

// v and k press on one issue and both Questions are on the slate; `coord` = the Country's Coordination supply (split by population over its Regions: here one Region)
function world(coord = 0, { petition = false } = {}) {
  const s = makeState(); for (const n of ['v', 'k']) { const c = s.polity.cells[`${n}|peasants|r1`]; c.grievance = { subsistence: 0.9 }; c.satisfaction = { subsistence: 0, comfort: 0, luxury: 0 } }
  s.admin.governments.A.controlSupply = 100; s.admin.governments.A.coordinationSupply = coord
  if (petition) s.polity.law.A.rights.Petition = [{ scope: { kind: 'cell', nation: 'v', estate: 'peasants', region: 'r1' }, value: true, declaredTurn: 0 }]
  const ctx = mkCtx(s), qs = ctx.derive.polity.questions(), qv = qs.find(x => x.cell === VKEY && x.need === 'subsistence'), qk = qs.find(x => x.cell === 'k|peasants|r1' && x.need === 'subsistence')
  assert.ok(qv && qk, 'two live Questions on one issue')
  s.admin.governments.A.attention = [{ questionKey: qv.key, coordinationCommitted: 10 }, { questionKey: qk.key, coordinationCommitted: 10 }]
  return { s, ctx, qv, qk, byKey: { [qv.key]: qv, [qk.key]: qk } } }
const later = (s, ctx, n = 1) => { s.meta.turn += n; ctx.bump() }

test('cap 1: one listed Question is debated (a slot of the Government), the other WAITS and is not addressed, so its momentum keeps rising', () => {
  const { s, ctx, byKey } = world(0); assert.equal(queueCap(ctx, REGION), 1)
  const waiting = openDebates(ctx), keys = Object.keys(s.polity.debate); ctx.bump()
  assert.equal(keys.length, 1); assert.equal(waiting.length, 1); assert.notEqual(keys[0], waiting[0]); assert.deepEqual(Object.keys(s.polity.waiting), waiting)
  assert.deepEqual({ ...s.polity.debate[keys[0]] }, { since: s.meta.turn + 1, duration: T('question.turns.region'), assembly: 'region:r1', holder: 'government' })
  const g = s.admin.governments.A; assert.equal(addressed(ctx, byKey[keys[0]], g), true); assert.equal(addressed(ctx, byKey[waiting[0]], g), false)
  updateMomentum(ctx, byKey[keys[0]]); close(s.polity.momentum[keys[0]], 0, 'debated: frozen'); updateMomentum(ctx, byKey[waiting[0]]); assert.ok(s.polity.momentum[waiting[0]] > 0, 'waiting: rises'); assert.equal(s.polity.debate[waiting[0]], undefined, 'waiting never gets a debate behind the queue\'s back')
  const sl = ctx.derive.administration.slate('A'); assert.deepEqual(sl.questions.map(q => q.status).sort(), ['slate', 'waiting']); assert.deepEqual(sl.waiting, waiting)
  assert.equal(sl.assemblies[0].assembly, 'region:r1'); assert.equal(sl.assemblies[0].cap, 1); assert.equal(sl.assemblies[0].open, 1); assert.equal(sl.assemblies[0].slots.government, 1)
})

test('cap 2 (from Coordination): both are debated; the cap follows the Region\'s Coordination and is at least 1', () => {
  const { s, ctx } = world(coordFor(2)); assert.equal(queueCap(ctx, REGION), 2)
  assert.deepEqual(openDebates(ctx), []); assert.equal(Object.keys(s.polity.debate).length, 2)
  const z = world(0); z.s.admin.governments.A.coordinationSupply = 0; assert.equal(queueCap(z.ctx, REGION), 1, 'no Coordination: still one slot')
})

test('agenda: a Petition holder claims a share of the slots and opens its own Questions; the Government keeps the rest; with a cap of 1 the ordering (Petition multiplier) decides', () => {
  const { s, ctx } = world(coordFor(4), { petition: true }), a = agenda(ctx, 'r1')
  assert.equal(a.cap, 4); assert.ok(a.shares[VKEY] > 0 && a.slots[VKEY] >= 1, 'the holder claims slots'); assert.equal(a.slots[VKEY] + a.slots.government, 4)
  openDebates(ctx); assert.equal(s.polity.debate[Object.keys(s.polity.debate).find(k => k.startsWith(VKEY))].holder, VKEY); assert.equal(s.polity.debate[Object.keys(s.polity.debate).find(k => k.startsWith('k|'))].holder, 'government')
  const one = world(0, { petition: true }); assert.equal(agenda(one.ctx, 'r1').slots[VKEY], 0, 'a share of less than one slot is no slot'); assert.deepEqual(openDebates(one.ctx), [one.qk.key]); assert.deepEqual(Object.keys(one.s.polity.debate), [one.qv.key])
})

test('an extension keeps the slot; lifting it ends the debate (expired) and frees the slot for the waiting Question', () => {
  const { s, ctx, byKey } = world(0), t = registry.get('extendDebates'); const [X] = [Object.keys((openDebates(ctx), s.polity.debate))[0]], Y = Object.keys(s.polity.waiting)[0]; ctx.bump()
  assert.deepEqual(t.validate(ctx, order('a', 'extendDebates', { questionKey: X })), { ok: true }); assert.equal(t.validate(ctx, order('b', 'extendDebates', { questionKey: Y })).ok, false, 'a waiting Question is not being debated')
  t.apply(ctx, order('e1', 'extendDebates', { questionKey: X })); later(s, ctx, 2)
  updateMomentum(ctx, byKey[X]); assert.equal(s.polity.debate[X].expired, undefined, 'extended: not expired'); assert.deepEqual(openDebates(ctx), [Y], 'the extended debate still holds the slot'); assert.equal(s.polity.debate[Y], undefined)
  registry.get('liftExtendDebates').apply(ctx, order('l1', 'liftExtendDebates', { id: 'e1' })); ctx.bump()
  updateMomentum(ctx, byKey[X]); assert.equal(s.polity.debate[X].expired, true); assert.deepEqual(openDebates(ctx), [], 'the slot is free'); assert.equal(s.polity.debate[Y].since, s.meta.turn + 1)
})

test('economics.produceCCOByRegion: the Regions of a Country add up to the Country\'s envelope, per axis', async () => {
  const c = await boot(); await c.runTurns(6); const ctx = c.viewCtx(), E = ctx.derive.economics
  for (const country of Object.keys(c.state.countries)) {
    const regions = [...new Set(Object.values(c.state.world.regionSnapshot.assignment))].filter(r => ctx.derive.worldmap.regionOwner(r) === country), whole = E.produceCCO(country)
    for (const ax of ['control', 'coordination', 'observation']) close(regions.reduce((s, r) => s + E.produceCCOByRegion(r)[ax], 0), whole[ax], `${country} ${ax}`) }
})

test('the slate query: plain JSON, with statuses, assemblies, extensions and colonization; a real run keeps the books', async () => {
  const c = await boot(); await c.runTurns(6); const r = await c.query('slate', { country: 'vantiria' })
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r); for (const k of ['attention', 'standing', 'questions', 'unaddressed', 'waiting', 'assemblies', 'extensions', 'colonization', 'heldShare', 'turn', 'coordinationSupply']) assert.ok(k in r, k)
  for (const q of r.questions) assert.ok(['slate', 'standing', 'debate', 'waiting', 'unaddressed'].includes(q.status), q.status)
  for (const a of r.assemblies) { assert.ok(a.cap >= 1); assert.ok(a.open <= a.cap + Object.keys(a.slots).length, 'open debates stay within the agenda (a Petition holder may round up)') }
  const q = await c.query('questions', { country: 'vantiria' }); assert.match(q.note, /slate/)
})

test('forms: resettlement, expulsion, free colonization, capital, reorganization and the debate extensions build orders; every one is a registered Action type', async () => {
  const c = await boot(), o = { me: 'vantiria', scope: { kind: 'nation', nation: 'vantir' }, selectedProvince: 'p:7,6', debates: [{ v: 'q1', l: 'q1' }], extensions: [{ v: 'e1', l: 'e1' }], colonization: [{ v: 'c1', l: 'c1' }], regions: ['r1'] }
  assert.deepEqual(buildOrder('directResettlement', { province: 'p:7,6', share: '0.5' }, o).order.params, { scope: o.scope, province: 'p:7,6', share: 0.5 })
  assert.deepEqual(buildOrder('expel', { province: 'p:9,6', share: 1, confiscate: '0.25' }, o).order.params, { scope: o.scope, province: 'p:9,6', share: 1, confiscate: 0.25 }); assert.match(buildOrder('expel', { province: '', share: 1, confiscate: 0 }, o).error, /province/)
  assert.deepEqual(buildOrder('freeColonization', { incentive: '0.4' }, o).order.params, { incentive: 0.4 }); assert.match(buildOrder('freeColonization', { incentive: '0' }, o).error, /above 0/)
  assert.deepEqual(buildOrder('liftFreeColonization', { id: 'c1' }, o).order.params, { id: 'c1' }); assert.deepEqual(buildOrder('extendDebates', { questionKey: 'q1' }, o).order.params, { questionKey: 'q1' }); assert.deepEqual(buildOrder('liftExtendDebates', { id: 'e1' }, o).order.params, { id: 'e1' })
  assert.deepEqual(buildOrder('setRegionCapital', { region: 'r1', province: 'p:7,6' }, o).order.params, { region: 'r1', province: 'p:7,6' })
  assert.deepEqual(buildOrder('reorganizeRegions', { ops: '[{"kind":"move","province":"p:7,6","to":"r2"}]' }, o).order.params.ops, [{ kind: 'move', province: 'p:7,6', to: 'r2' }]); assert.match(buildOrder('reorganizeRegions', { ops: '{oops' }, o).error, /JSON/); assert.match(buildOrder('reorganizeRegions', { ops: '' }, o).error, /at least one/)
  assert.equal(buildOrder('extendDebates', defaults('extendDebates', {}), {}).error, 'no Question is being debated')
  for (const t of ['directResettlement', 'expel', 'freeColonization', 'liftFreeColonization', 'setRegionCapital', 'reorganizeRegions', 'extendDebates', 'liftExtendDebates']) { assert.ok(FORMS[t], t); assert.ok(c.registry.types.has(t), `${t} is a registered Action type`) }
})
