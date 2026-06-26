'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import api from '@/lib/axios';
import { Excuse, Student, ExcuseType } from '@/types';
import Modal from '@/components/ui/Modal';

const EXCUSE_TYPES: { value: ExcuseType; label: string; color: string }[] = [
  { value: 'MEDICAL', label: 'Medica', color: 'bg-red-100 text-red-700' },
  { value: 'FAMILY', label: 'Familiar', color: 'bg-purple-100 text-purple-700' },
  { value: 'OFFICIAL', label: 'Oficial', color: 'bg-blue-100 text-blue-700' },
  { value: 'OTHER', label: 'Otra', color: 'bg-gray-100 text-gray-600' },
];

const typeConfig = Object.fromEntries(EXCUSE_TYPES.map(t => [t.value, t]));

interface ExcuseForm {
  studentId: string;
  reason: string;
  description: string;
  type: ExcuseType;
}

export default function ExcusesPage() {
  const [excuses, setExcuses] = useState<Excuse[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [form, setForm] = useState<ExcuseForm>({ studentId: '', reason: '', description: '', type: 'OTHER' });
  const [saving, setSaving] = useState(false);

  const fetchExcuses = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/excuses');
      setExcuses(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchExcuses(); }, []);

  useEffect(() => {
    if (studentSearch.length < 2) { setStudentResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await api.get('/students', { params: { search: studentSearch, isActive: 'true' } });
      setStudentResults(data.slice(0, 6));
    }, 300);
    return () => clearTimeout(t);
  }, [studentSearch]);

  const selectStudent = (s: Student) => {
    setSelectedStudent(s);
    setForm(prev => ({ ...prev, studentId: s.id }));
    setStudentSearch('');
    setStudentResults([]);
  };

  const handleSave = async () => {
    if (!form.studentId || !form.reason) return;
    setSaving(true);
    try {
      await api.post('/excuses', form);
      setModalOpen(false);
      setForm({ studentId: '', reason: '', description: '', type: 'OTHER' });
      setSelectedStudent(null);
      fetchExcuses();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error || 'Error al guardar');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta excusa?')) return;
    await api.delete(`/excuses/${id}`);
    fetchExcuses();
  };

  const openModal = () => {
    setForm({ studentId: '', reason: '', description: '', type: 'OTHER' });
    setSelectedStudent(null);
    setStudentSearch('');
    setModalOpen(true);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Excusas</h1>
          <p className="text-sm text-gray-500">{excuses.length} registros</p>
        </div>
        <button onClick={openModal} className="flex items-center gap-2 bg-black text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 transition">
          <Plus size={16} /> Nueva excusa
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Estudiante</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Motivo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Aprobado por</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Cargando...</td></tr>
            ) : excuses.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Sin excusas registradas</td></tr>
            ) : excuses.map(ex => {
              const tc = typeConfig[ex.type];
              return (
                <tr key={ex.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#F5C400] flex items-center justify-center text-xs font-bold text-black shrink-0">
                        {ex.student.firstName[0]}{ex.student.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{ex.student.firstName} {ex.student.lastName}</p>
                        <p className="text-xs text-gray-400">{ex.student.grade?.name} {ex.student.grade?.section}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${tc.color}`}>{tc.label}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs">
                    <p className="truncate">{ex.reason}</p>
                    {ex.description && <p className="text-xs text-gray-400 truncate">{ex.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(ex.createdAt).toLocaleDateString('es-GT')}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{ex.approvedBy || '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(ex.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva excusa" size="md">
        <div className="space-y-4">
          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1">Estudiante <span className="text-red-500">*</span></label>
            {selectedStudent ? (
              <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedStudent.firstName} {selectedStudent.lastName}</p>
                  <p className="text-xs text-gray-500">{selectedStudent.grade?.name} {selectedStudent.grade?.section}</p>
                </div>
                <button onClick={() => { setSelectedStudent(null); setForm(prev => ({ ...prev, studentId: '' })); }} className="text-xs text-gray-400 hover:text-red-500">Cambiar</button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar estudiante..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C400]"
                  />
                </div>
                {studentResults.length > 0 && (
                  <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {studentResults.map(s => (
                      <button
                        key={s.id}
                        onClick={() => selectStudent(s)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0"
                      >
                        <span className="font-medium">{s.firstName} {s.lastName}</span>
                        <span className="text-gray-400 ml-2">{s.grade?.name} {s.grade?.section}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Tipo de excusa <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {EXCUSE_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, type: t.value }))}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium border-2 transition ${
                    form.type === t.value ? 'border-[#F5C400] bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Motivo <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.reason}
              onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Motivo de la excusa..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C400]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripcion adicional</label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="Detalles adicionales..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C400] resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.studentId || !form.reason}
            className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-40"
          >
            {saving ? 'Guardando...' : 'Registrar excusa'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
