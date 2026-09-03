import React from 'react';
import { useNavigate } from 'react-router-dom';

export const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-green-600">SwachhDoot</h1>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="text-5xl font-bold text-gray-900 mb-4">SwachhDoot</h2>
        <p className="text-2xl text-gray-600 mb-8">Smart Waste Management System</p>
        <p className="text-lg text-gray-500 mb-12 max-w-2xl mx-auto">
          Connect citizens, waste management teams, and administrators to build a cleaner, greener community
        </p>

        <div className="flex gap-4 justify-center mb-16">
          <button
            onClick={() => navigate('/login')}
            className="bg-green-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-green-700 transition"
          >
            Login
          </button>
          <button
            onClick={() => navigate('/signup')}
            className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition"
          >
            Sign Up
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-4xl mb-4">👤</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">For Citizens</h3>
            <p className="text-gray-600">Report garbage, track complaints, and provide feedback</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-4xl mb-4">👷</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">For Collectors</h3>
            <p className="text-gray-600">Accept complaints and update cleaning progress</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-4xl mb-4">👨‍💼</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">For Admins</h3>
            <p className="text-gray-600">Monitor statistics and assign collectors</p>
          </div>
        </div>
      </div>
    </div>
  );
};
