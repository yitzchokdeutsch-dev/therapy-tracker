export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  guardian: string;
  address: string;
  therapist_id: string;
  service_type_id: string;
  session_days: number[];
  start_date: string;
  active: boolean;
  notes: string;
  session_rate: number | null;
  late_cancel_fee: number | null;
  no_show_fee: number | null;
  // Insurance
  insurance_company: string | null;
  policy_number: string | null;
  group_number: string | null;
  subscriber_name: string | null;
  subscriber_dob: string | null;
  auth_number: string | null;
  authorized_visits: number | null;
  auth_expiration: string | null;
  // Clinical
  diagnosis_codes: string[];
}

export interface Therapist {
  id: string;
  name: string;
  email: string;
  phone: string;
  color: string;
  active: boolean;
}

export interface ServiceType {
  id: string;
  name: string;
  duration: number;
  rate: number;
  active: boolean;
}

export interface Session {
  id: string;
  client_id: string;
  therapist_id: string;
  service_type_id: string;
  session_date: string;
  session_time: string;
  status: string;
  notes: string;
  deleted_at?: string | null;
}

export interface Fee {
  id: string;
  name: string;
  amount: number;
  updated_at?: string;
}

export interface Charge {
  id: string;
  client_id: string;
  session_id?: string;
  charge_date: string;
  description: string;
  amount: number;
  deleted_at?: string | null;
}

export interface Payment {
  id: string;
  client_id: string;
  payment_date: string;
  amount: number;
  method: string;
  reference: string;
  notes: string;
  created_at: string;
  deleted_at?: string | null;
}

export interface TherapistSchedule {
  id: string;
  therapist_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active?: boolean;
}

export interface ClientNote {
  id: string;
  client_id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface ClientFile {
  id: string;
  client_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  category: string;
  notes: string;
  created_at: string;
}

export interface SessionNote {
  id: string;
  client_id: string;
  session_id: string | null;
  therapist_id: string | null;
  session_date: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  goals_addressed: string[];
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  client_id: string;
  description: string;
  category: string;
  target_date: string | null;
  status: "active" | "mastered" | "discontinued";
  progress: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  client_id: string | null;
  session_id: string | null;
  title: string;
  task_type: "soap_note" | "auth_expiring" | "custom";
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}
