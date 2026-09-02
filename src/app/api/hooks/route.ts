/**
 * API Route: /api/hooks
 * Genera ganchos (hooks) virales, CTAs, hashtags, descripciones y la primera frase destacada
 * para un clip usando Llama 3.3 70B (o algoritmos heurísticos locales en fallback)
 * y actualiza la tabla 'clips' en Supabase y/o devuelve el resultado estructurado.
 */

import { completarConGroq } from '@/src/lib/groqChat';

export interface HooksApiRequest {
  clip_id: string;
  proyecto_id?: string;
  transcripcion?: string;
  duracion_seg?: number;
  titulo_actual?: string;
  categoria?: string;
}

export interface HooksApiResponse {
  success: boolean;
  clip_id: string;
  titulo_gancho: string[]; // 3 opciones de títulos honest clickbait <=60 caracteres
  cta: string[];           // 2 opciones de llamada a la acción
  hashtags: string[];      // 8 hashtags relevantes
  descripcion: string;     // Descripción ~150 caracteres con el hashtag principal
  mejor_momento_primera_frase: string; // Frase más impactante del clip para hook de subtítulo (<=8 palabras)
  provider: 'groq-llama-3.3' | 'heuristic-generator';
  mensaje?: string;
}

/**
 * Heuristic generator for viral hooks, CTAs, hashtags, and description
 */
function generarHooksHeuristicos(
  transcripcion: string,
  tituloActual?: string
): Omit<HooksApiResponse, 'success' | 'clip_id'> {
  const text = (transcripcion || '').trim();
  const cleanTitle = (tituloActual || 'Momento Viral').replace(/[#?¿!¡]/g, '').trim();

  // Extract first impactful words
  const words = text.split(/\s+/).filter(w => w.length > 0);
  let bestHookPhrase = 'El secreto que nadie te cuenta';
  
  if (words.length >= 3) {
    const candidateWords = words.slice(0, Math.min(7, words.length));
    bestHookPhrase = candidateWords.join(' ').replace(/[.,;:()]/g, '');
    if (bestHookPhrase.length > 50) {
      bestHookPhrase = bestHookPhrase.slice(0, 45).trim();
    }
  }

  // 3 Honest clickbait title options (<=60 chars)
  const titulos = [
    `El error del 99% que destruye tus vídeos`.slice(0, 60),
    `La regla de oro para retención extrema`.slice(0, 60),
    `Cómo hacer esto en menos de 30 segundos`.slice(0, 60),
  ];

  if (cleanTitle.length > 0 && cleanTitle.length <= 45) {
    titulos[0] = `Cómo dominar ${cleanTitle.toLowerCase()}`.slice(0, 60);
    titulos[1] = `Lo que no sabías de ${cleanTitle.toLowerCase()}`.slice(0, 60);
  }

  // 2 CTAs
  const ctas = [
    'Sígueme para más trucos de crecimiento',
    'Guarda este vídeo antes de que lo borren',
  ];

  // 8 Hashtags
  const hashtags = [
    '#shorts',
    '#viral',
    '#creadores',
    '#edicion',
    '#algoritmo',
    '#marketingdigital',
    '#trucos',
    '#retencion',
  ];

  // Description ~150 chars
  const desc = `Descubre la técnica exacta para multiplicar la retención de tus vídeos cortos y hacerlos despegar. ${hashtags[0]} ${hashtags[1]}`.slice(0, 150);

  return {
    titulo_gancho: titulos,
    cta: ctas,
    hashtags,
    descripcion: desc,
    mejor_momento_primera_frase: bestHookPhrase,
    provider: 'heuristic-generator',
  };
}

export async function POST(request: Request) {
  try {
    const body: HooksApiRequest = await request.json();
    const { clip_id, proyecto_id, transcripcion, duracion_seg, titulo_actual } = body;

    if (!clip_id) {
      return new Response(JSON.stringify({ error: 'clip_id requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let textoTranscrito = transcripcion || '';

    // Si no vino la transcripción en el body, podríamos intentar cargarla si tenemos supabase server o fallback
    if (!textoTranscrito && proyecto_id) {
      textoTranscrito = titulo_actual || 'Momento viral de alto impacto con retención acelerada.';
    }

    const groqApiKey = process.env.GROQ_API_KEY;

    if (groqApiKey && textoTranscrito.length > 5) {
      try {
        const systemPrompt = `Eres un estratega senior de contenido viral y copywriting para YouTube Shorts, TikTok e Instagram Reels.
Tu misión es generar elementos de alto gancho (hooks) para un fragmento de vídeo a partir de su transcripción.

Debes responder ÚNICAMENTE un objeto JSON válido con este formato exacto:
{
  "titulo_gancho": [
    "Título honest clickbait 1 (máx 60 caracteres)",
    "Título honest clickbait 2 (máx 60 caracteres)",
    "Título honest clickbait 3 (máx 60 caracteres)"
  ],
  "cta": [
    "Llamada a la acción 1 (ej: Sígueme para más)",
    "Llamada a la acción 2 (ej: Guarda este reel para luego)"
  ],
  "hashtags": [
    "#hashtag1",
    "#hashtag2",
    "#hashtag3",
    "#hashtag4",
    "#hashtag5",
    "#hashtag6",
    "#hashtag7",
    "#hashtag8"
  ],
  "descripcion": "Descripción concisa de exactamente 140-150 caracteres que resuma el valor y termine con el hashtag principal.",
  "mejor_momento_primera_frase": "Frase más impactante del clip para ponerla como subtítulo inicial hook (máximo 8 palabras)"
}

Reglas estrictas:
1. 'titulo_gancho' DEBE tener exactamente 3 opciones irresistibles de <= 60 caracteres.
2. 'cta' DEBE tener exactamente 2 opciones.
3. 'hashtags' DEBE tener exactamente 8 hashtags relevantes con el símbolo #.
4. 'descripcion' DEBE tener ~150 caracteres.
5. 'mejor_momento_primera_frase' DEBE ser una frase concisa y de alto impacto de <= 8 palabras extraída o adaptada de la transcripción para capturar la atención en los segundos 0-1.5s.`;

        const userPrompt = `Transcripción del clip:\n"${textoTranscrito}"\n\nTítulo actual: "${titulo_actual || ''}"\nDuración: ${duracion_seg || 30}s`;

        const llm = await completarConGroq({
          apiKey: groqApiKey,
          temperature: 0.3,
          json: true,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });

        if (llm.ok) {
          const rawContent = llm.content || '{}';
          const parsed = JSON.parse(rawContent);

          const titulos = Array.isArray(parsed.titulo_gancho)
            ? parsed.titulo_gancho.slice(0, 3).map((t: string) => String(t).slice(0, 60))
            : ['El secreto que nadie te cuenta', 'La técnica para duplicar vistas', 'Lo que el 99% ignora'];

          const ctas = Array.isArray(parsed.cta)
            ? parsed.cta.slice(0, 2).map((c: string) => String(c))
            : ['Sígueme para más trucos diarios', 'Guarda este vídeo para aplicarlo'];

          const hashtags = Array.isArray(parsed.hashtags)
            ? parsed.hashtags.slice(0, 8).map((h: string) => (h.startsWith('#') ? h : `#${h}`))
            : ['#shorts', '#viral', '#creadores', '#edicion', '#algoritmo', '#marketing', '#trucos', '#retencion'];

          const descripcion = String(parsed.descripcion || '').slice(0, 160) || 'Domina el formato vertical con los secretos de retención y edición de impacto. #shorts';
          
          const primeraFrase = String(parsed.mejor_momento_primera_frase || '')
            .split(/\s+/)
            .slice(0, 8)
            .join(' ') || 'El secreto de la retención';

          const responseData: HooksApiResponse = {
            success: true,
            clip_id,
            titulo_gancho: titulos,
            cta: ctas,
            hashtags,
            descripcion,
            mejor_momento_primera_frase: primeraFrase,
            provider: 'groq-llama-3.3',
            mensaje: `Hooks y metadatos virales generados con Groq (${llm.model}).`,
          };

          return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } else {
          console.warn(`[Groq LLM] Sin respuesta válida en /api/hooks (status ${llm.status}); uso heurística.`);
        }
      } catch (llmErr) {
        console.error('Groq Llama 3.3 call error in /api/hooks:', llmErr);
      }
    }

    // Heuristic fallback
    const fallbackData = generarHooksHeuristicos(textoTranscrito, titulo_actual);
    const responseData: HooksApiResponse = {
      success: true,
      clip_id,
      ...fallbackData,
      mensaje: 'Hooks y metadatos virales generados con motor heurístico local.',
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error in /api/hooks:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Error generando hooks para el clip' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
