// ── Human ──
export interface Human {
  id: string;
  phone: string;
  display_name: string | null;
  upi_vpa: string | null;
  expo_push_token: string | null;
  last_location: { latitude: number; longitude: number } | null;
  last_location_at: string | null;
  wallet_rupees: number;
  tasks_completed: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Agent ──
export interface Agent {
  id: string;
  name: string;
  api_key_hash: string;
  api_key_prefix: string;
  credits_balance: number;
  webhook_url: string | null;
  total_reviews: number;
  total_rejections: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Task ──
import { TASK_TYPES } from '../constants';
export type TaskType = (typeof TASK_TYPES)[number];
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'submitted' | 'completed' | 'expired' | 'cancelled';

export interface Task {
  id: string;
  agent_id: string;
  human_id: string | null;
  type: TaskType;
  title: string;
  description: string;
  instructions: string | null;
  location: { latitude: number; longitude: number };
  radius_meters: number;
  bounty_rupees: number;
  deadline: string;
  status: TaskStatus;
  assigned_at: string | null;
  started_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  rejection_reason: string | null;
  rejection_count: number;
  created_at: string;
  updated_at: string;
}

// ── Task with distance (for nearby queries) ──
export interface NearbyTask extends Task {
  distance_meters: number;
}

// ── Task Response ──
export interface TaskResponse {
  id: string;
  task_id: string;
  human_id: string;
  text_response: string | null;
  media_urls: string[];
  capture_location: { latitude: number; longitude: number } | null;
  capture_metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── Withdrawal ──
export type WithdrawalStatus = 'pending' | 'completed' | 'rejected';

export interface WithdrawalRequest {
  id: string;
  human_id: string;
  amount_rupees: number;
  upi_vpa: string;
  status: WithdrawalStatus;
  rejection_reason: string | null;
  telegram_message_id: number | null;
  completed_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CloseAccountAction =
  | 'deleted'
  | 'pending_withdrawal'
  | 'withdrawal_requested'
  | 'pending_tasks'
  | 'missing_upi';

export interface CloseAccountResponse {
  action: CloseAccountAction;
  message: string;
}

// ── API Request/Response types ──
export interface CreateTaskRequest {
  type: TaskType;
  title: string;
  description: string;
  instructions?: string;
  latitude: number;
  longitude: number;
  bounty_rupees: number;
  deadline: string;
}

export interface UpdateHumanProfileRequest {
  display_name?: string;
  upi_vpa?: string;
}

export interface UpdateLocationRequest {
  latitude: number;
  longitude: number;
}

export interface UpdatePushTokenRequest {
  expo_push_token: string;
}

export interface SubmitTaskRequest {
  text_response?: string;
  media_urls?: string[];
  capture_latitude?: number;
  capture_longitude?: number;
  capture_metadata?: Record<string, unknown>;
}

export interface RejectTaskRequest {
  reason: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreditBalanceResponse {
  balance: number;
  currency: 'INR';
  balance_display: string;
}

export interface EarningsResponse {
  wallet_rupees: number;
  lifetime_earned: number;
  tasks_completed: number;
  pending_withdrawal: WithdrawalRequest | null;
}
