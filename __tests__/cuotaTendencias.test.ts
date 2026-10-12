import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../src/app/api/tendencias/route';
import {
  reiniciarCuotaParaPruebas,
  BUSQUEDAS_GLOBALES_MAX_DIA,
} from '../src/lib/cuotaYoutube';

/**
 * La cuota es lo único que cuesta dinero de verdad en ClipForge, así que lo que
 * importa comprobar aquí es que NO se llama a YouTube cuando no toca: gastar
 * unidades y luego rechazar la petición sería tirar el dinero.
 */

const IDS = ['aaaaaaaaaaa', 'bbbbbbbbbbb'];

let llamadasSearch: number;

function instalarFetchFalso() {
  llamadasSearch = 0;
  const fetchFalso = vi.fn(async (entrada: unknown) => {
    const url = new URL(String(entrada));
    if (url.pathname.endsWith('/search')) llamadasSearch++;

    const cuerpo = url.pathname.endsWith('/search')
      ? { items: IDS.map((id) => ({ id: { videoId: id } })) }
      : url.pathname.endsWith('/videos')
        ? {
            items: IDS.map((id, i) => ({
              id,
              snippet: {
                title: `Vídeo ${i}`,
                publishedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
                channelTitle: `Canal ${i}`,
                channelId: `UC${i}`,
                tags: [],
              },
              statistics: { viewCount: '1000000', likeCount: '100', commentCount: '10' },
              contentDetails: { duration: 'PT30S' },
            })),
          }
        : { items: [] };

    return {
      ok: true,
      status: 200,
      json: async () => cuerpo,
      text: async () => JSON.stringify(cuerpo),
    };
  });
  (globalThis as unknown as { fetch: unknown }).fetch = fetchFalso;
}

function buscar(cuerpo: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/tendencias', {
    method: 'POST',
    body: JSON.stringify({ palabraClave: 'minecraft', ...cuerpo }),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/tendencias · cuota por usuario', () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = 'clave-de-prueba-no-real';
    instalarFetchFalso();
    reiniciarCuotaParaPruebas();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('la primera búsqueda de un usuario gratis deja 4 por delante', async () => {
    const res = await POST(buscar({ user_id: 'ana' }));
    const datos = await res.json();
    expect(res.status).toBe(200);
    expect(datos.busquedasRestantes).toBe(4);
  });

  it('va restando en cada búsqueda', async () => {
    const restos: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await POST(buscar({ user_id: 'ana' }));
      restos.push((await res.json()).busquedasRestantes);
    }
    expect(restos).toEqual([4, 3, 2, 1, 0]);
  });

  it('la sexta búsqueda se rechaza con 429', async () => {
    for (let i = 0; i < 5; i++) await POST(buscar({ user_id: 'ana' }));

    llamadasSearch = 0;
    const res = await POST(buscar({ user_id: 'ana' }));
    const datos = await res.json();

    expect(res.status).toBe(429);
    expect(datos.code).toBe('CUOTA_YOUTUBE');
    expect(datos.motivo).toBe('usuario');
    expect(datos.error).toContain('plan Creador');
  });

  it('al rechazar NO llama a YouTube: no se gasta ni una unidad', async () => {
    for (let i = 0; i < 5; i++) await POST(buscar({ user_id: 'ana' }));

    llamadasSearch = 0;
    await POST(buscar({ user_id: 'ana' }));
    expect(llamadasSearch).toBe(0);
  });

  it('cada usuario tiene su propio contador', async () => {
    for (let i = 0; i < 5; i++) await POST(buscar({ user_id: 'ana' }));
    expect((await POST(buscar({ user_id: 'ana' }))).status).toBe(429);

    // A otra persona no le afecta lo que gastó la primera.
    const res = await POST(buscar({ user_id: 'luis' }));
    expect(res.status).toBe(200);
    expect((await res.json()).busquedasRestantes).toBe(4);
  });

  it('un plan de pago llega más lejos que el gratis', async () => {
    for (let i = 0; i < 5; i++) await POST(buscar({ user_id: 'ana', plan: 'creador' }));
    // El gratis ya estaría cortado aquí; Creador sigue.
    const res = await POST(buscar({ user_id: 'ana', plan: 'creador' }));
    expect(res.status).toBe(200);
    expect((await res.json()).busquedasRestantes).toBe(14);
  });

  it('quien no tiene sesión también se limita, por IP', async () => {
    for (let i = 0; i < 5; i++) await POST(buscar());
    expect((await POST(buscar())).status).toBe(429);
  });
});

describe('/api/tendencias · cuota global del proyecto', () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = 'clave-de-prueba-no-real';
    instalarFetchFalso();
    reiniciarCuotaParaPruebas();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cuando el proyecto agota el día, ni un plan de pago puede buscar', async () => {
    // Cada búsqueda es de un usuario distinto para no chocar con el límite individual.
    for (let i = 0; i < BUSQUEDAS_GLOBALES_MAX_DIA; i++) {
      await POST(buscar({ user_id: `usuario-${i}`, plan: 'agencia' }));
    }

    llamadasSearch = 0;
    const res = await POST(buscar({ user_id: 'recien-llegado', plan: 'agencia' }));
    const datos = await res.json();

    expect(res.status).toBe(429);
    expect(datos.motivo).toBe('global');
    expect(datos.error).toContain('mañana');
    expect(llamadasSearch).toBe(0);
  });

  it('informa de cuántas búsquedas globales quedan', async () => {
    const res = await POST(buscar({ user_id: 'ana' }));
    const datos = await res.json();
    expect(datos.busquedasGlobalesRestantes).toBe(BUSQUEDAS_GLOBALES_MAX_DIA - 1);
  });
});
