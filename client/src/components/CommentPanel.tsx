import { useState } from 'react';
import { Comment, RiskLevel } from '../types';
import { commentApi } from '../services/api';
import { getCurrentUser } from '../store/auth';

interface CommentPanelProps {
  contractId: string;
  clauseNumber: string;
  comments: Comment[];
  onCommentAdded: (comment: Comment) => void;
}

const riskConfig: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  high: { label: '高风险', color: 'text-red-600', bg: 'bg-red-100' },
  medium: { label: '中风险', color: 'text-orange-600', bg: 'bg-orange-100' },
  low: { label: '低风险', color: 'text-blue-600', bg: 'bg-blue-100' },
  none: { label: '无风险', color: 'text-gray-600', bg: 'bg-gray-100' }
};

export default function CommentPanel({ contractId, clauseNumber, comments, onCommentAdded }: CommentPanelProps) {
  const [content, setContent] = useState('');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('none');
  const [submitting, setSubmitting] = useState(false);

  const user = getCurrentUser();
  const clauseComments = comments.filter(c => c.clauseNumber === clauseNumber);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !user) return;

    setSubmitting(true);
    try {
      const comment = await commentApi.create(contractId, {
        clauseNumber,
        userId: user.id,
        userName: user.name,
        riskLevel,
        content: content.trim()
      });
      onCommentAdded(comment);
      setContent('');
      setRiskLevel('none');
    } catch (error) {
      console.error('添加批注失败:', error);
      alert('添加批注失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <h4 className="font-medium text-gray-900">
          💬 条款 {clauseNumber} 批注
        </h4>
      </div>

      <div className="p-4 max-h-64 overflow-y-auto scrollbar-thin space-y-3">
        {clauseComments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">暂无批注</p>
        ) : (
          clauseComments.map(comment => (
            <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">
                    {comment.userName.charAt(0)}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{comment.userName}</span>
                  {comment.riskLevel !== 'none' && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskConfig[comment.riskLevel].bg} ${riskConfig[comment.riskLevel].color}`}>
                      {riskConfig[comment.riskLevel].label}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(comment.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100">
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-sm text-gray-600">风险等级：</span>
          {(['none', 'low', 'medium', 'high'] as RiskLevel[]).map(level => (
            <button
              key={level}
              type="button"
              onClick={() => setRiskLevel(level)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                riskLevel === level
                  ? `${riskConfig[level].bg} ${riskConfig[level].color} ring-2 ring-offset-1 ring-blue-500`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {riskConfig[level].label}
            </button>
          ))}
        </div>
        <div className="flex space-x-2">
          <input
            type="text"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="输入批注内容..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </form>
    </div>
  );
}
