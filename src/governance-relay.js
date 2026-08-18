import { aiGatewayConfigured, aiGatewayRequestHeaders, openRouterChatEndpoint } from "./ai-gateway.js";

const MAX_BODY_BYTES = 65536;
const MAX_UPSTREAM_BYTES = 1500000;
const DEFAULT_MAX_TOKENS = 4096;
const MAX_MAX_TOKENS = 16384;
const MODEL_TIMEOUT_MS = 30000;
const TOTAL_TIMEOUT_MS = 180000;
const AUXILIARY_NO_TOOLS_SYSTEM = `AUXILIARY MODEL TOOL ISOLATION:
- You have zero tool authority.
- Never browse or search the web, call APIs, connectors, plugins, functions, or tools, execute code or commands, access repositories/files/external services, or initiate external actions.
- Use only the prompt and evidence already supplied by the controlling system.
- Never emit or request tool_calls/function_call. If external execution or fresh data is required, state that the controlling web GPT must perform it; do not simulate execution.`;

const json = (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = /token|secret|password|authorization|cookie|api.?key/i.test(key) ? "[REDACTED]" : redact(item);
    }
    return out;
  }
  return value;
}

async function parseBody(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) throw Object.assign(new Error("BODY_TOO_LARGE"), { status: 413 });
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw Object.assign(new Error("BODY_TOO_LARGE"), { status: 413 });
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw Object.assign(new Error("INVALID_REQUEST"), { status: 400 }); }
}

function paidModel(model) {
  const id = String(model?.id || "").toLowerCase();
  if (!id || id.includes(":free")) return false;
  const p = model?.pricing || {};
  return Number(p.prompt || 0) > 0 || Number(p.completion || 0) > 0 || Number(p.request || 0) > 0;
}

function remaining(deadline) { return Math.max(0, deadline - Date.now()); }

async function fetchJsonBounded(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const raw = await response.text();
    if (new TextEncoder().encode(raw).length > MAX_UPSTREAM_BYTES) {
      throw Object.assign(new Error("UPSTREAM_RESPONSE_TOO_LARGE"), { status: 502 });
    }
    let body = null;
    if (raw) {
      try { body = JSON.parse(raw); } catch { throw Object.assign(new Error("UPSTREAM_BAD_JSON"), { status: 502 }); }
    }
    if (!response.ok) {
      throw Object.assign(new Error("UPSTREAM_UNAVAILABLE"), { status: response.status || 502, details: redact(body) });
    }
    return body;
  } catch (error) {
    if (error?.name === "AbortError") throw Object.assign(new Error("UPSTREAM_TIMEOUT"), { status: 504 });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function paidReasoningCatalog(env, deadline) {
  const url = new URL("https://openrouter.ai/api/v1/models");
  url.searchParams.set("supported_parameters", "reasoning");
  url.searchParams.set("output_modalities", "text");
  url.searchParams.set("sort", "intelligence-high-to-low");
  const timeoutMs = Math.min(10000, remaining(deadline));
  if (timeoutMs <= 0) throw Object.assign(new Error("TASK_DEADLINE_EXCEEDED"), { status: 504 });
  const payload = await fetchJsonBounded(url, {
    headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY}`, accept: "application/json" }
  }, timeoutMs);
  return (payload?.data || []).filter(paidModel);
}

function rejectToolUse(payload) {
  const message = payload?.choices?.[0]?.message || null;
  const finish = String(payload?.choices?.[0]?.finish_reason || "").toLowerCase();
  const structured =
    (Array.isArray(message?.tool_calls) ? message.tool_calls.length > 0 : Boolean(message?.tool_calls)) ||
    Boolean(message?.function_call) ||
    /tool_calls?|function_call/.test(finish);
  const content = typeof message?.content === "string" ? message.content : "";
  const textualInvocation = /<tool_call>|<function_call>|["']tool_calls?["']\s*:\s*\[/i.test(content);
  if (structured || textualInvocation) {
    throw Object.assign(new Error("AUXILIARY_TOOL_USE_FORBIDDEN"), { status: 502 });
  }
}

function contentOf(payload) {
  rejectToolUse(payload);
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content.map(item => typeof item === "string" ? item : item?.text || "").join("\n").trim();
    if (text) return text;
  }
  throw Object.assign(new Error("EMPTY_MODEL_OUTPUT"), { status: 502 });
}

async function callModel(env, model, messages, maxTokens, timeoutMs) {
  const endpoint = await openRouterChatEndpoint(env);
  return fetchJsonBounded(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      accept: "application/json",
      ...aiGatewayRequestHeaders(env, timeoutMs)
    },
    body: JSON.stringify({
      model,
      messages,
      reasoning: { effort: "high" },
      temperature: 0.2,
      stream: false,
      max_tokens: maxTokens
    })
  }, timeoutMs);
}

export async function runGovernanceRelay(request, env) {
  if (!env.OPENROUTER_API_KEY) {
    return json({ ok: false, error: "UPSTREAM_AUTH_FAILED", message: "OPENROUTER_API_KEY is not configured" }, 503);
  }
  if (!aiGatewayConfigured(env)) {
    return json({ ok: false, error: "AI_GATEWAY_NOT_CONFIGURED", message: "Cloudflare AI Gateway binding or gateway id is not configured" }, 503);
  }
  try {
    const body = await parseBody(request);
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return json({ ok: false, error: "INVALID_REQUEST", message: "prompt required" }, 400);
    const maxTokens = Math.max(256, Math.min(MAX_MAX_TOKENS, Number(body.max_tokens || DEFAULT_MAX_TOKENS) || DEFAULT_MAX_TOKENS));
    const suppliedSystem = typeof body.system === "string" && body.system.trim()
      ? body.system.trim()
      : "You are the governance copilot for a multi-center decision system. Assist the controlling web GPT with repository governance, code review, fault diagnosis, routing, policy interpretation, maintenance planning, and concise decision support. Do not claim to have executed actions you did not execute. Preserve system constraints and state uncertainty explicitly.";
    const system = `${suppliedSystem}\n\n${AUXILIARY_NO_TOOLS_SYSTEM}`;
    const deadline = Date.now() + TOTAL_TIMEOUT_MS;
    const models = await paidReasoningCatalog(env, deadline);
    if (!models.length) return json({ ok: false, error: "NO_PAID_REASONING_MODEL_AVAILABLE", model_tier: "paid-only", free_models_allowed: false }, 503);
    const attempts = [];
    for (let rank = 0; rank < models.length; rank++) {
      const model = models[rank].id;
      const left = remaining(deadline);
      if (left <= 0) break;
      const started = Date.now();
      try {
        const payload = await callModel(env, model, [
          { role: "system", content: system },
          { role: "user", content: prompt }
        ], maxTokens, Math.min(MODEL_TIMEOUT_MS, left));
        const content = contentOf(payload);
        attempts.push({ rank: rank + 1, model, status: "completed", elapsed_ms: Date.now() - started });
        return json({
          ok: true,
          provider: "openrouter",
          selection: "paid-intelligence-high-to-low",
          model_tier: "paid-only",
          free_models_allowed: false,
          model,
          rank: rank + 1,
          content,
          usage: redact(payload?.usage || null),
          attempts,
          tool_access: "none"
        });
      } catch (error) {
        attempts.push({ rank: rank + 1, model, status: "failed", error: String(error?.message || error), elapsed_ms: Date.now() - started });
      }
    }
    return json({ ok: false, error: "OPENROUTER_CHAIN_EXHAUSTED", web_gpt_fallback_required: true, model_tier: "paid-only", free_models_allowed: false, attempts, tool_access: "none" }, 503);
  } catch (error) {
    return json({ ok: false, error: String(error?.message || "INTERNAL_ERROR"), web_gpt_fallback_required: true, model_tier: "paid-only", free_models_allowed: false, tool_access: "none" }, error?.status || 500);
  }
}
