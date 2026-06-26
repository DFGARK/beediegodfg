'use client';
import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import api from '@/lib/axios';
import { Reader } from '@/types';

export default function ReadersPage() {
  const [readers, setReaders] = useState<Reader[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchReaders = async () => {
    try {
      const { data } = await api.get('/readers');
      setReaders(data);
      setLastRefresh(new Date());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    fetchReaders();
    const interval = setInterval(fetchReaders, 30000);
    return () => clearInterval(interval);
  }, []);

  const timeSince = (dateStr?: string) => {
    if (!dateStr) return 'Nunca';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Hace un momento';
    if (mins < 60) return `Hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs}h`;
    return `Hace ${Math.floor(hrs / 24)} dias`;
  };

  const isStale = (reader: Reader) => {
    if (!reader.lastSeen) return true;
    return Date.now() - new Date(reader.lastSeen).getTime() > 5 * 60 * 1000;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lectores RFID</h1>
          <p className="text-sm text-gray-500">Estado de los lectores ESP32 — auto-refresh cada 30s</p>
        </div>
        <button
          onClick={fetchReaders}
          className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          [1, 2].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
              <div className="h-5 bg-gray-100 rounded w-1/2 mb-4" />
              <div className="h-4 bg-gray-100 rounded w-3/4" />
            </div>
          ))
        ) : readers.length === 0 ? (
          <div className="col-span-2 text-center py-16 text-gray-400">
            <WifiOff size={40} className="mx-auto mb-2 opacity-50" />
            <p>Sin lectores configurados</p>
          </div>
        ) : readers.map(reader => {
          const online = reader.isOnline && !isStale(reader);
          return (
            <div key={reader.id} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900 text-base">{reader.name}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{reader.location || 'Sin ubicacion'}</p>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {online
                    ? <><Wifi size={12} /> En linea</>
                    : <><WifiOff size={12} /> Sin conexion</>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">ID del lector</p>
                  <p className="text-xs font-mono text-gray-700 truncate">{reader.id}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">IP Address</p>
                  <p className="text-xs font-mono text-gray-700">{reader.ipAddress || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Ultima conexion</p>
                  <p className="text-xs text-gray-700">{timeSince(reader.lastSeen)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Total lecturas</p>
                  <p className="text-xs font-semibold text-gray-700">{reader._count?.attendances ?? 0}</p>
                </div>
              </div>

              {!online && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-xs text-red-600">
                  <AlertCircle size={14} />
                  Lector sin comunicacion. Verificar conexion WiFi y alimentacion.
                </div>
              )}

              <div className="text-xs text-gray-400 flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`} />
                {online ? 'Conectado y operativo' : 'Desconectado'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Configuracion ESP32</h3>
        <div className="bg-gray-900 rounded-lg p-4 text-xs font-mono text-green-400 space-y-1">
          <p className="text-gray-500">// Endpoint para registrar asistencia (POST)</p>
          <p>POST http://{'<servidor>'}:4000/api/v1/attendance/register</p>
          <p className="text-gray-500 mt-2">// Headers requeridos</p>
          <p>x-api-key: beehive_esp32_key_2026</p>
          <p>Content-Type: application/json</p>
          <p className="text-gray-500 mt-2">// Body JSON</p>
          <p>{'{'} &quot;rfidUid&quot;: &quot;ABCD1234&quot;, &quot;readerId&quot;: &quot;reader-entrada-principal&quot; {'}'}</p>
          <p className="text-gray-500 mt-2">// Heartbeat (POST, cada 60s)</p>
          <p>POST http://{'<servidor>'}:4000/api/v1/readers/reader-entrada-principal/heartbeat</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-right">
        Ultima actualizacion: {lastRefresh.toLocaleTimeString('es-GT')}
      </p>
    </div>
  );
}
