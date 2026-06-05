export interface Clause {
  id: string;
  number: string;
  title: string;
  content: string;
}

export interface DiffSegment {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface ClauseDiff {
  clauseNumber: string;
  clauseTitle: string;
  templateContent: string;
  actualContent: string;
  diff: DiffSegment[];
  hasDiff: boolean;
  isNew: boolean;
  isMissing: boolean;
}

export type RiskLevel = 'high' | 'medium' | 'low' | 'none';

export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'needs_director';

export type ApprovalRole = 'specialist' | 'manager' | 'director';

export interface Comment {
  id: string;
  contractId: string;
  clauseNumber: string;
  userId: string;
  userName: string;
  riskLevel: RiskLevel;
  content: string;
  createdAt: string;
}

export interface ApprovalNode {
  id: string;
  contractId: string;
  role: ApprovalRole;
  userId: string;
  userName: string;
  status: 'pending' | 'approved' | 'rejected' | 'transferred';
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  version: number;
  parentId?: string;
  title: string;
  templateId: string;
  rawContent: string;
  status: ApprovalStatus;
  submittedBy: string;
  submittedByName: string;
  currentApproverRole: ApprovalRole | null;
  hasHighRisk: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  name: string;
  clauses: Clause[];
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  role: ApprovalRole;
}

export interface CompareResult {
  templateClauses: Clause[];
  actualClauses: Clause[];
  diffs: ClauseDiff[];
}
