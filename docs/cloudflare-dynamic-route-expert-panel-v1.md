# Cloudflare Dynamic Route: `expert-panel-v1`

This route delegates concrete model selection, per-model timeouts, same-company fallbacks, and route versioning to Cloudflare AI Gateway. The Worker remains the fail-closed coordinator for authorization, task locking, task profiling, expert roles, cancellation, cross-company diversity, judge synthesis, and output validation.

## Required gateway settings

- Gateway: `test`
- Authenticated Gateway: enabled
- Provider key: store the OpenRouter key in AI Gateway BYOK/Provider Keys with alias `default`
- Worker secret: `AI_GATEWAY_TOKEN`
- Worker variable: `AI_GATEWAY_ROUTE=expert-panel-v1`

## Cloudflare custom-metadata limit

Cloudflare AI Gateway currently accepts at most five custom metadata entries per request. The Worker therefore emits exactly these five routing fields:

```text
metadata.center = expert
metadata.dynamic_route = expert-panel-v1
metadata.expert_slot = expert-1 | expert-2 | expert-3 | judge | governance
metadata.task_domain = general | legal | finance | coding | quantitative | medical | geospatial | business | policy | science | social | research
metadata.reasoning_depth = standard | deep
```

The Worker may still compute richer internal task-profile fields such as task type, complexity, context size, latency priority, and cost priority, but they are not sent as Cloudflare custom metadata while the five-field platform limit applies. Complexity is already folded into `reasoning_depth`, so high-complexity work routes to the deep branch.

## Responsibility split

### Worker owns

- how many expert seats are requested
- expert role prompts and judge role
- deterministic task profiling
- single-task lock and cancellation
- exact company-diversity validation
- verification of actual `cf-aig-model` and `cf-aig-provider`
- fail-closed policy enforcement
- final synthesis and response validation

### Cloudflare owns

- concrete model ID for each seat
- task-domain/depth-based model specialization
- same-company fallback
- per-model timeout
- route versioning, rollout, and rollback

Cloudflare Dynamic Route rate limiting is intentionally disabled for this route unless explicitly enabled later.

## Runtime request contract

The Worker calls:

```text
POST https://gateway.ai.cloudflare.com/v1/{account_id}/test/compat/chat/completions
model = dynamic/expert-panel-v1
```

## Route graph

Create `test` > Dynamic Routes > `expert-panel-v1`.

Base graph:

```text
Start
  -> expert_slot conditional chain
       expert-1 -> task-profile subtree -> Model -> End
       expert-2 -> task-profile subtree -> Model -> End
       expert-3 -> task-profile subtree -> Model -> End
       judge -> task-profile subtree -> Model -> End
       governance -> task-profile subtree -> Model -> End
       unmatched -> End without model
```

The unmatched branch must terminate without a model. Do not add a universal default model.

## Cloudflare route limits

Do not add a `Rate Limit` node to `expert-panel-v1` at this stage.

Do not add a `Budget Limit` node or percentage split unless a later explicit policy enables them.

Worker-side task locking, cancellation, bounded timeouts, fail-closed checks, and existing internal execution protection remain independent of this Cloudflare route configuration.

## Seat conditions

Chain these conditions in order, all using Custom Metadata:

```text
metadata.expert_slot $eq expert-1
metadata.expert_slot $eq expert-2
metadata.expert_slot $eq expert-3
metadata.expert_slot $eq judge
metadata.expert_slot $eq governance
```

Each false branch goes to the next condition. The final false branch goes directly to `End` with no model.

## Task-profile subtree

Inside each seat, keep the company lane fixed for the deployed route version.

Recommended order:

1. `metadata.reasoning_depth == deep`
   - strongest paid reasoning model in that company lane
2. domain specialization when clearly useful:
   - `metadata.task_domain == coding`
   - `metadata.task_domain == quantitative`
   - `metadata.task_domain == legal`
   - `metadata.task_domain == research`
3. otherwise
   - balanced paid reasoning model in the same company

Every fallback must remain inside the same company lane.

## Model-node policy

- experts timeout: `45000` ms
- judge timeout: `60000` ms
- governance timeout: `30000` ms
- retries: `0`
- success: connect to `End`
- fallback: only a paid, non-Flash model from the same company
- if no suitable same-company fallback exists: leave fallback unconnected and fail closed

## Candidate discovery

OpenRouter remains the external candidate marketplace but is not queried by the Expert Worker during a live task.

Primary discovery query:

```text
GET https://openrouter.ai/api/v1/models?supported_parameters=reasoning&output_modalities=text&sort=intelligence-high-to-low
```

Hard filters:

1. reasoning-capable text model
2. paid model; exclude `:free`
3. exclude OpenAI
4. exclude Anthropic / Claude
5. exclude model IDs containing `flash`
6. exclude expired/deprecated candidates
7. company deduplication before panel assignment

Ranking movement creates a candidate route version; it must not mutate the active deployed version directly.

## Initial company lanes

Until the first ranking-driven refresh is deployed, the initial lanes may be:

| Seat | Initial company lane |
|---|---|
| `expert-1` | Google |
| `expert-2` | DeepSeek |
| `expert-3` | Mistral |
| `judge` | Alibaba/Qwen |
| `governance` | Qwen or another approved paid family |

These are not permanent assignments.

## Change, validation, and rollback

1. Update only a new Dynamic Route draft/version.
2. Keep the currently deployed route unchanged.
3. Run preview with representative domains, deep/standard reasoning, and failure cases.
4. Verify `cf-aig-model`, `cf-aig-provider`, and Worker company-diversity receipts.
5. Deploy only after preview passes.
6. Keep the previous deployed route version for rollback.

Dynamic Routing is Beta, so Worker-side fail-closed checks remain mandatory.
