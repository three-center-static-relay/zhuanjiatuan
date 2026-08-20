# Expert V4.1 clean replacement

This branch is the only replacement path for the retired legacy Expert panel.

## Boundary

Expert Worker owns only orchestration that Cloudflare AI Gateway Dynamic Routing does not provide: task profiling, problem-specific expert roles, participant count, multi-round cross-review, judges/final synthesis, cancellation/state, and cross-call company-diversity verification.

Cloudflare owns concrete inference routing: route registry, provider/model selection, free/balanced/quality branches, provider fallback, per-model timeout/retry, challenger traffic, route versions, deployment and rollback.

## Removed legacy architecture

- no `expert-panel-v1` base route;
- no `expert-1` / `expert-2` / `expert-3` / fixed judge/governance slots;
- no Expert-side Dynamic Route writer scripts;
- no OpenRouter-only production contract;
- no fixed 6 experts / 2 judges / 2 rounds constants;
- no mandatory single-active-task lock;
- no requirement that custom metadata contain exactly five fields.

## Dynamic envelopes

Production defaults are configuration, not permanent architecture: up to 8 lanes, 8 experts, 2 judges, 3 rounds, 2 concurrent top-level tasks and 6 internal expert calls. Hard fail-closed ceilings remain 8 lanes, 8 experts, 3 judges, 4 rounds and 8 concurrent tasks.

The route registry is replaceable through configuration. Provider/model composition is owned by Governance + Cloudflare and may include native providers, Workers AI, OpenRouter and approved Custom Providers.
