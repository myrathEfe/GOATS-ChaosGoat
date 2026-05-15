const express = require("express");
const cors = require("cors");
const { promisify } = require("util");
const { execFile } = require("child_process");
const {
  addGoldenTrace,
  addIncidentLog,
  addServiceMetric,
  createExperiment,
  getExperimentById,
  getExperimentDetail,
  getGoldenTraceById,
  getLatestRunningExperiment,
  initDb,
  listExperiments,
  listGoldenTraces,
  updateExperiment,
  upsertServiceStatus
} = require("./db");
const { analyzeWithGemini, buildFallbackAnalysis } = require("./geminiAnalyzer");
const { SAFE_DEGRADATION_MESSAGE, SERVICE_REGISTRY } = require("./constants");

const PORT = Number(process.env.PORT || 4000);
const TRANSACTION_SERVICE_URL =
  process.env.TRANSACTION_SERVICE_URL || "http://transaction-service:4002";
const FRAUD_CHECK_CONTAINER_NAME =
  process.env.FRAUD_CHECK_CONTAINER_NAME || "kintsugi-fraud-check-service";
const EXPERIMENT_TRANSACTION_SAMPLES = Number(process.env.EXPERIMENT_TRANSACTION_SAMPLES || 5);

const execFileAsync = promisify(execFile);

const app = express();
app.use(cors());
app.use(express.json());

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 2000);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function buildExperimentId() {
  return `exp_${Date.now()}`;
}

function buildGoldenTraceId() {
  return `gt_${Date.now()}`;
}

async function runDockerCommand(action, containerName) {
  try {
    const { stdout, stderr } = await execFileAsync("docker", [action, containerName]);
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error) {
    const stderr = error.stderr || error.message || "";

    if (action === "stop" && stderr.includes("is not running")) {
      return { stdout: "", stderr };
    }

    if (action === "start" && stderr.includes("is already running")) {
      return { stdout: "", stderr };
    }

    throw error;
  }
}

async function checkServiceHealth(service) {
  const started = Date.now();

  try {
    const body = await fetchJson(`${service.url}${service.healthPath}`, { timeoutMs: 2000 });
    const status = body.status || "UP";
    await upsertServiceStatus(service.name, status, service.criticality);

    return {
      name: service.name,
      status,
      latencyMs: Date.now() - started,
      body
    };
  } catch (error) {
    await upsertServiceStatus(service.name, "DOWN", service.criticality);

    return {
      name: service.name,
      status: "DOWN",
      latencyMs: Date.now() - started,
      error: error.message
    };
  }
}

async function waitForFraudServiceRecovery() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const fraudService = SERVICE_REGISTRY.find((service) => service.name === "fraud-check-service");
      await fetchJson(`${fraudService.url}${fraudService.healthPath}`, { timeoutMs: 1500 });
      return true;
    } catch (_error) {
      await sleep(1000);
    }
  }

  return false;
}

app.get("/health/services", async (_req, res, next) => {
  try {
    const checks = [];
    for (const service of SERVICE_REGISTRY) {
      checks.push(await checkServiceHealth(service));
    }

    res.json({
      services: checks.map(({ name, status }) => ({ name, status })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

app.post("/banking/demo-transaction", async (_req, res, next) => {
  try {
    const result = await fetchJson(`${TRANSACTION_SERVICE_URL}/transactions/demo`, {
      method: "POST",
      body: JSON.stringify({})
    });

    console.log(`[kintsugi-monkey-api] demo transaction result: ${JSON.stringify(result)}`);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/experiments/kill-fraud-check", async (_req, res, next) => {
  try {
    const existing = await getLatestRunningExperiment();

    if (existing) {
      return res.status(409).json({
        message: "A chaos experiment is already running.",
        experiment: existing
      });
    }

    const startedAt = new Date().toISOString();
    const experiment = {
      id: buildExperimentId(),
      domain: "banking",
      target_service: "fraud-check-service",
      affected_service: "transaction-service",
      fault_type: "service_kill",
      status: "running",
      started_at: startedAt,
      ended_at: null,
      recovery_time_ms: null,
      safe_degradation: SAFE_DEGRADATION_MESSAGE,
      created_at: startedAt
    };

    await createExperiment(experiment);
    await addIncidentLog({
      experiment_id: experiment.id,
      level: "INFO",
      message: "Chaos experiment created and fraud-check-service kill initiated.",
      metadata_json: {
        target_container: FRAUD_CHECK_CONTAINER_NAME
      },
      created_at: new Date().toISOString()
    });

    await runDockerCommand("stop", FRAUD_CHECK_CONTAINER_NAME);
    await upsertServiceStatus("fraud-check-service", "DOWN", "HIGH");

    const latencies = [];
    let failedRequests = 0;
    let degradedRequests = 0;
    let fallbackUsed = false;

    for (let index = 0; index < EXPERIMENT_TRANSACTION_SAMPLES; index += 1) {
      const requestStarted = Date.now();

      try {
        const transactionResult = await fetchJson(`${TRANSACTION_SERVICE_URL}/transactions/demo`, {
          method: "POST",
          body: JSON.stringify({}),
          timeoutMs: 3000
        });

        latencies.push(Date.now() - requestStarted);

        if (transactionResult.degraded || transactionResult.status === "pending_manual_review") {
          degradedRequests += 1;
          fallbackUsed = true;
        }

        await addIncidentLog({
          experiment_id: experiment.id,
          level: "WARN",
          message: "transaction-service processed request in degraded mode during outage.",
          metadata_json: transactionResult,
          created_at: new Date().toISOString()
        });
      } catch (error) {
        failedRequests += 1;
        latencies.push(Date.now() - requestStarted);

        await addIncidentLog({
          experiment_id: experiment.id,
          level: "ERROR",
          message: "transaction-service request failed during fraud-check-service outage.",
          metadata_json: {
            error: error.message
          },
          created_at: new Date().toISOString()
        });
      }
    }

    const averageLatencyMs =
      latencies.length > 0
        ? Number((latencies.reduce((sum, value) => sum + value, 0) / latencies.length).toFixed(2))
        : 0;
    const metricStatus = failedRequests === EXPERIMENT_TRANSACTION_SAMPLES ? "DOWN" : "DEGRADED";

    await addServiceMetric({
      experiment_id: experiment.id,
      service_name: "transaction-service",
      status: metricStatus,
      latency_ms: averageLatencyMs,
      error_count: failedRequests,
      degraded_count: degradedRequests,
      failed_requests: failedRequests,
      fallback_used: fallbackUsed,
      timestamp: new Date().toISOString()
    });

    await upsertServiceStatus("transaction-service", metricStatus, "HIGH");

    res.json({
      id: experiment.id,
      target_service: experiment.target_service,
      affected_service: experiment.affected_service,
      fault_type: experiment.fault_type,
      status: experiment.status,
      message: "fraud-check-service stopped"
    });
  } catch (error) {
    next(error);
  }
});

app.post("/experiments/recover-fraud-check", async (_req, res, next) => {
  try {
    const experiment = await getLatestRunningExperiment();

    if (!experiment) {
      return res.status(404).json({
        message: "No running experiment found."
      });
    }

    await runDockerCommand("start", FRAUD_CHECK_CONTAINER_NAME);
    const recovered = await waitForFraudServiceRecovery();
    const endedAt = new Date().toISOString();
    const recoveryTimeMs = new Date(endedAt).getTime() - new Date(experiment.started_at).getTime();

    await addIncidentLog({
      experiment_id: experiment.id,
      level: recovered ? "INFO" : "WARN",
      message: recovered
        ? "fraud-check-service recovered and health check passed."
        : "fraud-check-service start command issued, but health check did not confirm recovery in time.",
      metadata_json: {
        recovered
      },
      created_at: endedAt
    });

    await addServiceMetric({
      experiment_id: experiment.id,
      service_name: "fraud-check-service",
      status: recovered ? "UP" : "DOWN",
      latency_ms: 0,
      error_count: recovered ? 0 : 1,
      degraded_count: 0,
      failed_requests: recovered ? 0 : 1,
      fallback_used: false,
      timestamp: endedAt
    });

    const transactionHealth = await checkServiceHealth(
      SERVICE_REGISTRY.find((service) => service.name === "transaction-service")
    );

    await addServiceMetric({
      experiment_id: experiment.id,
      service_name: "transaction-service",
      status: transactionHealth.status,
      latency_ms: transactionHealth.latencyMs,
      error_count: transactionHealth.status === "DOWN" ? 1 : 0,
      degraded_count: transactionHealth.status === "DEGRADED" ? 1 : 0,
      failed_requests: transactionHealth.status === "DOWN" ? 1 : 0,
      fallback_used: false,
      timestamp: new Date().toISOString()
    });

    await upsertServiceStatus("fraud-check-service", recovered ? "UP" : "DOWN", "HIGH");
    const completedExperiment = await updateExperiment(experiment.id, {
      status: "completed",
      ended_at: endedAt,
      recovery_time_ms: recoveryTimeMs,
      safe_degradation: SAFE_DEGRADATION_MESSAGE
    });

    res.json(completedExperiment);
  } catch (error) {
    next(error);
  }
});

app.post("/experiments/:id/analyze", async (req, res, next) => {
  try {
    const detail = await getExperimentDetail(req.params.id);

    if (!detail) {
      return res.status(404).json({
        message: "Experiment not found."
      });
    }

    const normalizedMetrics = {
      experiment: {
        id: detail.id,
        domain: detail.domain,
        target_service: detail.target_service,
        affected_service: detail.affected_service,
        fault_type: detail.fault_type,
        status: detail.status,
        started_at: detail.started_at,
        ended_at: detail.ended_at,
        recovery_time_ms: detail.recovery_time_ms,
        safe_degradation: detail.safe_degradation
      },
      service_metrics: detail.metrics.map((metric) => ({
        service_name: metric.service_name,
        status: metric.status,
        latency_ms: metric.latency_ms,
        error_count: metric.error_count,
        degraded_count: metric.degraded_count,
        failed_requests: metric.failed_requests,
        fallback_used: Boolean(metric.fallback_used),
        timestamp: metric.timestamp
      })),
      incident_logs: detail.logs
    };

    let analysis;
    let analyzer = "gemini";

    try {
      analysis = await analyzeWithGemini(normalizedMetrics);
    } catch (error) {
      analyzer = "fallback";
      console.warn(`[kintsugi-monkey-api] Gemini unavailable, using fallback analyzer: ${error.message}`);
      analysis = buildFallbackAnalysis(normalizedMetrics);
    }

    const trace = {
      id: buildGoldenTraceId(),
      experiment_id: detail.id,
      summary: analysis.summary,
      suspected_weak_point: analysis.suspected_weak_point,
      blast_radius: analysis.blast_radius,
      risk_level: analysis.risk_level,
      safe_degradation_review: analysis.safe_degradation_review,
      developer_recommendations: analysis.developer_recommendations,
      next_experiments: analysis.next_experiments,
      kintsugi_lesson: analysis.kintsugi_lesson,
      raw_ai_response: JSON.stringify({
        analyzer,
        response: analysis.raw_ai_response || null
      }),
      created_at: new Date().toISOString()
    };

    await addGoldenTrace(trace);

    res.json({
      ...trace,
      analyzer
    });
  } catch (error) {
    next(error);
  }
});

app.get("/experiments", async (_req, res, next) => {
  try {
    const experiments = await listExperiments();
    res.json(experiments);
  } catch (error) {
    next(error);
  }
});

app.get("/experiments/:id", async (req, res, next) => {
  try {
    const experiment = await getExperimentDetail(req.params.id);

    if (!experiment) {
      return res.status(404).json({
        message: "Experiment not found."
      });
    }

    res.json(experiment);
  } catch (error) {
    next(error);
  }
});

app.get("/golden-traces", async (_req, res, next) => {
  try {
    const traces = await listGoldenTraces();
    res.json(traces);
  } catch (error) {
    next(error);
  }
});

app.get("/golden-traces/:id", async (req, res, next) => {
  try {
    const trace = await getGoldenTraceById(req.params.id);

    if (!trace) {
      return res.status(404).json({
        message: "Golden Trace not found."
      });
    }

    res.json(trace);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(`[kintsugi-monkey-api] ${error.stack || error.message}`);

  res.status(500).json({
    error: "Internal Server Error",
    message: error.message
  });
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[kintsugi-monkey-api] listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error(`[kintsugi-monkey-api] failed to initialize: ${error.stack || error.message}`);
    process.exit(1);
  });
