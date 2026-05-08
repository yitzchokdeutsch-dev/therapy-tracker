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
