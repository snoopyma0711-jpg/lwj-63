import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { contractApi, warningRecordApi, approvalEfficiencyApi } from '../services/api';
import { Contract, WarningRecord, ApprovalEfficiencyStats } from '../types';
import RiskScoreBadge, { getRiskScoreBgColor } from '../components/RiskScoreBadge';
import { joinContract, leaveContract, onRiskScoreUpdate, offRiskScoreUpdate, initSocket, joinEfficiency, leaveEfficiency, onEfficiencyUpdate, offEfficiencyUpdate } from '../services/socket';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: '草稿', color: 'text-gray-600', bg: 'bg-gray-100' },
  pending: { label: '审批中', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  approved: { label: '已通过', color: 'text-green-700', bg: 'bg-green-100' },
  rejected: { label: '已驳回', color: 'text-red-700', bg: 'bg-red-100' },
  needs_director: { label: '待总监确认', color: 'text-orange-700', bg: 'bg-orange-100' }
};

const roleNames: Record<string, string> = {
  specialist: '法务专员',
  manager: '法务经理',
  director: '法务总监'
};

export default function ContractList() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [warningRecords, setWarningRecords] = useState<WarningRecord[]>([]);
  const [efficiencyStats, setEfficiencyStats] = useState<ApprovalEfficiencyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const handleRiskScoreUpdate = useCallback((data: { contract: Contract }) => {
    setContracts(prev => prev.map(c => 
      c.id === data.contract.id ? { ...c, riskScore: data.contract.riskScore } : c
    ));
  }, []);

  const handleEfficiencyUpdate = useCallback((stats: ApprovalEfficiencyStats) => {
    setEfficiencyStats(stats);
  }, []);

  useEffect(() => {
    initSocket();
    loadContracts();

    contracts.forEach(contract => {
      joinContract(contract.id);
    });
    joinEfficiency();
    onRiskScoreUpdate(handleRiskScoreUpdate);
    onEfficiencyUpdate(handleEfficiencyUpdate);

    return () => {
      contracts.forEach(contract => {
        leaveContract(contract.id);
      });
      leaveEfficiency();
      offRiskScoreUpdate(handleRiskScoreUpdate);
      offEfficiencyUpdate(handleEfficiencyUpdate);
    };
  }, []);

  useEffect(() => {
    contracts.forEach(contract => {
      joinContract(contract.id);
    });
    return () => {
      contracts.forEach(contract => {
        leaveContract(contract.id);
      });
    };
  }, [contracts.map(c => c.id).join(',')]);

  async function loadContracts() {
    try {
      const [contractsData, warningsData, efficiencyData] = await Promise.all([
        contractApi.list(),
        warningRecordApi.list({ status: 'pending' }),
        approvalEfficiencyApi.getStats()
      ]);
      setContracts(contractsData);
      setWarningRecords(warningsData);
      setEfficiencyStats(efficiencyData);
    } catch (error) {
      console.error('加载合同列表失败:', error);
    } finally {
      setLoading(false);
    }
  }

  function isContractTimedOut(contractId: string): boolean {
    if (!efficiencyStats) return false;
    return efficiencyStats.timedOutContracts.some(tc => tc.contractId === contractId);
  }

  function getDaysRemaining(expiryDate?: string): number | null {
    if (!expiryDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  function getWarningForContract(contractId: string): WarningRecord | undefined {
    return warningRecords.find(w => w.contractId === contractId);
  }

  const filteredContracts = filter === 'all'
    ? contracts
    : contracts.filter(c => c.status === filter);

  const stats = {
    total: contracts.length,
    pending: contracts.filter(c => c.status === 'pending').length,
    approved: contracts.filter(c => c.status === 'approved').length,
    rejected: contracts.filter(c => c.status === 'rejected').length
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">加载中...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">合同列表</h1>
        <p className="text-gray-600">管理所有合同的比对和审批流程</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500 mt-1">全部合同</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-gray-500 mt-1">审批中</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="text-3xl font-bold text-green-600">{stats.approved}</div>
          <div className="text-sm text-gray-500 mt-1">已通过</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="text-3xl font-bold text-red-600">{stats.rejected}</div>
          <div className="text-sm text-gray-500 mt-1">已驳回</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {['all', 'draft', 'pending', 'approved', 'rejected'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {f === 'all' ? '全部' : statusConfig[f]?.label || f}
              </button>
            ))}
          </div>
          <Link
            to="/upload"
            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            <span className="mr-2">+</span> 新建合同
          </Link>
        </div>

        {filteredContracts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📄</div>
            <p className="text-gray-500 mb-4">暂无合同</p>
            <Link
              to="/upload"
              className="text-blue-500 hover:text-blue-600 font-medium"
            >
              上传第一份合同 →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredContracts.map(contract => {
              const isHighRisk = contract.riskScore > 60;
              return (
                <Link
                  key={contract.id}
                  to={`/contract/${contract.id}`}
                  className={`block px-6 py-4 transition-colors ${
                    isHighRisk ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 flex-wrap">
                        <h3 className="font-medium text-gray-900">{contract.title}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[contract.status]?.bg} ${statusConfig[contract.status]?.color}`}>
                          {statusConfig[contract.status]?.label}
                        </span>
                        <RiskScoreBadge score={contract.riskScore} size="sm" />
                        {contract.hasHighRisk && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            ⚠️ 高风险
                          </span>
                        )}
                        {isContractTimedOut(contract.id) && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 animate-pulse">
                            ⏰ 审批超时
                          </span>
                        )}
                        {getWarningForContract(contract.id) && (
                          <span
                            className="px-2.5 py-0.5 rounded-full text-xs font-medium animate-pulse"
                            style={{
                              backgroundColor: `${getWarningForContract(contract.id)!.warningColor}20`,
                              color: getWarningForContract(contract.id)!.warningColor
                            }}
                          >
                            ⚠️ {getDaysRemaining(contract.expiryDate)}天后到期
                          </span>
                        )}
                        <span className="text-xs text-gray-400">v{contract.version}</span>
                      </div>
                      <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500 flex-wrap">
                        <span>提交人：{contract.submittedByName}</span>
                        {contract.expiryDate && (
                          <>
                            <span>•</span>
                            <span className={getDaysRemaining(contract.expiryDate)! <= 7 ? 'text-red-600 font-medium' : ''}>
                              到期：{new Date(contract.expiryDate).toLocaleDateString('zh-CN')}
                              {getDaysRemaining(contract.expiryDate)! >= 0 && ` (剩余${getDaysRemaining(contract.expiryDate)}天)`}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        {contract.currentApproverRole && (
                          <>
                            <span>当前审批：{roleNames[contract.currentApproverRole]}</span>
                            <span>•</span>
                          </>
                        )}
                        <span>{new Date(contract.updatedAt).toLocaleString('zh-CN')}</span>
                      </div>
                    </div>
                    <div className="ml-4 text-gray-400">→</div>
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
