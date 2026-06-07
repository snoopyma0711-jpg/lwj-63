import { io, Socket } from 'socket.io-client';
import { Comment, Contract, ApprovalNode, WarningRecord, WarningStats, RiskScoreDetail, ApprovalEfficiencyStats, TemplateEditLock } from '../types';

let socket: Socket | null = null;

export function initSocket(): Socket {
  if (!socket) {
    socket = io({
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });
  }
  return socket;
}

export function joinContract(contractId: string): void {
  if (socket) {
    socket.emit('join:contract', contractId);
  }
}

export function leaveContract(contractId: string): void {
  if (socket) {
    socket.emit('leave:contract', contractId);
  }
}

export function onComment(callback: (comment: Comment) => void): void {
  if (socket) {
    socket.on('comment:new', callback);
  }
}

export function onApprovalUpdate(callback: (data: { contract: Contract; node?: ApprovalNode }) => void): void {
  if (socket) {
    socket.on('approval:update', callback);
  }
}

export function onContractStatus(callback: (contract: Contract) => void): void {
  if (socket) {
    socket.on('contract:status', callback);
  }
}

export function offComment(callback: (comment: Comment) => void): void {
  if (socket) {
    socket.off('comment:new', callback);
  }
}

export function offApprovalUpdate(callback: (data: { contract: Contract; node?: ApprovalNode }) => void): void {
  if (socket) {
    socket.off('approval:update', callback);
  }
}

export function offContractStatus(callback: (contract: Contract) => void): void {
  if (socket) {
    socket.off('contract:status', callback);
  }
}

export function joinWarning(): void {
  if (socket) {
    socket.emit('join:warning');
  }
}

export function leaveWarning(): void {
  if (socket) {
    socket.emit('leave:warning');
  }
}

export function onWarningStats(callback: (stats: WarningStats) => void): void {
  if (socket) {
    socket.on('warning:stats', callback);
  }
}

export function onWarningRecords(callback: (records: WarningRecord[]) => void): void {
  if (socket) {
    socket.on('warning:records', callback);
  }
}

export function offWarningStats(callback: (stats: WarningStats) => void): void {
  if (socket) {
    socket.off('warning:stats', callback);
  }
}

export function offWarningRecords(callback: (records: WarningRecord[]) => void): void {
  if (socket) {
    socket.off('warning:records', callback);
  }
}

export function joinRiskRanking(): void {
  if (socket) {
    socket.emit('join:risk-ranking');
  }
}

export function leaveRiskRanking(): void {
  if (socket) {
    socket.emit('leave:risk-ranking');
  }
}

export function onRiskScoreUpdate(callback: (data: { contract: Contract; riskDetail: RiskScoreDetail }) => void): void {
  if (socket) {
    socket.on('risk:score-update', callback);
  }
}

export function offRiskScoreUpdate(callback: (data: { contract: Contract; riskDetail: RiskScoreDetail }) => void): void {
  if (socket) {
    socket.off('risk:score-update', callback);
  }
}

export function onRiskRankingUpdate(callback: () => void): void {
  if (socket) {
    socket.on('risk:ranking-update', callback);
  }
}

export function offRiskRankingUpdate(callback: () => void): void {
  if (socket) {
    socket.off('risk:ranking-update', callback);
  }
}

export function joinEfficiency(): void {
  if (socket) {
    socket.emit('join:efficiency');
  }
}

export function leaveEfficiency(): void {
  if (socket) {
    socket.emit('leave:efficiency');
  }
}

export function onEfficiencyUpdate(callback: (stats: ApprovalEfficiencyStats) => void): void {
  if (socket) {
    socket.on('efficiency:update', callback);
  }
}

export function offEfficiencyUpdate(callback: (stats: ApprovalEfficiencyStats) => void): void {
  if (socket) {
    socket.off('efficiency:update', callback);
  }
}

export function joinTemplate(templateId: string): void {
  if (socket) {
    socket.emit('join:template', templateId);
  }
}

export function leaveTemplate(templateId: string): void {
  if (socket) {
    socket.emit('leave:template', templateId);
  }
}

export function onTemplateLockUpdate(
  callback: (data: { lock: TemplateEditLock | null; action: 'acquired' | 'released' | 'refreshed' | 'timeout' }) => void
): void {
  if (socket) {
    socket.on('template:lock-update', callback);
  }
}

export function offTemplateLockUpdate(
  callback: (data: { lock: TemplateEditLock | null; action: 'acquired' | 'released' | 'refreshed' | 'timeout' }) => void
): void {
  if (socket) {
    socket.off('template:lock-update', callback);
  }
}

export function onTemplateVersionUpdate(
  callback: (data: { versionNumber: number; action: 'created' | 'rolled_back' }) => void
): void {
  if (socket) {
    socket.on('template:version-update', callback);
  }
}

export function offTemplateVersionUpdate(
  callback: (data: { versionNumber: number; action: 'created' | 'rolled_back' }) => void
): void {
  if (socket) {
    socket.off('template:version-update', callback);
  }
}
