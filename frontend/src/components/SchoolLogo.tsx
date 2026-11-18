'use client';
import { GraduationCap } from 'lucide-react';

export const SCHOOL_UPDATED_EVENT = 'school-updated';

/** Avisa al resto de la app (p. ej. el Sidebar) que los datos del colegio cambiaron. */
export function notifySchoolUpdated() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SCHOOL_UPDATED_EVENT));
}

interface Props {
  src?: string | null;
  size?: number;
  className?: string;
}

/** Logo del colegio. Se ajusta al espacio sin deformarse; si no hay imagen muestra un icono. */
export default function SchoolLogo({ src, size = 36, className = '' }: Props) {
  return (
    <div
      className={`rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${className}`}
      style={{ width: size, height: size }}
    >
      {src
        ? <img src={src} alt="Logo del colegio" className="w-full h-full object-contain" />
        : <GraduationCap size={Math.round(size * 0.5)} className="text-gray-400 dark:text-gray-500" aria-label="Sin logo" />}
    </div>
  );
}
