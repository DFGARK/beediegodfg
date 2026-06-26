'use client';
import { useEffect, useState, useCallback } from 'react';
import { Users, UserCheck, Clock, UserX, TrendingUp } from 'lucide-react';
import api from '@/lib/axios';
import { getSocket } from '@/lib/socket';
import { Attendance, AttendanceStats } from '@/types';
import StatsCard from '@/components/ui/StatsCard';
import AttendanceBadge from '@/components/AttendanceBadge';

type FilterSection = 'ALL' | 'HS' | 'BYS';

interface GradeStat {
  id: string;
  name: string;
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  rate: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AttendanceStats>({ total: 0, present: 0, late: 0, absent: 0, excused: 0, rate: 0 });
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [gradeStats, setGradeStats] = useState<GradeStat[]>([]);
  const [filter, setFilter] = useState<FilterSection>('ALL');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const section = filter !== 'ALL' ? filter : undefined;
      const params = section ? { section } : {};
      const [statsRes, attRes, gradeRes] = await Promise.all([
        api.get('/attendance/stats', { params }),
        api.get('/attendance/today', { params }),
        api.get('/attendance/stats-by-grade'),
      ]);
      setStats(statsRes.data);
      setAttendances(attRes.data);
      setGradeStats(gradeRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
    const socket = getSocket();
    const onNew = (att: Attendance) => {
      setAttendances(prev => {
        const exists = prev.find(a => a.id === att.id);
        if (exists) return prev.map(a => a.id === att.id ? att : a);
        return [att, ...prev];
      });
      fetchData();
    };
    socket.on('attendance:new', onNew);
    socket.on('attendance:updated', onNew);
    return () => { socket.off('attendance:new', onNew); socket.off('attendance:updated', onNew); };
  }, [fetchData]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-medium text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-400">
          {new Date().toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard title="Total Estudiantes" value={stats.total} icon={Users} color="#6366f1" />
        <StatsCard title="Presentes" value={stats.present} icon={UserCheck} color="#22c55e" />
        <StatsCard title="Tarde" value={stats.late} icon={Clock} color="#F5C400" />
        <StatsCard title="Ausentes" value={stats.absent} icon={UserX} color="#ef4444" />
        <StatsCard title="Tasa Asistencia" value={`${stats.rate}%`} icon={TrendingUp} color="#F5C400" subtitle="Presentes + Tarde" />
      </div>

      {/* Resumen por grado */}
      {gradeStats.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900 text-sm">Resumen por grado — hoy</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Grado</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400">Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-green-600">Presentes</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-yellow-600">Tarde</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-red-500">Ausentes</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400">% Asistencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {gradeStats.map(g => (
                <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-800 text-sm">{g.name}</td>
                  <td className="px-4 py-2.5 text-center text-gray-500">{g.total}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="inline-block min-w-[24px] text-center font-medium text-green-700 bg-green-50 rounded px-1.5 py-0.5 text-xs">
                      {g.present}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="inline-block min-w-[24px] text-center font-medium text-yellow-700 bg-yellow-50 rounded px-1.5 py-0.5 text-xs">
                      {g.late}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="inline-block min-w-[24px] text-center font-medium text-red-600 bg-red-50 rounded px-1.5 py-0.5 text-xs">
                      {g.absent}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${g.rate >= 90 ? 'bg-green-500' : g.rate >= 70 ? 'bg-yellow-400' : 'bg-red-500'}`}
                          style={{ width: `${g.rate}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-9 text-right">{g.rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabla de asistencias de hoy */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-medium text-gray-900 text-sm">Asistencias de hoy</h2>
          <div className="flex gap-1">
            {(['ALL', 'HS', 'BYS'] as FilterSection[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filter === f ? 'bg-[#F5C400] text-black' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {f === 'ALL' ? 'Todos' : f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Estudiante</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Grado</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Hora</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Lector</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">Cargando...</td></tr>
              ) : attendances.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">Sin registros por hoy</td></tr>
              ) : attendances.map(att => (
                <tr key={att.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
                        {att.student.firstName[0]}{att.student.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{att.student.firstName} {att.student.lastName}</p>
                        <p className="text-xs text-gray-400">{att.student.studentCode}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{att.student.grade.name} {att.student.grade.section}</td>
                  <td className="px-4 py-3"><AttendanceBadge status={att.status} /></td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{att.reader?.name || (att.isManual ? 'Manual' : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
