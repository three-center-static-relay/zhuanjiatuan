# Expert V4.1 clean replacement

This branch is the only replacement path for the retired legacy Expert panel.

## Boundary

Expert Worker owns only orchestration that Cloudflare AI Gateway Dynamic Routing does not provide: task profiling, problem-specific expert roles, participant count, multi-round cross-review, judges/final synthesis, cancellation/state, and cross-call company-diversity verification.

Cloudflare owns concrete inference routing: route registry, provider/model selection, free/balanced/quality branches, provider fallback, per-model timeout/retry, challenger traffic, route versions, deployment and rollback.

## Production model-source allowlist

The current governed model-source fabric is intentionally limited to four classes:

1. **Cloudflare Workers AI** — Cloudflare first-party hosted models. No third-party Provider Key is required. Prefer for free/low-cost first-pass inference when the selected model is available on the current Workers plan.
2. **OpenRouter** — the broad multi-company model supermarket. Its provider key is stored in Cloudflare AI Gateway Provider Keys/BYOK, not in Expert Worker.
3. **DeepSeek native** — direct single-vendor quality/resilience path. Its provider key is stored in Cloudflare AI Gateway Provider Keys/BYOK.
4. **Hugging Face** — open-model ecosystem and fallback/experimental inference path. Its provider key is stored in Cloudflare AI Gateway Provider Keys/BYOK.

No Tencent TokenHub, ByteDance, Moonshot, Mistral, Groq, Cerebras, Google or other provider is admitted by default. Expanding this list requires a separate governed change and fresh acceptance.

The allowlist does not require every task to call all four sources. Selection is task-dependent: free-first generally favors Workers AI; OpenRouter is the broad comparison/routing pool; DeepSeek is a direct quality/resilience path; Hugging Face is an open-model/fallback path.

The Expert Worker itself requires only the authenticated AI Gateway token; it does not hold OpenRouter, DeepSeek or Hugging Face provider secrets.

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

The route registry remains replaceable through governed configuration, but the model-source admission boundary is Workers AI + OpenRouter + DeepSeek + Hugging Face only.
