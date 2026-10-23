import AsyncStorage from '@react-native-async-storage/async-storage';
import { authRefresh } from './authApi';
import {
  ApiResponse,
  Task,
  NearbyTask,
  Human,
  EarningsResponse,
  CloseAccountResponse,
  CreateTaskRequest,
  UpdateHumanProfileRequest,
  UpdateLocationRequest,
  SubmitTaskRequest,
} from '@lokeye/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const SESSION_KEY = 'lokeye-auth-session';

async function getAccessToken(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const makeRequest = async (token: string) => {
    const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';
    return fetch(`${API_URL}/api/v1/human${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  let response = await makeRequest(token);

  // On 401, try refreshing the token once
  if (response.status === 401) {
    try {
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored?.refresh_token) {
          const newSession = await authRefresh(stored.refresh_token);
          response = await makeRequest(newSession.access_token);
        }
      }
    } catch {
      // Refresh failed (account deleted or token revoked) — force sign out
      await AsyncStorage.removeItem(SESSION_KEY);
      const { useAuthStore } = await import('../store/auth');
      useAuthStore.getState().setSession(null);
    }
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return data.data;
}

// Profile
export const getProfile = () => request<Human>('GET', '/profile');
export const updateProfile = (data: UpdateHumanProfileRequest) =>
  request<Human>('PUT', '/profile', data);

// Location
export const updateLocation = (data: UpdateLocationRequest) =>
  request<void>('PUT', '/location', data);

// Push token
export const updatePushToken = (token: string) =>
  request<void>('PUT', '/push-token', { expo_push_token: token });

// Tasks
export const getActiveTask = () =>
  request<Task | null>('GET', '/tasks/active');

export const getNearbyTasks = (lat: number, lng: number) =>
  request<NearbyTask[]>('GET', `/tasks/nearby?latitude=${lat}&longitude=${lng}`);

export const acceptTask = (taskId: string) =>
  request<Task>('POST', `/tasks/${taskId}/accept`);

export const startTask = (taskId: string) =>
  request<Task>('POST', `/tasks/${taskId}/start`);

export const submitTask = (taskId: string, data: SubmitTaskRequest) =>
  request<Task>('POST', `/tasks/${taskId}/submit`, data);

export const abandonTask = (taskId: string) =>
  request<Task>('POST', `/tasks/${taskId}/abandon`);

// Earnings
export const getEarnings = () => request<EarningsResponse>('GET', '/earnings');

// Withdrawal
export const requestWithdrawal = () => request<unknown>('POST', '/withdraw');
export const closeAccount = () => request<CloseAccountResponse>('POST', '/close-account');

// In-app support request (authenticated human)
export const requestHumanSupport = (message: string) =>
  request<void>('POST', '/support', { message });

// Forgot password request (public, no auth)
export async function forgotPassword(phone: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+91' + phone }),
  });

  const data = await response.json().catch(() => null) as
    | { success?: boolean; error?: string; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed: ${response.status}`);
  }
}
