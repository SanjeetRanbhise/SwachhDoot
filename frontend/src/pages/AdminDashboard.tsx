import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../services/api';
import { Complaint } from '../types';

export const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    total: 0,
    reported: 0,
    assigned: 0,
    in_progress: 0,
    cleaned: 0,
    verified: 0,
    closed: 0,
  });

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaintId, setSelectedComplaintId] = useState<number | null>(null);
  const [selectedCollectorId, setSelectedCollectorId] = useState<number | null>(null);
  const [collectors, setCollectors] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      navigate('/login');
      return;
    }

    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashRes, complRes, collRes] = await Promise.all([
        adminService.getDashboard(),
        adminService.getComplaints(),
        adminService.getCollectors(),
      ]);

      setStats(dashRes.data);
      setComplaints(complRes.data);
      setCollectors(collRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (complaintId: number, collectorId: number) => {
    try {
      await adminService.assignCollector(complaintId, collectorId);
      await loadData();
      setSelectedComplaintId(null);
      setSelectedCollectorId(null);
    } catch (error) {
      console.error('Failed to assign:', error);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-green-600">SwachhDoot Admin</h1>
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
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Dashboard Statistics</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-gray-600 text-sm">Total Complaints</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-red-600">{stats.reported}</div>
            <div className="text-gray-600 text-sm">Reported</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-yellow-600">{stats.assigned}</div>
            <div className="text-gray-600 text-sm">Assigned</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-purple-600">{stats.in_progress}</div>
            <div className="text-gray-600 text-sm">In Progress</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-green-600">{stats.cleaned}</div>
            <div className="text-gray-600 text-sm">Cleaned</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-cyan-600">{stats.verified}</div>
            <div className="text-gray-600 text-sm">Verified</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-indigo-600">{stats.closed}</div>
            <div className="text-gray-600 text-sm">Closed</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-800">All Complaints</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Waste Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Citizen</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Collector</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((complaint) => (
                  <tr key={complaint.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-800">{complaint.complaint_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{complaint.waste_type}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        {complaint.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800">{complaint.user_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{complaint.collector_name || '—'}</td>
                    <td className="px-6 py-4 text-sm">
                      {complaint.status === 'REPORTED' && (
                        <button
                          onClick={() => setSelectedComplaintId(complaint.id)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Assign
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedComplaintId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <h3 className="text-lg font-semibold mb-4">Assign Collector</h3>
            <select
              value={selectedCollectorId || ''}
              onChange={(e) => setSelectedCollectorId(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            >
              <option value="">Select Collector</option>
              {collectors.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (selectedCollectorId) {
                    handleAssign(selectedComplaintId, selectedCollectorId);
                  }
                }}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Assign
              </button>
              <button
                onClick={() => setSelectedComplaintId(null)}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
