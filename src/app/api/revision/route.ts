/**
 * API Route: /api/revision — respaldo con IA para la revisión en lenguaje natural.
 *
 * Solo se llama cuando el intérprete local (src/lib/revision.ts) no reconoce la frase.
 * Reutiliza el cliente de Groq que ya usa la app (analizar, hooks, traducir), con la
 * misma clave GROQ_API_KEY: no hace falta dar de alta nada nuevo.
 *
 * SEGURIDAD: la salida del modelo NO se aplica nunca tal cual. Pasa por
 * `sanearPlanLLM`, que descarta claves inventadas, estilos inexistentes y valores
 * fuera de rango. La entrada del navegador también se sanea con `sanearAjustes`.
 */

import { completarConGroq } from '@/src/lib/groqChat';
import {
  sanearPlanLLM,
  sanearAjustes,
  ESTILOS_VALIDOS,
  type AjustesClip,
} from '@/src/lib/revision';

export const runtime = 'nodejs';

const SISTEMA = `Eres el gestor de ajustes de un editor de vídeos cortos (Shorts). Conviertes la instrucción del usuario en una lista de cambios de configuración.

CLAVES DISPONIBLES (no existen otras):
- fondo (booleano): fondo desenfocado detrás del vídeo vertical
- split (booleano): pantalla partida para dos personas
- ritmoRapido (booleano): si se aplica o no la aceleración
- velocidad (número de 1 a 2): multiplicador de velocidad
- tituloArriba (booleano): rótulo con el gancho en la parte superior
- quitarSilencios (booleano): eliminar las pausas donde nadie habla
- estiloSubtitulos (texto): uno de ${ESTILOS_VALIDOS.join(', ')}
- gancho (texto): texto del rótulo superior

REGLAS:
1. Usa SOLO esas claves. Si te inventas una, se descartará.
2. «un poco» o «ligeramente» = 10-20% del valor actual. «mucho» = alrededor del 30%.
3. Si la instrucción pide algo imposible con esas claves (cambiar el color, la música, el idioma...), NO lo fuerces: ponlo en "noSoportado" con una frase breve.
4. Si la instrucción es ambigua, no adivines: usa "noSoportado".
5. Responde SOLO con JSON válido, sin texto alrededor, con esta forma exacta:
{"cambios":[{"clave":"velocidad","nuevo":1.5}],"noSoportado":[]}`;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'No hay clave de Groq configurada (GROQ_API_KEY).' },
        { status: 503 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const instruccion = String(body.instruccion ?? '').trim().slice(0, 300);
    if (!instruccion) {
      return Response.json({ error: 'Falta la instrucción.' }, { status: 400 });
    }
    const actual: AjustesClip = sanearAjustes(body.ajustes);

    const res = await completarConGroq({
      apiKey,
      json: true,
      temperature: 0,
      timeoutMs: 25000,
      messages: [
        { role: 'system', content: SISTEMA },
        {
          role: 'user',
          content: `AJUSTES ACTUALES:\n${JSON.stringify(actual)}\n\nINSTRUCCIÓN DEL USUARIO: ${instruccion}`,
        },
      ],
    });

    if (!res.ok || !res.content) {
      return Response.json(
        { error: `El modelo no respondió (estado ${res.status ?? 'desconocido'}).` },
        { status: 502 }
      );
    }

    let crudo: unknown;
    try {
      crudo = JSON.parse(res.content);
    } catch {
      return Response.json({ error: 'El modelo no devolvió JSON válido.' }, { status: 502 });
    }

    const plan = sanearPlanLLM(crudo, actual);
    return Response.json({ plan, modelo: res.model ?? null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    console.error('[revision] Error:', e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
