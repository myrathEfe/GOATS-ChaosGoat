const SERVICE_REGISTRY = [
  {
    name: "account-service",
    url: process.env.ACCOUNT_SERVICE_URL || "http://account-service:4001",
    healthPath: "/health",
    criticality: "MEDIUM"
  },
  {
    name: "transaction-service",
    url: process.env.TRANSACTION_SERVICE_URL || "http://transaction-service:4002",
    healthPath: "/health",
    criticality: "HIGH"
  },
  {
    name: "fraud-check-service",
    url: process.env.FRAUD_CHECK_SERVICE_URL || "http://fraud-check-service:4003",
    healthPath: "/health",
    criticality: "HIGH"
  },
  {
    name: "notification-service",
    url: process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:4004",
    healthPath: "/health",
    criticality: "LOW"
  }
];

const SAFE_DEGRADATION_MESSAGE =
  "Transactions moved to pending manual review instead of auto-approval.";

module.exports = {
  SAFE_DEGRADATION_MESSAGE,
  SERVICE_REGISTRY
};
