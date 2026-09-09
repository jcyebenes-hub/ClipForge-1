/**
 * Cloudflare Pages Functions no exponen las variables de entorno en `process.env`
 * como Node: las entregan en `context.env`. El código de la aplicación (rutas y
 * librerías) lee `process.env.*` en 10 variables distintas, así que aquí se
 * copian antes de invocar cada handler.
 *
 * Se crea el objeto `process` si no existe para no depender de `nodejs_compat`.
 */
export interface PagesCtx {
  request: Request;
  env: Record<string, unknown>;
  params?: Record<string, string>;
  waitUntil?: (promise: Promise<unknown>) => void;
}

export function prepararEnv(env: Record<string, unknown> | undefined): void {
  const global = globalThis as { process?: { env?: Record<string, string> } };
  if (!global.process) global.process = { env: {} };
  if (!global.process.env) global.process.env = {};
  for (const [clave, valor] of Object.entries(env || {})) {
    if (valor !== undefined && valor !== null && typeof valor !== 'object') {
      global.process.env[clave] = String(valor);
    }
  }
}

/** Envuelve un error del handler en una respuesta 500 JSON, como hacía el adaptador de Express. */
export async function ejecutar(handler: (req: Request) => Promise<Response>, ctx: PagesCtx): Promise<Response> {
  prepararEnv(ctx.env);
  try {
    return await handler(ctx.request);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor', detalle: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
