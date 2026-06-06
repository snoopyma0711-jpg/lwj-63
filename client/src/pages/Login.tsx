import { useState, useEffect } from 'react';
import { userApi } from '../services/api';
import { setCurrentUser } from '../store/auth';
import { User } from '../types';

const roleNames: Record<string, string> = {
  specialist: '法务专员',
  manager: '法务经理',
  director: '法务总监'
};

const roleColors: Record<string, string> = {
  specialist: 'from-blue-500 to-blue-600',
  manager: 'from-purple-500 to-purple-600',
  director: 'from-orange-500 to-orange-600'
};

export default function Login() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const data = await userApi.list();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('加载用户失败:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectUser(user: User) {
    setCurrentUser(user);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-white text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">⚖️</div>
          <h1 className="text-4xl font-bold text-white mb-3">
            合同条款智能比对平台
          </h1>
          <p className="text-slate-400 text-lg">
            高效比对 · 智能标注 · 协同审批
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            请选择您的身份登录
          </h2>
          <div className="grid gap-4">
            {users.map(user => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className={`group relative overflow-hidden bg-gradient-to-r ${roleColors[user.role]} rounded-xl p-5 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-white/10`}
              >
                <div className="relative z-10 flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold text-white">
                    {user.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white">{user.name}</h3>
                    <p className="text-white/80">{roleNames[user.role]}</p>
                  </div>
                  <div className="text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all">
                    →
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm mt-8">
          © 2024 合同智能比对平台 · 提升法务审批效率
        </p>
      </div>
    </div>
  );
}
