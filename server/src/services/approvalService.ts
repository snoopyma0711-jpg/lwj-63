import { Contract, ApprovalNode, ApprovalRole, Comment } from '../types';
import {
  getContract,
  updateContractStatus,
  createApprovalNode,
  getApprovalNodes,
  updateApprovalNode,
  getComments
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

  nodes.push(await createApprovalNode({
    contractId,
    role: 'specialist',
    userId,
    userName,
    status: 'pending'
  }));

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
  await updateApprovalNode(currentNode.id, nodeStatus, comment);

  if (action === 'reject') {
    await updateContractStatus(contractId, 'rejected', null, contract.hasHighRisk);
    return { contract: (await getContract(contractId))!, node: { ...currentNode, status: nodeStatus } };
  }

  if (action === 'transfer') {
    return { contract: (await getContract(contractId))!, node: { ...currentNode, status: nodeStatus } };
  }

  const roleOrder: ApprovalRole[] = contract.hasHighRisk
    ? ['specialist', 'manager', 'director']
    : ['specialist', 'manager'];

  const currentIndex = roleOrder.indexOf(role);
  const nextRole = currentIndex < roleOrder.length - 1 ? roleOrder[currentIndex + 1] : null;

  if (nextRole) {
    await updateContractStatus(contractId, 'pending', nextRole, contract.hasHighRisk);
  } else {
    await updateContractStatus(contractId, 'approved', null, contract.hasHighRisk);
  }

  return { contract: (await getContract(contractId))!, node: { ...currentNode, status: nodeStatus } };
}

export async function getApprovalChainStatus(contractId: string): Promise<{
  nodes: ApprovalNode[];
  currentRole: ApprovalRole | null;
  overallStatus: string;
}> {
  const contract = await getContract(contractId);
  if (!contract) throw new Error('合同不存在');

  const nodes = await getApprovalNodes(contractId);
  return {
    nodes,
    currentRole: contract.currentApproverRole,
    overallStatus: contract.status
  };
}
