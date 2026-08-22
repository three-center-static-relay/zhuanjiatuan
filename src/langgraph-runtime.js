// Exact-main Cloudflare production receipt trigger for shared supervisor validation runtime.
import guardedApp from "./guard.js";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { runLangGraphBrain } from "./langgraph-brain.js";

export const LANGGRAPH_RUNTIME = "@langchain/langgraph@1.4.10";

const RuntimeState = Annotation.Root({
  task: Annotation(),
  governance: Annotation(),
  execution: Annotation(),
  status: Annotation(),
  error: Annotation(),
  trace: Annotation({
    reducer: (left, right) => [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])],
    default: () => []
  })
});

const ValidationState = Annotation.Root({
  plan: Annotation(),
  validation: Annotation(),
  status: Annotation(),
  error: Annotation(),
  trace: Annotation({
    reducer: (left, right) => [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])],
    default: () => []
  })
});

const ProbeState = Annotation.Root({
  status: Annotation(),
  trace: Annotation({
    reducer: (left, right) => [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])],
    default: () => []
  })
});

function buildRuntimeGraph(env, ctx) {
  const graph = new StateGraph(RuntimeState)
    .addNode("governance", async (state) => {
      const validTask = Boolean(state.task && typeof state.task === "object" && !Array.isArray(state.task));
      return {
        governance: { ok: validTask, mode: "structural-gate" },
        status: validTask ? "governance-passed" : "rejected",
        error: validTask ? null : "INVALID_LANGGRAPH_TASK",
        trace: ["governance"]
      };
    })
    .addNode("expert", async (state) => {
      const request = new Request("https://expert.internal/v1/run", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-langgraph-runtime": LANGGRAPH_RUNTIME
        },
        body: JSON.stringify(state.task)
      });

      const response = await guardedApp.fetch(request, env, ctx);
      const body = await response.json().catch(() => ({ ok: false, error: "LANGGRAPH_BAD_EXPERT_RESPONSE" }));
      const ok = response.ok && body?.ok === true;
      return {
        execution: { http_status: response.status, body },
        status: ok ? "completed" : "failed",
        error: ok ? null : String(body?.error || "LANGGRAPH_EXPERT_EXECUTION_FAILED"),
        trace: ["expert"]
      };
    })
    .addEdge(START, "governance")
    .addConditionalEdges("governance", (state) => state.governance?.ok ? "expert" : END)
    .addEdge("expert", END);

  return graph.compile();
}

function validateSupervisorPlan(plan) {
  const nodes = Array.isArray(plan?.graph?.nodes) ? plan.graph.nodes : [];
  const allowedCenters = new Set(["governance", "intelligence", "compute", "expert"]);
  const invalidCenter = nodes.find((node) => !allowedCenters.has(String(node?.center || "")));
  const safe = Boolean(plan && typeof plan === "object")
    && plan?.ok === true
    && plan?.execution_started === false
    && plan?.side_effects_started === false
    && plan?.production_mutation === false
    && !invalidCenter;
  return {
    ok: safe,
    fail_closed: true,
    invalid_center: invalidCenter?.center || null,
    production_mutation: false,
    execution_started: false,
    side_effects_started: false
  };
}

function buildSupervisorValidationGraph() {
  return new StateGraph(ValidationState)
    .addNode("validate", async (state) => {
      const validation = validateSupervisorPlan(state.plan);
      return {
        validation,
        status: validation.ok ? "validated" : "rejected",
        error: validation.ok ? null : "LANGGRAPH_SUPERVISOR_PLAN_REJECTED",
        trace: ["validate"]
      };
    })
    .addEdge(START, "validate")
    .addEdge("validate", END)
    .compile();
}

function buildProbeGraph() {
  return new StateGraph(ProbeState)
    .addNode("probe", async () => ({ status: "ready", trace: ["probe"] }))
    .addEdge(START, "probe")
    .addEdge("probe", END)
    .compile();
}

export async function probeLangGraphRuntime() {
  const graph = buildProbeGraph();
  const result = await graph.invoke({ status: "starting", trace: [] });
  return {
    ok: result.status === "ready",
    runtime: LANGGRAPH_RUNTIME,
    mode: "cloudflare-worker-internal-canary",
    state_graph: true,
    supervisor_validation: true,
    brain_advisory: true,
    trace: result.trace || []
  };
}

async function runSupervisorValidation(input) {
  const graph = buildSupervisorValidationGraph();
  const result = await graph.invoke({
    plan: input?.plan || null,
    validation: null,
    status: "received",
    error: null,
    trace: []
  });
  return {
    ok: result.status === "validated",
    runtime: LANGGRAPH_RUNTIME,
    mode: "supervisor-validate",
    status: result.status,
    error: result.error || null,
    validation: result.validation || null,
    trace: result.trace || [],
    model_invoked: false,
    tools_used: false,
    web_used: false
  };
}

export async function runLangGraphRequest(input, env, ctx) {
  if (input?.mode === "supervisor-validate") return runSupervisorValidation(input);
  if (input?.mode === "brain-advisory") {
    const result = await runLangGraphBrain(input, env);
    const brainMode = String(result?.mode || "");
    return {
      ...result,
      runtime: LANGGRAPH_RUNTIME,
      mode: "brain-advisory",
      brain_mode: brainMode,
      model_invoked: Boolean(result?.model),
      tools_used: false,
      web_used: false,
      production_mutation: false
    };
  }

  const task = input?.task && typeof input.task === "object" && !Array.isArray(input.task)
    ? input.task
    : input;
  const graph = buildRuntimeGraph(env, ctx);
  const result = await graph.invoke({
    task,
    governance: null,
    execution: null,
    status: "received",
    error: null,
    trace: []
  });

  return {
    ok: result.status === "completed",
    runtime: LANGGRAPH_RUNTIME,
    mode: "expert-execution",
    status: result.status,
    error: result.error || null,
    governance: result.governance || null,
    execution: result.execution || null,
    trace: result.trace || []
  };
}
