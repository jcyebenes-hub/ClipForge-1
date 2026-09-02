/**
 * API Route: /api/youtube/probe (diagnóstico)
 * Devuelve qué estrategias de acceso a YouTube funcionan desde la IP del servidor.
 * Uso: GET /api/youtube/probe?v=VIDEOID
 */

import {
  probarClientes,
  sondearPagina,
  obtenerCookiesYouTube,
  consultarClienteConCookies,
  CLIENTES_YOUTUBE,
} from '@/src/lib/youtubeApi';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('v') || searchParams.get('id') || '';

  if (!videoId) {
    return new Response(JSON.stringify({ error: 'Parámetro v requerido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const sesion = await obtenerCookiesYouTube();
    const apiSinCookie = await probarClientes(videoId);

    const intentosConCookie: any[] = [];
    for (const cliente of CLIENTES_YOUTUBE.slice(0, 3)) {
      const it = await consultarClienteConCookies(videoId, cliente, sesion);
      intentosConCookie.push({
        cliente: it.cliente,
        statusApi: it.statusApi || undefined,
        razon: it.razon || undefined,
        playable: it.playable,
        numPistas: it.numPistas,
        conTitulo: Boolean(it.titulo),
        duracionApi: it.duracion_seg || 0,
      });
    }

    const pagina = await sondearPagina(videoId);

    return new Response(
      JSON.stringify({
        ok: true,
        videoId,
        apiSinCookie: apiSinCookie.intentos.map((i) => ({
          cliente: i.cliente,
          statusApi: i.statusApi || undefined,
          razon: i.razon || undefined,
          playable: i.playable,
          numPistas: i.numPistas,
          conTitulo: Boolean(i.titulo),
        })),
        apiConCookie: intentosConCookie,
        cookiesLongitud: sesion.cookieHeader.length,
        pagina,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
