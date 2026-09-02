/**
 * Sistema de Analítica REAL para ClipForge.
 * Registra eventos en Supabase (tabla 'eventos') con respaldo en localStorage, y
 * el resumen de métricas se calcula SOLO con datos reales:
 *   - Visitas / clicks / errores  → eventos reales de trackEvent().
 *   - Proyectos / clips exportados → tablas 'proyectos' y 'clips' de Supabase
 *     para el usuario autenticado.
 * NO se inventa ningún número: sin datos, todo queda en 0 y series vacías.
 */

import { supabase } from './supabase/client';

export type TipoEvento =
  | 'visita_landing'
  | 'click_empezar_gratis'
  | 'proyecto_creado'
  | 'clip_exportado'
  | 'error_sistema'
  | 'cambio_idioma'
  | 'conexion_youtube';

export interface EventoData {
  id?: string;
  tipo: TipoEvento;
  ruta: string;
  user_id?: string | null;
  metadata?: Record<string, any>;
  timestamp: string;
}

const LOCAL_STORAGE_KEY = 'clipforge_analytics_events';

/**
 * Registra un evento de analítica.
 */
export async function trackEvent(
  tipo: TipoEvento,
  metadata: Record<string, any> = {},
  userId?: string | null
): Promise<void> {
  const ruta = typeof window !== 'undefined' ? window.location.pathname : '/';
  const timestamp = new Date().toISOString();

  const nuevoEvento: EventoData = {
    id: 'evt-' + Math.random().toString(36).substring(2, 9),
    tipo,
    ruta,
    user_id: userId || null,
    metadata,
    timestamp,
  };

  // 1. Guardar siempre en LocalStorage (últimos 200 eventos)
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const items: EventoData[] = raw ? JSON.parse(raw) : [];
      items.unshift(nuevoEvento);
      if (items.length > 200) items.length = 200;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    }
  } catch (e) {
    console.warn('Analytics local storage note:', e);
  }

  // 2. Intentar registrar en Supabase (no bloqueante; falla en silencio si la
  //    tabla 'eventos' aún no existe -> ejecutar la migración correspondiente).
  try {
    (supabase.from('eventos') as any)
      .insert({
        tipo,
        ruta,
        user_id: userId || null,
        metadata: JSON.stringify(metadata),
        fecha: timestamp,
      })
      .then(() => {})
      .catch(() => {});
  } catch {
    // silencioso
  }
}

// Helpers semánticos rápidos
export const trackLandingVisit = () => trackEvent('visita_landing', { referrer: typeof document !== 'undefined' ? document.referrer : '' });
export const trackClickEmpezar = (origen: string = 'hero') => trackEvent('click_empezar_gratis', { origen });
export const trackProjectCreated = (projectId: string, origen: 'subida_local' | 'youtube', userId?: string | null) =>
  trackEvent('proyecto_creado', { project_id: projectId, origen }, userId);
export const trackClipExported = (clipId: string, estilo: string, userId?: string | null) =>
  trackEvent('clip_exportado', { clip_id: clipId, estilo }, userId);
export const trackError = (error: string, origen: string) =>
  trackEvent('error_sistema', { error, origen });

/**
 * Obtiene métricas y series temporales para el dashboard de estadísticas.
 */
export interface MetricasResumen {
  totalVisitas: number;
  totalClicksEmpezar: number;
  totalProyectos: number;
  totalClipsExportados: number;
  totalErrores: number;
  tasaConversionCTR: number;
  tasaExportacion: number;
  actividadPorDia: Array<{ fecha: string; visitas: number; proyectos: number; exportaciones: number }>;
  distribucionEventos: Array<{ name: string; value: number; color: string }>;
  ultimosEventos: EventoData[];
}

function leerEventosLocales(): EventoData[] {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {
    return [];
  }
  return [];
}

const claveDia = (d: Date) => d.toISOString().slice(0, 10);

function sumarDia(mapa: Map<string, number>, iso?: string | null) {
  if (!iso) return;
  const k = String(iso).slice(0, 10);
  mapa.set(k, (mapa.get(k) || 0) + 1);
}

/**
 * MÉTRICAS 100% REALES.
 * Async porque consulta Supabase (proyectos/clips del usuario autenticado).
 * Sin sesión o sin datos, devuelve ceros y series vacías: nada inventado.
 */
export async function getAnalyticsSummary(): Promise<MetricasResumen> {
  const eventos = leerEventosLocales();

  const totalVisitas = eventos.filter((e) => e.tipo === 'visita_landing').length;
  const totalClicksEmpezar = eventos.filter((e) => e.tipo === 'click_empezar_gratis').length;
  const totalErrores = eventos.filter((e) => e.tipo === 'error_sistema').length;

  let totalProyectos = 0;
  let totalClipsExportados = 0;
  const proyectosPorDia = new Map<string, number>();
  const exportPorDia = new Map<string, number>();

  try {
    const { data: sesion } = await supabase.auth.getSession();
    const uid = sesion?.session?.user?.id || null;

    if (uid) {
      // Proyectos reales del usuario (RLS: solo los suyos).
      const { data: pros } = await supabase.from('proyectos').select('creado_en').eq('user_id', uid);
      totalProyectos = pros?.length || 0;
      (pros || []).forEach((p) => sumarDia(proyectosPorDia, p.creado_en));

      // Clips reales en estado final, del usuario (vía proyecto).
      const { data: clips } = await supabase
        .from('clips')
        .select('estado, creado_en, proyecto:proyectos(user_id)')
        .in('estado', ['renderizado', 'publicado', 'exportado']);
      const mios = (clips || []).filter((c: any) => c.proyecto?.user_id === uid);
      totalClipsExportados = mios.length;
      mios.forEach((c: any) => sumarDia(exportPorDia, c.creado_en));
    }
  } catch {
    // Sin sesión / sin acceso: proyectos y clips quedan en 0.
  }

  const tasaConversionCTR = totalVisitas > 0 ? Math.round((totalClicksEmpezar / totalVisitas) * 100) : 0;
  const tasaExportacion = totalProyectos > 0 ? Math.round((totalClipsExportados / totalProyectos) * 100) : 0;

  // Serie real de los últimos 7 días.
  const actividadPorDia = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = claveDia(d);
    return {
      fecha: d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
      visitas: eventos.filter((e) => e.tipo === 'visita_landing' && (e.timestamp || '').slice(0, 10) === key).length,
      proyectos: proyectosPorDia.get(key) || 0,
      exportaciones: exportPorDia.get(key) || 0,
    };
  });

  const distribucionEventos = [
    { name: 'Visitas Landing', value: totalVisitas, color: '#8b5cf6' },
    { name: 'Clicks Empezar', value: totalClicksEmpezar, color: '#06b6d4' },
    { name: 'Proyectos Creados', value: totalProyectos, color: '#ec4899' },
    { name: 'Clips Exportados', value: totalClipsExportados, color: '#10b981' },
    { name: 'Errores', value: totalErrores, color: '#ef4444' },
  ];

  return {
    totalVisitas,
    totalClicksEmpezar,
    totalProyectos,
    totalClipsExportados,
    totalErrores,
    tasaConversionCTR,
    tasaExportacion,
    actividadPorDia,
    distribucionEventos,
    ultimosEventos: eventos.slice(0, 15),
  };
}
