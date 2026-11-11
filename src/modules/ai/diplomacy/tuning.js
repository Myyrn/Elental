// ai/diplomacy/tuning.js — AI-Diplomacy tuning defaults (all placeholders; numbers pass). A scenario's tuning.defaults.json may override any key.
// Spec: ai_diplomacy__spec.md §7
export const DEFAULTS = {
  'ai.dip.w.ruth': 0.5, 'ai.dip.posture.w.opinion': 0.4, 'ai.dip.posture.w.rep': 0.2, 'ai.dip.posture.w.shared': 0.2, 'ai.dip.posture.w.tariff': 0.1, 'ai.dip.posture.w.cb': 0.1,
  'ai.dip.posture.tAlly': 0.6, 'ai.dip.posture.tPartner': 0.2, 'ai.dip.posture.tDominate': 0.25, 'ai.dip.posture.band': 0.05,
  'ai.dip.bop.margin': 0.1, 'ai.dip.bop.growth': 0.05, 'ai.dip.bop.gain': 2,
  'ai.dip.switchMargin': 0.1, 'ai.dip.maxCampaigns': 4, 'ai.dip.minValue': 0.05, 'ai.dip.focus': 0.3, 'ai.dip.strike.edge': 0.3,
  'ai.dip.budget.reserve': 0.1, 'ai.dip.budget.proposals': 3, 'ai.dip.cost.labour': 0.5, 'ai.dip.cost.exposure': 0.3, 'ai.dip.cost.harmAlly': 0.4, 'ai.dip.selfFlag.harm': 0.0005,
  'ai.dip.neg.accept': 1.0, 'ai.dip.neg.walk': 0.4,
}
export const T = (ctx, key) => { const v = ctx.ruleset?.tuning?.[key]?.value ?? DEFAULTS[key]; if (v === undefined) throw new Error(`missing AI tuning key ${key}`); return v }
