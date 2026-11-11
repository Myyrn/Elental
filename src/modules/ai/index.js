// ai/index.js — all AI orders for one turn (called from the engine client's aiOrders). simpleWar + simpleDiplomacy always run;
// AI-Diplomacy and AI-War hooks run only when ruleset.aiDiplomacy.enabled === true.
import { simpleWarOrders } from './simpleWar.js'
import { simpleDiplomacyOrders } from './simpleDiplomacy.js'
import { diplomacyOrders } from './diplomacyAgent.js'
import { aiWarOrders } from './aiWar.js'
export const aiOrders = ctx => [...simpleWarOrders(ctx), ...simpleDiplomacyOrders(ctx), ...(ctx.ruleset.aiDiplomacy?.enabled === true ? [...diplomacyOrders(ctx), ...aiWarOrders(ctx)] : [])]
