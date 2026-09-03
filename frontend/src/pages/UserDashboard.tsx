import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/api';

export const UserDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, active: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'USER') {
      navigate('/login');
      return;
    }

    userService
      .getDashboard()
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-green-600">SwachhDoot</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">{user?.name}</span>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome, {user?.name}!</h2>
          <p className="text-gray-600">Manage your waste complaints here</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-4xl font-bold text-green-600">{stats.total}</div>
            <div className="text-gray-600 mt-2">Total Complaints</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-4xl font-bold text-yellow-600">{stats.active}</div>
            <div className="text-gray-600 mt-2">Active Complaints</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-4xl font-bold text-blue-600">{stats.resolved}</div>
            <div className="text-gray-600 mt-2">Resolved Complaints</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => navigate('/user/report')}
            className="bg-green-600 text-white px-6 py-4 rounded-lg font-semibold hover:bg-green-700 text-lg"
          >
            📸 Report Garbage Complaint
          </button>
          <button
            onClick={() => navigate('/user/track')}
            className="bg-blue-600 text-white px-6 py-4 rounded-lg font-semibold hover:bg-blue-700 text-lg"
          >
            🔍 Track My Complaints
          </button>
        </div>
      </div>
    </div>
  );
};
