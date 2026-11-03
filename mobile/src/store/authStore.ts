import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import * as authService from '../services/authService';
import { registerUnauthorizedHandler, setApiAuthToken } from '../services/api';

export interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: false,

      login: async (email: string, password: string) => {
        const { user, token } = await authService.login(email, password);
        setApiAuthToken(token);
        set({
          user,
          token,
          isAuthenticated: true,
        });
      },

      register: async (email: string, password: string) => {
        const { user, token } = await authService.register(email, password);
        setApiAuthToken(token);
        set({
          user,
          token,
          isAuthenticated: true,
        });
      },

      logout: () => {
        setApiAuthToken(null);
        authService.clearStoredAuth().catch(() => {});
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      setHydrated: (hydrated: boolean) => {
        set({ isHydrated: hydrated });
      },
    }),
    {
      name: '@alarmy/auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          setApiAuthToken(state.token);
        }
        state?.setHydrated(true);
      },
    }
  )
);

// Automatically log out user when API receives 401
registerUnauthorizedHandler(() => {
  useAuthStore.getState().logout();
});
