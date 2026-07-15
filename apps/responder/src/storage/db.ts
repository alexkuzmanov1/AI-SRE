import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { env } from '../config/env.js';

export const db: Database.Database = new Database(env.DATABASE_URL());

db.pragma('journal_mode = WAL');

const schemaPath = new URL('./schema.sql', import.meta.url);
db.exec(readFileSync(schemaPath, 'utf8'));

// Idempotent migration for pre-existing local data.db files created before
// error_event_json existed. CREATE TABLE IF NOT EXISTS above only helps a
// fresh DB; this upgrades an already-created one in place.
try {
  db.exec('ALTER TABLE incidents ADD COLUMN error_event_json TEXT');
} catch {
  // column already present
}
