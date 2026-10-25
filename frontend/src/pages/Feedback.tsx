import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { feedbackService } from '../services/api';
import { MAX_DESCRIPTIVE_TEXT_LENGTH } from '../constants';

export const Feedback: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const locationState = useLocation().state as any;

  const [complaintId] = useState(String(locationState?.complaintId || ''));
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [wasteRemoved, setWasteRemoved] = useState<boolean | null>(null);
  const [areaLeftClean, setAreaLeftClean] = useState<boolean | null>(null);
  const [resolvedOnTime, setResolvedOnTime] = useState<boolean | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!complaintId) {
        setError('Complaint ID is required');
        return;
      }

      if (
  wasteRemoved === null ||
  areaLeftClean === null ||
  resolvedOnTime === null
) {
  alert('Please answer all three Yes/No questions.');
  return;
}

const yesCount = [
  wasteRemoved,
  areaLeftClean,
  resolvedOnTime,
].filter((answer) => answer === true).length;

const overallFeedback =
  yesCount === 3 ? 'Good' :
  yesCount === 2 ? 'Average' :
  'Poor';

await feedbackService.create({
  complaint_id: complaintId,
  rating,
  comment,
  waste_removed: wasteRemoved,
  area_left_clean: areaLeftClean,
  resolved_on_time: resolvedOnTime,
  overall_feedback: overallFeedback,
});

      setSuccess('Thank you for your feedback!');
      setTimeout(() => navigate('/user/dashboard'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit feedback');
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
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Share Your Feedback</h1>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rating (1-5 stars) *</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`text-4xl ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            
<div className="space-y-4 my-5">
  <h3 className="font-semibold text-gray-800">
    Cleaning Service Questions
  </h3>

  <div>
    <p className="text-sm font-medium mb-2">
      1. Was the waste completely removed?
    </p>
    <label className="mr-6">
      <input
        type="radio"
        name="wasteRemoved"
        checked={wasteRemoved === true}
        onChange={() => setWasteRemoved(true)}
      /> Yes
    </label>
    <label>
      <input
        type="radio"
        name="wasteRemoved"
        checked={wasteRemoved === false}
        onChange={() => setWasteRemoved(false)}
      /> No
    </label>
  </div>

  <div>
    <p className="text-sm font-medium mb-2">
      2. Was the surrounding area left clean?
    </p>
    <label className="mr-6">
      <input
        type="radio"
        name="areaLeftClean"
        checked={areaLeftClean === true}
        onChange={() => setAreaLeftClean(true)}
      /> Yes
    </label>
    <label>
      <input
        type="radio"
        name="areaLeftClean"
        checked={areaLeftClean === false}
        onChange={() => setAreaLeftClean(false)}
      /> No
    </label>
  </div>

  <div>
    <p className="text-sm font-medium mb-2">
      3. Was the complaint resolved within the assigned deadline?
    </p>
    <label className="mr-6">
      <input
        type="radio"
        name="resolvedOnTime"
        checked={resolvedOnTime === true}
        onChange={() => setResolvedOnTime(true)}
      /> Yes
    </label>
    <label>
      <input
        type="radio"
        name="resolvedOnTime"
        checked={resolvedOnTime === false}
        onChange={() => setResolvedOnTime(false)}
      /> No
    </label>
  </div>

  {wasteRemoved !== null &&
    areaLeftClean !== null &&
    resolvedOnTime !== null && (() => {
      const yesCount = [
        wasteRemoved,
        areaLeftClean,
        resolvedOnTime,
      ].filter(Boolean).length;

      const label =
        yesCount === 3 ? 'Good' :
        yesCount === 2 ? 'Average' : 'Poor';

      return (
        <div className="rounded-lg bg-gray-100 p-3">
          <span className="font-medium">Overall feedback: </span>
          <span className="font-bold">{label}</span>
        </div>
      );
    })()}
</div>


            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Comment</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, MAX_DESCRIPTIVE_TEXT_LENGTH))}
                maxLength={MAX_DESCRIPTIVE_TEXT_LENGTH}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Share your experience with the cleaning..."
              />
              <div className="mt-1 text-right text-xs text-gray-500">{comment.length}/{MAX_DESCRIPTIVE_TEXT_LENGTH}</div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 text-lg"
            >
              {loading ? 'Submitting...' : '✓ Submit Feedback'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
