import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getCurrentUser, onUserChange, setCurrentUser } from '../store/auth';
import { User } from '../types';

interface LayoutProps {
  children: ReactNode;
}

const roleNames: Record<string, string> = {
  specialist: '法务专员',
  manager: '法务经理',
  director: '法务总监'
};

export default function Layout({ children }: LayoutProps) {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const location = useLocation();

  useEffect(() => {
    return onUserChange(setUser);
  }, []);

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const navItems = [
    { path: '/', label: '合同列表', icon: '📋' },
    { path: '/upload', label: '上传合同', icon: '📤' },
    { path: '/warnings', label: '到期预警', icon: '⚠️' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-gray-900">
                ⚖️ 合同智能比对平台
              </h1>
              <nav className="hidden md:flex space-x-4">
                {navItems.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      location.pathname === item.path
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              {user && (
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{roleNames[user.role]}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                    {user.name.charAt(0)}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    切换
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
