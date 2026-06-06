import { Router, Request, Response } from 'express';
import { parseClauses, compareClauses } from './services/comparisonService';
import {
  getTemplates,
  getTemplate,
  createTemplate,
  getContracts,
  getContract,
  createContract,
  getComments,
  createComment,
  getApprovalNodes,
  getContractVersionChain,
  getUsers,
  createUser,
  getWarningRules,
  createWarningRule,
  deleteWarningRule,
  getWarningRecords,
  updateWarningRecordStatus,
  getWarningStats,
  updateContractExpiryDate,
  getContractSummary,
  createContractSummary,
  updateContractSummary,
  updateContractRiskScore,
  getPendingContractsByRiskScore
} from './services/dbService';
import { startApproval, processApproval, getApprovalChainStatus } from './services/approvalService';
import { broadcastComment, broadcastApprovalUpdate, broadcastStatusUpdate, broadcastWarningStatsUpdate, broadcastWarningRecordUpdate, broadcastRiskScoreUpdate } from './websocket';
import { RiskLevel, ApprovalRole, WarningLevel, WarningRecordStatus } from './types';
import { extractContractSummary } from './services/summaryExtractionService';
import { calculateRiskScore } from './services/riskScoringService';

const router = Router();

router.get('/templates', async (req: Request, res: Response) => {
  const templates = await getTemplates();
  res.json(templates);
});

router.get('/templates/:id', async (req: Request, res: Response) => {
  const template = await getTemplate(req.params.id);
  if (!template) return res.status(404).json({ error: '模板不存在' });
  res.json(template);
});

router.post('/templates', async (req: Request, res: Response) => {
  const { name, clauses } = req.body;
  const template = await createTemplate(name, clauses);
  res.json(template);
});

router.post('/compare', async (req: Request, res: Response) => {
  const { templateId, rawContent } = req.body;
  const template = await getTemplate(templateId);
  if (!template) return res.status(404).json({ error: '模板不存在' });

  const actualClauses = parseClauses(rawContent);
  const diffs = compareClauses(template.clauses, actualClauses);

  res.json({
    templateClauses: template.clauses,
    actualClauses,
    diffs
  });
});

router.get('/contracts', async (req: Request, res: Response) => {
  const contracts = await getContracts();
  res.json(contracts);
});

router.get('/contracts/:id', async (req: Request, res: Response) => {
  const contract = await getContract(req.params.id);
  if (!contract) return res.status(404).json({ error: '合同不存在' });
  res.json(contract);
});

router.get('/contracts/:id/versions', async (req: Request, res: Response) => {
  const chain = await getContractVersionChain(req.params.id);
  res.json(chain);
});

router.post('/contracts', async (req: Request, res: Response) => {
  const contract = await createContract(req.body);
  res.json(contract);
});

router.get('/contracts/:id/compare', async (req: Request, res: Response) => {
  const contract = await getContract(req.params.id);
  if (!contract) return res.status(404).json({ error: '合同不存在' });

  const template = await getTemplate(contract.templateId);
  if (!template) return res.status(404).json({ error: '模板不存在' });

  const actualClauses = parseClauses(contract.rawContent);
  const diffs = compareClauses(template.clauses, actualClauses);
  const comments = await getComments(req.params.id);

  const extractedSummary = extractContractSummary(contract.rawContent);
  let summary = await getContractSummary(req.params.id);
  if (!summary) {
    summary = await createContractSummary({
      contractId: req.params.id,
      ...extractedSummary
    });
  }

  const riskDetail = calculateRiskScore(diffs, comments);
  if (contract.riskScore !== riskDetail.totalScore) {
    await updateContractRiskScore(req.params.id, riskDetail.totalScore);
    const updatedContract = await getContract(req.params.id);
    if (updatedContract) {
      broadcastRiskScoreUpdate(req.params.id, {
        contract: updatedContract,
        riskDetail
      });
    }
  }

  res.json({
    contract,
    template,
    diffs,
    summary,
    riskDetail
  });
});

router.get('/contracts/:id/comments', async (req: Request, res: Response) => {
  const comments = await getComments(req.params.id);
  res.json(comments);
});

router.post('/contracts/:id/comments', async (req: Request, res: Response) => {
  const { clauseNumber, userId, userName, riskLevel, content } = req.body;
  const comment = await createComment({
    contractId: req.params.id,
    clauseNumber,
    userId,
    userName,
    riskLevel: riskLevel as RiskLevel,
    content
  });
  broadcastComment(req.params.id, comment);

  const contract = await getContract(req.params.id);
  const template = contract ? await getTemplate(contract.templateId) : null;
  if (contract && template) {
    const actualClauses = parseClauses(contract.rawContent);
    const diffs = compareClauses(template.clauses, actualClauses);
    const allComments = await getComments(req.params.id);
    const riskDetail = calculateRiskScore(diffs, allComments);
    
    if (contract.riskScore !== riskDetail.totalScore) {
      await updateContractRiskScore(req.params.id, riskDetail.totalScore);
      const updatedContract = await getContract(req.params.id);
      if (updatedContract) {
        broadcastRiskScoreUpdate(req.params.id, {
          contract: updatedContract,
          riskDetail
        });
      }
    }
  }

  res.json(comment);
});

router.get('/contracts/:id/approvals', async (req: Request, res: Response) => {
  const status = await getApprovalChainStatus(req.params.id);
  res.json(status);
});

router.post('/contracts/:id/start-approval', async (req: Request, res: Response) => {
  const { userId, userName } = req.body;
  const result = await startApproval(req.params.id, userId, userName);
  broadcastApprovalUpdate(req.params.id, result);
  broadcastStatusUpdate(req.params.id, result.contract);
  res.json(result);
});

router.post('/contracts/:id/approval', async (req: Request, res: Response) => {
  const { role, action, userId, userName, comment } = req.body;
  const result = await processApproval(
    req.params.id,
    role as ApprovalRole,
    action,
    userId,
    userName,
    comment
  );
  broadcastApprovalUpdate(req.params.id, result);
  broadcastStatusUpdate(req.params.id, result.contract);
  res.json(result);
});

router.get('/users', async (req: Request, res: Response) => {
  const users = await getUsers();
  res.json(users);
});

router.post('/users', async (req: Request, res: Response) => {
  const { name, role } = req.body;
  const user = await createUser(name, role as ApprovalRole);
  res.json(user);
});

router.get('/warning-rules', async (req: Request, res: Response) => {
  const rules = await getWarningRules();
  res.json(rules);
});

router.post('/warning-rules', async (req: Request, res: Response) => {
  const { days, level, color } = req.body;
  const rule = await createWarningRule(days, level as WarningLevel, color);
  res.json(rule);
});

router.delete('/warning-rules/:id', async (req: Request, res: Response) => {
  await deleteWarningRule(req.params.id);
  res.json({ success: true });
});

router.get('/warning-records', async (req: Request, res: Response) => {
  const { status, level } = req.query;
  const filters: { status?: WarningRecordStatus; level?: WarningLevel } = {};
  if (status) filters.status = status as WarningRecordStatus;
  if (level) filters.level = level as WarningLevel;
  const records = await getWarningRecords(filters);
  res.json(records);
});

router.post('/warning-records/:id/handle', async (req: Request, res: Response) => {
  const { action, userId } = req.body;
  let status: WarningRecordStatus;

  if (action === 'handled') {
    status = 'handled';
  } else if (action === 'terminate') {
    status = 'terminated';
  } else {
    return res.status(400).json({ error: '无效的操作' });
  }

  await updateWarningRecordStatus(req.params.id, status, userId);
  const records = await getWarningRecords();
  const stats = await getWarningStats();
  broadcastWarningRecordUpdate(records);
  broadcastWarningStatsUpdate(stats);
  res.json({ success: true });
});

router.post('/warning-records/:id/renew', async (req: Request, res: Response) => {
  const { userId, userName } = req.body;

  const records = await getWarningRecords();
  const record = records.find(r => r.id === req.params.id);
  if (!record) return res.status(404).json({ error: '预警记录不存在' });

  const originalContract = await getContract(record.contractId);
  if (!originalContract) return res.status(404).json({ error: '原合同不存在' });

  const newContract = await createContract({
    title: `${originalContract.title} (续签)`,
    templateId: originalContract.templateId,
    rawContent: originalContract.rawContent,
    submittedBy: userId,
    submittedByName: userName,
    parentId: originalContract.id,
    expiryDate: originalContract.expiryDate
  });

  await updateWarningRecordStatus(req.params.id, 'renewed', userId, newContract.id);

  const updatedRecords = await getWarningRecords();
  const stats = await getWarningStats();
  broadcastWarningRecordUpdate(updatedRecords);
  broadcastWarningStatsUpdate(stats);

  res.json({ success: true, contract: newContract });
});

router.get('/warning-stats', async (req: Request, res: Response) => {
  const stats = await getWarningStats();
  res.json(stats);
});

router.put('/contracts/:id/expiry', async (req: Request, res: Response) => {
  const { expiryDate } = req.body;
  await updateContractExpiryDate(req.params.id, expiryDate);
  const contract = await getContract(req.params.id);
  res.json(contract);
});

router.get('/contracts/:id/summary', async (req: Request, res: Response) => {
  const contract = await getContract(req.params.id);
  if (!contract) return res.status(404).json({ error: '合同不存在' });

  let summary = await getContractSummary(req.params.id);
  if (!summary) {
    const extractedSummary = extractContractSummary(contract.rawContent);
    summary = await createContractSummary({
      contractId: req.params.id,
      ...extractedSummary
    });
  }

  res.json(summary);
});

router.put('/contracts/:id/summary', async (req: Request, res: Response) => {
  const { partyA, partyB, contractAmount, effectiveDate, expiryDate, paymentMethod, penaltyRatio, confidentialityPeriod } = req.body;
  const contract = await getContract(req.params.id);
  if (!contract) return res.status(404).json({ error: '合同不存在' });

  let summary = await getContractSummary(req.params.id);
  if (!summary) {
    summary = await createContractSummary({
      contractId: req.params.id,
      partyA: partyA ?? null,
      partyB: partyB ?? null,
      contractAmount: contractAmount ?? null,
      effectiveDate: effectiveDate ?? null,
      expiryDate: expiryDate ?? null,
      paymentMethod: paymentMethod ?? null,
      penaltyRatio: penaltyRatio ?? null,
      confidentialityPeriod: confidentialityPeriod ?? null
    });
  } else {
    summary = await updateContractSummary(req.params.id, {
      partyA: partyA !== undefined ? partyA : undefined,
      partyB: partyB !== undefined ? partyB : undefined,
      contractAmount: contractAmount !== undefined ? contractAmount : undefined,
      effectiveDate: effectiveDate !== undefined ? effectiveDate : undefined,
      expiryDate: expiryDate !== undefined ? expiryDate : undefined,
      paymentMethod: paymentMethod !== undefined ? paymentMethod : undefined,
      penaltyRatio: penaltyRatio !== undefined ? penaltyRatio : undefined,
      confidentialityPeriod: confidentialityPeriod !== undefined ? confidentialityPeriod : undefined
    });
  }

  res.json(summary);
});

router.post('/contracts/:id/summary/re-extract', async (req: Request, res: Response) => {
  const contract = await getContract(req.params.id);
  if (!contract) return res.status(404).json({ error: '合同不存在' });

  const extractedSummary = extractContractSummary(contract.rawContent);
  
  let summary = await getContractSummary(req.params.id);
  if (!summary) {
    summary = await createContractSummary({
      contractId: req.params.id,
      ...extractedSummary
    });
  } else {
    summary = await updateContractSummary(req.params.id, {
      partyA: extractedSummary.partyA,
      partyB: extractedSummary.partyB,
      contractAmount: extractedSummary.contractAmount,
      effectiveDate: extractedSummary.effectiveDate,
      expiryDate: extractedSummary.expiryDate,
      paymentMethod: extractedSummary.paymentMethod,
      penaltyRatio: extractedSummary.penaltyRatio,
      confidentialityPeriod: extractedSummary.confidentialityPeriod
    });
  }

  res.json(summary);
});

router.get('/contracts/:id/risk-score', async (req: Request, res: Response) => {
  const contract = await getContract(req.params.id);
  if (!contract) return res.status(404).json({ error: '合同不存在' });

  const template = await getTemplate(contract.templateId);
  if (!template) return res.status(404).json({ error: '模板不存在' });

  const actualClauses = parseClauses(contract.rawContent);
  const diffs = compareClauses(template.clauses, actualClauses);
  const comments = await getComments(req.params.id);

  const riskDetail = calculateRiskScore(diffs, comments);
  
  if (contract.riskScore !== riskDetail.totalScore) {
    await updateContractRiskScore(req.params.id, riskDetail.totalScore);
    const updatedContract = await getContract(req.params.id);
    if (updatedContract) {
      broadcastRiskScoreUpdate(req.params.id, {
        contract: updatedContract,
        riskDetail
      });
    }
  }

  res.json(riskDetail);
});

router.get('/risk-ranking', async (req: Request, res: Response) => {
  const { riskLevel } = req.query;
  const filters: { riskLevel?: 'low' | 'medium' | 'high' } = {};
  if (riskLevel && ['low', 'medium', 'high'].includes(riskLevel as string)) {
    filters.riskLevel = riskLevel as 'low' | 'medium' | 'high';
  }
  
  const contracts = await getPendingContractsByRiskScore(filters);
  
  const contractsWithRank = contracts.map((contract, index) => ({
    rank: index + 1,
    ...contract
  }));

  res.json(contractsWithRank);
});

export default router;
