import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'lokeye-auth-session';

/**
 * Read the access token directly from AsyncStorage.
 * Used in background tasks where we can't use the auth store.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

