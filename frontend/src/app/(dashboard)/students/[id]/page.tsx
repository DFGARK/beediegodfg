'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, UserCheck, Clock, UserX, Calendar, TrendingUp,
  Edit2, Plus, Trash2, Mail, Phone, ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '@/lib/axios';
import { Student, Attendance, Excuse, Grade } from '@/types';
import Modal from '@/components/ui/Modal';
import AttendanceBadge from '@/components/AttendanceBadge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentStats {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  rate: number;
  attendances: Attendance[];
}

interface HeatmapCell {
  date: string;
  status: string;
  checkInTime?: string;
}

interface TooltipState {
  date: string;
  status: string;
  checkInTime?: string;
  x: number;
  y: number;
}

interface EditFormData {
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

interface ExcuseFormData {
  type: string;
  reason: string;
  description: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CELL = 12;
const GAP = 2;
const STEP = CELL + GAP;

const STATUS_BG: Record<string, string> = {
  PRESENT: '#22c55e',
  LATE:    '#facc15',
  ABSENT:  '#ef4444',
  EXCUSED: '#60a5fa',
  NONE:    '#f3f4f6',
};

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Presente',
  LATE:    'Tarde',
  ABSENT:  'Ausente',
  EXCUSED: 'Excusado',
  NONE:    'Sin dato',
};

const EXCUSE_TYPES = [
  { value: 'MEDICAL',  label: 'Medica' },
  { value: 'FAMILY',   label: 'Familiar' },
  { value: 'OFFICIAL', label: 'Oficial' },
  { value: 'OTHER',    label: 'Otra' },
];

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DAY_LABELS  = ['L','M','X','J','V'];
const PER_PAGE    = 15;

// ─── Heatmap helpers ──────────────────────────────────────────────────────────

function buildYearHeatmap(attendances: Attendance[], year: number): HeatmapCell[][] {
  const map = new Map<string, { status: string; checkInTime?: string }>();
  attendances.forEach(a => {
    const key = a.date.split('T')[0];
    map.set(key, { status: a.status, checkInTime: a.checkInTime });
  });

  const jan1 = new Date(year, 0, 1);
  const dow = jan1.getDay();
  const back = dow === 0 ? 6 : dow - 1;
  const start = new Date(jan1);
  start.setDate(start.getDate() - back);

  const dec31 = new Date(year, 11, 31);
  const weeks: HeatmapCell[][] = [];
  const cur = new Date(start);

  while (cur <= dec31 && weeks.length < 54) {
    const week: HeatmapCell[] = [];
    for (let d = 0; d < 5; d++) {
      const day = new Date(cur);
      day.setDate(day.getDate() + d);
      const ds = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
      const cell = map.get(ds);
      week.push({ date: ds, status: cell?.status || 'NONE', checkInTime: cell?.checkInTime });
    }
    weeks.push(week);
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

function getMonthCols(year: number, totalWeeks: number): Array<{ label: string; col: number }> {
  const jan1 = new Date(year, 0, 1);
  const dow = jan1.getDay();
  const back = dow === 0 ? 6 : dow - 1;
  const start = new Date(jan1);
  start.setDate(start.getDate() - back);

  const result: Array<{ label: string; col: number }> = [];
  let lastMonth = -1;
  for (let w = 0; w < totalWeeks; w++) {
    const mon = new Date(start);
    mon.setDate(mon.getDate() + w * 7);
    if (mon.getFullYear() === year && mon.getMonth() !== lastMonth) {
      lastMonth = mon.getMonth();
      result.push({ label: MONTH_NAMES[lastMonth], col: w });
    }
  }
  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();

const EMPTY_EDIT: EditFormData = {
  studentCode: '', firstName: '', lastName: '', email: '',
  phone: '', rfidUid: '', birthDate: '', address: '', gradeId: '', isActive: true,
};

const EMPTY_EXCUSE: ExcuseFormData = { type: 'MEDICAL', reason: '', description: '' };

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [student, setStudent]   = useState<Student | null>(null);
  const [stats, setStats]       = useState<StudentStats | null>(null);
  const [excuses, setExcuses]   = useState<Excuse[]>([]);
  const [grades, setGrades]     = useState<Grade[]>([]);
  const [heatYear, setHeatYear] = useState(CURRENT_YEAR);
  const [tab, setTab]           = useState<'history' | 'excuses'>('history');
  const [page, setPage]         = useState(1);
  const [tooltip, setTooltip]   = useState<TooltipState | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [editOpen, setEditOpen]     = useState(false);
  const [excuseOpen, setExcuseOpen] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const [editForm, setEditForm]     = useState<EditFormData>(EMPTY_EDIT);
  const [excuseForm, setExcuseForm] = useState<ExcuseFormData>(EMPTY_EXCUSE);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [sRes, stRes, exRes, grRes] = await Promise.all([
        api.get(`/students/${id}`),
        api.get(`/students/${id}/stats`, { params: { year: heatYear } }),
        api.get('/excuses', { params: { studentId: id } }),
        api.get('/grades'),
      ]);
      setStudent(sRes.data);
      setStats(stRes.data);
      setExcuses(exRes.data);
      setGrades(grRes.data);
    } catch {
      setError('No se pudo cargar el perfil del estudiante');
    } finally {
      setLoading(false);
    }
  }, [id, heatYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openEdit = () => {
    if (!student) return;
    setEditForm({
      studentCode: student.studentCode,
      firstName:   student.firstName,
      lastName:    student.lastName,
      email:       student.email    || '',
      phone:       student.phone    || '',
      rfidUid:     student.rfidUid  || '',
      birthDate:   student.birthDate ? student.birthDate.split('T')[0] : '',
      address:     student.address  || '',
      gradeId:     student.gradeId,
      isActive:    student.isActive,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/students/${id}`, editForm);
      setEditOpen(false);
      fetchData();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Desactivar a ${student?.firstName} ${student?.lastName}? El estudiante quedara como inactivo.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/students/${id}`);
      router.push('/students');
    } catch {
      alert('Error al eliminar');
      setDeleting(false);
    }
  };

  const handleSaveExcuse = async () => {
    if (!excuseForm.reason.trim()) return;
    setSaving(true);
    try {
      await api.post('/excuses', { ...excuseForm, studentId: id });
      setExcuseOpen(false);
      setExcuseForm(EMPTY_EXCUSE);
      fetchData();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error || 'Error al crear excusa');
    } finally {
      setSaving(false);
    }
  };

  // ── Guards ────────────────────────────────────────────────────────────────

  if (loading) return <div className="p-8 text-gray-400 text-sm">Cargando...</div>;
  if (error || !student || !stats) {
    return <div className="p-8 text-red-500 text-sm">{error || 'Error al cargar'}</div>;
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const heatmap   = buildYearHeatmap(stats.attendances, heatYear);
  const monthCols = getMonthCols(heatYear, heatmap.length);

  const sortedHistory = [...stats.attendances].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const totalPages  = Math.ceil(sortedHistory.length / PER_PAGE);
  const historyPage = sortedHistory.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const initials = `${student.firstName[0]}${student.lastName[0]}`;
  const fullName = `${student.firstName} ${student.lastName}`;

  // ─ Edit fields (no gradeId / isActive — those are separate controls below)
  const EDIT_FIELDS = [
    { label: 'Codigo',     key: 'studentCode' as const, required: true },
    { label: 'Nombre',     key: 'firstName'   as const, required: true },
    { label: 'Apellido',   key: 'lastName'    as const, required: true },
    { label: 'Correo',     key: 'email'       as const, type: 'email' },
    { label: 'Telefono',   key: 'phone'       as const },
    { label: 'UID RFID',   key: 'rfidUid'     as const },
    { label: 'Nacimiento', key: 'birthDate'   as const, type: 'date' },
    { label: 'Direccion',  key: 'address'     as const },
  ];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5">

      {/* ── Back link ── */}
      <Link
        href="/students"
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition"
      >
        <ArrowLeft size={14} /> Volver a estudiantes
      </Link>

      {/* ── Header card ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-xl bg-[#F5C400] flex items-center justify-center text-xl font-black text-black shrink-0">
            {initials}
          </div>

          {/* Name + badges */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{fullName}</h1>
            <p className="text-sm text-gray-500 font-mono mt-0.5">{student.studentCode}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                {student.grade.name} {student.grade.section}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                student.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
              }`}>
                {student.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={openEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              <Edit2 size={14} /> Editar
            </button>
            <button
              onClick={() => setExcuseOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
            >
              <Plus size={14} /> Excusa
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50 transition disabled:opacity-40"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        </div>

        {/* Quick info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div>
            <p className="flex items-center gap-1 text-xs text-gray-400 mb-1"><Mail size={11} /> Correo</p>
            <p className="text-sm text-gray-700 truncate">{student.email || '—'}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-gray-400 mb-1"><Phone size={11} /> Telefono</p>
            <p className="text-sm text-gray-700">{student.phone || '—'}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-gray-400 mb-1"><Calendar size={11} /> Nacimiento</p>
            <p className="text-sm text-gray-700">
              {student.birthDate ? new Date(student.birthDate).toLocaleDateString('es-GT') : '—'}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-gray-400 mb-1"><Calendar size={11} /> Registro</p>
            <p className="text-sm text-gray-700">
              {student.createdAt ? new Date(student.createdAt).toLocaleDateString('es-GT') : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Dias registrados */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#6366f120' }}>
            <Calendar size={18} style={{ color: '#6366f1' }} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Dias registrados</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>

        {/* Presentes */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#22c55e20' }}>
            <UserCheck size={18} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Presentes</p>
            <p className="text-2xl font-bold text-gray-900">{stats.present}</p>
          </div>
        </div>

        {/* Tardanzas */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#F5C40020' }}>
            <Clock size={18} style={{ color: '#F5C400' }} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Tardanzas</p>
            <p className="text-2xl font-bold text-gray-900">{stats.late}</p>
          </div>
        </div>

        {/* Ausencias */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#ef444420' }}>
            <UserX size={18} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Ausencias</p>
            <p className="text-2xl font-bold text-gray-900">{stats.absent}</p>
          </div>
        </div>

        {/* Tasa con barra de progreso */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#3b82f620' }}>
            <TrendingUp size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-medium">Tasa asistencia</p>
            <p className="text-2xl font-bold text-gray-900">{stats.rate}%</p>
            <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${stats.rate}%`, backgroundColor: '#3b82f6' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Heatmap ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Asistencia anual (Lunes–Viernes)</h2>
          <div className="flex items-center gap-1">
            {[CURRENT_YEAR, CURRENT_YEAR - 1].map(y => (
              <button
                key={y}
                onClick={() => { setHeatYear(y); setPage(1); }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  y === heatYear ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="relative inline-block">
            {/* Month labels row */}
            <div className="relative h-4 mb-1" style={{ width: `${(CELL + GAP) + heatmap.length * STEP}px` }}>
              {monthCols.map(({ label, col }) => (
                <span
                  key={label + col}
                  className="absolute text-xs text-gray-400 leading-none"
                  style={{ left: `${CELL + GAP + col * STEP}px` }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Grid: day labels + week columns */}
            <div className="flex" style={{ gap: `${GAP}px` }}>
              {/* Day labels column */}
              <div className="flex flex-col" style={{ gap: `${GAP}px` }}>
                {DAY_LABELS.map(d => (
                  <div
                    key={d}
                    className="flex items-center justify-center text-xs text-gray-400 select-none"
                    style={{ width: `${CELL}px`, height: `${CELL}px` }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Week columns */}
              {heatmap.map((week, wi) => (
                <div key={wi} className="flex flex-col" style={{ gap: `${GAP}px` }}>
                  {week.map(cell => (
                    <div
                      key={cell.date}
                      style={{
                        width: `${CELL}px`,
                        height: `${CELL}px`,
                        borderRadius: '2px',
                        backgroundColor: STATUS_BG[cell.status],
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => setTooltip({ ...cell, x: e.clientX, y: e.clientY })}
                      onMouseMove={e => setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {Object.entries(STATUS_BG).map(([k, c]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: c, flexShrink: 0 }} />
              <span className="text-xs text-gray-500">{STATUS_LABEL[k]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {(['history', 'excuses'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === 'history') setPage(1); }}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition ${
                tab === t
                  ? 'border-[#F5C400] text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'history' ? 'Historial reciente' : `Excusas${excuses.length ? ` (${excuses.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* History tab */}
        {tab === 'history' && (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Hora entrada</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Lector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historyPage.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-gray-400 text-sm">Sin registros para {heatYear}</td>
                  </tr>
                ) : historyPage.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-700">
                      {new Date(a.date).toLocaleDateString('es-GT')}
                    </td>
                    <td className="px-4 py-2.5">
                      <AttendanceBadge status={a.status} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                      {a.checkInTime
                        ? new Date(a.checkInTime).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {(a as unknown as { reader?: { name: string } }).reader?.name
                        || (a.isManual ? 'Manual' : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, sortedHistory.length)} de {sortedHistory.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 transition"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const p = start + i;
                    return p <= totalPages ? (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-7 h-7 rounded text-xs font-medium transition ${
                          p === page ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {p}
                      </button>
                    ) : null;
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Excuses tab */}
        {tab === 'excuses' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Motivo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Aprobado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {excuses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-gray-400 text-sm">Sin excusas registradas</td>
                </tr>
              ) : excuses.map(ex => (
                <tr key={ex.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(ex.createdAt).toLocaleDateString('es-GT')}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {EXCUSE_TYPES.find(t => t.value === ex.type)?.label ?? ex.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{ex.reason}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{ex.approvedBy || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x + 14, top: tooltip.y - 52 }}
        >
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed whitespace-nowrap">
            <p className="font-semibold">{tooltip.date}</p>
            <p className="text-gray-300">{STATUS_LABEL[tooltip.status]}</p>
            {tooltip.checkInTime && (
              <p className="text-gray-400">
                {new Date(tooltip.checkInTime).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Editar estudiante ── */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar estudiante" size="lg">
        <div className="grid grid-cols-2 gap-4">
          {EDIT_FIELDS.map(({ label, key, required, type }) => (
            <div key={key} className={key === 'address' ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <input
                type={type || 'text'}
                value={editForm[key] as string}
                onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C400]"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Grado <span className="text-red-500">*</span>
            </label>
            <select
              value={editForm.gradeId}
              onChange={e => setEditForm(prev => ({ ...prev, gradeId: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C400] bg-white"
            >
              <option value="">Seleccionar grado...</option>
              {grades.map(g => (
                <option key={g.id} value={g.id}>{g.name} {g.section}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={editForm.isActive ? 'true' : 'false'}
              onChange={e => setEditForm(prev => ({ ...prev, isActive: e.target.value === 'true' }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C400] bg-white"
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setEditOpen(false)}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveEdit}
            disabled={saving}
            className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </Modal>

      {/* ── Modal: + Excusa ── */}
      <Modal open={excuseOpen} onClose={() => setExcuseOpen(false)} title="Agregar excusa">
        <div className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Tipo <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {EXCUSE_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setExcuseForm(prev => ({ ...prev, type: t.value }))}
                  className={`py-2 px-3 rounded-lg text-sm border font-medium transition ${
                    excuseForm.type === t.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Motivo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={excuseForm.reason}
              onChange={e => setExcuseForm(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Describe el motivo de la excusa..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C400]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripcion (opcional)</label>
            <textarea
              value={excuseForm.description}
              onChange={e => setExcuseForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="Detalles adicionales..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C400] resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setExcuseOpen(false)}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveExcuse}
            disabled={saving || !excuseForm.reason.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Agregar excusa'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
