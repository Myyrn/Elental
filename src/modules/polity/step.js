// polity/step.js — step 5 (order matters): grievance, attribution, decay, Questions, momentum/rungs.
import { parseCellKey } from '../../kernel/ids.js'
import { tick, push, makeStack } from '../../kernel/modifiers.js'
import { stepRemainingPolity } from './remaining.js'
import { addOpinionMod } from './cellstate.js'
import { tickPortrait, reinforcePortraitFromActs } from './portrait.js'
import { isListed, addressed, factionOf } from '../administration/step.js'
const sum = a => a.reduce((s, x) => s + x, 0), clamp01 = x => Math.min(1, Math.max(0, x))

export function updateGrievance(ctx, key) {
  const c = ctx.state.polity.cells[key]; c.grievance ??= {}
  for (const [id, n] of Object.entries(ctx.ruleset.needs)) {
    let shortfall
    if (n.kind === 'material') shortfall = 1 - (c.satisfaction?.[n.tier] ?? 1)
    else if (n.kind === 'fairness') shortfall = clamp01(ctx.derive.polity.fairnessGap(key) * ctx.T('fair.scale')) + sum((c.fairnessMods ?? []).map(m => m.value))
    else { const target = c.target?.[id] ?? 0; shortfall = target > ctx.T('eps.need') ? 1 - (c.delivered?.[id] ?? 0) / target : 0 }
    if (id === 'security') shortfall += clamp01(c.warHarm ?? 0) + (ctx.derive.war?.occupiedShare?.(key) ?? 0)          // war-attributable grievance (also read back as the Exhaustion readout)
    c.grievance[id] = clamp01((c.grievance[id] ?? 0) * (1 - n.decay) + n.accum * clamp01(shortfall))      // leaky accumulator
  } }
export function readDecisionLog(ctx) {                              // attribution = harm x attributability(awareness x causal visibility)
  for (const h of ctx.harmQueue) { const c = ctx.state.polity.cells[h.cell]; if (!c) continue
    const entry = ctx.state.polity.log.find(e => e.id === h.logId), vis = entry ? (entry.visibility === 'public' ? 1 : 0) : 0
    let k = ctx.derive.polity.awareness(h.cell) * vis; if (h.kind === 'war') k = k ** ctx.T('attr.warSteepness')
    if (ctx.derive.polity.awareness(h.cell) < ctx.T('attr.lowAwareness')) k = 0                         // low awareness: blame redirected (fate / local authority)
    c.opinionGovMods ??= []; if (k > 0) c.opinionGovMods.push({ id: `att.${h.logId}`, value: -h.magnitude * k, decay: { kind: 'exp', rateKey: 'opinion.modDecay' }, turn: ctx.state.meta.turn, source: h.logId }) }
  ctx.harmQueue.length = 0 }
/** Economics hand-offs of step 3 (`ctx.polityQueue`), consumed here and drained (spec decisions, confirmed 2026-11-15; sizes are tuning, "numbers pass"):
 *  requisitionHits {cell, target, claimed, delivered, value, shortfall}: the DIRECT Opinion-toward-Government hit of a Requisition — what the cell feels is what was taken,
 *    so a requisition that delivered nothing is no hit; size = req.opinionHit × burden, burden = share of the cell's own market output (base value) that was taken.
 *    The structural hit (Extraction↔Investment) is not a stock: the executed placeRequisition is a public Government act with a direction in the Decision Log (`loads`)
 *    and reaches cells through the alignment channel (portrait.js). The offset by later benefits works only through decay.
 *  defaults {creditor, debtor, principal}: the creditor loses its claim (already gone with the removed obligation) and takes an Opinion hit and a Fairness grievance, size × loss,
 *    loss = principal / (wealth + principal). The debtor's net-position effect is Demotion's `netPosition`; the cross-Country remedy (a Rights-tier CB) is Diplomacy's and not wired. */
export function readPolityQueue(ctx) {
  const Q = ctx.polityQueue ?? {}, turn = ctx.state.meta.turn, P = ctx.state.polity.cells, decay = { kind: 'exp', rateKey: 'opinion.modDecay' }
  for (const h of Q.requisitionHits ?? []) { const c = P[h.cell]; if (!c || !(h.value > 0)) continue
    const burden = h.value / Math.max(1e-9, (c.salesValueBase ?? 0) + h.value)
    addOpinionMod(c, { id: `req.${turn}.${h.target}`, value: -ctx.T('req.opinionHit') * burden, decay: { ...decay }, turn, source: 'requisition' }) }
  for (const d of Q.defaults ?? []) { const c = P[d.creditor]; if (!c) continue
    const loss = d.principal / Math.max(1e-9, (c.wealth ?? 0) + d.principal)
    addOpinionMod(c, { id: `default.${turn}`, value: -ctx.T('default.opinionHit') * loss, decay: { ...decay }, turn, source: 'default' })
    ;(c.fairnessMods ??= []).push({ id: `default.${turn}`, value: ctx.T('default.fairnessHit') * loss, decay: { ...decay }, turn, source: 'default' }) }
  if (Q.requisitionHits) Q.requisitionHits.length = 0
  if (Q.defaults) Q.defaults.length = 0 }
const rungOf = (ctx, m, prev) => { const en = ctx.T('rung.enter'), ex = ctx.T('rung.exit'); let r = 0
  for (let i = 0; i < en.length; i++) if (m >= en[i] || (prev >= i + 1 && m >= ex[i])) r = i + 1; return r }
/** An expired debate (kb 2026-11-20/22): the Government's debate on a Question ended and the Question is still live, i.e. it was not solved in a way the involved actors accept. The estates that asked and were not
 *  satisfied — the cells of the faction that raised it (administration/step.js `factionOf`) — take a minor, decaying Fairness-type grievance modifier; a cell that holds the Petition Right takes it multiplied
 *  (`petition.expiryMult`: moderate instead of minor, Question handling). A debate that reached a comparable concession (Persuasion or a Right granted, `petition.comparable`) leaves no modifier;
 *  neither does a debate that was DECIDED by an adopted answer (kb 2026-11-24, administration/decision.js). */
function expiryModifier(ctx, q, d) {
  if ((d.conceded ?? 0) >= ctx.T('petition.comparable')) return
  const P = ctx.state.polity, turn = ctx.state.meta.turn
  for (const k of factionOf(ctx, q).cells) { const c = P.cells[k]; if (!c) continue
    const mult = ctx.derive.polity.right(k, 'Petition') ? ctx.T('petition.expiryMult') : 1
    ;(c.fairnessMods ??= []).push({ id: `debate.${q.key}`, value: ctx.T('debate.expiryGrievance') * mult, decay: { kind: 'exp', rateKey: 'opinion.modDecay' }, turn, source: 'debate' }) } }
/** A petitioning cell asked to be heard and nobody listens (kb 2026-11-22, confirmed 2026-11-24): after `petition.grace` turns without being discussed its Question takes a LARGE, slowly decaying Fairness modifier on that cell, once. */
function petitionRefusal(ctx, q) {
  const P = ctx.state.polity, turn = ctx.state.meta.turn, e = ((P.petitionClock ??= {})[q.key] ??= { since: turn }), c = P.cells[q.cell]
  if (e.refused || !c || turn - e.since < ctx.T('petition.grace')) return
  e.refused = true; (c.fairnessMods ??= []).push({ id: `petition.${q.key}`, value: ctx.T('petition.refuseHit'), decay: { kind: 'exp', rateKey: 'petition.refuseDecay' }, turn, source: 'petition' }) }
/** Momentum of one Question. Being ADDRESSED freezes the rise (kb 2026-11-19/20, `slate.addressedRise`, 0 = frozen): the Question is addressed only while it is DISCUSSED — a debate is open (opened by the assembly queue
 *  at step 6 for a Question on the slate, or here the turn polity first sees a routine Question in standing administration; it lasts its recorded length, or until the holders decide it) or the Government extends it
 *  (`extendDebates`); a Question on the slate that the queue has not given a slot (`polity.waiting`) is not addressed; the momentum still decays. When the debate ends and the Question is still live, the rise resumes,
 *  the debate is marked `expired` and the faction's cells take the expiry modifier ONCE (not after a decision); it is not addressed again until it has stopped being live. A petitioning cell whose Question is never discussed takes the refusal modifier.
 *  Debates are recorded in `polity.debate[key] = {since, duration, assembly?, holder?, scope?, conceded?, expired?, proposal?, decided?}`. */
export function updateMomentum(ctx, q) {
  const P = ctx.state.polity, m0 = P.momentum[q.key] ?? 0, g = ctx.state.admin?.governments?.[ctx.derive.worldmap.regionOwner(parseCellKey(q.cell).region)]
  if (g && isListed(q, g) && !P.debate?.[q.key] && !P.waiting?.[q.key]) (P.debate ??= {})[q.key] = { since: ctx.state.meta.turn, duration: ctx.T('question.turns.region') }      // standing administration (or a direct call): a debate starts without a queue slot
  const on = addressed(ctx, q, g), d = P.debate?.[q.key]
  if (d && !d.expired && !on) { d.expired = true; if (!d.decided) expiryModifier(ctx, q, d) }                         // the debate ended: once; a decided debate was resolved, so it leaves no modifier
  if (on) delete P.petitionClock?.[q.key]; else if (!d && ctx.derive.polity.right(q.cell, 'Petition')) petitionRefusal(ctx, q)      // heard, or asked and refused
  const rise = ctx.T('mom.rise') * q.gap * (on ? ctx.T('slate.addressedRise') : 1)
  const m = m0 * (1 - ctx.T('mom.decay')) + rise
  P.momentum[q.key] = m; P.rung[q.key] = rungOf(ctx, m, P.rung[q.key] ?? 0) }
export function step5(ctx) {
  const P = ctx.state.polity; P.rung ??= {}
  stepRemainingPolity(ctx)                                  // propaganda, Mobility, Demotion, divergence: before grievance/opinion read the new cells
  for (const k of Object.keys(P.cells)) updateGrievance(ctx, k)
  readDecisionLog(ctx)
  for (const c of Object.values(P.cells)) { for (const key of ['opinionGovMods', 'prestigeMods', 'fairnessMods']) { if (!c[key]) continue
    const s = { baseline: 0, mods: c[key] }; tick(s, ctx); c[key] = s.mods } }
  for (const c of Object.values(P.cells)) for (const ax of Object.keys(c.prefMods ?? {})) { const st = { baseline: 0, mods: c.prefMods[ax] }; tick(st, ctx); c.prefMods[ax] = st.mods }   // preference modifier stacks decay (pref.modDecay)
  tickPortrait(ctx)                                         // Government Portrait reinforcement stacks decay (pref.modDecay)
  reinforcePortraitFromActs(ctx)                            // this turn's Government acts reinforce their Country's Portrait (after the decay pass: full strength when it lands)
  readPolityQueue(ctx)                                      // after the decay pass: a fresh hit lands at full strength and is read from the next turn on
  ctx.bump()
  const qs = ctx.derive.polity.questions(), live = new Set(qs.map(q => q.key))
  for (const q of qs) updateMomentum(ctx, q)
  for (const key of Object.keys(P.debate ?? {})) if (!live.has(key)) delete P.debate[key]      // a Question that stopped being live ends its debate record (resolved or faded: no modifier) ...
  for (const key of Object.keys(P.petitionClock ?? {})) if (!live.has(key)) delete P.petitionClock[key]      // ... and its petition clock
  ctx.state.commitments = ctx.state.commitments.filter(c => c.type !== 'extendDebates' || live.has(c.params.questionKey))      // ... and its extension lapses
  for (const key of Object.keys(P.momentum)) if (!live.has(key)) { P.momentum[key] *= 1 - ctx.T('mom.decay'); if (P.momentum[key] < ctx.T('eps.modifier')) { delete P.momentum[key]; delete P.rung[key] } else P.rung[key] = rungOf(ctx, P.momentum[key], P.rung[key] ?? 0) } }
