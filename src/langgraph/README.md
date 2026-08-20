# LangGraph Orchestrator

This layer provides the coordination brain for the multi-center system.

## Nodes

- governance: policy, security, audit gates
- evidence: evidence/data acquisition interface
- expert: expert model coordination interface
- compute: simulation and calculation interface
- review: final quality evaluation

## Design principles

- Cloudflare runtime as execution layer
- LangGraph as workflow/state orchestration layer
- Centers remain isolated and expose controlled interfaces
- Fail closed on unavailable dependencies
