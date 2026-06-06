import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { WarningRecord, WarningStats, WarningLevel, WarningRecordStatus, WarningRule } from '../types';
import { warningRecordApi, warningStatsApi, warningRuleApi } from '../services/api';
import { initSocket, joinWarning, leaveWarning, onWarningStats, onWarningRecords, offWarningStats, offWarningRecords } from '../services/socket';
import { getCurrentUser } from '../store/auth';

const levelNames: Record<WarningLevel, string> = {
  yellow: '黄色预警',
  orange: '橙色预警',
  red: '红色预警'
};

const levelColors: Record<WarningLevel, { bg: string; text: string; border: string; dot: string }> = {
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', dot: 'bg-yellow-400' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', dot: 'bg-orange-400' },
  red: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', dot: 'bg-red-400' }
};

const statusNames: Record<WarningRecordStatus, string> = {
  pending: '待处理',
  handled: '已处理',
  renewed: '已续签',
  terminated: '已终止'
};

export default function WarningDashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [stats, setStats] = useState<WarningStats | null>(null);
  const [records, setRecords] = useState<WarningRecord[]>([]);
  const [filterLevel, setFilterLevel] = useState<WarningLevel | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<WarningRecordStatus | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [rules, setRules] = useState<WarningRule[]>([]);
  const [newRuleDays, setNewRuleDays] = useState('');
  const [newRuleLevel, setNewRuleLevel] = useState<WarningLevel>('yellow');
  const [newRuleColor, setNewRuleColor] = useState('#fbbf24');

  const handleStatsUpdate = useCallback((newStats: WarningStats) => {
    setStats(newStats);
  }, []);

  const handleRecordsUpdate = useCallback((newRecords: WarningRecord[]) => {
    setRecords(newRecords);
    setLoading(false);
  }, []);

  useEffect(() => {
    initSocket();
    loadData();
    joinWarning();
    onWarningStats(handleStatsUpdate);
    onWarningRecords(handleRecordsUpdate);

    return () => {
      leaveWarning();
      offWarningStats(handleStatsUpdate);
      offWarningRecords(handleRecordsUpdate);
    };
  }, [handleStatsUpdate, handleRecordsUpdate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, recordsData, rulesData] = await Promise.all([
        warningStatsApi.get(),
        warningRecordApi.list(),
        warningRuleApi.list()
      ]);
      setStats(statsData);
      setRecords(recordsData);
      setRules(rulesData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter(r => {
    if (filterLevel !== 'all' && r.warningLevel !== filterLevel) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  const groupedRecords = filteredRecords.reduce((acc, record) => {
    if (!acc[record.warningLevel]) {
      acc[record.warningLevel] = [];
    }
    acc[record.warningLevel].push(record);
    return acc;
  }, {} as Record<WarningLevel, WarningRecord[]>);

  const sortedLevels = (['red', 'orange', 'yellow'] as WarningLevel[]).filter(
    level => groupedRecords[level] && groupedRecords[level].length > 0
  );

  const handleMarkHandled = async (recordId: string) => {
    if (!user) return;
    try {
      await warningRecordApi.handle(recordId, 'handled', user.id);
    } catch (error) {
      console.error('标记处理失败:', error);
    }
  };

  const handleMarkTerminated = async (recordId: string) => {
    if (!user) return;
    try {
      await warningRecordApi.handle(recordId, 'terminate', user.id);
    } catch (error) {
      console.error('标记终止失败:', error);
    }
  };

  const handleRenew = async (recordId: string) => {
    if (!user) return;
    try {
      const result = await warningRecordApi.renew(recordId, user.id, user.name);
      if (result.success && result.contract) {
        navigate(`/upload/${result.contract.parentId}`);
      }
    } catch (error) {
      console.error('发起续签失败:', error);
    }
  };

  const handleAddRule = async () => {
    if (!newRuleDays) return;
    try {
      await warningRuleApi.create(parseInt(newRuleDays), newRuleLevel, newRuleColor);
      setNewRuleDays('');
      const rulesData = await warningRuleApi.list();
      setRules(rulesData);
    } catch (error) {
      console.error('添加规则失败:', error);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await warningRuleApi.delete(ruleId);
      const rulesData = await warningRuleApi.list();
      setRules(rulesData);
    } catch (error) {
      console.error('删除规则失败:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">合同到期预警看板</h1>
          <p className="text-gray-500 mt-1">实时监控即将到期的合同，及时处理续签或终止</p>
        </div>
        <button
          onClick={() => setShowRules(!showRules)}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
        >
          <span>⚙️</span>
          <span>预警规则配置</span>
        </button>
      </div>

      {showRules && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">预警规则配置</h3>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">提前天数</label>
                <input
                  type="number"
                  value={newRuleDays}
                  onChange={(e) => setNewRuleDays(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="如：60"
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">预警级别</label>
                <select
                  value={newRuleLevel}
                  onChange={(e) => setNewRuleLevel(e.target.value as WarningLevel)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="yellow">黄色预警</option>
                  <option value="orange">橙色预警</option>
                  <option value="red">红色预警</option>
                </select>
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">标识颜色</label>
                <input
                  type="color"
                  value={newRuleColor}
                  onChange={(e) => setNewRuleColor(e.target.value)}
                  className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAddRule}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  添加规则
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: rule.color }}
                    ></div>
                    <span className="text-gray-900">
                      提前 <span className="font-semibold">{rule.days}</span> 天 - {levelNames[rule.level as WarningLevel]}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">本月到期</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.thisMonthExpiring}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📅</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">已处理</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{stats.handled}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">待处理</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
            </div>
            <div className="mt-4 flex items-center space-x-4 text-xs">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                <span className="text-gray-600">黄 {stats.byLevel.yellow}</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                <span className="text-gray-600">橙 {stats.byLevel.orange}</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                <span className="text-gray-600">红 {stats.byLevel.red}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">预警级别:</span>
            <div className="flex space-x-1">
              <button
                onClick={() => setFilterLevel('all')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filterLevel === 'all'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                全部
              </button>
              {(['red', 'orange', 'yellow'] as WarningLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setFilterLevel(level)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center space-x-1 ${
                    filterLevel === level
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${levelColors[level].dot}`}></div>
                  <span>{levelNames[level]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">状态:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as WarningRecordStatus | 'all')}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部</option>
              <option value="pending">待处理</option>
              <option value="handled">已处理</option>
              <option value="renewed">已续签</option>
              <option value="terminated">已终止</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {sortedLevels.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <p className="text-gray-500">暂无符合条件的预警记录</p>
          </div>
        ) : (
          sortedLevels.map((level) => (
            <div key={level} className={`${levelColors[level].bg} rounded-xl border ${levelColors[level].border} p-6`}>
              <div className="flex items-center space-x-3 mb-4">
                <div className={`w-3 h-3 rounded-full ${levelColors[level].dot}`}></div>
                <h2 className={`text-lg font-semibold ${levelColors[level].text}`}>
                  {levelNames[level]}
                  <span className="ml-2 text-sm font-normal opacity-75">
                    ({groupedRecords[level].length}条)
                  </span>
                </h2>
              </div>
              <div className="space-y-3">
                {groupedRecords[level].map((record) => (
                  <div
                    key={record.id}
                    className="bg-white rounded-lg p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-medium text-gray-900">{record.contractTitle}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          record.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : record.status === 'renewed'
                            ? 'bg-green-100 text-green-700'
                            : record.status === 'terminated'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {statusNames[record.status]}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <span>📅</span>
                          <span>到期日期: {formatDate(record.expiryDate)}</span>
                        </div>
                        <div className={`flex items-center space-x-1 font-medium ${
                          record.daysRemaining <= 7 ? 'text-red-600' :
                          record.daysRemaining <= 30 ? 'text-orange-600' :
                          'text-yellow-600'
                        }`}>
                          <span>⏰</span>
                          <span>剩余 {record.daysRemaining} 天</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => navigate(`/contract/${record.contractId}`)}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        查看详情
                      </button>
                      {record.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleMarkHandled(record.id)}
                            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            标记已处理
                          </button>
                          <button
                            onClick={() => handleMarkTerminated(record.id)}
                            className="px-3 py-1.5 text-sm bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors"
                          >
                            终止合同
                          </button>
                          <button
                            onClick={() => handleRenew(record.id)}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            发起续签
                          </button>
                        </>
                      )}
                      {record.status === 'renewed' && record.renewedContractId && (
                        <button
                          onClick={() => navigate(`/contract/${record.renewedContractId}`)}
                          className="px-3 py-1.5 text-sm bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors"
                        >
                          查看续签合同
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
