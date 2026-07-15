CREATE TABLE IF NOT EXISTS incidents (
  id               TEXT PRIMARY KEY,
  fingerprint      TEXT UNIQUE NOT NULL,
  status           TEXT NOT NULL,
  title            TEXT NOT NULL,
  first_seen       TEXT NOT NULL,
  count            INTEGER NOT NULL DEFAULT 1,
  rca_json         TEXT,
  error_event_json TEXT
);

CREATE TABLE IF NOT EXISTS agent_steps (
  incident_id TEXT NOT NULL,
  idx         INTEGER NOT NULL,
  type        TEXT NOT NULL,
  tool        TEXT,
  input_json  TEXT,
  output      TEXT,
  text        TEXT,
  PRIMARY KEY (incident_id, idx)
);

CREATE INDEX IF NOT EXISTS idx_agent_steps_incident ON agent_steps (incident_id, idx);
