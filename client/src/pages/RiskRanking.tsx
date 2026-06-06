import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { riskRankingApi } from '../services/api';
import { Contract } from '../types';
import RiskScoreBadge, { getRiskScoreBgColor, getRiskScoreColor } from '../components/RiskScoreBadge';
import { joinRiskRanking, leaveRiskRanking, onRiskRankingUpdate, offRiskRankingUpdate } from '../services/socket';

type RiskLevelFilter = 'all' | 'low' | 'medium' | 'high';

interface RankedContract extends Contract {
  rank: number;
}

const filterOptions: { key: RiskLevelFilter; label: string; color: string; bg: string; minScore: number; maxScore: number }[] = [
  { key: 'all', label: '全部', color: '#6b7280', bg: '#f3f4f6', minScore: 0, maxScore: 100 },
  { key: 'low', label: '低风险', color: '#10b981', bg: '#ecfdf5', minScore: 0, maxScore: 30 },
  { key: 'medium', label: '中风险', color: '#f59e0b', bg: '#fffbeb', minScore: 31, maxScore: 60 },
  { key: 'high', label: '高风险', color: '#ef4444', bg: '#fef2f2', minScore: 61, maxScore: 100 }
];

export default function RiskRanking() {
  const [contracts, setContracts] = useState<RankedContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RiskLevelFilter>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = filter === 'all' ? undefined : { riskLevel: filter };
      const data = await riskRankingApi.list(filters);
      setContracts(data);
    } catch (error) {
      console.error('加载风险排行榜失败:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const handleRankingUpdate = useCallback(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
    joinRiskRanking();
    onRiskRankingUpdate(handleRankingUpdate);

    return () => {
      leaveRiskRanking();
      offRiskRankingUpdate(handleRankingUpdate);
    };
  }, [loadData, handleRankingUpdate]);

  const stats = {
    total: contracts.length,
    high: contracts.filter(c => c.riskScore > 60).length,
    medium: contracts.filter(c => c.riskScore > 30 && c.riskScore <= 60).length,
    low: contracts.filter(c => c.riskScore <= 30).length
  };

  function getRankBadge(rank: number) {
    if (rank === 1) {
      return <span className="text-2xl">🥇</span>;
    }
    if (rank === 2) {
      return <span className="text-2xl">🥈</span>;
    }
    if (rank === 3) {
      return <span className="text-2xl">🥉</span>;
    }
    return (
      <span className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 font-bold text-sm">
        {rank}
      </span>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">加载中...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">风险排行榜</h1>
        <p className="text-gray-600">按风险评分从高到低展示待审批合同，优先关注高风险合同</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-500 mt-1">待审合同</div>
            </div>
            <div className="text-4xl">📋</div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-red-600">{stats.high}</div>
              <div className="text-sm text-gray-500 mt-1">高风险</div>
            </div>
            <div className="text-4xl">🔴</div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-yellow-600">{stats.medium}</div>
              <div className="text-sm text-gray-500 mt-1">中风险</div>
            </div>
            <div className="text-4xl">🟠</div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-green-600">{stats.low}</div>
              <div className="text-sm text-gray-500 mt-1">低风险</div>
            </div>
            <div className="text-4xl">🟢</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            {filterOptions.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.key
                    ? 'text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                style={{
                  backgroundColor: filter === f.key ? f.color : undefined,
                  color: filter === f.key ? 'white' : undefined
                }}
              >
                {f.label}
                {f.key !== 'all' && (
                  <span className="ml-1 opacity-75">({f.minScore}-{f.maxScore}分)</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {contracts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-gray-500 mb-4">
              {filter === 'all' ? '暂无待审批合同' : `暂无${filterOptions.find(f => f.key === filter)?.label}合同`}
            </p>
            <Link
              to="/"
              className="text-blue-500 hover:text-blue-600 font-medium"
            >
              返回合同列表 →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {contracts.map(contract => {
              const isHighRisk = contract.riskScore > 60;
              return (
                <Link
                  key={contract.id}
                  to={`/contract/${contract.id}`}
                  className={`block px-6 py-4 transition-colors ${
                    isHighRisk ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {getRankBadge(contract.rank)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 flex-wrap">
                        <h3 className="font-medium text-gray-900 truncate">{contract.title}</h3>
                        <RiskScoreBadge score={contract.riskScore} size="sm" />
                        {contract.hasHighRisk && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            ⚠️ 高风险
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500 flex-wrap">
                        <span>提交人：{contract.submittedByName}</span>
                        <span>•</span>
                        <span>提交时间：{new Date(contract.createdAt).toLocaleString('zh-CN')}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-xs text-gray-500 mb-1">风险评分</div>
                        <div
                          className="text-2xl font-bold"
                          style={{ color: getRiskScoreColor(contract.riskScore) }}
                        >
                          {contract.riskScore}
                        </div>
                      </div>
                      <div className="text-gray-400">→</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
