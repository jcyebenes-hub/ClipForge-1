/**
 * Cliente mínimo de chat-completions de Groq con cadena de modelos de respaldo.
 *
 * ¿Por qué existe? Groq RETIRA modelos con el tiempo: la clave actual ya no da
 * acceso a `llama-3.3-70b-versatile` (devuelve 404 model_not_found), así que las
 * rutas que lo tenían hardcodeado caían siempre al fallback heurístico.
 *
 * Estrategia: se permite fijar el modelo con `GROQ_LLM_MODEL` y, si no, se prueba
 * una lista de candidatos en orden hasta que uno responda. Así la app no se rompe
 * cada vez que Groq retire un modelo.
 */

const MODELOS_POR_DEFECTO = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
  'qwen/qwen3.6-27b',
  'groq/compound',
  'llama-3.3-70b-versatile', // por si alguna clave aún conserva acceso
];

export interface GroqChatResult {
  ok: boolean;
  /** Texto devuelto por el modelo (ya extraído de choices[0]). */
  content?: string;
  /** Modelo que finalmente respondió. */
  model?: string;
  /** Último código HTTP visto si todo falló. */
  status?: number;
}

export async function completarConGroq(opts: {
  apiKey: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  /** Pide a Groq respuesta en JSON (response_format json_object). */
  json?: boolean;
  timeoutMs?: number;
}): Promise<GroqChatResult> {
  const override = process.env.GROQ_LLM_MODEL;
  const modelos = [...(override ? [override] : []), ...MODELOS_POR_DEFECTO];
  let ultimoStatus = 0;

  for (const model of modelos) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60000);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.3,
          ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        return { ok: true, content: data.choices?.[0]?.message?.content || '', model };
      }

      ultimoStatus = res.status;
      const texto = await res.text().catch(() => '');
      // Modelo inexistente / sin acceso / sobrecargado: probamos el siguiente.
      if (/model_not_found|does not exist|no access|not supported|decommissioned|overloaded/i.test(texto)) {
        continue;
      }
      // Errores de rate-limit o servidor también reintentamos con otro modelo.
      if (res.status === 429 || res.status >= 500) continue;
      // Cualquier otro error (p. ej. 400 de payload) no tiene sentido reintentar.
      if (res.status !== 404) return { ok: false, status: res.status };
    } catch {
      clearTimeout(timer);
      continue; // corte de red / timeout: siguiente modelo
    }
  }

  return { ok: false, status: ultimoStatus };
}
