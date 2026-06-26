'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Download, FileSpreadsheet, Search, User } from 'lucide-react';
import api from '@/lib/axios';
import { Student } from '@/types';

export default function ReportsPage() {
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);
  const [monthlyMonth, setMonthlyMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // Reporte por estudiante
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [studentFrom, setStudentFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [studentTo, setStudentTo] = useState(new Date().toISOString().split('T')[0]);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchStudents = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setStudentResults([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/students', { params: { search: q, isActive: 'true' } });
        setStudentResults((data as Student[]).slice(0, 7));
        setShowDropdown(true);
      } catch { /* silent */ }
    }, 250);
  }, []);

  useEffect(() => { searchStudents(studentQuery); }, [studentQuery, searchStudents]);

  const selectStudent = (s: Student) => {
    setSelectedStudent(s);
    setStudentQuery(`${s.firstName} ${s.lastName}`);
    setShowDropdown(false);
  };

  const downloadBlob = async (url: string, params: Record<string, string | number>, filename: string) => {
    const { data } = await api.get(url, { params, responseType: 'blob' });
    const blobUrl = URL.createObjectURL(new Blob([data]));
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  const downloadDaily = async () => {
    setLoadingDaily(true);
    try {
      await downloadBlob('/reports/daily', { date: dailyDate }, `asistencia_${dailyDate}.xlsx`);
    } catch { alert('Error al generar reporte'); }
    setLoadingDaily(false);
  };

  const downloadMonthly = async () => {
    setLoadingMonthly(true);
    try {
      const [year, month] = monthlyMonth.split('-');
      await downloadBlob('/reports/monthly', { month: parseInt(month), year: parseInt(year) }, `reporte_mensual_${monthlyMonth}.xlsx`);
    } catch { alert('Error al generar reporte'); }
    setLoadingMonthly(false);
  };

  const downloadStudent = async () => {
    if (!selectedStudent) return;
    setLoadingStudent(true);
    try {
      await downloadBlob(
        `/reports/student/${selectedStudent.id}`,
        { from: studentFrom, to: studentTo },
        `historial_${selectedStudent.studentCode}_${studentFrom}_${studentTo}.xlsx`
      );
    } catch { alert('Error al generar reporte'); }
    setLoadingStudent(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500">Exportar asistencias en formato Excel</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reporte Diario */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center">
              <FileSpreadsheet size={22} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Reporte Diario</h2>
              <p className="text-xs text-gray-500">Asistencias de un dia especifico</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha del reporte</label>
            <input
              type="date"
              value={dailyDate}
              onChange={e => setDailyDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C400]"
            />
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
            <p>Incluye: nombre, codigo, grado, estado, hora de entrada</p>
            <p>Encabezado con color institucional <span className="font-mono bg-yellow-100 px-1 rounded">#F5C400</span></p>
          </div>
          <button
            onClick={downloadDaily}
            disabled={loadingDaily}
            className="w-full flex items-center justify-center gap-2 bg-[#F5C400] text-black font-bold rounded-lg py-2.5 text-sm hover:bg-yellow-400 transition disabled:opacity-50"
          >
            <Download size={16} />
            {loadingDaily ? 'Generando...' : 'Descargar Excel'}
          </button>
        </div>

        {/* Reporte Mensual */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center">
              <FileSpreadsheet size={22} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Reporte Mensual</h2>
              <p className="text-xs text-gray-500">Asistencias de un mes completo</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Mes del reporte</label>
            <input
              type="month"
              value={monthlyMonth}
              onChange={e => setMonthlyMonth(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C400]"
            />
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
            <p>Incluye: columnas por dia (L–V), totales P/T/A y tasa %</p>
            <p>Solo dias habiles — excluye sabados y domingos</p>
          </div>
          <button
            onClick={downloadMonthly}
            disabled={loadingMonthly}
            className="w-full flex items-center justify-center gap-2 bg-[#F5C400] text-black font-bold rounded-lg py-2.5 text-sm hover:bg-yellow-400 transition disabled:opacity-50"
          >
            <Download size={16} />
            {loadingMonthly ? 'Generando...' : 'Descargar Excel'}
          </button>
        </div>

        {/* Reporte por Estudiante */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 md:col-span-2 md:max-w-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-purple-50 rounded-xl flex items-center justify-center">
              <User size={22} className="text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Reporte por Estudiante</h2>
              <p className="text-xs text-gray-500">Historial completo de un estudiante</p>
            </div>
          </div>

          {/* Buscador de estudiante */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Estudiante</label>
            <div ref={searchRef} className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nombre o codigo..."
                value={studentQuery}
                onChange={e => { setStudentQuery(e.target.value); if (selectedStudent) setSelectedStudent(null); }}
                onFocus={() => studentResults.length > 0 && setShowDropdown(true)}
                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C400]"
              />
              {showDropdown && studentResults.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
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

          {/* Rango de fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Desde</label>
              <input
                type="date"
                value={studentFrom}
                onChange={e => setStudentFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C400]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hasta</label>
              <input
                type="date"
                value={studentTo}
                onChange={e => setStudentTo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C400]"
              />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
            <p>Incluye: fecha, estado, hora de entrada, lector o tipo de registro</p>
            <p>Encabezado amarillo Beehive con nombre del estudiante</p>
          </div>

          <button
            onClick={downloadStudent}
            disabled={!selectedStudent || loadingStudent}
            className="w-full flex items-center justify-center gap-2 bg-[#F5C400] text-black font-bold rounded-lg py-2.5 text-sm hover:bg-yellow-400 transition disabled:opacity-40"
          >
            <Download size={16} />
            {loadingStudent ? 'Generando...' : 'Descargar Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}
