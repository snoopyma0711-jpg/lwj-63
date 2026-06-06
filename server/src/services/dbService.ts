import { getDb } from '../db';
import { Contract, Template, Comment, ApprovalNode, User, ApprovalRole, ApprovalStatus, WarningRule, WarningRecord, WarningLevel, WarningRecordStatus } from '../types';
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
  expiryDate?: string;
}): Promise<Contract> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const parentContract = data.parentId ? await getContract(data.parentId) : null;
  const version = parentContract ? parentContract.version + 1 : 1;

  const db = await getDb();
  await db.run(`
    INSERT INTO contracts (id, version, parent_id, title, template_id, raw_content, 
      status, submitted_by, submitted_by_name, current_approver_role, has_high_risk, 
      expiry_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, NULL, 0, ?, ?, ?)
  `, id, version, data.parentId || null, data.title, data.templateId, data.rawContent,
    data.submittedBy, data.submittedByName, data.expiryDate || null, now, now);

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
    expiryDate: row.expiry_date || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function updateContractExpiryDate(id: string, expiryDate: string): Promise<void> {
  const now = new Date().toISOString();
  const db = await getDb();
  await db.run(`
    UPDATE contracts 
    SET expiry_date = ?, updated_at = ?
    WHERE id = ?
  `, expiryDate, now, id);
}

export async function getApprovedContractsWithExpiry(): Promise<Contract[]> {
  const db = await getDb();
  const rows = await db.all(`
    SELECT * FROM contracts 
    WHERE status = 'approved' AND expiry_date IS NOT NULL
    ORDER BY expiry_date ASC
  `);
  return rows.map(rowToContract);
}

export async function getWarningRules(): Promise<WarningRule[]> {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM warning_rules ORDER BY days DESC');
  return rows.map((r: any) => ({
    id: r.id,
    days: r.days,
    level: r.level,
    color: r.color,
    createdAt: r.created_at
  }));
}

export async function createWarningRule(days: number, level: WarningLevel, color: string): Promise<WarningRule> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const db = await getDb();
  await db.run(`
    INSERT INTO warning_rules (id, days, level, color, created_at)
    VALUES (?, ?, ?, ?, ?)
  `, id, days, level, color, now);
  return { id, days, level, color, createdAt: now };
}

export async function deleteWarningRule(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM warning_rules WHERE id = ?', id);
}

export async function initDefaultWarningRules(): Promise<void> {
  const existing = await getWarningRules();
  if (existing.length > 0) return;

  const defaultRules = [
    { days: 60, level: 'yellow' as WarningLevel, color: '#fbbf24' },
    { days: 30, level: 'orange' as WarningLevel, color: '#f97316' },
    { days: 7, level: 'red' as WarningLevel, color: '#ef4444' }
  ];

  for (const rule of defaultRules) {
    await createWarningRule(rule.days, rule.level, rule.color);
  }
}

export async function getWarningRecords(filters?: {
  status?: WarningRecordStatus;
  level?: WarningLevel;
}): Promise<WarningRecord[]> {
  const db = await getDb();
  let query = 'SELECT * FROM warning_records WHERE 1=1';
  const params: any[] = [];

  if (filters?.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters?.level) {
    query += ' AND warning_level = ?';
    params.push(filters.level);
  }

  query += ' ORDER BY days_remaining ASC, created_at DESC';
  const rows = await db.all(query, ...params);

  return rows.map((r: any) => ({
    id: r.id,
    contractId: r.contract_id,
    contractTitle: r.contract_title,
    expiryDate: r.expiry_date,
    daysRemaining: r.days_remaining,
    warningLevel: r.warning_level,
    warningColor: r.warning_color,
    status: r.status,
    renewedContractId: r.renewed_contract_id || undefined,
    handledBy: r.handled_by || undefined,
    handledAt: r.handled_at || undefined,
    createdAt: r.created_at
  }));
}

export async function getWarningRecordByContractAndLevel(
  contractId: string,
  warningLevel: WarningLevel
): Promise<WarningRecord | null> {
  const db = await getDb();
  const row = await db.get(`
    SELECT * FROM warning_records 
    WHERE contract_id = ? AND warning_level = ? AND status = 'pending'
  `, contractId, warningLevel);
  if (!row) return null;
  return {
    id: row.id,
    contractId: row.contract_id,
    contractTitle: row.contract_title,
    expiryDate: row.expiry_date,
    daysRemaining: row.days_remaining,
    warningLevel: row.warning_level,
    warningColor: row.warning_color,
    status: row.status,
    renewedContractId: row.renewed_contract_id || undefined,
    handledBy: row.handled_by || undefined,
    handledAt: row.handled_at || undefined,
    createdAt: row.created_at
  };
}

export async function createWarningRecord(data: {
  contractId: string;
  contractTitle: string;
  expiryDate: string;
  daysRemaining: number;
  warningLevel: WarningLevel;
  warningColor: string;
}): Promise<WarningRecord> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const db = await getDb();
  await db.run(`
    INSERT INTO warning_records (
      id, contract_id, contract_title, expiry_date, days_remaining,
      warning_level, warning_color, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `, id, data.contractId, data.contractTitle, data.expiryDate, data.daysRemaining,
    data.warningLevel, data.warningColor, now);

  return {
    id,
    ...data,
    status: 'pending' as WarningRecordStatus,
    createdAt: now
  };
}

export async function updateWarningRecordStatus(
  id: string,
  status: WarningRecordStatus,
  handledBy?: string,
  renewedContractId?: string
): Promise<void> {
  const now = new Date().toISOString();
  const db = await getDb();
  await db.run(`
    UPDATE warning_records 
    SET status = ?, handled_by = ?, handled_at = ?, renewed_contract_id = ?
    WHERE id = ?
  `, status, handledBy || null, now, renewedContractId || null, id);
}

export async function getWarningStats(): Promise<{
  thisMonthExpiring: number;
  handled: number;
  pending: number;
  byLevel: { yellow: number; orange: number; red: number };
}> {
  const db = await getDb();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const thisMonthResult = await db.get(`
    SELECT COUNT(*) as count FROM warning_records
    WHERE expiry_date >= ? AND expiry_date <= ?
  `, monthStart, monthEnd);

  const handledResult = await db.get(`
    SELECT COUNT(*) as count FROM warning_records
    WHERE status IN ('handled', 'renewed', 'terminated')
  `);

  const pendingResult = await db.get(`
    SELECT COUNT(*) as count FROM warning_records
    WHERE status = 'pending'
  `);

  const byLevelResult = await db.all(`
    SELECT warning_level, COUNT(*) as count FROM warning_records
    WHERE status = 'pending'
    GROUP BY warning_level
  `);

  const byLevel = { yellow: 0, orange: 0, red: 0 };
  for (const row of byLevelResult) {
    (byLevel as any)[row.warning_level] = row.count;
  }

  return {
    thisMonthExpiring: thisMonthResult?.count || 0,
    handled: handledResult?.count || 0,
    pending: pendingResult?.count || 0,
    byLevel
  };
}
