import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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

export const authService = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

export const complaintService = {
  create: (data: FormData) =>
    api.post('/complaints', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getByComplaintId: (complaintId: string) => api.get(`/complaints/${complaintId}`),
  getUserComplaints: () => api.get('/complaints'),
};

export const adminService = {
  getDashboard: () => api.get('/admin/dashboard'),
  getComplaints: () => api.get('/admin/complaints'),
  assignCollector: (id: number, collectorId: number) =>
    api.put(`/admin/complaints/${id}/assign`, { collector_id: collectorId }),
  getCollectors: () => api.get('/admin/collectors'),
};

export const collectorService = {
  getDashboard: () => api.get('/collector/dashboard'),
  getComplaints: () => api.get('/collector/complaints'),
  acceptComplaint: (id: number) => api.put(`/complaints/${id}/accept`, {}),
  updateStatus: (id: number, status: string) =>
    api.put(`/complaints/${id}/status`, { status }),
};

export const userService = {
  getDashboard: () => api.get('/user/dashboard'),
};

export const feedbackService = {
  create: (data: any) => api.post('/feedback', data),
  getAdmin: () => api.get('/feedback/admin/all'),
};

export default api;
