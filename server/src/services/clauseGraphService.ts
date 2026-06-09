import { getDb } from '../db';
import {
  ClauseRelation,
  ClauseRelationType,
  ClauseRelationWithClauseInfo,
  ImpactAnalysisResult,
  ClauseChangeWarning,
  ClauseChangeWarningFilters,
  Clause
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getTemplate, getContract } from './dbService';
import { parseClauses } from './comparisonService';

function normalizeClausePair(clauseA: string, clauseB: string): [string, string] {
  return clauseA <= clauseB ? [clauseA, clauseB] : [clauseB, clauseA];
}

export async function createClauseRelation(data: {
  clauseNumberA: string;
  clauseNumberB: string;
  relationType: ClauseRelationType;
  description: string;
  createdBy: string;
  createdByName: string;
}): Promise<ClauseRelation | { error: string }> {
  const [normalizedA, normalizedB] = normalizeClausePair(data.clauseNumberA, data.clauseNumberB);

  if (normalizedA === normalizedB) {
    return { error: '不能与自身建立关联' };
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const db = await getDb();

  try {
    await db.run(`
      INSERT INTO clause_relations (
        id, clause_number_a, clause_number_b, relation_type, description,
        created_by, created_by_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, id, normalizedA, normalizedB, data.relationType, data.description,
      data.createdBy, data.createdByName, now);

    return getClauseRelation(id) as Promise<ClauseRelation>;
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return { error: '该条款对已存在关联关系' };
    }
    throw err;
  }
}

export async function getClauseRelation(id: string): Promise<ClauseRelation | null> {
  const db = await getDb();
  const row = await db.get('SELECT * FROM clause_relations WHERE id = ?', id);
  if (!row) return null;
  return rowToClauseRelation(row);
}

export async function getClauseRelations(filters?: {
  clauseNumber?: string;
  keyword?: string;
  relationType?: ClauseRelationType;
}): Promise<ClauseRelationWithClauseInfo[]> {
  const db = await getDb();
  let query = 'SELECT * FROM clause_relations WHERE 1=1';
  const params: any[] = [];

  if (filters?.clauseNumber) {
    query += ' AND (clause_number_a = ? OR clause_number_b = ?)';
    params.push(filters.clauseNumber, filters.clauseNumber);
  }

  if (filters?.keyword) {
    query += ' AND (clause_number_a LIKE ? OR clause_number_b LIKE ? OR description LIKE ?)';
    const likeKeyword = `%${filters.keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword);
  }

  if (filters?.relationType) {
    query += ' AND relation_type = ?';
    params.push(filters.relationType);
  }

  query += ' ORDER BY created_at DESC';
  const rows = await db.all(query, ...params);

  return rows.map(rowToClauseRelation);
}

export async function deleteClauseRelation(id: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.run('DELETE FROM clause_relations WHERE id = ?', id);
  return (result.changes || 0) > 0;
}

export async function getImpactAnalysis(
  clauseNumber: string,
  templateId?: string
): Promise<ImpactAnalysisResult> {
  const db = await getDb();

  const allRelations = await db.all(`
    SELECT * FROM clause_relations 
    WHERE clause_number_a = ? OR clause_number_b = ?
  `, clauseNumber, clauseNumber);

  const directRelations: ClauseRelationWithClauseInfo[] = [];
  const visited = new Set<string>();
  visited.add(clauseNumber);

  for (const row of allRelations) {
    const rel = rowToClauseRelation(row);
    directRelations.push(rel);
    const otherClause = rel.clauseNumberA === clauseNumber ? rel.clauseNumberB : rel.clauseNumberA;
    visited.add(otherClause);
  }

  const indirectRelations: ClauseRelationWithClauseInfo[] = [];

  for (const directRel of directRelations) {
    const otherClause = directRel.clauseNumberA === clauseNumber
      ? directRel.clauseNumberB
      : directRel.clauseNumberA;

    const secondLevelRows = await db.all(`
      SELECT * FROM clause_relations 
      WHERE (clause_number_a = ? OR clause_number_b = ?)
        AND id != ?
    `, otherClause, otherClause, directRel.id);

    for (const row of secondLevelRows) {
      const rel = rowToClauseRelation(row);
      const targetClause = rel.clauseNumberA === otherClause ? rel.clauseNumberB : rel.clauseNumberA;

      if (!visited.has(targetClause)) {
        indirectRelations.push(rel);
        visited.add(targetClause);
      }
    }
  }

  let clauseTitle: string | undefined;
  if (templateId) {
    const template = await getTemplate(templateId);
    if (template) {
      const clause = template.clauses.find((c: Clause) => c.number === clauseNumber);
      clauseTitle = clause?.title;
    }
  }

  const result: ImpactAnalysisResult = {
    clauseNumber,
    clauseTitle,
    directRelations: groupAndSortRelations(directRelations, clauseNumber),
    indirectRelations: groupAndSortRelations(indirectRelations, clauseNumber)
  };

  return result;
}

function groupAndSortRelations(
  relations: ClauseRelationWithClauseInfo[],
  currentClause: string
): { [key in ClauseRelationType]?: ClauseRelationWithClauseInfo[] } {
  const grouped: { [key in ClauseRelationType]?: ClauseRelationWithClauseInfo[] } = {};

  for (const rel of relations) {
    const type = rel.relationType;
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type]!.push(rel);
  }

  for (const type of Object.keys(grouped) as ClauseRelationType[]) {
    grouped[type]!.sort((a, b) => {
      if (type === '冲突') {
        return 0;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  const sortedGrouped: { [key in ClauseRelationType]?: ClauseRelationWithClauseInfo[] } = {};
  const typeOrder: ClauseRelationType[] = ['冲突', '引用', '补充', '替代'];

  for (const type of typeOrder) {
    if (grouped[type]) {
      sortedGrouped[type] = grouped[type];
    }
  }

  return sortedGrouped;
}

export async function getRelatedClauses(clauseNumber: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.all(`
    SELECT * FROM clause_relations 
    WHERE clause_number_a = ? OR clause_number_b = ?
  `, clauseNumber, clauseNumber);

  const related = new Set<string>();
  for (const row of rows) {
    const rel = rowToClauseRelation(row);
    if (rel.clauseNumberA !== clauseNumber) related.add(rel.clauseNumberA);
    if (rel.clauseNumberB !== clauseNumber) related.add(rel.clauseNumberB);
  }

  return Array.from(related);
}

export async function handleClauseChange(
  contractId: string,
  changedClauseNumbers: string[],
  changedAt: string
): Promise<ClauseChangeWarning[]> {
  const contract = await getContract(contractId);
  if (!contract) return [];

  const warnings: ClauseChangeWarning[] = [];

  for (const clauseNumber of changedClauseNumbers) {
    const relations = await getClauseRelations({ clauseNumber });

    const relationsByType = new Map<ClauseRelationType, string[]>();

    for (const rel of relations) {
      const affectedClause = rel.clauseNumberA === clauseNumber
        ? rel.clauseNumberB
        : rel.clauseNumberA;

      if (!relationsByType.has(rel.relationType)) {
        relationsByType.set(rel.relationType, []);
      }
      relationsByType.get(rel.relationType)!.push(affectedClause);
    }

    let clauseTitle: string | undefined;
    const template = await getTemplate(contract.templateId);
    if (template) {
      const actualClauses = parseClauses(contract.rawContent);
      const clause = actualClauses.find((c: Clause) => c.number === clauseNumber)
        || template.clauses.find((c: Clause) => c.number === clauseNumber);
      clauseTitle = clause?.title;
    }

    for (const [relationType, affectedClauses] of relationsByType) {
      if (affectedClauses.length > 0) {
        const warning = await createClauseChangeWarning({
          contractId,
          contractTitle: contract.title,
          changedClauseNumber: clauseNumber,
          changedClauseTitle: clauseTitle,
          affectedClauseNumbers: affectedClauses,
          relationType,
          changedAt
        });
        warnings.push(warning);
      }
    }
  }

  return warnings;
}

export async function createClauseChangeWarning(data: {
  contractId: string;
  contractTitle: string;
  changedClauseNumber: string;
  changedClauseTitle?: string;
  affectedClauseNumbers: string[];
  relationType: ClauseRelationType;
  changedAt: string;
}): Promise<ClauseChangeWarning> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const db = await getDb();

  await db.run(`
    INSERT INTO clause_change_warnings (
      id, contract_id, contract_title, changed_clause_number, changed_clause_title,
      affected_clause_numbers, relation_type, changed_at, created_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `, id, data.contractId, data.contractTitle, data.changedClauseNumber,
    data.changedClauseTitle || null, JSON.stringify(data.affectedClauseNumbers),
    data.relationType, data.changedAt, now);

  return getClauseChangeWarning(id) as Promise<ClauseChangeWarning>;
}

export async function getClauseChangeWarning(id: string): Promise<ClauseChangeWarning | null> {
  const db = await getDb();
  const row = await db.get('SELECT * FROM clause_change_warnings WHERE id = ?', id);
  if (!row) return null;
  return rowToClauseChangeWarning(row);
}

export async function getClauseChangeWarnings(
  filters?: ClauseChangeWarningFilters
): Promise<ClauseChangeWarning[]> {
  const db = await getDb();
  let query = 'SELECT * FROM clause_change_warnings WHERE 1=1';
  const params: any[] = [];

  if (filters?.contractId) {
    query += ' AND contract_id = ?';
    params.push(filters.contractId);
  }

  if (filters?.startTime) {
    query += ' AND created_at >= ?';
    params.push(filters.startTime);
  }

  if (filters?.endTime) {
    query += ' AND created_at <= ?';
    params.push(filters.endTime);
  }

  if (filters?.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  query += ' ORDER BY created_at DESC';
  const rows = await db.all(query, ...params);

  return rows.map(rowToClauseChangeWarning);
}

export async function updateClauseChangeWarningStatus(
  id: string,
  status: 'pending' | 'viewed' | 'handled'
): Promise<boolean> {
  const db = await getDb();
  const result = await db.run(`
    UPDATE clause_change_warnings SET status = ? WHERE id = ?
  `, status, id);
  return (result.changes || 0) > 0;
}

function rowToClauseRelation(row: any): ClauseRelationWithClauseInfo {
  return {
    id: row.id,
    clauseNumberA: row.clause_number_a,
    clauseNumberB: row.clause_number_b,
    relationType: row.relation_type as ClauseRelationType,
    description: row.description,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at
  };
}

function rowToClauseChangeWarning(row: any): ClauseChangeWarning {
  return {
    id: row.id,
    contractId: row.contract_id,
    contractTitle: row.contract_title,
    changedClauseNumber: row.changed_clause_number,
    changedClauseTitle: row.changed_clause_title || undefined,
    affectedClauseNumbers: JSON.parse(row.affected_clause_numbers),
    relationType: row.relation_type as ClauseRelationType,
    changedAt: row.changed_at,
    createdAt: row.created_at,
    status: row.status as 'pending' | 'viewed' | 'handled'
  };
}
