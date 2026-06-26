'use client';
import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { Attendance } from '@/types';

interface Toast {
  id: string;
  type: 'present' | 'late' | 'unknown';
  attendance?: Attendance;
  uid?: string;
  progress: number;
}

const DURATION = 4000;
const TICK = 50;

const STYLES = {
  present: {
    border: 'border-l-green-500',
    avatar: 'bg-green-100 text-green-700',
    label: 'text-green-700',
    bar: 'bg-green-500',
    text: 'Presente',
  },
  late: {
    border: 'border-l-yellow-400',
    avatar: 'bg-yellow-100 text-yellow-700',
    label: 'text-yellow-700',
    bar: 'bg-yellow-400',
    text: 'Tarde',
  },
  unknown: {
    border: 'border-l-red-500',
    avatar: 'bg-red-100 text-red-600',
    label: 'text-red-600',
    bar: 'bg-red-500',
    text: 'No registrado',
  },
};

export default function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((partial: Omit<Toast, 'id' | 'progress'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [{ ...partial, id, progress: 100 }, ...prev].slice(0, 3));

    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed >= DURATION) {
        clearInterval(interval);
        setToasts(prev => prev.filter(t => t.id !== id));
      } else {
        setToasts(prev =>
          prev.map(t => t.id === id ? { ...t, progress: Math.max(0, 100 - (elapsed / DURATION) * 100) } : t)
        );
      }
    }, TICK);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onNew = (att: Attendance) => {
      addToast({ type: att.status === 'LATE' ? 'late' : 'present', attendance: att });
    };

    const onUnknown = ({ rfidUid }: { rfidUid: string }) => {
      addToast({ type: 'unknown', uid: rfidUid });
    };

    socket.on('attendance:new', onNew);
    socket.on('rfid:unknown', onUnknown);
    return () => {
      socket.off('attendance:new', onNew);
      socket.off('rfid:unknown', onUnknown);
    };
  }, [addToast]);

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => {
        const s = STYLES[toast.type];
        const att = toast.attendance;
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto w-72 bg-white rounded-xl shadow-lg border border-gray-100 border-l-4 overflow-hidden ${s.border}`}
          >
            <div className="px-3 py-2.5 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${s.avatar}`}>
                {att
                  ? `${att.student.firstName[0]}${att.student.lastName[0]}`
                  : '?'}
              </div>
              <div className="flex-1 min-w-0">
                {att ? (
                  <>
                    <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                      {att.student.firstName} {att.student.lastName}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {att.student.grade.name} {att.student.grade.section}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-gray-900 leading-tight">Tarjeta desconocida</p>
                    <p className="text-xs font-mono text-gray-400 truncate">{toast.uid}</p>
                  </>
                )}
                <span className={`text-xs font-medium ${s.label}`}>{s.text}</span>
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-gray-300 hover:text-gray-500 transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </div>
            <div className="h-0.5 bg-gray-100">
              <div className={`h-full ${s.bar}`} style={{ width: `${toast.progress}%`, transition: 'width 50ms linear' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
