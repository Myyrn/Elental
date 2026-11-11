# AI — Diplomacy — Knowledge Base

Status: first design pass, 2026-11-11 (designer input). Alpha demonstration AI: heavy on international diplomacy, alliances and manoeuvring toward conflict; internal politics on autopilot (nuances deferred). **The player is an ordinary Country**: no code path treats the player specially. Items tagged **(proposed)** await the designer's OK.

## Data Structures

### Principles
- **Same surface as the player.** The AI acts only through the Action Catalogue and the ordinary actions the player has (`diplomacy__kb.md`, `actions__kb.md`). It owns no hidden numbers, bonuses or privileged state.
- **Derived over stored.** Everything below is a readout over ground-truth stocks and the Decision Log, except the two cached records named under Posture and Campaign.
- **Deterministic utility AI**, no LLM at runtime; one module (`src/modules/ai_diplomacy.js`).

### Posture(A → B) (derived)
```
Posture ∈ { Ally, Partner, Wary, Dominate }       // A's stance toward Country B
inputs: opinion(A,B), Reputational Leverage stacks, Leverage readouts (A vs. B or bloc),
        CBs held either way, tariff_asymmetry, shared-threat score, balance-of-power term
cache:  posture_cached(A,B) with a hysteresis band; if lost it is re-derived without the band
```
- The initial `opinion` toward a Country seeds its starting posture. Sustained behaviour can flip it in either direction.
- The player is just another B. A friendly start toward the player yields Ally/Partner behaviour; a hostile one yields Wary/Dominate behaviour — through the same function every other Country goes through.

### Campaign (stored, cached intent)
```
Campaign { target: Country | bloc, type, since_turn }
type ∈ { Court, Secure, Squeeze, Provoke, Strike, Support }   // working list; extendable
```
- A campaign is A's current intent toward a target. It adds a **focus bonus** to the score of actions aligned with its type; it does not forbid other actions, so playbooks still run in parallel.
- A may hold several campaigns at once (different targets, or different types toward one target).
- **Free switching with hysteresis.** Starting, ending or switching a campaign costs no action and no labour. A candidate type replaces the current one only when its score exceeds the current type's by a **switch margin**: small, so the AI stays flexible, but not zero, so it does not flip-flop. The existential-threat override and a sudden opportunity (e.g. a CB just opened, the target's alliance just collapsed) bypass the margin.
- Campaign records are cache: if lost, they are re-derived from posture, Contested Assets and the Decision Log.

### Leverage weights (decision-time)
Per decision, the four Leverage readouts (Economic, Diplomatic, Military, Cultural) are weighted from A's Portrait (e.g. Ruthlessness raises Military; `diplomacy__kb.md`). The existential-threat override applies as written there. No stored aggregate.

### Contested Asset (derived readout)
```
contested_value(asset, A, R) = A's valuation of the asset (from ground-truth stocks: output,
                               population, trade edges, strategic position)
                               × how soon rival R could secure it (reach by Military/Economic
                               Leverage, border contact, alliance access)
```
Assets include Regions and provinces, trade edges and partners, and unaligned Countries as allies. Rivals are any Countries, the player included. Formula and numbers: numbers pass.

### Action Score
```
score(action, target) = Σ_category weight × expected_gain  −  cost (labour, reputation, CB risk)
                        + campaign focus bonus
```
The Decision Log is read as evidence (what has already been tried, what worked, what is in progress) for campaign switching and for pricing repeated actions.

## Rules
1. **Symmetry.** Posture toward the player, an AI Country, or any other Country is computed by one function; there is no player-vs-computer branch.
2. **Parallel portfolio, not a ladder.** Each turn the AI scores every available action against every relevant target and spends Diplomacy/Espionage labour on a breadth portfolio. Thresholds are binary and target-scaled, so breadth beats depth. Actions of different campaigns run simultaneously.
3. **Strengthen first.** The AI builds its own forces and economy and secures the highest `contested_value` assets before any rival can (Secure campaigns).
4. **Provocation toward a CB** (all through existing actions): (a) goad — hostile unilateral acts (tariffs, embargo, Show of Force) that invite retaliation and open a CB for the AI (e.g. the tariff-asymmetry CB); (b) frame — a covert false-flag act against a third Country that implicates the target, giving that third Country a CB against the target which the AI can back as a Coalition; (c) **self-targeted false flag** — a covert false-flag act against the AI's own Region that implicates the target, making the AI the victim with a CB against the target; (d) use standing CBs (structural claims, militaristic disposition, unremedied breaches, occupied territory). Exposure of a false flag costs the true sender Reputational Leverage and a CB (`diplomacy__kb.md`); the AI prices that risk, and the cost of harming its own Region, before choosing (b) or (c).
5. **Finish.** The AI declares war when it holds a CB it can use proportionately (overreach is priced), the Military readout is favourable or the existential override applies, and its allies and coalitions are in place (Strike campaign). Declare War, deployment and army handling are War's actions (AI-War hooks).
6. **Alliance squeeze.** The AI builds an alliance and trade network around a rival: treaties with the rival's neighbours and trading partners, Tariff Exemptions and Trade Agreements to them, recruiting others into an Embargo so it becomes great-power-backed. The aim is to lower the rival's Economic and Diplomatic readouts and its access, slowly (Squeeze campaign).
7. **Balance of power.** A shared-threat score and a balance-of-power term push the AI to counterweight whoever's Leverage readouts grow fastest, the player included. Dominant Countries are therefore contested, in line with the design thesis.
8. **Ally behaviour (posture Ally/Partner; Court/Support campaigns).** Improve Relations on refresh, Trade Agreement, Tariff Exemption, Gifts/Facilitation Grants, Guarantee, climbing the chain Benevolent Neutrality → Defensive Pact → Standing Offensive as trust grows, Coalition offers when the partner is at war. An ally does not honour a Defensive trigger whose CB is not externally recognized (Rule 8, `diplomacy__kb.md`), and drifts toward Wary when promises are broken (Reputational stack).
9. **Negotiation.** The AI accepts, rejects, or makes one counter-step per round, evaluates terms by its satisfaction readout, and withdraws when satisfaction falls under its walk-out threshold. Withdrawing as the stronger party leaves the decaying mark; the AI prices it like any other cost.
10. **Internal politics on autopilot.** The AI uses only actions the player also has (Allocation Dial defaults, the standing spending dial with its reserve floor). It has no hidden stability number; neglect has the same consequences as it would for a neglectful player. Internal nuance is deferred.
11. **Fog.** Alpha reads exact data; once fog-of-war exists the AI reads estimates (post-alpha).

## Cross-references
- **Diplomacy** — Action Catalogue, Leverage readouts, CB tiers and persistence, false flags (the wording must permit a self-targeted false flag, see Status), Negotiation Session, `diplomacy__kb.md`.
- **War** — AI-War keeps a minimal alpha interface: border deployment (feeds Show of Force), Declare War, default army handling (`war__kb.md`, `ai_war__doc.md`).
- **Actions** — Decision Log (evidence), Allocation Dial, spending dial (`actions__kb.md`).
- **Economics** — tariff mechanics for Impose Tariff / Tariff Exemption (`economics__kb.md`).
- **Internal Politics / Administration** — Portrait as the AI's behaviour source; the AI Government's values are the Weight-weighted amalgam of the most powerful cells (`internal_politics__kb.md`, `administration__kb.md`).

## Status
- **2026-11-11 — settled (designer input)**: AI-Diplomacy is a deterministic utility AI with posture-driven playbooks; the four-value Posture enum with a hysteresis cache; initial opinion seeds posture and sustained behaviour can flip it; the player is an ordinary Country; actions run in parallel (no strict ladder); a stored **Campaign** record carries current intent, with free switching between types and a small switch margin for hysteresis; the balance-of-power term; the AI strengthens itself and secures contested assets first, provokes or fabricates a CB (goading, framing a third Country, or a false flag against its own Region), then finishes with war, and builds an alliance network to squeeze rivals; internal politics on autopilot with no artificial stability floor; minimal AI-War hooks; no doc layer.
- **Proposed (awaiting OK)**: the Campaign type list; the focus-bonus mechanism; the bypass for existential threats and sudden opportunities.
- **Open**: how the AI estimates the target's detection strength; Contested Asset formula; the Portrait → appetite mapping beyond the Military weight; all numbers, including the switch margin and the Posture hysteresis band (numbers pass).
- **Not yet done**: check `diplomacy__kb.md` false-flag wording against Rule 4(c) and amend if it excludes the sender's own Region; spec (`ai_diplomacy__spec.md`), code, tests, `ui__kb.md` hooks, `.outline/`, `index.md` module row 13.
