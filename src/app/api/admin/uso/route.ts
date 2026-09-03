/**
 * GET /api/admin/uso
 * Resumen de uso REAL de los últimos 30 días a partir de la tabla `eventos`.
 *
 * Necesita SUPABASE_SERVICE_ROLE_KEY (la clave service_role de Supabase) porque la
 * política RLS de `eventos` solo deja leer al propio usuario o al service_role.
 * Sin ella, devuelve 503 con instrucciones claras.
 *
 * NO exponer públicamente en el futuro sin protegerlo (es telemetría agregada).
 */
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return new Response(
      JSON.stringify({
        error:
          'Falta SUPABASE_SERVICE_ROLE_KEY en Render. Añádela (Supabase → Settings → API → service_role) para ver métricas agregadas.',
        code: 'SIN_SERVICE_ROLE',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const desde = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const { data, error } = await sb
    .from('eventos')
    .select('tipo, fecha')
    .gte('fecha', desde)
    .limit(5000);

  if (error) {
    return new Response(JSON.stringify({ error: error.message, code: 'QUERY_ERROR' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const eventos = data || [];
  const porTipo: Record<string, number> = {};
  const porDia: Record<string, number> = {};
  for (const e of eventos) {
    porTipo[e.tipo] = (porTipo[e.tipo] || 0) + 1;
    const d = String(e.fecha || '').slice(0, 10);
    if (d) porDia[d] = (porDia[d] || 0) + 1;
  }

  return new Response(
    JSON.stringify({
      rango: 'ultimos_30_dias',
      total_eventos: eventos.length,
      por_tipo: porTipo,
      por_dia: porDia,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
