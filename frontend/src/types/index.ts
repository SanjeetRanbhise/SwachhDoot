export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: 'USER' | 'COLLECTOR' | 'ADMIN';
  admin_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  is_primary_admin?: boolean;
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
  expected_cleaning_hours?: number;
  waste_intensity?: string;
  complaint_date?: string | null;
  expected_cleaning_at?: string;
  delay_reason?: string;
  reporter_name?: string;
  collector_name?: string;
  user_name?: string;
  cleaning_image_url?: string;
  cleaned_at?: string;
  verified_at?: string;
  status_history?: Array<{ status: string; performed_role: string; created_at: string }>;
  feedback?: string;
  rating?: number;
}

export interface Feedback {
  id: number;
  complaint_id: number;
  user_id: number;
  rating: number;
  comment?: string;
  created_at: string;
}
