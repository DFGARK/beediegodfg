import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import api from '@/lib/axios';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        set({ user: data.user, token: data.token, isAuthenticated: true });
      },
      logout: () => {
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'beehive-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
        }
      },
    }
  )
);

/**
 * true cuando la sesion guardada en el navegador ya se cargo.
 * Evita mandar al login al recargar la pagina antes de leer la sesion.
 */
export function useAuthHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}
