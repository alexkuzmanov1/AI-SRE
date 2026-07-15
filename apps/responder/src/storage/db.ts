import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { env } from '../config/env.js';

export const db: Database.Database = new Database(env.DATABASE_URL());

db.pragma('journal_mode = WAL');

const schemaPath = new URL('./schema.sql', import.meta.url);
db.exec(readFileSync(schemaPath, 'utf8'));
