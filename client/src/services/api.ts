import axios from 'axios';
import { Template, Contract, Comment, ApprovalNode, CompareResult, User, WarningRule, WarningRecord, WarningStats, WarningLevel, WarningRecordStatus, ContractSummary, RiskScoreDetail } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

export const templateApi = {
  list: () => api.get<Template[]>('/templates').then(r => r.data),
  get: (id: string) => api.get<Template>(`/templates/${id}`).then(r => r.data),
  create: (name: string, clauses: any[]) =>
    api.post<Template>('/templates', { name, clauses }).then(r => r.data)
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
  compare: (templateId: string, rawContent: string) =>
    api.post<CompareResult>('/compare', { templateId, rawContent }).then(r => r.data),
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
    api.get<{ nodes: ApprovalNode[]; currentRole: string | null; overallStatus: string }>(
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
