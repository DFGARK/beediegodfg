'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';
import {
  LayoutDashboard, Users, ClipboardCheck, FileText,
  Download, Radio, Settings, LogOut, Wifi, WifiOff,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/students', label: 'Estudiantes', icon: Users },
  { href: '/attendance', label: 'Asistencias', icon: ClipboardCheck },
  { href: '/excuses', label: 'Excusas', icon: FileText },
  { href: '/reports', label: 'Reportes', icon: Download },
  { href: '/readers', label: 'Lectores', icon: Radio },
  { href: '/settings', label: 'Configuracion', icon: Settings },
];

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

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState("Beehive Int'l");
  const { label: syncLabel, color: syncColor } = useLastSync();

  useEffect(() => {
    api.get('/settings/school').then(r => {
      if (r.data.logoUrl) setLogoUrl(r.data.logoUrl);
      if (r.data.name) setSchoolName(r.data.name);
      if (r.data.primaryColor) {
        document.documentElement.style.setProperty('--beehive-primary', r.data.primaryColor);
      }
    }).catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className="w-60 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-screen shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 flex items-center justify-center"
            style={{ backgroundColor: 'var(--beehive-primary, #F5C400)' }}
          >
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              : <span className="text-xs font-black text-black">BI</span>
            }
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{schoolName}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Asistencias RFID</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
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
  );
}
