# Cloudflare Dynamic Route: `expert-panel-v1` — Adaptive Panel V2

## Operating principle

Do **not** construct this route manually in the dashboard. The canonical route is generated from code and written through the Cloudflare AI Gateway REST API.

```text
npm run route:plan          # no Cloudflare mutation
npm run route:version-only  # create new route version, do not deploy
npm run route:apply         # create, validate, deploy
```

The writer is `scripts/apply-adaptive-expert-route.mjs`.

## What is dynamic

No permanent expert roster exists. The system adapts all of the following per task:

- number of experts: 1–6
- expert professions/titles
- expert mandates and adversarial viewpoints
- judge count: 0–2
- one or two deliberation rounds
- parallel / serial / hybrid execution topology
- company lane allocation
- capability family
- reasoning depth
- free-first / balanced / quality-first cost mode
- concrete model
- same-company fallback
- safe challenger/canary model during explicit exploration

The route maintains eight distinct company lanes. A new ranking refresh may place different companies in those lanes; `lane-1` is not permanently Google/DeepSeek/etc.

## Candidate discovery

OpenRouter reasoning-capable text models are read using six server-side ranking signals:

1. `intelligence-high-to-low`
2. `latency-low-to-high`
3. `throughput-high-to-low`
4. `context-high-to-low`
5. `pricing-low-to-high`
6. `top-weekly`

Hard exclusions remain:

- OpenAI
- Anthropic / Claude
- model IDs containing `flash`
- expired models
- synthetic/random routers and ensemble wrappers

Free models are allowed. Specific `:free` variants and zero-price reasoning models may enter a lane. `openrouter/free` is excluded from the auditable core because its internal random model choice would defeat preassigned company-lane independence.

## Five Cloudflare metadata fields

Cloudflare currently permits five custom metadata entries per request. They are all used for routing:

```text
stage       = planner | expert | judge | governance
lane        = 1..8
capability  = domain-expert | evidence | risk | adversarial | systems | strategy | quantitative | coding | forecasting | legal | medical | finance | research | creative | synthesis
depth       = standard | deep
cost_mode   = free-first | balanced | quality-first
```

The human-readable profession and mandate remain in the prompt and can be completely task-specific.

## Runtime architecture

```text
Question
  -> deterministic initial task profile
  -> Cloudflare-routed panel architect
  -> dynamic panel plan
       1-6 experts
       0-2 judges
       1-2 rounds
       topology
       professions
       mandates
       capabilities
       cost mode
  -> unique lane allocation
  -> Cloudflare Dynamic Route
       lane condition
       cost-mode condition
       stage/depth/capability condition
       concrete model
       same-company fallback
  -> optional second-round cross-challenge
  -> judge / final adjudicator
  -> Worker validates actual model/provider/company receipts
  -> final answer
```

## Cloudflare capabilities used

Production route uses:

- Conditional nodes
- Model nodes
- Model timeout
- Model fallback
- Percentage split reserved for explicit exploration/canary mode
- Route versions
- Deployments / rollback
- BYOK provider keys
- authenticated gateway
- response model/provider metadata

Rate Limit is intentionally not added because route-level rate limiting was explicitly disabled for this expert route. Budget Limit is not hard-coded because no fixed budget has been specified; cost behavior is instead selected per task through `cost_mode`.

## Free/paid behavior

`free-first`:
- choose the strongest eligible free model in the assigned company lane when available;
- fall back inside the same company, including to a paid model if necessary.

`balanced`:
- use multi-signal balanced scoring;
- free or paid can win depending on quality, latency, throughput and context.

`quality-first`:
- prioritize the lane's strongest reasoning model regardless of price;
- same-company fallback remains mandatory.

High-complexity/high-stakes profiles normally become `quality-first`; explicit economy requests can become `free-first`.

## Safe evolution

A ranking refresh never mutates the live graph in place:

```text
OpenRouter refresh
  -> score/filter/deduplicate
  -> generate candidate route JSON
  -> create new Cloudflare route version
  -> validate version
  -> preview/runtime acceptance
  -> deploy version
  -> retain prior version for rollback
```

Percentage split is reserved for explicit exploration (`cost_mode=explore`) and compares a champion/challenger **inside the same company lane**, preventing experimental traffic from breaking cross-company panel independence. Normal expert tasks never request `explore`.

## Credentials

Inference path:

- `AI_GATEWAY_TOKEN` in Expert Worker
- OpenRouter provider key stored in Cloudflare AI Gateway BYOK

Control-plane writer:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_AI_GATEWAY_API_TOKEN` with `AI Gateway Write`

The control-plane token must never be placed in source code or chat.

## Acceptance requirements

Do not merge this PR until all of the following have real receipts:

1. generated route version is accepted as valid by Cloudflare;
2. eight distinct company lanes are present;
3. a minimal task can use 1 expert + 1 judge;
4. a complex task generates multiple task-specific professions;
5. a two-round panel completes;
6. a concrete `:free` model can execute successfully;
7. paid models remain available for quality-first routing;
8. `cf-aig-model` and `cf-aig-provider` are returned for every participant;
9. expert/judge companies are distinct for a panel;
10. forbidden companies/models fail closed;
11. previous route version remains available for rollback.
