'use client';
import { useEffect, useState, useRef } from 'react';
import { Save, Plus, Trash2, Upload, Moon, Sun, ShieldAlert } from 'lucide-react';
import api from '@/lib/axios';
import { School, User, UserRole, Reader } from '@/types';
import Modal from '@/components/ui/Modal';
import SchoolLogo, { notifySchoolUpdated } from '@/components/SchoolLogo';
import { useAuthStore } from '@/store/authStore';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'DIRECTOR', label: 'Director' },
  { value: 'TEACHER', label: 'Maestro' },
  { value: 'SECRETARY', label: 'Secretaria' },
];

interface UserForm { email: string; password: string; firstName: string; lastName: string; role: UserRole; }
interface ReaderForm { id: string; name: string; location: string; }

const emptyUser: UserForm = { email: '', password: '', firstName: '', lastName: '', role: 'TEACHER' };
const emptyReader: ReaderForm = { id: '', name: '', location: '' };

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);
  const toggle = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    setDark(isDark);
  };
  return { dark, toggle };
}

function isStale(reader: Reader) {
  if (!reader.lastSeen) return true;
  return Date.now() - new Date(reader.lastSeen).getTime() > 5 * 60 * 1000;
}

// Acceso a Configuracion: solo usuarios con rol ADMIN (el backend tambien lo valida).
function AdminOnlyNotice() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 min-h-[60vh]">
      <div className="max-w-xs text-center space-y-2">
        <ShieldAlert size={28} className="mx-auto text-gray-400" />
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Acceso restringido</h2>
        <p className="text-sm text-gray-400">Solo los administradores pueden modificar la configuracion.</p>
      </div>
    </div>
  );
}

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const LOGO_MAX_BYTES = 5 * 1024 * 1024; // archivo original
const LOGO_MAX_SIDE = 512;              // px, se reduce manteniendo proporcion

/** Lee la imagen y la reduce (sin deformar) para guardarla de forma ligera. */
function processLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onload = () => {
      const original = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo no es una imagen valida'));
      img.onload = () => {
        const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(img.width, img.height));
        if (scale === 1 && file.size <= 1024 * 1024) return resolve(original);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(original);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // JPG sin transparencia -> JPEG; PNG/WebP -> PNG para conservar transparencia
        const out = file.type === 'image/jpeg'
          ? canvas.toDataURL('image/jpeg', 0.9)
          : canvas.toDataURL('image/png');
        resolve(out);
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}

type Tab = 'school' | 'users' | 'readers';

export default function SettingsPage() {
  const isAdmin = useAuthStore(state => state.user?.role === 'ADMIN');
  const [tab, setTab] = useState<Tab>('school');
  const { dark, toggle: toggleDark } = useTheme();

  // School
  const [school, setSchool] = useState<School | null>(null);
  const [schoolForm, setSchoolForm] = useState({ name: '', address: '', phone: '', email: '', primaryColor: '#F5C400', logoUrl: '', entryTime: '07:30', lateTime: '08:00' });
  const [savingSchool, setSavingSchool] = useState(false);
  const [logoStatus, setLogoStatus] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [userForm, setUserForm] = useState<UserForm>(emptyUser);
  const [savingUser, setSavingUser] = useState(false);

  // Readers
  const [readers, setReaders] = useState<Reader[]>([]);
  const [readerModalOpen, setReaderModalOpen] = useState(false);
  const [readerForm, setReaderForm] = useState<ReaderForm>(emptyReader);
  const [savingReader, setSavingReader] = useState(false);

  const fetchSchool = async () => {
    const { data } = await api.get('/settings/school');
    setSchool(data);
    setSchoolForm({
      name: data.name, address: data.address || '',
      phone: data.phone || '', email: data.email || '',
      primaryColor: data.primaryColor, logoUrl: data.logoUrl || '',
      entryTime: data.entryTime || '07:30', lateTime: data.lateTime || '08:00',
    });
  };

  const fetchUsers = async () => {
    const { data } = await api.get('/settings/users');
    setUsers(data);
  };

  const fetchReaders = async () => {
    const { data } = await api.get('/readers');
    setReaders(data);
  };

  useEffect(() => {
    if (isAdmin) {
      fetchSchool();
      fetchUsers();
      fetchReaders();
    }
  }, [isAdmin]);

  // ── School ──────────────────────────────────────────
  const saveSchool = async () => {
    setSavingSchool(true);
    try {
      await api.put('/settings/school', schoolForm);
      await fetchSchool();
      notifySchoolUpdated();
    } catch (e) { console.error(e); }
    setSavingSchool(false);
  };

  // El logo se guarda en cuanto se sube o se quita, para que persista al recargar.
  const saveLogo = async (logoUrl: string | null) => {
    setSavingLogo(true);
    setLogoStatus(null);
    try {
      await api.put('/settings/school', { logoUrl });
      setSchoolForm(prev => ({ ...prev, logoUrl: logoUrl || '' }));
      notifySchoolUpdated();
      setLogoStatus({ type: 'ok', msg: logoUrl ? 'Logo actualizado' : 'Logo eliminado' });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setLogoStatus({ type: 'error', msg: err.response?.data?.error || 'No se pudo guardar el logo' });
    }
    setSavingLogo(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      setLogoStatus({ type: 'error', msg: 'Formato no permitido. Usa PNG, JPG o WebP.' });
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoStatus({ type: 'error', msg: 'La imagen supera los 5 MB.' });
      return;
    }
    try {
      const dataUrl = await processLogo(file);
      await saveLogo(dataUrl);
    } catch (err) {
      setLogoStatus({ type: 'error', msg: (err as Error).message });
    }
  };

  const handleColorChange = (color: string) => {
    setSchoolForm(prev => ({ ...prev, primaryColor: color }));
    // Preview instantáneo en el sidebar vía CSS variable
    document.documentElement.style.setProperty('--beehive-primary', color);
  };

  const sf = (key: keyof typeof schoolForm) => ({
    value: schoolForm[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSchoolForm(prev => ({ ...prev, [key]: e.target.value })),
  });

  // ── Users ───────────────────────────────────────────
  const saveUser = async () => {
    setSavingUser(true);
    try {
      await api.post('/settings/users', userForm);
      setModalOpen(false);
      setUserForm(emptyUser);
      fetchUsers();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error || 'Error al crear usuario');
    }
    setSavingUser(false);
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Desactivar este usuario?')) return;
    await api.delete(`/settings/users/${id}`);
    fetchUsers();
  };

  const uf = (key: keyof UserForm) => ({
    value: userForm[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setUserForm(prev => ({ ...prev, [key]: e.target.value })),
  });

  // ── Readers ─────────────────────────────────────────
  const saveReader = async () => {
    setSavingReader(true);
    try {
      await api.post('/readers', readerForm);
      setReaderModalOpen(false);
      setReaderForm(emptyReader);
      fetchReaders();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error || 'Error al crear lector');
    }
    setSavingReader(false);
  };

  const deleteReader = async (id: string) => {
    if (!confirm('Desactivar este lector?')) return;
    await api.delete(`/readers/${id}`);
    fetchReaders();
  };

  const rf = (key: keyof ReaderForm) => ({
    value: readerForm[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setReaderForm(prev => ({ ...prev, [key]: e.target.value })),
  });

  if (!isAdmin) return <AdminOnlyNotice />;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'school', label: 'Informacion del Colegio' },
    { key: 'users', label: 'Usuarios del Sistema' },
    { key: 'readers', label: 'Lectores RFID' },
  ];

  const inputCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-600';

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900 dark:text-white">Configuracion</h1>
          <p className="text-sm text-gray-400">Datos del colegio y gestion del sistema</p>
        </div>

        {/* Dark mode toggle */}
        <div className="flex items-center gap-2">
          {dark ? <Moon size={15} className="text-gray-400" /> : <Sun size={15} className="text-gray-400" />}
          <button
            onClick={toggleDark}
            aria-label="Cambiar tema"
            className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${
              dark ? 'bg-gray-700' : 'bg-gray-200'
            }`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${dark ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
          <span className="text-xs text-gray-400">{dark ? 'Oscuro' : 'Claro'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-3 text-sm font-medium transition border-b-2 ${
              tab === key
                ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Colegio ── */}
      {tab === 'school' && school && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 max-w-xl space-y-4">
          {/* Logo */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Logo del colegio</label>
            <div className="flex items-center gap-4">
              <SchoolLogo src={schoolForm.logoUrl} size={64} />
              <div className="space-y-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={savingLogo}
                  className="flex items-center gap-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-gray-700 dark:text-gray-300 disabled:opacity-50"
                >
                  <Upload size={12} />
                  {savingLogo ? 'Guardando...' : schoolForm.logoUrl ? 'Cambiar logo' : 'Subir logo'}
                </button>
                {schoolForm.logoUrl && (
                  <button
                    onClick={() => saveLogo(null)}
                    disabled={savingLogo}
                    className="text-xs text-gray-400 hover:text-red-500 transition px-1 disabled:opacity-50"
                  >
                    Quitar logo
                  </button>
                )}
                <p className="text-[11px] text-gray-400">PNG, JPG o WebP. Maximo 5 MB.</p>
              </div>
            </div>
            {logoStatus && (
              <p className={`mt-2 text-xs ${logoStatus.type === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
                {logoStatus.msg}
              </p>
            )}
          </div>

          {[
            { label: 'Nombre del colegio', key: 'name' as const },
            { label: 'Correo electronico', key: 'email' as const, type: 'email' },
            { label: 'Telefono', key: 'phone' as const },
            { label: 'Direccion', key: 'address' as const },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
              <input type={type || 'text'} {...sf(key)} className={inputCls} />
            </div>
          ))}

          {/* Color institucional con preview instantáneo */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Color institucional
              <span className="ml-1 text-[10px] font-normal text-gray-400">(preview en tiempo real)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={schoolForm.primaryColor}
                onChange={e => handleColorChange(e.target.value)}
                className="w-9 h-9 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer p-0.5 bg-transparent"
              />
              <input
                type="text"
                value={schoolForm.primaryColor}
                onChange={e => handleColorChange(e.target.value)}
                className={`flex-1 ${inputCls} font-mono`}
              />
              <div
                className="w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-700 shrink-0"
                style={{ backgroundColor: schoolForm.primaryColor }}
              />
            </div>
          </div>

          {/* Horario de entrada */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hora de entrada
                <span className="ml-1 text-[10px] font-normal text-gray-400">(marca PRESENT)</span>
              </label>
              <input type="time" {...sf('entryTime')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hora limite tardanza
                <span className="ml-1 text-[10px] font-normal text-gray-400">(despues = ABSENT)</span>
              </label>
              <input type="time" {...sf('lateTime')} className={inputCls} />
            </div>
          </div>

          <button
            onClick={saveSchool}
            disabled={savingSchool}
            className="flex items-center gap-2 bg-black dark:bg-white dark:text-black text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50"
          >
            <Save size={14} />
            {savingSchool ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {/* ── TAB: Usuarios ── */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => { setUserForm(emptyUser); setModalOpen(true); }}
              className="flex items-center gap-2 bg-black dark:bg-white dark:text-black text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition"
            >
              <Plus size={14} /> Nuevo usuario
            </button>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Rol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300 shrink-0">
                          {u.firstName[0]}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{u.firstName} {u.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded font-medium">
                        {ROLES.find(r => r.value === u.role)?.label || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${u.isActive ? 'text-green-700 border border-green-200' : 'text-red-500 border border-red-200'}`}>
                        {u.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => deleteUser(u.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: Lectores RFID ── */}
      {tab === 'readers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => { setReaderForm(emptyReader); setReaderModalOpen(true); }}
              className="flex items-center gap-2 bg-black dark:bg-white dark:text-black text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition"
            >
              <Plus size={14} /> Agregar lector
            </button>
          </div>

          {readers.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-12 text-center text-gray-400">
              <p className="text-sm">Sin lectores registrados</p>
              <p className="text-xs mt-1">Agrega el ID del lector ESP32 para empezar</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Ubicacion</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">ID del lector</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {readers.map(r => {
                    const online = r.isOnline && !isStale(r);
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${online ? 'bg-green-400 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
                            <span className={`text-xs font-medium ${online ? 'text-green-600' : 'text-gray-400'}`}>
                              {online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.name}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{r.location || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{r.id}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deleteReader(r.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors"
                            title="Eliminar lector"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Nuevo usuario */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo usuario" size="md">
        <div className="space-y-4">
          {[
            { label: 'Nombre', key: 'firstName' as const, required: true },
            { label: 'Apellido', key: 'lastName' as const },
            { label: 'Correo electronico', key: 'email' as const, required: true, type: 'email' },
            { label: 'Contrasena', key: 'password' as const, required: true, type: 'password' },
          ].map(({ label, key, required, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <input
                type={type || 'text'}
                required={required}
                {...uf(key)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Rol</label>
            <select
              value={userForm.role}
              onChange={e => setUserForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
            Cancelar
          </button>
          <button
            onClick={saveUser}
            disabled={savingUser}
            className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
          >
            {savingUser ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </Modal>

      {/* Modal: Agregar lector */}
      <Modal open={readerModalOpen} onClose={() => setReaderModalOpen(false)} title="Agregar lector RFID" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              ID del lector <span className="text-red-500">*</span>
              <span className="ml-1 font-normal text-gray-400">(debe coincidir con READER_ID en el .ino)</span>
            </label>
            <input
              type="text"
              placeholder="reader-entrada-principal"
              {...rf('id')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Entrada Principal"
              {...rf('name')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ubicacion</label>
            <input
              type="text"
              placeholder="Porteria, Salon A, etc."
              {...rf('location')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setReaderModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
            Cancelar
          </button>
          <button
            onClick={saveReader}
            disabled={savingReader || !readerForm.id || !readerForm.name}
            className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-40"
          >
            {savingReader ? 'Guardando...' : 'Agregar lector'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
