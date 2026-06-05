import { Contract } from '../types';
import { Link } from 'react-router-dom';

interface VersionChainProps {
  versions: Contract[];
  currentId: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-400',
  pending: 'bg-yellow-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  needs_director: 'bg-orange-500'
};

const statusLabels: Record<string, string> = {
  draft: '草稿',
  pending: '审批中',
  approved: '已通过',
  rejected: '已驳回',
  needs_director: '待总监'
};

export default function VersionChain({ versions, currentId }: VersionChainProps) {
  if (versions.length <= 1) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <h4 className="font-medium text-gray-900">📜 版本历史</h4>
      </div>
      <div className="p-4">
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-4">
            {[...versions].reverse().map((version, index) => {
              const isCurrent = version.id === currentId;
              return (
                <div key={version.id} className="relative pl-10">
                  <div className={`absolute left-2 top-1.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${
                    isCurrent ? 'ring-2 ring-blue-500 ' + statusColors[version.status] : statusColors[version.status]
                  }`}>
                    {index === 0 && <span className="text-white text-xs">✓</span>}
                  </div>
                  {isCurrent ? (
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-blue-900">v{version.version} · 当前版本</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full text-white ${statusColors[version.status]}`}>
                          {statusLabels[version.status]}
                        </span>
                      </div>
                      <p className="text-sm text-blue-700 mt-1">
                        {new Date(version.updatedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  ) : (
                    <Link
                      to={`/contract/${version.id}`}
                      className="block hover:bg-gray-50 rounded-lg p-3 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">v{version.version}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full text-white ${statusColors[version.status]}`}>
                          {statusLabels[version.status]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(version.updatedAt).toLocaleString('zh-CN')}
                      </p>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
