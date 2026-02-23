import Database from 'better-sqlite3';
import { config } from '../config.js';
import path from 'path';
import fs from 'fs';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbDir = path.dirname(path.resolve(config.DB_PATH));
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(config.DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
