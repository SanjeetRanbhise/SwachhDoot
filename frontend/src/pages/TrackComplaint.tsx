import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { complaintService } from '../services/api';
import { Complaint } from '../types';

export const TrackComplaint: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const locationState = useLocation().state as any;

  const [complaintId, setComplaintId] = useState(locationState?.complaintId || '');
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const statuses = ['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED', 'VERIFIED', 'CLOSED'];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await complaintService.getByComplaintId(complaintId);
      setComplaint(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Complaint not found');
      setComplaint(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIndex = (status: string) => statuses.indexOf(status);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <button
            onClick={() => navigate('/user/dashboard')}
            className="text-green-600 font-bold text-2xl hover:text-green-700"
          >
            SwachhDoot
          </button>
          <button
            onClick={() => navigate('/user/dashboard')}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            ← Back
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Track Your Complaint</h1>

          <form onSubmit={handleSearch} className="flex gap-4 mb-6">
            <input
              type="text"
              value={complaintId}
              onChange={(e) => setComplaintId(e.target.value)}
              placeholder="Enter Complaint ID (e.g., SD-2026-00001)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">{error}</div>}

          {complaint && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Complaint ID</div>
                  <div className="text-lg font-semibold text-gray-800">{complaint.complaint_id}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Status</div>
                  <div className="text-lg font-semibold text-green-600">{complaint.status}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Waste Type</div>
                  <div className="text-lg font-semibold text-gray-800">{complaint.waste_type}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Reported Date</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {new Date(complaint.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-2">Location</div>
                <div className="text-gray-800">{complaint.address || 'No address provided'}</div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-2">Description</div>
                <div className="text-gray-800">{complaint.description}</div>
              </div>

              {complaint.collector_name && (
                <div>
                  <div className="text-sm text-gray-600 mb-2">Assigned Collector</div>
                  <div className="text-gray-800">{complaint.collector_name}</div>
                </div>
              )}

              {/* Timeline */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Status Timeline</h3>
                <div className="space-y-4">
                  {statuses.map((status, index) => (
                    <div key={status} className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          getStatusIndex(complaint.status) >= index
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-300 text-gray-600'
                        }`}
                      >
                        ✓
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{status}</div>
                      </div>
                      {getStatusIndex(complaint.status) >= index && (
                        <div className="text-sm text-gray-600">✓ Completed</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {complaint.status === 'CLEANED' && (
                <button
                  onClick={() => navigate('/user/feedback', { state: { complaintId: complaint.id } })}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Submit Feedback
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
