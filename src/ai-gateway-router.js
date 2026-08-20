const DEFAULT_TIMEOUT_MS = 300000;

export async function routeExpertRequest({ request, env = {} }) {
  const gateway = env.AI_GATEWAY_URL;
  if (!gateway) {
    return { ok: false, status: "quarantined", error: "AI_GATEWAY_NOT_CONFIGURED" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(gateway, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal
    });

    return {
      ok: response.ok,
      status: response.ok ? "completed" : "failed",
      http_status: response.status,
      payload: await response.json().catch(() => null)
    };
  } finally {
    clearTimeout(timer);
  }
}
