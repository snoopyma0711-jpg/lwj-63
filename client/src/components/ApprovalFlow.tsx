import { useState, useEffect, useRef } from 'react';
import { ApprovalNode, Contract, ApprovalRole, ApprovalNodeWithTimeout } from '../types';
import { approvalApi } from '../services/api';
import { getCurrentUser } from '../store/auth';
import { useNavigate } from 'react-router-dom';

interface ApprovalFlowProps {
  contract: Contract;
  nodes: ApprovalNode[];
  nodesWithTimeout: ApprovalNodeWithTimeout[];
  hasTimedOut: boolean;
  onApprovalUpdate: () => void;
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

const roleNames: Record<string, string> = {
  specialist: '法务专员',
  manager: '法务经理',
  director: '法务总监'
};

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: '待处理', color: 'text-yellow-600', icon: '⏳' },
  approved: { label: '已通过', color: 'text-green-600', icon: '✅' },
  rejected: { label: '已驳回', color: 'text-red-600', icon: '❌' },
  transferred: { label: '已转交', color: 'text-blue-600', icon: '↩️' }
};

export default function ApprovalFlow({ contract, nodes, nodesWithTimeout, hasTimedOut, onApprovalUpdate }: ApprovalFlowProps) {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [action, setAction] = useState<'approve' | 'reject' | 'transfer' | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const timerRef = useRef<number | null>(null);

  const canApprove = user && contract.currentApproverRole === user.role && contract.status === 'pending';

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  function getCurrentDuration(node: ApprovalNodeWithTimeout): number {
    if (node.status === 'pending' && node.arrivedAt) {
      return currentTime - new Date(node.arrivedAt).getTime();
    }
    return node.currentDurationMs;
  }

  function isTimedOut(node: ApprovalNodeWithTimeout): boolean {
    if (node.status !== 'pending') return node.isTimedOut;
    return getCurrentDuration(node) > node.timeoutThresholdMs;
  }

  async function handleApproval() {
    if (!action || !user) return;

    setSubmitting(true);
    try {
      await approvalApi.process(contract.id, {
        role: user.role,
        action,
        userId: user.id,
        userName: user.name,
        comment: comment.trim() || undefined
      });
      onApprovalUpdate();
      setAction(null);
      setComment('');
    } catch (error) {
      console.error('审批操作失败:', error);
      alert('操作失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStartApproval() {
    if (!user) return;
    setSubmitting(true);
    try {
      await approvalApi.start(contract.id, user.id, user.name);
      onApprovalUpdate();
    } catch (error) {
      console.error('发起审批失败:', error);
      alert('发起审批失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  function handleResubmit() {
    navigate(`/upload/${contract.id}`);
  }

  const roleOrder: ApprovalRole[] = contract.hasHighRisk
    ? ['specialist', 'manager', 'director']
    : ['specialist', 'manager'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h4 className="font-medium text-gray-900">🔄 审批流转</h4>
          {hasTimedOut && contract.status === 'pending' && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full animate-pulse">
              ⚠️ 存在超时审批
            </span>
          )}
        </div>
        {contract.status === 'draft' && (
          <button
            onClick={handleStartApproval}
            disabled={submitting}
            className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {submitting ? '提交中...' : '发起审批'}
          </button>
        )}
        {contract.status === 'rejected' && (
          <button
            onClick={handleResubmit}
            className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors"
          >
            重新提交
          </button>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          {roleOrder.map((role, index) => {
            const node = nodes.find(n => n.role === role);
            const nodeWithTimeout = nodesWithTimeout.find(n => n.role === role);
            const isActive = contract.currentApproverRole === role;
            const isCompleted = node && node.status !== 'pending';
            const timedOut = nodeWithTimeout && isTimedOut(nodeWithTimeout);
            const currentDuration = nodeWithTimeout ? getCurrentDuration(nodeWithTimeout) : 0;

            return (
              <div key={role} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold border-2 transition-all relative ${
                    isCompleted
                      ? node?.status === 'approved'
                        ? 'bg-green-500 border-green-500 text-white'
                        : node?.status === 'rejected'
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'bg-blue-500 border-blue-500 text-white'
                      : isActive && timedOut
                      ? 'bg-red-100 border-red-500 text-red-700 ring-4 ring-red-100'
                      : isActive
                      ? 'bg-yellow-100 border-yellow-500 text-yellow-700 ring-4 ring-yellow-100'
                      : 'bg-gray-100 border-gray-300 text-gray-400'
                  }`}>
                    {isCompleted ? statusConfig[node!.status].icon : roleNames[role].charAt(0)}
                    {timedOut && isActive && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse flex items-center justify-center">
                        <span className="text-white text-xs">!</span>
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <p className={`text-sm font-medium ${
                      timedOut && isActive ? 'text-red-600' : isActive ? 'text-yellow-600' : 'text-gray-700'
                    }`}>
                      {roleNames[role]}
                    </p>
                    <p className={`text-xs ${
                      node ? statusConfig[node.status].color : 'text-gray-400'
                    }`}>
                      {node ? statusConfig[node.status].label : '待开始'}
                    </p>
                    {nodeWithTimeout && node && (node.status !== 'pending' || node.arrivedAt) && (
                      <p className={`text-xs mt-1 ${
                        timedOut ? 'text-red-600 font-medium' : 'text-gray-400'
                      }`}>
                        {node.status === 'pending' ? '已耗时' : '耗时'}：{formatDuration(currentDuration)}
                        {timedOut && <span className="ml-1 text-red-600">⚠️</span>}
                      </p>
                    )}
                  </div>
                </div>
                {index < roleOrder.length - 1 && (
                  <div className={`w-16 h-0.5 mx-2 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {nodes.length > 0 && (
          <div className="space-y-3 mb-4">
            {nodes.filter(n => n.comment).map(node => (
              <div key={node.id} className={`p-3 rounded-lg ${
                node.status === 'rejected' ? 'bg-red-50' :
                node.status === 'transferred' ? 'bg-blue-50' :
                'bg-green-50'
              }`}>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    {roleNames[node.role]} {node.userName}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    node.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    node.status === 'transferred' ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {statusConfig[node.status].label}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(node.updatedAt).toLocaleString('zh-CN')}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{node.comment}</p>
              </div>
            ))}
          </div>
        )}

        {canApprove && !action && (
          <div className="flex space-x-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => setAction('approve')}
              className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
            >
              ✅ 通过
            </button>
            <button
              onClick={() => setAction('transfer')}
              className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              ↩️ 加批注转回
            </button>
            <button
              onClick={() => setAction('reject')}
              className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
            >
              ❌ 驳回
            </button>
          </div>
        )}

        {action && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={
                action === 'approve' ? '填写通过意见（可选）...' :
                action === 'reject' ? '请填写驳回原因...' :
                '请填写转回意见...'
              }
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
            <div className="flex justify-end space-x-3 mt-3">
              <button
                onClick={() => setAction(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleApproval}
                disabled={submitting || (action !== 'approve' && !comment.trim())}
                className={`px-6 py-2 text-white rounded-lg transition-colors font-medium disabled:opacity-50 ${
                  action === 'approve' ? 'bg-green-500 hover:bg-green-600' :
                  action === 'reject' ? 'bg-red-500 hover:bg-red-600' :
                  'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {submitting ? '提交中...' :
                  action === 'approve' ? '确认通过' :
                  action === 'reject' ? '确认驳回' : '确认转回'
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
