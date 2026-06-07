import axios from 'axios';
import { Template, TemplateVersion, TemplateDraft, TemplateEditLock, TemplateWithLock, Contract, Comment, ApprovalNode, ApprovalNodeWithTimeout, CompareResult, TemplateVersionCompareResult, User, WarningRule, WarningRecord, WarningStats, WarningLevel, WarningRecordStatus, ContractSummary, RiskScoreDetail, ApprovalTimeoutConfig, ApprovalEfficiencyStats, ApprovalRole } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

export const templateApi = {
  list: () => api.get<Template[]>('/templates').then(r => r.data),
  listWithLock: () => api.get<TemplateWithLock[]>('/templates?withLock=true').then(r => r.data),
  get: (id: string) => api.get<Template & { latestVersion: number; editLock: TemplateEditLock | null; hasDraft: boolean }>(`/templates/${id}`).then(r => r.data),
  create: (name: string, clauses: any[], createdBy: string, createdByName: string) =>
    api.post<Template>('/templates', { name, clauses, createdBy, createdByName }).then(r => r.data),
  getVersions: (templateId: string) =>
    api.get<TemplateVersion[]>(`/templates/${templateId}/versions`).then(r => r.data),
  getVersion: (templateId: string, versionNumber: number) =>
    api.get<TemplateVersion>(`/templates/${templateId}/versions/${versionNumber}`).then(r => r.data),
  compareVersions: (templateId: string, fromVersion: number, toVersion: number) =>
    api.get<TemplateVersionCompareResult>(`/templates/${templateId}/versions/compare?from=${fromVersion}&to=${toVersion}`).then(r => r.data),
  rollbackVersion: (templateId: string, versionNumber: number, createdBy: string, createdByName: string) =>
    api.post<TemplateVersion>(`/templates/${templateId}/versions/${versionNumber}/rollback`, { createdBy, createdByName }).then(r => r.data),
  publishVersion: (templateId: string, data: { name: string; clauses: any[]; description?: string; createdBy: string; createdByName: string }) =>
    api.post<TemplateVersion>(`/templates/${templateId}/versions`, data).then(r => r.data),
  getDraft: (templateId: string) =>
    api.get<TemplateDraft | null>(`/templates/${templateId}/draft`).then(r => r.data),
  saveDraft: (templateId: string, data: { name: string; clauses: any[]; savedBy: string; savedByName: string }) =>
    api.put<TemplateDraft>(`/templates/${templateId}/draft`, data).then(r => r.data),
  deleteDraft: (templateId: string) =>
    api.delete(`/templates/${templateId}/draft`).then(r => r.data),
  getLock: (templateId: string) =>
    api.get<TemplateEditLock | null>(`/templates/${templateId}/lock`).then(r => r.data),
  acquireLock: (templateId: string, userId: string, userName: string) =>
    api.post<TemplateEditLock>(`/templates/${templateId}/lock`, { userId, userName }).then(r => r.data),
  refreshLock: (templateId: string, userId: string) =>
    api.put<{ success: boolean; lock: TemplateEditLock }>(`/templates/${templateId}/lock`, { userId }).then(r => r.data),
  releaseLock: (templateId: string, userId: string) =>
    api.delete<{ success: boolean }>(`/templates/${templateId}/lock`, { data: { userId } }).then(r => r.data),
  compare: (templateId: string, rawContent: string, versionNumber?: number) =>
    api.post<CompareResult>('/compare', { templateId, rawContent, versionNumber }).then(r => r.data)
};

const baseContractApi = {
  list: () => api.get<Contract[]>('/contracts').then(r => r.data),
  get: (id: string) => api.get<Contract>(`/contracts/${id}`).then(r => r.data),
  create: (data: {
    title: string;
    templateId: string;
    rawContent: string;
    submittedBy: string;
    submittedByName: string;
    parentId?: string;
    expiryDate?: string;
  }) => api.post<Contract>('/contracts', data).then(r => r.data),
  compare: (templateId: string, rawContent: string, versionNumber?: number) =>
    api.post<CompareResult>('/compare', { templateId, rawContent, versionNumber }).then(r => r.data),
  getCompare: (id: string) =>
    api.get<{ contract: Contract; template: Template; diffs: any[]; summary: ContractSummary; riskDetail: RiskScoreDetail }>(`/contracts/${id}/compare`).then(r => r.data),
  getVersions: (id: string) => api.get<Contract[]>(`/contracts/${id}/versions`).then(r => r.data),
  getSummary: (id: string) =>
    api.get<ContractSummary>(`/contracts/${id}/summary`).then(r => r.data),
  updateSummary: (id: string, data: Partial<Omit<ContractSummary, 'id' | 'contractId' | 'createdAt' | 'updatedAt'>>) =>
    api.put<ContractSummary>(`/contracts/${id}/summary`, data).then(r => r.data),
  reExtractSummary: (id: string) =>
    api.post<ContractSummary>(`/contracts/${id}/summary/re-extract`).then(r => r.data),
  getRiskScore: (id: string) =>
    api.get<RiskScoreDetail>(`/contracts/${id}/risk-score`).then(r => r.data)
};

export const contractApi = {
  ...baseContractApi,
  updateExpiry: (id: string, expiryDate: string) =>
    api.put<Contract>(`/contracts/${id}/expiry`, { expiryDate }).then(r => r.data)
};

export const riskRankingApi = {
  list: (filters?: { riskLevel?: 'low' | 'medium' | 'high' }) =>
    api.get<Array<{ rank: number } & Contract>>('/risk-ranking', { params: filters }).then(r => r.data)
};

export const commentApi = {
  list: (contractId: string) =>
    api.get<Comment[]>(`/contracts/${contractId}/comments`).then(r => r.data),
  create: (contractId: string, data: {
    clauseNumber: string;
    userId: string;
    userName: string;
    riskLevel: string;
    content: string;
  }) => api.post<Comment>(`/contracts/${contractId}/comments`, data).then(r => r.data)
};

export const approvalApi = {
  getStatus: (contractId: string) =>
    api.get<{ 
      nodes: ApprovalNode[]; 
      nodesWithTimeout: ApprovalNodeWithTimeout[];
      currentRole: string | null; 
      overallStatus: string;
      hasTimedOut: boolean;
    }>(
      `/contracts/${contractId}/approvals`
    ).then(r => r.data),
  start: (contractId: string, userId: string, userName: string) =>
    api.post(`/contracts/${contractId}/start-approval`, { userId, userName }).then(r => r.data),
  process: (contractId: string, data: {
    role: string;
    action: 'approve' | 'reject' | 'transfer';
    userId: string;
    userName: string;
    comment?: string;
  }) => api.post(`/contracts/${contractId}/approval`, data).then(r => r.data)
};

export const approvalTimeoutConfigApi = {
  list: () => api.get<ApprovalTimeoutConfig[]>('/approval-timeout-configs').then(r => r.data),
  get: (role: ApprovalRole) => api.get<ApprovalTimeoutConfig>(`/approval-timeout-configs/${role}`).then(r => r.data),
  update: (role: ApprovalRole, thresholdHours: number) =>
    api.put<ApprovalTimeoutConfig>(`/approval-timeout-configs/${role}`, { thresholdHours }).then(r => r.data)
};

export const approvalEfficiencyApi = {
  getStats: () => api.get<ApprovalEfficiencyStats>('/approval-efficiency').then(r => r.data)
};

export const userApi = {
  list: () => api.get<User[]>('/users').then(r => r.data),
  create: (name: string, role: string) =>
    api.post<User>('/users', { name, role }).then(r => r.data)
};

export const warningRuleApi = {
  list: () => api.get<WarningRule[]>('/warning-rules').then(r => r.data),
  create: (days: number, level: WarningLevel, color: string) =>
    api.post<WarningRule>('/warning-rules', { days, level, color }).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/warning-rules/${id}`).then(r => r.data)
};

export const warningRecordApi = {
  list: (filters?: { status?: WarningRecordStatus; level?: WarningLevel }) =>
    api.get<WarningRecord[]>('/warning-records', { params: filters }).then(r => r.data),
  handle: (id: string, action: 'handled' | 'terminate', userId: string) =>
    api.post(`/warning-records/${id}/handle`, { action, userId }).then(r => r.data),
  renew: (id: string, userId: string, userName: string) =>
    api.post<{ success: boolean; contract: Contract }>(`/warning-records/${id}/renew`, { userId, userName }).then(r => r.data)
};

export const warningStatsApi = {
  get: () => api.get<WarningStats>('/warning-stats').then(r => r.data)
};
