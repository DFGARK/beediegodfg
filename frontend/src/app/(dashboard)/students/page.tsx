'use client';
import { useEffect, useState, useCallback } from 'react';
import { Search, Plus, Edit2, Wifi, CreditCard, X } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';
import { Student, Grade } from '@/types';
import Modal from '@/components/ui/Modal';

interface StudentFormData {
  studentCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  rfidUid: string;
  birthDate: string;
  address: string;
  gradeId: string;
  isActive: boolean;
}

interface UnknownUid {
  uid: string;
  count: number;
  lastSeen: string;
  readerId: string;
  readerName: string;
}

const emptyForm: StudentFormData = {
  studentCode: '', firstName: '', lastName: '', email: '', phone: '',
  rfidUid: '', birthDate: '', address: '', gradeId: '', isActive: true,
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [lockedRfid, setLockedRfid] = useState(false);
  const [unknownUids, setUnknownUids] = useState<UnknownUid[]>([]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { isActive: 'true' };
      if (search) params.search = search;
      if (gradeFilter) params.gradeId = gradeFilter;
      const { data } = await api.get('/students', { params });
      setStudents(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchUnknownUids = useCallback(async () => {
    try {
      const { data } = await api.get('/readers/unknown-uids');
      setUnknownUids(data);
    } catch (e) { /* silent */ }
  }, []);

  useEffect(() => {
    api.get('/grades').then(r => setGrades(r.data));
  }, []);

  useEffect(() => { fetchStudents(); }, [search, gradeFilter]);

  useEffect(() => {
    fetchUnknownUids();
    const interval = setInterval(fetchUnknownUids, 10000);
    return () => clearInterval(interval);
  }, [fetchUnknownUids]);

  const openCreate = (prefillUid?: string) => {
    setEditing(null);
    setForm({ ...emptyForm, rfidUid: prefillUid || '' });
    setLockedRfid(!!prefillUid);
    setModalOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditing(s);
    setLockedRfid(false);
    setForm({
      studentCode: s.studentCode, firstName: s.firstName, lastName: s.lastName,
      email: s.email || '', phone: s.phone || '', rfidUid: s.rfidUid || '',
      birthDate: s.birthDate ? s.birthDate.split('T')[0] : '',
      address: s.address || '', gradeId: s.gradeId, isActive: s.isActive,
    });
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setLockedRfid(false);
  };

  const deleteUnknownUid = async (uid: string) => {
    if (!confirm(`¿Eliminar la tarjeta ${uid} de la lista?`)) return;
    try {
      await api.delete(`/readers/unknown-uids/${uid}`);
      setUnknownUids(prev => prev.filter(u => u.uid !== uid));
    } catch (e) {
      console.error(e);
      alert('Error al eliminar');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/students/${editing.id}`, form);
      } else {
        await api.post('/students', form);
      }
      handleClose();
      fetchStudents();
      fetchUnknownUids();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error || 'Error al guardar');
    }
    setSaving(false);
  };

  const field = (key: keyof StudentFormData) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Estudiantes</h1>
          <p className="text-sm text-gray-400">{students.length} estudiantes activos</p>
        </div>
        <button onClick={() => openCreate()} className="flex items-center gap-2 bg-black text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 transition">
          <Plus size={15} /> Nuevo estudiante
        </button>
      </div>

      {unknownUids.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard size={13} className="text-gray-400" />
            <p className="text-xs font-medium text-gray-500">Tarjetas detectadas sin registrar ({unknownUids.length})</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {unknownUids.map(u => (
              <div key={u.uid} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-xs bg-gray-50">
                <span className="font-mono text-gray-700">{u.uid}</span>
                <span className="text-gray-300">·</span>
                <span className="text-gray-400">{u.count}x</span>
                <span className="text-gray-300">·</span>
                <span className="text-gray-400">{u.readerName}</span>
                <button
                  onClick={() => openCreate(u.uid)}
                  className="ml-1 text-xs bg-black text-white rounded px-2 py-0.5 hover:bg-gray-800 transition"
                >
                  Registrar
                </button>
                <button
                  onClick={() => deleteUnknownUid(u.uid)}
                  className="ml-0.5 text-gray-300 hover:text-red-500 transition-colors"
                  title="Eliminar de la lista"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o codigo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </div>
        <select
          value={gradeFilter}
          onChange={e => setGradeFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
        >
          <option value="">Todos los grados</option>
          {grades.map(g => <option key={g.id} value={g.id}>{g.name} {g.section}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Estudiante</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Codigo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Grado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">RFID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Contacto</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Cargando...</td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Sin estudiantes</td></tr>
            ) : students.map(s => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
                      {s.firstName[0]}{s.lastName[0]}
                    </div>
                    <Link href={`/students/${s.id}`} className="font-medium text-gray-900 hover:text-black hover:underline">
                      {s.firstName} {s.lastName}
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.studentCode}</td>
                <td className="px-4 py-3 text-gray-600">{s.grade.name} {s.grade.section}</td>
                <td className="px-4 py-3">
                  {s.rfidUid
                    ? <span className="flex items-center gap-1 text-xs text-gray-600"><Wifi size={11} className="text-gray-400" />{s.rfidUid}</span>
                    : <span className="text-xs text-gray-400">Sin RFID</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{s.email || s.phone || '—'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(s)} className="text-gray-300 hover:text-gray-700 transition-colors">
                    <Edit2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={handleClose} title={editing ? 'Editar estudiante' : 'Nuevo estudiante'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Codigo de estudiante', key: 'studentCode', required: true },
            { label: 'Nombre', key: 'firstName', required: true },
            { label: 'Apellido', key: 'lastName', required: true },
            { label: 'Correo electronico', key: 'email', type: 'email' },
            { label: 'Telefono', key: 'phone' },
            { label: 'UID RFID', key: 'rfidUid', readOnly: lockedRfid },
            { label: 'Fecha de nacimiento', key: 'birthDate', type: 'date' },
            { label: 'Direccion', key: 'address' },
          ].map(({ label, key, required, type, readOnly }) => (
            <div key={key} className={key === 'address' ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                {readOnly && <span className="ml-1 text-[10px] text-gray-400 font-normal">(tarjeta fisica)</span>}
              </label>
              <input
                type={type || 'text'}
                required={required}
                readOnly={readOnly}
                {...field(key as keyof StudentFormData)}
                className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 ${readOnly ? 'bg-gray-50 text-gray-500 cursor-default font-mono' : ''}`}
              />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Grado <span className="text-red-500">*</span></label>
            <select
              value={form.gradeId}
              onChange={e => setForm(prev => ({ ...prev, gradeId: e.target.value }))}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
            >
              <option value="">Seleccionar grado...</option>
              {grades.map(g => <option key={g.id} value={g.id}>{g.name} {g.section}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
          >
            {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear estudiante'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
