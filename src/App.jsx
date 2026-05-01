import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getCurrentUser } from './lib/auth';
import Login from './pages/Login';
import MobileInput from './pages/MobileInput';
import Dashboard from './pages/Dashboard';
import KandangManagement from './pages/KandangManagement';
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';
import SebaranBerat from './pages/SebaranBerat';
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
  const user = getCurrentUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const isMobile = window.innerWidth < 768;
  const user = getCurrentUser();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to={isMobile ? "/input" : "/dashboard"} replace />} />
          <Route path="input" element={<MobileInput />} />
          <Route path="sebaran" element={<SebaranBerat />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="kandang" element={<KandangManagement />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="admin" element={<AdminDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
