const express = require("express");
const cors = require("cors");

const PORT = Number(process.env.PORT || 4002);
const FRAUD_CHECK_SERVICE_URL =
  process.env.FRAUD_CHECK_SERVICE_URL || "http://fraud-check-service:4003";

const app = express();
app.use(cors());
app.use(express.json());

let transactionCounter = 1000;

function nextTransactionId() {
  transactionCounter += 1;
  return `txn_${transactionCounter}`;
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

async function getFraudDependencyState() {
  try {
    await fetchJson(`${FRAUD_CHECK_SERVICE_URL}/health`, { timeoutMs: 1500 });
    return "UP";
  } catch (_error) {
    return "DOWN";
  }
}

app.get("/health", async (_req, res) => {
  const dependencyStatus = await getFraudDependencyState();
  const status = dependencyStatus === "UP" ? "UP" : "DEGRADED";

  res.json({
    service: "transaction-service",
    status,
    dependency: "fraud-check-service",
    dependencyStatus
  });
});

app.post("/transactions/demo", async (_req, res) => {
  const transactionId = nextTransactionId();
  const payload = {
    transactionId,
    amount: 1250,
    fromAccount: "acc_1001",
    toAccount: "acc_2002"
  };

  try {
    const fraudCheck = await fetchJson(`${FRAUD_CHECK_SERVICE_URL}/fraud/check`, {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 2500
    });

    if (!fraudCheck.approved) {
      return res.status(202).json({
        transactionId,
        status: "rejected",
        message: "Transaction rejected by fraud check.",
        fraudCheckStatus: "failed"
      });
    }

    return res.json({
      transactionId,
      status: "approved",
      message: "Transaction approved after fraud check.",
      fraudCheckStatus: "passed"
    });
  } catch (error) {
    console.warn(
      `[transaction-service] fraud-check-service unavailable, switching to safe fallback: ${error.message}`
    );

    return res.status(202).json({
      transactionId,
      status: "pending_manual_review",
      message:
        "Fraud check service unavailable. Transaction moved to manual review queue.",
      fraudCheckStatus: "unavailable",
      degraded: true
    });
  }
});

app.listen(PORT, () => {
  console.log(`[transaction-service] listening on port ${PORT}`);
});
