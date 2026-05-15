const express = require("express");
const cors = require("cors");

const PORT = Number(process.env.PORT || 4004);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    service: "notification-service",
    status: "UP"
  });
});

app.post("/notify", (_req, res) => {
  res.json({
    status: "queued",
    message: "Notification queued."
  });
});

app.listen(PORT, () => {
  console.log(`[notification-service] listening on port ${PORT}`);
});
