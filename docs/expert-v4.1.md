# Expert V4.1 clean replacement

This branch is the only replacement path for the retired legacy Expert panel.

## Boundary

Expert Worker owns orchestration that Cloudflare AI Gateway Dynamic Routing does not provide: task profiling, problem-specific expert roles, participant count, multi-round cross-review, judges/final synthesis, cancellation/state, and cross-call company-diversity verification.

Cloudflare owns concrete inference routing: route registry, provider/model selection, free/balanced/quality branches, provider fallback, per-model timeout/retry, route versions, deployment and rollback.

## Production model-source policy

The production source classes are **Cloudflare Workers AI + OpenRouter + native DeepSeek + Hugging Face**. Cloudflare AI Gateway is the sole inference transport and credential boundary; it is not counted as a fifth model source.

There is deliberately **no fixed production model list**. Names such as Flash, Pro, version numbers, release families or individual model IDs are not architecture. The route manager discovers live catalogs, evaluates every usable text/chat model from the approved source classes, and ranks the current candidate universe. New provider releases automatically enter the candidate universe on later refreshes without editing Expert Worker source.

1. **Cloudflare Workers AI** — models come from Cloudflare Model Search. Free allowance and paid cost are routing attributes, not a permanent model allowlist.
2. **OpenRouter** — the broad multi-company model supermarket. The live OpenRouter model catalog is scanned rather than pinning individual models.
3. **DeepSeek native** — models come from the provider's current model catalog when direct discovery credentials are available. The architecture never pins a specific DeepSeek generation or Flash/Pro suffix.
4. **Hugging Face** — live Inference Provider models are discovered through the Hub API. Newly served models may enter automatically after refresh.

Company diversity is based on the **model owner**, not on the transport/provider wrapper. The same model company reached through OpenRouter, Hugging Face, Workers AI or a native provider counts as one company lane.

The entire discovered universe is eligible for scoring, but Cloudflare Dynamic Routes encode only the current best representatives needed for the active lanes. This keeps route complexity bounded while preserving future-model discovery. Selection uses current availability, cost mode, telemetry and quality signals; failed candidates fall back rather than becoming permanent source-code choices.

No Tencent TokenHub, custom Tencent provider or other new direct source class is admitted by default. Expanding the source-class allowlist is a governance decision separate from model discovery inside an already approved source.

The Expert Worker itself requires only the authenticated `AI_GATEWAY_TOKEN`; it does not hold OpenRouter, DeepSeek or Hugging Face provider secrets.

## Removed legacy architecture

- no `expert-panel-v1` base route;
- no fixed expert/judge slots;
- no Expert-side Dynamic Route writer scripts;
- no direct third-party provider secrets in Expert Worker;
- no fixed model IDs or model-generation names;
- no fixed 6 experts / 2 judges / 2 rounds constants;
- no mandatory single-active-task lock;
- no requirement that custom metadata contain exactly five fields.

## Dynamic envelopes

Production defaults are configuration, not permanent architecture: up to 8 lanes, 8 experts, 2 judges, 3 rounds, 2 concurrent top-level tasks and 6 internal expert calls. Hard fail-closed ceilings remain 8 lanes, 8 experts, 3 judges, 4 rounds and 8 concurrent tasks.

The route registry remains replaceable through governed configuration. The four source classes are stable boundaries; the models inside those classes are a continuously refreshed universe.
