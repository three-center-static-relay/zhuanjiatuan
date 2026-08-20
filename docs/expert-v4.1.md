# Expert V4.1 clean replacement

This branch is the only replacement path for the retired legacy Expert panel.

## Boundary

Expert Worker owns only orchestration that Cloudflare AI Gateway Dynamic Routing does not provide: task profiling, problem-specific expert roles, participant count, multi-round cross-review, judges/final synthesis, cancellation/state, and cross-call company-diversity verification.

Cloudflare owns concrete inference routing: route registry, provider/model selection, free/balanced/quality branches, provider fallback, per-model timeout/retry, challenger traffic, route versions, deployment and rollback.

## Production model-source policy

The production inference boundary is intentionally **OpenRouter + native DeepSeek only**.

Cloudflare AI Gateway is the sole inference transport, credential boundary and routing control plane. It is not counted as a model source.

Exactly two upstream source classes are admitted:

1. **OpenRouter** — the broad multi-company model supermarket and primary dynamic pool. Its provider key is stored in Cloudflare AI Gateway Provider Keys/BYOK, not in Expert Worker. The governed route manager may select eligible models dynamically while preserving company diversity and the existing banned-company/model policy.
2. **DeepSeek native** — the only direct single-vendor provider. Its provider key is stored in Cloudflare AI Gateway Provider Keys/BYOK. The current direct production candidate is `deepseek-v4-pro`.

DeepSeek reached through OpenRouter and DeepSeek reached natively are the same model company for diversity accounting; they must never be counted as two independent company lanes in one panel.

**Hugging Face is intelligence-only for this architecture.** It may be used by the intelligence/upgrade system to observe open-model availability, metadata and ecosystem changes, but it is not a production Expert inference source.

**Cloudflare Workers AI is not a production Expert model source in this policy.** It may exist elsewhere in the Cloudflare account, but Expert production routing does not admit it unless a later governed change explicitly expands the source allowlist.

No Tencent TokenHub, custom Tencent provider, Google, Anthropic, OpenAI, Moonshot, ByteDance, Mistral, Groq, Cerebras or other direct provider is admitted by default. Expanding the two-source boundary requires a separate governed change, explicit source-policy update and fresh production acceptance.

The Expert Worker itself requires only the authenticated `AI_GATEWAY_TOKEN`; it does not hold OpenRouter or DeepSeek provider secrets.

## Removed legacy architecture

- no `expert-panel-v1` base route;
- no `expert-1` / `expert-2` / `expert-3` / fixed judge/governance slots;
- no Expert-side Dynamic Route writer scripts;
- no direct third-party provider secrets in Expert Worker;
- no fixed 6 experts / 2 judges / 2 rounds constants;
- no mandatory single-active-task lock;
- no requirement that custom metadata contain exactly five fields.

## Dynamic envelopes

Production defaults are configuration, not permanent architecture: up to 8 lanes, 8 experts, 2 judges, 3 rounds, 2 concurrent top-level tasks and 6 internal expert calls. Hard fail-closed ceilings remain 8 lanes, 8 experts, 3 judges, 4 rounds and 8 concurrent tasks.

The route registry remains replaceable through governed configuration, but the production model-source admission boundary remains OpenRouter + native DeepSeek only.
