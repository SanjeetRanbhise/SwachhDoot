export interface User {
  id: number;
  name: string;
  email: string;
  role: 'USER' | 'COLLECTOR' | 'ADMIN';
}

export interface Complaint {
  id: number;
  complaint_id: string;
  user_id: number;
  collector_id?: number;
  description: string;
  waste_type: string;
  image_url?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  status: 'REPORTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLEANED' | 'VERIFIED' | 'CLOSED';
  created_at: string;
  updated_at: string;
  reporter_name?: string;
  collector_name?: string;
  user_name?: string;
}

export interface Feedback {
  id: number;
  complaint_id: number;
  user_id: number;
  rating: number;
  comment?: string;
  created_at: string;
}
