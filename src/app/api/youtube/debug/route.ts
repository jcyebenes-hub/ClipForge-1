/**
 * API Route (diagnóstico): /api/youtube/debug?url=...
 * Muestra QUÉ devuelve cada cliente de YouTube (incluidos los intentos *+POT)
 * desde la IP de este servidor, sin Worker ni reintentos que enmascaren el resultado.
 * Útil para ver si el token POT llega a saltar el bloqueo en la IP real.
 */

import { probarClientes, obtenerPoToken } from '@/src/lib/youtubeApi';

function extractId(url: string): string {
  const m = String(url).match(/[\w-]{11}/);
  return m ? m[0] : url;
}

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url') || '';
  const videoId = extractId(url);

  const potUrl = process.env.POT_PROVIDER_URL || '';
  let pot: any = { configurado: Boolean(potUrl) };
  if (potUrl) {
    const t0 = Date.now();
    const po = await obtenerPoToken();
    pot = {
      configurado: true,
      provider: potUrl,
      ok: Boolean(po),
      poLen: po?.po_token?.length || 0,
      visitorLen: po?.visitor_data?.length || 0,
      ms: Date.now() - t0,
    };
  }

  const player = await probarClientes(videoId, { pot: true });

  return new Response(
    JSON.stringify(
      {
        video_id: videoId,
        pot,
        clienteUsado: player.clienteUsado,
        titulo: player.titulo || null,
        numPistas: player.captionTracks.length,
        intentos: player.intentos.map((i) => ({
          cliente: i.cliente,
          statusApi: i.statusApi || null,
          numPistas: i.numPistas,
          conTitulo: Boolean(i.titulo),
          razon: (i.razon || '').slice(0, 55),
        })),
      },
      null,
      2
    ),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
