'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Users, UserCheck, Clock, UserX, TrendingUp, ClipboardList, Search } from 'lucide-react';
import api from '@/lib/axios';
import { Attendance, AttendanceStats, Student } from '@/types';
import StatsCard from '@/components/ui/StatsCard';
import AttendanceBadge from '@/components/AttendanceBadge';
import Modal from '@/components/ui/Modal';

type FilterSection = 'ALL' | 'HS' | 'BYS';
type ManualStatus = 'PRESENT' | 'LATE' | 'EXCUSED';

const STATUS_LABELS: Record<ManualStatus, string> = {
  PRESENT: 'Presente',
  LATE: 'Tarde',
  EXCUSED: 'Excusado',
};

export default function AttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [filter, setFilter] = useState<FilterSection>('ALL');
  const [stats, setStats] = useState<AttendanceStats>({ total: 0, present: 0, late: 0, absent: 0, excused: 0, rate: 0 });
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual attendance modal
  const [manualOpen, setManualOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [manualStatus, setManualStatus] = useState<ManualStatus>('PRESENT');
  const [manualNotes, setManualNotes] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const section = filter !== 'ALL' ? filter : undefined;
      const params = { ...(section && { section }) };
      const [stRes, attRes] = await Promise.all([
        api.get('/attendance/stats', { params: { ...params, date } }),
        api.get(`/attendance/date/${date}`, { params }),
      ]);
      setStats(stRes.data);
      setAttendances(attRes.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [date, filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Buscar estudiantes con debounce
  useEffect(() => {
    if (!studentSearch.trim()) {
      setStudentResults([]);
      setShowDropdown(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/students', { params: { search: studentSearch, isActive: 'true' } });
        setStudentResults(data.slice(0, 8));
        setShowDropdown(true);
      } catch { /* silent */ }
    }, 280);
  }, [studentSearch]);

  const openManual = () => {
    setStudentSearch('');
    setStudentResults([]);
    setSelectedStudent(null);
    setManualStatus('PRESENT');
    setManualNotes('');
    setShowDropdown(false);
    setManualOpen(true);
  };

  const selectStudent = (s: Student) => {
    setSelectedStudent(s);
    setStudentSearch(`${s.firstName} ${s.lastName}`);
    setShowDropdown(false);
  };

  const handleManualSave = async () => {
    if (!selectedStudent) return;
    setManualSaving(true);
    try {
      await api.post('/attendance/manual', {
        studentId: selectedStudent.id,
        status: manualStatus,
        notes: manualNotes || undefined,
        isManual: true,
      });
      setManualOpen(false);
      fetchData();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error || 'Error al registrar');
    }
    setManualSaving(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Asistencias</h1>
          <p className="text-sm text-gray-500">Historial por fecha</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openManual}
            className="flex items-center gap-2 bg-black text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 transition"
          >
            <ClipboardList size={15} />
            Registrar manual
          </button>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {(['ALL', 'HS', 'BYS'] as FilterSection[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  filter === f ? 'bg-[#F5C400] text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f === 'ALL' ? 'Todos' : f}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C400]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard title="Total Estudiantes" value={stats.total} icon={Users} color="#6366f1" />
        <StatsCard title="Presentes" value={stats.present} icon={UserCheck} color="#22c55e" />
        <StatsCard title="Tarde" value={stats.late} icon={Clock} color="#F5C400" />
        <StatsCard title="Ausentes" value={stats.absent} icon={UserX} color="#ef4444" />
        <StatsCard title="Tasa" value={`${stats.rate}%`} icon={TrendingUp} color="#F5C400" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            Registros del {new Date(date + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Estudiante</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Grado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Hora</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Lector</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">Cargando...</td></tr>
            ) : attendances.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">Sin registros para esta fecha</td></tr>
            ) : attendances.map(att => (
              <tr key={att.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#F5C400] flex items-center justify-center text-xs font-bold text-black shrink-0">
                      {att.student.firstName[0]}{att.student.lastName[0]}
                    </div>
                    <div>
                      <a href={`/students/${att.student.id}`} className="font-medium text-gray-900 hover:underline text-sm">
                        {att.student.firstName} {att.student.lastName}
                      </a>
                      <p className="text-xs text-gray-400">{att.student.studentCode}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm">{att.student.grade.name} {att.student.grade.section}</td>
                <td className="px-4 py-3"><AttendanceBadge status={att.status} /></td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{att.reader?.name || (att.isManual ? 'Manual' : '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Registrar asistencia manual */}
      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="Registrar asistencia manual" size="sm">
        <div className="space-y-4">
          {/* Buscador de estudiante */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Estudiante <span className="text-red-500">*</span>
            </label>
            <div ref={searchRef} className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nombre o codigo..."
                value={studentSearch}
                onChange={e => {
                  setStudentSearch(e.target.value);
                  if (selectedStudent) setSelectedStudent(null);
                }}
                onFocus={() => studentResults.length > 0 && setShowDropdown(true)}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
              {showDropdown && studentResults.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                  {studentResults.map(s => (
                    <li
                      key={s.id}
                      onMouseDown={() => selectStudent(s)}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                    >
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
                        {s.firstName[0]}{s.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-gray-400">{s.studentCode} · {s.grade.name} {s.grade.section}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
            <div className="flex gap-2">
              {(Object.keys(STATUS_LABELS) as ManualStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => setManualStatus(s)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition ${
                    manualStatus === s
                      ? s === 'PRESENT' ? 'bg-green-50 border-green-300 text-green-700'
                        : s === 'LATE' ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                        : 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Nota opcional */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nota <span className="text-gray-400 font-normal">(opcional)</span></label>
            <input
              type="text"
              placeholder="Ej: llegó al segundo periodo..."
              value={manualNotes}
              onChange={e => setManualNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setManualOpen(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleManualSave}
              disabled={!selectedStudent || manualSaving}
              className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-40"
            >
              {manualSaving ? 'Registrando...' : 'Registrar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
