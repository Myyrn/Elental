// ai/actions.js — the pseudo-action `aiMemo`: persists the AI cache (posture hysteresis memory, Campaigns) into state.ai. Never submitted by a player.
// aiOrders() runs on a cloned ctx, so the agent cannot write state itself; this goes through the ordinary order path. Spec: ai_diplomacy__spec.md §2
export function writeCache(ctx, country, cache) {
  const d = ((ctx.state.ai ??= {}).diplomacy ??= { posture: {}, campaigns: {} })
  for (const k of Object.keys(d.posture)) if (k.startsWith(`${country}|`)) delete d.posture[k]
  Object.assign(d.posture, cache.posture ?? {}); d.campaigns[country] = cache.campaigns ?? [] }
export function registerAiActions(reg) {
  reg.register({ id: 'aiMemo', module: 'ai', class: 'event', gateDomain: () => null, defaultVisibility: 'covert', costs: () => [],
    validate: (ctx, a) => (ctx.state.countries[a.params?.country] && a.params.country === a.actor.country ? { ok: true } : { ok: false, reasons: ['bad AI memo'] }),
    apply: (ctx, a) => writeCache(ctx, a.params.country, a.params.cache) })
}
