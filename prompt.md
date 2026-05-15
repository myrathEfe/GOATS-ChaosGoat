You are building the complete backend, database, Docker infrastructure, chaos engine, and Gemini analysis integration for a 24-hour hackathon project called "Kintsugi Monkey Banking".

Project concept:
Kintsugi Monkey Banking is a chaos engineering platform inspired by Kintsugi philosophy.
It simulates a banking microservice system, intentionally breaks one service in a controlled way, stores logs/metrics in a database, sends those metrics to Gemini API, and returns developer-facing repair recommendations called "Golden Trace".

Kintsugi interpretation:
In Kintsugi, cracks are not hidden. They are made visible and become part of the object's identity.
In this system, service failures are not hidden in logs. They are recorded, analyzed, and transformed into Golden Traces, which become the system's resilience memory.

Important behavior:
- Gemini must not modify or fix the system.
- Gemini only analyzes collected metrics and gives developer recommendations.
- If Gemini API key is missing or API fails, use deterministic fallback analysis.
- Never expose Gemini API key to frontend.
- Keep this hackathon-simple and reliable.

Tech stack:
- Node.js + Express
- Docker Compose
- SQLite preferred for speed, or PostgreSQL if easy
- Gemini API from backend only
- No authentication
- No Kubernetes
- No Prometheus/Grafana
- No complex distributed tracing
- Keep code readable and demo-focused

Required services:
1. kintsugi-monkey-api
2. account-service
3. transaction-service
4. fraud-check-service
5. notification-service

Required folder structure:
- /backend/kintsugi-monkey-api
- /backend/account-service
- /backend/transaction-service
- /backend/fraud-check-service
- /backend/notification-service
- docker-compose.yml
- README.md

Ports:
- kintsugi-monkey-api: 4000
- account-service: 4001
- transaction-service: 4002
- fraud-check-service: 4003
- notification-service: 4004
- frontend will later run on 5173

Docker container names:
- kintsugi-monkey-api
- kintsugi-account-service
- kintsugi-transaction-service
- kintsugi-fraud-check-service
- kintsugi-notification-service

Banking service behavior:

1. account-service
Port: 4001

Endpoints:
GET /health
Response:
{
  "service": "account-service",
  "status": "UP"
}

GET /accounts/1
Response:
{
  "accountId": "acc_1001",
  "owner": "Demo User",
  "balance": 50000,
  "currency": "TRY"
}

2. fraud-check-service
Port: 4003

Endpoints:
GET /health
Response:
{
  "service": "fraud-check-service",
  "status": "UP"
}

POST /fraud/check
Request:
{
  "transactionId": "txn_1001",
  "amount": 1250,
  "fromAccount": "acc_1001",
  "toAccount": "acc_2002"
}

Normal response:
{
  "transactionId": "txn_1001",
  "risk": "LOW",
  "approved": true
}

3. transaction-service
Port: 4002

Endpoints:
GET /health
It should check fraud-check-service availability.

If fraud-check-service is available:
{
  "service": "transaction-service",
  "status": "UP",
  "dependency": "fraud-check-service",
  "dependencyStatus": "UP"
}

If fraud-check-service is unavailable:
{
  "service": "transaction-service",
  "status": "DEGRADED",
  "dependency": "fraud-check-service",
  "dependencyStatus": "DOWN"
}

POST /transactions/demo

Normal behavior:
- Creates a demo transaction
- Calls fraud-check-service /fraud/check
- If fraud-check-service approves, return success

Normal response:
{
  "transactionId": "txn_1001",
  "status": "approved",
  "message": "Transaction approved after fraud check.",
  "fraudCheckStatus": "passed"
}

Degraded behavior:
If fraud-check-service is down:
Do not approve the transaction automatically.
Return a safe banking fallback:
{
  "transactionId": "txn_1001",
  "status": "pending_manual_review",
  "message": "Fraud check service unavailable. Transaction moved to manual review queue.",
  "fraudCheckStatus": "unavailable",
  "degraded": true
}

Important:
In banking, fallback must be safe. Do not approve risky transactions when fraud-check-service is unavailable.

4. notification-service
Port: 4004

Endpoints:
GET /health
Response:
{
  "service": "notification-service",
  "status": "UP"
}

POST /notify
Response:
{
  "status": "queued",
  "message": "Notification queued."
}

kintsugi-monkey-api behavior:
Port: 4000

This is the main API used by frontend.

Required endpoints:

GET /health/services

It checks all services and returns:
{
  "services": [
    { "name": "account-service", "status": "UP or DOWN" },
    { "name": "transaction-service", "status": "UP or DEGRADED or DOWN" },
    { "name": "fraud-check-service", "status": "UP or DOWN" },
    { "name": "notification-service", "status": "UP or DOWN" }
  ],
  "timestamp": "ISO_DATE"
}

POST /banking/demo-transaction

It proxies or calls transaction-service /transactions/demo and returns the response.
Also optionally logs the result.

POST /experiments/kill-fraud-check

This starts a chaos experiment:
- Create experiment record in DB
- target_service = fraud-check-service
- fault_type = service_kill
- domain = banking
- status = running
- started_at = now
- Stop fraud-check-service container using:
  docker stop kintsugi-fraud-check-service

After stopping, call transaction-service /transactions/demo multiple times, for example 5 times.
Collect:
- failed_requests
- degraded_requests
- fallback_used
- average_latency_ms
- affected_service = transaction-service
- safe_degradation = "Transactions moved to pending manual review instead of auto-approval."

Return:
{
  "id": "exp_...",
  "target_service": "fraud-check-service",
  "affected_service": "transaction-service",
  "fault_type": "service_kill",
  "status": "running",
  "message": "fraud-check-service stopped"
}

POST /experiments/recover-fraud-check

This recovers the target service:
- docker start kintsugi-fraud-check-service
- Close latest running experiment
- ended_at = now
- recovery_time_ms
- status = completed
- save final metrics to DB
- return completed experiment object

POST /experiments/:id/analyze

This endpoint generates Golden Trace.
Steps:
1. Find experiment by id from DB.
2. Collect related metrics/logs from DB.
3. Build normalized metrics JSON.
4. Send it to Gemini API with a structured prompt.
5. If Gemini fails or GEMINI_API_KEY is missing, use fallback analyzer.
6. Save Golden Trace to DB.
7. Return Golden Trace JSON.

GET /experiments
Return all experiments, newest first.

GET /experiments/:id
Return experiment detail with metrics/logs if possible.

GET /golden-traces
Return all Golden Trace records, newest first.

GET /golden-traces/:id
Return Golden Trace detail.

Database:
Use SQLite for simplicity.

Create tables:

services
- id
- name
- status
- criticality
- created_at
- updated_at

chaos_experiments
- id
- domain
- target_service
- affected_service
- fault_type
- status
- started_at
- ended_at
- recovery_time_ms
- safe_degradation
- created_at

service_metrics
- id
- experiment_id
- service_name
- status
- latency_ms
- error_count
- degraded_count
- failed_requests
- fallback_used
- timestamp

incident_logs
- id
- experiment_id
- level
- message
- metadata_json
- created_at

golden_traces
- id
- experiment_id
- summary
- suspected_weak_point
- blast_radius
- risk_level
- safe_degradation_review
- developer_recommendations_json
- next_experiments_json
- kintsugi_lesson
- raw_ai_response
- created_at

Gemini integration:
Use GEMINI_API_KEY from environment.

Do not expose it to frontend.

Create a module:
geminiAnalyzer.js

It should export:
async function analyzeWithGemini(metrics)

Prompt:

"You are a senior SRE and resilience analyst for a banking microservice system.

You will receive chaos engineering experiment metrics.
Your task is to generate developer-facing recommendations.

Do not modify the system.
Do not claim that you applied a fix.
Do not produce code unless explicitly asked.
Focus on:
- root cause hypothesis
- blast radius
- resilience risk
- safe degradation
- developer recommendations
- prevention steps
- Kintsugi-style learning: what this fracture teaches the system

Return only valid JSON with:
{
  "summary": "",
  "suspected_weak_point": "",
  "blast_radius": "",
  "risk_level": "LOW | MEDIUM | HIGH",
  "safe_degradation_review": "",
  "developer_recommendations": [],
  "next_experiments": [],
  "kintsugi_lesson": ""
}

Experiment metrics:
{{METRICS_JSON}}"

Fallback analyzer:
Create deterministic fallback if Gemini is unavailable.

Fallback output example:
{
  "summary": "fraud-check-service was intentionally stopped during a controlled chaos experiment.",
  "suspected_weak_point": "transaction-service has a critical runtime dependency on fraud-check-service.",
  "blast_radius": "transaction-service entered degraded mode. Transactions were moved to manual review instead of auto-approval.",
  "risk_level": "HIGH",
  "safe_degradation_review": "The fallback behavior is safe for banking because it avoids approving transactions without fraud verification.",
  "developer_recommendations": [
    "Add timeout between transaction-service and fraud-check-service",
    "Use circuit breaker to prevent cascading failures",
    "Create a manual review queue for fraud-check outages",
    "Add alerting for fraud-check-service downtime",
    "Test pending_review workflow under load"
  ],
  "next_experiments": [
    "Inject latency into fraud-check-service",
    "Simulate notification-service outage during pending review",
    "Test transaction-service under concurrent degraded requests"
  ],
  "kintsugi_lesson": "This fracture shows that safe degradation is more valuable than pretending the system is always healthy."
}

Docker requirements:
- docker-compose.yml should start all backend services.
- kintsugi-monkey-api must be able to run docker stop/start commands.
- Mount Docker socket if necessary:
  /var/run/docker.sock:/var/run/docker.sock
- Explain in README that this is for hackathon demo only.

CORS:
Enable CORS for frontend.

Quality:
- Clear logs
- Graceful error handling
- Simple code
- Working demo over overengineering
- Keep endpoint names stable for frontend

README must include:
- How to run:
  docker compose up --build
- How to set Gemini:
  GEMINI_API_KEY=your_key_here
- Mention fallback analyzer works without key
- Test commands:

curl http://localhost:4000/health/services

curl -X POST http://localhost:4000/banking/demo-transaction

curl -X POST http://localhost:4000/experiments/kill-fraud-check

curl -X POST http://localhost:4000/experiments/recover-fraud-check

curl http://localhost:4000/experiments

curl -X POST http://localhost:4000/experiments/<EXPERIMENT_ID>/analyze

curl http://localhost:4000/golden-traces

Deliverable:
Generate the full backend project, Docker Compose, database initialization, Gemini/fallback analyzer, and README.

After implementing, provide:
- file structure
- endpoint list
- test flow
- notes for frontend teammate
