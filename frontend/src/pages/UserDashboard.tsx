import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { userService, complaintService } from '../services/api';
import { Complaint } from '../types';

export const UserDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, active: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<Complaint[]>([]);

  useEffect(() => {
    if (user?.role !== 'USER') {
      navigate('/login');
      return;
    }

    Promise.all([userService.getDashboard(), complaintService.getUserComplaints()])
      .then(([statsRes, complaintsRes]) => {
        setStats(statsRes.data);
        setComplaints(complaintsRes.data);
      })
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

        <div className="bg-white rounded-lg shadow-md mt-8 overflow-hidden">
          <div className="px-6 py-4 border-b"><h3 className="text-lg font-semibold">My Complaints</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full"><thead className="bg-gray-100"><tr><th className="px-6 py-3 text-left">Complaint ID</th><th className="px-6 py-3 text-left">Waste Type</th><th className="px-6 py-3 text-left">Date</th><th className="px-6 py-3 text-left">Status</th><th className="px-6 py-3 text-left">Time Limit</th><th className="px-6 py-3 text-left">Action</th></tr></thead>
              <tbody>{complaints.map((complaint) => <tr key={complaint.id} className="border-t"><td className="px-6 py-3">{complaint.complaint_id}</td><td className="px-6 py-3">{complaint.waste_type}</td><td className="px-6 py-3">{new Date(complaint.created_at).toLocaleDateString()}</td><td className="px-6 py-3"><span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs">{complaint.status}</span></td>
                    <td className="px-6 py-3 text-sm">{complaint.expected_cleaning_at ? new Date(complaint.expected_cleaning_at).toLocaleString() : '—'}</td>
                    <td className="px-6 py-3"><div className="flex gap-3 items-center">
                      <button onClick={() => navigate('/user/track', { state: { complaintId: complaint.complaint_id } })} className="text-blue-600 font-medium">View</button>
                      {complaint.status === 'CLEANED' && !complaint.rating && <button onClick={() => navigate('/user/feedback', { state: { complaintId: complaint.complaint_id } })} className="text-green-600 font-medium">Give Feedback</button>}
                      {complaint.rating && <span className="text-sm text-yellow-600">{complaint.rating}/5</span>}
                    </div></td></tr>)}</tbody>
            </table>
            {!complaints.length && <p className="p-6 text-gray-500">No complaints reported yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
