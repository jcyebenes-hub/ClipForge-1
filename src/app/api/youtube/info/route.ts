/**
 * API Route: /api/youtube/info
 * Obtiene metadatos de un video de YouTube llamando al microservicio FastAPI (YT_WORKER_URL)
 * o con datos de prueba estructurados si el worker no está disponible.
 */

export interface YoutubeInfoResponse {
  titulo: string;
  autor: string;
  duracion_seg: number;
  miniatura: string;
  videoId?: string;
}

export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export function getMockYoutubeInfo(url: string): YoutubeInfoResponse {
  const videoId = extractYoutubeId(url) || 'dQw4w9WgXcQ';
  
  const isPodcast = url.toLowerCase().includes('podcast') || url.toLowerCase().includes('entrevista');
  const isTutorial = url.toLowerCase().includes('tutorial') || url.toLowerCase().includes('curso');

  let titulo = 'Cómo facturar $10K/mes con IA y Contenido Viral en 2026';
  let autor = 'Alex Hormozi & EmprendeTech';
  let duracion_seg = 1420; // 23m 40s

  if (isPodcast) {
    titulo = 'Episodio #42: Los Secretos de la Retención en TikTok y Shorts';
    autor = 'Podcast Creativo';
    duracion_seg = 2850; // 47m 30s
  } else if (isTutorial) {
    titulo = 'Masterclass Completa: Edición Automatizada y Subtítulos Virales';
    autor = 'Academia de Creadores';
    duracion_seg = 1890; // 31m 30s
  }

  const miniatura = videoId 
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80';

  return {
    titulo,
    autor,
    duracion_seg,
    miniatura,
    videoId,
  };
}

export async function fetchYoutubeInfo(url: string): Promise<YoutubeInfoResponse> {
  const metaEnv = typeof import.meta !== 'undefined' && 'env' in import.meta 
    ? (import.meta as unknown as { env: Record<string, string | undefined> }).env 
    : undefined;

  const workerUrl = 
    process.env.YT_WORKER_URL || 
    process.env.NEXT_PUBLIC_YT_WORKER_URL ||
    metaEnv?.VITE_YT_WORKER_URL ||
    metaEnv?.YT_WORKER_URL;

  if (workerUrl) {
    try {
      const cleanWorkerUrl = workerUrl.replace(/\/+$/, '');
      const response = await fetch(`${cleanWorkerUrl}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(15000), // 15 seconds timeout
      });

      if (response.ok) {
        const data = await response.json();
        return {
          titulo: data.titulo || 'Video de YouTube',
          autor: data.autor || 'Canal de YouTube',
          duracion_seg: Number(data.duracion_seg) || 0,
          miniatura: data.miniatura || '',
          videoId: data.videoId || extractYoutubeId(url) || undefined,
        };
      } else {
        const errText = await response.text();
        console.warn(`[YT Worker] /info devolvió ${response.status}: ${errText}`);
      }
    } catch (err) {
      console.warn('[YT Worker] Fallback activado. No se pudo conectar al worker:', err);
    }
  }

  // Fallback if worker not configured or unreachable
  return getMockYoutubeInfo(url);
}

// Next.js standard Route Handler (GET)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url') || '';

  if (!url) {
    return new Response(JSON.stringify({ error: 'URL requerida' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const info = await fetchYoutubeInfo(url);
  return new Response(JSON.stringify(info), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Next.js standard Route Handler (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = body?.url || '';

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL requerida' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const info = await fetchYoutubeInfo(url);
    return new Response(JSON.stringify(info), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Cuerpo de solicitud inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
