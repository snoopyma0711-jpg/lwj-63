import { ApprovalRole, ApprovalEfficiencyStats, RoleApprovalStats } from '../types';
import {
  getProcessedApprovalNodes,
  getPendingApprovalNodesWithContracts,
  getApprovalTimeoutConfigs
} from './dbService';
import { enrichNodesWithTimeoutInfo } from './approvalService';

const roleNames: Record<ApprovalRole, string> = {
  specialist: '法务专员',
  manager: '法务经理',
  director: '法务总监'
};

export async function getApprovalEfficiencyStats(): Promise<ApprovalEfficiencyStats> {
  const [processedNodes, pendingNodes, timeoutConfigs] = await Promise.all([
    getProcessedApprovalNodes(),
    getPendingApprovalNodesWithContracts(),
    getApprovalTimeoutConfigs()
  ]);

  const timeoutConfigMap = new Map(timeoutConfigs.map(c => [c.role, c.thresholdHours]));

  const nodesWithTimeout = await enrichNodesWithTimeoutInfo(pendingNodes);

  const byRole = calculateRoleStats(processedNodes, nodesWithTimeout, timeoutConfigMap);

  const timedOutNodes = nodesWithTimeout.filter(n => n.isTimedOut);
  
  const contractTimeoutMap = new Map<string, {
    contractId: string;
    contractTitle: string;
    currentRole: ApprovalRole;
    timeoutDurationMs: number;
    submittedAt: string;
    riskScore: number;
    timedOutRoles: ApprovalRole[];
  }>();

  for (const node of timedOutNodes) {
    const contractId = node.contractId;
    const existing = contractTimeoutMap.get(contractId);
    const timeoutDurationMs = node.currentDurationMs || 0;
    
    if (!existing || timeoutDurationMs > existing.timeoutDurationMs) {
      const timedOutRoles = timedOutNodes
        .filter(n => n.contractId === contractId)
        .map(n => n.role);
      
      contractTimeoutMap.set(contractId, {
        contractId,
        contractTitle: (node as any).contractTitle as string,
        currentRole: node.role,
        timeoutDurationMs,
        submittedAt: (node as any).submittedAt as string,
        riskScore: (node as any).riskScore as number,
        timedOutRoles
      });
    }
  }

  const timedOutContracts = Array.from(contractTimeoutMap.values())
    .sort((a, b) => b.timeoutDurationMs - a.timeoutDurationMs);

  const weeklyStats = calculateWeeklyStats(processedNodes);

  return {
    byRole,
    timedOutContracts,
    weeklyStats,
    lastUpdated: new Date().toISOString()
  };
}

function calculateRoleStats(
  processedNodes: any[],
  pendingNodes: any[],
  timeoutConfigMap: Map<ApprovalRole, number>
): RoleApprovalStats[] {
  const roles: ApprovalRole[] = ['specialist', 'manager', 'director'];

  return roles.map(role => {
    const roleProcessed = processedNodes.filter(n => n.role === role);
    const rolePending = pendingNodes.filter(n => n.role === role);

    const totalProcessed = roleProcessed.length;
    const timedOutCount = rolePending.filter((n: any) => n.isTimedOut).length;

    let averageDurationMs = 0;
    if (totalProcessed > 0) {
      const totalDuration = roleProcessed.reduce((sum: number, n: any) => sum + (n.processingDurationMs || 0), 0);
      averageDurationMs = Math.round(totalDuration / totalProcessed);
    }

    return {
      role,
      roleName: roleNames[role],
      averageDurationMs,
      totalProcessed,
      timedOutCount
    };
  });
}

function calculateWeeklyStats(processedNodes: any[]): ApprovalEfficiencyStats['weeklyStats'] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekEnd.getTime();

  const weekProcessed = processedNodes.filter(n => {
    const processedAt = n.processedAt ? new Date(n.processedAt).getTime() : 0;
    return processedAt >= weekStartMs && processedAt <= weekEndMs;
  });

  const totalProcessed = weekProcessed.length;
  const approvedCount = weekProcessed.filter((n: any) => n.status === 'approved').length;
  const rejectedCount = weekProcessed.filter((n: any) => n.status === 'rejected').length;
  const passRate = totalProcessed > 0 ? Math.round((approvedCount / totalProcessed) * 100) : 0;

  return {
    totalProcessed,
    approvedCount,
    rejectedCount,
    passRate,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString()
  };
}

export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}天${hours % 24}小时`;
  } else if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

export function formatDurationShort(ms: number): string {
  if (ms < 0) ms = 0;
  const minutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}天${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h${minutes % 60}m`;
  } else {
    return `${minutes}m`;
  }
}
