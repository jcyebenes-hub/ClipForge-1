/**
 * API Route: /api/traducir
 * Traduce subtítulos de un clip a más de 30 idiomas utilizando Llama 3.3 70B en Groq.
 * Mantiene exactamente los tiempos de inicio y fin (t_inicio, t_fin) de cada entrada.
 */

import { IDIOMAS_DISPONIBLES, EntradaSubtituloJSON, traducirEntradasFallback } from '@/src/lib/traduccion';
import { completarConGroq } from '@/src/lib/groqChat';

export interface TraducirApiRequest {
  clip_id: string;
  idioma: string; // ej: 'en', 'fr', 'pt', 'ja', 'de', etc.
  subtitulos?: EntradaSubtituloJSON[];
}

export interface TraducirApiResponse {
  success: boolean;
  clip_id: string;
  idioma: string;
  subtitulos: EntradaSubtituloJSON[];
  provider: 'groq-llama-3.3' | 'fallback-translator';
  mensaje?: string;
}

export async function POST(request: Request) {
  try {
    const body: TraducirApiRequest = await request.json();
    const { clip_id = 'clip-demo', idioma = 'en', subtitulos = [] } = body;

    if (!clip_id || !idioma) {
      return new Response(
        JSON.stringify({ error: 'Parámetros clip_id e idioma requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Identificar el idioma de destino
    const idiomaInfo = IDIOMAS_DISPONIBLES.find(
      (i) => i.codigo.toLowerCase() === idioma.toLowerCase()
    ) || {
      codigo: idioma,
      nombre: idioma.toUpperCase(),
      nombreNativo: idioma.toUpperCase(),
      bandera: '🌐',
    };

    // Si ya está en español y no hay nada que traducir
    if (idioma === 'es' && subtitulos.length > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          clip_id,
          idioma: 'es',
          subtitulos,
          provider: 'groq-llama-3.3',
          mensaje: 'Subtítulos en español original',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Entradas de subtítulos a procesar
    let entradasAProcesar: EntradaSubtituloJSON[] = subtitulos;
    if (entradasAProcesar.length === 0) {
      entradasAProcesar = [
        {
          t_inicio: 0.5,
          t_fin: 4.5,
          texto: 'Bienvenidos a este episodio especial sobre retención viral.',
        },
        {
          t_inicio: 4.6,
          t_fin: 9.5,
          texto: 'El primer error del noventa y nueve por ciento es tardar en captar la atención.',
        },
        {
          t_inicio: 9.6,
          t_fin: 14.8,
          texto: 'Aplica subtítulos dinámicos con palabras clave destacadas.',
        },
      ];
    }

    const groqApiKey = process.env.GROQ_API_KEY;

    if (groqApiKey && entradasAProcesar.length > 0) {
      try {
        const systemPrompt = `Eres un traductor profesional de subtítulos de vídeo para redes sociales (TikTok, YouTube Shorts, Reels).
Tu tarea es traducir fielmente y de forma natural los subtítulos proporcionados al idioma especificado (${idiomaInfo.nombre} / ${idiomaInfo.nombreNativo}).
REGLAS OBLIGATORIAS:
1. Traduce cada entrada del JSON manteniendo EXACTAMENTE la misma cantidad de elementos.
2. Conserva intactos los campos numéricos "t_inicio" y "t_fin".
3. Adapta el texto para que sea conciso, fluido y con ritmo ideal para subtítulos de vídeo corto.
4. Devuelve ÚNICAMENTE un array JSON válido con la estructura [{ "t_inicio": number, "t_fin": number, "texto": string }].`;

        const userPrompt = `Traduce cada entrada de este JSON de subtítulos [{t_inicio, t_fin, texto}] a ${idiomaInfo.nombre} (${idiomaInfo.nombreNativo}). Mantén el número exacto de entradas y los tiempos. Devuelve solo JSON.
JSON de entrada:
${JSON.stringify(entradasAProcesar, null, 2)}`;

        const llm = await completarConGroq({
          apiKey: groqApiKey,
          temperature: 0.1,
          json: true,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });

        if (llm.ok) {
          const rawContent = llm.content || '{}';

          let parsedEntradas: EntradaSubtituloJSON[] = [];
          try {
            const parsed = JSON.parse(rawContent);
            if (Array.isArray(parsed)) {
              parsedEntradas = parsed;
            } else if (parsed.subtitulos && Array.isArray(parsed.subtitulos)) {
              parsedEntradas = parsed.subtitulos;
            } else if (parsed.subtitles && Array.isArray(parsed.subtitles)) {
              parsedEntradas = parsed.subtitles;
            } else {
              const firstArray = Object.values(parsed).find((val) => Array.isArray(val));
              if (firstArray) {
                parsedEntradas = firstArray as EntradaSubtituloJSON[];
              }
            }
          } catch (jsonErr) {
            console.warn('Error parseando JSON de Llama 3.3:', jsonErr);
          }

          if (parsedEntradas.length > 0) {
            // Normalizar y garantizar los tiempos originales
            const finalSubtitulos: EntradaSubtituloJSON[] = entradasAProcesar.map((original, idx) => {
              const match = parsedEntradas[idx] || parsedEntradas.find((p) => Math.abs(p.t_inicio - original.t_inicio) < 0.2);
              return {
                t_inicio: original.t_inicio,
                t_fin: original.t_fin,
                texto: match?.texto || original.texto,
              };
            });

            return new Response(
              JSON.stringify({
                success: true,
                clip_id,
                idioma: idiomaInfo.codigo,
                subtitulos: finalSubtitulos,
                provider: 'groq-llama-3.3',
                mensaje: `Subtítulos traducidos exitosamente a ${idiomaInfo.nombre} con Groq (${llm.model})`,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (groqErr) {
        console.warn('Fallo en traducción con Groq Llama 3.3:', groqErr);
      }
    }

    // Fallback heurístico si no hay Groq o hubo fallo de red
    const fallbackTraducidos = traducirEntradasFallback(entradasAProcesar, idiomaInfo.codigo);

    return new Response(
      JSON.stringify({
        success: true,
        clip_id,
        idioma: idiomaInfo.codigo,
        subtitulos: fallbackTraducidos,
        provider: 'fallback-translator',
        mensaje: `Subtítulos adaptados a ${idiomaInfo.nombre}`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en /api/traducir:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Error interno en traducción de subtítulos' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
