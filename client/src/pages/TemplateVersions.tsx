import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { templateApi } from '../services/api';
import { TemplateVersion, ClauseDiff, TemplateVersionCompareResult } from '../types';
import { getCurrentUser } from '../store/auth';
import DiffViewer from '../components/DiffViewer';

export default function TemplateVersions() {
  const { id } = useParams<{ id: string }>();
  const user = getCurrentUser();

  const [template, setTemplate] = useState<{ name: string; latestVersion: number } | null>(null);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [fromVersion, setFromVersion] = useState<number | null>(null);
  const [toVersion, setToVersion] = useState<number | null>(null);
  const [compareResult, setCompareResult] = useState<TemplateVersionCompareResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  useEffect(() => {
    loadTemplateAndVersions();
  }, [id]);

  const loadTemplateAndVersions = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [templateData, versionsData] = await Promise.all([
        templateApi.get(id),
        templateApi.getVersions(id)
      ]);
      setTemplate(templateData);
      setVersions(versionsData);
    } catch (error) {
      console.error('加载版本历史失败:', error);
      alert('加载版本历史失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!id || fromVersion === null || toVersion === null) return;

    try {
      setComparing(true);
      const result = await templateApi.compareVersions(id, fromVersion, toVersion);
      setCompareResult(result);
    } catch (error) {
      console.error('版本比对失败:', error);
      alert('版本比对失败');
    } finally {
      setComparing(false);
    }
  };

  const handleRollback = async (versionNumber: number) => {
    if (!id || !user) return;

    if (!confirm(`确定要回滚到版本 v${versionNumber} 吗？这将创建一个新版本。`)) {
      return;
    }

    try {
      setRollingBack(String(versionNumber));
      await templateApi.rollbackVersion(id, versionNumber, user.id, user.name);
      alert('回滚成功，已创建新版本！');
      loadTemplateAndVersions();
      setCompareMode(false);
      setCompareResult(null);
    } catch (error: any) {
      if (error.response?.status === 409) {
        alert(error.response.data.error);
      } else {
        console.error('回滚失败:', error);
        alert('回滚失败');
      }
    } finally {
      setRollingBack(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDiffSummary = (diffs: ClauseDiff[]) => {
    const modified = diffs.filter(d => d.hasDiff && !d.isNew && !d.isMissing).length;
    const added = diffs.filter(d => d.isNew).length;
    const removed = diffs.filter(d => d.isMissing).length;
    return { modified, added, removed };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <Link to="/templates" className="text-gray-500 hover:text-gray-700">
            ← 返回模板列表
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">
            {template?.name} - 版本历史
          </h2>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            to={`/templates/${id}/edit`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            编辑模板
          </Link>
          <button
            onClick={() => {
              setCompareMode(!compareMode);
              setCompareResult(null);
              setFromVersion(null);
              setToVersion(null);
            }}
            className={`px-4 py-2 rounded-lg transition-colors ${
              compareMode
                ? 'bg-gray-600 text-white hover:bg-gray-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {compareMode ? '取消比对' : '版本比对'}
          </button>
        </div>
      </div>

      {compareMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-3">选择要比对的版本</h3>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">从版本：</label>
              <select
                value={fromVersion ?? ''}
                onChange={(e) => setFromVersion(e.target.value ? parseInt(e.target.value) : null)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">请选择</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.versionNumber}>
                    v{v.versionNumber}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-gray-500">→</span>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">到版本：</label>
              <select
                value={toVersion ?? ''}
                onChange={(e) => setToVersion(e.target.value ? parseInt(e.target.value) : null)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">请选择</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.versionNumber}>
                    v{v.versionNumber}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCompare}
              disabled={fromVersion === null || toVersion === null || fromVersion === toVersion || comparing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {comparing ? '比对中...' : '开始比对'}
            </button>
          </div>
        </div>
      )}

      {compareResult && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              版本比对结果：v{compareResult.fromVersion.versionNumber} → v{compareResult.toVersion.versionNumber}
            </h3>
            <div className="flex gap-2 text-sm">
              {(() => {
                const summary = getDiffSummary(compareResult.diffs);
                return (
                  <>
                    {summary.modified > 0 && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                        修改 {summary.modified} 处
                      </span>
                    )}
                    {summary.added > 0 && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                        新增 {summary.added} 处
                      </span>
                    )}
                    {summary.removed > 0 && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                        删除 {summary.removed} 处
                      </span>
                    )}
                    {summary.modified === 0 && summary.added === 0 && summary.removed === 0 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">
                        无差异
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {compareResult.diffs.map((diff, index) => (
              <div
                key={index}
                className={`border rounded-lg overflow-hidden ${
                  diff.hasDiff ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                }`}
              >
                <div className="px-4 py-2 bg-gray-100 border-b flex justify-between items-center">
                  <span className="font-medium text-gray-900">
                    第 {diff.clauseNumber} 条：{diff.clauseTitle}
                  </span>
                  <span className="flex gap-2">
                    {diff.isNew && (
                      <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded">
                        新增
                      </span>
                    )}
                    {diff.isMissing && (
                      <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded">
                        删除
                      </span>
                    )}
                    {diff.hasDiff && !diff.isNew && !diff.isMissing && (
                      <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs rounded">
                        修改
                      </span>
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 p-4">
                  <div>
                    <div className="text-sm text-gray-500 mb-2 font-medium">
                      v{compareResult.fromVersion.versionNumber}
                    </div>
                    <div className="bg-white rounded border p-3 text-sm">
                      <DiffViewer diff={diff.diff} side="left" />
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-2 font-medium">
                      v{compareResult.toVersion.versionNumber}
                    </div>
                    <div className="bg-white rounded border p-3 text-sm">
                      <DiffViewer diff={diff.diff} side="right" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                版本号
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                模板名称
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                条款数
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                版本说明
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                创建人
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                创建时间
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {versions.map((version, index) => (
              <tr
                key={version.id}
                className={`hover:bg-gray-50 ${
                  index === 0 ? 'bg-green-50' : ''
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-sm font-semibold text-blue-600">
                      v{version.versionNumber}
                    </span>
                    {index === 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                        最新
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {version.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {version.clauses.length} 条
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                  {version.description || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {version.createdByName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(version.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  {compareMode && (
                    <>
                      <button
                        onClick={() => {
                          if (fromVersion === null) {
                            setFromVersion(version.versionNumber);
                          } else if (toVersion === null && fromVersion !== version.versionNumber) {
                            setToVersion(version.versionNumber);
                          }
                        }}
                        disabled={
                          (fromVersion !== null && toVersion !== null) ||
                          fromVersion === version.versionNumber
                        }
                        className="text-blue-600 hover:text-blue-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                        选为{fromVersion === null ? '起始版本' : '目标版本'}
                      </button>
                    </>
                  )}
                  {!compareMode && index !== 0 && (
                    <button
                      onClick={() => handleRollback(version.versionNumber)}
                      disabled={rollingBack === String(version.versionNumber)}
                      className="text-orange-600 hover:text-orange-900 disabled:opacity-50"
                    >
                      {rollingBack === String(version.versionNumber) ? '回滚中...' : '回滚到此版本'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {versions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            暂无版本记录
          </div>
        )}
      </div>
    </div>
  );
}
