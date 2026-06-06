import { RiskScoreDetail } from '../types';

interface RiskScoreBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function getRiskScoreColor(score: number): string {
  if (score <= 30) return '#10b981';
  if (score <= 60) return '#f59e0b';
  return '#ef4444';
}

export function getRiskScoreBgColor(score: number): string {
  if (score <= 30) return '#ecfdf5';
  if (score <= 60) return '#fffbeb';
  return '#fef2f2';
}

export function getRiskScoreLabel(score: number): string {
  if (score <= 30) return '低风险';
  if (score <= 60) return '中风险';
  return '高风险';
}

export default function RiskScoreBadge({ score, showLabel = true, size = 'md' }: RiskScoreBadgeProps) {
  const color = getRiskScoreColor(score);
  const bgColor = getRiskScoreBgColor(score);
  const label = getRiskScoreLabel(score);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5'
  };

  const scoreSizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl'
  };

  return (
    <div className="inline-flex items-center space-x-2">
      <div
        className={`font-bold ${scoreSizeClasses[size]}`}
        style={{ color }}
      >
        {score}
      </div>
      {showLabel && (
        <span
          className={`rounded-full font-medium ${sizeClasses[size]}`}
          style={{ backgroundColor: bgColor, color }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

interface RiskScoreDetailProps {
  riskDetail: RiskScoreDetail;
}

export function RiskScoreDetailCard({ riskDetail }: RiskScoreDetailProps) {
  const color = getRiskScoreColor(riskDetail.totalScore);

  const scoreSizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl'
  };

  const scoreItems = [
    { label: '修改条款', count: riskDetail.modifiedClauses, score: riskDetail.breakdown.modifiedScore, color: '#f59e0b' },
    { label: '缺失条款', count: riskDetail.missingClauses, score: riskDetail.breakdown.missingScore, color: '#ef4444' },
    { label: '新增条款', count: riskDetail.newClauses, score: riskDetail.breakdown.newScore, color: '#10b981' },
    { label: '高风险批注', count: riskDetail.highRiskComments, score: riskDetail.breakdown.highRiskCommentScore, color: '#dc2626' }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <h4 className="font-medium text-gray-900">⚠️ 风险评分明细</h4>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-center mb-4">
          <div className="text-center">
            <div className={`font-bold ${scoreSizeClasses.lg}`} style={{ color }}>
              {riskDetail.totalScore}
            </div>
            <div className="text-xs text-gray-500 mt-1">风险评分（满分100）</div>
          </div>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${riskDetail.totalScore}%`, backgroundColor: color }}
          />
        </div>
        <div className="space-y-2">
          {scoreItems.map(item => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-600">{item.label}</span>
                <span className="text-gray-400">({item.count}条)</span>
              </div>
              <span className="font-medium text-gray-900">+{item.score}分</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
