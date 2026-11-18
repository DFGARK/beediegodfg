'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useAuthHydrated } from '@/store/authStore';

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const hydrated = useAuthHydrated();
  useEffect(() => {
    if (!hydrated) return;
    router.replace(isAuthenticated ? '/dashboard' : '/login');
  }, [hydrated, isAuthenticated, router]);
  return null;
}
