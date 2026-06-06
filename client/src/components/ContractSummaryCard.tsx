import { useState } from 'react';
import { ContractSummary } from '../types';
import { contractApi } from '../services/api';

interface ContractSummaryCardProps {
  contractId: string;
  initialSummary: ContractSummary;
  onSummaryUpdate?: (summary: ContractSummary) => void;
}

interface SummaryFieldProps {
  label: string;
  value: string | null;
  field: keyof Omit<ContractSummary, 'id' | 'contractId' | 'createdAt' | 'updatedAt'>;
  isEditing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
}

function SummaryField({ label, value, field, isEditing, editValue, onEditChange }: SummaryFieldProps) {
  const isUnrecognized = value === null || value === '' || value === '未识别';
  
  return (
    <div className="flex items-start space-x-3">
      <span className="text-sm text-gray-500 whitespace-nowrap w-20 flex-shrink-0">{label}</span>
      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          className="flex-1 text-sm border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={`请输入${label}`}
        />
      ) : (
        <span className={`text-sm flex-1 ${isUnrecognized ? 'text-gray-400 italic' : 'text-gray-900'}`}>
          {isUnrecognized ? '未识别' : value}
        </span>
      )}
    </div>
  );
}

const summaryFields = [
  { key: 'partyA', label: '甲方' },
  { key: 'partyB', label: '乙方' },
  { key: 'contractAmount', label: '合同金额' },
  { key: 'effectiveDate', label: '生效日期' },
  { key: 'expiryDate', label: '到期日期' },
  { key: 'paymentMethod', label: '付款方式' },
  { key: 'penaltyRatio', label: '违约金比例' },
  { key: 'confidentialityPeriod', label: '保密期限' }
] as const;

export default function ContractSummaryCard({ contractId, initialSummary, onSummaryUpdate }: ContractSummaryCardProps) {
  const [summary, setSummary] = useState<ContractSummary>(initialSummary);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isReExtracting, setIsReExtracting] = useState(false);

  function startEditing() {
    const newEditValues: Record<string, string> = {};
    summaryFields.forEach(field => {
      newEditValues[field.key] = summary[field.key] || '';
    });
    setEditValues(newEditValues);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditValues({});
  }

  async function saveChanges() {
    setIsSaving(true);
    try {
      const updateData: Partial<Omit<ContractSummary, 'id' | 'contractId' | 'createdAt' | 'updatedAt'>> = {};
      summaryFields.forEach(field => {
        const value = editValues[field.key]?.trim();
        (updateData as any)[field.key] = value || null;
      });

      const updated = await contractApi.updateSummary(contractId, updateData);
      setSummary(updated);
      setIsEditing(false);
      setEditValues({});
      onSummaryUpdate?.(updated);
    } catch (error) {
      console.error('保存摘要失败:', error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReExtract() {
    setIsReExtracting(true);
    try {
      const updated = await contractApi.reExtractSummary(contractId);
      setSummary(updated);
      onSummaryUpdate?.(updated);
    } catch (error) {
      console.error('重新提取摘要失败:', error);
    } finally {
      setIsReExtracting(false);
    }
  }

  const unrecognizedCount = summaryFields.filter(
    field => summary[field.key] === null || summary[field.key] === '' || summary[field.key] === '未识别'
  ).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h3 className="font-medium text-gray-900">📋 合同摘要</h3>
          {unrecognizedCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
              {unrecognizedCount} 项未识别
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleReExtract}
            disabled={isReExtracting || isEditing}
            className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isReExtracting ? '提取中...' : '🔄 重新提取'}
          </button>
          {!isEditing ? (
            <button
              onClick={startEditing}
              className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              ✏️ 编辑
            </button>
          ) : (
            <>
              <button
                onClick={cancelEditing}
                className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveChanges}
                disabled={isSaving}
                className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? '保存中...' : '✓ 保存'}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summaryFields.map(field => (
            <SummaryField
              key={field.key}
              label={field.label}
              value={summary[field.key]}
              field={field.key}
              isEditing={isEditing}
              editValue={editValues[field.key] || ''}
              onEditChange={(value) => setEditValues(prev => ({ ...prev, [field.key]: value }))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
