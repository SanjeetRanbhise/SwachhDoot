import './styles/index.css';
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { Signup } from './pages/Signup';
import { UserDashboard } from './pages/UserDashboard';
import { ReportComplaint } from './pages/ReportComplaint';
import { TrackComplaint } from './pages/TrackComplaint';
import { Feedback } from './pages/Feedback';
import { AdminDashboard } from './pages/AdminDashboard';
import { CollectorDashboard } from './pages/CollectorDashboard';

const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: string }> = ({
  children,
  requiredRole,
}) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/login" />;

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ForgotPassword />} />
      <Route path="/signup" element={<Signup />} />

      {/* User Routes */}
      <Route
        path="/user/dashboard"
        element={
          <ProtectedRoute requiredRole="USER">
            <UserDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/user/report"
        element={
          <ProtectedRoute requiredRole="USER">
            <ReportComplaint />
          </ProtectedRoute>
        }
      />
      <Route
        path="/user/track"
        element={
          <ProtectedRoute requiredRole="USER">
            <TrackComplaint />
          </ProtectedRoute>
        }
      />
      <Route
        path="/user/feedback"
        element={
          <ProtectedRoute requiredRole="USER">
            <Feedback />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Collector Routes */}
      <Route
        path="/collector/dashboard"
        element={
          <ProtectedRoute requiredRole="COLLECTOR">
            <CollectorDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
