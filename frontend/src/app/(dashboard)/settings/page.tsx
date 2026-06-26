'use client';
import { useEffect, useState, useRef } from 'react';
import { Save, Plus, Trash2, Upload, Moon, Sun } from 'lucide-react';
import api from '@/lib/axios';
import { School, User, UserRole, Reader } from '@/types';
import Modal from '@/components/ui/Modal';

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

function SettingsGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === '12345xd') {
      sessionStorage.setItem('settings_unlocked', 'true');
      onUnlock();
    } else {
      setError(true);
      setValue('');
    }
  };
  return (
    <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="w-full max-w-xs px-4">
        <div className="mb-7">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Acceso restringido</h2>
          <p className="text-sm text-gray-400 mt-1">Ingresa la contrasena de configuracion</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={value}
            onChange={e => { setValue(e.target.value); setError(false); }}
            placeholder="••••••••"
            autoFocus
            required
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400 transition-colors"
          />
          {error && <p className="text-xs text-red-500">Contrasena incorrecta</p>}
          <button
            type="submit"
            className="w-full bg-black dark:bg-white dark:text-black text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            Acceder
          </button>
        </form>
      </div>
    </div>
  );
}

type Tab = 'school' | 'users' | 'readers';

export default function SettingsPage() {
  const [unlocked, setUnlocked] = useState(() =>
    typeof window !== 'undefined' && sessionStorage.getItem('settings_unlocked') === 'true'
  );
  const [tab, setTab] = useState<Tab>('school');
  const { dark, toggle: toggleDark } = useTheme();

  // School
  const [school, setSchool] = useState<School | null>(null);
  const [schoolForm, setSchoolForm] = useState({ name: '', address: '', phone: '', email: '', primaryColor: '#F5C400', logoUrl: '', entryTime: '07:30', lateTime: '08:00' });
  const [savingSchool, setSavingSchool] = useState(false);
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
    if (unlocked) {
      fetchSchool();
      fetchUsers();
      fetchReaders();
    }
  }, [unlocked]);

  // ── School ──────────────────────────────────────────
  const saveSchool = async () => {
    setSavingSchool(true);
    try {
      await api.put('/settings/school', schoolForm);
      fetchSchool();
    } catch (e) { console.error(e); }
    setSavingSchool(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSchoolForm(prev => ({ ...prev, logoUrl: reader.result as string }));
    reader.readAsDataURL(file);
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

  if (!unlocked) return <SettingsGate onUnlock={() => setUnlocked(true)} />;

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
              <div className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center shrink-0">
                {schoolForm.logoUrl
                  ? <img src={schoolForm.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  : <span className="text-xs text-gray-400">Sin logo</span>}
              </div>
              <div className="space-y-1">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-gray-700 dark:text-gray-300"
                >
                  <Upload size={12} />
                  Subir imagen
                </button>
                {schoolForm.logoUrl && (
                  <button
                    onClick={() => setSchoolForm(prev => ({ ...prev, logoUrl: '' }))}
                    className="text-xs text-gray-400 hover:text-red-500 transition px-1"
                  >
                    Quitar logo
                  </button>
                )}
              </div>
            </div>
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
