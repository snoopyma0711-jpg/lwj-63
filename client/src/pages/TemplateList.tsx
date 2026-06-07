import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { templateApi } from '../services/api';
import { TemplateWithLock } from '../types';
import { getCurrentUser } from '../store/auth';

export default function TemplateList() {
  const [templates, setTemplates] = useState<TemplateWithLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const user = getCurrentUser();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await templateApi.listWithLock();
      setTemplates(data);
    } catch (error) {
      console.error('加载模板列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim() || !user) return;

    try {
      const defaultClauses = [
        {
          id: crypto.randomUUID(),
          number: '1',
          title: '第一条 总则',
          content: '请在此输入条款内容...'
        }
      ];

      await templateApi.create(
        newTemplateName.trim(),
        defaultClauses,
        user.id,
        user.name
      );

      setNewTemplateName('');
      setShowCreateModal(false);
      loadTemplates();
    } catch (error) {
      console.error('创建模板失败:', error);
      alert('创建模板失败');
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
        <h2 className="text-2xl font-bold text-gray-900">合同模板管理</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <span>+</span>
          <span>新建模板</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                模板名称
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                条款数量
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                最新版本
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                编辑状态
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
            {templates.map((template) => (
              <tr key={template.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {template.name}
                  </div>
                  {template.hasDraft && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                      有未发布草稿
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {template.clauses.length} 条
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {template.latestVersion ? `v${template.latestVersion}` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {template.editLock ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      <span className="w-2 h-2 bg-orange-500 rounded-full mr-1.5 animate-pulse"></span>
                      {template.editLock.userName} 正在编辑
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>
                      可编辑
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(template.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <Link
                    to={`/templates/${template.id}/edit`}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    编辑
                  </Link>
                  <Link
                    to={`/templates/${template.id}/versions`}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    版本历史
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {templates.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            暂无模板，点击上方按钮创建
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              新建模板
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                模板名称
              </label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="请输入模板名称"
                autoFocus
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewTemplateName('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={!newTemplateName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
