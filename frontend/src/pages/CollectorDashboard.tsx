import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collectorService } from '../services/api';
import { Complaint } from '../types';
import { MAX_DESCRIPTIVE_TEXT_LENGTH } from '../constants';

const formatDeadline = (value?: string) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';

export const CollectorDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [cleaningPhotos, setCleaningPhotos] = useState<Record<number, File | null>>({});
  const [delayReasons, setDelayReasons] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});

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
    setErrors((current) => ({ ...current, [complaintId]: '' }));
    try {
      await collectorService.acceptComplaint(complaintId);
      await loadComplaints();
    } catch (error: any) {
      setErrors((current) => ({ ...current, [complaintId]: error.response?.data?.error || 'Complaint could not be accepted.' }));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusUpdate = async (complaintId: number, status: string) => {
    setUpdatingId(complaintId);
    setErrors((current) => ({ ...current, [complaintId]: '' }));
    try {
      await collectorService.updateStatus(complaintId, status);
      await loadComplaints();
    } catch (error: any) {
      setErrors((current) => ({ ...current, [complaintId]: error.response?.data?.error || 'Complaint could not be updated.' }));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCleaningPhoto = async (complaintId: number) => {
    const cleaningPhoto = cleaningPhotos[complaintId];
    if (!cleaningPhoto) {
      setErrors((current) => ({ ...current, [complaintId]: 'Please select a cleaning photo.' }));
      return;
    }

    const complaint = complaints.find((item) => item.id === complaintId);
    const overdue = !!complaint?.expected_cleaning_at && new Date(complaint.expected_cleaning_at).getTime() < Date.now();
    const reason = (delayReasons[complaintId] || '').trim();

    if (overdue && !reason) {
      setErrors((current) => ({ ...current, [complaintId]: 'The time limit has been exceeded. Please enter a reason for the delay.' }));
      return;
    }

    setUpdatingId(complaintId);
    setErrors((current) => ({ ...current, [complaintId]: '' }));
    try {
      const data = new FormData();
      data.append('image', cleaningPhoto);
      if (reason) data.append('delay_reason', reason);
      await collectorService.uploadCleaningPhoto(complaintId, data);
      setCleaningPhotos((current) => ({ ...current, [complaintId]: null }));
      setDelayReasons((current) => ({ ...current, [complaintId]: '' }));
      await loadComplaints();
    } catch (error: any) {
      setErrors((current) => ({ ...current, [complaintId]: error.response?.data?.error || 'Photo upload failed. Please try again.' }));
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-green-600">SwachhDoot - Waste Management Team</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">{user?.name}</span>
            <button onClick={() => { logout(); navigate('/login'); }} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">My Complaints</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {complaints.map((complaint) => {
            const overdue = !!complaint.expected_cleaning_at && new Date(complaint.expected_cleaning_at).getTime() < Date.now() && !['CLEANED', 'VERIFIED', 'CLOSED'].includes(complaint.status);

            return (
              <div key={complaint.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="mb-4">
                  <div className="text-sm text-gray-600">Complaint ID</div>
                  <div className="text-lg font-semibold text-gray-800">{complaint.complaint_id}</div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><div className="text-sm text-gray-600">Waste Type</div><div className="text-gray-800">{complaint.waste_type}</div></div>
                  <div><div className="text-sm text-gray-600">Status</div><div className="text-blue-600 font-semibold">{complaint.status}</div></div>
                </div>

                <div className={`mb-4 rounded-lg border p-3 ${overdue ? 'border-red-300 bg-red-50' : 'border-green-200 bg-green-50'}`}>
                  <div className="text-sm font-semibold text-gray-800">Citizen Time Limit</div>
                  <div className={`text-lg font-bold ${overdue ? 'text-red-700' : 'text-green-700'}`}>
                    {formatDeadline(complaint.expected_cleaning_at)}
                  </div>
                  <div className="text-xs text-gray-600">
                    Expected within {complaint.expected_cleaning_hours || 24} hours of complaint submission.
                  </div>
                  {overdue && <div className="mt-1 text-sm font-semibold text-red-700">⚠ Time limit exceeded — delay reason is compulsory.</div>}
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
                    <img src={`https://swachhdoot-api.onrender.com${complaint.image_url}`} alt="Complaint" className="w-full h-40 object-cover rounded-lg" />
                  </div>
                )}

                {complaint.cleaning_image_url && (
                  <div className="mb-4">
                    <div className="text-sm text-gray-600 mb-2">Cleaning photo</div>
                    <img src={`https://swachhdoot-api.onrender.com${complaint.cleaning_image_url}`} alt="After cleaning" className="w-full h-40 object-cover rounded-lg" />
                    {complaint.cleaned_at && <div className="text-sm text-gray-500 mt-1">Cleaned {new Date(complaint.cleaned_at).toLocaleString()}</div>}
                    {complaint.delay_reason && <div className="mt-2 rounded bg-orange-50 border border-orange-200 p-2 text-sm text-orange-800"><strong>Delay reason:</strong> {complaint.delay_reason}</div>}
                  </div>
                )}

                <div className="flex gap-2">
                  {complaint.status === 'REPORTED' && (
                    <button onClick={() => handleAccept(complaint.id)} disabled={updatingId === complaint.id} className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                      {updatingId === complaint.id ? 'Accepting...' : 'Accept Complaint'}
                    </button>
                  )}

                  {complaint.status === 'ASSIGNED' && (
                    <button onClick={() => handleStatusUpdate(complaint.id, 'IN_PROGRESS')} disabled={updatingId === complaint.id} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {updatingId === complaint.id ? 'Starting...' : 'Start Cleaning'}
                    </button>
                  )}

                  {complaint.status === 'IN_PROGRESS' && (
                    <div className="w-full space-y-3">
                      {overdue && (
                        <div>
                          <textarea
                            value={delayReasons[complaint.id] || ''}
                            onChange={(event) => setDelayReasons((current) => ({ ...current, [complaint.id]: event.target.value.slice(0, MAX_DESCRIPTIVE_TEXT_LENGTH) }))}
                            maxLength={MAX_DESCRIPTIVE_TEXT_LENGTH}
                            rows={3}
                            placeholder="Compulsory: explain why the cleaning deadline was exceeded..."
                            className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400"
                          />
                          <div className="text-right text-xs text-gray-500">{(delayReasons[complaint.id] || '').length}/{MAX_DESCRIPTIVE_TEXT_LENGTH}</div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <label className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-center cursor-pointer">
                          {cleaningPhotos[complaint.id]?.name || 'Choose cleaning photo'}
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => setCleaningPhotos((current) => ({ ...current, [complaint.id]: event.target.files?.[0] || null }))} />
                        </label>
                        <button onClick={() => handleCleaningPhoto(complaint.id)} disabled={updatingId === complaint.id} className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                          {updatingId === complaint.id ? 'Uploading...' : 'Submit & Mark as Cleaned'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {cleaningPhotos[complaint.id] && <img src={URL.createObjectURL(cleaningPhotos[complaint.id]!)} alt="Cleaning preview" className="mt-3 w-full h-40 object-cover rounded-lg" />}
                {errors[complaint.id] && <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{errors[complaint.id]}</div>}
              </div>
            );
          })}
        </div>

        {complaints.length === 0 && <div className="bg-white rounded-lg shadow-md p-8 text-center"><p className="text-gray-600 text-lg">No complaints assigned yet</p></div>}
      </div>
    </div>
  );
};
