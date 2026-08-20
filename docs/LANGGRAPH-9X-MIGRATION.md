# LangGraph 9.x Expert Center Migration

## Goal
Replace fixed expert execution with a state-driven orchestration architecture.

## Core graph

Input -> Planner -> Capability Router -> Expert Panel -> Validator -> Output

## Boundaries

- Expert nodes do not directly access external tools.
- Governance remains the final control gate.
- Compute Center is accessed through controlled execution nodes.
- Intelligence Center provides capability metadata.

## Production gates

- routing validation
- fail-closed behavior
- capability contract tests
- runtime verification
