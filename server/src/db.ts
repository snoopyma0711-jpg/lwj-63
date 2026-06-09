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
        risk_score INTEGER NOT NULL DEFAULT 0,
        expiry_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contract_summaries (
        id TEXT PRIMARY KEY,
        contract_id TEXT NOT NULL UNIQUE,
        party_a TEXT,
        party_b TEXT,
        contract_amount TEXT,
        effective_date TEXT,
        expiry_date TEXT,
        payment_method TEXT,
        penalty_ratio TEXT,
        confidentiality_period TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS warning_rules (
        id TEXT PRIMARY KEY,
        days INTEGER NOT NULL,
        level TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS warning_records (
        id TEXT PRIMARY KEY,
        contract_id TEXT NOT NULL,
        contract_title TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        days_remaining INTEGER NOT NULL,
        warning_level TEXT NOT NULL,
        warning_color TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        renewed_contract_id TEXT,
        handled_by TEXT,
        handled_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
        FOREIGN KEY (renewed_contract_id) REFERENCES contracts(id) ON DELETE SET NULL
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
        arrived_at TEXT,
        processed_at TEXT,
        processing_duration_ms INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS approval_timeout_configs (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL UNIQUE,
        threshold_hours INTEGER NOT NULL DEFAULT 24,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS template_versions (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        name TEXT NOT NULL,
        clauses TEXT NOT NULL,
        description TEXT,
        created_by TEXT NOT NULL,
        created_by_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
        UNIQUE(template_id, version_number)
      );

      CREATE TABLE IF NOT EXISTS template_drafts (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL UNIQUE,
        clauses TEXT NOT NULL,
        name TEXT NOT NULL,
        saved_by TEXT NOT NULL,
        saved_by_name TEXT NOT NULL,
        last_saved_at TEXT NOT NULL,
        FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS template_edit_locks (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        acquired_at TEXT NOT NULL,
        last_activity_at TEXT NOT NULL,
        FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_contracts_parent ON contracts(parent_id);
      CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
      CREATE INDEX IF NOT EXISTS idx_contracts_expiry ON contracts(expiry_date);
      CREATE INDEX IF NOT EXISTS idx_comments_contract ON comments(contract_id);
      CREATE INDEX IF NOT EXISTS idx_approval_contract ON approval_nodes(contract_id);
      CREATE INDEX IF NOT EXISTS idx_warning_rules_days ON warning_rules(days);
      CREATE INDEX IF NOT EXISTS idx_warning_records_contract ON warning_records(contract_id);
      CREATE INDEX IF NOT EXISTS idx_warning_records_status ON warning_records(status);
      CREATE INDEX IF NOT EXISTS idx_warning_records_level ON warning_records(warning_level);
      CREATE INDEX IF NOT EXISTS idx_contracts_risk_score ON contracts(risk_score);
      CREATE INDEX IF NOT EXISTS idx_contract_summaries_contract ON contract_summaries(contract_id);
      CREATE INDEX IF NOT EXISTS idx_template_versions_template ON template_versions(template_id);
      CREATE INDEX IF NOT EXISTS idx_template_versions_number ON template_versions(template_id, version_number);
      CREATE INDEX IF NOT EXISTS idx_template_drafts_template ON template_drafts(template_id);
      CREATE INDEX IF NOT EXISTS idx_template_locks_template ON template_edit_locks(template_id);
      CREATE INDEX IF NOT EXISTS idx_template_locks_activity ON template_edit_locks(last_activity_at);

      CREATE TABLE IF NOT EXISTS clause_relations (
        id TEXT PRIMARY KEY,
        clause_number_a TEXT NOT NULL,
        clause_number_b TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        description TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_by_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(clause_number_a, clause_number_b)
      );

      CREATE TABLE IF NOT EXISTS clause_change_warnings (
        id TEXT PRIMARY KEY,
        contract_id TEXT NOT NULL,
        contract_title TEXT NOT NULL,
        changed_clause_number TEXT NOT NULL,
        changed_clause_title TEXT,
        affected_clause_numbers TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        changed_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS idx_clause_relations_a ON clause_relations(clause_number_a);
      CREATE INDEX IF NOT EXISTS idx_clause_relations_b ON clause_relations(clause_number_b);
      CREATE INDEX IF NOT EXISTS idx_clause_relations_type ON clause_relations(relation_type);
      CREATE INDEX IF NOT EXISTS idx_clause_warnings_contract ON clause_change_warnings(contract_id);
      CREATE INDEX IF NOT EXISTS idx_clause_warnings_created ON clause_change_warnings(created_at);
      CREATE INDEX IF NOT EXISTS idx_clause_warnings_status ON clause_change_warnings(status);
    `);
  }
  return db;
}

export default { getDb };
