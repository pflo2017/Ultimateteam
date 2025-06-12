export interface Club {
  id: string;
  name: string;
  admin_id: string;
  admin_name?: string;
  admin_email?: string;
  is_access_enabled: boolean;
  active_player_count?: number;
  created_at: string;
}

export interface Payment {
  id: string;
  club_id: string;
  club_name?: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  player_count: number;
  rate_per_player: number;
  payment_date: string | null;
  payment_reference: string | null;
  notes: string | null;
  is_paid: boolean;
  created_at: string;
}

export interface MasterAdmin {
  id: string;
  user_id: string;
  email: string;
  name: string;
  is_super_admin: boolean;
  created_at: string;
}

export interface ClubStats {
  total_clubs: number;
  active_clubs: number;
  inactive_clubs: number;
  total_players: number;
  active_players: number;
}

export interface PaymentStats {
  total_due: number;
  total_paid: number;
  total_unpaid: number;
  total_overdue: number;
  payment_rate: number;
}

export interface MonthlyBillingData {
  month: string;
  total_amount: number;
  paid_amount: number;
  unpaid_amount: number;
}

export interface ClubUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'coach' | 'parent';
  is_active: boolean;
  last_login?: string;
} 