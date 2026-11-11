// tests/ai_diplomacy.test.js — AI-Diplomacy agent (ai_diplomacy__spec). Pure: the reads adapter is injected, so no world is needed.
import test from 'node:test'
import assert from 'node:assert/strict'
import { shared, weights, derivePosture, typeValueInputs } from './ai_diplomacy_helpers.js'
import { updateCampaigns } from '../src/modules/ai/diplomacy/campaign.js'
import { generate } from '../src/modules/ai/diplomacy/candidates.js'
import { select } from '../src/modules/ai/diplomacy/score.js'
import { respond } from '../src/modules/ai/diplomacy/negotiate.js'
import { config } from '../src/modules/ai/diplomacy/config.js'
import { planDiplomacy, diplomacyOrders } from '../src/modules/ai/diplomacyAgent.js'
import { writeCache } from '../src/modules/ai/actions.js'

const zero = { economic: 0, diplomatic: 0, military: 0, cultural: 0 }
const RANK = { Grievance: 1, Rights: 2, Sovereignty: 3, Existential: 4 }
const CONCEAL = { act: { low: 2, medium: 5, high: 10 }, sender: { low: 4, medium: 9, high: 16 } }
const fake = (o = {}) => { const rd = {
  countries: ctx => Object.keys(ctx.state.countries).sort(), isPlayer: (ctx, c) => !!ctx.state.countries[c].isPlayer, turn: ctx => ctx.state.meta.turn,
  opinion: () => 0, leverage: () => zero, reputation: () => 0, cbs: () => [], warForbidden: () => false, treatyTier: () => null, tradeDep: () => 0, power: () => 1, treaties: () => [],
  tariffAsym: () => 0, portrait: () => ({}), atWar: () => false, regions: () => [], regionPop: () => 1000, targetScale: () => 1, opThreshold: () => 4, detection: () => 0, espionageFree: () => 10,
  conceal: (ctx, which, level) => (level ? CONCEAL[which][level] : 20), hasCommitment: () => false, inboundProposals: () => [], registered: () => true, validate: () => true, ...o }
  rd.bestCBRank = o.bestCBRank ?? ((ctx, a, b) => Math.max(0, ...rd.cbs(ctx, a, b).map(c => RANK[c.tier] ?? 0)))
  return rd }
const mkCtx = (tuning = {}) => ({ ruleset: { tuning, aiDiplomacy: { enabled: true } }, state: { meta: { turn: 5 }, countries: { A: {}, B: { isPlayer: true }, C: {} }, ai: undefined, commitments: [] } })

test('posture: the player is treated exactly like any other Country', () => {
  const ctx = mkCtx(), rd = fake({ opinion: () => 80 }), S = shared(ctx, rd), W = weights(ctx, 'A', rd)
  assert.equal(derivePosture(ctx, 'A', 'B', S, {}, W, rd), 'Partner')
  assert.equal(derivePosture(ctx, 'A', 'B', S, {}, W, rd), derivePosture(ctx, 'A', 'C', S, {}, W, rd))
})

test('posture: hysteresis keeps the current Posture just under a boundary, a fresh one does not', () => {
  const ctx = mkCtx(), rd = fake({ opinion: () => 45 }), S = shared(ctx, rd), W = weights(ctx, 'A', rd)      // affinity 0.18, tPartner 0.2, band 0.05
  assert.equal(derivePosture(ctx, 'A', 'B', S, {}, W, rd), 'Wary')
  assert.equal(derivePosture(ctx, 'A', 'B', S, { posture: { 'A|B': { value: 'Partner' } } }, W, rd), 'Partner')
})

const campCtx = (tradeAB, extra = {}) => { const ctx = mkCtx(), rd = fake({ opinion: () => 80, tradeDep: (c, a, b) => (a === 'A' && b === 'B' ? tradeAB : b === 'C' ? 100 : 0), ...extra })
  const S = shared(ctx, rd), W = weights(ctx, 'A', rd), cache = { campaigns: { A: [{ id: 'x', target: 'B', type: 'Court', since: 3, snap: { cbs: 0, allies: 0, power: S.power.B } }] } }
  return { ctx, rd, S, W, cache } }
const forB = c => c.find(x => x.target === 'B')

test('campaign: switching type needs a margin, so small value changes do not flip it', () => {
  const { ctx, rd, S, W, cache } = campCtx(38)                                  // Court 0.32, Secure 0.38 < 0.32 + 0.1
  assert.equal(forB(updateCampaigns(ctx, 'A', { B: 'Partner', C: 'Wary' }, S, cache, W, rd)).type, 'Court')
  const hi = campCtx(50)                                                        // Secure 0.5 > 0.42
  assert.equal(forB(updateCampaigns(hi.ctx, 'A', { B: 'Partner', C: 'Wary' }, hi.S, hi.cache, hi.W, hi.rd)).type, 'Secure')
})

test('campaign: a new CB bypasses the margin', () => {
  const { ctx, rd, S, W, cache } = campCtx(38, { cbs: (c, holder, target) => (holder === 'A' && target === 'B' ? [{ tier: 'Rights' }] : []) })
  assert.equal(forB(updateCampaigns(ctx, 'A', { B: 'Partner', C: 'Wary' }, S, cache, W, rd)).type, 'Secure')
})

test('campaign: Strike needs a usable CB and finishes with a goal proportionate to its tier', () => {
  const ctx = mkCtx({ 'ai.dip.strike.edge': { value: 0.05 } }), mil = { ...zero, military: 100 }
  const base = { leverage: (c, x, y) => (x === 'A' && y === 'B' ? mil : zero) }
  const none = fake(base), S0 = shared(ctx, none), W = weights(ctx, 'A', none)
  assert.equal(forB(updateCampaigns(ctx, 'A', { B: 'Dominate', C: 'Wary' }, S0, {}, W, none)).type, 'Squeeze')
  const ctx2 = mkCtx({ 'ai.dip.strike.edge': { value: 0.05 } }), cb = fake({ ...base, cbs: (c, h, t) => (h === 'A' && t === 'B' ? [{ tier: 'Rights' }] : []) }), S = shared(ctx2, cb)
  const camps = updateCampaigns(ctx2, 'A', { B: 'Dominate', C: 'Wary' }, S, {}, W, cb)
  assert.equal(forB(camps).type, 'Strike')
  const war = generate(ctx2, 'A', forB(camps), { B: 'Dominate', C: 'Wary' }, S, W, cb).find(x => x.role === 'declareWar')
  assert.deepEqual(war.order.params, { target: 'B', goals: [{ type: 'cede' }] })
})

test('candidates: roles whose ActionType is not registered are skipped', () => {
  const ctx = mkCtx(), S = shared(ctx, fake()), W = weights(ctx, 'A', fake()), camp = { type: 'Court', target: 'B' }, post = { B: 'Partner', C: 'Wary' }
  assert.ok(generate(ctx, 'A', camp, post, S, W, fake()).some(x => x.role === 'treatyBN'))
  assert.equal(generate(ctx, 'A', camp, post, S, W, fake({ registered: (c, t) => t !== 'proposeTreaty' })).length, 0)
  assert.equal(generate(ctx, 'A', camp, post, S, W, fake({ validate: () => false })).length, 0)
})

test('selection: binary thresholds, a candidate is funded fully or skipped, never partially', () => {
  const budget = { espionage: 4 }, c = (key, s, labour, exclusive) => ({ key, s, labour, pool: 'espionage', exclusive })
  const out = select(mkCtx(), [c('a', 1, 5, 'x'), c('b', 0.5, 3, 'y')], budget)
  assert.deepEqual(out.map(x => x.key), ['b']); assert.equal(budget.espionage, 1)
  assert.deepEqual(select(mkCtx(), [c('p', 1, 2, 'same'), c('q', 0.9, 2, 'same')], { espionage: 10 }).map(x => x.key), ['p'])
})

test('false flag: a self-targeted one is priced when allowed and dropped when Diplomacy refuses it', () => {
  const mk = validate => fake({ regions: (c, x) => (x === 'A' ? ['rA'] : []), regionPop: () => 2000, detection: () => 5, validate: (c, o) => validate(o) })
  const ctx = mkCtx(), camp = { type: 'Provoke', target: 'B' }, post = { B: 'Dominate', C: 'Wary' }, W = weights(ctx, 'A', mk(() => true))
  const allowed = generate(ctx, 'A', camp, post, shared(ctx, mk(() => true)), W, mk(() => true)).find(x => x.role === 'selfFlag')
  assert.ok(allowed); assert.ok(allowed.harm > 0)
  const ctx2 = mkCtx(), refused = mk(o => o.params.target !== o.actor.country)
  assert.equal(generate(ctx2, 'A', camp, post, shared(ctx2, refused), W, refused).some(x => x.role === 'selfFlag'), false)
})

test('false flag: a frame is offered only inside the detection window', () => {
  const mk = d => fake({ regions: (c, x) => (x === 'C' ? ['rC'] : []), detection: () => d })
  const has = d => { const ctx = mkCtx(), rd = mk(d); return generate(ctx, 'A', { type: 'Provoke', target: 'B' }, { B: 'Dominate', C: 'Wary' }, shared(ctx, rd), weights(ctx, 'A', rd), rd).some(x => x.role === 'frame') }
  assert.equal(has(1), false); assert.equal(has(5), true); assert.equal(has(25), false)
})

test('negotiation: accept, silence or reject by posture toward the proposer', () => {
  const prop = { id: 'pr1', from: 'B', to: 'A', kind: 'Alliance', tier: 'BenevolentNeutrality' }
  const run = posture => { const ctx = mkCtx(), rd = fake({ inboundProposals: () => [prop] }); return respond(ctx, 'A', { B: posture }, weights(ctx, 'A', rd), config(ctx), rd) }
  assert.equal(run('Ally')[0].params.accept, true); assert.equal(run('Wary').length, 0); assert.equal(run('Dominate')[0].params.accept, false)
})

test('agent: deterministic, does not mutate state, and persists only through the cache', () => {
  const ctx = mkCtx(), rd = fake({ opinion: () => 80, leverage: (c, x, y) => (x === 'A' && y === 'B' ? { ...zero, military: 50 } : zero) }), before = JSON.stringify(ctx.state)
  const r1 = planDiplomacy(ctx, 'A', rd), r2 = planDiplomacy(ctx, 'A', rd)
  assert.deepEqual(r1, r2); assert.equal(JSON.stringify(ctx.state), before)
  const all = diplomacyOrders(ctx, rd); assert.ok(all.every(o => o.actor.country !== 'B')); assert.ok(all.some(o => o.type === 'aiMemo' && o.params.country === 'A'))
  writeCache(ctx, 'A', r1.cache); assert.equal(ctx.state.ai.diplomacy.posture['A|B'].value, 'Partner')
  const off = mkCtx(); off.ruleset.aiDiplomacy = {}; assert.deepEqual(diplomacyOrders(off, rd), [])
})
