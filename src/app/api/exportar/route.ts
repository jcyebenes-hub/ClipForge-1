/**
 * API Route: /api/exportar
 * Endpoint para validar y registrar rate limiting de exportación de clips (máx 20/día)
 * y registrar el progreso y metadatos de exportación.
 */

import { verificarRateLimit, obtenerIpDeRequest } from '@/src/lib/rateLimit';
import { sanitizarTitulo } from '@/src/lib/sanitizer';

export async function POST(request: Request) {
  try {
    const ip = obtenerIpDeRequest(request);
    const body = await request.json().catch(() => ({}));
    const { clip_id, proyecto_id, user_id, titulo } = body;

    // 1. Rate limiting: máx 20 exportaciones por día
    const rateCheck = await verificarRateLimit('exportar', user_id, ip);
    if (!rateCheck.permitido) {
      return new Response(
        JSON.stringify({
          error: rateCheck.mensaje || 'Has alcanzado el límite diario de 20 exportaciones de vídeo.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateCheck.reseteoEnSegundos,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.reseteoEnSegundos),
          },
        }
      );
    }

    const cleanTitle = sanitizarTitulo(titulo || 'clip_exportado');

    return new Response(
      JSON.stringify({
        success: true,
        permitido: true,
        restantes: rateCheck.restantes,
        max: rateCheck.max,
        clip_id,
        proyecto_id,
        titulo: cleanTitle,
        mensaje: `Exportación autorizada. Te quedan ${rateCheck.restantes} exportaciones disponibles hoy.`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('Error en /api/exportar:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Error al validar exportación' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
