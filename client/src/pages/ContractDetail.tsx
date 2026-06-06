import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { contractApi, commentApi, approvalApi } from '../services/api';
import {
  joinContract,
  leaveContract,
  onComment,
  offComment,
  onApprovalUpdate,
  offApprovalUpdate,
  onContractStatus,
  offContractStatus,
  onRiskScoreUpdate,
  offRiskScoreUpdate
} from '../services/socket';
import { Contract, ClauseDiff, Comment, ApprovalNode, RiskLevel, ContractSummary, RiskScoreDetail } from '../types';
import DiffViewer from '../components/DiffViewer';
import CommentPanel from '../components/CommentPanel';
import ApprovalFlow from '../components/ApprovalFlow';
import VersionChain from '../components/VersionChain';
import ContractSummaryCard from '../components/ContractSummaryCard';
import RiskScoreBadge, { RiskScoreDetailCard } from '../components/RiskScoreBadge';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: '草稿', color: 'text-gray-600', bg: 'bg-gray-100' },
  pending: { label: '审批中', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  approved: { label: '已通过', color: 'text-green-700', bg: 'bg-green-100' },
  rejected: { label: '已驳回', color: 'text-red-700', bg: 'bg-red-100' },
  needs_director: { label: '待总监确认', color: 'text-orange-700', bg: 'bg-orange-100' }
};

const riskBadge: Record<RiskLevel, string> = {
  high: '🔴 高风险',
  medium: '🟠 中风险',
  low: '🔵 低风险',
  none: '⚪ 无风险'
};

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<Contract | null>(null);
  const [diffs, setDiffs] = useState<ClauseDiff[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [approvalNodes, setApprovalNodes] = useState<ApprovalNode[]>([]);
  const [versions, setVersions] = useState<Contract[]>([]);
  const [selectedClause, setSelectedClause] = useState<string | null>(null);
  const [filterDiff, setFilterDiff] = useState<'all' | 'changed' | 'new' | 'missing'>('all');
  const [summary, setSummary] = useState<ContractSummary | null>(null);
  const [riskDetail, setRiskDetail] = useState<RiskScoreDetail | null>(null);

  const handleComment = useCallback((comment: Comment) => {
    setComments(prev => [comment, ...prev]);
  }, []);

  const handleApprovalUpdate = useCallback((data: { contract: Contract; node?: ApprovalNode }) => {
    setContract(data.contract);
    if (data.node) {
      setApprovalNodes(prev => prev.map(n => n.id === data.node!.id ? data.node! : n));
    }
  }, []);

  const handleContractStatus = useCallback((contract: Contract) => {
    setContract(contract);
  }, []);

  const handleRiskScoreUpdate = useCallback((data: { contract: Contract; riskDetail: RiskScoreDetail }) => {
    setContract(data.contract);
    setRiskDetail(data.riskDetail);
  }, []);

  const handleSummaryUpdate = useCallback((updatedSummary: ContractSummary) => {
    setSummary(updatedSummary);
  }, []);

  useEffect(() => {
    if (!id) return;

    loadData();
    joinContract(id);

    onComment(handleComment);
    onApprovalUpdate(handleApprovalUpdate);
    onContractStatus(handleContractStatus);
    onRiskScoreUpdate(handleRiskScoreUpdate);

    return () => {
      leaveContract(id);
      offComment(handleComment);
      offApprovalUpdate(handleApprovalUpdate);
      offContractStatus(handleContractStatus);
      offRiskScoreUpdate(handleRiskScoreUpdate);
    };
  }, [id, handleComment, handleApprovalUpdate, handleContractStatus, handleRiskScoreUpdate]);

  async function loadData() {
    if (!id) return;
    setLoading(true);
    try {
      const [compareData, commentData, approvalData, versionData] = await Promise.all([
        contractApi.getCompare(id),
        commentApi.list(id),
        approvalApi.getStatus(id),
        contractApi.getVersions(id)
      ]);
      setContract(compareData.contract);
      setDiffs(compareData.diffs);
      setSummary(compareData.summary);
      setRiskDetail(compareData.riskDetail);
      setComments(commentData);
      setApprovalNodes(approvalData.nodes);
      setVersions(versionData);

      const firstDiff = compareData.diffs.find(d => d.hasDiff);
      if (firstDiff) {
        setSelectedClause(firstDiff.clauseNumber);
      } else if (compareData.diffs.length > 0) {
        setSelectedClause(compareData.diffs[0].clauseNumber);
      }
    } catch (error) {
      console.error('加载合同详情失败:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleCommentAdded(comment: Comment) {
    setComments(prev => [comment, ...prev]);
  }

  async function reloadApproval() {
    if (!id) return;
    try {
      const [approvalData, contractData] = await Promise.all([
        approvalApi.getStatus(id),
        contractApi.get(id)
      ]);
      setApprovalNodes(approvalData.nodes);
      setContract(contractData);
    } catch (error) {
      console.error('刷新审批状态失败:', error);
    }
  }

  const filteredDiffs = diffs.filter(d => {
    if (filterDiff === 'all') return true;
    if (filterDiff === 'changed') return d.hasDiff && !d.isNew && !d.isMissing;
    if (filterDiff === 'new') return d.isNew;
    if (filterDiff === 'missing') return d.isMissing;
    return true;
  });

  const clauseRiskMap = new Map<string, RiskLevel>();
  comments.forEach(c => {
    if (c.riskLevel !== 'none') {
      const current = clauseRiskMap.get(c.clauseNumber);
      if (!current ||
          (c.riskLevel === 'high') ||
          (c.riskLevel === 'medium' && current !== 'high') ||
          (c.riskLevel === 'low' && current !== 'high' && current !== 'medium')) {
        clauseRiskMap.set(c.clauseNumber, c.riskLevel);
      }
    }
  });

  const hasHighRisk = comments.some(c => c.riskLevel === 'high');

  const diffStats = {
    total: diffs.length,
    changed: diffs.filter(d => d.hasDiff && !d.isNew && !d.isMissing).length,
    new: diffs.filter(d => d.isNew).length,
    missing: diffs.filter(d => d.isMissing).length
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">加载中...</div>;
  }

  if (!contract) {
    return <div className="text-center py-12 text-gray-500">合同不存在</div>;
  }

  const selectedDiff = diffs.find(d => d.clauseNumber === selectedClause);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <button
                onClick={() => navigate('/')}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← 返回
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{contract.title}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig[contract.status].bg} ${statusConfig[contract.status].color}`}>
                {statusConfig[contract.status].label}
              </span>
              <RiskScoreBadge score={contract.riskScore} size="md" />
              {hasHighRisk && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
                  ⚠️ 含高风险条款
                </span>
              )}
              <span className="text-sm text-gray-400">v{contract.version}</span>
            </div>
            <p className="text-gray-600">
              提交人：{contract.submittedByName} · {new Date(contract.createdAt).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
      </div>

      {summary && (
        <div className="mb-6">
          <ContractSummaryCard
            contractId={contract.id}
            initialSummary={summary}
            onSummaryUpdate={handleSummaryUpdate}
          />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">条款比对结果</h2>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="text-gray-500">共 {diffStats.total} 条</span>
                    <span className="text-yellow-600">⚠️ {diffStats.changed} 条修改</span>
                    <span className="text-green-600">✨ {diffStats.new} 条新增</span>
                    <span className="text-red-600">❌ {diffStats.missing} 条缺失</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {[
                      { key: 'all', label: '全部' },
                      { key: 'changed', label: '修改' },
                      { key: 'new', label: '新增' },
                      { key: 'missing', label: '缺失' }
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setFilterDiff(f.key as any)}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          filterDiff === f.key
                            ? 'bg-blue-500 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3">
              <div className="col-span-1 border-r border-gray-100 max-h-[700px] overflow-y-auto scrollbar-thin">
                <div className="divide-y divide-gray-50">
                  {filteredDiffs.map(diff => (
                    <button
                      key={diff.clauseNumber}
                      onClick={() => setSelectedClause(diff.clauseNumber)}
                      className={`w-full text-left px-4 py-3 transition-colors ${
                        selectedClause === diff.clauseNumber
                          ? 'bg-blue-50 border-l-4 border-blue-500'
                          : 'hover:bg-gray-50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className={`text-sm font-medium ${
                              diff.isNew ? 'text-green-700' :
                              diff.isMissing ? 'text-red-700' :
                              diff.hasDiff ? 'text-yellow-700' : 'text-gray-700'
                            }`}>
                              {diff.clauseNumber}、{diff.clauseTitle}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            {diff.isNew && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">新增</span>
                            )}
                            {diff.isMissing && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">缺失</span>
                            )}
                            {!diff.isNew && !diff.isMissing && diff.hasDiff && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">修改</span>
                            )}
                            {clauseRiskMap.get(diff.clauseNumber) && (
                              <span className="text-xs">
                                {riskBadge[clauseRiskMap.get(diff.clauseNumber)!]}
                              </span>
                            )}
                          </div>
                        </div>
                        {comments.filter(c => c.clauseNumber === diff.clauseNumber).length > 0 && (
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">
                            {comments.filter(c => c.clauseNumber === diff.clauseNumber).length}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-2">
                {selectedDiff ? (
                  <div className="h-full flex flex-col">
                    <div className="grid grid-cols-2 border-b border-gray-100">
                      <div className="px-4 py-3 bg-gray-50 border-r border-gray-100">
                        <span className="text-sm font-medium text-gray-700">📋 标准模板</span>
                      </div>
                      <div className="px-4 py-3 bg-gray-50">
                        <span className="text-sm font-medium text-gray-700">📄 实际合同</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 flex-1 min-h-0">
                      <div className={`border-r border-gray-100 p-4 overflow-y-auto scrollbar-thin ${
                        selectedDiff.isNew ? 'bg-gray-50' : ''
                      }`}>
                        {selectedDiff.isNew ? (
                          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                            模板中无此条款
                          </div>
                        ) : selectedDiff.isMissing ? (
                          <div className="text-red-600">
                            <DiffViewer diff={selectedDiff.diff} side="left" />
                          </div>
                        ) : (
                          <DiffViewer diff={selectedDiff.diff} side="left" />
                        )}
                      </div>
                      <div className={`p-4 overflow-y-auto scrollbar-thin ${
                        selectedDiff.isMissing ? 'bg-gray-50' : ''
                      }`}>
                        {selectedDiff.isMissing ? (
                          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                            合同中缺失此条款
                          </div>
                        ) : (
                          <DiffViewer diff={selectedDiff.diff} side="right" />
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-96 flex items-center justify-center text-gray-400">
                    请选择一个条款查看比对详情
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectedClause && (
            <CommentPanel
              contractId={contract.id}
              clauseNumber={selectedClause}
              comments={comments}
              onCommentAdded={handleCommentAdded}
            />
          )}
        </div>

        <div className="space-y-6">
          <VersionChain versions={versions} currentId={contract.id} />

          <ApprovalFlow
            contract={contract}
            nodes={approvalNodes}
            onApprovalUpdate={reloadApproval}
          />

          {riskDetail && (
            <RiskScoreDetailCard riskDetail={riskDetail} />
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h4 className="font-medium text-gray-900">📊 风险批注概览</h4>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">高风险条款</span>
                <span className="font-semibold text-red-600">
                  {new Set(comments.filter(c => c.riskLevel === 'high').map(c => c.clauseNumber)).size} 条
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">中风险条款</span>
                <span className="font-semibold text-orange-600">
                  {new Set(comments.filter(c => c.riskLevel === 'medium').map(c => c.clauseNumber)).size} 条
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">低风险条款</span>
                <span className="font-semibold text-blue-600">
                  {new Set(comments.filter(c => c.riskLevel === 'low').map(c => c.clauseNumber)).size} 条
                </span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
                <span className="text-gray-600">批注总数</span>
                <span className="font-semibold text-gray-900">{comments.length} 条</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h4 className="font-medium text-gray-900">💡 图例说明</h4>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <span className="diff-added px-2 py-0.5 rounded text-xs">新增内容</span>
                <span className="text-gray-600">合同中新增的文字</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="diff-removed px-2 py-0.5 rounded text-xs">删除内容</span>
                <span className="text-gray-600">模板中被删除的文字</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs">新增条款</span>
                <span className="text-gray-600">模板外新增条款</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs">缺失条款</span>
                <span className="text-gray-600">合同中缺少的条款</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
