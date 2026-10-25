import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api';

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) localStorage.removeItem('token');
    return Promise.reject(error);
  }
);

export const authService = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  requestPasswordReset: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data: { token: string; password: string; confirmPassword: string }) =>
    api.post('/auth/reset-password', data),
  getMe: () => api.get('/auth/me'),
};

export const complaintService = {
  create: (data: FormData) =>
    api.post('/complaints', data),
  getByComplaintId: (complaintId: string) => api.get(`/complaints/${complaintId}`),
  getUserComplaints: () => api.get('/complaints'),
};

export const adminService = {
  getDashboard: () => api.get('/admin/dashboard'),
  getComplaints: (status?: string) =>
    api.get('/admin/complaints', { params: status ? { status } : {} }),
  assignComplaint: (
  id: number,
  collectorId: number,
  expectedCleaningHours: number
) =>
    api.put(`/admin/complaints/${id}/assign`, {
  collector_id: collectorId,
  expected_cleaning_hours: expectedCleaningHours,
}),
  getCollectors: () => api.get('/admin/collectors'),
  getAdmins: () => api.get('/admin/admins'),
  getApprovalRequests: () => api.get('/admin/approval-requests'),
  getNotifications: () => api.get('/admin/notifications'),
  markNotificationsRead: (notificationIds: number[]) =>
    api.put('/admin/notifications/read', { notificationIds }),
  approveAdmin: (id: number) => api.put(`/admin/admins/${id}/approve`),
  rejectAdmin: (id: number) => api.put(`/admin/admins/${id}/reject`),
  getReports: (params: { type: 'weekly' | 'monthly'; date?: string; status?: string }) =>
    api.get('/admin/reports', { params }),
};

export const collectorService = {
  getDashboard: () => api.get('/collector/dashboard'),
  getComplaints: () => api.get('/collector/complaints'),
  acceptComplaint: (id: number) => api.put(`/complaints/${id}/accept`, {}),
  updateStatus: (id: number, status: string) =>
    api.put(`/complaints/${id}/status`, { status }),
  uploadCleaningPhoto: (id: number, data: FormData) =>
    api.put(`/complaints/${id}/cleaning`, data),
};

export const userService = {
  getDashboard: () => api.get('/user/dashboard'),
};

export const feedbackService = {
  create: (data: any) => api.post('/feedback', data),
  getAdmin: () => api.get('/feedback/admin/all'),
};

export default api;
