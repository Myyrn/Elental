// worldmap/actions.js — Region administration (the Reorganization Event and the Region capital setting) and population moves (the `settle` cell action, direct resettlement, Expulsion, free colonization).
// kb World Map: Region, Population dynamics; spec: world_map__spec.md.
import { covers } from '../../kernel/scope.js'
import { applyReorg } from './reorg.js'
import { planForcedMove, scopeFor, queueMove, settleProposal, settleUtility, checkSettle } from './migration.js'

// Forced moves (direct resettlement = 'resettle', Expulsion = 'expel'): Event Drafts with a dry-run preview (`validate` = planForcedMove), gated by the Veto holders of domain administration (the ruleset has no movement
// domain), queued and applied once at step 8 (module.js). `impact` = the covered cells' entitlement loss (Expulsion: maximal; resettlement: the share moved, where the Movement autonomy Right is held).
const forced = kind => ({ module: 'worldmap', class: 'event', gateDomain: () => 'administration', defaultVisibility: 'public', costs: () => [],
  axisLoads: kind === 'expel' ? { ruthlessness_restraint: -1, homogenizing_pluralist: -1 } : {},
  validate: (ctx, a) => { const r = planForcedMove(ctx, a.actor.country, kind, a.params); return r.ok ? { ok: true } : { ok: false, reasons: r.reasons } },
  impact: (ctx, a, key) => { let hit = false; try { hit = covers(a.params.scope, key, scopeFor(ctx, a.actor.country)) } catch { hit = false }
    if (!hit) return { cost: 0, relief: 0 }
    const held = kind === 'expel' || ctx.derive.polity.right(key, 'MovementAutonomy') !== false
    return { cost: held ? Math.min(1, Math.max(0, kind === 'expel' ? 1 : (a.params.share ?? 1))) : 0, relief: 0 } },
  apply: (ctx, a) => queueMove(ctx, { kind, country: a.actor.country, params: a.params }) })

export function registerWorldmapActions(reg) {
  // Event Draft: split / merge / move provinces between Regions. Gated by every Veto holder of the Country (domain administration); queued, applied once at step 8 (module.js).
  // `impact` is zero: the self-interest side of the gating (entitlement loss for worsened laws) is not modelled yet (spec: Not in code).
  reg.register({ id: 'reorganizeRegions', module: 'worldmap', class: 'event', gateDomain: () => 'administration', defaultVisibility: 'public',
    validate: (ctx, a) => { const r = applyReorg(ctx.state.world, a.actor.country, a.params?.ops); return r.ok ? { ok: true } : { ok: false, reasons: r.reasons } },
    costs: () => [], impact: () => ({ cost: 0, relief: 0 }),
    apply: (ctx, a) => { (ctx.state.world.pendingReorg ??= []).push({ country: a.actor.country, ops: structuredClone(a.params.ops) }) } })
  // The capital is a stored administrative setting of a Region of the actor's Country (a dial: free to change, no gate, kb Lifecycle classes 2026-11-17); it must be a province of that Region.
  reg.register({ id: 'setRegionCapital', module: 'worldmap', class: 'dial', gateDomain: () => null, defaultVisibility: 'public',
    validate: (ctx, a) => { const { region, province } = a.params ?? {}, w = ctx.state.world, ps = Object.entries(w.regionSnapshot.assignment).filter(([, r]) => r === region).map(([p]) => p)
      if (!ps.length) return { ok: false, reasons: ['unknown Region'] }
      if ((w.regionSnapshot.owners?.[region] ?? w.provinces[ps[0]]?.owner) !== a.actor.country) return { ok: false, reasons: ['not your Region'] }
      return ps.includes(province) ? { ok: true } : { ok: false, reasons: ['the capital must be a province of the Region'] } },
    costs: () => [], apply: (ctx, a) => { ((ctx.state.world.regions ??= {})[a.params.region] ??= {}).capital = a.params.province } })
  // Government: move the population of cells / a Nation / an Estate (any scope) into a province of the Country, or expel it across the border; both are previewed by planForcedMove.
  reg.register({ id: 'directResettlement', ...forced('resettle') })
  reg.register({ id: 'expel', ...forced('expel') })
  // Free colonization (kb 2026-11-19): a STANDING commitment of the Government, no gate (it compels no one). `incentive` raises the pull toward unsettled provinces of the Country and is paid per arriving settler
  // from the Government's ledger (migration.js `stepMigration`); it lapses while the ledger is empty. The Settlement / Movement autonomy Rights are its lifted restrictions (reformRightsDuties).
  reg.register({ id: 'freeColonization', module: 'worldmap', class: 'commitment', gateDomain: () => null, defaultVisibility: 'public', costs: () => [], axisLoads: {},
    validate: (ctx, a) => (a.actor.kind === 'government' && a.params?.incentive > 0 ? { ok: true } : { ok: false, reasons: ['a Government order with incentive > 0 is required'] }),
    apply: (ctx, a) => { ctx.state.commitments.push({ id: a.id, actor: a.actor, type: 'freeColonization', claims: [], since: ctx.state.meta.turn, renew: true, params: { incentive: a.params.incentive } }) },
    affectedCells: () => [] })
  reg.register({ id: 'liftFreeColonization', module: 'worldmap', class: 'event', gateDomain: () => null, defaultVisibility: 'public', costs: () => [], axisLoads: {},
    validate: (ctx, a) => (ctx.state.commitments.some(c => c.id === a.params?.id && c.type === 'freeColonization' && c.actor.country === a.actor.country) ? { ok: true } : { ok: false, reasons: ['no such commitment of yours'] }),
    apply: (ctx, a) => { ctx.state.commitments = ctx.state.commitments.filter(c => c.id !== a.params.id) } })
  // Cell action (settlement route 2, kb): a crowded cell sends a cohort to an unsettled province of its own Country, paying from its Wealth; permitted unless the Settlement Right is false.
  reg.register({ id: 'settle', module: 'worldmap', class: 'event', cellAvailability: 'permitted', minRung: 1, defaultVisibility: 'public', costs: () => [], axisLoads: {},
    propose: (ctx, key) => settleProposal(ctx, key), utility: (ctx, key, p) => settleUtility(ctx, key, p),
    validate: (ctx, a) => { const r = checkSettle(ctx, a.actor.key, a.params); return r.ok ? { ok: true } : r },
    apply: (ctx, a) => queueMove(ctx, { kind: 'settle', cell: a.actor.key, province: a.params.province, amount: (a.params.amount ?? 0) * (a.params.scale ?? 1) }) })
}
