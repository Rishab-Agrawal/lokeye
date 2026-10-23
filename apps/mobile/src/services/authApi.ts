import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'lokeye-auth-session';
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface AuthUser {
  id: string;
  phone?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: AuthUser;
}

export async function getStoredSession(): Promise<AuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

async function storeSession(session: AuthSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/api/v1/auth${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || `Request failed: ${res.status}`);
  return data;
}

export async function authSignUp(phone: string, password: string, name: string, upi_vpa?: string): Promise<AuthSession> {
  const { session } = await post<{ session: AuthSession }>('/signup', { phone, password, name, upi_vpa });
  await storeSession(session);
  return session;
}

export async function authLogin(phone: string, password: string): Promise<AuthSession> {
  const { session } = await post<{ session: AuthSession }>('/login', { phone, password });
  await storeSession(session);
  return session;
}

export async function authRefresh(refreshToken: string): Promise<AuthSession> {
  const { session } = await post<{ session: AuthSession }>('/refresh', { refresh_token: refreshToken });
  await storeSession(session);
  return session;
}

export async function authLogout(token: string): Promise<void> {
  try {
    await post('/logout', {}, token);
  } catch {
    // Ignore logout errors — we clear local state regardless
  }
  await clearSession();
}

export async function authChangePassword(
  currentPassword: string,
  newPassword: string,
  token: string,
): Promise<void> {
  await post('/change-password', { current_password: currentPassword, new_password: newPassword }, token);
}
