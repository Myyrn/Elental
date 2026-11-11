// ai/diplomacy/config.js — authored AI-Diplomacy data with code defaults; ruleset.aiDiplomacy overrides any field. Spec: ai_diplomacy__spec.md §4
export const TIER_ROLE = { BenevolentNeutrality: 'treatyBN', Defensive: 'treatyDef', StandingOffensive: 'treatyOff', Guarantee: 'guarantee', Coalition: 'coalition' }
export const DEFAULT_CONFIG = {
  enabled: false,                                         // opt-in until the designer turns the agent on
  initialOpinion: {},                                     // { 'A>B': -100..100 } seed for opinion (no Country-to-Country opinion stock exists yet)
  postureGate: { Ally: ['Court', 'Support', 'Secure'], Partner: ['Court', 'Support', 'Secure'], Wary: ['Secure', 'Squeeze', 'Court'], Dominate: ['Strike', 'Squeeze', 'Provoke', 'Secure'] },   // list order breaks value ties
  campaignFocus: {
    Court: ['treatyBN', 'treatyDef', 'propaganda:overt'], Support: ['treatyDef', 'treatyOff', 'guarantee', 'coalition'], Secure: ['treatyBN', 'treatyDef', 'influence'],
    Squeeze: ['treatyBN:neighbours', 'treatyDef:neighbours', 'propaganda:covert', 'influence'], Provoke: ['frame', 'selfFlag', 'influence'], Strike: ['declareWar', 'coalition:request'] },
  // signed expected change in the AI's relative leverage per unit magnitude, by category (placeholders)
  effects: {
    treatyBN: { economic: 0.1, diplomatic: 0.5, military: 0.1, cultural: 0 }, treatyDef: { economic: 0.1, diplomatic: 0.6, military: 0.4, cultural: 0 }, treatyOff: { economic: 0, diplomatic: 0.5, military: 0.6, cultural: 0 },
    guarantee: { economic: 0, diplomatic: 0.4, military: 0.2, cultural: 0 }, coalition: { economic: 0, diplomatic: 0.3, military: 0.3, cultural: 0 },
    propaganda: { economic: 0, diplomatic: 0.1, military: 0, cultural: 0.5 }, influence: { economic: 0, diplomatic: -0.2, military: 0, cultural: 0.3 },
    frame: { economic: 0, diplomatic: 0.4, military: 0.2, cultural: 0 }, selfFlag: { economic: 0, diplomatic: 0.4, military: 0.2, cultural: 0 },
    declareWar: { economic: -0.3, diplomatic: -0.3, military: 1, cultural: 0 } },
  postureFactor: { Ally: 1.5, Partner: 1.2, Wary: 0.6, Dominate: -0.2 },     // how much a proposal's value counts, by posture toward the proposer
}
export const config = ctx => ({ ...DEFAULT_CONFIG, ...(ctx.ruleset?.aiDiplomacy ?? {}) })
