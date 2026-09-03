import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { complaintService } from '../services/api';

const WASTE_TYPES = [
  'Organic Waste',
  'Food Waste',
  'Dry Waste',
  'Wet Waste',
  'Plastic',
  'Paper',
  'Cardboard',
  'Glass',
  'Metal',
  'E-Waste',
  'Battery Waste',
  'Medical Waste',
  'Construction Waste',
  'Garden Waste',
  'Mixed Waste',
  'Other',
];

export const ReportComplaint: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    description: '',
    waste_type: 'Plastic',
    address: '',
    latitude: '',
    longitude: '',
  });

  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [complaintId, setComplaintId] = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const getLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setFormData((prev) => ({
            ...prev,
            latitude: latitude.toString(),
            longitude: longitude.toString(),
          }));
          // Simple reverse geocoding mock
          setFormData((prev) => ({
            ...prev,
            address: `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          }));
        },
        (error) => {
          setError('Could not get location. Please enable location services.');
          console.error(error);
        }
      );
    } else {
      setError('Geolocation not supported');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!image) {
        setError('Please upload an image');
        return;
      }

      if (!formData.description.trim()) {
        setError('Please enter a description');
        return;
      }

      const formDataToSend = new FormData();
      formDataToSend.append('image', image);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('waste_type', formData.waste_type);
      formDataToSend.append('address', formData.address);
      formDataToSend.append('latitude', formData.latitude);
      formDataToSend.append('longitude', formData.longitude);

      const res = await complaintService.create(formDataToSend);
      setComplaintId(res.data.complaint_id);
      setSuccess(`Complaint reported successfully! ID: ${res.data.complaint_id}`);
      setTimeout(() => {
        navigate('/user/track', { state: { complaintId: res.data.complaint_id } });
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to report complaint');
    } finally {
      setLoading(false);
    }
  };

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
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Report Garbage</h1>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Photo *</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                {imagePreview ? (
                  <div>
                    <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-cover rounded-lg mb-4" />
                    <button
                      type="button"
                      onClick={() => {
                        setImage(null);
                        setImagePreview('');
                      }}
                      className="text-red-600 hover:text-red-700 font-medium text-sm"
                    >
                      Remove Image
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center cursor-pointer">
                    <span className="text-4xl mb-2">📸</span>
                    <span className="text-gray-600 font-medium">Click to upload photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      required
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Waste Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Waste Type *</label>
              <select
                value={formData.waste_type}
                onChange={(e) => setFormData((prev) => ({ ...prev, waste_type: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                {WASTE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Describe the garbage location and condition..."
                required
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <button
                type="button"
                onClick={getLocation}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 mb-2 font-medium"
              >
                🌍 Detect Current Location
              </button>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Latitude"
                  value={formData.latitude}
                  readOnly
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
                <input
                  type="text"
                  placeholder="Longitude"
                  value={formData.longitude}
                  readOnly
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Enter or edit address manually"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 text-lg"
            >
              {loading ? 'Reporting...' : '✓ Submit Complaint'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
