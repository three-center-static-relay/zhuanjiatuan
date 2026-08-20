import guardedApp from "./guard.js";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";

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
    trace: result.trace || []
  };
}

export async function runLangGraphRequest(input, env, ctx) {
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
    status: result.status,
    error: result.error || null,
    governance: result.governance || null,
    execution: result.execution || null,
    trace: result.trace || []
  };
}
