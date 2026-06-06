import { Contract, ApprovalNode, ApprovalRole, Comment, ApprovalNodeWithTimeout, ApprovalTimeoutConfig } from '../types';
import {
  getContract,
  updateContractStatus,
  createApprovalNode,
  getApprovalNodes,
  updateApprovalNode,
  getComments,
  updateApprovalNodeArrivedAt,
  getApprovalTimeoutConfig,
  getApprovalTimeoutConfigs
} from './dbService';
import { v4 as uuidv4 } from 'uuid';

export async function startApproval(contractId: string, userId: string, userName: string): Promise<{
  contract: Contract;
  nodes: ApprovalNode[];
}> {
  const contract = await getContract(contractId);
  if (!contract) throw new Error('合同不存在');

  const comments = await getComments(contractId);
  const hasHighRisk = comments.some(c => c.riskLevel === 'high');

  await updateContractStatus(contractId, 'pending', 'specialist', hasHighRisk);

  const nodes: ApprovalNode[] = [];
  const now = new Date().toISOString();

  const specialistNode = await createApprovalNode({
    contractId,
    role: 'specialist',
    userId,
    userName,
    status: 'pending',
    arrivedAt: now
  });
  nodes.push(specialistNode);

  nodes.push(await createApprovalNode({
    contractId,
    role: 'manager',
    userId,
    userName,
    status: 'pending'
  }));

  if (hasHighRisk) {
    nodes.push(await createApprovalNode({
      contractId,
      role: 'director',
      userId,
      userName,
      status: 'pending'
    }));
  }

  return {
    contract: (await getContract(contractId))!,
    nodes
  };
}

export async function processApproval(
  contractId: string,
  role: ApprovalRole,
  action: 'approve' | 'reject' | 'transfer',
  userId: string,
  userName: string,
  comment?: string
): Promise<{ contract: Contract; node: ApprovalNode }> {
  const contract = await getContract(contractId);
  if (!contract) throw new Error('合同不存在');

  const nodes = await getApprovalNodes(contractId);
  const currentNode = nodes.find(n => n.role === role);
  if (!currentNode) throw new Error('审批节点不存在');

  const nodeStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'transferred';
  const processedAt = new Date().toISOString();
  let processingDurationMs: number | undefined;

  if (currentNode.arrivedAt) {
    processingDurationMs = new Date(processedAt).getTime() - new Date(currentNode.arrivedAt).getTime();
  }

  await updateApprovalNode(currentNode.id, nodeStatus, comment, processedAt, processingDurationMs);

  if (action === 'reject') {
    await updateContractStatus(contractId, 'rejected', null, contract.hasHighRisk);
    return { contract: (await getContract(contractId))!, node: { ...currentNode, status: nodeStatus, processedAt, processingDurationMs } };
  }

  if (action === 'transfer') {
    return { contract: (await getContract(contractId))!, node: { ...currentNode, status: nodeStatus, processedAt, processingDurationMs } };
  }

  const roleOrder: ApprovalRole[] = contract.hasHighRisk
    ? ['specialist', 'manager', 'director']
    : ['specialist', 'manager'];

  const currentIndex = roleOrder.indexOf(role);
  const nextRole = currentIndex < roleOrder.length - 1 ? roleOrder[currentIndex + 1] : null;

  if (nextRole) {
    await updateContractStatus(contractId, 'pending', nextRole, contract.hasHighRisk);
    const nextNode = nodes.find(n => n.role === nextRole);
    if (nextNode) {
      const arrivedAt = new Date().toISOString();
      await updateApprovalNodeArrivedAt(nextNode.id, arrivedAt);
    }
  } else {
    await updateContractStatus(contractId, 'approved', null, contract.hasHighRisk);
  }

  return { contract: (await getContract(contractId))!, node: { ...currentNode, status: nodeStatus, processedAt, processingDurationMs } };
}

export async function getApprovalChainStatus(contractId: string): Promise<{
  nodes: ApprovalNode[];
  nodesWithTimeout: ApprovalNodeWithTimeout[];
  currentRole: ApprovalRole | null;
  overallStatus: string;
  hasTimedOut: boolean;
}> {
  const contract = await getContract(contractId);
  if (!contract) throw new Error('合同不存在');

  const nodes = await getApprovalNodes(contractId);
  const nodesWithTimeout = await enrichNodesWithTimeoutInfo(nodes);
  const hasTimedOut = nodesWithTimeout.some(n => n.isTimedOut);

  return {
    nodes,
    nodesWithTimeout,
    currentRole: contract.currentApproverRole,
    overallStatus: contract.status,
    hasTimedOut
  };
}

export async function enrichNodesWithTimeoutInfo(nodes: ApprovalNode[]): Promise<ApprovalNodeWithTimeout[]> {
  const timeoutConfigs = await getApprovalTimeoutConfigs();
  const configMap = new Map(timeoutConfigs.map(c => [c.role, c.thresholdHours]));
  const now = Date.now();

  return nodes.map(node => {
    const thresholdHours = configMap.get(node.role) ?? 24;
    const thresholdMs = thresholdHours * 60 * 60 * 1000;

    let currentDurationMs = 0;
    let isTimedOut = false;

    if (node.status === 'pending' && node.arrivedAt) {
      currentDurationMs = now - new Date(node.arrivedAt).getTime();
      isTimedOut = currentDurationMs > thresholdMs;
    } else if (node.processingDurationMs) {
      currentDurationMs = node.processingDurationMs;
      isTimedOut = currentDurationMs > thresholdMs;
    }

    return {
      ...node,
      currentDurationMs,
      isTimedOut,
      timeoutThresholdMs: thresholdMs
    };
  });
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
