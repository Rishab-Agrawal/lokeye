import { create } from 'zustand';
import {
  AuthSession,
  AuthUser,
  authSignUp,
  authLogin,
  authLogout,
  authRefresh,
  getStoredSession,
  clearSession,
} from '../services/authApi';
import { stopBackgroundLocation } from '../hooks/useLocation';

interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
  isLoading: boolean;
  setSession: (session: AuthSession | null) => void;
  signUp: (phone: string, password: string, name: string, upi_vpa?: string) => Promise<void>;
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,

  setSession: (session) => set({
    session,
    user: session?.user ?? null,
    isLoading: false,
  }),

  signUp: async (phone: string, password: string, name: string, upi_vpa?: string) => {
    const session = await authSignUp(phone, password, name, upi_vpa);
    set({ session, user: session.user, isLoading: false });
  },

  signIn: async (phone: string, password: string) => {
    const session = await authLogin(phone, password);
    set({ session, user: session.user, isLoading: false });
  },

  signOut: async () => {
    await stopBackgroundLocation();
    const { session } = get();
    if (session?.access_token) {
      await authLogout(session.access_token);
    } else {
      await clearSession();
    }
    set({ session: null, user: null });
  },

  initialize: async () => {
    const stored = await getStoredSession();
    if (!stored) {
      set({ session: null, user: null, isLoading: false });
      return;
    }

    try {
      const refreshed = await authRefresh(stored.refresh_token);
      set({ session: refreshed, user: refreshed.user, isLoading: false });
    } catch {
      await clearSession();
      set({ session: null, user: null, isLoading: false });
    }
  },
}));
