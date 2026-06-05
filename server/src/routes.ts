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
  createUser
} from './services/dbService';
import { startApproval, processApproval, getApprovalChainStatus } from './services/approvalService';
import { broadcastComment, broadcastApprovalUpdate, broadcastStatusUpdate } from './websocket';
import { RiskLevel, ApprovalRole } from './types';

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

  res.json({
    contract,
    template,
    diffs
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

export default router;
