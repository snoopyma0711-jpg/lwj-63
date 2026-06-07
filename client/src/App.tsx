import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import ContractList from './pages/ContractList';
import ContractUpload from './pages/ContractUpload';
import ContractDetail from './pages/ContractDetail';
import WarningDashboard from './pages/WarningDashboard';
import RiskRanking from './pages/RiskRanking';
import ApprovalEfficiency from './pages/ApprovalEfficiency';
import TemplateList from './pages/TemplateList';
import TemplateEditor from './pages/TemplateEditor';
import TemplateVersions from './pages/TemplateVersions';
import { getCurrentUser, onUserChange } from './store/auth';
import { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(getCurrentUser());

  useEffect(() => {
    return onUserChange(setUser);
  }, []);

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ContractList />} />
        <Route path="/upload" element={<ContractUpload />} />
        <Route path="/upload/:parentId" element={<ContractUpload />} />
        <Route path="/contract/:id" element={<ContractDetail />} />
        <Route path="/risk-ranking" element={<RiskRanking />} />
        <Route path="/warnings" element={<WarningDashboard />} />
        <Route path="/efficiency" element={<ApprovalEfficiency />} />
        <Route path="/templates" element={<TemplateList />} />
        <Route path="/templates/:id/edit" element={<TemplateEditor />} />
        <Route path="/templates/:id/versions" element={<TemplateVersions />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
