// Question handling (kb internal politics: Question handling, Compliance; administration: Assembly Queue, 2026-11-22): the scope of a Question by its faction, handling, the petition clock, the moderate expiry modifier and Persuasion.
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeCtx } from '../src/engine/engine.js'
import { registerAdministrationActions, persuasionCost } from '../src/modules/administration/actions.js'
import { openDebates } from '../src/modules/administration/queue.js'
import { questionScope } from '../src/modules/administration/step.js'
import { updateMomentum } from '../src/modules/polity/step.js'
import { buildOrder } from '../src/ui/forms.js'
import { tuning, ruleset, modules, registry, makeState } from './fixtures.js'
registerAdministrationActions(registry)
const T = k => tuning[k].value, close = (a, b, m = '') => assert.ok(Math.abs(a - b) < 1e-9, `${m} ${a} vs ${b}`)
const mkCtx = s => makeCtx(s, ruleset, { modules, registry, start: s }), gov = { kind: 'government', country: 'A' }, order = (id, type, params, actor = gov) => ({ id, type, actor, params })
const cell = (s, n) => s.polity.cells[`${n}|peasants|r1`], later = (s, ctx, n = 1) => { s.meta.turn += n; ctx.bump() }
const mods = (s, n, source) => (cell(s, n).fairnessMods ?? []).filter(m => m.source === source)
const ZERO = { subsistence: 0, comfort: 0, luxury: 0 }

// one Region, v and k press on one issue; `list` = the nations whose Question is on the slate
function world({ coord = 0, petition = false, list = [] } = {}) {
  const s = makeState(); for (const n of ['v', 'k']) { const c = cell(s, n); c.grievance = { subsistence: 0.9 }; c.satisfaction = { ...ZERO } }
  s.admin.governments.A.controlSupply = 100; s.admin.governments.A.coordinationSupply = coord
  if (petition) s.polity.law.A.rights.Petition = [{ scope: { kind: 'cell', nation: 'v', estate: 'peasants', region: 'r1' }, value: true, declaredTurn: 0 }]
  const ctx = mkCtx(s), byNation = Object.fromEntries(ctx.derive.polity.questions().filter(x => x.need === 'subsistence').map(x => [x.cell.split('|')[0], x]))
  s.admin.governments.A.attention = list.map(n => ({ questionKey: byNation[n].key, coordinationCommitted: 10 }))
  return { s, ctx, qv: byNation.v, qk: byNation.k } }
// four Regions of one Country, a v cell in each; `pressing` = the Regions whose v cell presses on subsistence
function regions4(pressing) {
  const s = makeState(); ['p:0,0', 'p:1,0', 'p:2,0', 'p:3,0'].forEach((p, i) => { s.world.regionSnapshot.assignment[p] = `r${i + 1}` })
  s.world.regionSnapshot.owners = { r1: 'A', r2: 'A', r3: 'A', r4: 'A' }
  const base = s.polity.cells['v|peasants|r1']
  for (const r of ['r2', 'r3', 'r4']) { const c = structuredClone(base); c.key = `v|peasants|${r}`; c.region = r; s.polity.cells[c.key] = c }
  for (const [key, c] of Object.entries(s.polity.cells)) { const r = key.split('|')[2]
    if (key.startsWith('v|') && pressing.includes(r)) { c.grievance = { subsistence: 0.9 }; c.satisfaction = { ...ZERO } } else { c.grievance = {}; c.satisfaction = { subsistence: 1, comfort: 1, luxury: 1 } } }
  s.admin.governments.A.coordinationSupply = 0; s.admin.governments.A.controlSupply = 100
  const ctx = mkCtx(s); return { s, ctx, qOf: r => ctx.derive.polity.questions().find(x => x.cell === `v|peasants|${r}` && x.need === 'subsistence') } }

test('the scope of a Question is the scope of its faction: one Region, several Regions, or cells from more than half of the Country\'s Regions', () => {
  const a = regions4(['r1']); assert.equal(questionScope(a.ctx, a.qOf('r1')), 'region')
  const b = regions4(['r1', 'r2']); assert.equal(questionScope(b.ctx, b.qOf('r1')), 'multi')                           // 2 of 4 Regions is not more than half
  const c = regions4(['r1', 'r2', 'r3']); assert.equal(questionScope(c.ctx, c.qOf('r1')), 'empire'); assert.equal(questionScope(c.ctx, c.qOf('r3')), 'empire')      // 3 of 4, and every cell of the faction sees the same scope
})

test('the length and the assembly of a debate follow that scope: Region 1 turn in its Region\'s assembly; several Regions 3 and country-wide 5 turns in the Country\'s assembly', () => {
  for (const [pressing, scope, asm, len] of [[['r1'], 'region', 'region:r1', T('question.turns.region')], [['r1', 'r2'], 'multi', 'empire:A', T('question.turns.multi')], [['r1', 'r2', 'r3'], 'empire', 'empire:A', T('question.turns.empire')]]) {
    const w = regions4(pressing), q = w.qOf('r1'); w.s.admin.governments.A.attention = [{ questionKey: q.key, coordinationCommitted: 10 }]
    assert.deepEqual(openDebates(w.ctx), []); w.ctx.bump(); const d = w.s.polity.debate[q.key]
    assert.deepEqual({ ...d }, { since: w.s.meta.turn + 1, duration: len, assembly: asm, holder: 'government', scope }, scope)
    const sl = w.ctx.derive.administration.slate('A'), row = sl.questions.find(x => x.key === q.key); assert.equal(row.scope, scope)
    const a = sl.assemblies.find(x => x.assembly === asm); assert.ok(a && a.cap >= 1 && a.open === 1, `assembly ${asm}`) }
  assert.equal(T('question.turns.region'), 1); assert.equal(T('question.turns.multi'), 3); assert.equal(T('question.turns.empire'), 5)
})

test('handling is derived: debated (a petitioning cell, discussed), consulted (no Petition, discussed), ignored (not discussed)', () => {
  const { s, ctx, qv, qk } = world({ coord: 10 / T('assembly.k'), petition: true, list: ['v', 'k'] }); openDebates(ctx); ctx.bump()
  const rows = Object.fromEntries(ctx.derive.administration.slate('A').questions.map(r => [r.key, r]))
  assert.equal(rows[qv.key].handling, 'debated'); assert.equal(rows[qv.key].petition, true); assert.equal(rows[qk.key].handling, 'consulted'); assert.equal(rows[qk.key].petition, false)
  const one = world({ petition: true, list: ['v'] }); openDebates(one.ctx); one.ctx.bump(); const r1 = Object.fromEntries(one.ctx.derive.administration.slate('A').questions.map(r => [r.key, r]))
  assert.equal(r1[one.qv.key].handling, 'debated'); assert.equal(r1[one.qk.key].handling, 'ignored')
})

test('petition: a Question of a petitioning cell that nobody discusses takes a large, slowly decaying Fairness modifier on that cell ONCE after the grace; a cell without Petition has no clock', () => {
  const { s, ctx, qv, qk } = world({ petition: true }); updateMomentum(ctx, qv); updateMomentum(ctx, qk); assert.equal(mods(s, 'v', 'petition').length, 0, 'within the grace')
  later(s, ctx); updateMomentum(ctx, qv); updateMomentum(ctx, qk)
  const m = mods(s, 'v', 'petition'); assert.equal(m.length, 1); close(m[0].value, T('petition.refuseHit')); assert.equal(m[0].decay.rateKey, 'petition.refuseDecay'); assert.ok(T('petition.refuseDecay') < T('opinion.modDecay'), 'slower than the ordinary decay')
  assert.equal(mods(s, 'k', 'petition').length, 0, 'consultation: no refusal penalty')
  later(s, ctx); updateMomentum(ctx, qv); assert.equal(mods(s, 'v', 'petition').length, 1, 'once')
  const heard = world({ petition: true, list: ['v'] }); updateMomentum(heard.ctx, heard.qv); later(heard.s, heard.ctx); updateMomentum(heard.ctx, heard.qv)
  assert.equal(mods(heard.s, 'v', 'petition').length, 0, 'it was heard (a debate was opened), so it is not refused')
})

test('an expired debate leaves the minor modifier, and a MODERATE one (petition.expiryMult) on a petitioning cell; a concession of comparable size leaves none', () => {
  const { s, ctx, qv } = world({ petition: true, list: ['v'] }); updateMomentum(ctx, qv); later(s, ctx); updateMomentum(ctx, qv)
  close(mods(s, 'v', 'debate')[0].value, T('debate.expiryGrievance') * T('petition.expiryMult'), 'petitioner'); close(mods(s, 'k', 'debate')[0].value, T('debate.expiryGrievance'), 'the others')
  assert.ok(T('petition.expiryMult') > 1)
  const c = world({ petition: true, list: ['v'] }); updateMomentum(c.ctx, c.qv)
  registry.get('persuade').apply(c.ctx, order('p1', 'persuade', { questionKey: c.qv.key, amount: T('petition.comparable') })); assert.ok(c.s.polity.debate[c.qv.key].conceded >= T('petition.comparable'))
  later(c.s, c.ctx); updateMomentum(c.ctx, c.qv); assert.equal(c.s.polity.debate[c.qv.key].expired, true); assert.equal(mods(c.s, 'v', 'debate').length + mods(c.s, 'k', 'debate').length, 0, 'conceded: no modifier'); assert.ok(c.s.polity.momentum[c.qv.key] > 0, 'but the rise resumes')
})

test('persuade: needs a Question that is being discussed, a positive amount and a Ledger that can pay; the Ledger pays, the faction gets a decaying Opinion modifier, the debate records the concession', () => {
  const { s, ctx, qv } = world({ list: ['v'] }), t = registry.get('persuade'); updateMomentum(ctx, qv)
  const ok = order('a', 'persuade', { questionKey: qv.key, amount: 0.5 }); assert.deepEqual(t.validate(ctx, ok), { ok: true })
  const cost = persuasionCost(ctx, qv, 0.5); close(cost, T('persuade.costK') * 0.5 * 2000 / T('persuade.popUnit'))
  assert.equal(t.validate(ctx, order('b', 'persuade', { questionKey: qv.key, amount: 0 })).ok, false); assert.equal(t.validate(ctx, order('c', 'persuade', { questionKey: 'nope|x|y|z', amount: 1 })).ok, false)
  assert.equal(t.validate(ctx, order('d', 'persuade', { questionKey: qv.key, amount: 1 }, { kind: 'government', country: 'B' })).ok, false); assert.equal(t.validate(ctx, order('e', 'persuade', { questionKey: qv.key, amount: 1 }, { kind: 'cell', key: 'v|peasants|r1' })).ok, false)
  const l0 = s.admin.governments.A.ledger; t.apply(ctx, ok)
  close(s.admin.governments.A.ledger, l0 - cost); for (const n of ['v', 'k']) { const m = (cell(s, n).opinionGovMods ?? []).filter(x => x.source === 'persuasion'); assert.equal(m.length, 1, n); close(m[0].value, 0.5) }
  close(s.polity.debate[qv.key].conceded, 0.5); t.apply(ctx, ok); close(s.polity.debate[qv.key].conceded, 1)
  s.admin.governments.A.ledger = 0.1; assert.match(t.validate(ctx, ok).reasons[0], /Ledger/)
  const cold = world({ list: [] }); assert.match(t.validate(cold.ctx, order('f', 'persuade', { questionKey: cold.qv.key, amount: 0.5 })).reasons[0], /not being discussed/)
})

test('the persuade form builds an order and is a registered Action type', () => {
  const o = { me: 'A', debates: [{ v: 'q1', l: 'q1' }] }
  assert.deepEqual(buildOrder('persuade', { questionKey: 'q1', amount: '0.5' }, o).order.params, { questionKey: 'q1', amount: 0.5 }); assert.match(buildOrder('persuade', { questionKey: '', amount: '0.5' }, o).error, /Question/); assert.match(buildOrder('persuade', { questionKey: 'q1', amount: '0' }, o).error, /above 0/)
  assert.ok(registry.get('persuade'))
})
