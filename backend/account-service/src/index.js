const express = require("express");
const cors = require("cors");

const PORT = Number(process.env.PORT || 4001);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    service: "account-service",
    status: "UP"
  });
});

app.get("/accounts/1", (_req, res) => {
  res.json({
    accountId: "acc_1001",
    owner: "Demo User",
    balance: 50000,
    currency: "TRY"
  });
});

app.listen(PORT, () => {
  console.log(`[account-service] listening on port ${PORT}`);
});
