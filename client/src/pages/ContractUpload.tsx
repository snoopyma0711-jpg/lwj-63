import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { templateApi, contractApi } from '../services/api';
import { getCurrentUser } from '../store/auth';
import { Template } from '../types';

const sampleContract = `1、合同双方
甲方：某某科技有限公司，统一社会信用代码：911100001234567890。
乙方：客户公司名称，统一社会信用代码：911100000987654321。
双方经友好协商，达成如下协议。

2、服务内容
甲方同意按照本合同约定向乙方提供专业咨询服务，服务范围详见附件一。
乙方应配合甲方提供必要的资料和协助，并按约定支付费用。

3、合同期限
本合同有效期自2024年1月1日起至2024年12月31日止，共计12个月。
合同期满前30日，如双方均未提出终止，则自动延续一年。

4、费用及支付
本合同总费用为人民币50万元整（￥500000）。
乙方应在合同签订后15个工作日内支付50%预付款，剩余款项在服务验收合格后15个工作日内付清。

5、保密条款
双方应对在合作过程中知悉的对方商业秘密、技术信息以及其他未公开的信息承担保密义务。
保密义务在合同终止后五年内仍然有效。

6、违约责任
任何一方违反本合同约定，应向守约方支付合同总金额30%的违约金。

7、争议解决
因本合同引起的争议，双方应友好协商解决；协商不成的，任何一方有权向乙方所在地有管辖权的人民法院提起诉讼。

8、其他约定
本合同一式两份，甲乙双方各执一份，具有同等法律效力。
本合同自双方签字盖章之日起生效。

9、知识产权
甲方在服务过程中产生的所有知识产权归甲方独家所有。
乙方仅享有在本合同目的范围内的使用权。`;

export default function ContractUpload() {
  const { parentId } = useParams();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [title, setTitle] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [previewDiffs, setPreviewDiffs] = useState<any[] | null>(null);

  const user = getCurrentUser();

  useEffect(() => {
    loadTemplates();
    if (parentId) {
      loadParentContract();
    }
  }, [parentId]);

  async function loadTemplates() {
    try {
      const data = await templateApi.list();
      setTemplates(data);
      if (data.length > 0) {
        setSelectedTemplate(data[0].id);
      }
    } catch (error) {
      console.error('加载模板失败:', error);
    }
  }

  async function loadParentContract() {
    if (!parentId) return;
    try {
      const contract = await contractApi.get(parentId);
      setTitle(`${contract.title}（修订版）`);
      setSelectedTemplate(contract.templateId);
      setRawContent(contract.rawContent);
    } catch (error) {
      console.error('加载原始合同失败:', error);
    }
  }

  async function handlePreview() {
    if (!selectedTemplate || !rawContent.trim()) {
      alert('请选择模板并输入合同内容');
      return;
    }
    setComparing(true);
    try {
      const result = await contractApi.compare(selectedTemplate, rawContent);
      setPreviewDiffs(result.diffs);
    } catch (error) {
      console.error('比对失败:', error);
      alert('比对失败，请重试');
    } finally {
      setComparing(false);
    }
  }

  async function handleSubmit() {
    if (!selectedTemplate || !rawContent.trim() || !title.trim()) {
      alert('请填写完整信息');
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      const contract = await contractApi.create({
        title,
        templateId: selectedTemplate,
        rawContent,
        submittedBy: user.id,
        submittedByName: user.name,
        parentId
      });
      navigate(`/contract/${contract.id}`);
    } catch (error) {
      console.error('创建合同失败:', error);
      alert('创建合同失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  const loadSample = () => {
    setTitle('2024年度技术服务合同');
    setRawContent(sampleContract);
  };

  const diffCount = previewDiffs?.filter(d => d.hasDiff).length || 0;
  const newClauseCount = previewDiffs?.filter(d => d.isNew).length || 0;
  const missingCount = previewDiffs?.filter(d => d.isMissing).length || 0;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {parentId ? '重新提交合同' : '上传新合同'}
        </h1>
        <p className="text-gray-600">
          {parentId ? '修改后重新提交审批' : '粘贴合同文本，系统将自动与模板比对'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              合同标题
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="请输入合同标题"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择模板
            </label>
            <select
              value={selectedTemplate}
              onChange={e => setSelectedTemplate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                合同文本
              </label>
              <button
                onClick={loadSample}
                className="text-sm text-blue-500 hover:text-blue-600"
              >
                加载示例
              </button>
            </div>
            <textarea
              value={rawContent}
              onChange={e => setRawContent(e.target.value)}
              placeholder={`请粘贴合同文本，格式示例：\n1、条款标题\n条款内容...\n\n2、条款标题\n条款内容...`}
              rows={20}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm scrollbar-thin"
            />
            <div className="mt-2 text-sm text-gray-500">
              提示：条款编号格式如 "1、"、"1.1、"、"2.1.3 " 等均可自动识别
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 sticky top-6">
            <h3 className="font-medium text-gray-900 mb-4">操作</h3>
            <div className="space-y-3">
              <button
                onClick={handlePreview}
                disabled={comparing}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
              >
                {comparing ? '比对中...' : '🔍 预览比对结果'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? '保存中...' : '✅ 保存并开始比对'}
              </button>
            </div>

            {previewDiffs && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h4 className="font-medium text-gray-900 mb-3">比对预览</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">总条款数</span>
                    <span className="font-medium">{previewDiffs.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">存在差异</span>
                    <span className="font-medium text-yellow-600">{diffCount} 条</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">新增条款</span>
                    <span className="font-medium text-green-600">{newClauseCount} 条</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">缺失条款</span>
                    <span className="font-medium text-red-600">{missingCount} 条</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  {previewDiffs.filter(d => d.hasDiff).slice(0, 5).map((diff, i) => (
                    <div key={i} className={`text-xs p-2 rounded ${
                      diff.isNew ? 'bg-green-50 text-green-700' :
                      diff.isMissing ? 'bg-red-50 text-red-700' :
                      'bg-yellow-50 text-yellow-700'
                    }`}>
                      <span className="font-medium">{diff.clauseNumber}、</span>
                      {diff.isNew ? '✨ 新增' : diff.isMissing ? '❌ 缺失' : '⚠️ 修改'}
                      {' '}{diff.clauseTitle}
                    </div>
                  ))}
                  {diffCount > 5 && (
                    <div className="text-xs text-gray-500 text-center">
                      ...还有 {diffCount - 5} 条差异
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
