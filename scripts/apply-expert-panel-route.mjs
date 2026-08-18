const CF_API = "https://api.cloudflare.com/client/v4";
const OPENROUTER_MODELS = "https://openrouter.ai/api/v1/models?supported_parameters=reasoning&output_modalities=text&sort=intelligence-high-to-low";

const ACCOUNT_ID = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
const API_TOKEN = String(process.env.CLOUDFLARE_AI_GATEWAY_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "").trim();
const GATEWAY_ID = String(process.env.AI_GATEWAY_ID || "test").trim();
const ROUTE_NAME = String(process.env.AI_GATEWAY_ROUTE || "expert-panel-v1").trim();
const DRY_RUN = process.argv.includes("--dry-run");
const NO_DEPLOY = process.argv.includes("--no-deploy");

const bannedCompany = new Set(["openai", "anthropic", "openrouter", "aion-labs"]);
const highPriorityDomains = ["coding", "quantitative", "legal", "research", "medical", "finance", "science", "policy"];

function fail(code, details = {}) {
  const error = new Error(code);
  error.details = details;
  throw error;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function companyOf(modelId) {
  const id = String(modelId || "").trim().toLowerCase();
  return id.includes("/") ? id.split("/")[0] : "";
}

function isPaid(model) {
  const p = model?.pricing || {};
  return num(p.prompt) > 0 || num(p.completion) > 0 || num(p.request) > 0;
}

function hasTextOutput(model) {
  const out = model?.architecture?.output_modalities;
  return !Array.isArray(out) || out.length === 0 || out.includes("text");
}

function isLive(model) {
  if (!model?.expiration_date) return true;
  const t = Date.parse(model.expiration_date);
  return !Number.isFinite(t) || t > Date.now();
}

function isSyntheticWrapper(model) {
  const text = `${model?.id || ""} ${model?.name || ""} ${model?.description || ""}`.toLowerCase();
  return /\b(auto[- ]?router|router|multi[- ]model|ensemble|fusion)\b/.test(text);
}

function eligible(model) {
  const id = String(model?.id || "").trim();
  const low = id.toLowerCase();
  const company = companyOf(id);
  const params = Array.isArray(model?.supported_parameters) ? model.supported_parameters : [];
  if (!id || !company || bannedCompany.has(company)) return false;
  if (low.includes("anthropic") || low.includes("claude") || low.includes("openai")) return false;
  if (low.includes(":free") || low.includes("flash")) return false;
  if (!params.includes("reasoning") || !hasTextOutput(model) || !isPaid(model) || !isLive(model)) return false;
  if (isSyntheticWrapper(model)) return false;
  return true;
}

async function readJson(response, label) {
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { fail(`${label}_BAD_JSON`, { status: response.status }); }
  if (!response.ok || payload?.success === false) {
    fail(`${label}_HTTP_ERROR`, {
      status: response.status,
      errors: payload?.errors || null,
      messages: payload?.messages || null
    });
  }
  return payload;
}

async function openRouterModels() {
  const response = await fetch(OPENROUTER_MODELS, { headers: { accept: "application/json" } });
  const payload = await readJson(response, "OPENROUTER_MODELS");
  const models = Array.isArray(payload?.data) ? payload.data : [];
  if (!models.length) fail("OPENROUTER_MODEL_CATALOG_EMPTY");
  return models;
}

function selectLanes(models) {
  const filtered = models.filter(eligible);
  const byCompany = new Map();
  const companyOrder = [];
  for (const model of filtered) {
    const company = companyOf(model.id);
    if (!byCompany.has(company)) {
      byCompany.set(company, []);
      companyOrder.push(company);
    }
    const list = byCompany.get(company);
    if (list.length < 3) list.push(model);
  }
  const selectedCompanies = companyOrder.slice(0, 4);
  if (selectedCompanies.length !== 4) {
    fail("INSUFFICIENT_DISTINCT_ELIGIBLE_COMPANIES", { selectedCompanies, eligible_count: filtered.length });
  }
  const seats = ["expert-1", "expert-2", "expert-3", "judge"];
  return seats.map((seat, index) => {
    const company = selectedCompanies[index];
    const ranked = byCompany.get(company) || [];
    return {
      seat,
      company,
      primary: ranked[0]?.id || null,
      secondary: ranked[1]?.id || null,
      tertiary: ranked[2]?.id || null
    };
  });
}

function modelNode(id, model, timeout, successId, fallbackId) {
  const outputs = { success: { elementId: successId } };
  if (fallbackId) outputs.fallback = { elementId: fallbackId };
  return {
    id,
    type: "model",
    properties: { provider: "openrouter", model, timeout, retries: 0 },
    outputs
  };
}

function buildElements(lanes) {
  const laneBySeat = Object.fromEntries(lanes.map(x => [x.seat, x]));
  laneBySeat.governance = { ...laneBySeat.judge, seat: "governance" };
  const seatOrder = ["expert-1", "expert-2", "expert-3", "judge", "governance"];
  const elements = [
    { id: "start", type: "start", outputs: { next: { elementId: "slot_expert_1" } } },
    { id: "end", type: "end", outputs: {} }
  ];

  for (let i = 0; i < seatOrder.length; i++) {
    const seat = seatOrder[i];
    const lane = laneBySeat[seat];
    const key = seat.replace(/-/g, "_");
    const slotId = `slot_${key}`;
    const depthId = `depth_${key}`;
    const domainId = `domain_${key}`;
    const primaryId = `model_${key}_primary`;
    const secondaryId = lane.secondary && lane.secondary !== lane.primary ? `model_${key}_secondary` : null;
    const tertiaryId = lane.tertiary && lane.tertiary !== lane.primary && lane.tertiary !== lane.secondary ? `model_${key}_tertiary` : null;
    const nextSlot = i < seatOrder.length - 1 ? `slot_${seatOrder[i + 1].replace(/-/g, "_")}` : "end";
    const timeout = seat === "judge" ? 60000 : seat === "governance" ? 30000 : 45000;

    elements.push({
      id: slotId,
      type: "conditional",
      properties: { conditions: { "metadata.expert_slot": { "$eq": seat } } },
      outputs: { true: { elementId: depthId }, false: { elementId: nextSlot } }
    });
    elements.push({
      id: depthId,
      type: "conditional",
      properties: { conditions: { "metadata.reasoning_depth": { "$eq": "deep" } } },
      outputs: { true: { elementId: primaryId }, false: { elementId: domainId } }
    });
    elements.push({
      id: domainId,
      type: "conditional",
      properties: { conditions: { "metadata.task_domain": { "$in": highPriorityDomains } } },
      outputs: {
        true: { elementId: primaryId },
        false: { elementId: secondaryId || primaryId }
      }
    });

    elements.push(modelNode(primaryId, lane.primary, timeout, "end", secondaryId || tertiaryId || "end"));
    if (secondaryId) elements.push(modelNode(secondaryId, lane.secondary, timeout, "end", tertiaryId || "end"));
    if (tertiaryId) elements.push(modelNode(tertiaryId, lane.tertiary, timeout, "end", "end"));
  }
  return elements;
}

function cfPath(path) {
  return `${CF_API}/accounts/${encodeURIComponent(ACCOUNT_ID)}/ai-gateway/gateways/${encodeURIComponent(GATEWAY_ID)}${path}`;
}

async function cf(path, { method = "GET", body } = {}) {
  if (!ACCOUNT_ID || !API_TOKEN) fail("CLOUDFLARE_AI_GATEWAY_WRITE_NOT_CONFIGURED", {
    account_id_configured: Boolean(ACCOUNT_ID),
    api_token_configured: Boolean(API_TOKEN)
  });
  const response = await fetch(cfPath(path), {
    method,
    headers: {
      authorization: `Bearer ${API_TOKEN}`,
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return readJson(response, "CLOUDFLARE_API");
}

function routesFrom(payload) {
  return payload?.result?.routes || payload?.result?.data?.routes || payload?.data?.routes || payload?.routes || [];
}

function versionsFrom(payload) {
  return payload?.result?.versions || payload?.result?.data?.versions || payload?.data?.versions || payload?.versions || [];
}

async function findRoute() {
  const payload = await cf("/routes?per_page=100");
  const matches = routesFrom(payload).filter(r => String(r?.name || "") === ROUTE_NAME);
  if (matches.length > 1) fail("DUPLICATE_DYNAMIC_ROUTE_NAME", { route_name: ROUTE_NAME, ids: matches.map(x => x.id) });
  return matches[0] || null;
}

async function newestVersionId(routeId) {
  const payload = await cf(`/routes/${encodeURIComponent(routeId)}/versions?per_page=100`);
  const versions = versionsFrom(payload).slice().sort((a, b) => Date.parse(b?.created_at || 0) - Date.parse(a?.created_at || 0));
  return String(versions[0]?.version_id || versions[0]?.id || "").trim();
}

async function createOrVersion(elements) {
  let route = await findRoute();
  if (!route) {
    const payload = await cf("/routes", { method: "POST", body: { name: ROUTE_NAME, elements } });
    route = payload?.result?.route || payload?.result || payload?.route || null;
    const routeId = String(route?.id || "").trim();
    if (!routeId) fail("CLOUDFLARE_ROUTE_ID_MISSING");
    let versionId = String(route?.version?.version_id || route?.version_id || "").trim();
    if (!versionId) versionId = await newestVersionId(routeId);
    if (!versionId) fail("CLOUDFLARE_ROUTE_VERSION_ID_MISSING", { route_id: routeId });
    return { routeId, versionId, createdRoute: true, previousVersionId: null };
  }

  const routeId = String(route.id || "").trim();
  const previousVersionId = String(route?.deployment?.version_id || "").trim() || null;
  const payload = await cf(`/routes/${encodeURIComponent(routeId)}/versions`, { method: "POST", body: { elements } });
  let versionId = String(payload?.result?.version_id || payload?.result?.id || payload?.version_id || payload?.id || "").trim();
  if (!versionId) versionId = await newestVersionId(routeId);
  if (!versionId) fail("CLOUDFLARE_ROUTE_VERSION_ID_MISSING", { route_id: routeId });
  return { routeId, versionId, createdRoute: false, previousVersionId };
}

async function verifyVersion(routeId, versionId) {
  const payload = await cf(`/routes/${encodeURIComponent(routeId)}/versions/${encodeURIComponent(versionId)}`);
  const version = payload?.result || payload;
  if (version?.is_valid === false) fail("CLOUDFLARE_ROUTE_VERSION_INVALID", { route_id: routeId, version_id: versionId });
  return version;
}

async function deploy(routeId, versionId) {
  return cf(`/routes/${encodeURIComponent(routeId)}/deployments`, { method: "POST", body: { version_id: versionId } });
}

async function main() {
  const models = await openRouterModels();
  const lanes = selectLanes(models);
  const elements = buildElements(lanes);
  const plan = {
    route_name: ROUTE_NAME,
    gateway_id: GATEWAY_ID,
    ranking_source: OPENROUTER_MODELS,
    policy: {
      reasoning_only: true,
      paid_only: true,
      exclude_openai: true,
      exclude_anthropic_claude: true,
      exclude_free: true,
      exclude_flash: true,
      company_dedup: true,
      runtime_rate_limit: false,
      runtime_budget_limit: false,
      same_company_fallback: true
    },
    lanes,
    element_count: elements.length,
    elements
  };

  if (DRY_RUN) {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", ...plan }, null, 2));
    return;
  }

  const version = await createOrVersion(elements);
  await verifyVersion(version.routeId, version.versionId);
  let deployed = false;
  if (!NO_DEPLOY) {
    await deploy(version.routeId, version.versionId);
    deployed = true;
  }
  console.log(JSON.stringify({
    ok: true,
    mode: deployed ? "created-version-and-deployed" : "created-version-not-deployed",
    route_name: ROUTE_NAME,
    gateway_id: GATEWAY_ID,
    route_id: version.routeId,
    version_id: version.versionId,
    previous_version_id: version.previousVersionId,
    created_route: version.createdRoute,
    deployed,
    lanes,
    element_count: elements.length,
    secrets_redacted: true
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message || error),
    details: error?.details || null,
    secrets_redacted: true
  }, null, 2));
  process.exitCode = 1;
});
