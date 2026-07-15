import type { Incident, AgentStep, ErrorEvent, RCA } from '@sre/shared';
import { db } from './db.js';

type IncidentRow = {
  id: string;
  fingerprint: string;
  status: Incident['status'];
  title: string;
  first_seen: string;
  count: number;
  rca_json: string | null;
  error_event_json: string | null;
};

function rowToIncident(row: IncidentRow): Incident {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    status: row.status,
    title: row.title,
    firstSeen: row.first_seen,
    count: row.count,
    rca: row.rca_json ? (JSON.parse(row.rca_json) as RCA) : undefined,
  };
}

export function createIncident(input: {
  id: string;
  fingerprint: string;
  title: string;
  firstSeen: string;
  event: ErrorEvent;
}): Incident {
  db.prepare(
    `INSERT INTO incidents (id, fingerprint, status, title, first_seen, count, error_event_json)
     VALUES (?, ?, 'investigating', ?, ?, 1, ?)`,
  ).run(input.id, input.fingerprint, input.title, input.firstSeen, JSON.stringify(input.event));
  return getIncident(input.id)!;
}

export function getErrorEvent(id: string): ErrorEvent | undefined {
  const row = db
    .prepare(`SELECT error_event_json FROM incidents WHERE id = ?`)
    .get(id) as { error_event_json: string | null } | undefined;
  return row?.error_event_json ? (JSON.parse(row.error_event_json) as ErrorEvent) : undefined;
}

export function findByFingerprint(fingerprint: string): Incident | undefined {
  const row = db
    .prepare(`SELECT * FROM incidents WHERE fingerprint = ?`)
    .get(fingerprint) as IncidentRow | undefined;
  return row ? rowToIncident(row) : undefined;
}

export function bumpCount(id: string): void {
  db.prepare(`UPDATE incidents SET count = count + 1 WHERE id = ?`).run(id);
}

export function setStatus(id: string, status: Incident['status']): void {
  db.prepare(`UPDATE incidents SET status = ? WHERE id = ?`).run(status, id);
}

export function setRca(id: string, rca: RCA): void {
  db.prepare(`UPDATE incidents SET rca_json = ? WHERE id = ?`).run(
    JSON.stringify(rca),
    id,
  );
}

const insertStep = db.transaction((step: AgentStep): number => {
  const next = db
    .prepare(
      `SELECT COALESCE(MAX(idx), -1) + 1 AS idx
         FROM agent_steps WHERE incident_id = ?`,
    )
    .get(step.incidentId) as { idx: number };

  db.prepare(
    `INSERT INTO agent_steps
       (incident_id, idx, type, tool, input_json, output, text)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    step.incidentId,
    next.idx,
    step.type,
    step.tool ?? null,
    step.input !== undefined ? JSON.stringify(step.input) : null,
    step.output ?? null,
    step.text ?? null,
  );

  return next.idx;
});

export function appendStep(step: AgentStep): number {
  return insertStep(step);
}

export function getIncident(id: string): Incident | undefined {
  const row = db
    .prepare(`SELECT * FROM incidents WHERE id = ?`)
    .get(id) as IncidentRow | undefined;
  return row ? rowToIncident(row) : undefined;
}

export function listIncidents(): Incident[] {
  const rows = db
    .prepare(`SELECT * FROM incidents ORDER BY rowid DESC`)
    .all() as IncidentRow[];
  return rows.map(rowToIncident);
}

type AgentStepRow = {
  incident_id: string;
  idx: number;
  type: AgentStep['type'];
  tool: string | null;
  input_json: string | null;
  output: string | null;
  text: string | null;
};

function rowToStep(row: AgentStepRow): AgentStep {
  return {
    incidentId: row.incident_id,
    index: row.idx,
    type: row.type,
    tool: row.tool ?? undefined,
    input: row.input_json ? JSON.parse(row.input_json) : undefined,
    output: row.output ?? undefined,
    text: row.text ?? undefined,
  };
}

export function listSteps(incidentId: string): AgentStep[] {
  const rows = db
    .prepare(
      `SELECT incident_id, idx, type, tool, input_json, output, text
         FROM agent_steps WHERE incident_id = ? ORDER BY idx ASC`,
    )
    .all(incidentId) as AgentStepRow[];
  return rows.map(rowToStep);
}
