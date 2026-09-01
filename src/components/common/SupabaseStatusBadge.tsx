import React from 'react';
import { useAuth } from '../../context/AuthContext';

/**
 * Indicador de diagnóstico (temporal): muestra si la app detecta la
 * configuración de Supabase. Ayuda a distinguir caché/versión antigua
 * de un problema real de configuración.
 */
export const SupabaseStatusBadge: React.FC = () => {
  const { isSupabaseConfigured } = useAuth();
  return (
    <div
      className={`fixed top-2 right-2 z-[9999] text-[10px] font-mono px-2 py-1 rounded-md border select-none ${
        isSupabaseConfigured
          ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
          : 'bg-red-950/70 border-red-500/50 text-red-300'
      }`}
    >
      {isSupabaseConfigured ? 'Supabase: ✓ conectado' : 'Supabase: ✗ sin configurar'}
    </div>
  );
};
