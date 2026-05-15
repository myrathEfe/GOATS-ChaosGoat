# Kintsugi Monkey Banking Backend

Kintsugi Monkey Banking is a hackathon chaos engineering demo for a banking microservice system. The backend intentionally breaks `fraud-check-service`, records the blast radius in SQLite, and generates developer-facing repair guidance called Golden Trace through Gemini or a deterministic fallback analyzer.

This setup is intentionally demo-focused:

- Node.js + Express microservices
- SQLite persistence
- Docker Compose for all backend services
- Gemini API used only from backend
- Safe banking degradation when fraud checks are unavailable
- Docker socket mount for chaos control in the demo only

## File Structure

```text
.
├── backend
│   ├── account-service
│   ├── fraud-check-service
│   ├── kintsugi-monkey-api
│   ├── notification-service
│   └── transaction-service
├── docker-compose.yml
├── prompt.md
└── README.md
```

## Services and Ports

- `kintsugi-monkey-api` on `4000`
- `account-service` on `4001`
- `transaction-service` on `4002`
- `fraud-check-service` on `4003`
- `notification-service` on `4004`
- Frontend will later run on `5173`

## How To Run

1. Optionally export a Gemini key:

```bash
export GEMINI_API_KEY=your_key_here
```

2. Start the full backend:

```bash
docker compose up --build
```

If `GEMINI_API_KEY` is not set or Gemini fails, the fallback analyzer still works and Golden Trace generation continues.

## Docker Note

`kintsugi-monkey-api` mounts `/var/run/docker.sock:/var/run/docker.sock` so it can run `docker stop` and `docker start` against the fraud service during the chaos demo. This is for hackathon demonstration only and should not be used as-is in production.

## Endpoint List

### `kintsugi-monkey-api` (`4000`)

- `GET /health/services`
- `POST /banking/demo-transaction`
- `POST /experiments/kill-fraud-check`
- `POST /experiments/recover-fraud-check`
- `POST /experiments/:id/analyze`
- `GET /experiments`
- `GET /experiments/:id`
- `GET /golden-traces`
- `GET /golden-traces/:id`

### `account-service` (`4001`)

- `GET /health`
- `GET /accounts/1`

### `transaction-service` (`4002`)

- `GET /health`
- `POST /transactions/demo`

### `fraud-check-service` (`4003`)

- `GET /health`
- `POST /fraud/check`

### `notification-service` (`4004`)

- `GET /health`
- `POST /notify`

## Test Commands

```bash
curl http://localhost:4000/health/services

curl -X POST http://localhost:4000/banking/demo-transaction

curl -X POST http://localhost:4000/experiments/kill-fraud-check

curl -X POST http://localhost:4000/experiments/recover-fraud-check

curl http://localhost:4000/experiments

curl -X POST http://localhost:4000/experiments/<EXPERIMENT_ID>/analyze

curl http://localhost:4000/golden-traces
```

## Demo Flow

1. Run `GET /health/services` and confirm all services are healthy.
2. Run `POST /banking/demo-transaction` and verify the normal approved banking path.
3. Run `POST /experiments/kill-fraud-check` to stop `fraud-check-service` and sample degraded transaction behavior.
4. Run `GET /experiments` or `GET /experiments/:id` to inspect recorded metrics and logs.
5. Run `POST /experiments/recover-fraud-check` to restart the dependency and close the experiment.
6. Run `POST /experiments/<EXPERIMENT_ID>/analyze` to create a Golden Trace from Gemini or the fallback analyzer.
7. Run `GET /golden-traces` to review stored resilience learnings.

## Notes For Frontend Teammate

- Use only `kintsugi-monkey-api` on port `4000`; the frontend should not call internal services directly.
- `POST /banking/demo-transaction` returns either an approved response or a safe degraded fallback with `status: "pending_manual_review"` and `degraded: true`.
- `GET /health/services` is the best dashboard bootstrap endpoint for service cards and status chips.
- `GET /experiments/:id` returns experiment detail plus `metrics` and `logs` for drill-down views.
- `POST /experiments/:id/analyze` returns the saved Golden Trace payload and an `analyzer` field showing `gemini` or `fallback`.
- Gemini API keys stay backend-only and must never be requested from the browser.
