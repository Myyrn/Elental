// ui/views/apparatus.js — Apparatus workspace: the three administrative pools (Control / Coordination / Observation), the Allocation Dials, propaganda, requisitions, the Question slate and the assemblies.
import { h, card, kv, bar, table, fmt, badge } from '../dom.js'
import { openDraft, renderAll } from '../app.js'
import { scopeLabel } from '../scope.js'
const STATUS_TONE = { slate: 'ok', standing: 'ok', debate: 'ok', waiting: 'warn', unaddressed: 'bad' }
export async function render(app) {
  const me = app.me(), g = await app.q('govCard', { country: me }), est = await app.q('estates', { country: me }), sl = await app.q('slate', { country: me })
  const total = g.cco.control + g.cco.coordination + g.cco.observation || 1, ent = (g.controlDial.entries ?? []), granted = est.reduce((s, e) => s, 0)
  const dial = (title, d, kind) => card(title, d.entries?.length ? table([{ key: 'target', label: 'scope', render: r => scopeLabel(r.target?.kind === 'empire' ? { kind: 'empire' } : r.target) }, { key: 'floor', label: 'floor', num: true }, { key: 'priority', label: 'priority', num: true }, { key: 'surplusWeight', label: 'surplus weight', num: true }], d.entries) : h('p', { class: 'muted' }, 'no entries'), kind ? h('div', { class: 'row' }, h('button', { id: 'draft-control', onclick: () => openDraft(kind) }, 'Add / replace an entry for the current Scope')) : null)
  const slate = card('Question slate and debates', sl.questions.length ? table([{ key: 'status', label: 'status', render: r => badge(r.status, STATUS_TONE[r.status]) }, { key: 'tier', label: 'tier' }, { key: 'need', label: 'issue' }, { key: 'cell', label: 'cell' }, { key: 'gap', label: 'gap', num: true, render: r => fmt(r.gap, 2) }, { key: 'priority', label: 'priority', num: true, render: r => fmt(r.priority, 1) },
    { key: 'debate', label: 'debate', render: r => (r.debate ? `since ${r.debate.since}${r.debate.expired ? ' · expired' : ''}${r.debate.assembly ? ' · ' + r.debate.assembly : ''}` : '') }], sl.questions) : h('p', { class: 'muted' }, 'No live Questions.'),
    kv({ 'On the slate (attention)': sl.attention.length, 'Standing administration (routine)': sl.standing.length, 'Waiting for a debating slot': sl.waiting.length, Unaddressed: sl.unaddressed.length, 'Coordination supply': sl.coordinationSupply, 'Held by debate extensions': `${Math.round(sl.heldShare * 100)}%` }),
    sl.assemblies.length ? table([{ key: 'assembly', label: 'assembly' }, { key: 'cap', label: 'queue cap', num: true }, { key: 'open', label: 'open debates', num: true }, { key: 'slots', label: 'slots', render: r => Object.entries(r.slots).map(([k, v]) => `${k === 'government' ? 'Government' : k}: ${v}`).join(' · ') }], sl.assemblies) : null,
    sl.extensions.length ? table([{ key: 'id', label: 'extension' }, { key: 'questionKey', label: 'Question' }, { key: 'turns', label: 'turns beyond the natural length', num: true }], sl.extensions) : null,
    h('div', { class: 'row' }, h('button', { id: 'draft-extend', onclick: () => openDraft('extendDebates') }, 'Extend a debate'), h('button', { onclick: () => openDraft('liftExtendDebates') }, 'Lift an extension')))
  return h('div', null, h('div', { class: 'row toolbar' }),
    card('Administrative pools (CCO)', h('div', { class: 'stack' }, [['Control', g.cco.control, 'ok'], ['Coordination', g.cco.coordination, 'warn'], ['Observation', g.cco.observation, 'muted']].map(([n, v, t]) => h('div', { class: 'row' }, h('span', { class: 'lbl' }, n), bar(v / total, { tone: t }), fmt(v, 0)))),
      kv({ 'Control supply': g.controlSupply, 'Control bonus (Demotion)': g.controlBonus, 'Martial-law cost': g.martialCost, 'Propaganda draw (Coordination)': g.propagandaDraw })),
    slate,
    dial('Control Allocation Dial', g.controlDial, 'setControlAllocation'), dial('Observation Dial', g.observationDial, null),
    card('Spending', kv({ Ledger: g.ledger, 'Reserve': g.spendingDial.reserve ?? 0, Sink: g.spendingDial.sink ?? 'keep' }), h('div', { class: 'row' }, h('button', { onclick: () => openDraft('setSpendingDial') }, 'Edit reserve'))),
    card('Government propaganda', g.propaganda.length ? table([{ key: 'id', label: 'id' }, { key: 'amount', label: 'Coordination', num: true }, { key: 'ideal', label: 'ideal', render: r => (r.ideal ? JSON.stringify(r.ideal) : 'amalgam') }, { key: 'targets', label: 'targets', render: r => scopeLabel(r.targets?.kind === 'empire' ? { kind: 'empire' } : r.targets) }], g.propaganda) : h('p', { class: 'muted' }, 'No propaganda running.'),
      h('div', { class: 'row' }, h('button', { onclick: () => openDraft('propaganda') }, 'Start propaganda for the current Scope'), h('button', { onclick: () => openDraft('liftPropaganda') }, 'Lift'))))
}
