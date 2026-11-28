// Resolution of a debate by decision (kb administration: Assembly Queue, Resolution by decision, 2026-11-24/25), the entitlement size measure and a Right as a concession
// (kb internal politics: Entitlement loss, Question handling). WRITTEN, NOT YET RUN by the designer.
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeCtx, resolveTurn } from '../src/engine/engine.js'
import { registerAdministrationActions } from '../src/modules/administration/actions.js'
import { administrationModule } from '../src/modules/administration/module.js'
import { openDebates } from '../src/modules/administration/queue.js'
import { decideDebates, entitlementSize, rightConcession, votersOf } from '../src/modules/administration/decision.js'
import { addressed } from '../src/modules/administration/step.js'
import { updateMomentum } from '../src/modules/polity/step.js'
import { buildOrder } from '../src/ui/forms.js'
import { tuning, ruleset, modules, registry, makeState } from './fixtures.js'
registerAdministrationActions(registry)
// a stub act: impact per Nation (`cost` / `relief` by the first part of the cell key); gated by `params.domain`
registry.register({ id: 'testAct', module: 'test', class: 'event', gateDomain: a => a.params?.domain ?? null, defaultVisibility: 'public', costs: () => [], axisLoads: {},
  validate: (ctx, a) => (a.params?.invalid ? { ok: false, reasons: ['nope'] } : { ok: true }),
  impact: (ctx, a, key) => ({ cost: a.params?.cost?.[key.split('|')[0]] ?? 0, relief: a.params?.relief?.[key.split('|')[0]] ?? 0 }),
  apply: (ctx, a) => { ctx.state.testApplied = (ctx.state.testApplied ?? 0) + 1 } })
const T = k => tuning[k].value, close = (a, b, m = '') => assert.ok(Math.abs(a - b) < 1e-9, `${m} ${a} vs ${b}`)
const mkCtx = s => makeCtx(s, ruleset, { modules, registry, start: s }), gov = { kind: 'government', country: 'A' }, order = (id, type, params, actor = gov) => ({ id, type, actor, params })
const cell = (s, n) => s.polity.cells[`${n}|peasants|r1`], later = (s, ctx, n = 1) => { s.meta.turn += n; ctx.bump() }
const ZERO = { subsistence: 0, comfort: 0, luxury: 0 }, right = (id, nations, value = true) => nations.map(n => ({ scope: { kind: 'cell', nation: n, estate: 'peasants', region: 'r1' }, value, declaredTurn: 0 }))

// one Region, v and k press on one issue; v's Question is on the slate and debated in the Region's assembly; `petition` = the nations holding the Petition Right; `veto` = those holding Veto.administration
function dworld({ petition = [], veto = [], extend = false } = {}) {
  const s = makeState(); for (const n of ['v', 'k']) { const c = cell(s, n); c.grievance = { subsistence: 0.9 }; c.satisfaction = { ...ZERO } }
  s.admin.governments.A.controlSupply = 100; s.admin.governments.A.coordinationSupply = 10 / T('assembly.k'); s.admin.governments.A.ledger = 1000
  if (petition.length) s.polity.law.A.rights.Petition = right('Petition', petition)
  if (veto.length) s.polity.law.A.rights['Veto.administration'] = right('Veto.administration', veto)
  const ctx = mkCtx(s), qv = ctx.derive.polity.questions().find(x => x.need === 'subsistence' && x.cell.startsWith('v|'))
  s.admin.governments.A.attention = [{ questionKey: qv.key, coordinationCommitted: 10 }]
  openDebates(ctx); ctx.bump(); later(s, ctx)                          // the debate opened at step 6 starts next turn: now it is open
  if (extend) { registry.get('extendDebates').apply(ctx, order('x1', 'extendDebates', { questionKey: qv.key })); ctx.bump() }
  return { s, ctx, qv, d: s.polity.debate[qv.key], g: s.admin.governments.A } }
const propose = (w, params) => { w.d.proposal = { act: { type: 'testAct', params }, turn: w.s.meta.turn }; w.ctx.bump() }
const withMajority = (v, f) => { const old = ruleset.tuning['decision.majority'].value; ruleset.tuning['decision.majority'].value = v; try { return f() } finally { ruleset.tuning['decision.majority'].value = old } }

test('proposeAnswer: a Government order on a Question that is debated in an assembly; one answer per debate, replaceable; not Persuasion; the act must be valid', () => {
  const w = dworld({ petition: ['v', 'k'] }), t = registry.get('proposeAnswer'), ok = order('a1', 'proposeAnswer', { questionKey: w.qv.key, act: { type: 'testAct', params: { relief: { v: 1 } } } })
  assert.deepEqual(t.validate(w.ctx, ok), { ok: true })
  t.apply(w.ctx, ok); assert.deepEqual(w.d.proposal, { act: { type: 'testAct', params: { relief: { v: 1 } } }, turn: w.s.meta.turn })
  t.apply(w.ctx, order('a2', 'proposeAnswer', { questionKey: w.qv.key, act: { type: 'testAct', params: { relief: { k: 1 } } } })); assert.deepEqual(w.d.proposal.act.params, { relief: { k: 1 } }, 'replaced')
  const bad = (a, re) => assert.match(t.validate(w.ctx, a).reasons[0], re)
  bad(order('b', 'proposeAnswer', { questionKey: w.qv.key, act: { type: 'persuade', params: {} } }), /not an answer/)
  bad(order('c', 'proposeAnswer', { questionKey: w.qv.key, act: { type: 'noSuchAct' } }), /unknown act/)
  bad(order('d', 'proposeAnswer', { questionKey: w.qv.key, act: { type: 'testAct', params: { invalid: true } } }), /invalid/)
  bad(order('e', 'proposeAnswer', { questionKey: w.qv.key, act: { type: 'testAct' } }, { kind: 'government', country: 'B' }), /not a Question of your Country/)
  bad(order('f', 'proposeAnswer', { questionKey: w.qv.key, act: { type: 'testAct' } }, { kind: 'cell', key: 'v|peasants|r1' }), /Government order/)
  bad(order('g', 'proposeAnswer', { questionKey: 'nope|x|y|z', act: { type: 'testAct' } }), /unknown Question/)
  w.d.decided = { turn: 1 }; bad(ok, /not being debated/)
})

test('two thirds of the voting Weight decide a debate; half does not; the act is queued as an answer and the debate ends RESOLVED (freeze over, no modifier, slot freed, extension dropped)', () => {
  const w = dworld({ petition: ['v', 'k'], extend: true }); assert.equal(addressed(w.ctx, w.qv, w.g), true)
  assert.deepEqual(votersOf(w.ctx, w.d, { actor: gov, type: 'testAct', params: {} }), ['k|peasants|r1', 'v|peasants|r1'])
  propose(w, { relief: { v: 1 }, cost: { k: 50 } })                                  // v approves, k refuses: half of the voting Weight
  assert.deepEqual(decideDebates(w.ctx), [], 'half is below two thirds'); assert.equal(w.d.decided, undefined)
  withMajority(0.4, () => { w.ctx.bump(); assert.deepEqual(decideDebates(w.ctx), [w.qv.key]) })                  // the same vote passes a lower bar: the bar is the tuning key
  w.d.decided = undefined; w.s.admin.answers = []; w.ctx.bump(); propose(w, { relief: { v: 1, k: 1 } })
  assert.deepEqual(decideDebates(w.ctx), [w.qv.key], 'both approve'); const [ans] = w.s.admin.answers
  assert.equal(w.s.admin.answers.length, 1); assert.equal(ans.type, 'testAct'); assert.deepEqual(ans.actor, gov); assert.match(ans.id, /^ans/); assert.equal(ans.visibility, 'public'); assert.deepEqual(ans.params, { relief: { v: 1, k: 1 } })
  assert.equal(w.d.decided.turn, w.s.meta.turn); assert.equal(w.s.commitments.some(c => c.type === 'extendDebates'), false, 'the extension stops costing')
  assert.equal(addressed(w.ctx, w.qv, w.g), false, 'the freeze ends')
  const row = w.ctx.derive.administration.slate('A').assemblies.find(a => a.assembly === 'region:r1'); assert.equal(row.open, 0, 'the slot is free')
  const fm = n => (cell(w.s, n).fairnessMods ?? []).filter(m => m.source === 'debate').length
  updateMomentum(w.ctx, w.qv); assert.equal(w.d.expired, true); assert.equal(fm('v') + fm('k'), 0, 'resolved: no expiry modifier'); assert.ok(w.s.polity.momentum[w.qv.key] > 0, 'the rise resumes while it is still pressing')
  assert.equal(decideDebates(w.ctx).length, 0, 'decided once')
})

test('nothing may gate it: a covering Veto holder who refuses blocks the decision even above the bar; one who approves does not', () => {
  const w = dworld({ petition: ['v'], veto: ['k'] })
  withMajority(0.4, () => {
    propose(w, { domain: 'administration', relief: { v: 1 }, cost: { k: 50 } })
    assert.deepEqual(votersOf(w.ctx, w.d, { actor: gov, type: 'testAct', params: { domain: 'administration' } }), ['k|peasants|r1', 'v|peasants|r1'], 'agenda holders plus the Veto holders of the domain')
    assert.deepEqual(decideDebates(w.ctx), [], 'k refuses: gated'); assert.equal((w.s.admin.answers ?? []).length, 0)
    propose(w, { domain: 'administration', relief: { v: 1, k: 1 } }); assert.deepEqual(decideDebates(w.ctx), [w.qv.key], 'k approves: nothing gates it') })
})

test('with no voters the Government answers alone: the act is adopted at once if nothing gates it', () => {
  const w = dworld({}); propose(w, { relief: { v: 1 } })
  assert.deepEqual(votersOf(w.ctx, w.d, { actor: gov, type: 'testAct', params: {} }), []); assert.deepEqual(decideDebates(w.ctx), [w.qv.key])
})

test('an adopted answer runs as an ordinary Government action at the NEXT step 2 and the queue of answers is emptied', () => {
  const w = dworld({}); propose(w, { relief: { v: 1 } }); decideDebates(w.ctx); const id = w.s.admin.answers[0].id
  const { state, report } = resolveTurn(w.s, ruleset, [], { modules, registry })
  assert.ok(report.executed.includes(id), JSON.stringify(report)); assert.equal(state.testApplied, 1); assert.deepEqual(state.admin.answers, [])
  assert.ok(state.polity.log.some(e => e.id === id && e.action_type === 'testAct'), 'logged like any act')
})

test('the entitlement size measure is the act\'s impact: loss = cost, gain = relief; a Right as a concession = concession.rightK × the mean gain over the faction, loss not subtracted', () => {
  const w = dworld({ petition: ['v', 'k'] }), a = order('t', 'testAct', { cost: { v: 3 }, relief: { v: 2, k: 0 } }), keys = ['k|peasants|r1', 'v|peasants|r1']
  assert.deepEqual(entitlementSize(w.ctx, a, keys), { loss: { 'k|peasants|r1': 0, 'v|peasants|r1': 3 }, gain: { 'k|peasants|r1': 0, 'v|peasants|r1': 2 } })
  close(rightConcession(w.ctx, a, keys), T('concession.rightK') * 1); assert.equal(rightConcession(w.ctx, a, []), 0)
  assert.deepEqual(entitlementSize(w.ctx, order('p', 'persuade', {}), keys), { loss: { 'k|peasants|r1': 0, 'v|peasants|r1': 0 }, gain: { 'k|peasants|r1': 0, 'v|peasants|r1': 0 } }, 'a type without impact is {0, 0}')
})

test('a Right granted during a debate counts as a concession (module hook before the act applies); Persuasion and acts outside a debate do not; a comparable concession leaves no expiry modifier', () => {
  const w = dworld({ petition: ['v', 'k'] }), hook = administrationModule.onAct, t = registry.get('testAct')
  hook(w.ctx, order('r1', 'testAct', { relief: { v: 2, k: 0 }, cost: { v: 5 } }), t); close(w.d.conceded ?? 0, T('concession.rightK') * 1, 'mean gain 1, the loss is not subtracted')
  hook(w.ctx, order('r2', 'persuade', { questionKey: w.qv.key, amount: 1 }), registry.get('persuade')); close(w.d.conceded, T('concession.rightK') * 1, 'persuade has its own path')
  hook(w.ctx, order('r3', 'testAct', { relief: { v: 2, k: 2 } }, { kind: 'cell', key: 'v|peasants|r1' }), t); close(w.d.conceded, T('concession.rightK') * 1, 'only Government acts')
  hook(w.ctx, order('r4', 'testAct', { relief: { v: 2, k: 2 } }, { kind: 'government', country: 'B' }), t); close(w.d.conceded, T('concession.rightK') * 1, 'only Questions of its own Country')
  assert.ok(w.d.conceded >= T('petition.comparable'))
  later(w.s, w.ctx, 2); updateMomentum(w.ctx, w.qv); assert.equal(w.d.expired, true)
  assert.equal((cell(w.s, 'v').fairnessMods ?? []).concat(cell(w.s, 'k').fairnessMods ?? []).filter(m => m.source === 'debate').length, 0, 'comparable concession: no modifier')
  const idle = dworld({ petition: ['v', 'k'] }); idle.d.expired = true; hook(idle.ctx, order('r5', 'testAct', { relief: { v: 2, k: 2 } }), t); assert.equal(idle.d.conceded, undefined, 'no open debate: nothing to concede in')
})

test('the proposeAnswer form builds an order; the Action type is registered; both new tuning keys exist', () => {
  const o = { me: 'A' }, f = buildOrder('proposeAnswer', { questionKey: 'q1', type: 'reformRightsDuties', params: '{"entries":[]}' }, o)
  assert.deepEqual(f.order.params, { questionKey: 'q1', act: { type: 'reformRightsDuties', params: { entries: [] } } })
  assert.match(buildOrder('proposeAnswer', { questionKey: '', type: 'x', params: '' }, o).error, /Question/); assert.match(buildOrder('proposeAnswer', { questionKey: 'q1', type: ' ', params: '' }, o).error, /act type/); assert.match(buildOrder('proposeAnswer', { questionKey: 'q1', type: 'x', params: '{bad' }, o).error, /JSON/)
  assert.ok(registry.get('proposeAnswer')); close(T('decision.majority'), 2 / 3); assert.ok(T('concession.rightK') > 0)
})
