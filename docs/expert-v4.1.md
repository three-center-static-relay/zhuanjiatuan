# Expert V4.1 clean replacement

This branch is the only replacement path for the retired legacy Expert panel.

## Boundary

Expert Worker owns only orchestration that Cloudflare AI Gateway Dynamic Routing does not provide: task profiling, problem-specific expert roles, participant count, multi-round cross-review, judges/final synthesis, cancellation/state, and cross-call company-diversity verification.

Cloudflare owns concrete inference routing: route registry, provider/model selection, free/balanced/quality branches, provider fallback, per-model timeout/retry, challenger traffic, route versions, deployment and rollback.

## Production provider policy — intentionally narrow

The current production candidate uses exactly two upstream provider classes:

1. **OpenRouter** — the broad model supermarket. Its provider key is stored in Cloudflare AI Gateway Provider Keys/BYOK, not in Expert Worker. OpenRouter supplies the dynamic multi-company model pool.
2. **DeepSeek native** — the only direct single-vendor provider. Its provider key is also stored in Cloudflare AI Gateway Provider Keys/BYOK. Governance currently pins the direct candidate to `deepseek-v4-pro`.

No Tencent TokenHub, ByteDance, Moonshot, Mistral, Groq, Cerebras or other direct provider is admitted by the current production candidate. Expanding this list requires a separate governed change and fresh acceptance.

The Expert Worker therefore requires only the authenticated AI Gateway token; it does not hold OpenRouter or DeepSeek provider secrets.

## Removed legacy architecture

- no `expert-panel-v1` base route;
- no `expert-1` / `expert-2` / `expert-3` / fixed judge/governance slots;
- no Expert-side Dynamic Route writer scripts;
- no direct OpenRouter secret in Expert Worker;
- no fixed 6 experts / 2 judges / 2 rounds constants;
- no mandatory single-active-task lock;
- no requirement that custom metadata contain exactly five fields.

## Dynamic envelopes

Production defaults are configuration, not permanent architecture: up to 8 lanes, 8 experts, 2 judges, 3 rounds, 2 concurrent top-level tasks and 6 internal expert calls. Hard fail-closed ceilings remain 8 lanes, 8 experts, 3 judges, 4 rounds and 8 concurrent tasks.

The route registry remains replaceable through governed configuration, but the current provider admission boundary is OpenRouter + native DeepSeek only.
