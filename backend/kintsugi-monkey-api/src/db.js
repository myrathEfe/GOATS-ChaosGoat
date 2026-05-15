const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const { SERVICE_REGISTRY } = require("./constants");

const DATABASE_PATH =
  process.env.DATABASE_PATH || path.join(__dirname, "..", "data", "kintsugi-monkey.db");

let databasePromise;

async function getDb() {
  if (!databasePromise) {
    fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

    databasePromise = open({
      filename: DATABASE_PATH,
      driver: sqlite3.Database
    });
  }

  return databasePromise;
}

async function initDb() {
  const db = await getDb();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      criticality TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chaos_experiments (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      target_service TEXT NOT NULL,
      affected_service TEXT NOT NULL,
      fault_type TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      recovery_time_ms INTEGER,
      safe_degradation TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      experiment_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      status TEXT NOT NULL,
      latency_ms REAL NOT NULL,
      error_count INTEGER NOT NULL,
      degraded_count INTEGER NOT NULL,
      failed_requests INTEGER NOT NULL,
      fallback_used INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (experiment_id) REFERENCES chaos_experiments(id)
    );

    CREATE TABLE IF NOT EXISTS incident_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      experiment_id TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (experiment_id) REFERENCES chaos_experiments(id)
    );

    CREATE TABLE IF NOT EXISTS golden_traces (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      suspected_weak_point TEXT NOT NULL,
      blast_radius TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      safe_degradation_review TEXT NOT NULL,
      developer_recommendations_json TEXT NOT NULL,
      next_experiments_json TEXT NOT NULL,
      kintsugi_lesson TEXT NOT NULL,
      raw_ai_response TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (experiment_id) REFERENCES chaos_experiments(id)
    );
  `);

  const now = new Date().toISOString();
  for (const service of SERVICE_REGISTRY) {
    await db.run(
      `
        INSERT INTO services (name, status, criticality, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(name) DO NOTHING
      `,
      [service.name, "UNKNOWN", service.criticality, now, now]
    );
  }
}

async function upsertServiceStatus(name, status, criticality = "MEDIUM") {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.run(
    `
      INSERT INTO services (name, status, criticality, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        status = excluded.status,
        criticality = excluded.criticality,
        updated_at = excluded.updated_at
    `,
    [name, status, criticality, now, now]
  );
}

async function createExperiment(experiment) {
  const db = await getDb();

  await db.run(
    `
      INSERT INTO chaos_experiments (
        id,
        domain,
        target_service,
        affected_service,
        fault_type,
        status,
        started_at,
        ended_at,
        recovery_time_ms,
        safe_degradation,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      experiment.id,
      experiment.domain,
      experiment.target_service,
      experiment.affected_service,
      experiment.fault_type,
      experiment.status,
      experiment.started_at,
      experiment.ended_at || null,
      experiment.recovery_time_ms || null,
      experiment.safe_degradation || null,
      experiment.created_at
    ]
  );
}

async function updateExperiment(id, updates) {
  const db = await getDb();
  const current = await db.get(`SELECT * FROM chaos_experiments WHERE id = ?`, [id]);

  if (!current) {
    return null;
  }

  const merged = { ...current, ...updates };

  await db.run(
    `
      UPDATE chaos_experiments
      SET domain = ?,
          target_service = ?,
          affected_service = ?,
          fault_type = ?,
          status = ?,
          started_at = ?,
          ended_at = ?,
          recovery_time_ms = ?,
          safe_degradation = ?,
          created_at = ?
      WHERE id = ?
    `,
    [
      merged.domain,
      merged.target_service,
      merged.affected_service,
      merged.fault_type,
      merged.status,
      merged.started_at,
      merged.ended_at || null,
      merged.recovery_time_ms || null,
      merged.safe_degradation || null,
      merged.created_at,
      id
    ]
  );

  return getExperimentById(id);
}

async function addServiceMetric(metric) {
  const db = await getDb();

  await db.run(
    `
      INSERT INTO service_metrics (
        experiment_id,
        service_name,
        status,
        latency_ms,
        error_count,
        degraded_count,
        failed_requests,
        fallback_used,
        timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      metric.experiment_id,
      metric.service_name,
      metric.status,
      metric.latency_ms,
      metric.error_count,
      metric.degraded_count,
      metric.failed_requests,
      metric.fallback_used ? 1 : 0,
      metric.timestamp
    ]
  );
}

async function addIncidentLog(log) {
  const db = await getDb();

  await db.run(
    `
      INSERT INTO incident_logs (
        experiment_id,
        level,
        message,
        metadata_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      log.experiment_id,
      log.level,
      log.message,
      log.metadata_json ? JSON.stringify(log.metadata_json) : null,
      log.created_at
    ]
  );
}

async function addGoldenTrace(trace) {
  const db = await getDb();

  await db.run(
    `
      INSERT INTO golden_traces (
        id,
        experiment_id,
        summary,
        suspected_weak_point,
        blast_radius,
        risk_level,
        safe_degradation_review,
        developer_recommendations_json,
        next_experiments_json,
        kintsugi_lesson,
        raw_ai_response,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      trace.id,
      trace.experiment_id,
      trace.summary,
      trace.suspected_weak_point,
      trace.blast_radius,
      trace.risk_level,
      trace.safe_degradation_review,
      JSON.stringify(trace.developer_recommendations),
      JSON.stringify(trace.next_experiments),
      trace.kintsugi_lesson,
      trace.raw_ai_response || null,
      trace.created_at
    ]
  );
}

async function getLatestRunningExperiment() {
  const db = await getDb();
  return db.get(
    `
      SELECT *
      FROM chaos_experiments
      WHERE status = 'running'
      ORDER BY datetime(started_at) DESC
      LIMIT 1
    `
  );
}

async function listExperiments() {
  const db = await getDb();
  return db.all(
    `
      SELECT *
      FROM chaos_experiments
      ORDER BY datetime(created_at) DESC
    `
  );
}

async function getExperimentById(id) {
  const db = await getDb();
  return db.get(`SELECT * FROM chaos_experiments WHERE id = ?`, [id]);
}

async function getExperimentDetail(id) {
  const db = await getDb();
  const experiment = await getExperimentById(id);

  if (!experiment) {
    return null;
  }

  const metrics = await db.all(
    `
      SELECT *
      FROM service_metrics
      WHERE experiment_id = ?
      ORDER BY datetime(timestamp) DESC
    `,
    [id]
  );

  const logs = await db.all(
    `
      SELECT *
      FROM incident_logs
      WHERE experiment_id = ?
      ORDER BY datetime(created_at) DESC
    `,
    [id]
  );

  return {
    ...experiment,
    metrics,
    logs: logs.map((log) => ({
      ...log,
      metadata_json: log.metadata_json ? JSON.parse(log.metadata_json) : null
    }))
  };
}

async function listGoldenTraces() {
  const db = await getDb();
  const rows = await db.all(
    `
      SELECT *
      FROM golden_traces
      ORDER BY datetime(created_at) DESC
    `
  );

  return rows.map(mapGoldenTraceRow);
}

async function getGoldenTraceById(id) {
  const db = await getDb();
  const row = await db.get(`SELECT * FROM golden_traces WHERE id = ?`, [id]);
  return row ? mapGoldenTraceRow(row) : null;
}

function mapGoldenTraceRow(row) {
  return {
    ...row,
    developer_recommendations: JSON.parse(row.developer_recommendations_json),
    next_experiments: JSON.parse(row.next_experiments_json)
  };
}

module.exports = {
  addGoldenTrace,
  addIncidentLog,
  addServiceMetric,
  createExperiment,
  getDb,
  getExperimentById,
  getExperimentDetail,
  getGoldenTraceById,
  getLatestRunningExperiment,
  initDb,
  listExperiments,
  listGoldenTraces,
  updateExperiment,
  upsertServiceStatus
};
