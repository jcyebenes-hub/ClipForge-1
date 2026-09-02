/**
 * API Route: /api/analizar
 * Analiza la transcripción dividida en ventanas de 30 segundos (con 5s de solape)
 * usando Llama 3.3 70B en Groq para calcular el potencial viral y extraer los mejores clips.
 * Combina 60% LLM + 40% Heurística de Audio/Ritmo.
 *
 * v2 (2026-09): 
 *  - Preselecciona ventanas diversas (máx 16) antes de llamar a la IA (menos tokens/latencia).
 *  - Aplica NMS (supresión de solapes) para que los clips NO se solapen ni se repitan
 *    entre sí: 6 momentos realmente distintos del vídeo.
 *  - Indica con transparencia qué motor generó el resultado.
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

  // Sin recortar a 6 aquí: el NMS del llamador elegirá los 6 mejores sin solapes
  return scoredClips
    .filter((c) => c.puntuacion_viral >= 40)
    .sort((a, b) => b.puntuacion_viral - a.puntuacion_viral);
}

import { verificarRateLimit, obtenerIpDeRequest } from '@/src/lib/rateLimit';
import { sanitizarTitulo, sanitizarDescripcion } from '@/src/lib/sanitizer';
import { completarConGroq } from '@/src/lib/groqChat';

/**
 * Preselecciona un máximo de `max` ventanas repartidas en el tiempo y con mejor
 * puntuación heurística, para no saturar el prompt de la IA con ~57 ventanas
 * (la mayoría casi idénticas por el solape de 5s).
 */
function preseleccionarVentanasDiversas(
  ventanas: Array<any>,
  max: number = 16,
  distanciaMinimaInicio: number = 20
): Array<any> {
  if (ventanas.length <= max) return ventanas;

  const ordenadas = [...ventanas].sort(
    (a, b) => (b.puntuacion_heuristica || 0) - (a.puntuacion_heuristica || 0)
  );

  const elegidas: Array<any> = [];
  for (const v of ordenadas) {
    const cerca = elegidas.some(
      (c) => Math.abs(Number(c.inicio) - Number(v.inicio)) < distanciaMinimaInicio
    );
    if (!cerca) {
      elegidas.push(v);
      if (elegidas.length >= max) break;
    }
  }
  return elegidas.sort((a, b) => a.inicio - b.inicio);
}

/**
 * NMS: de una lista de clips puntuados, acepta el mejor y descarta cualquier
 * otro que se solape >0.5s con los ya aceptados. Evita clips duplicados que
 * cubren el mismo momento del vídeo (p. ej. 0-30s y 25-55s).
 */
function aplicarNMS(clips: ClipResult[], max: number = 6, toleranciaSolapeSeg: number = 0.5): ClipResult[] {
  const ordenados = [...clips].sort((a, b) => b.puntuacion_viral - a.puntuacion_viral);
  const aceptados: ClipResult[] = [];
  for (const c of ordenados) {
    const solapa = aceptados.some(
      (a) => c.inicio_seg < a.fin_seg - toleranciaSolapeSeg && c.fin_seg > a.inicio_seg + toleranciaSolapeSeg
    );
    if (!solapa) {
      aceptados.push(c);
      if (aceptados.length >= max) break;
    }
  }
  return aceptados.sort((a, b) => a.inicio_seg - b.inicio_seg);
}

/** Extrae un array de evaluaciones del JSON (a veces viene con ```json ... ``` o texto alrededor) */
function extraerArrayEvaluaciones(raw: string): any[] {
  if (!raw) return [];
  let t = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    const parsed = JSON.parse(t);
    if (Array.isArray(parsed)) return parsed;
    return parsed.evaluaciones || parsed.ventanas || parsed.clips || [];
  } catch {
    // Último intento: recortar hasta el primer [ y último ]
    const ini = t.indexOf('[');
    const fin = t.lastIndexOf(']');
    if (ini !== -1 && fin > ini) {
      try {
        const parsed = JSON.parse(t.slice(ini, fin + 1));
        if (Array.isArray(parsed)) return parsed;
      } catch {
        /* no recuperable */
      }
    }
    return [];
  }
}

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

    // Si hay API key de Groq, evaluamos con el LLM (cadena de modelos en groqChat.ts, 90s).
    // Para no saturar el prompt (ni el presupuesto gratis), solo enviamos un
    // subconjunto diverso de ventanas (máx 16).
    if (groqApiKey && ventanas.length > 0) {
      const ventanasIA = preseleccionarVentanasDiversas(ventanas, 16);

      try {
        const ventanasPromptPayload = ventanasIA.map((v) => ({
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

        const llm = await completarConGroq({
          apiKey: groqApiKey,
          temperature: 0.2,
          json: true,
          timeoutMs: 90000,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });

        if (llm.ok) {
          const rawContent = llm.content || '';
          
          const parsedEvaluations = extraerArrayEvaluaciones(rawContent);

          if (Array.isArray(parsedEvaluations) && parsedEvaluations.length > 0) {
            const scoredClips: ClipResult[] = ventanasIA.map((v, idx) => {
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
                titulo_hook: sanitizarTitulo(evalMatch.titulo_hook || `Momento viral #${v.ventana_id}`, 100),
                razon: sanitizarDescripcion(evalMatch.razon || 'Estructura narrativa compacta con fuerte impacto inicial.', 300),
                cta: '¡Sígueme para no perderte la segunda parte!',
                texto_transcrito: sanitizarDescripcion(v.texto || '', 1000),
                estado: 'sugerido',
              };
            });

            // Filtro por puntuación + NMS: 6 clips sin solaparse entre sí
            const finalClips = aplicarNMS(
              scoredClips.filter((c) => c.puntuacion_viral >= 40),
              6
            );

            return new Response(
              JSON.stringify({
                success: true,
                proyecto_id,
                clips: finalClips,
                total_ventanas: ventanas.length,
                mensaje: `Evaluadas ${ventanasIA.length} ventanas con Llama 3.3 70B y seleccionados ${finalClips.length} momentos sin solapes.`,
                provider: 'groq-llama-3.3',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }
        } else {
          console.warn(`[Groq LLM] Sin respuesta válida (status ${llm.status}); uso heurística local.`);
        }
      } catch (llmError: any) {
        console.error('Groq LLM execution failed, falling back:', llmError);
      }
    }

    // Fallback: Algoritmo heurístico local + NMS (sin solapes entre clips)
    const fallbackClips = aplicarNMS(generarAnalisisAlgoritmico(ventanas, proyecto_id), 6);

    return new Response(
      JSON.stringify({
        success: true,
        proyecto_id,
        clips: fallbackClips,
        total_ventanas: ventanas.length,
        mensaje:
          'No se pudo usar el motor Llama 3.3 (límite, tiempo o respuesta inválida). Resultados generados con el motor heurístico local de impacto viral.',
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
