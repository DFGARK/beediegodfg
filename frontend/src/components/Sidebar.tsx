'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';
import SchoolLogo, { SCHOOL_UPDATED_EVENT } from '@/components/SchoolLogo';
import {
  LayoutDashboard, Users, ClipboardCheck, FileText,
  Download, Radio, Settings, LogOut, Wifi, WifiOff, X,
} from 'lucide-react';
import { create } from 'zustand';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/students', label: 'Estudiantes', icon: Users },
  { href: '/attendance', label: 'Asistencias', icon: ClipboardCheck },
  { href: '/excuses', label: 'Excusas', icon: FileText },
  { href: '/reports', label: 'Reportes', icon: Download },
  { href: '/readers', label: 'Lectores', icon: Radio },
  { href: '/settings', label: 'Configuracion', icon: Settings, adminOnly: true },
];

// Datos del colegio compartidos entre el Sidebar y la barra superior del celular
const useSchoolInfo = create<{ name: string; logoUrl: string | null; loaded: boolean; load: () => void }>(set => ({
  name: "Beehive Int'l",
  logoUrl: null,
  loaded: false,
  load: () => {
    api.get('/settings/school').then(r => {
      set({ logoUrl: r.data.logoUrl || null, loaded: true, ...(r.data.name ? { name: r.data.name } : {}) });
      if (r.data.primaryColor) {
        document.documentElement.style.setProperty('--beehive-primary', r.data.primaryColor);
      }
    }).catch(() => {});
  },
}));

function useSchool() {
  const school = useSchoolInfo();
  useEffect(() => {
    if (!useSchoolInfo.getState().loaded) useSchoolInfo.getState().load();
    const reload = () => useSchoolInfo.getState().load();
    // Se recarga cuando se cambia el logo o los datos desde Configuracion
    window.addEventListener(SCHOOL_UPDATED_EVENT, reload);
    return () => window.removeEventListener(SCHOOL_UPDATED_EVENT, reload);
  }, []);
  return school;
}

/** Logo + nombre del colegio. `compact` se usa en la barra superior del celular. */
function Brand({ compact = false }: { compact?: boolean }) {
  const { name, logoUrl } = useSchool();
  return (
    <div className="flex items-center gap-3 min-w-0">
      <SchoolLogo src={logoUrl} size={compact ? 32 : 40} />
      <div className="min-w-0">
        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{name}</p>
        {!compact && <p className="text-xs text-gray-400 dark:text-gray-500">Asistencias RFID</p>}
      </div>
    </div>
  );
}

function useLastSync() {
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('text-gray-400');

  useEffect(() => {
    const fetchReaders = async () => {
      try {
        const { data } = await api.get('/readers');
        const dates = (data as { lastSeen?: string; isActive?: boolean }[])
          .filter(r => r.isActive && r.lastSeen)
          .map(r => new Date(r.lastSeen!));
        if (dates.length === 0) { setLastSeen(null); return; }
        setLastSeen(new Date(Math.max(...dates.map(d => d.getTime()))));
      } catch { /* silent */ }
    };
    fetchReaders();
    const interval = setInterval(fetchReaders, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!lastSeen) { setLabel('Sin lectores'); setColor('text-gray-400 dark:text-gray-600'); return; }
    const tick = () => {
      const mins = Math.floor((Date.now() - lastSeen.getTime()) / 60_000);
      if (mins < 1) { setLabel('hace un momento'); setColor('text-green-500'); }
      else if (mins < 5) { setLabel(`hace ${mins} min`); setColor('text-green-500'); }
      else if (mins < 30) { setLabel(`hace ${mins} min`); setColor('text-yellow-500'); }
      else { setLabel(`hace ${mins} min`); setColor('text-red-500'); }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [lastSeen]);

  return { label, color };
}

interface SidebarProps {
  /** Solo en celular/tablet: si el menu deslizable esta abierto */
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { label: syncLabel, color: syncColor } = useLastSync();

  // Cerrar el menu del celular con la tecla Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <>
    {/* Fondo oscuro detras del menu en celular */}
    <div
      onClick={onClose}
      aria-hidden="true"
      className={`lg:hidden fixed inset-0 z-40 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    />
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transform transition-transform duration-200 ease-out
        ${open ? 'translate-x-0 shadow-xl' : '-translate-x-full'}
        lg:static lg:z-auto lg:w-60 lg:max-w-none lg:translate-x-0 lg:shadow-none lg:transition-none
        bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-[100dvh] shrink-0`}
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2">
        <Brand />
        <button
          onClick={onClose}
          aria-label="Cerrar menu"
          className="lg:hidden p-2 -mr-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV.filter(item => !item.adminOnly || user?.role === 'ADMIN').map(({ href, label, icon: Icon }) => {
          const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-white'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
        {/* Indicador de última sync */}
        <div className="px-3 py-1.5 flex items-center gap-2">
          {syncColor === 'text-red-500'
            ? <WifiOff size={12} className={syncColor} />
            : <Wifi size={12} className={syncColor} />
          }
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            Ultima sync: <span className={`font-medium ${syncColor}`}>{syncLabel}</span>
          </span>
        </div>

        {/* Usuario */}
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{user?.firstName}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{user?.email}</p>
          <span className="inline-block mt-1 text-[10px] border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded px-1.5 py-0.5">
            {user?.role}
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-white w-full transition-colors"
        >
          <LogOut size={15} />
          Cerrar sesion
        </button>
      </div>
    </aside>
    </>
  );
}

Sidebar.Brand = Brand;
