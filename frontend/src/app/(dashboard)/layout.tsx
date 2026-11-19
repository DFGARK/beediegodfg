'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Search } from 'lucide-react';
import { useAuthStore, useAuthHydrated } from '@/store/authStore';
import Sidebar from '@/components/Sidebar';
import ToastProvider from '@/components/ToastProvider';
import GlobalSearch, { openGlobalSearch } from '@/components/GlobalSearch';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuthStore();
  const hydrated = useAuthHydrated();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.replace('/login');
  }, [hydrated, isAuthenticated, router]);

  // En celular, cerrar el menu al cambiar de pagina
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  if (!hydrated || !isAuthenticated) return null;

  return (
    <div className="flex h-[100dvh] bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barra superior solo en celular/tablet */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
            className="-ml-2 p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <Sidebar.Brand compact />
          </div>
          <button
            onClick={openGlobalSearch}
            aria-label="Buscar estudiante"
            className="-mr-2 p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Search size={19} />
          </button>
        </header>
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
          {children}
        </main>
      </div>
      <ToastProvider />
      <GlobalSearch />
    </div>
  );
}
