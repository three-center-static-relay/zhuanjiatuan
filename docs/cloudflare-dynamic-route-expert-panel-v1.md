# Cloudflare Dynamic Route: `expert-panel-v1`

This route delegates concrete model selection, model timeouts, same-company fallbacks, rate limits, and later budget rules to Cloudflare AI Gateway. The Worker remains the fail-closed coordinator for authorization, task locking, task profiling, expert roles, cancellation, cross-company diversity, judge synthesis, and output validation.

## Required gateway settings

- Gateway: `test`
- Authenticated Gateway: enabled
- Provider key: store the OpenRouter key in AI Gateway BYOK/Provider Keys with alias `default`
- Worker secret: `AI_GATEWAY_TOKEN` is the Cloudflare AI Gateway authentication token; it is not the OpenRouter key
- Worker variable: `AI_GATEWAY_ROUTE=expert-panel-v1`

## Responsibility split

### Worker owns

- how many expert seats are requested
- expert role prompts and judge role
- deterministic task profiling
- single-task lock and cancellation
- exact company-diversity validation
- verification of the actual `cf-aig-model` and `cf-aig-provider`
- fail-closed policy enforcement
- final synthesis and response validation

### Cloudflare owns

- concrete model ID for each seat
- task-profile-based model specialization
- same-company fallback
- per-model timeout
- rate limit and later budget limit
- route versioning, rollout, and rollback

The Worker never asks OpenRouter for a model catalog during a live expert task.

## Runtime request contract

The Worker calls:

```text
POST https://gateway.ai.cloudflare.com/v1/{account_id}/test/compat/chat/completions
model = dynamic/expert-panel-v1
```

Every request includes custom metadata:

```text
metadata.center = expert
metadata.dynamic_route = expert-panel-v1
metadata.expert_slot = expert-1 | expert-2 | expert-3 | judge | governance
metadata.task_id = <task id>
metadata.task_domain = general | legal | finance | coding | quantitative | medical | geospatial | business | policy | science | social | research
metadata.task_type = analysis | coding | quantitative | comparison | planning | synthesis | research
metadata.complexity = standard | high
metadata.reasoning_depth = standard | deep
metadata.context_size = short | medium | long
metadata.latency_priority = normal | fast
metadata.cost_priority = quality | balanced | economy
```

Caller-provided hints are allow-listed; unknown values fall back to deterministic profiling instead of becoming arbitrary routing inputs.

## Route graph

Create `test` > **Dynamic Routes** > **Add Route** and name it `expert-panel-v1`.

Base graph:

```text
Start
  -> optional Rate Limit
  -> expert_slot conditional chain
       expert-1 -> expert-1 task-profile subtree -> Model -> End
       expert-2 -> expert-2 task-profile subtree -> Model -> End
       expert-3 -> expert-3 task-profile subtree -> Model -> End
       judge    -> judge task-profile subtree    -> Model -> End
       governance -> governance subtree          -> Model -> End
       unmatched -> End without model
```

The unmatched branch must terminate without a model. Do not add a universal default model.

## Task-profile subtree

Inside each seat, keep the company lane fixed for the deployed route version but choose the concrete model according to task metadata.

Recommended order:

1. `reasoning_depth == deep` OR `complexity == high`
   - strongest paid reasoning model in that company lane
2. `context_size == long`
   - strongest suitable long-context paid model in the same company
3. `latency_priority == fast`
   - lower-latency paid non-Flash model in the same company
4. domain specialization when the company exposes a clearly stronger compatible model for `coding`, `quantitative`, `legal`, or another supported domain
5. otherwise
   - balanced paid reasoning model in the same company

For every Model node:

- experts timeout: `45000` ms
- judge timeout: `60000` ms
- governance timeout: `30000` ms
- retries: `0`
- success: connect to `End`
- fallback: only a paid, non-Flash model from the same company lane
- if no suitable same-company fallback exists: leave fallback unconnected and fail closed

## OpenRouter ranking remains the candidate-discovery pool

OpenRouter remains the external model marketplace used to discover candidates. It is **not** queried by Expert Worker during task execution.

Primary discovery query:

```text
GET https://openrouter.ai/api/v1/models?supported_parameters=reasoning&output_modalities=text&sort=intelligence-high-to-low
```

Candidate filters:

1. reasoning-capable text model
2. paid model; exclude `:free`
3. exclude OpenAI
4. exclude Anthropic / Claude
5. exclude model IDs containing `flash`
6. exclude expired/deprecated candidates
7. prefer models with usable current provider availability
8. deduplicate by model company before assigning panel seats

Ranking policy:

- primary signal: OpenRouter `intelligence-high-to-low`
- secondary health signals when refreshing a route: weekly popularity, latency, throughput, availability, and observed expert-center receipts
- do not automatically promote a newly ranked model directly into production

At route-refresh time, choose the highest-ranked eligible models from distinct companies, assign them to `expert-1`, `expert-2`, `expert-3`, and `judge`, then save a new Cloudflare route version. The deployed version stays pinned until the new version passes preview validation.

This preserves the earlier rule: **reasoning leaderboard from top to bottom, company deduplication, no OpenAI, no Claude, no free models, no Flash models**.

## Why ranking is not fetched at runtime

Cloudflare Dynamic Route Model nodes use explicit provider/model configuration. Runtime floating selection from an external leaderboard would add an uncontrolled dependency and could change panel membership mid-task. Therefore:

```text
OpenRouter ranking -> candidate discovery
Governance refresh -> candidate filtering + company dedup
Cloudflare route version -> pinned production candidates
Expert Worker -> runtime task profile + verification
```

A ranking change creates a new candidate route version; it does not mutate the active route in place.

## Initial company lanes

Until the first ranking-driven refresh is deployed, the existing examples remain valid initial lanes if they are currently available and satisfy the policy:

| Seat | Initial example company |
|---|---|
| `expert-1` | Google |
| `expert-2` | DeepSeek |
| `expert-3` | Mistral |
| `judge` | Alibaba/Qwen |
| `governance` | judge family or another approved paid family |

These companies are **not permanent constitutional assignments**. A later route version may replace them with higher-ranked eligible companies as long as the Worker still observes exact company diversity and all exclusion rules.

## Rate limit

Optional count Rate Limit before the seat conditionals:

- key: `metadata.center`
- limit: `80`
- window: `60` seconds
- over-limit fallback: terminate at `End`

For a more cost-conservative profile use `20 requests / 60 seconds`.

## Change, validation, and rollback

1. Discover and filter candidate models outside the Expert Worker.
2. Update only a new Cloudflare Dynamic Route draft/version.
3. Keep the currently deployed route unchanged.
4. Run preview with representative domains, deep/standard reasoning, long context, and failure cases.
5. Verify response headers `cf-aig-model` and `cf-aig-provider` and Worker company-diversity receipts.
6. Deploy only after preview passes.
7. Keep the previous deployed route version for instant rollback.

Dynamic Routing is beta, so Worker-side fail-closed checks remain mandatory.
