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
  arrivedAt?: string;
  processedAt?: string;
  processingDurationMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalNodeWithTimeout extends ApprovalNode {
  currentDurationMs: number;
  isTimedOut: boolean;
  timeoutThresholdMs: number;
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
  riskScore: number;
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractSummary {
  id: string;
  contractId: string;
  partyA: string | null;
  partyB: string | null;
  contractAmount: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  paymentMethod: string | null;
  penaltyRatio: string | null;
  confidentialityPeriod: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RiskScoreLevel = 'low' | 'medium' | 'high';

export interface RiskScoreDetail {
  totalScore: number;
  level: RiskScoreLevel;
  modifiedClauses: number;
  missingClauses: number;
  newClauses: number;
  highRiskComments: number;
  breakdown: {
    modifiedScore: number;
    missingScore: number;
    newScore: number;
    highRiskCommentScore: number;
  };
}

export type WarningLevel = 'yellow' | 'orange' | 'red';

export interface WarningRule {
  id: string;
  days: number;
  level: WarningLevel;
  color: string;
  createdAt: string;
}

export type WarningRecordStatus = 'pending' | 'handled' | 'renewed' | 'terminated';

export interface WarningRecord {
  id: string;
  contractId: string;
  contractTitle: string;
  expiryDate: string;
  daysRemaining: number;
  warningLevel: WarningLevel;
  warningColor: string;
  status: WarningRecordStatus;
  renewedContractId?: string;
  handledBy?: string;
  handledAt?: string;
  createdAt: string;
}

export interface WarningStats {
  thisMonthExpiring: number;
  handled: number;
  pending: number;
  byLevel: {
    yellow: number;
    orange: number;
    red: number;
  };
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

export interface ApprovalTimeoutConfig {
  id: string;
  role: ApprovalRole;
  thresholdHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoleApprovalStats {
  role: ApprovalRole;
  roleName: string;
  averageDurationMs: number;
  totalProcessed: number;
  timedOutCount: number;
}

export interface ApprovalEfficiencyStats {
  byRole: RoleApprovalStats[];
  timedOutContracts: Array<{
    contractId: string;
    contractTitle: string;
    currentRole: ApprovalRole;
    timeoutDurationMs: number;
    submittedAt: string;
    riskScore: number;
  }>;
  weeklyStats: {
    totalProcessed: number;
    approvedCount: number;
    rejectedCount: number;
    passRate: number;
    weekStart: string;
    weekEnd: string;
  };
  lastUpdated: string;
}

export interface CompareResult {
  templateClauses: Clause[];
  actualClauses: Clause[];
  diffs: ClauseDiff[];
}
