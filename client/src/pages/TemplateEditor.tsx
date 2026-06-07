import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { templateApi } from '../services/api';
import { initSocket, joinTemplate, leaveTemplate, onTemplateLockUpdate, offTemplateLockUpdate, onTemplateVersionUpdate, offTemplateVersionUpdate } from '../services/socket';
import { Clause, Template, TemplateEditLock, TemplateDraft } from '../types';
import { getCurrentUser } from '../store/auth';

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [template, setTemplate] = useState<Template | null>(null);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const [editLock, setEditLock] = useState<TemplateEditLock | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [hasLock, setHasLock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [versionDescription, setVersionDescription] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lockRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasChangedRef = useRef(false);

  initSocket();

  const handleLockUpdate = useCallback((data: { lock: TemplateEditLock | null; action: string }) => {
    setEditLock(data.lock);
    if (data.action === 'timeout' || data.action === 'released') {
      if (hasLock) {
        setHasLock(false);
        setIsReadOnly(true);
        alert('编辑锁已释放，您现在处于只读模式');
      } else if (user && !data.lock) {
        setIsReadOnly(false);
      }
    } else if (data.action === 'acquired' && data.lock) {
      if (data.lock.userId === user?.id) {
        setHasLock(true);
        setIsReadOnly(false);
      } else {
        setHasLock(false);
        setIsReadOnly(true);
      }
    }
  }, [hasLock, user]);

  const handleVersionUpdate = useCallback(() => {
    if (template && id) {
      loadTemplate();
    }
  }, [template, id]);

  useEffect(() => {
    if (id) {
      joinTemplate(id);
      onTemplateLockUpdate(handleLockUpdate);
      onTemplateVersionUpdate(handleVersionUpdate);
    }

    return () => {
      if (id) {
        leaveTemplate(id);
        offTemplateLockUpdate(handleLockUpdate);
        offTemplateVersionUpdate(handleVersionUpdate);
      }
    };
  }, [id, handleLockUpdate, handleVersionUpdate]);

  useEffect(() => {
    loadTemplate();

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
      if (lockRefreshTimerRef.current) {
        clearInterval(lockRefreshTimerRef.current);
      }
      if (hasLock && id && user && hasUnsavedChanges) {
        saveDraft();
        releaseLock();
      } else if (hasLock && id && user) {
        releaseLock();
      }
    };
  }, []);

  useEffect(() => {
    if (hasLock && id && user) {
      lockRefreshTimerRef.current = setInterval(() => {
        templateApi.refreshLock(id, user.id).catch(() => {
          setHasLock(false);
          setIsReadOnly(true);
        });
      }, 60000);
    }

    return () => {
      if (lockRefreshTimerRef.current) {
        clearInterval(lockRefreshTimerRef.current);
      }
    };
  }, [hasLock, id, user]);

  useEffect(() => {
    if (!isReadOnly && hasLock) {
      autoSaveTimerRef.current = setInterval(() => {
        if (hasChangedRef.current) {
          saveDraft();
        }
      }, 30000);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [isReadOnly, hasLock]);

  const loadTemplate = async () => {
    if (!id || !user) return;

    try {
      setLoading(true);
      const data = await templateApi.get(id);
      setTemplate(data);
      setTemplateName(data.name);

      const draft = await templateApi.getDraft(id);
      if (draft) {
        const useDraft = window.confirm('发现未发布的草稿，是否恢复草稿内容？');
        if (useDraft) {
          setClauses(draft.clauses);
          setTemplateName(draft.name);
        } else {
          setClauses(data.clauses);
          await templateApi.deleteDraft(id);
        }
      } else {
        setClauses(data.clauses);
      }

      if (data.editLock) {
        setEditLock(data.editLock);
        if (data.editLock.userId === user.id) {
          setHasLock(true);
          setIsReadOnly(false);
        } else {
          setHasLock(false);
          setIsReadOnly(true);
        }
      } else {
        setEditLock(null);
        setIsReadOnly(false);
      }
    } catch (error) {
      console.error('加载模板失败:', error);
      alert('加载模板失败');
    } finally {
      setLoading(false);
    }
  };

  const acquireLock = async () => {
    if (!id || !user) return;

    try {
      const lock = await templateApi.acquireLock(id, user.id, user.name);
      setEditLock(lock);
      setHasLock(true);
      setIsReadOnly(false);
    } catch (error: any) {
      if (error.response?.status === 409) {
        alert(error.response.data.error);
      } else {
        console.error('获取编辑锁失败:', error);
        alert('获取编辑锁失败');
      }
    }
  };

  const releaseLock = async () => {
    if (!id || !user) return;

    try {
      await templateApi.releaseLock(id, user.id);
      setHasLock(false);
      setEditLock(null);
    } catch (error) {
      console.error('释放编辑锁失败:', error);
    }
  };

  const saveDraft = async () => {
    if (!id || !user || !hasLock) return;

    try {
      setSaving(true);
      await templateApi.saveDraft(id, {
        name: templateName,
        clauses,
        savedBy: user.id,
        savedByName: user.name
      });
      setLastSavedAt(new Date());
      hasChangedRef.current = false;
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('保存草稿失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const publishVersion = async () => {
    if (!id || !user || !hasLock) return;

    try {
      setPublishing(true);
      await templateApi.publishVersion(id, {
        name: templateName,
        clauses,
        description: versionDescription.trim() || undefined,
        createdBy: user.id,
        createdByName: user.name
      });

      setShowPublishModal(false);
      setVersionDescription('');
      hasChangedRef.current = false;
      setHasUnsavedChanges(false);
      alert('版本发布成功！');
      navigate(`/templates/${id}/versions`);
    } catch (error: any) {
      if (error.response?.status === 409) {
        alert(error.response.data.error);
      } else {
        console.error('发布版本失败:', error);
        alert('发布版本失败');
      }
    } finally {
      setPublishing(false);
    }
  };

  const renumberClauses = (clauseList: Clause[]): Clause[] => {
    return clauseList.map((clause, index) => ({
      ...clause,
      number: String(index + 1)
    }));
  };

  const addClause = () => {
    if (isReadOnly) return;

    const newClause: Clause = {
      id: crypto.randomUUID(),
      number: String(clauses.length + 1),
      title: `第${clauses.length + 1}条 新条款`,
      content: '请在此输入条款内容...'
    };

    const newClauses = [...clauses, newClause];
    setClauses(newClauses);
    setSelectedClauseId(newClause.id);
    hasChangedRef.current = true;
    setHasUnsavedChanges(true);
  };

  const deleteClause = (clauseId: string) => {
    if (isReadOnly) return;

    if (!confirm('确定要删除此条款吗？')) return;

    const newClauses = clauses.filter(c => c.id !== clauseId);
    const renumberedClauses = renumberClauses(newClauses);
    setClauses(renumberedClauses);

    if (selectedClauseId === clauseId) {
      setSelectedClauseId(renumberedClauses.length > 0 ? renumberedClauses[0].id : null);
    }

    hasChangedRef.current = true;
    setHasUnsavedChanges(true);
  };

  const updateClause = (clauseId: string, updates: Partial<Clause>) => {
    if (isReadOnly) return;

    const newClauses = clauses.map(c =>
      c.id === clauseId ? { ...c, ...updates } : c
    );
    setClauses(newClauses);
    hasChangedRef.current = true;
    setHasUnsavedChanges(true);
  };

  const handleDragStart = (index: number) => {
    if (isReadOnly) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (isReadOnly || draggedIndex === null) return;

    const newClauses = [...clauses];
    const draggedItem = newClauses[draggedIndex];
    newClauses.splice(draggedIndex, 1);
    newClauses.splice(index, 0, draggedItem);

    const renumberedClauses = renumberClauses(newClauses);
    setClauses(renumberedClauses);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    if (draggedIndex !== null) {
      hasChangedRef.current = true;
      setHasUnsavedChanges(true);
    }
  };

  const selectedClause = clauses.find(c => c.id === selectedClauseId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">模板不存在</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <Link to="/templates" className="text-gray-500 hover:text-gray-700">
            ← 返回模板列表
          </Link>
          <h2 className="text-xl font-bold text-gray-900">
            编辑模板：{templateName}
          </h2>
          {hasUnsavedChanges && (
            <span className="text-yellow-600 text-sm">• 有未保存的更改</span>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {isReadOnly && !hasLock ? (
            <>
              <div className="text-orange-600 text-sm">
                {editLock ? `${editLock.userName} 正在编辑` : '点击获取编辑权限'}
              </div>
              <button
                onClick={acquireLock}
                disabled={!!editLock}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                获取编辑权限
              </button>
            </>
          ) : (
            <>
              <div className="text-green-600 text-sm flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                您正在编辑
              </div>
              {saving ? (
                <span className="text-gray-500 text-sm">保存中...</span>
              ) : lastSavedAt ? (
                <span className="text-gray-500 text-sm">
                  上次自动保存：{lastSavedAt.toLocaleTimeString('zh-CN')}
                </span>
              ) : null}
              <button
                onClick={saveDraft}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                保存草稿
              </button>
              <button
                onClick={() => setShowPublishModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                发布新版本
              </button>
            </>
          )}
          <Link
            to={`/templates/${id}/versions`}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            版本历史
          </Link>
        </div>
      </div>

      {isReadOnly && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-4 text-yellow-800 text-sm">
          ⚠️ 当前处于只读模式。
          {editLock
            ? ` ${editLock.userName} 正在编辑此模板，请稍后再试。`
            : ' 点击"获取编辑权限"按钮开始编辑。'}
        </div>
      )}

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="w-80 bg-white rounded-lg shadow flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">条款列表</h3>
            {!isReadOnly && (
              <button
                onClick={addClause}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                + 新增条款
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {clauses.map((clause, index) => (
              <div
                key={clause.id}
                draggable={!isReadOnly}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => setSelectedClauseId(clause.id)}
                className={`p-3 rounded-lg mb-2 cursor-pointer transition-all ${
                  selectedClauseId === clause.id
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                } ${draggedIndex === index ? 'opacity-50' : ''} ${
                  isReadOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">
                      {clause.number}. {clause.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {clause.content}
                    </div>
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteClause(clause.id);
                      }}
                      className="ml-2 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="删除条款"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
            {clauses.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                暂无条款，点击上方按钮添加
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-lg shadow flex flex-col">
          {selectedClause ? (
            <div className="flex-1 flex flex-col p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  条款编号
                </label>
                <input
                  type="text"
                  value={selectedClause.number}
                  onChange={(e) => updateClause(selectedClause.id, { number: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  条款标题
                </label>
                <input
                  type="text"
                  value={selectedClause.title}
                  onChange={(e) => updateClause(selectedClause.id, { title: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  条款内容
                </label>
                <textarea
                  value={selectedClause.content}
                  onChange={(e) => updateClause(selectedClause.id, { content: e.target.value })}
                  disabled={isReadOnly}
                  className="flex-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 resize-none"
                  placeholder="请输入条款内容..."
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              请从左侧选择一个条款进行编辑，或点击"新增条款"添加新条款
            </div>
          )}
        </div>
      </div>

      {showPublishModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              发布新版本
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                模板名称
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                版本说明（可选）
              </label>
              <textarea
                value={versionDescription}
                onChange={(e) => setVersionDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="描述此版本的主要变更..."
              />
            </div>
            <div className="mb-4 text-sm text-gray-600">
              将生成新版本号：v{(template.latestVersion || 0) + 1}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPublishModal(false);
                  setVersionDescription('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={publishVersion}
                disabled={publishing || !templateName.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {publishing ? '发布中...' : '发布'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
