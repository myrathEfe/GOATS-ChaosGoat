const BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  health: () => req("/health/services"),
  experiments: () => req("/experiments"),
  experiment: (id) => req(`/experiments/${id}`),
  chaosMethods: () => req("/chaos/methods"),
  goldenTraces: () => req("/golden-traces"),
  // POST /experiments/run — { target_service, chaos_method, config }
  inject: ({ service, fault_type, config }) =>
    req("/experiments/run", {
      method: "POST",
      body: JSON.stringify({ target_service: service, chaos_method: fault_type, config }),
    }),
  recover: (experimentId) =>
    req("/experiments/recover", {
      method: "POST",
      body: JSON.stringify(experimentId ? { experimentId } : {}),
    }),
  analyze: (id) => req(`/experiments/${id}/analyze`, { method: "POST" }),
  transaction: () => req("/banking/demo-transaction", { method: "POST" }),
};
