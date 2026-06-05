import axios from 'axios';
import { Template, Contract, Comment, ApprovalNode, CompareResult, User } from '../types';

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

export const contractApi = {
  list: () => api.get<Contract[]>('/contracts').then(r => r.data),
  get: (id: string) => api.get<Contract>(`/contracts/${id}`).then(r => r.data),
  create: (data: {
    title: string;
    templateId: string;
    rawContent: string;
    submittedBy: string;
    submittedByName: string;
    parentId?: string;
  }) => api.post<Contract>('/contracts', data).then(r => r.data),
  compare: (templateId: string, rawContent: string) =>
    api.post<CompareResult>('/compare', { templateId, rawContent }).then(r => r.data),
  getCompare: (id: string) =>
    api.get<{ contract: Contract; template: Template; diffs: any[] }>(`/contracts/${id}/compare`).then(r => r.data),
  getVersions: (id: string) => api.get<Contract[]>(`/contracts/${id}/versions`).then(r => r.data)
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
