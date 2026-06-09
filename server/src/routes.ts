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
  getPendingContractsByRiskScore,
  getApprovalTimeoutConfigs,
  getApprovalTimeoutConfig,
  setApprovalTimeoutConfig,
  getTemplatesWithLock,
  getTemplateVersions,
  getTemplateVersion,
  getTemplateLatestVersion,
  createTemplateVersion,
  getTemplateDraft,
  saveTemplateDraft,
  deleteTemplateDraft,
  getTemplateEditLock,
  acquireTemplateEditLock,
  refreshTemplateEditLock,
  releaseTemplateEditLock,
  updateTemplate
} from './services/dbService';
import { startApproval, processApproval, getApprovalChainStatus } from './services/approvalService';
import { getApprovalEfficiencyStats } from './services/approvalEfficiencyService';
import {
  broadcastComment,
  broadcastApprovalUpdate,
  broadcastStatusUpdate,
  broadcastWarningStatsUpdate,
  broadcastWarningRecordUpdate,
  broadcastRiskScoreUpdate,
  broadcastEfficiencyStats,
  broadcastTemplateLockUpdate,
  broadcastTemplateVersionUpdate,
  broadcastClauseWarningUpdate
} from './websocket';
import { RiskLevel, ApprovalRole, WarningLevel, WarningRecordStatus, ApprovalEfficiencyStats, Clause, ClauseRelationType, ClauseChangeWarningFilters } from './types';
import { extractContractSummary } from './services/summaryExtractionService';
import { calculateRiskScore } from './services/riskScoringService';
import {
  createClauseRelation,
  getClauseRelations,
  deleteClauseRelation,
  getImpactAnalysis,
  getClauseChangeWarnings,
  updateClauseChangeWarningStatus,
  handleClauseChange
} from './services/clauseGraphService';

const router = Router();

router.get('/templates', async (req: Request, res: Response) => {
  const withLock = req.query.withLock === 'true';
  const templates = withLock ? await getTemplatesWithLock() : await getTemplates();
  res.json(templates);
});

router.get('/templates/:id', async (req: Request, res: Response) => {
  const template = await getTemplate(req.params.id);
  if (!template) return res.status(404).json({ error: '模板不存在' });

  const latestVersion = await getTemplateLatestVersion(req.params.id);
  const editLock = await getTemplateEditLock(req.params.id);
  const draft = await getTemplateDraft(req.params.id);

  res.json({
    ...template,
    latestVersion,
    editLock,
    hasDraft: !!draft
  });
});

router.post('/templates', async (req: Request, res: Response) => {
  const { name, clauses, createdBy, createdByName } = req.body;
  const template = await createTemplate(name, clauses);

  await createTemplateVersion({
    templateId: template.id,
    versionNumber: 1,
    name: template.name,
    clauses: template.clauses,
    description: '初始版本',
    createdBy: createdBy || 'system',
    createdByName: createdByName || '系统'
  });

  res.json(template);
});

router.get('/templates/:id/versions', async (req: Request, res: Response) => {
  const versions = await getTemplateVersions(req.params.id);
  res.json(versions);
});

router.get('/templates/:id/versions/compare', async (req: Request, res: Response) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: '请指定两个版本号' });

  const fromVersion = parseInt(from as string);
  const toVersion = parseInt(to as string);

  if (isNaN(fromVersion) || isNaN(toVersion)) {
    return res.status(400).json({ error: '无效的版本号' });
  }

  const fromTemplate = await getTemplateVersion(req.params.id, fromVersion);
  const toTemplate = await getTemplateVersion(req.params.id, toVersion);

  if (!fromTemplate || !toTemplate) {
    return res.status(404).json({ error: '指定的版本不存在' });
  }

  const diffs = compareClauses(fromTemplate.clauses, toTemplate.clauses);

  res.json({
    fromVersion: fromTemplate,
    toVersion: toTemplate,
    diffs
  });
});

router.post('/templates/:id/versions/:version/rollback', async (req: Request, res: Response) => {
  const version = parseInt(req.params.version);
  if (isNaN(version)) return res.status(400).json({ error: '无效的版本号' });

  const { createdBy, createdByName } = req.body;
  if (!createdBy || !createdByName) {
    return res.status(400).json({ error: '请提供创建者信息' });
  }

  const lock = await getTemplateEditLock(req.params.id);
  if (lock && lock.userId !== createdBy) {
    return res.status(409).json({ error: `当前${lock.userName}正在编辑该模板，请稍后再试` });
  }

  const targetVersion = await getTemplateVersion(req.params.id, version);
  if (!targetVersion) return res.status(404).json({ error: '版本不存在' });

  const latestVersion = await getTemplateLatestVersion(req.params.id);
  const newVersionNumber = latestVersion + 1;

  const newVersion = await createTemplateVersion({
    templateId: req.params.id,
    versionNumber: newVersionNumber,
    name: targetVersion.name,
    clauses: targetVersion.clauses,
    description: `回滚到v${version}`,
    createdBy,
    createdByName
  });

  await updateTemplate(req.params.id, targetVersion.name, targetVersion.clauses);
  await deleteTemplateDraft(req.params.id);

  broadcastTemplateVersionUpdate(req.params.id, {
    versionNumber: newVersionNumber,
    action: 'rolled_back'
  });

  res.json(newVersion);
});

router.get('/templates/:id/versions/:version', async (req: Request, res: Response) => {
  const version = parseInt(req.params.version);
  if (isNaN(version)) return res.status(400).json({ error: '无效的版本号' });

  const templateVersion = await getTemplateVersion(req.params.id, version);
  if (!templateVersion) return res.status(404).json({ error: '版本不存在' });

  res.json(templateVersion);
});

router.post('/templates/:id/versions', async (req: Request, res: Response) => {
  const { name, clauses, description, createdBy, createdByName } = req.body;

  if (!createdBy || !createdByName) {
    return res.status(400).json({ error: '请提供创建者信息' });
  }

  const lock = await getTemplateEditLock(req.params.id);
  if (!lock || lock.userId !== createdBy) {
    return res.status(409).json({ error: '您没有编辑权限，请先获取编辑锁' });
  }

  const latestVersion = await getTemplateLatestVersion(req.params.id);
  const newVersionNumber = latestVersion + 1;

  const newVersion = await createTemplateVersion({
    templateId: req.params.id,
    versionNumber: newVersionNumber,
    name: name,
    clauses: clauses,
    description: description || `版本v${newVersionNumber}`,
    createdBy,
    createdByName
  });

  await updateTemplate(req.params.id, name, clauses);
  await deleteTemplateDraft(req.params.id);

  broadcastTemplateVersionUpdate(req.params.id, {
    versionNumber: newVersionNumber,
    action: 'created'
  });

  res.json(newVersion);
});

router.get('/templates/:id/draft', async (req: Request, res: Response) => {
  const draft = await getTemplateDraft(req.params.id);
  res.json(draft);
});

router.put('/templates/:id/draft', async (req: Request, res: Response) => {
  const { name, clauses, savedBy, savedByName } = req.body;

  if (!savedBy || !savedByName) {
    return res.status(400).json({ error: '请提供保存者信息' });
  }

  const lock = await getTemplateEditLock(req.params.id);
  if (!lock || lock.userId !== savedBy) {
    return res.status(409).json({ error: '您没有编辑权限，请先获取编辑锁' });
  }

  const draft = await saveTemplateDraft({
    templateId: req.params.id,
    name,
    clauses,
    savedBy,
    savedByName
  });

  await refreshTemplateEditLock(req.params.id, savedBy);

  res.json(draft);
});

router.delete('/templates/:id/draft', async (req: Request, res: Response) => {
  await deleteTemplateDraft(req.params.id);
  res.json({ success: true });
});

router.get('/templates/:id/lock', async (req: Request, res: Response) => {
  const lock = await getTemplateEditLock(req.params.id);
  res.json(lock);
});

router.post('/templates/:id/lock', async (req: Request, res: Response) => {
  const { userId, userName } = req.body;

  if (!userId || !userName) {
    return res.status(400).json({ error: '请提供用户信息' });
  }

  const lock = await acquireTemplateEditLock(req.params.id, userId, userName);

  if (!lock) {
    const currentLock = await getTemplateEditLock(req.params.id);
    return res.status(409).json({
      error: `当前${currentLock?.userName}正在编辑该模板，请稍后再试`,
      lock: currentLock
    });
  }

  broadcastTemplateLockUpdate(req.params.id, {
    lock,
    action: 'acquired'
  });

  res.json(lock);
});

router.put('/templates/:id/lock', async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: '请提供用户ID' });
  }

  const success = await refreshTemplateEditLock(req.params.id, userId);

  if (!success) {
    return res.status(409).json({ error: '您没有持有该模板的编辑锁' });
  }

  const lock = await getTemplateEditLock(req.params.id);
  broadcastTemplateLockUpdate(req.params.id, {
    lock,
    action: 'refreshed'
  });

  res.json({ success: true, lock });
});

router.delete('/templates/:id/lock', async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: '请提供用户ID' });
  }

  const success = await releaseTemplateEditLock(req.params.id, userId);

  if (!success) {
    return res.status(409).json({ error: '您没有持有该模板的编辑锁' });
  }

  broadcastTemplateLockUpdate(req.params.id, {
    lock: null,
    action: 'released'
  });

  res.json({ success: true });
});

router.post('/compare', async (req: Request, res: Response) => {
  const { templateId, rawContent, versionNumber } = req.body;
  let template = await getTemplate(templateId);
  if (!template) return res.status(404).json({ error: '模板不存在' });

  let templateClauses = template.clauses;
  let selectedVersion = versionNumber;

  if (versionNumber) {
    const templateVersion = await getTemplateVersion(templateId, parseInt(versionNumber));
    if (templateVersion) {
      templateClauses = templateVersion.clauses;
    } else {
      selectedVersion = undefined;
    }
  }

  const actualClauses = parseClauses(rawContent);
  const diffs = compareClauses(templateClauses, actualClauses);

  res.json({
    templateClauses,
    actualClauses,
    diffs,
    selectedVersion
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

router.get('/approval-timeout-configs', async (req: Request, res: Response) => {
  const configs = await getApprovalTimeoutConfigs();
  res.json(configs);
});

router.get('/approval-timeout-configs/:role', async (req: Request, res: Response) => {
  const config = await getApprovalTimeoutConfig(req.params.role as ApprovalRole);
  if (!config) return res.status(404).json({ error: '配置不存在' });
  res.json(config);
});

router.put('/approval-timeout-configs/:role', async (req: Request, res: Response) => {
  const { thresholdHours } = req.body;
  if (typeof thresholdHours !== 'number' || thresholdHours <= 0) {
    return res.status(400).json({ error: '超时阈值必须为正整数' });
  }
  const config = await setApprovalTimeoutConfig(req.params.role as ApprovalRole, thresholdHours);
  await broadcastEfficiencyStats();
  res.json(config);
});

router.get('/approval-efficiency', async (req: Request, res: Response) => {
  const stats = await getApprovalEfficiencyStats();
  res.json(stats);
});

router.get('/clause-relations', async (req: Request, res: Response) => {
  const { clauseNumber, keyword, relationType } = req.query;
  const filters: {
    clauseNumber?: string;
    keyword?: string;
    relationType?: ClauseRelationType;
  } = {};
  if (clauseNumber) filters.clauseNumber = clauseNumber as string;
  if (keyword) filters.keyword = keyword as string;
  if (relationType) filters.relationType = relationType as ClauseRelationType;

  const relations = await getClauseRelations(filters);
  res.json(relations);
});

router.post('/clause-relations', async (req: Request, res: Response) => {
  const { clauseNumberA, clauseNumberB, relationType, description, createdBy, createdByName } = req.body;

  if (!clauseNumberA || !clauseNumberB || !relationType || !description || !createdBy || !createdByName) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const validTypes: ClauseRelationType[] = ['引用', '冲突', '补充', '替代'];
  if (!validTypes.includes(relationType)) {
    return res.status(400).json({ error: '无效的关系类型，必须是：引用、冲突、补充、替代' });
  }

  const result = await createClauseRelation({
    clauseNumberA,
    clauseNumberB,
    relationType: relationType as ClauseRelationType,
    description,
    createdBy,
    createdByName
  });

  if ('error' in result) {
    return res.status(409).json({ error: result.error });
  }

  res.json(result);
});

router.delete('/clause-relations/:id', async (req: Request, res: Response) => {
  const success = await deleteClauseRelation(req.params.id);
  if (!success) {
    return res.status(404).json({ error: '关联关系不存在' });
  }
  res.json({ success: true });
});

router.get('/clause-relations/impact-analysis', async (req: Request, res: Response) => {
  const { clauseNumber, templateId } = req.query;
  if (!clauseNumber) {
    return res.status(400).json({ error: '请提供条款编号' });
  }

  const result = await getImpactAnalysis(
    clauseNumber as string,
    templateId ? templateId as string : undefined
  );
  res.json(result);
});

router.get('/clause-change-warnings', async (req: Request, res: Response) => {
  const { contractId, startTime, endTime, status } = req.query;
  const filters: ClauseChangeWarningFilters = {};
  if (contractId) filters.contractId = contractId as string;
  if (startTime) filters.startTime = startTime as string;
  if (endTime) filters.endTime = endTime as string;
  if (status) filters.status = status as 'pending' | 'viewed' | 'handled';

  const warnings = await getClauseChangeWarnings(filters);
  res.json(warnings);
});

router.put('/clause-change-warnings/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['pending', 'viewed', 'handled'].includes(status)) {
    return res.status(400).json({ error: '无效的状态' });
  }

  const success = await updateClauseChangeWarningStatus(
    req.params.id,
    status as 'pending' | 'viewed' | 'handled'
  );

  if (!success) {
    return res.status(404).json({ error: '预警记录不存在' });
  }

  res.json({ success: true });
});

router.post('/contracts/:id/new-version', async (req: Request, res: Response) => {
  const parentContract = await getContract(req.params.id);
  if (!parentContract) {
    return res.status(404).json({ error: '原合同不存在' });
  }

  const { rawContent, submittedBy, submittedByName } = req.body;
  if (!rawContent || !submittedBy || !submittedByName) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const newContract = await createContract({
    title: parentContract.title,
    templateId: parentContract.templateId,
    rawContent,
    submittedBy,
    submittedByName,
    parentId: parentContract.id,
    expiryDate: parentContract.expiryDate
  });

  const parentClauses = parseClauses(parentContract.rawContent);
  const newClauses = parseClauses(rawContent);
  const diffs = compareClauses(parentClauses, newClauses);

  const changedClauseNumbers = diffs
    .filter((d: any) => d.hasDiff)
    .map((d: any) => d.clauseNumber);

  if (changedClauseNumbers.length > 0) {
    const warnings = await handleClauseChange(newContract.id, changedClauseNumbers, newContract.createdAt);
    for (const warning of warnings) {
      broadcastClauseWarningUpdate(warning);
    }
  }

  res.json(newContract);
});

export default router;
