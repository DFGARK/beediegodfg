import { AttendanceStatus } from '@/types';

const CONFIG: Record<AttendanceStatus, { label: string; className: string }> = {
  PRESENT:  { label: 'Presente',  className: 'bg-green-100 text-green-800' },
  LATE:     { label: 'Tarde',     className: 'bg-yellow-100 text-yellow-800' },
  ABSENT:   { label: 'Ausente',   className: 'bg-red-100 text-red-700' },
  EXCUSED:  { label: 'Excusado',  className: 'bg-blue-100 text-blue-800' },
};

export default function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const { label, className } = CONFIG[status];
  return (
    <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  );
}
