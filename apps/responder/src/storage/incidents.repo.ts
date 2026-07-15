import type { Incident, AgentStep, RCA } from '@sre/shared';
import { db } from './db.js';

type IncidentRow = {
  id: string;
  fingerprint: string;
  status: Incident['status'];
  title: string;
  first_seen: string;
  count: number;
  rca_json: string | null;
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
}): Incident {
  db.prepare(
    `INSERT INTO incidents (id, fingerprint, status, title, first_seen, count)
     VALUES (?, ?, 'investigating', ?, ?, 1)`,
  ).run(input.id, input.fingerprint, input.title, input.firstSeen);
  return getIncident(input.id)!;
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
