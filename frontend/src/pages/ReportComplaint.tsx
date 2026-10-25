import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { complaintService } from '../services/api';
import { MAX_DESCRIPTIVE_TEXT_LENGTH } from '../constants';
const getAddressFromCoordinates = async (
  latitude: number,
  longitude: number
): Promise<string> => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
    {
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Could not resolve the GPS address.');
  }

  const result = await response.json();

  return (
    result.display_name ||
    `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
  );
};

const WASTE_TYPES = [
  'Organic Waste', 'Food Waste', 'Dry Waste', 'Wet Waste', 'Plastic', 'Paper',
  'Cardboard', 'Glass', 'Metal', 'E-Waste', 'Battery Waste', 'Medical Waste',
  'Construction Waste', 'Garden Waste', 'Mixed Waste', 'Other',
];

const EXPECTED_TIMES = [
  { value: 6, label: 'Within 6 hours' },
  { value: 12, label: 'Within 12 hours' },
  { value: 24, label: 'Within 24 hours' },
  { value: 48, label: 'Within 48 hours' },
  { value: 72, label: 'Within 72 hours' },
];

export const ReportComplaint: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [formData, setFormData] = useState({
   description: '',
    waste_type: 'Plastic',
    address: user?.address || '',
    latitude: '',
    longitude: '',
    waste_intensity: '',
});

  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraLocation, setCameraLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [complaintId, setComplaintId] = useState('');

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    setCameraOpen(false);
  };

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const openCamera = async () => {
    setError('');
    setCameraError('');
    setCameraOpen(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live camera is not supported by this browser. Please use the upload option.');
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Location services are not supported.'));
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });

    const { latitude, longitude } = position.coords;

setFormData((prev) => ({
  ...prev,
  latitude: latitude.toString(),
  longitude: longitude.toString(),
  address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
}));

setCameraLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);

try {
  const address = await getAddressFromCoordinates(latitude, longitude);

  setFormData((prev) => ({
    ...prev,
    address,
  }));
} catch (error) {
  console.error('Reverse geocoding failed:', error);
  setCameraError(
    'GPS coordinates captured, but the street address could not be detected. The photo will show coordinates instead.'
  );
}

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      setCameraReady(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err: any) {
      setCameraError(
        err?.code === 1
          ? 'Camera/location permission was denied. Please allow both permissions and try again.'
          : 'Could not open the camera with GPS. Please check camera and location permissions.'
      );
    }
  };

const capturePhoto = () => {
  const video = videoRef.current;
  const canvas = canvasRef.current;

  if (!video || !canvas || !video.videoWidth) {
    setCameraError('Camera is not ready yet. Please wait a moment.');
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext('2d');

  if (!context) {
    setCameraError('Could not process the photo. Please try again.');
    return;
  }

  // Capture the live camera frame.
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Read the latest available location details.
  const latitude = formData.latitude || 'Unavailable';
  const longitude = formData.longitude || 'Unavailable';
  const address = formData.address.trim() || 'Address unavailable';

  // Record the capture date and time.
  const capturedAt = new Date();

  const dateText = capturedAt.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const timeText = capturedAt.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  // Configure a readable metadata panel.
  const padding = Math.max(12, Math.round(canvas.width * 0.025));
  const fontSize = Math.max(14, Math.round(canvas.width * 0.025));
  const lineHeight = fontSize * 1.6;
  const maxTextWidth = canvas.width - padding * 2;

  context.font = `600 ${fontSize}px Arial, sans-serif`;
  context.textBaseline = 'top';

  const wrapText = (text: string): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      if (context.measureText(testLine).width > maxTextWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
  };
  const metadata = [
    'SWACHHDOOT - GEO-TAGGED PHOTO',
    `Address: ${address}`,
    `Latitude: ${latitude}`,
    `Longitude: ${longitude}`,
    `Date: ${dateText}`,
    `Time: ${timeText}`,
  ];

  const displayLines = metadata.flatMap(wrapText);
  const panelHeight = padding * 2 + lineHeight * displayLines.length;
  const panelTop = Math.max(0, canvas.height - panelHeight);

  // Draw the background directly onto the photo.
  context.fillStyle = 'rgba(0, 0, 0, 0.78)';
  context.fillRect(
    0,
    panelTop,
    canvas.width,
    canvas.height - panelTop
  );

  // Draw the metadata text onto the photo.
  context.fillStyle = '#FFFFFF';

  displayLines.forEach((line, index) => {
    context.fillText(
      line,
      padding,
      panelTop + padding + index * lineHeight,
      maxTextWidth
    );
  });
  // Export the completed, geo-tagged image.
  canvas.toBlob(
    (blob) => {
      if (!blob) {
        setCameraError('Could not save the photo. Please try again.');
        return;
      }

      const file = new File(
        [blob],
        `swachhdoot-geotagged-${Date.now()}.jpg`,
        { type: 'image/jpeg' }
      );

      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      stopCamera();
    },
    'image/jpeg',
    0.92
  );
};
const handleImageChange = (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  const file = e.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith('image/')) {
    setError('Please select a valid image file.');
    e.target.value = '';
    return;
  }

  setError('');
  setImage(file);
  setImagePreview(URL.createObjectURL(file));
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
            address: `Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          }));
        },
        () => setError('Could not get location. Please enable location services.'),
        { enableHighAccuracy: true }
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
        setError('Please capture or upload an image');
        return;
      }
      if (!formData.description.trim()) {
        setError('Please enter a description');
        return;
      }
      if (!formData.latitude || !formData.longitude) {
        setError('Please capture the photo with GPS or detect your current location');
        return;
      }

      const data = new FormData();
      data.append('image', image);
      data.append('description', formData.description);
      data.append('waste_type', formData.waste_type);
      data.append('address', formData.address);
      data.append('latitude', formData.latitude);
      data.append('longitude', formData.longitude);
      data.append('waste_intensity', formData.waste_intensity);

      const res = await complaintService.create(data);
      setComplaintId(res.data.complaint_id);
      setSuccess(`Complaint reported successfully! ID: ${res.data.complaint_id}`);
      setTimeout(() => navigate('/user/track', { state: { complaintId: res.data.complaint_id } }), 1500);
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
          <button onClick={() => navigate('/user/dashboard')} className="text-green-600 font-bold text-2xl hover:text-green-700">SwachhDoot</button>
          <button onClick={() => navigate('/user/dashboard')} className="text-gray-600 hover:text-gray-800 font-medium">← Back</button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Report Garbage</h1>
          <p className="text-sm text-gray-500 mb-6">Capture the complaint photo with GPS so the location is stored with your report.</p>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Complaint Photo *</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-5">
                {imagePreview ? (
                  <div>
                    <img src={imagePreview} alt="Complaint preview" className="w-full max-h-64 object-cover rounded-lg mb-3" />
                    <div className="flex gap-3">
                      <button type="button" onClick={openCamera} className="flex-1 border border-green-600 text-green-700 px-4 py-2 rounded-lg font-medium">Retake with Camera</button>
                      <button type="button" onClick={() => { setImage(null); setImagePreview(''); }} className="flex-1 border border-red-300 text-red-600 px-4 py-2 rounded-lg">Remove</button>
                    </div>
                    {cameraLocation && <p className="text-xs text-green-700 mt-2">✓ GPS captured: {cameraLocation}</p>}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button type="button" onClick={openCamera} className="bg-green-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-green-700">📷 Open Camera & GPS</button>
                    <label className="border border-gray-300 text-gray-700 px-4 py-3 rounded-lg font-semibold text-center cursor-pointer hover:bg-gray-50">
                      📁 Upload Photo
                      <input
  type="file"
  accept="image/*"
  onChange={handleImageChange}
  className="hidden"
/>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Waste Type *</label>
              <select value={formData.waste_type} onChange={(e) => setFormData((prev) => ({ ...prev, waste_type: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                {WASTE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
              <textarea value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value.slice(0, MAX_DESCRIPTIVE_TEXT_LENGTH) }))} maxLength={MAX_DESCRIPTIVE_TEXT_LENGTH} rows={4} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Describe the garbage location and condition..." required />
              <div className="mt-1 text-right text-xs text-gray-500">{formData.description.length}/{MAX_DESCRIPTIVE_TEXT_LENGTH}</div>
            </div>

          
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Waste Intensity *
  </label>

  <select
    value={formData.waste_intensity}
    onChange={(e) =>
      setFormData((prev) => ({
        ...prev,
        waste_intensity: e.target.value,
      }))
    }
    required
    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
  >
    <option value="">Select waste intensity</option>
    <option value="LOW">Low</option>
    <option value="MEDIUM">Medium</option>
    <option value="HIGH">High</option>
    <option value="CRITICAL">Critical</option>
  </select>

  <p className="text-xs text-gray-500 mt-1">
    Select the severity of the waste accumulation. The Admin will assign the cleaning deadline.
  </p>
</div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
              <button type="button" onClick={getLocation} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 mb-2 font-medium">🌍 Detect Current Location</button>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Latitude" value={formData.latitude} readOnly className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50" />
                <input type="text" placeholder="Longitude" value={formData.longitude} readOnly className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
              <input type="text" value={formData.address} onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value.slice(0, MAX_DESCRIPTIVE_TEXT_LENGTH) }))} maxLength={MAX_DESCRIPTIVE_TEXT_LENGTH} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Enter or edit address manually" />
              <div className="mt-1 text-right text-xs text-gray-500">{formData.address.length}/{MAX_DESCRIPTIVE_TEXT_LENGTH}</div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 text-lg">
              {loading ? 'Reporting...' : '✓ Submit Complaint'}
            </button>
          </form>
        </div>
      </div>

      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-lg">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-lg">Geo-tagged Camera</h2>
              <button type="button" onClick={stopCamera} className="text-gray-600 text-xl">✕</button>
            </div>
            <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black aspect-video object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            {cameraLocation && <p className="text-sm text-green-700 mt-2">✓ GPS locked: {cameraLocation}</p>}
            {cameraError && <p className="text-sm text-red-600 mt-2">{cameraError}</p>}
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={capturePhoto} disabled={!cameraReady} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50">📸 Capture Photo</button>
              <button type="button" onClick={stopCamera} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
