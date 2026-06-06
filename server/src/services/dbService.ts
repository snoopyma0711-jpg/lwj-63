import { getDb } from '../db';
import { Contract, Template, Comment, ApprovalNode, User, ApprovalRole, ApprovalStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';

export async function getTemplates(): Promise<Template[]> {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM templates ORDER BY created_at DESC');
  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    clauses: JSON.parse(r.clauses),
    createdAt: r.created_at
  }));
}

export async function getTemplate(id: string): Promise<Template | null> {
  const db = await getDb();
  const row = await db.get('SELECT * FROM templates WHERE id = ?', id);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    clauses: JSON.parse(row.clauses),
    createdAt: row.created_at
  };
}

export async function createTemplate(name: string, clauses: any[]): Promise<Template> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const db = await getDb();
  await db.run(
    'INSERT INTO templates (id, name, clauses, created_at) VALUES (?, ?, ?, ?)',
    id, name, JSON.stringify(clauses), now
  );
  return { id, name, clauses, createdAt: now };
}

export async function getContracts(): Promise<Contract[]> {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM contracts ORDER BY created_at DESC');
  return rows.map(rowToContract);
}

export async function getContract(id: string): Promise<Contract | null> {
  const db = await getDb();
  const row = await db.get('SELECT * FROM contracts WHERE id = ?', id);
  if (!row) return null;
  return rowToContract(row);
}

export async function getContractVersionChain(contractId: string): Promise<Contract[]> {
  const chain: Contract[] = [];
  let current: Contract | null = await getContract(contractId);
  while (current) {
    chain.unshift(current);
    current = current.parentId ? await getContract(current.parentId) : null;
  }
  return chain;
}

export async function createContract(data: {
  title: string;
  templateId: string;
  rawContent: string;
  submittedBy: string;
  submittedByName: string;
  parentId?: string;
}): Promise<Contract> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const parentContract = data.parentId ? await getContract(data.parentId) : null;
  const version = parentContract ? parentContract.version + 1 : 1;

  const db = await getDb();
  await db.run(`
    INSERT INTO contracts (id, version, parent_id, title, template_id, raw_content, 
      status, submitted_by, submitted_by_name, current_approver_role, has_high_risk, 
      created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, NULL, 0, ?, ?)
  `, id, version, data.parentId || null, data.title, data.templateId, data.rawContent,
    data.submittedBy, data.submittedByName, now, now);

  return getContract(id) as Promise<Contract>;
}

export async function updateContractStatus(
  id: string,
  status: ApprovalStatus,
  currentApproverRole: ApprovalRole | null,
  hasHighRisk: boolean
): Promise<void> {
  const now = new Date().toISOString();
  const db = await getDb();
  await db.run(`
    UPDATE contracts 
    SET status = ?, current_approver_role = ?, has_high_risk = ?, updated_at = ?
    WHERE id = ?
  `, status, currentApproverRole, hasHighRisk ? 1 : 0, now, id);
}

export async function getComments(contractId: string): Promise<Comment[]> {
  const db = await getDb();
  const rows = await db.all(`
    SELECT * FROM comments 
    WHERE contract_id = ? 
    ORDER BY created_at DESC
  `, contractId);
  return rows.map((r: any) => ({
    id: r.id,
    contractId: r.contract_id,
    clauseNumber: r.clause_number,
    userId: r.user_id,
    userName: r.user_name,
    riskLevel: r.risk_level,
    content: r.content,
    createdAt: r.created_at
  }));
}

export async function createComment(data: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const db = await getDb();
  await db.run(`
    INSERT INTO comments (id, contract_id, clause_number, user_id, user_name, risk_level, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, id, data.contractId, data.clauseNumber, data.userId, data.userName, data.riskLevel, data.content, now);
  return { ...data, id, createdAt: now };
}

export async function getApprovalNodes(contractId: string): Promise<ApprovalNode[]> {
  const db = await getDb();
  const rows = await db.all(`
    SELECT * FROM approval_nodes 
    WHERE contract_id = ? 
    ORDER BY created_at ASC
  `, contractId);
  return rows.map((r: any) => ({
    id: r.id,
    contractId: r.contract_id,
    role: r.role,
    userId: r.user_id,
    userName: r.user_name,
    status: r.status,
    comment: r.comment,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

export async function createApprovalNode(data: Omit<ApprovalNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApprovalNode> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const db = await getDb();
  await db.run(`
    INSERT INTO approval_nodes (id, contract_id, role, user_id, user_name, status, comment, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, id, data.contractId, data.role, data.userId, data.userName, data.status, data.comment || null, now, now);
  return { ...data, id, createdAt: now, updatedAt: now };
}

export async function updateApprovalNode(
  id: string,
  status: ApprovalNode['status'],
  comment?: string
): Promise<void> {
  const now = new Date().toISOString();
  const db = await getDb();
  await db.run(`
    UPDATE approval_nodes 
    SET status = ?, comment = ?, updated_at = ?
    WHERE id = ?
  `, status, comment || null, now, id);
}

export async function getUsers(): Promise<User[]> {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM users');
  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    role: r.role
  }));
}

export async function getUser(id: string): Promise<User | null> {
  const db = await getDb();
  const row = await db.get('SELECT * FROM users WHERE id = ?', id);
  if (!row) return null;
  return { id: row.id, name: row.name, role: row.role };
}

export async function createUser(name: string, role: ApprovalRole): Promise<User> {
  const id = uuidv4();
  const db = await getDb();
  await db.run('INSERT INTO users (id, name, role) VALUES (?, ?, ?)', id, name, role);
  return { id, name, role };
}

function rowToContract(row: any): Contract {
  return {
    id: row.id,
    version: row.version,
    parentId: row.parent_id || undefined,
    title: row.title,
    templateId: row.template_id,
    rawContent: row.raw_content,
    status: row.status,
    submittedBy: row.submitted_by,
    submittedByName: row.submitted_by_name,
    currentApproverRole: row.current_approver_role,
    hasHighRisk: row.has_high_risk === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
