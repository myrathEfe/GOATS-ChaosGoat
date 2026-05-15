const express = require("express");
const cors = require("cors");

const PORT = Number(process.env.PORT || 4003);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    service: "fraud-check-service",
    status: "UP"
  });
});

app.post("/fraud/check", (req, res) => {
  const { transactionId, amount, fromAccount, toAccount } = req.body || {};

  res.json({
    transactionId: transactionId || `txn_${Date.now()}`,
    risk: amount > 50000 ? "MEDIUM" : "LOW",
    approved: true,
    fromAccount: fromAccount || "acc_1001",
    toAccount: toAccount || "acc_2002"
  });
});

app.listen(PORT, () => {
  console.log(`[fraud-check-service] listening on port ${PORT}`);
});
