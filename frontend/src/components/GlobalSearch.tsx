'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import api from '@/lib/axios';
import { Student } from '@/types';

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Student[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/students', { params: { search: q, isActive: 'true' } });
        setResults((data as Student[]).slice(0, 7));
        setSelectedIdx(0);
      } catch { /* silent */ }
    }, 200);
  }, []);

  useEffect(() => { search(query); }, [query, search]);

  const go = (s: Student) => {
    router.push(`/students/${s.id}`);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[selectedIdx]) go(results[selectedIdx]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar estudiante por nombre o codigo..."
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          <kbd className="text-[10px] bg-gray-100 text-gray-400 rounded px-1.5 py-0.5 font-mono shrink-0">ESC</kbd>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <ul className="py-1 max-h-80 overflow-y-auto">
            {results.map((s, i) => (
              <li
                key={s.id}
                onMouseEnter={() => setSelectedIdx(i)}
                onClick={() => go(s)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                  i === selectedIdx ? 'bg-gray-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-[#F5C400] flex items-center justify-center text-xs font-bold text-black shrink-0">
                  {s.firstName[0]}{s.lastName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.firstName} {s.lastName}</p>
                  <p className="text-xs text-gray-400">{s.studentCode} · {s.grade.name} {s.grade.section}</p>
                </div>
                {i === selectedIdx && (
                  <kbd className="text-[10px] bg-gray-100 text-gray-400 rounded px-1.5 py-0.5 font-mono shrink-0">↵</kbd>
                )}
              </li>
            ))}
          </ul>
        ) : query ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin resultados para &ldquo;{query}&rdquo;</p>
        ) : (
          <p className="text-xs text-gray-400 text-center py-6">Escribe para buscar estudiantes...</p>
        )}

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3 text-[10px] text-gray-400">
          <span><kbd className="font-mono bg-gray-100 rounded px-1">↑↓</kbd> navegar</span>
          <span><kbd className="font-mono bg-gray-100 rounded px-1">↵</kbd> abrir</span>
          <span><kbd className="font-mono bg-gray-100 rounded px-1">Ctrl K</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}
