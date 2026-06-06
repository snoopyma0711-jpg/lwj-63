import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { approvalEfficiencyApi, approvalTimeoutConfigApi } from '../services/api';
import {
  initSocket,
  joinEfficiency,
  leaveEfficiency,
  onEfficiencyUpdate,
  offEfficiencyUpdate
} from '../services/socket';
import { ApprovalEfficiencyStats, RoleApprovalStats, ApprovalRole } from '../types';
import RiskScoreBadge from '../components/RiskScoreBadge';

const roleNames: Record<ApprovalRole, string> = {
  specialist: '法务专员',
  manager: '法务经理',
  director: '法务总监'
};

const roleColors: Record<ApprovalRole, string> = {
  specialist: '#3b82f6',
  manager: '#8b5cf6',
  director: '#ec4899'
};

function formatDuration(ms: number): string {
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

function formatDurationShort(ms: number): string {
  if (ms < 0) ms = 0;
  const minutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}天${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h${minutes % 60}m`;
  } else {
    return `${minutes}m`;
  }
}

export default function ApprovalEfficiency() {
  const [stats, setStats] = useState<ApprovalEfficiencyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<ApprovalRole | null>(null);
  const [configValues, setConfigValues] = useState<Record<ApprovalRole, number>>({
    specialist: 24,
    manager: 24,
    director: 24
  });

  const handleEfficiencyUpdate = useCallback((newStats: ApprovalEfficiencyStats) => {
    setStats(newStats);
    setLoading(false);
  }, []);

  useEffect(() => {
    initSocket();
    loadData();
    joinEfficiency();
    onEfficiencyUpdate(handleEfficiencyUpdate);

    return () => {
      leaveEfficiency();
      offEfficiencyUpdate(handleEfficiencyUpdate);
    };
  }, [handleEfficiencyUpdate]);

  async function loadData() {
    try {
      const [statsData, configData] = await Promise.all([
        approvalEfficiencyApi.getStats(),
        approvalTimeoutConfigApi.list()
      ]);
      setStats(statsData);
      const configMap: Record<ApprovalRole, number> = { specialist: 24, manager: 24, director: 24 };
      configData.forEach(c => {
        configMap[c.role] = c.thresholdHours;
      });
      setConfigValues(configMap);
    } catch (error) {
      console.error('加载效率统计失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig(role: ApprovalRole) {
    try {
      await approvalTimeoutConfigApi.update(role, configValues[role]);
      setEditingRole(null);
      await loadData();
    } catch (error) {
      console.error('保存配置失败:', error);
      alert('保存失败，请重试');
    }
  }

  function getMaxDuration(stats: RoleApprovalStats[]): number {
    const max = Math.max(...stats.map(s => s.averageDurationMs));
    return max > 0 ? max : 1;
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">加载中...</div>;
  }

  const maxDuration = stats ? getMaxDuration(stats.byRole) : 1;

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">审批效率看板</h1>
            <p className="text-gray-600">实时监控各角色审批效率和超时预警</p>
          </div>
          {stats && (
            <div className="text-sm text-gray-400">
              最后更新：{new Date(stats.lastUpdated).toLocaleString('zh-CN')}
              <span className="ml-2 inline-flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></span>
                实时更新中
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-blue-600">
                {stats?.timedOutContracts.length || 0}
              </div>
              <div className="text-sm text-gray-500 mt-1">超时未处理合同</div>
            </div>
            <div className="text-4xl">⏰</div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-purple-600">
                {stats?.weeklyStats.totalProcessed || 0}
              </div>
              <div className="text-sm text-gray-500 mt-1">本周处理数</div>
            </div>
            <div className="text-4xl">📊</div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-green-600">
                {stats?.weeklyStats.passRate || 0}%
              </div>
              <div className="text-sm text-gray-500 mt-1">本周通过率</div>
            </div>
            <div className="text-4xl">✅</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-medium text-gray-900">📈 各角色平均审批耗时</h3>
            <span className="text-sm text-gray-400">
              点击角色右侧的 ✏️ 按钮可调整超时阈值
            </span>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              {stats?.byRole.map(roleStat => (
                <div key={roleStat.role} className="space-y-2">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: roleColors[roleStat.role] }}
                        />
                        <span className="font-medium text-gray-700">{roleStat.roleName}</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        {editingRole === roleStat.role ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="1"
                              value={configValues[roleStat.role]}
                              onChange={e => setConfigValues({
                                ...configValues,
                                [roleStat.role]: parseInt(e.target.value) || 1
                              })}
                              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                            <span className="text-sm text-gray-500">小时</span>
                            <button
                              onClick={() => handleSaveConfig(roleStat.role)}
                              className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                            >
                              ✓ 保存
                            </button>
                            <button
                              onClick={() => setEditingRole(null)}
                              className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500">
                              超时阈值：{configValues[roleStat.role]}小时
                            </span>
                            <button
                              onClick={() => {
                                setEditingRole(roleStat.role);
                              }}
                              className="text-gray-400 hover:text-blue-500 transition-colors"
                              title="编辑超时阈值"
                            >
                              ✏️
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 h-10 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                        style={{
                          width: `${(roleStat.averageDurationMs / maxDuration) * 100}%`,
                          backgroundColor: roleColors[roleStat.role],
                          minWidth: roleStat.averageDurationMs > 0 ? '40px' : '0'
                        }}
                      >
                        {roleStat.averageDurationMs > 0 && (
                          <span className="text-white text-xs font-medium whitespace-nowrap">
                            {formatDurationShort(roleStat.averageDurationMs)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-32 text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {formatDuration(roleStat.averageDurationMs)}
                      </div>
                      <div className="text-xs text-gray-400">
                        已处理 {roleStat.totalProcessed} 份
                        {roleStat.timedOutCount > 0 && (
                          <span className="text-red-500 ml-1">
                            · {roleStat.timedOutCount} 份超时
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-medium text-gray-900">⏰ 超时未处理合同</h3>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!stats?.timedOutContracts.length ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">🎉</div>
                <p>暂无超时未处理合同</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {stats.timedOutContracts.map(contract => (
                  <Link
                    key={contract.contractId}
                    to={`/contract/${contract.contractId}`}
                    className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <h4 className="font-medium text-gray-900 truncate">{contract.contractTitle}</h4>
                          <RiskScoreBadge score={contract.riskScore} size="sm" />
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full animate-pulse">
                            已超时 {formatDurationShort(contract.timeoutDurationMs)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center space-x-3 text-sm text-gray-500">
                          <span>当前审批：{roleNames[contract.currentRole]}</span>
                          <span>•</span>
                          <span>提交时间：{new Date(contract.submittedAt).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </div>
                      <div className="text-gray-400 ml-4">→</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden xl:col-span-2">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-medium text-gray-900">📊 本周审批通过率</h3>
            {stats && (
              <span className="text-sm text-gray-400">
                {new Date(stats.weeklyStats.weekStart).toLocaleDateString('zh-CN')} - {new Date(stats.weeklyStats.weekEnd).toLocaleDateString('zh-CN')}
              </span>
            )}
          </div>
          <div className="p-6">
            {stats && (
              <div className="flex items-center space-x-8">
                <div className="flex-shrink-0 w-32 h-32 relative">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="12"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke={stats.weeklyStats.passRate >= 80 ? '#10b981' : stats.weeklyStats.passRate >= 50 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${(stats.weeklyStats.passRate / 100) * 352} 352`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-2xl font-bold ${
                      stats.weeklyStats.passRate >= 80 ? 'text-green-600' :
                      stats.weeklyStats.passRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {stats.weeklyStats.passRate}%
                    </span>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gray-900">
                      {stats.weeklyStats.totalProcessed}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">总处理数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-green-600">
                      {stats.weeklyStats.approvedCount}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">通过数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-red-600">
                      {stats.weeklyStats.rejectedCount}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">驳回数</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
