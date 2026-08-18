# Cloudflare Dynamic Route: `expert-panel-v1`

This route moves model choice, model timeouts, and same-company fallbacks out of
the Worker and into a versioned Cloudflare AI Gateway route. The Worker remains
the fail-closed coordinator for authorization, task locking, expert roles,
cancellation, cross-company diversity, judge synthesis, and output validation.

## Required gateway settings

- Gateway: `test`
- Authenticated Gateway: enabled
- Provider key: store the OpenRouter key in AI Gateway BYOK/Provider Keys with
  alias `default`
- Worker secret: `AI_GATEWAY_TOKEN` is the Cloudflare AI Gateway authentication
  token; it is not the OpenRouter key
- Worker variable: `AI_GATEWAY_ROUTE=expert-panel-v1`

## Route graph

Create `test` > **Dynamic Routes** > **Add Route** and name it
`expert-panel-v1`. Build this fail-closed graph:

1. **Start**
2. Optional count **Rate Limit**:
   - key: `metadata.center`
   - limit: `80`
   - window: `60` seconds
   - leave fallback unconnected so quota exhaustion terminates the request
3. Chain **Conditional** nodes in this exact order:
   - `metadata.expert_slot $eq expert-1`
   - `metadata.expert_slot $eq expert-2`
   - `metadata.expert_slot $eq expert-3`
   - `metadata.expert_slot $eq judge`
   - `metadata.expert_slot $eq governance`
4. Connect each true branch to a paid reasoning **Model** node. Use four
   different model companies for `expert-1`, `expert-2`, `expert-3`, and
   `judge`. Keep the `governance` branch on the judge family or another paid
   family.
5. Every Model node:
   - retries: `0`
   - timeout: `45000` ms for experts, `60000` ms for judge, `30000` ms for governance
   - success: connect to **End**
   - fallback: connect only to a paid, non-Flash model from the same company;
     otherwise leave it unconnected and fail closed
6. Connect the final unmatched conditional output to **End** without a model so
   unknown slots fail instead of silently using a default model.
7. Save a version, then deploy that version. Keep the prior deployed version for
   instant rollback.

## Model-family policy

Recommended company lanes (choose the currently available paid reasoning model
shown by the dashboard):

| Slot | Company lane | Existing known compatible example |
|---|---|---|
| `expert-1` | Google | `google/gemini-2.5-pro` |
| `expert-2` | DeepSeek | `deepseek/deepseek-r1` |
| `expert-3` | Mistral | `mistralai/magistral-medium` |
| `judge` | Alibaba/Qwen | `qwen/qwen3-235b-a22b` |
| `governance` | Alibaba/Qwen | same paid Qwen family |

Do not select OpenAI, Anthropic/Claude, `:free`, or Flash models. If one of the
example model IDs is absent, select the current paid reasoning model from the
same company lane; do not move a fallback into another lane.

## Request contract

The Worker calls:

```text
POST https://gateway.ai.cloudflare.com/v1/{account_id}/test/compat/chat/completions
model = dynamic/expert-panel-v1
```

It sends `metadata.expert_slot` as one of `expert-1`, `expert-2`, `expert-3`,
`judge`, or `governance`. It records `cf-aig-model` and `cf-aig-provider` from
the response and rejects forbidden models, missing routing metadata, or a panel
whose final models are not from distinct companies.

## Change and rollback rule

Do not edit Worker code when rotating models. Create a new route draft, change
only Model nodes, save, test, then deploy. If quality or availability regresses,
redeploy the prior route version. Dynamic Routing is currently a Cloudflare beta,
so the Worker-side fail-closed checks and the previous route version are required.
