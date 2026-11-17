// worldmap/actions.js — Region administration: the Reorganization Event and the Region capital setting (kb World Map: Region; spec: world_map__spec.md).
import { applyReorg } from './reorg.js'

export function registerWorldmapActions(reg) {
  // Event Draft: split / merge / move provinces between Regions. Gated by every Veto holder of the Country (domain administration); queued, applied once at step 8 (module.js).
  // `impact` is zero: the self-interest side of the gating (entitlement loss for worsened laws) is not modelled yet (spec: Not in code).
  reg.register({ id: 'reorganizeRegions', module: 'worldmap', class: 'event', gateDomain: () => 'administration', defaultVisibility: 'public',
    validate: (ctx, a) => { const r = applyReorg(ctx.state.world, a.actor.country, a.params?.ops); return r.ok ? { ok: true } : { ok: false, reasons: r.reasons } },
    costs: () => [], impact: () => ({ cost: 0, relief: 0 }),
    apply: (ctx, a) => { (ctx.state.world.pendingReorg ??= []).push({ country: a.actor.country, ops: structuredClone(a.params.ops) }) } })
  // The capital is a stored administrative setting of a Region of the actor's Country; it must be a province of that Region.
  reg.register({ id: 'setRegionCapital', module: 'worldmap', class: 'event', gateDomain: () => null, defaultVisibility: 'public',
    validate: (ctx, a) => { const { region, province } = a.params ?? {}, w = ctx.state.world, ps = Object.entries(w.regionSnapshot.assignment).filter(([, r]) => r === region).map(([p]) => p)
      if (!ps.length) return { ok: false, reasons: ['unknown Region'] }
      if ((w.regionSnapshot.owners?.[region] ?? w.provinces[ps[0]]?.owner) !== a.actor.country) return { ok: false, reasons: ['not your Region'] }
      return ps.includes(province) ? { ok: true } : { ok: false, reasons: ['the capital must be a province of the Region'] } },
    costs: () => [], apply: (ctx, a) => { ((ctx.state.world.regions ??= {})[a.params.region] ??= {}).capital = a.params.province } })
}
