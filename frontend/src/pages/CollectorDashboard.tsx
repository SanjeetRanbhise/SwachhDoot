import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collectorService } from '../services/api';
import { Complaint } from '../types';

export const CollectorDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role !== 'COLLECTOR') {
      navigate('/login');
      return;
    }

    loadComplaints();
  }, []);

  const loadComplaints = async () => {
    try {
      const res = await collectorService.getComplaints();
      setComplaints(res.data);
    } catch (error) {
      console.error('Failed to load complaints:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (complaintId: number) => {
    setUpdatingId(complaintId);
    try {
      await collectorService.acceptComplaint(complaintId);
      await loadComplaints();
    } catch (error) {
      console.error('Failed to accept complaint:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusUpdate = async (complaintId: number, status: string) => {
    setUpdatingId(complaintId);
    try {
      await collectorService.updateStatus(complaintId, status);
      await loadComplaints();
      setSelectedComplaint(null);
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-green-600">SwachhDoot - Collector</h1>
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
        <h2 className="text-3xl font-bold text-gray-800 mb-6">My Complaints</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {complaints.map((complaint) => (
            <div key={complaint.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="mb-4">
                <div className="text-sm text-gray-600">Complaint ID</div>
                <div className="text-lg font-semibold text-gray-800">{complaint.complaint_id}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600">Waste Type</div>
                  <div className="text-gray-800">{complaint.waste_type}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Status</div>
                  <div className="text-blue-600 font-semibold">{complaint.status}</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="text-sm text-gray-600">Address</div>
                <div className="text-gray-800">{complaint.address}</div>
              </div>

              <div className="mb-4">
                <div className="text-sm text-gray-600">Description</div>
                <div className="text-gray-800 text-sm">{complaint.description}</div>
              </div>

              {complaint.image_url && (
                <div className="mb-4">
                  <img src={complaint.image_url} alt="Complaint" className="w-full h-40 object-cover rounded-lg" />
                </div>
              )}

              <div className="flex gap-2">
                {complaint.status === 'REPORTED' && (
                  <button
                    onClick={() => handleAccept(complaint.id)}
                    disabled={updatingId === complaint.id}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {updatingId === complaint.id ? 'Accepting...' : 'Accept Complaint'}
                  </button>
                )}

                {(complaint.status === 'ASSIGNED' || complaint.status === 'IN_PROGRESS') && (
                  <>
                    <button
                      onClick={() => handleStatusUpdate(complaint.id, 'IN_PROGRESS')}
                      disabled={updatingId === complaint.id || complaint.status === 'IN_PROGRESS'}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Start Cleaning
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(complaint.id, 'CLEANED')}
                      disabled={updatingId === complaint.id}
                      className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      Mark Cleaned
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {complaints.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 text-lg">No complaints assigned yet</p>
          </div>
        )}
      </div>
    </div>
  );
};
