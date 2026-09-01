/**
 * API Route: /api/analizar
 * Analiza la transcripción dividida en ventanas de 30 segundos (con 5s de solape)
 * usando Llama 3.3 70B en Groq para calcular el potencial viral y extraer los mejores clips.
 * Combina 60% LLM + 40% Heurística de Audio/Ritmo.
 */

export interface AnalizarApiRequest {
  proyecto_id: string;
  duracion_seg?: number;
  subtitulos_json?: any;
  heuristicas?: Array<{
    ventana_id: number;
    inicio: number;
    fin: number;
    texto: string;
    puntuacion_heuristica: number;
    velocidad_habla_ppm?: number;
    energia_acustica?: number;
  }>;
}

export interface ClipResult {
  id: string;
  proyecto_id: string;
  inicio_seg: number;
  fin_seg: number;
  duracion_seg: number;
  puntuacion_viral: number;
  score_llm: number;
  score_heuristica: number;
  titulo_hook: string;
  razon: string;
  cta: string;
  texto_transcrito: string;
  estado: 'sugerido' | 'seleccionado' | 'procesando' | 'listo';
}

export interface AnalizarApiResponse {
  success: boolean;
  proyecto_id: string;
  clips: ClipResult[];
  total_ventanas: number;
  mensaje: string;
  provider: 'groq-llama-3.3' | 'algorithmic-heuristic';
}

/**
 * Fallback heurístico inteligente cuando Groq no está disponible
 */
function generarAnalisisAlgoritmico(
  ventanas: Array<any>,
  proyecto_id: string
): ClipResult[] {
  const hookKeywords = [
    { word: 'error', boost: 25, hook: 'El error que comete el 99% de creadores' },
    { word: 'secreto', boost: 22, hook: 'El secreto oculto de la retención' },
    { word: 'dinero', boost: 20, hook: 'Cómo monetizar cada segundo' },
    { word: 'truco', boost: 18, hook: 'El truco infalible para viralizar' },
    { word: 'algoritmo', boost: 24, hook: 'Cómo hackear el algoritmo en 2026' },
    { word: 'atención', boost: 20, hook: 'La regla de los 2 segundos' },
    { word: 'viral', boost: 22, hook: 'Fórmula exacta para 100K vistas' },
    { word: 'gancho', boost: 25, hook: 'Cómo clavar el hook perfecto' },
    { word: 'nunca', boost: 18, hook: 'Lo que nunca debes hacer en tus vídeos' },
    { word: 'regla', boost: 19, hook: 'La regla de oro del formato 9:16' },
  ];

  const scoredClips = ventanas.map((v, idx) => {
    const texto = (v.texto || '').toLowerCase();
    let scoreLlm = 55;
    let hookTitle = `Momento Clave #${v.ventana_id || idx + 1}`;
    let razon = 'Ritmo dinámico con alta densidad de palabras clave y concepto autocontenido.';

    let matchedCount = 0;
    for (const item of hookKeywords) {
      if (texto.includes(item.word)) {
        scoreLlm += item.boost;
        if (matchedCount === 0) {
          hookTitle = item.hook;
          razon = `Gancho directo con palabra clave de alto impacto (${item.word}) y propuesta de valor clara.`;
        }
        matchedCount++;
      }
    }

    if (v.texto.includes('?') || v.texto.includes('¿')) {
      scoreLlm += 10;
      razon += ' Contiene una pregunta retórica que engancha la atención.';
    }

    if (v.texto.includes('!')) {
      scoreLlm += 8;
    }

    scoreLlm = Math.min(98, Math.max(35, scoreLlm));
    const scoreHeuristica = Number(v.puntuacion_heuristica) || 70;
    const puntuacionFinal = Math.round(scoreLlm * 0.6 + scoreHeuristica * 0.4);

    return {
      id: `clip-${proyecto_id}-${v.ventana_id || idx + 1}`,
      proyecto_id,
      inicio_seg: v.inicio,
      fin_seg: v.fin,
      duracion_seg: Math.round(v.fin - v.inicio),
      puntuacion_viral: puntuacionFinal,
      score_llm: scoreLlm,
      score_heuristica: scoreHeuristica,
      titulo_hook: hookTitle,
      razon: razon.trim(),
      cta: '¡Sígueme para no perderte la segunda parte!',
      texto_transcrito: v.texto || '',
      estado: 'sugerido' as const,
    };
  });

  return scoredClips
    .filter((c) => c.puntuacion_viral >= 40)
    .sort((a, b) => b.puntuacion_viral - a.puntuacion_viral)
    .slice(0, 6);
}

import { verificarRateLimit, obtenerIpDeRequest } from '@/src/lib/rateLimit';
import { sanitizarTitulo, sanitizarDescripcion } from '@/src/lib/sanitizer';

export async function POST(request: Request) {
  try {
    const ip = obtenerIpDeRequest(request);
    const body: AnalizarApiRequest & { user_id?: string } = await request.json();
    const { proyecto_id, heuristicas = [], subtitulos_json, user_id } = body;

    if (!proyecto_id) {
      return new Response(JSON.stringify({ error: 'proyecto_id requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Rate Limiting Protection (10 análisis / hora)
    const rateCheck = await verificarRateLimit('analizar', user_id, ip);
    if (!rateCheck.permitido) {
      return new Response(
        JSON.stringify({
          error: rateCheck.mensaje || 'Límite de análisis virales alcanzado (máx. 10/hora).',
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

    // Preparar ventanas a evaluar
    let ventanas = heuristicas;
    if (!ventanas || ventanas.length === 0) {
      const segments = subtitulos_json?.segments || [];
      const duracionTotal = body.duracion_seg || (segments.length ? segments[segments.length - 1].end : 120);
      
      const ventanaSize = 30;
      const solape = 5;
      const step = ventanaSize - solape;
      let curr = 0;
      let id = 1;
      
      const tempVentanas: any[] = [];
      while (curr < duracionTotal) {
        const fin = Math.min(curr + ventanaSize, duracionTotal);
        if (fin - curr >= 10) {
          const segsInWindow = segments.filter((s: any) => s.start >= curr - 1 && s.end <= fin + 1);
          const texto = segsInWindow.map((s: any) => s.text).join(' ');
          tempVentanas.push({
            ventana_id: id++,
            inicio: Number(curr.toFixed(1)),
            fin: Number(fin.toFixed(1)),
            texto: texto || `Segmento de contenido (${curr}s - ${fin}s)`,
            puntuacion_heuristica: 70,
          });
        }
        curr += step;
        if (curr >= duracionTotal) break;
      }
      ventanas = tempVentanas;
    }

    const groqApiKey = process.env.GROQ_API_KEY;

    // Si hay API key de Groq, invocamos llama-3.3-70b-versatile con timeout de 60s
    if (groqApiKey && ventanas.length > 0) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      try {
        const ventanasPromptPayload = ventanas.map((v) => ({
          ventana_id: v.ventana_id,
          inicio: v.inicio,
          fin: v.fin,
          texto: v.texto,
        }));

        const systemPrompt = `Eres un experto mundial en algoritmos de retención y viralidad para TikTok, YouTube Shorts e Instagram Reels.
Analiza cada ventana de transcripción de 30 segundos y evalúa su potencial viral de 0 a 100 basándote en:
1. Ganchos iniciales (Hooks) y punchlines irresistibles.
2. Momentos de alta emoción, humor o sorpresa.
3. Datos impactantes o estadísticas contra-intuitivas.
4. Preguntas retóricas que frenan el scroll.
5. Debates intensos o lecciones de alto valor con inicio y fin claros.

Debes responder ÚNICAMENTE un array JSON válido con la siguiente estructura exacta:
[
  {
    "ventana_id": 1,
    "inicio": 0.0,
    "fin": 30.0,
    "puntuacion": 92,
    "titulo_hook": "El error del 99% que destruye tus vídeos",
    "razon": "Comienza con un gancho de confrontación directa y desvela un dato revelador en menos de 10 segundos."
  }
]`;

        const userPrompt = `Evalúa las siguientes ventanas de audio:\n${JSON.stringify(ventanasPromptPayload, null, 2)}`;

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (groqResponse.ok) {
          const aiJson = await groqResponse.json();
          const rawContent = aiJson.choices?.[0]?.message?.content || '{}';
          
          let parsedEvaluations: any[] = [];
          try {
            const parsed = JSON.parse(rawContent);
            parsedEvaluations = Array.isArray(parsed) ? parsed : (parsed.evaluaciones || parsed.ventanas || parsed.clips || Object.values(parsed)[0] || []);
          } catch (pe) {
            console.warn('Error parsing Groq LLM JSON response:', pe);
          }

          if (Array.isArray(parsedEvaluations) && parsedEvaluations.length > 0) {
            const scoredClips: ClipResult[] = ventanas.map((v, idx) => {
              const evalMatch = parsedEvaluations.find((e: any) => e.ventana_id === v.ventana_id) || parsedEvaluations[idx] || {};
              const llmScore = Math.min(100, Math.max(0, Number(evalMatch.puntuacion) || 65));
              const heuristicaScore = Number(v.puntuacion_heuristica) || 70;
              
              // Fórmula solicitada: 60% LLM + 40% Heurística
              const finalScore = Math.round(0.6 * llmScore + 0.4 * heuristicaScore);

              return {
                id: `clip-${proyecto_id}-${v.ventana_id || idx + 1}`,
                proyecto_id,
                inicio_seg: v.inicio,
                fin_seg: v.fin,
                duracion_seg: Math.round(v.fin - v.inicio),
                puntuacion_viral: finalScore,
                score_llm: llmScore,
                score_heuristica: heuristicaScore,
                titulo_hook: sanitizarTitulo(evalMatch.titulo_hook || `Gancho Viral #${v.ventana_id}`, 100),
                razon: sanitizarDescripcion(evalMatch.razon || 'Estructura narrativa compacta con fuerte impacto inicial.', 300),
                cta: '¡Sígueme para no perderte la segunda parte!',
                texto_transcrito: sanitizarDescripcion(v.texto || '', 1000),
                estado: 'sugerido',
              };
            });

            const top6Clips = scoredClips
              .filter((c) => c.puntuacion_viral >= 40)
              .sort((a, b) => b.puntuacion_viral - a.puntuacion_viral)
              .slice(0, 6);

            return new Response(
              JSON.stringify({
                success: true,
                proyecto_id,
                clips: top6Clips,
                total_ventanas: ventanas.length,
                mensaje: `Analizadas ${ventanas.length} ventanas con Llama 3.3 70B y heurística acústica.`,
                provider: 'groq-llama-3.3',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }
        } else {
          const errText = await groqResponse.text();
          console.warn(`[Groq Llama 3.3] Status ${groqResponse.status}: ${errText}`);
        }
      } catch (llmError: any) {
        clearTimeout(timeoutId);
        if (llmError.name === 'AbortError') {
          console.warn('[Groq Llama 3.3 API] La llamada de análisis excedió 60s y fue cancelada.');
        } else {
          console.error('Groq Llama 3.3 execution failed, falling back:', llmError);
        }
      }
    }

    // Fallback: Algoritmo heurístico local de alta precisión
    const fallbackClips = generarAnalisisAlgoritmico(ventanas, proyecto_id);

    return new Response(
      JSON.stringify({
        success: true,
        proyecto_id,
        clips: fallbackClips,
        total_ventanas: ventanas.length,
        mensaje: `Analizadas ${ventanas.length} ventanas temporales con algoritmo de impacto viral.`,
        provider: 'algorithmic-heuristic',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('Error in /api/analizar:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Error procesando análisis viral' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
