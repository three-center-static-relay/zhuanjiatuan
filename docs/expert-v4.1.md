# Expert V4.1 clean replacement

This branch is the only replacement path for the retired legacy Expert panel.

## Boundary

Expert Worker owns only orchestration that Cloudflare AI Gateway Dynamic Routing does not provide: task profiling, problem-specific expert roles, participant count, multi-round cross-review, judges/final synthesis, cancellation/state, and cross-call company-diversity verification.

Cloudflare owns concrete inference routing: route registry, provider/model selection, free/balanced/quality branches, provider fallback, per-model timeout/retry, challenger traffic, route versions, deployment and rollback.

## Production model-source policy

The production inference boundary is intentionally **Cloudflare Workers AI free models + OpenRouter + native DeepSeek + Hugging Face only**.

Cloudflare AI Gateway is the sole inference transport, credential boundary and routing control plane. It is not counted as a fifth model source.

Exactly four upstream source classes are admitted:

1. **Cloudflare Workers AI free models** — only models currently eligible on the Workers AI free path may enter Expert production. This source is free-first only. If a selected model becomes Paid-only, the free allocation is exhausted, the account is not eligible, or free status cannot be established, the route must fail/fallback rather than deliberately purchase Workers AI inference. No third-party Provider Key is required.
2. **OpenRouter** — the broad multi-company model supermarket and primary dynamic pool. Its provider key is stored in Cloudflare AI Gateway Provider Keys/BYOK, not in Expert Worker. The governed route manager may select eligible models dynamically while preserving company diversity and the existing banned-company/model policy.
3. **DeepSeek native** — the dedicated single-vendor direct path. Its provider key is stored in Cloudflare AI Gateway Provider Keys/BYOK. The current direct production candidate is `deepseek-v4-pro`.
4. **Hugging Face** — the open-model inference ecosystem and an additional independent provider path. Its provider key is stored in Cloudflare AI Gateway Provider Keys/BYOK. Hugging Face may also continue to serve the intelligence/upgrade system as a model-ecosystem radar.

Company diversity is based on the **model owner**, not on the transport/provider wrapper. The same model company reached through OpenRouter, Hugging Face, Workers AI or a native provider counts as one company lane. For example, DeepSeek through OpenRouter and native DeepSeek must never be counted as two independent companies.

The Workers AI free source is intentionally asymmetric with the other three sources: it is a cost-saving/free-capacity lane, not permission to enable Paid-only Workers AI frontier models or Unified Billing spend for Expert production. When the free path is unavailable, the route falls back to the other admitted sources.

No Tencent TokenHub, custom Tencent provider, Google-direct, Anthropic-direct, OpenAI-direct, Moonshot-direct, ByteDance-direct, Mistral-direct, Groq-direct, Cerebras-direct or other direct provider is admitted by default. Models from otherwise excluded companies may only appear when they are explicitly permitted by the separate banned-company/model policy; transport through OpenRouter/Hugging Face/Workers AI does not bypass that policy.

The Expert Worker itself requires only the authenticated `AI_GATEWAY_TOKEN`; it does not hold OpenRouter, DeepSeek or Hugging Face provider secrets. Workers AI uses the Cloudflare account path and does not require a third-party provider secret.

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

The route registry remains replaceable through governed configuration, but the production model-source admission boundary remains Workers AI free models + OpenRouter + native DeepSeek + Hugging Face only.
