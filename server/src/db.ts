import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db: Awaited<ReturnType<typeof open>> | null = null;

export async function getDb() {
  if (!db) {
    db = await open({
      filename: path.join(dataDir, 'contracts.db'),
      driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        clauses TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contracts (
        id TEXT PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 1,
        parent_id TEXT,
        title TEXT NOT NULL,
        template_id TEXT NOT NULL,
        raw_content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        submitted_by TEXT NOT NULL,
        submitted_by_name TEXT NOT NULL,
        current_approver_role TEXT,
        has_high_risk INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        contract_id TEXT NOT NULL,
        clause_number TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        risk_level TEXT NOT NULL DEFAULT 'none',
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS approval_nodes (
        id TEXT PRIMARY KEY,
        contract_id TEXT NOT NULL,
        role TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        comment TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_contracts_parent ON contracts(parent_id);
      CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
      CREATE INDEX IF NOT EXISTS idx_comments_contract ON comments(contract_id);
      CREATE INDEX IF NOT EXISTS idx_approval_contract ON approval_nodes(contract_id);
    `);
  }
  return db;
}

export default { getDb };
